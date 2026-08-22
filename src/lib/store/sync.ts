// Keeping the store and `/api/state` in step — the client half of #57.
//
// THE WRITE NEVER WAITS FOR THE NETWORK
// -------------------------------------
// This is the constraint everything else here is shaped by. TanStack DB's
// localStorage collection `await`s the `onInsert`/`onUpdate`/`onDelete` handler
// **before** it writes to storage, and a handler that throws rolls the mutation
// back. So a handler that awaited `fetch` would mean: ticking a task on a train
// blocks until the request times out, and then un-ticks itself.
//
// The app is offline-first (#24) and that would make it worse offline than it was
// before it could sync at all. So `push()` is fire-and-forget: it queues, returns
// immediately, and the collection persists locally as it always did. The server
// write is best-effort behind it.
//
// THE SERVER IS ONE OF TWO WRITERS, NOT THE TRUTH
// -----------------------------------------------
// Every rule in `applyRecord` below follows from that. A hydrate does not
// overwrite a row this device has changed and not yet sent — that row is newer by
// construction, and the first cut of this module lost exactly that write, with a
// test enshrining the loss. A row merely *missing* from the response is not a
// deletion either; it is far more often a write that has not synced. What the
// server can say is that a row was deleted, and it says so with a tombstone.
//
// WHAT THIS LEAVES UNSOLVED, AND WHO OWNS IT
// ------------------------------------------
// The pending map is **in memory**. A write made offline survives in
// `localStorage` as part of the collection, but the *fact that it has not reached
// the server* does not survive a reload — so a reload while offline loses the
// intent to sync, and the row sits locally until something else touches it.
//
// That is deliberate and it is #58's: ADR 0008 says `@tanstack/offline-transactions`
// is what makes a write durable, and installing the queue here was ruled out of
// scope. `unsynced()` below is what the UI can show in the meantime —
// `CONTEXT.md` calls it **unsynced work** — and it is honest about the gap rather
// than hiding it.
import type { StoredRecord, UnsyncedWrite, WriteReport } from '$lib/recordWire';
import { HYDRATED, type RecordStore } from './collections';

/** How long a burst of mutations is allowed to accumulate before it is sent.
 *  Ticking four tasks in a row is one request rather than four; a quarter second
 *  is below the threshold where the athlete would notice a delay. */
const FLUSH_DELAY_MS = 250;

/** The two calls this module makes, injectable so the tests do not need a
 *  network. Nothing else in here knows what HTTP is. */
export interface Transport {
	read(): Promise<StoredRecord>;
	write(writes: readonly UnsyncedWrite[]): Promise<WriteReport>;
}

/** The real one. Relative URLs, because the app is served from its own origin
 *  and the session cookie rides along. */
export const httpTransport: Transport = {
	async read() {
		const response = await fetch('/api/state');
		if (!response.ok) throw new Error(`GET /api/state — HTTP ${response.status}`);
		return response.json();
	},
	async write(writes) {
		const response = await fetch('/api/state', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ writes }),
		});
		if (!response.ok) throw new Error(`PUT /api/state — HTTP ${response.status}`);
		return response.json();
	},
};

/**
 * One row's identity in the pending map: its collection and its key.
 *
 * Joined on a NUL, which is not decoration. A row key here can be free text —
 * `savedPrograms` is keyed by the athlete's own name for a program — so a
 * printable separator can appear inside either half, and `"a:b" + ":" + "c"` and
 * `"a" + ":" + "b:c"` would be one entry for two different rows. NUL cannot occur
 * in a collection name or in any key the app mints.
 */
function pendingKey(collection: string, key: string): string {
	return `${collection}\0${key}`;
}

