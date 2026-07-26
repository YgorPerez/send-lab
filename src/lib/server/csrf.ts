// Cross-site form guard, standing in for SvelteKit's built-in csrf.checkOrigin.
//
// The built-in is all-or-nothing and it 403s the OAuth token endpoint before the
// route handler ever runs: RFC 6749 §4.1.3 requires application/x-www-form-urlencoded,
// and a server-to-server client sends no Origin header at all — which SvelteKit
// rejects unconditionally (csrf.trustedOrigins is only consulted when an Origin is
// present). That killed every MCP connection at the token exchange. Registration
// posts JSON so it sails through, which is why the visible symptom was a pile of
// orphaned client registrations rather than an obvious auth failure.
//
// So svelte.config.js disables the built-in and this reimplements the identical
// rule, plus an explicit exemption list. Every route other than the exempt ones is
// protected exactly as it was before.
//
// Keep this module dependency-free — the tests import it directly, with no
// SvelteKit runtime in play.

/** Paths where a cross-site POST gains an attacker nothing, because they carry no
 *  ambient authority. /oauth/token authenticates with client credentials plus a
 *  one-time code and a PKCE verifier — none of which a browser attaches on its own,
 *  so there is no confused deputy to exploit. */
const EXEMPT_PATHS = new Set(['/oauth/token']);

/** The content types an HTML form can emit, and therefore the ones a cross-site page
 *  can submit with the athlete's cookies attached. Mirrors SvelteKit's
 *  is_form_content_type. text/plain belongs here: `enctype="text/plain"` is
 *  cross-site submittable, and its `name=value\r\n` encoding can be crafted to parse
 *  as valid JSON, so a text/plain body is not safe merely because it looks like JSON. */
const FORM_CONTENT_TYPES = new Set([
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain',
]);

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Whether this request is a cross-site form submission that must be refused.
 *
 * @param origin   the app's own origin, i.e. `event.url.origin`
 * @param pathname the request path, i.e. `event.url.pathname`
 */
export function isForbiddenCrossSiteForm(
	request: Request,
	origin: string,
	pathname: string,
): boolean {
	if (EXEMPT_PATHS.has(pathname)) return false;
	if (!UNSAFE_METHODS.has(request.method)) return false;

	// Strip any `; charset=...` parameter before matching.
	const contentType =
		request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
	if (!FORM_CONTENT_TYPES.has(contentType)) return false;

	// A missing Origin fails this comparison, which is intended: browsers always send
	// it on a cross-site form POST, so a state-changing form request without one is
	// not something to trust.
	return request.headers.get('origin') !== origin;
}
