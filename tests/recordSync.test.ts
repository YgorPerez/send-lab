// The client half of the write path: what the store sends, and what it does with
// what it gets back.
//
// The two assertions worth the file are that a hydrate does not echo the server's
// own rows back at it, and that a local row the server has never heard of
// survives one. Both are silent when they break — the app looks fine and the data
// is wrong a day later.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asAthleteId } from '../src/lib/ids.ts';
import type { UnsyncedWrite } from '../src/lib/recordWire.ts';
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
	// Every call, including the ones that threw. Counting only the successes is
	// what let a retry loop hide.
	let attempts = 0;
	const transport: Transport = {
		read: async () => ({ rows, deleted }),
		write: async (writes) => {
			attempts++;
			if (fail) throw new Error('offline');
			sent.push([...writes]);
			return { applied: writes.length, stale: 0, rejected: [] };
		},
	};
	return {
		transport,
		sent,
		attempts: () => attempts,
		setFailing: (v: boolean) => {
			fail = v;
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
		const sync = createRecordSync(fake.transport);
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
		const sync = createRecordSync(fake.transport);
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
		const sync = createRecordSync(fake.transport);
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
		const sync = createRecordSync(fake.transport);
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
		const sync = createRecordSync(fake.transport);
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
		const sync = createRecordSync(fake.transport);
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
		const sync = createRecordSync(fake.transport);
		const store: RecordStore = createRecordStore(ACCOUNT, sync.push, memory());
		return { fake, sync, store };
	}

	it('writes the account into the collections', async () => {
		const { sync, store } = hydrating({
			taskDone: [{ task: 'w1-Thu:pinch', done: true }],
			prefs: [{ id: 'only', weight: 'kg', length: 'mm', notify: false, locale: 'pt-BR' }],
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
		const sync = createRecordSync(fake.transport);
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
		const sync = createRecordSync(fake.transport);
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
		const sync = createRecordSync(fake.transport);
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
