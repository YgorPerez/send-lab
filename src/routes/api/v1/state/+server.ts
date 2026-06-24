import { json } from '@sveltejs/kit';
import { deepMerge, isPlainObject } from '$lib/objects';
import { loadUserState, requireUser, saveUserState } from '$lib/server/restApi';
import type { RequestHandler } from './$types';

/** The entire account document — escape hatch for anything without its own route. */
export const GET: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	return json(await loadUserState(auth));
};

/** Deep-merge a partial document. */
export const PATCH: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const patch = await request.json();
	if (!isPlainObject(patch)) return json({ error: 'body must be an object' }, { status: 400 });
	const state = await loadUserState(auth);
	deepMerge(state, patch);
	return json(await saveUserState(auth, state));
};

/** Replace the entire document. */
export const PUT: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	return json(await saveUserState(auth, await request.json()));
};