export interface RecordSync {
	/** Hand rows to the server. Returns immediately; never throws. */
	push(writes: readonly UnsyncedWrite[]): void;
	/** Fetch the account's record and write it into `store`. */
	hydrate(store: RecordStore): Promise<void>;
	/** Send whatever is pending now, rather than waiting for the debounce. */
	flush(): Promise<void>;
	/** Resolves once a hydrate has been *attempted* — succeeded or failed. What a
	 *  caller needs before it can tell "the account holds no such row" from "the
	 *  account has not answered yet". */
	settled(): Promise<void>;
	/** Rows written locally that the server has not acknowledged. */
	unsynced(): number;
}

/**
 * A sync for one account.
 *
 * One per store, built beside it: the account id is not a parameter of any call
 * because a sync that could be pointed at a different account mid-life is a way
 * to write one athlete's rows into another's record.
 */
export function createRecordSync(transport: Transport = httpTransport): RecordSync {
	/** The unsynced writes, one per row, so a second edit of the same row replaces
	 *  the first rather than waiting behind it. That is the same last-write-wins
	 *  rule the server applies, done early: sending both would be a round trip
	 *  whose result is discarded by the next one. */
	const pending = new Map<string, UnsyncedWrite>();
	let timer: ReturnType<typeof setTimeout> | null = null;
	let inFlight: Promise<void> | null = null;

	/** The store this sync hydrated, so reconnecting can re-read as well as
	 *  re-send. Without it only half of coming back online happens: the local
	 *  writes go out and the other device's rows never come in. */
	let hydrated: RecordStore | null = null;

	let markSettled: () => void = () => {};
	const settled = new Promise<void>((resolve) => {
		markSettled = resolve;
	});

	function schedule() {
		if (timer !== null || pending.size === 0) return;
		timer = setTimeout(() => {
			timer = null;
			void flush();
		}, FLUSH_DELAY_MS);
	}

	async function flush(): Promise<void> {
		// One request at a time. Two overlapping PUTs of the same key would land in
		// whichever order the network chose, and the merge rule would then be
		// deciding between two writes that are not actually in dispute.
		if (inFlight) return inFlight;
		if (pending.size === 0) return;

		let delivered = false;
		const batch = [...pending.values()];
		inFlight = (async () => {
			try {
				const report = await transport.write(batch);
				delivered = true;
				// Only drop the rows that were actually sent: an edit made while the
				// request was in flight is newer and must survive to the next flush.
				for (const write of batch) {
					const key = pendingKey(write.collection, write.key);
					if (pending.get(key) === write) pending.delete(key);
				}
				for (const bad of report.rejected) {
					console.error(
						`/api/state refused ${bad.collection}/${bad.key}: ${bad.reason}. ` +
							'The client and the server disagree about this row — one of them has a bug.',
					);
					pending.delete(pendingKey(bad.collection, bad.key));
				}
			} catch (error) {
				// Offline, or the server is down. The rows stay pending and the next
				// mutation — or `online` — retries them. Not thrown: nothing above
				// this is in a position to do anything about it, and the mutation it
				// belongs to committed locally a long time ago.
				console.warn('/api/state write deferred:', error);
			} finally {
				inFlight = null;
			}
		})();

		await inFlight;
		// Re-arm only after a request that actually landed, and only for an edit
		// that arrived while it was in flight. Re-arming after a *failure* is a
		// retry loop: the pending map is never empty after one, so an offline
		// device would send four requests a second for as long as it stayed
		// offline. A deferred write waits for the next mutation, or for `online`.
		if (delivered) schedule();
	}

	async function hydrate(store: RecordStore): Promise<void> {
		hydrated = store;
		try {
			applyRecord(store, await transport.read(), (collection, key) =>
				pending.has(pendingKey(collection, key)),
			);
		} finally {
			markSettled();
		}
	}

	if (typeof window !== 'undefined') {
		// Coming back online is the one moment a deferred write is worth retrying
		// unprompted — and the moment the other device's rows are worth re-reading.
		// Both halves, in that order: without the re-read, a session that began
		// offline never learns what the other device did while it was away.
		window.addEventListener('online', () => {
			void flush().then(() => (hydrated ? hydrate(hydrated) : undefined));
		});
	}

	return {
		push(writes) {
			for (const write of writes) pending.set(pendingKey(write.collection, write.key), write);
			schedule();
		},
		hydrate,
		flush,
		settled: () => settled,
		unsynced: () => pending.size,
	};
}

