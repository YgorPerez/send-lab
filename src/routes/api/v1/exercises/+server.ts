import { json } from '@sveltejs/kit';
import { exerciseParams } from '$lib/content/exercises';
import type { CustomExercise } from '$lib/content/types';
import { isValidExerciseId, sanitizeCustomExercise } from '$lib/customExercise';
import { loadUserState, requireUser, saveUserState } from '$lib/server/restApi';
import type { RequestHandler } from './$types';

/** The exercise library: built-in (shared) + the user's custom exercises. */
export const GET: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	const custom = (state.customExercises as Record<string, CustomExercise>) ?? {};
	return json([
		...Object.entries(exerciseParams).map(([id, p]) => ({
			id,
			custom: false,
			region: p.variants[0].region,
			qualities: p.variants[0].qualities,
			variants: p.variants.length,
		})),
		...Object.entries(custom).map(([id, ex]) => ({
			id,
			custom: true,
			name: ex.name,
			cat: ex.cat,
			region: ex.variants[0]?.region,
			qualities: ex.variants[0]?.qualities,
			variants: ex.variants.length,
		})),
	]);
};

/** Create or replace a custom exercise. Body: { id, exercise: {...} }. */
export const POST: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const body = await request.json();
	if (!body || typeof body !== 'object' || !isValidExerciseId(body.id))
		return json({ error: 'id must match [A-Za-z0-9_-] and be ≤40 chars' }, { status: 400 });
	const ex = sanitizeCustomExercise(body.exercise);
	if (!ex) return json({ error: '`exercise` must be an object' }, { status: 400 });
	const state = await loadUserState(auth);
	const custom = (state.customExercises as Record<string, CustomExercise>) ?? {};
	custom[body.id] = ex;
	state.customExercises = custom;
	await saveUserState(auth, state);
	return json({ id: body.id, ...ex });
};
