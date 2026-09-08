// The client half of the write path: what the store sends, and what it does with
// what it gets back.
//
// The two assertions worth the file are that a hydrate does not echo the server's
// own rows back at it, and that a local row the server has never heard of
// survives one. Both are silent when they break — the app looks fine and the data
// is wrong a day later.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asAthleteId, asExerciseId, asWeekdayKey, asWeekId, taskKey } from '../src/lib/ids.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import type { UnsyncedWrite, WriteRejection } from '../src/lib/recordWire.ts';
import { createRecordStore, type RecordStore } from '../src/lib/store/collections.ts';
import { createRecordSync, type Transport } from '../src/lib/store/sync.ts';

const ACCOUNT = asAthleteId('athlete-1');
const T1 = 1_755_000_000_000;

function memory() {
	const cells = new Map<string, string>();
	return {
		getItem: (k: string) => cells.get(k) ?? null,
		setItem: (k: string, v: string) => void cells.set(k, v),
		removeItem: (k: string) => void cells.delete(k),
	};
}

/** A transport that records what it was asked to do and answers whatever the test
 *  set up. `fail` makes `write` throw, which is what offline looks like here. */
function fakeTransport(
	rows: Record<string, unknown[]> = {},
	deleted: Record<string, string[]> = {},
) {
	const sent: UnsyncedWrite[][] = [];
	let fail = false;
	let rejected: WriteRejection[] = [];
	// Every call, including the ones that threw. Counting only the successes is
	// what let a retry loop hide.
	let attempts = 0;
	const transport: Transport = {
		read: async () => ({ rows, deleted }),
		write: async (writes) => {
			attempts++;
			if (fail) throw new Error('offline');
			sent.push([...writes]);
			const report = { applied: writes.length, stale: 0, rejected };
			rejected = [];
			return report;
		},
	};
	return {
		transport,
		sent,
		attempts: () => attempts,
		setFailing: (v: boolean) => {
			fail = v;
		},
		/** Answer the next batch with a refusal — a 200 that names rows the server
		 *  will not store. Not the same as `setFailing`, and the difference is the
		 *  whole of #58's terminal state: a refusal cannot be retried into success. */
		reject: (rows: WriteRejection[]) => {
			rejected = rows;
		},
	};
}

/** Let the debounce fire and every handler settle. */
const settle = () => vi.advanceTimersByTimeAsync(500);

/** The rows a collection holds, without the library's virtual props.
 *
 *  `toArray` decorates every row with `$key`, `$synced`, `$origin` and
 *  `$collectionId` — `store/record.ts` documents them — so a bare `toEqual`
 *  against the row that went in can never match. */
function rowsOf(collection: { toArray: readonly object[] }): object[] {
	return collection.toArray.map((row) =>
		Object.fromEntries(Object.entries(row).filter(([field]) => !field.startsWith('$'))),
	);
}

beforeEach(() => {
	vi.useFakeTimers();

	// jsdom hands back a `localStorage` whose `getItem` is not a function. The
	// collections already survive that — `storageOverride()` probes for
	// callability and falls back to memory — but TanStack DB's own `debugLog`
	// reads `localStorage` directly whenever it builds a change proxy, so
	// `collection.update()` throws before any of that runs. The library is fine in
	// a browser; it is this environment that is missing a working Storage, so this
	// file supplies one. Deliberately not global: `screens.test.ts` depends on
	// jsdom's broken one to keep the readiness draft out of its assertions.
	const cells = new Map<string, string>();
	const shim: Storage = {
		getItem: (k) => cells.get(k) ?? null,
		setItem: (k, v) => void cells.set(k, String(v)),
		removeItem: (k) => void cells.delete(k),
		clear: () => cells.clear(),
		key: (i) => [...cells.keys()][i] ?? null,
		get length() {
			return cells.size;
		},
	};
	const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
	Object.defineProperty(window, 'localStorage', { value: shim, configurable: true });

	return () => {
		vi.useRealTimers();
		if (original) Object.defineProperty(window, 'localStorage', original);
	};
});

