import { defineConfig } from 'drizzle-kit';

// libSQL/Turso. Locally uses a file DB (no token); for the remote Turso DB set
// TURSO_DATABASE_URL + TURSO_AUTH_TOKEN, then `pnpm run db:push`.
export default defineConfig({
	dialect: 'turso',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dbCredentials: {
		url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
		authToken: process.env.TURSO_AUTH_TOKEN,
	},
});
