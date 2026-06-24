// One-off ops script: ensure every existing user has exactly one API token
// under the current schema. Safe to re-run (idempotent — only users missing a
// token get one). Run AFTER `pnpm db:push` has migrated the api_token table.
//
//   # local (file:local.db)
//   pnpm backfill:tokens
//   # production (Turso)
//   TURSO_DATABASE_URL='libsql://…' TURSO_AUTH_TOKEN='…' pnpm backfill:tokens
//
// Self-contained (reads process.env directly) so it doesn't depend on the
// SvelteKit $env/$lib aliases, which only resolve inside the app build.
import { randomBytes } from 'node:crypto';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { apiToken, user } from '../src/lib/server/db/schema';

const client = createClient({
	url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
	authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema: { apiToken, user } });

const mint = () => `sl_${randomBytes(24).toString('hex')}`;

const haveToken = new Set(
	(await db.select({ id: apiToken.userId }).from(apiToken)).map((r) => r.id),
);
const allUsers = await db.select({ id: user.id }).from(user);
const missing = allUsers.filter((u) => !haveToken.has(u.id));

for (const u of missing) {
	await db.insert(apiToken).values({ userId: u.id, token: mint() }).run();
}

console.log(
	`Checked ${allUsers.length} user(s); minted ${missing.length} new token(s), ` +
		`${allUsers.length - missing.length} already had one.`,
);