describe('what the store sends', () => {
	it('batches a burst of mutations into one request', async () => {
		const fake = fakeTransport();
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store = createRecordStore(ACCOUNT, sync.push, memory());

		store.taskDone.insert({ task: 'a', done: true } as never);
		store.taskDone.insert({ task: 'b', done: true } as never);
		store.bodyweight.insert({ at: T1, kg: 71 } as never);
		await settle();

		expect(fake.sent).toHaveLength(1);
		expect(fake.sent[0]).toHaveLength(3);
		expect(sync.unsynced()).toBe(0);
	});

	it('sends one row per key, not one per edit', async () => {
		const fake = fakeTransport();
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store = createRecordStore(ACCOUNT, sync.push, memory());

		store.taskDone.insert({ task: 'a', done: true } as never);
		store.taskDone.update('a', (draft: { done: boolean }) => {
			draft.done = false;
		});
		await settle();

		expect(fake.sent[0]).toHaveLength(1);
		expect((fake.sent[0]?.[0]?.row as { done: boolean }).done).toBe(false);
	});

	it('spells a delete as a write of null', async () => {
		const fake = fakeTransport();
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store = createRecordStore(ACCOUNT, sync.push, memory());

		store.taskDone.insert({ task: 'a', done: true } as never);
		await settle();
		store.taskDone.delete('a');
		await settle();

		expect(fake.sent[1]?.[0]).toMatchObject({ collection: 'taskDone', key: 'a', row: null });
	});
});

describe('a write the network refused', () => {
	it('stays queued, and is counted as unsynced work', async () => {
		const fake = fakeTransport();
		fake.setFailing(true);
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store = createRecordStore(ACCOUNT, sync.push, memory());

		store.taskDone.insert({ task: 'a', done: true } as never);
		await settle();

		expect(fake.sent).toHaveLength(0);
		expect(sync.unsynced()).toBe(1);
		// And the local write went through regardless — this is the whole reason
		// the handler does not await the network.
		expect(store.taskDone.toArray).toHaveLength(1);
	});

	it('does not retry in a loop while the network is down', async () => {
		// `flush()` used to re-arm the debounce unconditionally, and after a failure
		// the queue is never empty — so an offline device sent four requests a
		// second, indefinitely. A deferred write waits for something to happen.
		const fake = fakeTransport();
		fake.setFailing(true);
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store = createRecordStore(ACCOUNT, sync.push, memory());

		store.taskDone.insert({ task: 'a', done: true } as never);
		await settle();
		await vi.advanceTimersByTimeAsync(30_000);

		expect(fake.attempts()).toBe(1);
		expect(sync.unsynced()).toBe(1);
	});

	it('goes out on the next flush once the network is back', async () => {
		const fake = fakeTransport();
		fake.setFailing(true);
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store = createRecordStore(ACCOUNT, sync.push, memory());

		store.taskDone.insert({ task: 'a', done: true } as never);
		await settle();
		fake.setFailing(false);
		await sync.flush();

		expect(fake.sent[0]).toHaveLength(1);
		expect(sync.unsynced()).toBe(0);
	});
});

