import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/lib/server/db/schema';
import {
	oauthAccessToken,
	oauthClient,
	oauthCode,
	oauthRefreshToken,
} from '../src/lib/server/db/schema';
import { purgeExpiredIn } from '../src/lib/server/oauthCleanup';

const NOW = new Date('2026-07-26T12:00:00Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const ahead = (ms: number) => new Date(NOW.getTime() + ms);

/** A fresh in-memory database with just the OAuth tables. No `user` table: these
 *  are created without FK constraints, and the cleanup never joins to one. */
async function freshDb() {
	const client = createClient({ url: ':memory:' });
	for (const ddl of [
		`CREATE TABLE oauth_client (id TEXT PRIMARY KEY, secret TEXT, name TEXT,
			redirect_uris TEXT NOT NULL, created_at INTEGER NOT NULL)`,
		`CREATE TABLE oauth_code (code TEXT PRIMARY KEY, client_id TEXT NOT NULL, user_id TEXT NOT NULL,
			redirect_uri TEXT NOT NULL, code_challenge TEXT NOT NULL, scope TEXT, resource TEXT,
			expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
		`CREATE TABLE oauth_access_token (token TEXT PRIMARY KEY, client_id TEXT NOT NULL,
			user_id TEXT NOT NULL, scope TEXT, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
		`CREATE TABLE oauth_refresh_token (token TEXT PRIMARY KEY, client_id TEXT NOT NULL,
			user_id TEXT NOT NULL, scope TEXT, created_at INTEGER NOT NULL)`,
	]) {
		await client.execute(ddl);
	}
	return drizzle(client, { schema });
}

const addClient = (db: Awaited<ReturnType<typeof freshDb>>, id: string, createdAt: Date) =>
	db
		.insert(oauthClient)
		.values({ id, secret: null, name: id, redirectUris: '[]', createdAt })
		.run();

const clientIds = async (db: Awaited<ReturnType<typeof freshDb>>) =>
	(await db.select({ id: oauthClient.id }).from(oauthClient).all()).map((r) => r.id).sort();

test('expired codes and access tokens are deleted, live ones kept', async () => {
	const db = await freshDb();
	await addClient(db, 'c1', ago(2 * DAY));
	await db
		.insert(oauthCode)
		.values([
			{
				code: 'dead',
				clientId: 'c1',
				userId: 'u1',
				redirectUri: 'x',
				codeChallenge: 'y',
				expiresAt: ago(HOUR),
				createdAt: ago(2 * HOUR),
			},
			{
				code: 'live',
				clientId: 'c1',
				userId: 'u1',
				redirectUri: 'x',
				codeChallenge: 'y',
				expiresAt: ahead(HOUR),
				createdAt: NOW,
			},
		])
		.run();
	await db
		.insert(oauthAccessToken)
		.values([
			{
				token: 'dead',
				clientId: 'c1',
				userId: 'u1',
				expiresAt: ago(HOUR),
				createdAt: ago(2 * HOUR),
			},
			{ token: 'live', clientId: 'c1', userId: 'u1', expiresAt: ahead(HOUR), createdAt: NOW },
		])
		.run();

	await purgeExpiredIn(db, NOW);

	assert.deepEqual(
		(await db.select({ c: oauthCode.code }).from(oauthCode).all()).map((r) => r.c),
		['live'],
	);
	assert.deepEqual(
		(await db.select({ t: oauthAccessToken.token }).from(oauthAccessToken).all()).map((r) => r.t),
		['live'],
	);
});

test('an abandoned registration past its grace period is deleted', async () => {
	const db = await freshDb();
	await addClient(db, 'abandoned', ago(2 * DAY));
	await purgeExpiredIn(db, NOW);
	assert.deepEqual(await clientIds(db), []);
});

test('a recent empty registration is kept — the flow may still be in progress', async () => {
	const db = await freshDb();
	await addClient(db, 'mid-flow', ago(HOUR));
	await purgeExpiredIn(db, NOW);
	assert.deepEqual(await clientIds(db), ['mid-flow']);
});

test('a connected client is never deleted, however old and idle', async () => {
	// The regression that would break a real user's connector: a refresh token is
	// the mark of a completed authorization, and refresh tokens never expire.
	const db = await freshDb();
	await addClient(db, 'connected', ago(365 * DAY));
	await db
		.insert(oauthRefreshToken)
		.values({ token: 'r1', clientId: 'connected', userId: 'u1', createdAt: ago(365 * DAY) })
		.run();

	await purgeExpiredIn(db, NOW);

	assert.deepEqual(await clientIds(db), ['connected']);
});

test('a client holding only an expired access token is deleted with it', async () => {
	// Expired tokens are cleared first, so they cannot keep a dead client alive.
	const db = await freshDb();
	await addClient(db, 'stale', ago(2 * DAY));
	await db
		.insert(oauthAccessToken)
		.values({
			token: 'a1',
			clientId: 'stale',
			userId: 'u1',
			expiresAt: ago(HOUR),
			createdAt: ago(2 * DAY),
		})
		.run();

	await purgeExpiredIn(db, NOW);

	assert.deepEqual(await clientIds(db), []);
});

test('a client holding a live access token is kept', async () => {
	const db = await freshDb();
	await addClient(db, 'active', ago(2 * DAY));
	await db
		.insert(oauthAccessToken)
		.values({
			token: 'a1',
			clientId: 'active',
			userId: 'u1',
			expiresAt: ahead(HOUR),
			createdAt: ago(HOUR),
		})
		.run();

	await purgeExpiredIn(db, NOW);

	assert.deepEqual(await clientIds(db), ['active']);
});

test('a client holding a pending authorization code is kept', async () => {
	// Registered yesterday, consent approved just now — the code is unredeemed.
	const db = await freshDb();
	await addClient(db, 'approving', ago(2 * DAY));
	await db
		.insert(oauthCode)
		.values({
			code: 'k1',
			clientId: 'approving',
			userId: 'u1',
			redirectUri: 'x',
			codeChallenge: 'y',
			expiresAt: ahead(600_000),
			createdAt: NOW,
		})
		.run();

	await purgeExpiredIn(db, NOW);

	assert.deepEqual(await clientIds(db), ['approving']);
});

test('only the abandoned clients go, in a mixed table', async () => {
	const db = await freshDb();
	await addClient(db, 'junk1', ago(3 * DAY));
	await addClient(db, 'junk2', ago(2 * DAY));
	await addClient(db, 'connected', ago(30 * DAY));
	await addClient(db, 'fresh', ago(HOUR));
	await db
		.insert(oauthRefreshToken)
		.values({ token: 'r1', clientId: 'connected', userId: 'u1', createdAt: ago(30 * DAY) })
		.run();

	await purgeExpiredIn(db, NOW);

	assert.deepEqual(await clientIds(db), ['connected', 'fresh']);
});

test('purging is idempotent and safe on empty tables', async () => {
	const db = await freshDb();
	await purgeExpiredIn(db, NOW);
	await purgeExpiredIn(db, NOW);
	assert.deepEqual(await clientIds(db), []);
});
