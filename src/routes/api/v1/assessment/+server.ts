import { json } from '@sveltejs/kit';
import { isPlainObject } from '$lib/objects';
import { loadUserState, requireUser, saveUserState } from '$lib/server/restApi';
import type { RequestHandler } from './$types';

/** The baseline assessment (or null before onboarding). */
export const GET: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	return json(state.assessment);
};

/** Replace the assessment (object, or null to clear it). */
export const PUT: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const body = await request.json();
	if (body !== null && !isPlainObject(body))
		return json({ error: 'body must be an object or null' }, { status: 400 });
	const state = await loadUserState(auth);
	state.assessment = body;
	const saved = await saveUserState(auth, state);
	return json(saved.assessment);
};
