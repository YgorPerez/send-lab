import { json } from '@sveltejs/kit';
import { exerciseParams } from '$lib/content/exercises';
import { requireUser } from '$lib/server/restApi';
import type { RequestHandler } from './$types';

/** Full parameters (every variant: grip, qualities, target ranges) for one exercise. */
export const GET: RequestHandler = async ({ request, params }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const ex = exerciseParams[params.id];
	if (!ex) return json({ error: `unknown exercise: ${params.id}` }, { status: 404 });
	return json({ id: params.id, ...ex });
};
