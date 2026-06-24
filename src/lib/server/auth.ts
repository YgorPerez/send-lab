import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { getOrCreateToken } from '$lib/server/apiToken';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

// Without a stable secret, better-auth signs session tokens with a generated one
// that differs per serverless instance / cold start — so every return visit fails
// validation and bounces to /login. Fail loudly in production instead of silently
// logging everyone out.
if (!env.BETTER_AUTH_SECRET && !dev) {
	throw new Error('BETTER_AUTH_SECRET must be set in production');
}

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
	plugins: [sveltekitCookies(getRequestEvent)],
});
