import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { getOrCreateToken } from '$lib/server/apiToken';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { env } from '$lib/server/env';

// Typed off the factory rather than off `betterAuth` itself: annotating with
// `ReturnType<typeof betterAuth>` widens the options generic back to
// `BetterAuthOptions` and loses the inferred plugin/adapter types.
function createAuth() {
	return betterAuth({
		secret: env.BETTER_AUTH_SECRET,
		// Tolerate a trailing slash in the configured URL — better-auth wants the
		// bare origin.
		baseURL: env.BETTER_AUTH_URL?.replace(/\/+$/, ''),
		database: drizzleAdapter(db, { provider: 'sqlite', schema }),
		emailAndPassword: { enabled: true },
		// Sessions last 30 days and slide forward on each use (updateAge), so an active
		// user is never logged out; only a full month of inactivity ends the session.
		session: {
			expiresIn: 60 * 60 * 24 * 30, // 30 days
			updateAge: 60 * 60 * 24, // renew once a day of use
		},
		// Account deletion is self-service: the client re-confirms with the password,
		// and the user's session/account/app_state rows cascade away (see schema).
		user: { deleteUser: { enabled: true } },
		// Give every new account its single API token up front, so AI/MCP access is
		// ready the moment they open Settings (getOrCreateToken is a safety net too).
		databaseHooks: {
			user: { create: { after: async (created) => void (await getOrCreateToken(created.id)) } },
		},
		trustedOrigins: [
			'http://localhost:5173',
			'http://127.0.0.1:5173',
			'http://localhost:3000',
			'http://127.0.0.1:3000',
		],
		// The cookie plugin MUST stay last — better-auth warns at runtime otherwise,
		// because anything registered after it can mutate a response whose Set-Cookie
		// header has already been written.
		plugins: [tanstackStartCookies()],
	});
}

let instance: ReturnType<typeof createAuth> | undefined;

/**
 * The auth server, constructed on first use.
 *
 * Lazy on purpose, and the reason is the build rather than performance:
 * `vite build` prerenders `/_shell.html` by fetching `/` from the built server
 * bundle, which imports the whole route tree. `betterAuth()` throws at
 * construction when `NODE_ENV=production` and no `BETTER_AUTH_SECRET` is set —
 * so constructing it at module scope made the shell unbuildable on any machine
 * without production secrets, including CI and a Vercel preview.
 *
 * The shell is user-independent by construction (ADR 0006). Rendering it must
 * never need a credential, and nothing about it should stand up an auth server.
 * Deferring to the first request keeps better-auth's loud failure exactly where
 * it belongs — on the first request that would have been signed with a
 * throwaway secret.
 */
export function getAuth(): ReturnType<typeof createAuth> {
	instance ??= createAuth();
	return instance;
}
