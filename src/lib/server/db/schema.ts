import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

export const session = sqliteTable('session', {
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
});

export const account = sqliteTable('account', {
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
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

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
