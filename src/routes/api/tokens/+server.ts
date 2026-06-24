import { json } from '@sveltejs/kit';
import { getOrCreateToken, regenerateToken } from '$lib/server/apiToken';
import type { RequestHandler } from './$types';

/** The signed-in user's single API token (minted on first request). */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });
	return json({ token: await getOrCreateToken(locals.user.id) });
};

/** Kill the current token and return a fresh one. */
export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });
	return json({ token: await regenerateToken(locals.user.id) });
};
