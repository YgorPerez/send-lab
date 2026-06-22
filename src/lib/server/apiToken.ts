// Personal API tokens for the MCP endpoint. The plaintext token is shown to the
// user once; only its SHA-256 hash is stored, and requests authenticate with an
// `Authorization: Bearer <token>` header that we hash and look up.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { apiToken } from '$lib/server/db/schema';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Create a token for a user; returns the plaintext (store it — shown once). */
export async function createApiToken(userId: string, name: string): Promise<string> {
	const token = `sl_${randomBytes(24).toString('hex')}`;
	await db
		.insert(apiToken)
		.values({ id: randomUUID(), userId, name: name.trim() || 'token', tokenHash: hash(token) })
		.run();
	return token;
}

export function listApiTokens(userId: string) {
	return db
		.select({ id: apiToken.id, name: apiToken.name, createdAt: apiToken.createdAt })
		.from(apiToken)
		.where(eq(apiToken.userId, userId))
		.all();
}

export async function revokeApiToken(userId: string, id: string): Promise<void> {
	await db
		.delete(apiToken)
		.where(and(eq(apiToken.id, id), eq(apiToken.userId, userId)))
		.run();
}

/** Resolve a Bearer token from a request to its user id, or null. */
export async function userIdFromBearer(request: Request): Promise<string | null> {
	const auth = request.headers.get('authorization') ?? '';
	const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
	if (!token) return null;
	const row = await db
		.select({ userId: apiToken.userId })
		.from(apiToken)
		.where(eq(apiToken.tokenHash, hash(token)))
		.get();
	return row?.userId ?? null;
}
