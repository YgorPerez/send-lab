import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '$lib/server/env';
import * as schema from './schema';

// libSQL (Turso) — SQLite-compatible. Locally falls back to a file DB; in
// production set TURSO_DATABASE_URL to the Turso URL + TURSO_AUTH_TOKEN.
//
// Connected on first use, not at module load. Two reasons, both learned from a
// deploy that failed:
//
//   1. `vite build` prerenders `/_shell.html` by fetching `/` from the built
//      server bundle, so anything constructed at module scope has to succeed on
//      a machine with no credentials. The shell is user-independent by
//      construction (ADR 0006) and must never open a database to render.
//   2. On a serverless host the filesystem is read-only, so the `file:local.db`
//      fallback throws when the client is created — at module scope that takes
//      down the *whole function on cold start*, and every route 500s, including
//      ones that never touch the database.
//
// The proxy keeps `db` a value with drizzle's inferred type, so query code reads
// the same as it did before.
type Db = ReturnType<typeof connect>;

function connect() {
	return drizzle(
		createClient({
			url: env.TURSO_DATABASE_URL ?? 'file:local.db',
			authToken: env.TURSO_AUTH_TOKEN,
		}),
		{ schema },
	);
}

let instance: Db | undefined;

function getDb(): Db {
	instance ??= connect();
	return instance;
}

export const db = new Proxy({} as Db, {
	get(_target, prop, receiver) {
		return Reflect.get(getDb(), prop, receiver);
	},
}) as Db;
