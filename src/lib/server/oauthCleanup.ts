// Opportunistic cleanup of the OAuth tables, kept free of the app's db singleton
// (which pulls in SvelteKit's private-env virtual module) so it can be exercised
// against a real in-memory database in tests. A bug here deletes a live user's
// connector, so it is worth testing rather than trusting.
import { and, eq, lt, notExists, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from './db/schema';
import { oauthAccessToken, oauthClient, oauthCode, oauthRefreshToken } from './db/schema';

/** How long an unused client registration survives. Registration is followed by
 *  the consent screen within seconds, so anything still empty after this was
 *  abandoned — but the window is generous, because being wrong here means
 *  breaking someone's connector. */
const CLIENT_GRACE_MS = 24 * 60 * 60 * 1000;

type Db = LibSQLDatabase<typeof schema>;

/** Delete expired authorization codes and access tokens, then any client
 *  registration that is past its grace period and holds nothing.
 *
 *  `/oauth/register` is unauthenticated by design (RFC 7591, as MCP uses it), so
 *  without this anyone can grow `oauth_client` without bound. Registrations carry
 *  no expiry of their own — a client is kept alive by *use*, not by age.
 *
 *  Order matters: expired codes and tokens go first, so a client still holding
 *  one afterwards is genuinely live. A client that completed authorization always
 *  has a refresh token (they are issued together and rotation re-inserts one), so
 *  a connected client is never a deletion candidate however idle it goes. */
export async function purgeExpiredIn(database: Db, now: Date = new Date()): Promise<void> {
	await database.delete(oauthCode).where(lt(oauthCode.expiresAt, now)).run();
	await database.delete(oauthAccessToken).where(lt(oauthAccessToken.expiresAt, now)).run();

	const holdsNothing = [oauthRefreshToken, oauthAccessToken, oauthCode].map((t) =>
		notExists(database.select({ one: sql`1` }).from(t).where(eq(t.clientId, oauthClient.id))),
	);
	await database
		.delete(oauthClient)
		.where(
			and(lt(oauthClient.createdAt, new Date(now.getTime() - CLIENT_GRACE_MS)), ...holdsNothing),
		)
		.run();
}
