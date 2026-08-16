import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { getOrCreateToken } from '$lib/server/apiToken';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { env } from '$lib/server/env';

// Tolerate a trailing slash in the configured URL — better-auth wants the bare origin.
const baseURL = env.BETTER_AUTH_URL?.replace(/\/+$/, '');

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL,
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