/**
 * Write the server's answer into the collections.
 *
 * Three rules, and each one is a way the athlete's training could otherwise be
 * lost:
 *
 *   * **A row still pending is left alone.** It is a change this device made and
 *     has not sent, so it is newer than anything the server can be holding for
 *     that key. Overwriting it would mean: tick a task offline, reconnect, and
 *     watch the tick revert.
 *   * **A row merely absent is left alone.** Absence is not deletion — it is far
 *     more often a write that has not synced yet. Deleting on absence would mean
 *     logging a session on a plane, landing, and watching it disappear.
 *   * **A row the server says was deleted is deleted.** That is what the
 *     tombstones are for, and without them a delete could never reach a second
 *     device at all.
 */
function applyRecord(
	store: RecordStore,
	record: StoredRecord,
	isPending: (collection: string, key: string) => boolean,
): void {
	for (const [name, rows] of Object.entries(record.rows ?? {})) {
		const collection = sinkFor(store, name);
		if (!collection || !Array.isArray(rows)) continue;

		for (const row of rows) {
			try {
				const key = collection.getKeyFromItem(row);
				if (isPending(name, String(key))) continue;
				// Tagged `HYDRATED` so the collection's own write handler skips it: this
				// row came *from* the server, and sending it back would re-stamp its
				// version with a newer clock and beat a real edit made elsewhere.
				if (collection.has(key)) {
					collection.update(key, { metadata: HYDRATED }, (draft: Record<string, unknown>) => {
						for (const field of Object.keys(draft)) delete draft[field];
						Object.assign(draft, row);
					});
				} else {
					collection.insert(row, { metadata: HYDRATED });
				}
			} catch (error) {
				// A row this build cannot key — written by a newer deploy, most
				// likely. Skipped rather than allowed to abort the loop: the same
				// ruling #56's review made about one unrenderable log row, which
				// blanked five weeks of history. The rest of the account still lands.
				console.warn(`/api/state — skipped an unusable ${name} row:`, error);
			}
		}
	}

	for (const [name, keys] of Object.entries(record.deleted ?? {})) {
		const collection = sinkFor(store, name);
		if (!collection || !Array.isArray(keys)) continue;
		for (const key of keys) {
			// A delete this device has since undone — the row re-created and not yet
			// sent — must not be re-applied. Same rule as above.
			if (isPending(name, key)) continue;
			// Four collections key on a number and the wire carries strings, so the
			// string spelling has to be tried both ways round.
			const actual = collection.has(key) ? key : Number(key);
			if (!collection.has(actual)) continue;
			collection.delete(actual, { metadata: HYDRATED });
		}
	}
}

/** `RecordStore` is a fixed set of fifteen; anything else is a collection this
 *  build does not know about, and there is nowhere to put it. */
function sinkFor(store: RecordStore, name: string): RowSink | undefined {
	return (store as unknown as Record<string, RowSink | undefined>)[name];
}

/** The slice of a collection a hydrate uses. Named rather than reached for
 *  through `RecordStore`'s fifteen distinct generic instantiations, which have no
 *  common supertype to write down. */
interface RowSink {
	getKeyFromItem(row: unknown): string | number;
	has(key: string | number): boolean;
	update(
		key: string | number,
		config: { metadata: typeof HYDRATED },
		// The draft's type differs per collection, and this is the one place where
		// all fifteen are handled uniformly.
		// biome-ignore lint/suspicious/noExplicitAny: see above
		callback: (draft: any) => void,
	): unknown;
	insert(row: unknown, config: { metadata: typeof HYDRATED }): unknown;
	delete(key: string | number, config: { metadata: typeof HYDRATED }): unknown;
}
