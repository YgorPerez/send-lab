// What the client and the server say to each other about the training record.
//
// Declared once, here, in a module that imports neither side. The first cut of
// #57 had this shape written out three times — `UnsyncedWrite` in the collections,
// `StateWrite` in the server's request parser, and `WriteReport` restating the
// server's own outcome type — and the review caught the contradiction: the
// collections' own comment argued that "one concept under two names across one
// seam is the drift ADR 0014 exists to stop", one file away from doing it.
//
// It cannot live in `store/collections.ts`, because the server would then import a
// module that builds fifteen `localStorage` collections at load; it cannot live in
// `server/record/`, because the client would import the server. So it lives below
// both, which is the direction ADR 0013 already established for a shared closed
// set: it moves down, never up.
//
// **The glossary's words, at every layer** (ADR 0014). *State*, *data* and
// *document* are all on **Training record**'s `_Avoid_` list, so the payload
// speaks of records and rows: a write carries a `row`, and a `row` of `null` is a
// deletion.

/**
 * One row the athlete has changed that has not reached the server yet.
 *
 * **Unsynced work**, in `CONTEXT.md`'s words, one row of it. Not `QueuedWrite`:
 * *queued* is on that term's `_Avoid_` list.
 */
export interface UnsyncedWrite {
	readonly collection: string;
	readonly key: string;
	/** The row, or `null` to delete it. A deletion is content like any other under
	 *  last-write-wins, which is why it is not its own kind of message. */
	readonly row: unknown;
	/** Epoch ms **when the athlete made the edit**, on their own device — not when
	 *  it was sent. The merge rule compares this, so stamping it at send time would
	 *  let a delayed write beat the edit that superseded it. */
	readonly at: number;
}

/** A row that will not be stored, and why. Reported per row rather than failing
 *  the batch: the athlete's other fourteen collections did nothing wrong. */
export interface WriteRejection {
	readonly collection: string;
	readonly key: string;
	readonly reason: string;
}

/** What became of a batch.
 *
 *  `stale` is not a failure — a write that lost the merge did so because a newer
 *  edit of the same row already won, which is the rule working. `rejected` should
 *  always be empty, because the client and the server check the same rows against
 *  the same registry; anything in it means one of them has a bug. */
export interface WriteReport {
	readonly applied: number;
	readonly stale: number;
	readonly rejected: readonly WriteRejection[];
}

/**
 * One account's whole training record, as a hydrate returns it.
 *
 * **`deleted` is not an optimisation.** Without it a deletion is indistinguishable
 * from a row the server has never been told about, and the client cannot treat
 * those the same: a missing row is far more often a write that has not synced yet
 * than a deletion, so absence has to mean "keep what you have". That leaves
 * tombstones as the only way a delete can reach a second device at all.
 *
 * Every collection is present in both maps, empty ones included, so a client can
 * tell "nothing stored" from "not asked about" without knowing the collection
 * list itself.
 */
export interface StoredRecord {
	readonly rows: Readonly<Record<string, unknown[]>>;
	/** Keys the athlete deleted, per collection. */
	readonly deleted: Readonly<Record<string, string[]>>;
}
