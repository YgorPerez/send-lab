import { json } from '@sveltejs/kit';
import { loadUserState, requireUser, saveUserState } from '$lib/server/restApi';
import { deepMerge, isPlainObject } from '$lib/server/stateOps';
import type { RequestHandler } from './$types';

/** The active training program. */
export const GET: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	return json(state.program);
};

/** Replace the active program wholesale (invalid fields fall back to defaults). */
export const PUT: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	state.program = await request.json();
	const saved = await saveUserState(auth, state);
	return json(saved.program);
};

/** Deep-merge a partial program (objects merge, arrays/values replace). */
export const PATCH: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const patch = await request.json();
	if (!isPlainObject(patch)) return json({ error: 'body must be an object' }, { status: 400 });
	const state = await loadUserState(auth);
	deepMerge(state.program as Record<string, unknown>, patch);
	const saved = await saveUserState(auth, state);
	return json(saved.program);
};
