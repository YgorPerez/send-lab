import { json } from '@sveltejs/kit';
import { loadUserState, requireUser, saveUserState } from '$lib/server/restApi';
import { isPlainObject, METRIC_IDS } from '$lib/server/stateOps';
import type { RequestHandler } from './$types';

type Metrics = Record<string, unknown[]>;

function check(id: string): Response | null {
	return METRIC_IDS.includes(id)
		? null
		: json({ error: `unknown metric: ${id} (one of ${METRIC_IDS.join(', ')})` }, { status: 404 });
}

/** One marker's series. Entries are { date, v, mm?, bw? } in canonical units. */
export const GET: RequestHandler = async ({ request, params }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const bad = check(params.id);
	if (bad) return bad;
	const state = await loadUserState(auth);
	return json((state.metrics as Metrics)[params.id] ?? []);
};

/** Replace a marker's whole series (body = array of entries). */
export const PUT: RequestHandler = async ({ request, params }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const bad = check(params.id);
	if (bad) return bad;
	const entries = await request.json();
	if (!Array.isArray(entries)) return json({ error: 'body must be an array' }, { status: 400 });
	const state = await loadUserState(auth);
	(state.metrics as Metrics)[params.id] = entries;
	const saved = await saveUserState(auth, state);
	return json((saved.metrics as Metrics)[params.id]);
};

/** Append one entry to a marker's series. */
export const POST: RequestHandler = async ({ request, params }) => {
	const auth = await requireUser(request);
	if (auth instanceof Response) return auth;
	const bad = check(params.id);
	if (bad) return bad;
	const entry = await request.json();
	if (!isPlainObject(entry) || typeof entry.v !== 'number')
		return json({ error: 'body must be { date, v, mm?, bw? }' }, { status: 400 });
	const state = await loadUserState(auth);
	const series = (state.metrics as Metrics)[params.id] ?? [];
	series.push(entry);
	(state.metrics as Metrics)[params.id] = series;
	const saved = await saveUserState(auth, state);
	return json((saved.metrics as Metrics)[params.id]);
};
