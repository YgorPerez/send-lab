import { json } from '@sveltejs/kit';
import { deepMerge, isPlainObject } from '$lib/objects';
import { loadUserState, requireUser, saveUserState } from '$lib/server/restApi';
import type { RequestHandler } from './$types';

/** Display-unit + notification preferences. */
export const GET: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	return json(state.prefs);
};

/** Merge preference fields ({ weight, length, notify }). */
export const PATCH: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const patch = await request.json();
	if (!isPlainObject(patch)) return json({ error: 'body must be an object' }, { status: 400 });
	const state = await loadUserState(auth);
	deepMerge(state.prefs as Record<string, unknown>, patch);
	const saved = await saveUserState(auth, state);
	return json(saved.prefs);
};
