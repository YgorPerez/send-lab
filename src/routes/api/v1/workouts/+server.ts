import { json } from '@sveltejs/kit';
import { loadUserState, requireUser, saveUserState } from '$lib/server/restApi';
import { isPlainObject } from '$lib/server/stateOps';
import type { RequestHandler } from './$types';

/** Logged workouts (full sets), newest first. */
export const GET: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	return json(state.workouts);
};

/** Replace the whole workout history (body = array). */
export const PUT: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const list = await request.json();
	if (!Array.isArray(list)) return json({ error: 'body must be an array' }, { status: 400 });
	const state = await loadUserState(auth);
	state.workouts = list;
	const saved = await saveUserState(auth, state);
	return json(saved.workouts);
};

/** Prepend one workout entry (newest first). */
export const POST: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const entry = await request.json();
	if (!isPlainObject(entry)) return json({ error: 'body must be an object' }, { status: 400 });
	const state = await loadUserState(auth);
	state.workouts = [entry, ...(state.workouts as unknown[])];
	const saved = await saveUserState(auth, state);
	return json(saved.workouts);
};
