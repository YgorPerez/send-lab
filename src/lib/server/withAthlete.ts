// Per-handler authorization. There is no middleware (ADR 0006), deliberately:
// when the device is offline the service worker serves the shell and middleware
// never runs, so the client has to handle the unauthenticated case correctly
// regardless. An optimistic middleware redirect would be the same decision
// implemented twice, and the copy that runs less often is the one that rots.
//
// The known weakness is that a forgotten wrapper is a silent, exploitable hole.
// That is why `pnpm check:routes` asserts every exported method of every server
// route goes through this function, and why the gate fails if one does not.
import { type AthleteId, parseAthleteId } from '$lib/ids';
import { userIdFromBearer } from './apiToken';
import { getAuth } from './auth';
import { isForbiddenCrossSiteForm } from './csrf';
import { assertRuntimeEnv } from './env';

/**
 * The signed-in athlete, identified by the account that owns their training
 * record. Per CONTEXT.md the authenticated identity is the **account** — the
 * athlete is the person it trains — so the id is `accountId`, not `userId`.
 * `user` is a word the glossary rejects for both; it survives only as
 * better-auth's own table name, which is not ours to rename.
 *
 * Identity is a stable id, never a display string (ADR 0003).
 */
interface Athlete {
	accountId: AthleteId;
}

interface HandlerContext {
	request: Request;
}

type AthleteHandler = (ctx: HandlerContext & { athlete: Athlete }) => Response | Promise<Response>;

/**
 * Wrap a server-route method so it only ever runs for an authenticated athlete.
 *
 * Two credentials are accepted, in order: the session cookie (the browser), then
 * a Bearer token (the athlete's own AI / MCP client, ADR 0004). Both resolve to
 * the same account id, so handlers never branch on how the caller authenticated.
 *
 * The same-origin guard runs first, because a cross-site form POST arrives with
 * the athlete's cookies already attached and would otherwise pass the session
 * check. `isForbiddenCrossSiteForm` is the exact rule SvelteKit's `checkOrigin`
 * applied, kept because it exempts `/oauth/token` — RFC 6749 §4.1.3 mandates a
 * form content type there and a server-to-server client sends no Origin at all.
 */
export function withAthlete(handler: AthleteHandler) {
	return async ({ request }: HandlerContext): Promise<Response> => {
		// Serving a request is the first moment a missing production secret is a
		// real problem — asserting at module load would make the prerendered shell
		// unbuildable without credentials.
		assertRuntimeEnv();

		const url = new URL(request.url);
		if (isForbiddenCrossSiteForm(request, url.origin, url.pathname)) {
			return new Response('Forbidden', { status: 403 });
		}

		const session = await getAuth().api.getSession({ headers: request.headers });
		// Branded here, at the one place an athlete's identity enters the server
		// (#20). Everything below takes `AthleteId`, so a route that reached for
		// some other string — a display name, a row key — is a compile error rather
		// than a query against the wrong account.
		const accountId = parseAthleteId(session?.user?.id ?? (await userIdFromBearer(request)));
		if (!accountId) {
			return new Response('Unauthorized', { status: 401 });
		}

		return handler({ request, athlete: { accountId } });
	};
}
