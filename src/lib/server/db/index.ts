import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

// libSQL (Turso) — SQLite-compatible. Locally falls back to a file DB; in
// production set TURSO_DATABASE_URL to the Turso URL + TURSO_AUTH_TOKEN.
const client = createClient({
	url: env.TURSO_DATABASE_URL ?? 'file:local.db',
	authToken: env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