describe('hydrating from the server', () => {
	/** A store wired to a sync whose `read` answers `record`. */
	function hydrating(rows: Record<string, unknown[]>, deleted: Record<string, string[]> = {}) {
		const fake = fakeTransport(rows, deleted);
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store: RecordStore = createRecordStore(ACCOUNT, sync.push, memory());
		return { fake, sync, store };
	}

	it('writes the account into the collections', async () => {
		const { sync, store } = hydrating({
			taskDone: [{ task: 'w1-Thu:pinch', done: true }],
			prefs: [
				{
					id: 'only',
					weight: 'kg',
					length: 'mm',
					cueNotices: false,
					dailyNotice: false,
					timeZone: null,
					locale: 'pt-BR',
				},
			],
		});

		await sync.hydrate(store);

		expect(rowsOf(store.taskDone)).toEqual([{ task: 'w1-Thu:pinch', done: true }]);
		expect(store.prefs.toArray[0]?.locale).toBe('pt-BR');
	});

	it('does not send the server its own rows straight back', async () => {
		// Without the `HYDRATED` marker every hydrated row is echoed with `at =
		// now`, which is newer than what the server holds — so an edit made on
		// another device five minutes ago would lose to this device merely opening
		// the app.
		const { fake, sync, store } = hydrating({
			taskDone: [{ task: 'w1-Thu:pinch', done: true }],
		});

		await sync.hydrate(store);
		await settle();

		expect(fake.sent).toEqual([]);
		expect(sync.unsynced()).toBe(0);
	});

	it('overwrites a local row that has already synced', async () => {
		// The row went out and was acknowledged, so whatever the server says about
		// that key now is the merge result — including another device's edit.
		const { sync, store } = hydrating({ taskDone: [{ task: 'a', done: false }] });
		store.taskDone.insert({ task: 'a', done: true } as never);
		await settle();
		expect(sync.unsynced()).toBe(0);

		await sync.hydrate(store);

		expect(rowsOf(store.taskDone)).toEqual([{ task: 'a', done: false }]);
	});

	it('leaves a local row that has NOT synced yet', async () => {
		// The one that matters. Tick a task in a basement, reconnect, and the
		// hydrate arrives holding the server's older answer for that key — the row
		// is still pending, so it is newer by construction and must survive. The
		// first cut of this module overwrote it, and the test above was the only
		// one covering the case: it passed because the write had already flushed.
		const fake = fakeTransport({ taskDone: [{ task: 'a', done: false }] });
		fake.setFailing(true);
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store = createRecordStore(ACCOUNT, sync.push, memory());

		store.taskDone.insert({ task: 'a', done: true } as never);
		await settle();
		expect(sync.unsynced()).toBe(1);

		await sync.hydrate(store);

		expect(rowsOf(store.taskDone)).toEqual([{ task: 'a', done: true }]);
		// And it is still owed to the server.
		expect(sync.unsynced()).toBe(1);
	});

	it('deletes a row the server reports as deleted', async () => {
		// Absence cannot mean deletion — it is far more often an unsynced write —
		// so a tombstone is the only way a delete made on another device ever
		// reaches this one.
		const { sync, store } = hydrating({ taskDone: [] }, { taskDone: ['a'] });
		store.taskDone.insert({ task: 'a', done: true } as never);
		await settle();

		await sync.hydrate(store);

		expect(rowsOf(store.taskDone)).toEqual([]);
	});

	it('does not re-apply a tombstone for a row since re-created here', async () => {
		const fake = fakeTransport({ taskDone: [] }, { taskDone: ['a'] });
		fake.setFailing(true);
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store = createRecordStore(ACCOUNT, sync.push, memory());

		store.taskDone.insert({ task: 'a', done: true } as never);
		await settle();

		await sync.hydrate(store);

		expect(rowsOf(store.taskDone)).toEqual([{ task: 'a', done: true }]);
	});

	it('does not send the deletions it just applied back to the server', async () => {
		const { fake, sync, store } = hydrating({ taskDone: [] }, { taskDone: ['a'] });
		store.taskDone.insert({ task: 'a', done: true } as never);
		await settle();
		fake.sent.length = 0;

		await sync.hydrate(store);
		await settle();

		expect(fake.sent).toEqual([]);
	});

	it('settles once a hydrate has been attempted, even a failed one', async () => {
		// What `chooseLocale` waits on before it will invent a preferences row.
		const fake = fakeTransport();
		fake.setFailing(true);
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store = createRecordStore(ACCOUNT, sync.push, memory());

		let settledYet = false;
		void sync.settled().then(() => {
			settledYet = true;
		});
		await Promise.resolve();
		expect(settledYet).toBe(false);

		await sync.hydrate(store);
		await Promise.resolve();
		expect(settledYet).toBe(true);
	});

	it('leaves a local row the server has never heard of', async () => {
		// The plane case. A row missing from the server's answer is far more likely
		// to be a write that has not synced than a deletion — and a deletion arrives
		// as a tombstone, which is an absence from the response either way. Deleting
		// on absence would mean landing, opening the app, and watching the session
		// disappear.
		const { sync, store } = hydrating({ taskDone: [] });
		store.taskDone.insert({ task: 'logged-offline', done: true } as never);
		await settle();

		await sync.hydrate(store);

		expect(rowsOf(store.taskDone)).toEqual([{ task: 'logged-offline', done: true }]);
	});

	it('ignores a collection it does not have', async () => {
		const { sync, store } = hydrating({ workouts: [{ at: '2026-08-20' }] });
		await expect(sync.hydrate(store)).resolves.toBeUndefined();
		expect(rowsOf(store.sessions)).toEqual([]);
	});
});

