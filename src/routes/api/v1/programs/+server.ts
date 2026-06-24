import { json } from '@sveltejs/kit';
import { isPlainObject } from '$lib/objects';
import { loadUserState, requireUser, saveUserState } from '$lib/server/restApi';
import type { RequestHandler } from './$types';

type Saved = { name: string; program: Record<string, unknown> };

/** List the user's saved programs (name + a short summary). */
export const GET: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const state = await loadUserState(auth);
	const saved = (state.savedPrograms as Saved[]) ?? [];
	return json(
		saved.map((s) => ({
			name: s.name,
			weeks: s.program?.weeks,
			phases: Array.isArray(s.program?.phases) ? s.program.phases.length : 0,
		})),
	);
};

/** Save a program under a name (replaces an existing one with the same name). */
export const POST: RequestHandler = async ({ request }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const body = await request.json();
	if (!isPlainObject(body) || typeof body.name !== 'string' || !isPlainObject(body.program))
		return json({ error: 'body must be { name: string, program: object }' }, { status: 400 });
	const state = await loadUserState(auth);
	const saved = (state.savedPrograms as Saved[]) ?? [];
	const next = saved.filter((s) => s.name !== body.name);
	next.push({ name: body.name, program: body.program });
	state.savedPrograms = next;
	await saveUserState(auth, state);
	return json({ name: body.name, program: body.program });
};
