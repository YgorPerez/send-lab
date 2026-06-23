import { json } from '@sveltejs/kit';
import { exerciseParams } from '$lib/content/exercises';
import type { CustomExercise } from '$lib/content/types';
import { sanitizeCustomExercise } from '$lib/customExercise';
import { loadUserState, requireUser, saveUserState } from '$lib/server/restApi';
import type { RequestHandler } from './$types';

/** One exercise: the user's custom one if it exists, otherwise the built-in. */
export const GET: RequestHandler = async ({ request, params }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	const custom = (state.customExercises as Record<string, CustomExercise>) ?? {};
	if (custom[params.id]) return json({ id: params.id, custom: true, ...custom[params.id] });
	const builtin = exerciseParams[params.id];
	if (builtin) return json({ id: params.id, custom: false, ...builtin });
	return json({ error: `unknown exercise: ${params.id}` }, { status: 404 });
};

/** Create or replace the custom exercise at this id (body = the exercise object). */
export const PUT: RequestHandler = async ({ request, params }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const ex = sanitizeCustomExercise(await request.json());
	if (!ex) return json({ error: 'body must be an exercise object' }, { status: 400 });
	const state = await loadUserState(auth);
	const custom = (state.customExercises as Record<string, CustomExercise>) ?? {};
	custom[params.id] = ex;
	state.customExercises = custom;
	await saveUserState(auth, state);
	return json({ id: params.id, ...ex });
};

/** Delete a custom exercise (built-in exercises cannot be deleted). */
export const DELETE: RequestHandler = async ({ request, params }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	const custom = (state.customExercises as Record<string, CustomExercise>) ?? {};
	if (!(params.id in custom))
		return json({ error: `no custom exercise: ${params.id}` }, { status: 404 });
	delete custom[params.id];
	state.customExercises = custom;
	await saveUserState(auth, state);
	return new Response(null, { status: 204 });
};