describe('a store with nowhere to push', () => {
	it('persists locally and sends nothing', async () => {
		// The signed-out store: real, and syncing nowhere.
		const store = createRecordStore(null, undefined, memory());
		store.taskDone.insert({ task: 'a', done: true } as never);
		await settle();
		expect(store.taskDone.toArray).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// #24's named assertions, at the level a jsdom suite can reach them. The fifth —
// "survives a real reload" — needs a service worker and a real navigation and is
// the browser tier's; what stands in for it here is a second sync built over the
// same storage, which is the same question asked of this module rather than of
// the browser.

describe('a write made with the network down', () => {
	it('survives the tab and reaches the server on the next start', async () => {
		const cells = memory();
		const first = fakeTransport();
		first.setFailing(true);

		const sync = createRecordSync(ACCOUNT, first.transport, cells);
		const store = createRecordStore(ACCOUNT, sync.push, memory());
		store.taskDone.insert({ task: 'w1-Thu:pull', done: true } as never);
		await settle();

		// Offline: the write was attempted and did not land.
		expect(first.attempts()).toBe(1);
		expect(first.sent).toEqual([]);
		expect(sync.unsynced()).toBe(1);

		// The reload. A new sync over the same storage — the old one's memory is
		// gone, which is exactly what used to lose the write.
		const second = fakeTransport();
		const revived = createRecordSync(ACCOUNT, second.transport, cells);
		await settle();

		expect(second.sent).toHaveLength(1);
		expect(second.sent[0][0].collection).toBe('taskDone');
		expect(second.sent[0][0].key).toBe('w1-Thu:pull');
		expect(revived.unsynced()).toBe(0);
	});

	it('is not resent by a reload once it has landed', async () => {
		const cells = memory();
		const first = fakeTransport();
		const sync = createRecordSync(ACCOUNT, first.transport, cells);
		const store = createRecordStore(ACCOUNT, sync.push, memory());
		store.taskDone.insert({ task: 'w1-Thu:pull', done: true } as never);
		await settle();
		expect(first.sent).toHaveLength(1);

		const second = fakeTransport();
		createRecordSync(ACCOUNT, second.transport, cells);
		await settle();

		// A durable record of unsent work is only half the job: one that never
		// cleared would replay the athlete's whole history on every launch.
		expect(second.sent).toEqual([]);
	});
});

describe('a write the server refuses', () => {
	it('does not stall the writes behind it, and stays counted', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const cells = memory();
		const fake = fakeTransport();
		const sync = createRecordSync(ACCOUNT, fake.transport, cells);

		sync.push([
			{ collection: 'sessions', key: 'bad', row: { at: 'x' }, at: T1 },
			{ collection: 'taskDone', key: 'good', row: { task: 'good', done: true }, at: T1 },
		]);
		fake.reject([{ collection: 'sessions', key: 'bad', reason: 'unknown collection' }]);
		await settle();

		// The refusal is terminal, so it leaves the replay — otherwise FIFO would
		// retry it forever with `good` stuck behind it, and a refusal arrives as a
		// 200, so nothing would ever say so.
		sync.push([{ collection: 'prefs', key: 'only', row: { weight: 'kg' }, at: T1 + 1 }]);
		await settle();
		expect(fake.sent.at(-1)?.map((w) => w.key)).toEqual(['only']);

		// But it is still unsynced work — in its final state, per `CONTEXT.md` —
		// and a second start still knows it, so the athlete can still be told.
		expect(sync.refused().map((r) => r.reason)).toEqual(['unknown collection']);
		expect(createRecordSync(ACCOUNT, fakeTransport().transport, cells).refused()).toHaveLength(1);
		error.mockRestore();
	});

	it('is not something a sign-out can wait for', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const fake = fakeTransport();
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());

		sync.push([{ collection: 'sessions', key: 'bad', row: { at: 'x' }, at: T1 }]);
		fake.reject([{ collection: 'sessions', key: 'bad', reason: 'unknown collection' }]);
		await settle();

		// The distinction #82 turns on. A refusal stays counted as unsynced work,
		// so a sign-out gated on `unsynced()` is held on this device forever — a
		// flush cannot clear a row the server has already declined. `sendable()` is
		// the half that a flush can still empty, and the only half worth waiting on.
		expect(sync.unsynced()).toBe(1);
		expect(sync.sendable()).toBe(0);
		await sync.flush();
		expect(sync.sendable()).toBe(0);
		error.mockRestore();
	});

	it('tells a watching screen the moment it lands', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const fake = fakeTransport();
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());

		// What Settings holds. Read once at mount it would still say `false` here:
		// this flush is the debounce's, fired by a write the screen did not make.
		const seen: boolean[] = [];
		const stop = sync.subscribe(() => seen.push(sync.refused().length > 0));

		sync.push([{ collection: 'sessions', key: 'bad', row: { at: 'x' }, at: T1 }]);
		fake.reject([{ collection: 'sessions', key: 'bad', reason: 'unknown collection' }]);
		await settle();
		// Two notifications, not one. The push is a change to the work as much as
		// the settle is, so the first says "a row is waiting, nothing refused yet"
		// and the second says what became of it. #83 widened this; the test below
		// is why.
		expect(seen).toEqual([false, true]);

		stop();
		sync.push([{ collection: 'prefs', key: 'only', row: { weight: 'kg' }, at: T1 + 1 }]);
		await settle();
		expect(seen).toEqual([false, true]);
		error.mockRestore();
	});

	// #83. The strip says "Saving…" while work is waiting, and work starts
	// waiting at the *push* — a sync that only spoke after a settle would leave
	// the athlete's device silent for the whole window that matters most: the
	// 250ms debounce, and then indefinitely while there is no signal to settle
	// against. A settle-only contract is not a smaller version of this; offline
	// it never fires at all.
	it('reports a change when a write is queued, not only when a batch settles', async () => {
		const fake = fakeTransport();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		fake.setFailing(true);
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());

		const seen: number[] = [];
		const stop = sync.subscribe(() => seen.push(sync.sendable()));

		sync.push([{ collection: 'taskDone', key: 'w1-Thu:pull', row: { done: true }, at: T1 }]);
		// Before the debounce has even been given a chance to fire.
		expect(seen).toEqual([1]);

		// The flush lands on no network. The work is unchanged and still waiting,
		// so there is nothing new to say.
		await settle();
		expect(seen).toEqual([1]);

		// And the settle still reports itself, which is the half #82 added.
		fake.setFailing(false);
		await sync.flush();
		expect(seen).toEqual([1, 0]);

		stop();
		warn.mockRestore();
	});

	// A watcher is a screen's callback, and `push` runs inside the collection's
	// write handler — which TanStack DB awaits before it persists, and rolls the
	// mutation back if it rejects. So a throw here would un-tick the task the
	// athlete just ticked. It is contained and reported instead.
	it('does not let a throwing watcher roll back the write that woke it', () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const sync = createRecordSync(ACCOUNT, fakeTransport().transport, memory());

		sync.subscribe(() => {
			throw new Error('a screen bug');
		});
		const seen: number[] = [];
		sync.subscribe(() => seen.push(sync.sendable()));

		expect(() =>
			sync.push([{ collection: 'taskDone', key: 'w1-Thu:pull', row: { done: true }, at: T1 }]),
		).not.toThrow();
		// And the watcher behind it still hears about it.
		expect(seen).toEqual([1]);
		expect(error).toHaveBeenCalled();
		error.mockRestore();
	});

	it('does not hide the work still worth sending behind it', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const fake = fakeTransport();
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());

		sync.push([{ collection: 'sessions', key: 'bad', row: { at: 'x' }, at: T1 }]);
		fake.reject([{ collection: 'sessions', key: 'bad', reason: 'unknown collection' }]);
		await settle();

		// A second write, this time with nobody to send it to: the sign-out must
		// still be held, because this one is still going to reach the server.
		fake.setFailing(true);
		sync.push([{ collection: 'taskDone', key: 'good', row: { done: true }, at: T1 + 1 }]);
		await settle();

		expect(sync.unsynced()).toBe(2);
		expect(sync.sendable()).toBe(1);
		error.mockRestore();
	});
});

