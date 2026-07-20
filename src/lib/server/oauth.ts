// OAuth 2.1 authorization server for MCP connectors.
//
// Implements the slice of the MCP authorization spec a client like a claude.ai
// custom connector needs: discovery metadata (RFC 8414 / RFC 9728), dynamic
// client registration (RFC 7591), and the PKCE authorization-code + refresh-token
// grants (RFC 6749 + RFC 7636). The MCP endpoint accepts the resulting access
// tokens; the pre-existing personal `sl_` token keeps working alongside them.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { userIdFromToken } from '$lib/server/apiToken';
import { db } from '$lib/server/db';
import { oauthAccessToken, oauthClient, oauthCode, oauthRefreshToken } from '$lib/server/db/schema';

export const ACCESS_TTL_SEC = 60 * 60; // 1 hour
const CODE_TTL_SEC = 60 * 10; // 10 minutes
const SUPPORTED_SCOPES = ['mcp'];

/** Permissive CORS headers so browser- and server-side MCP clients can reach the
 *  discovery/token endpoints cross-origin. These endpoints carry no cookies. */
export const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type',
	'Access-Control-Max-Age': '86400',
};

const randomToken = () => randomBytes(32).toString('base64url');
const base64urlSha256 = (input: string) => createHash('sha256').update(input).digest('base64url');

/** Constant-time string compare that tolerates length differences. */
function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	if (ab.length !== bb.length) return false;
	return timingSafeEqual(ab, bb);
}

// ---- discovery metadata ----

/** RFC 9728 protected-resource metadata: points the client at this auth server. */
export function protectedResourceMetadata(origin: string) {
	return {
		resource: `${origin}/mcp`,
		authorization_servers: [origin],
		scopes_supported: SUPPORTED_SCOPES,
		bearer_methods_supported: ['header'],
	};
}

/** RFC 8414 authorization-server metadata: the endpoints and capabilities. */
export function authorizationServerMetadata(origin: string) {
	return {
		issuer: origin,
		authorization_endpoint: `${origin}/oauth/authorize`,
		token_endpoint: `${origin}/oauth/token`,
		registration_endpoint: `${origin}/oauth/register`,
		scopes_supported: SUPPORTED_SCOPES,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
		code_challenge_methods_supported: ['S256'],
	};
}

// ---- dynamic client registration ----

export type RegisteredClient = {
	client_id: string;
	client_secret?: string;
	client_id_issued_at: number;
	client_secret_expires_at: number;
	redirect_uris: string[];
	token_endpoint_auth_method: string;
	grant_types: string[];
	response_types: string[];
	client_name?: string;
};

/** Register a client from an RFC 7591 request body, or throw with a message. */
export async function registerClient(body: unknown): Promise<RegisteredClient> {
	const b = (body ?? {}) as Record<string, unknown>;
	const redirectUris = Array.isArray(b.redirect_uris) ? b.redirect_uris.map(String) : [];
	if (redirectUris.length === 0) throw new Error('redirect_uris is required');
	for (const uri of redirectUris) {
		try {
			new URL(uri);
		} catch {
			throw new Error(`invalid redirect_uri: ${uri}`);
		}
	}
	const requested =
		typeof b.token_endpoint_auth_method === 'string' ? b.token_endpoint_auth_method : 'none';
	const confidential = requested !== 'none';
	const clientId = randomToken();
	const secret = confidential ? randomToken() : null;
	const name = typeof b.client_name === 'string' ? b.client_name : null;

	await db
		.insert(oauthClient)
		.values({ id: clientId, secret, name, redirectUris: JSON.stringify(redirectUris) })
		.run();

	const authMethod = confidential ? 'client_secret_post' : 'none';
	return {
		client_id: clientId,
		...(secret ? { client_secret: secret } : {}),
		client_id_issued_at: Math.floor(Date.now() / 1000),
		client_secret_expires_at: 0, // never expires
		redirect_uris: redirectUris,
		token_endpoint_auth_method: authMethod,
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		...(name ? { client_name: name } : {}),
	};
}

export type ClientRow = {
	id: string;
	secret: string | null;
	name: string | null;
	redirectUris: string[];
};

/** Look up a registered client by id, or null. */
export async function getClient(clientId: string): Promise<ClientRow | null> {
	if (!clientId) return null;
	const row = await db.select().from(oauthClient).where(eq(oauthClient.id, clientId)).get();
	if (!row) return null;
	let uris: string[] = [];
	try {
		uris = JSON.parse(row.redirectUris);
	} catch {
		uris = [];
	}
	return { id: row.id, secret: row.secret, name: row.name, redirectUris: uris };
}

// ---- authorization codes ----

/** Mint a single-use authorization code bound to a user + PKCE challenge. */
export async function issueAuthCode(params: {
	clientId: string;
	userId: string;
	redirectUri: string;
	codeChallenge: string;
	scope: string | null;
	resource: string | null;
}): Promise<string> {
	const code = randomToken();
	await db
		.insert(oauthCode)
		.values({
			code,
			clientId: params.clientId,
			userId: params.userId,
			redirectUri: params.redirectUri,
			codeChallenge: params.codeChallenge,
			scope: params.scope,
			resource: params.resource,
			expiresAt: new Date(Date.now() + CODE_TTL_SEC * 1000),
		})
		.run();
	return code;
}

type CodeRow = {
	clientId: string;
	userId: string;
	redirectUri: string;
	codeChallenge: string;
	scope: string | null;
};

