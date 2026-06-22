import { json } from '@sveltejs/kit';
import { createApiToken, listApiTokens, revokeApiToken } from '$lib/server/apiToken';
import type { RequestHandler } from './$types';

/** List the signed-in user's API tokens (metadata only — never the secret). */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });
	return json(await listApiTokens(locals.user.id));
};

/** Mint a new token; the plaintext is returned ONCE and never stored. */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });
	const { name } = (await request.json().catch(() => ({}))) as { name?: string };
	const token = await createApiToken(locals.user.id, name ?? 'token');
	return json({ token });
};

/** Revoke one of the user's tokens by id. */
export const DELETE: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });
	const id = url.searchParams.get('id');
	if (!id) return new Response('Bad Request', { status: 400 });
	await revokeApiToken(locals.user.id, id);
	return new Response(null, { status: 204 });
};
