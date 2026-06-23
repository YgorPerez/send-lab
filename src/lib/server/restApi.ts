// Shared plumbing for the token-authed REST API under /api/v1. Each resource
// route resolves the Bearer token to a user, loads their (sanitized) account
// document, mutates the relevant slice, and writes it back.
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { userIdFromBearer } from '$lib/server/apiToken';
import { db } from '$lib/server/db';
import { appStateTable } from '$lib/server/db/schema';
import { sanitizeState } from '$lib/server/stateOps';

/** Resolve the request's Bearer token to a user id, or a 401 JSON Response. */
export async function requireUser(request: Request): Promise<string | Response> {
	const userId = await userIdFromBearer(request);
	return (
		userId ?? json({ error: 'Unauthorized — provide a valid Bearer API token' }, { status: 401 })
	);
}

/** The user's full account document, coerced to a valid shape. */
export async function loadUserState(userId: string): Promise<Record<string, unknown>> {
	const row = await db.select().from(appStateTable).where(eq(appStateTable.userId, userId)).get();
	return sanitizeState(row ? JSON.parse(row.data) : {});
}

/** Persist a state document (sanitized first) and return what was stored. */
export async function saveUserState(
	userId: string,
	state: unknown,
): Promise<Record<string, unknown>> {
	const next = sanitizeState(state);
	const data = JSON.stringify(next);
	const now = new Date();
	await db
		.insert(appStateTable)
		.values({ userId, data, updatedAt: now })
		.onConflictDoUpdate({ target: appStateTable.userId, set: { data, updatedAt: now } })
		.run();
	return next;
}