/** Consume (delete) an auth code, returning it if still valid. Single-use. */
async function consumeAuthCode(code: string): Promise<CodeRow | null> {
	const row = await db.select().from(oauthCode).where(eq(oauthCode.code, code)).get();
	if (!row) return null;
	// Always delete on lookup — a code is single-use even if expired.
	await db.delete(oauthCode).where(eq(oauthCode.code, code)).run();
	if (row.expiresAt.getTime() < Date.now()) return null;
	return {
		clientId: row.clientId,
		userId: row.userId,
		redirectUri: row.redirectUri,
		codeChallenge: row.codeChallenge,
		scope: row.scope,
	};
}

// ---- access + refresh tokens ----

export type TokenResponse = {
	access_token: string;
	token_type: 'Bearer';
	expires_in: number;
	refresh_token: string;
	scope?: string;
};

async function issueTokens(
	clientId: string,
	userId: string,
	scope: string | null,
): Promise<TokenResponse> {
	const access = randomToken();
	const refresh = randomToken();
	await db
		.insert(oauthAccessToken)
		.values({
			token: access,
			clientId,
			userId,
			scope,
			expiresAt: new Date(Date.now() + ACCESS_TTL_SEC * 1000),
		})
		.run();
	await db.insert(oauthRefreshToken).values({ token: refresh, clientId, userId, scope }).run();
	return {
		access_token: access,
		token_type: 'Bearer',
		expires_in: ACCESS_TTL_SEC,
		refresh_token: refresh,
		...(scope ? { scope } : {}),
	};
}

/** An OAuth error that maps to a JSON body + HTTP status at the token endpoint. */
export class OAuthError extends Error {
	constructor(
		readonly error: string,
		readonly status = 400,
		readonly description?: string,
	) {
		super(description ?? error);
	}
}

/** Authenticate the client for a token request (public → PKCE only; confidential
 *  → matching client_secret). Returns the client or throws an OAuthError. */
async function authenticateClient(
	clientId: string,
	clientSecret: string | null,
): Promise<ClientRow> {
	const client = await getClient(clientId);
	if (!client) throw new OAuthError('invalid_client', 401, 'unknown client_id');
	if (client.secret) {
		if (!clientSecret || !safeEqual(clientSecret, client.secret))
			throw new OAuthError('invalid_client', 401, 'client authentication failed');
	}
	return client;
}

/** authorization_code grant: verify PKCE + redirect_uri, issue tokens. */
export async function exchangeAuthCode(params: {
	code: string;
	redirectUri: string;
	clientId: string;
	clientSecret: string | null;
	codeVerifier: string;
}): Promise<TokenResponse> {
	await authenticateClient(params.clientId, params.clientSecret);
	if (!params.codeVerifier) throw new OAuthError('invalid_request', 400, 'code_verifier required');

	const row = await consumeAuthCode(params.code);
	if (!row) throw new OAuthError('invalid_grant', 400, 'code invalid or expired');
	if (row.clientId !== params.clientId)
		throw new OAuthError('invalid_grant', 400, 'code was issued to another client');
	if (row.redirectUri !== params.redirectUri)
		throw new OAuthError('invalid_grant', 400, 'redirect_uri mismatch');
	if (!safeEqual(base64urlSha256(params.codeVerifier), row.codeChallenge))
		throw new OAuthError('invalid_grant', 400, 'PKCE verification failed');

	return issueTokens(row.clientId, row.userId, row.scope);
}

/** refresh_token grant: rotate the refresh token and issue a fresh access token. */
export async function exchangeRefreshToken(params: {
	refreshToken: string;
	clientId: string;
	clientSecret: string | null;
}): Promise<TokenResponse> {
	await authenticateClient(params.clientId, params.clientSecret);
	const row = await db
		.select()
		.from(oauthRefreshToken)
		.where(eq(oauthRefreshToken.token, params.refreshToken))
		.get();
	if (!row) throw new OAuthError('invalid_grant', 400, 'unknown refresh_token');
	if (row.clientId !== params.clientId)
		throw new OAuthError('invalid_grant', 400, 'refresh_token was issued to another client');
	// Rotate: the presented refresh token is now spent.
	await db.delete(oauthRefreshToken).where(eq(oauthRefreshToken.token, params.refreshToken)).run();
	return issueTokens(row.clientId, row.userId, row.scope);
}

// ---- resource-server side: resolve a bearer token to a user ----

/** Resolve an OAuth access token to a user id, or null. Deletes it if expired. */
async function userIdFromAccessToken(token: string): Promise<string | null> {
	if (!token) return null;
	const row = await db
		.select()
		.from(oauthAccessToken)
		.where(eq(oauthAccessToken.token, token))
		.get();
	if (!row) return null;
	if (row.expiresAt.getTime() < Date.now()) {
		await db.delete(oauthAccessToken).where(eq(oauthAccessToken.token, token)).run();
		return null;
	}
	return row.userId;
}

/** Resolve the MCP endpoint's Bearer token to a user: a personal `sl_` token or
 *  an OAuth access token. Returns null if neither matches. */
export async function resolveMcpUser(token: string): Promise<string | null> {
	if (!token) return null;
	return (await userIdFromToken(token)) ?? (await userIdFromAccessToken(token));
}

/** Best-effort cleanup of expired codes and access tokens (called opportunistically). */
export async function purgeExpired(): Promise<void> {
	const now = new Date();
	await db.delete(oauthCode).where(lt(oauthCode.expiresAt, now)).run();
	await db.delete(oauthAccessToken).where(lt(oauthAccessToken.expiresAt, now)).run();
}

/** Guard used by the authorize endpoint: is this redirect URI registered? */
export function redirectAllowed(client: ClientRow, redirectUri: string): boolean {
	return client.redirectUris.includes(redirectUri);
}
