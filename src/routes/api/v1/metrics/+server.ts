import { json } from '@sveltejs/kit';
import { loadUserState, requireUser } from '$lib/server/restApi';
import type { RequestHandler } from './$types';

/** All baseline-marker series, keyed by metric id (entries oldest → newest). */
export const GET: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	return json(state.metrics);
};
