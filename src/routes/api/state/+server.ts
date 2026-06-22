import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { appStateTable } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/** Read the signed-in user's training state (or `{}` for a fresh account). */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });
	const row = await db
		.select()
		.from(appStateTable)
		.where(eq(appStateTable.userId, locals.user.id))
		.get();
	return json(row ? JSON.parse(row.data) : {});
};

/** Persist the signed-in user's training state (whole-document upsert). */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });
	const data = await request.text();
	try {
		JSON.parse(data);
	} catch {
		return new Response('Bad Request', { status: 400 });
	}
	const now = new Date();
	await db
		.insert(appStateTable)
		.values({ userId: locals.user.id, data, updatedAt: now })
		.onConflictDoUpdate({ target: appStateTable.userId, set: { data, updatedAt: now } })
		.run();
	return new Response(null, { status: 204 });
};
