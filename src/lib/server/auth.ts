import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, { provider: 'sqlite', schema }),
	emailAndPassword: { enabled: true },
	// Account deletion is self-service: the client re-confirms with the password,
	// and the user's session/account/app_state rows cascade away (see schema).
	user: { deleteUser: { enabled: true } },
	trustedOrigins: [
		'http://localhost:5173',
		'http://127.0.0.1:5173',
		'http://localhost:3000',
		'http://127.0.0.1:3000',
	],
	plugins: [sveltekitCookies(getRequestEvent)],
});
