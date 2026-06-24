// One personal API token per user, used as `Authorization: Bearer <token>` on
// the MCP endpoint and the /api/v1 REST API. Stored in plaintext (keyed by user)
// so it can be re-revealed in Settings; regenerating swaps it for a fresh one.
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { apiToken } from '$lib/server/db/schema';

const mint = () => `sl_${randomBytes(24).toString('hex')}`;

/** The user's token, creating one on first call. Exactly one per user. */
export async function getOrCreateToken(userId: string): Promise<string> {
	const row = await db
		.select({ token: apiToken.token })
		.from(apiToken)
		.where(eq(apiToken.userId, userId))
		.get();
	if (row) return row.token;
	const token = mint();
	await db.insert(apiToken).values({ userId, token }).run();
	return token;
}

/** Kill the current token and issue a fresh one (any connected client must
 *  switch to the new token). Works whether or not a token already exists. */
export async function regenerateToken(userId: string): Promise<string> {
	const token = mint();
	await db
		.insert(apiToken)
		.values({ userId, token })
		.onConflictDoUpdate({ target: apiToken.userId, set: { token, createdAt: new Date() } })
		.run();
	return token;
}

/** Resolve a Bearer token from a request to its user id, or null. */
export async function userIdFromBearer(request: Request): Promise<string | null> {
	const auth = request.headers.get('authorization') ?? '';
	const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
	if (!token) return null;
	const row = await db
		.select({ userId: apiToken.userId })
		.from(apiToken)
		.where(eq(apiToken.token, token))
		.get();
	return row?.userId ?? null;
}
