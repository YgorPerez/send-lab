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
// WHERE THE UNSENT WRITES LIVE
// ----------------------------
// Not here, and not in memory. `store/unsynced.ts` holds them, persisted under
// `sendlab:<account>:unsynced`, which is what #58 added: this module used to keep
// them in a `Map`, so a reload while offline lost *the fact that a row had not
// been sent* even though the row itself survived inside its collection. The write
// then sat on the device until something else happened to touch the same row.
//
// That module also owns the terminal state. A row the server *refuses* — a 200
// whose report names it — leaves the replay rather than being retried forever
// with every later write stuck behind it, and stays counted, because
// `CONTEXT.md` is explicit that work which can never be sent is unsynced work in
// its final state rather than a separate thing.
//
import type { StorageApi } from '@tanstack/db';
import type { StoredRecord, UnsyncedWrite, WriteReport } from '$lib/recordWire';
import { HYDRATED, type RecordStore, storageOverride } from './collections';
import { createUnsyncedWork, type RefusedWrite } from './unsynced';

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

export interface RecordSync {
	/** Hand rows to the server. Returns immediately; never throws. */
	push(writes: readonly UnsyncedWrite[]): void;
	/** Fetch the account's record and write it into `store`. */
	hydrate(store: RecordStore): Promise<void>;
	/** Send the unsynced work now, rather than waiting for the debounce. */
	flush(): Promise<void>;
	/** Resolves once a hydrate has been *attempted* — succeeded or failed. What a
	 *  caller needs before it can tell "the account holds no such row" from "the
	 *  account has not answered yet". */
	settled(): Promise<void>;
	/** Rows written locally that the server has not acknowledged, including the
	 *  ones it never will. `CONTEXT.md`'s **unsynced work**. */
	unsynced(): number;
	/** The other half of that count: rows a `flush` could still deliver. What a
	 *  screen asks when it wants to *wait* for the work — `unsynced()` includes
	 *  the refusals, and no amount of flushing will ever bring that count down. */
	sendable(): number;
	/** The work in its final state: writes the server refused, which will not be
	 *  retried. Surfaced so a screen can say so — the whole hazard of a refusal is
	 *  that it arrives as a 200 and is otherwise invisible. */
	refused(): RefusedWrite[];
	/** Be told when a batch has settled: what was delivered is gone, and what was
	 *  refused is final. Returns the unsubscribe.
	 *
	 *  The reason a screen showing either count needs this rather than one read at
	 *  mount — most flushes are not the screen's doing. The debounce fires 250ms
	 *  after any write on any page, the `online` listener fires on reconnect, and
	 *  the constructor replays whatever the last tab left behind. A refusal can
	 *  therefore arrive while the athlete is looking straight at the screen that
	 *  exists to report it. */
	subscribe(notify: () => void): () => void;
}

/**
 * A sync for one account.
 *
 * One per store, built beside it: the account id is not a parameter of any call
 * because a sync that could be pointed at a different account mid-life is a way
 * to write one athlete's rows into another's record.
 */
