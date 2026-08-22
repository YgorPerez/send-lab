// Schema changes, applied by hand.
//
// `drizzle-kit push` is the tool for this and it cannot be used here: it prompts,
// and a prompt needs a TTY that an agent session does not have. So the DDL is
// written out, run through `@libsql/client` directly, and committed — which has
// the side benefit that what was applied to the live database is in the history
// rather than in someone's shell.
//
// **Every statement here must be safe to run twice, and safe to run against a
// database with real accounts on it.** `CREATE TABLE IF NOT EXISTS` and
// `CREATE INDEX IF NOT EXISTS` are; `ALTER TABLE ... DROP COLUMN` is not. If a
// change is ever destructive, it does not belong in this file — it belongs in a
// conversation with the athlete first.
//
//   pnpm db:ddl          # against TURSO_DATABASE_URL, or file:local.db
//   pnpm db:ddl --dry    # print what would run
import { existsSync } from 'node:fs';
import { createClient } from '@libsql/client';

// Vite loads `.env` for the app; a plain `tsx` script gets nothing. Node's own
// loader rather than a dependency, and optional, so this runs in CI against
// whatever the environment already sets.
if (existsSync('.env')) process.loadEnvFile('.env');

/** Applied in order. Each is idempotent. */
const STATEMENTS: { why: string; sql: string }[] = [
	{
		why: '#57 — the training record, one row per row',
		sql: `CREATE TABLE IF NOT EXISTS record_row (
			account_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
			collection TEXT NOT NULL,
			row_key TEXT NOT NULL,
			row TEXT,
			updated_at INTEGER NOT NULL,
			PRIMARY KEY (account_id, collection, row_key)
		)`,
	},
];

const dry = process.argv.includes('--dry');
const url = process.env.TURSO_DATABASE_URL ?? 'file:local.db';

if (dry) {
	for (const { why, sql } of STATEMENTS) console.log(`-- ${why}\n${sql};\n`);
	console.log(`-- would run against ${url}`);
	process.exit(0);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

console.log(`db:ddl — ${url}`);
for (const { why, sql } of STATEMENTS) {
	await client.execute(sql);
	console.log(`  ok — ${why}`);
}

// Read the applied shape back rather than trusting the writes: a `CREATE TABLE IF
// NOT EXISTS` against a table that already exists in a *different* shape succeeds
// silently, and that is exactly the failure worth catching here.
const tables = await client.execute(
	"SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
);
console.log(`db:ddl — tables: ${tables.rows.map((r) => r.name).join(', ')}`);

const columns = await client.execute('PRAGMA table_info(record_row)');
console.log(`db:ddl — record_row: ${columns.rows.map((r) => `${r.name} ${r.type}`).join(', ')}`);
