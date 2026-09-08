import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ---- better-auth core tables (email + password) ----

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' })
		.$defaultFn(() => false)
		.notNull(),
	image: text('image'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull(),
});

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		// Every session lookup filters by user; without this the table is scanned.
		// Found while auditing auth (issue #21) and free to fix on a fresh schema.
	},
	(t) => [index('session_user_id_idx').on(t.userId)],
);

export const account = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
		refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
		scope: text('scope'),
		password: text('password'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	},
	(t) => [index('account_user_id_idx').on(t.userId)],
);

export const verification = sqliteTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		// These carry a default but were never declared NOT NULL, while better-auth's
		// own types treat them as required — a nullable column behind a required type.
		// Fixed here rather than migrated, since the schema is being authored fresh.
		createdAt: integer('created_at', { mode: 'timestamp' })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.$defaultFn(() => new Date())
			.notNull(),
		// Verification rows are always looked up by identifier.
	},
	(t) => [index('verification_identifier_idx').on(t.identifier)],
);

// ---- app data ----

/** One JSON blob of training state per user (mirrors the old localStorage doc). */
export const appStateTable = sqliteTable('app_state', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	data: text('data').notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull(),
});

/**
 * The training record, one row per row (#57).
 *
 * ADR 0007 split the account document into sixteen keyed collections because the
 * granularity the athlete's offline writes have to merge at is the row. This is
 * that split at the storage layer: without it, last-write-wins-per-row is only
 * true inside one client, and two devices ticking two different tasks still
 * collide on one database row — which is the collision the whole arrangement
 * exists to stop.
 *
 * **`app_state` above is deliberately left alone.** Production is still the
 * SvelteKit app on `main` and it reads that table; this one is additive, and the
 * rebuild is the only thing that touches it. Nothing migrates between them —
 * #11's *Out of scope* carries no accounts or history across. (That table keeps
 * its name because it is not ours to rename while production reads it; every name
 * minted here takes the glossary's word instead — ADR 0014.)
 *
 * `updatedAt` is **the athlete's device's clock at the moment of the edit**, in
 * epoch milliseconds, and not the server's arrival time. That is what makes the
 * merge rule survive the outbox (#58): a write queued on a plane and flushed an
 * hour later must lose to an edit made on the phone in the meantime, and arrival
 * order says the opposite. Stored as a plain integer rather than in drizzle's
 * `timestamp` mode for the same reason — it is a version, compared numerically,
 * and `app_state.updatedAt` above is the different thing (server write time).
 *
 * A **`null` `row` is a tombstone**, not a row holding null. Deleting outright
 * would let a stale update resurrect a deleted row, because there would be
 * nothing left to compare its timestamp against; keeping the key with its
 * deletion time makes delete and update the same rule. Nothing prunes tombstones
 * yet — at five accounts and roughly 28 KB each that is affordable, and a sweep
 * belongs with the outbox that starts generating them in bulk.
 */
export const recordRow = sqliteTable(
	'record_row',
	{
		accountId: text('account_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** Which collection — `taskDone`, `sessions`, ... See `server/record/rows.ts`. */
		collection: text('collection').notNull(),
		/** The collection's own `getKey(row)`, as a string. */
		rowKey: text('row_key').notNull(),
		/** The row, as JSON. Null is a tombstone. Not `data`, which is on **Training
		 *  record**'s `_Avoid_` list (ADR 0014). */
		row: text('row'),
		/** Epoch ms on the writing device. See the note above. */
		updatedAt: integer('updated_at').notNull(),
	},
	// No secondary index. Every read here is "the whole record for one account",
	// and the primary key's leading column already serves that — a separate index
	// on `account_id` would be a duplicate that only costs write amplification.
	(t) => [primaryKey({ columns: [t.accountId, t.collection, t.rowKey] })],
);

/** One personal API token per user — authenticates their own AI/MCP client (and
 *  the /api/v1 REST API) via `Authorization: Bearer <token>`. Stored in plaintext
 *  so the user can re-reveal it on demand; "regenerate" swaps it for a new one. */
export const apiToken = sqliteTable('api_token', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull(),
});

// ---- OAuth 2.1 authorization server (for MCP connectors) ----
//
// Lets a client (e.g. a claude.ai custom connector) obtain a short-lived,
// user-authorized access token via the standard MCP authorization flow —
// dynamic client registration → PKCE authorization-code → token — instead of a
// pasted, permanent `sl_` secret. The personal token above keeps working; these
// tables back the OAuth path.

/** A client registered via dynamic client registration (RFC 7591). Public
 *  (PKCE, no secret) unless it asked for a confidential auth method. */
export const oauthClient = sqliteTable('oauth_client', {
	id: text('id').primaryKey(), // client_id
	secret: text('secret'), // null for public (PKCE-only) clients
	name: text('name'),
	// JSON-encoded string[] of allowed redirect URIs (exact-match at authorize).
	redirectUris: text('redirect_uris').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull(),
});

/** A single-use authorization code (RFC 6749 + PKCE). Short-lived; deleted on
 *  redemption at the token endpoint. */
export const oauthCode = sqliteTable('oauth_code', {
	code: text('code').primaryKey(),
	clientId: text('client_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	redirectUri: text('redirect_uri').notNull(),
	codeChallenge: text('code_challenge').notNull(), // S256 challenge
	scope: text('scope'),
	resource: text('resource'), // RFC 8707 resource indicator
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull(),
});

/** A bearer access token issued to a client for a user. Short-lived; the MCP
 *  endpoint accepts it as `Authorization: Bearer <token>`. */
export const oauthAccessToken = sqliteTable('oauth_access_token', {
	token: text('token').primaryKey(),
	clientId: text('client_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	scope: text('scope'),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull(),
});

/** A long-lived refresh token — exchanged at the token endpoint for a fresh
 *  access token. Rotated on each use. */
export const oauthRefreshToken = sqliteTable('oauth_refresh_token', {
	token: text('token').primaryKey(),
	clientId: text('client_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	scope: text('scope'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull(),
});
