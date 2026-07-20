// The user-facing authorization endpoint. A plain server-rendered page (not an
// SPA route) so it works on a fresh cross-site navigation from the client and can
// issue genuine HTTP redirects for login bounce / OAuth error / success — none of
// which the app's client-only rendering (ssr=false) would handle reliably.
//
// GET  → validate the request, require a signed-in session, render a consent page.
// POST → on "approve" mint a PKCE-bound code and redirect back; on "deny" report it.
import { error, redirect } from '@sveltejs/kit';
import { getClient, issueAuthCode, redirectAllowed } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

/** Append query params (skipping empties) to a redirect URI. */
function buildRedirect(base: string, params: Record<string, string | undefined>): string {
	const u = new URL(base);
	for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
	return u.toString();
}

/** Same-origin guard for the cookie-authenticated consent POST. DCR is open, so
 *  without this an attacker could register a client and CSRF a logged-in user into
 *  approving — sending an auth code to the attacker's redirect_uri. Browsers always
 *  send Origin (or at least Referer) on a cross-site form POST; a state-changing
 *  request carrying neither is rejected. */
function isSameOrigin(request: Request, origin: string): boolean {
	const o = request.headers.get('origin');
	if (o) return o === origin;
	const ref = request.headers.get('referer');
	if (ref) {
		try {
			return new URL(ref).origin === origin;
		} catch {
			return false;
		}
	}
	return false;
}

const escapeHtml = (s: string) =>
	s.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
	);

type Fields = {
	clientId: string;
	redirectUri: string;
	codeChallenge: string;
	scope: string;
	resource: string;
	state: string;
	clientName: string;
	userEmail: string;
};

function consentPage(f: Fields): Response {
	const hidden = (name: string, value: string) =>
		`<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;
	const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize — Send Lab</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center;
    justify-content:center; gap:24px; padding:20px;
    font-family: 'Inter Variable', Inter, system-ui, sans-serif;
    background:#0b0b0c; color:#e7e7e9; }
  h1 { display:flex; align-items:center; gap:10px; font-size:24px; font-weight:900;
    letter-spacing:-.02em; margin:0; }
  .flag { display:inline-block; width:12px; height:24px; transform:skewX(-12deg);
    background:#e5484d; box-shadow:3px 0 0 #b3282c; }
  .card { width:100%; max-width:380px; background:#141416; border:1px solid #2a2a2e;
    border-radius:14px; padding:22px; }
  .title { font-size:20px; font-weight:700; margin:0 0 6px; }
  .sub { font-size:14px; color:#a1a1a8; margin:0 0 16px; }
  .sub b { color:#e7e7e9; }
  .scopes { border:1px solid #2a2a2e; background:#0f0f11; border-radius:8px;
    padding:10px 12px; font-size:12px; color:#a1a1a8; margin:0 0 14px; }
  .scopes b { display:block; color:#e7e7e9; margin-bottom:6px; }
  .scopes ul { margin:0; padding-left:18px; }
  .scopes li { margin:2px 0; }
  .note { font-size:11px; color:#77777e; margin:0 0 16px; }
  .row { display:flex; gap:8px; }
  button { flex:1; padding:10px; font-size:14px; border-radius:8px; cursor:pointer;
    border:1px solid #2a2a2e; font-family:inherit; }
  .deny { background:transparent; color:#e7e7e9; }
  .approve { background:#e5484d; border-color:#e5484d; color:#fff; font-weight:600; }
  .approve:hover { background:#d13b40; }
</style></head>
<body>
  <h1><span class="flag"></span>SEND&nbsp;LAB</h1>
  <div class="card">
    <p class="title">Authorize access</p>
    <p class="sub"><b>${escapeHtml(f.clientName)}</b> wants to connect to your Send Lab account.</p>
    <div class="scopes">
      <b>This will let it:</b>
      <ul>
        <li>Read your full training account (program, metrics, logs, workouts)</li>
        <li>Create and update your program, exercises, and assessments</li>
      </ul>
    </div>
    <p class="note">Signed in as ${escapeHtml(f.userEmail)}. You can revoke access anytime by
      regenerating your API access in Settings.</p>
    <form method="POST" class="row">
      ${hidden('clientId', f.clientId)}
      ${hidden('redirectUri', f.redirectUri)}
      ${hidden('codeChallenge', f.codeChallenge)}
      ${hidden('scope', f.scope)}
      ${hidden('resource', f.resource)}
      ${hidden('state', f.state)}
      <button class="deny" type="submit" name="decision" value="deny">Deny</button>
      <button class="approve" type="submit" name="decision" value="approve">Authorize</button>
    </form>
  </div>
</body></html>`;
	return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const p = url.searchParams;
	const clientId = p.get('client_id') ?? '';
	const redirectUri = p.get('redirect_uri') ?? '';

	const client = await getClient(clientId);
	if (!client) error(400, 'Unknown client_id — this application is not registered.');
	if (!redirectUri || !redirectAllowed(client, redirectUri))
		error(400, 'The redirect_uri is not registered for this client.');

	// From here we can safely report errors by redirecting back to the client.
	const state = p.get('state') ?? undefined;
	if (p.get('response_type') !== 'code')
		redirect(302, buildRedirect(redirectUri, { error: 'unsupported_response_type', state }));

	const codeChallenge = p.get('code_challenge') ?? '';
	if (!codeChallenge || p.get('code_challenge_method') !== 'S256')
		redirect(
			302,
			buildRedirect(redirectUri, {
				error: 'invalid_request',
				error_description: 'PKCE with code_challenge_method=S256 is required',
				state,
			}),
		);

	// Not signed in → bounce through login, returning here afterwards.
	if (!locals.user) redirect(302, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);

	return consentPage({
		clientId,
		redirectUri,
		codeChallenge,
		scope: p.get('scope') || 'mcp',
		resource: p.get('resource') ?? '',
		state: state ?? '',
		clientName: client.name || clientId,
		userEmail: locals.user.email,
	});
};

export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!isSameOrigin(request, url.origin)) error(403, 'Cross-origin request blocked.');
	const f = await request.formData();
	const clientId = String(f.get('clientId') ?? '');
	const redirectUri = String(f.get('redirectUri') ?? '');
	const state = String(f.get('state') ?? '');

	// Re-validate the client + redirect from the posted fields (never trust blindly).
	const client = await getClient(clientId);
	if (!client || !redirectAllowed(client, redirectUri))
		error(400, 'Invalid client or redirect_uri.');

	// Session could have lapsed between render and submit.
	if (!locals.user)
		redirect(302, `/login?next=${encodeURIComponent(`/oauth/authorize${url.search}`)}`);

	if (String(f.get('decision')) !== 'approve')
		redirect(302, buildRedirect(redirectUri, { error: 'access_denied', state }));

	const code = await issueAuthCode({
		clientId,
		userId: locals.user.id,
		redirectUri,
		codeChallenge: String(f.get('codeChallenge') ?? ''),
		scope: String(f.get('scope') ?? 'mcp') || null,
		resource: String(f.get('resource') ?? '') || null,
	});
	redirect(302, buildRedirect(redirectUri, { code, state }));
};