export function createRecordSync(
	account: string,
	transport: Transport = httpTransport,
	storage: StorageApi | undefined = storageOverride(),
): RecordSync {
	/** The unsynced writes, durable and one per row, so a second edit of a row
	 *  replaces the first rather than waiting behind it. That is the same
	 *  last-write-wins rule the server applies, done early: sending both would be a
	 *  round trip whose result is discarded by the next one. */
	const work = createUnsyncedWork(account, storage);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let inFlight: Promise<void> | null = null;

	/** Told after every settle, so a screen reporting the work does not have to
	 *  guess when it changed. */
	const watchers = new Set<() => void>();

	/** The store this sync hydrated, so reconnecting can re-read as well as
	 *  re-send. Without it only half of coming back online happens: the local
	 *  writes go out and the other device's rows never come in. */
	let hydrated: RecordStore | null = null;

	let markSettled: () => void = () => {};
	const settled = new Promise<void>((resolve) => {
		markSettled = resolve;
	});

	function schedule() {
		if (timer !== null || work.sendable().length === 0) return;
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
		const batch = work.sendable();
		if (batch.length === 0) return;

		let delivered = false;
		inFlight = (async () => {
			try {
				const report = await transport.write(batch);
				delivered = true;
				// One call, because dropping what was delivered and marking what was
				// refused are the same accounting step over the same batch — and
				// splitting them is how a row ends up in neither state.
				work.settle(batch, report.rejected);
			} catch (error) {
				// Offline, or the server is down. The rows stay unsynced and the next
				// mutation — or `online` — retries them. Not thrown: nothing above
				// this is in a position to do anything about it, and the mutation it
				// belongs to committed locally a long time ago.
				console.warn('/api/state write deferred:', error);
			} finally {
				inFlight = null;
			}
			// Outside the `try`, and only for a request that landed: a watcher that
			// throws is a screen's bug, and reporting it as a deferred write would
			// blame the network for it and hide it behind a `console.warn`.
			if (delivered) for (const notify of watchers) notify();
		})();

		await inFlight;
		// Re-arm only after a request that actually landed, and only for an edit
		// that arrived while it was in flight. Re-arming after a *failure* is a
		// retry loop: the unsynced work is never empty after one, so an offline
		// device would send four requests a second for as long as it stayed
		// offline. A deferred write waits for the next mutation, or for `online`.
		if (delivered) schedule();
	}

	async function hydrate(store: RecordStore): Promise<void> {
		hydrated = store;
		try {
			applyRecord(store, await transport.read(), work.holds);
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

	// Work found in storage at construction is work a previous tab recorded and
	// never sent — the reload case #58 exists for. Nothing else would ever send
	// it: `push` is what arms the debounce, and after a reload the athlete may
	// simply read a screen and put the phone down. Scheduled rather than flushed
	// outright so it merges with whatever the first interaction writes, and so a
	// cold start does not race the hydrate for the same connection.
	schedule();

	return {
		push(writes) {
			work.add(writes);
			schedule();
		},
		hydrate,
		flush,
		settled: () => settled,
		unsynced: () => work.size(),
		sendable: () => work.sendable().length,
		refused: () => work.refused(),
		subscribe(notify) {
			watchers.add(notify);
			return () => void watchers.delete(notify);
		},
	};
}

/**
 * Write the server's answer into the collections.
 *
 * Three rules, and each one is a way the athlete's training could otherwise be
 * lost:
 *
 *   * **A row still waiting to be sent is left alone.** It is a change this device
 *     made and has not sent, so it is newer than anything the server can be
 *     holding for that key. Overwriting it would mean: tick a task offline,
 *     reconnect, and watch the tick revert. A row the server has *refused* is
 *     deliberately not held — see `unsynced.ts`.
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
	isHeld: (collection: string, key: string) => boolean,
): void {
	for (const [name, rows] of Object.entries(record.rows ?? {})) {
		const collection = sinkFor(store, name);
		if (!collection || !Array.isArray(rows)) continue;

		for (const row of rows) {
			try {
				const key = collection.getKeyFromItem(row);
				if (isHeld(name, String(key))) continue;
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
			if (isHeld(name, key)) continue;
			// Four collections key on a number and the wire carries strings, so the
			// string spelling has to be tried both ways round.
			const actual = collection.has(key) ? key : Number(key);
			if (!collection.has(actual)) continue;
			collection.delete(actual, { metadata: HYDRATED });
		}
	}
}

/** `RecordStore` is a fixed set of sixteen; anything else is a collection this
 *  build does not know about, and there is nowhere to put it. */
function sinkFor(store: RecordStore, name: string): RowSink | undefined {
	return (store as unknown as Record<string, RowSink | undefined>)[name];
}

/** The slice of a collection a hydrate uses. Named rather than reached for
 *  through `RecordStore`'s sixteen distinct generic instantiations, which have no
 *  common supertype to write down. */
interface RowSink {
	getKeyFromItem(row: unknown): string | number;
	has(key: string | number): boolean;
	update(
		key: string | number,
		config: { metadata: typeof HYDRATED },
		// The draft's type differs per collection, and this is the one place where
		// all sixteen are handled uniformly.
		// biome-ignore lint/suspicious/noExplicitAny: see above
		callback: (draft: any) => void,
	): unknown;
	insert(row: unknown, config: { metadata: typeof HYDRATED }): unknown;
	delete(key: string | number, config: { metadata: typeof HYDRATED }): unknown;
}