describe('signing out', () => {
	it('leaves the unsynced work where it is', async () => {
		const cells = memory();
		const fake = fakeTransport();
		fake.setFailing(true);
		const sync = createRecordSync(ACCOUNT, fake.transport, cells);
		sync.push([{ collection: 'taskDone', key: 'w1-Thu:pull', row: { done: true }, at: T1 }]);
		await settle();
		expect(sync.unsynced()).toBe(1);

		// #24: expiry never clears the store or the unsynced work — only an
		// explicit online sign-out, and only after it drains. A session going
		// stale on a phone in a basement is not the athlete asking to forget
		// anything, and clearing on it would delete training that exists nowhere
		// else. Nothing in this module is reachable from session expiry at all,
		// which is how that is guaranteed rather than remembered: the work is keyed
		// by account and outlives every sync built over it.
		const afterExpiry = createRecordSync(ACCOUNT, fakeTransport().transport, cells);
		expect(afterExpiry.unsynced()).toBe(1);
	});

	it('does not let a second athlete replay the first one\u2019s writes', async () => {
		const cells = memory();
		const mine = fakeTransport();
		mine.setFailing(true);
		const sync = createRecordSync(ACCOUNT, mine.transport, cells);
		sync.push([{ collection: 'sessions', key: 'mine', row: { at: 'x' }, at: T1 }]);
		await settle();

		// One device, one `localStorage`, the other athlete signs in.
		const theirs = fakeTransport();
		const other = createRecordSync(asAthleteId('athlete-2'), theirs.transport, cells);
		await settle();

		expect(other.unsynced()).toBe(0);
		expect(theirs.sent).toEqual([]);
	});
});

