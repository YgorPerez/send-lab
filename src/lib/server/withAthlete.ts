// Per-handler authorization. There is no middleware (ADR 0006), deliberately:
// when the device is offline the service worker serves the shell and middleware
// never runs, so the client has to handle the unauthenticated case correctly
// regardless. An optimistic middleware redirect would be the same decision
// implemented twice, and the copy that runs less often is the one that rots.
//
// The known weakness is that a forgotten wrapper is a silent, exploitable hole.
// That is why `pnpm check:routes` asserts every exported method of every server
// route goes through this function, and why the gate fails if one does not.
import { userIdFromBearer } from './apiToken';
import { auth } from './auth';
import { isForbiddenCrossSiteForm } from './csrf';

/** The signed-in athlete. Identity is the stable account id, never a display
 *  string (ADR 0003). */
export interface Athlete {
	userId: string;
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
		const url = new URL(request.url);
		if (isForbiddenCrossSiteForm(request, url.origin, url.pathname)) {
			return new Response('Forbidden', { status: 403 });
		}

		const session = await auth.api.getSession({ headers: request.headers });
		const userId = session?.user?.id ?? (await userIdFromBearer(request));
		if (!userId) {
			return new Response('Unauthorized', { status: 401 });
		}

		return handler({ request, athlete: { userId } });
	};
}
