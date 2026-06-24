import { json } from '@sveltejs/kit';
import { isPlainObject } from '$lib/objects';
import { loadUserState, requireUser, saveUserState } from '$lib/server/restApi';
import type { RequestHandler } from './$types';

type Saved = { name: string; program: Record<string, unknown> };

/** One saved program by name. */
export const GET: RequestHandler = async ({ request, params }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	const found = ((state.savedPrograms as Saved[]) ?? []).find((s) => s.name === params.name);
	if (!found) return json({ error: `no saved program: ${params.name}` }, { status: 404 });
	return json(found);
};

/** Create or replace the saved program at this name (body = the program object). */
export const PUT: RequestHandler = async ({ request, params }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const program = await request.json();
	if (!isPlainObject(program))
		return json({ error: 'body must be a program object' }, { status: 400 });
	const state = await loadUserState(auth);
	const saved = ((state.savedPrograms as Saved[]) ?? []).filter((s) => s.name !== params.name);
	saved.push({ name: params.name, program });
	state.savedPrograms = saved;
	await saveUserState(auth, state);
	return json({ name: params.name, program });
};

/** Delete the saved program at this name. */
export const DELETE: RequestHandler = async ({ request, params }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	state.savedPrograms = ((state.savedPrograms as Saved[]) ?? []).filter(
		(s) => s.name !== params.name,
	);
	await saveUserState(auth, state);
	return new Response(null, { status: 204 });
};