const MINE = '2026-08-20T10:00:00.000Z';
const THEIRS = '2026-08-21T10:00:00.000Z';

describe('two devices that diverged, in pt-BR', () => {
	// The recurring trap, and why this whole block runs in pt-BR: the English
	// weekday labels are byte-identical to the stable keys (`Mon`, `Thu`), so a
	// key accidentally built from a *label* passes every en-US assertion. Under
	// pt-BR the label is `Qui` and the key is still `Thu`, and only then does the
	// bug show. ADR 0003; `CONTEXT.md` opens with it.
	beforeEach(() => {
		overwriteGetLocale(() => 'pt-BR');
		return () => overwriteGetLocale(() => 'en-US');
	});

	it('keeps both entries when each device appended its own', async () => {
		// The server knows only about the *other* device's session; this device's
		// is still unsynced, which is what makes the two genuinely divergent
		// rather than one being a subset of the other.
		const fake = fakeTransport({ sessions: [{ at: THEIRS, exercises: [] }] });
		fake.setFailing(true);
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store = createRecordStore(ACCOUNT, sync.push, memory());

		store.sessions.insert({ at: MINE, exercises: [] } as never);
		await settle();
		expect(sync.unsynced()).toBe(1);

		await sync.hydrate(store);

		// The property the whole merge rule rests on. Collections are keyed by
		// entry id, so two devices appending produce two keys and there is nothing
		// to resolve — the genuine conflicts all reduce to a single key. Asserted
		// rather than believed: losing a session is silent, and this rule is what
		// the offline design was bought with.
		expect(
			rowsOf(store.sessions)
				.map((r) => (r as { at: string }).at)
				.sort(),
		).toEqual([MINE, THEIRS].sort());
	});

	it('builds a task key from ids, not from the localized weekday', async () => {
		const fake = fakeTransport();
		const sync = createRecordSync(ACCOUNT, fake.transport, memory());
		const store = createRecordStore(ACCOUNT, sync.push, memory());

		const key = taskKey(asWeekId(1), asWeekdayKey('Thu'), asExerciseId('pull'));
		store.taskDone.insert({ task: key, done: true } as never);
		await settle();

		// Under pt-BR the athlete sees `Qui`. What crosses the wire, and what the
		// other device will match on, must still be `Thu` — a key that moved with
		// the locale would file the same tick under two rows and lose one of them
		// on every language switch.
		expect(fake.sent[0][0].key).toBe('w1-Thu:pull');
		expect(fake.sent[0][0].key).not.toContain('Qui');
	});
});
