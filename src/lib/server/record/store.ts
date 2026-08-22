// The training record in the database — the one place rows are read and written.
//
// Kept free of the app's `db` singleton the way `oauthCleanup.ts` is, and for the
// same reason: a bug here loses training the athlete actually did, so it is
// exercised against a real in-memory database rather than trusted. Both functions
// take the database and the route passes it — there is no singleton-bound wrapper,
// because a second spelling of the same call is a second thing to keep in step.
//
// This is the module the rendering decision asked for: `/api/state` and the MCP
// tools both import it, so a mutation is the same operation however it arrives
// and neither side reimplements the write path.
//
// The route path stays `/api/state` — #12 and #18 named it and it is an external
// contract — but nothing minted here wears that word: *state* is the first entry
// on **Training record**'s `_Avoid_` list, and ADR 0014 binds every layer the
// athlete's data passes through, storage included.
import { eq, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { AthleteId } from '$lib/ids';
import type { StoredRecord, UnsyncedWrite, WriteReport } from '$lib/recordWire';
import type * as schema from '../db/schema';
import { recordRow } from '../db/schema';
import { COLLECTION_NAMES } from './rows';

type Db = LibSQLDatabase<typeof schema>;

/**
 * One account's whole training record: the rows it holds, and the keys it has
 * deleted.
 *
 * Both halves, because the client cannot infer the second from the first.
 * A row missing from `rows` is far more often a write that has not synced yet
 * than a deletion — so absence has to mean "keep what you have", and the
 * tombstones are then the only way a delete reaches a second device.
 */
export async function readRecordIn(database: Db, accountId: AthleteId): Promise<StoredRecord> {
	// One query for both halves. Tombstones are a fraction of the table and
	// splitting this in two would pay a second round trip to Turso to learn
	// something the first result already contains.
	const stored = await database
		.select({
			collection: recordRow.collection,
			rowKey: recordRow.rowKey,
			row: recordRow.row,
		})
		.from(recordRow)
		.where(eq(recordRow.accountId, accountId));

	const rows: Record<string, unknown[]> = {};
	const deleted: Record<string, string[]> = {};
	for (const name of COLLECTION_NAMES) {
		rows[name] = [];
		deleted[name] = [];
	}

	for (const stored_ of stored) {
		// A collection this build does not know about is skipped rather than
		// returned: it is a row written by a newer deploy that has since rolled
		// back, and handing it to a client that cannot key it would be worse than
		// leaving it in the table where the newer deploy will find it again.
		if (stored_.row === null) {
			deleted[stored_.collection]?.push(stored_.rowKey);
			continue;
		}
		rows[stored_.collection]?.push(JSON.parse(stored_.row));
	}

	return { rows, deleted };
}

/**
 * Apply a batch of per-key writes, last-write-wins per row key.
 *
 * THE MERGE RULE
 * --------------
 * One statement, and the comparison is in the `ON CONFLICT` clause rather than in
 * a read followed by a write — a read-then-write is two statements with a race
 * between them, which is precisely the race the per-key path exists to remove.
 *
 * The version compared is the **writing device's** clock, not arrival time. That
 * is what makes the rule survive the outbox (#58): a tick queued on a plane and
 * flushed an hour later has to lose to an edit made on the phone in the meantime,
 * and arrival order says the opposite.
 *
 * A tie wins for the incoming write (`>=`, not `>`). Two devices writing the same
 * key in the same millisecond is not something ordering can help with, and
 * treating a tie as a loss would make the *retry* of a write report as stale —
 * the outbox re-flushes, and a re-flush must be idempotent rather than surprising.
 *
 * WHAT THIS KNOWINGLY DISCARDS
 * ----------------------------
 * #24 accepted the genuine conflicts and they have not changed: tick-vs-untick,
 * the same day's plan edited twice, and the same `prefs` field. In each the later
 * edit stands and the other is silently gone. Append-only history cannot lose an
 * entry, because two devices appending produce two keys — which is the whole
 * reason the write got smaller.
 */
export async function applyWritesIn(
	database: Db,
	accountId: AthleteId,
	writes: readonly UnsyncedWrite[],
): Promise<Omit<WriteReport, 'rejected'>> {
	if (writes.length === 0) return { applied: 0, stale: 0 };

	const values = writes.map((write) => ({
		accountId,
		collection: write.collection,
		rowKey: write.key,
		// A delete is stored as a tombstone rather than removed. Deleting outright
		// would leave nothing to compare a late, stale update against, and the row
		// would come back from the dead.
		row: write.row === null ? null : JSON.stringify(write.row),
		updatedAt: write.at,
	}));

	// `RETURNING` yields a row only for a write that actually landed: when the
	// `DO UPDATE`'s `WHERE` is false the row is left alone and nothing comes back.
	// So the count of returned rows *is* the applied count, and the rest are stale.
	const landed = await database
		.insert(recordRow)
		.values(values)
		.onConflictDoUpdate({
			target: [recordRow.accountId, recordRow.collection, recordRow.rowKey],
			set: { row: sql`excluded.row`, updatedAt: sql`excluded.updated_at` },
			setWhere: sql`excluded.updated_at >= ${recordRow.updatedAt}`,
		})
		.returning({ rowKey: recordRow.rowKey });

	return { applied: landed.length, stale: writes.length - landed.length };
}
