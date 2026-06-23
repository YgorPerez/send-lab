import { json } from '@sveltejs/kit';
import { exerciseParams } from '$lib/content/exercises';
import { requireUser } from '$lib/server/restApi';
import type { RequestHandler } from './$types';

/** The exercise library (shared, not per-user): id + summary of each. */
export const GET: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	return json(
		Object.entries(exerciseParams).map(([id, p]) => ({
			id,
			region: p.variants[0].region,
			qualities: p.variants[0].qualities,
			variants: p.variants.length,
		})),
	);
};
