// Unsynced work that outlives the tab — #58.
//
// The module under test is where a write waits between "the athlete made it" and
// "the server has it". Everything here is a way that wait can go wrong silently,
// which is why this file exists at all: none of these failures show up on screen.
// The app looks correct in every one of them and the training is gone a day later.
//
// The names follow `CONTEXT.md`'s **Unsynced work**, whose `_Avoid_` list rules
// out *pending*, *queued*, *unsaved* and *outbox* — including in the ticket's own
// title. The same entry also decides the shape this module has: *"work that can
// never be sent is unsynced work in its final state, not a separate thing"*, so a
// refusal is a state an entry carries, not a second store beside it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asAthleteId } from '../src/lib/ids.ts';
import type { UnsyncedWrite } from '../src/lib/recordWire.ts';
import { createUnsyncedWork, UNSYNCED_KEY } from '../src/lib/store/unsynced.ts';

const ONE = asAthleteId('athlete-1');
const TWO = asAthleteId('athlete-2');
const T1 = 1_755_000_000_000;

/** A `StorageApi` a test can inspect and hand to a second instance, which is how
 *  "survives a reload" is expressed without a browser. */
function memory() {
	const cells = new Map<string, string>();
	return {
		getItem: (k: string) => cells.get(k) ?? null,
		setItem: (k: string, v: string) => void cells.set(k, v),
		removeItem: (k: string) => void cells.delete(k),
		cells,
	};
}

const write = (
	collection: string,
	key: string,
	row: unknown = { v: 1 },
	at = T1,
): UnsyncedWrite => ({
	collection,
	key,
	row,
	at,
});

/** What `sendable()` returned, as `collection/key` strings — the assertions are
 *  about identity and order, and the rows themselves are noise in a diff. */
const ids = (writes: readonly UnsyncedWrite[]) => writes.map((w) => `${w.collection}/${w.key}`);

describe('what the athlete has recorded and the server has not', () => {
	it('hands writes back in the order they were made', () => {
		const work = createUnsyncedWork(ONE, memory());
		work.add([write('sessions', 'a')]);
		work.add([write('taskDone', 'b')]);
		work.add([write('prefs', 'c')]);

		// FIFO, because replay order is the only thing that makes a sequence of
		// edits to one account reconstructible on the server.
		expect(ids(work.sendable())).toEqual(['sessions/a', 'taskDone/b', 'prefs/c']);
	});

	it('replaces a second edit of one row in place rather than appending it', () => {
		const work = createUnsyncedWork(ONE, memory());
		work.add([write('sessions', 'a', { v: 1 })]);
		work.add([write('taskDone', 'b')]);
		work.add([write('sessions', 'a', { v: 2 }, T1 + 1000)]);

		// Two round trips whose first result the second discards is a round trip
		// spent to learn nothing — the same last-write-wins the server applies,
		// applied early. Position is held: the athlete's *first* edit is where this
		// row entered the sequence, and re-ordering it would reorder the account's
		// history against a device that saw both.
		expect(ids(work.sendable())).toEqual(['sessions/a', 'taskDone/b']);
		expect(work.sendable()[0].row).toEqual({ v: 2 });
		expect(work.sendable()[0].at).toBe(T1 + 1000);
	});

	it('counts a deletion as work like any other', () => {
		const work = createUnsyncedWork(ONE, memory());
		work.add([write('sessions', 'a', null)]);

		// A `row` of `null` is a deletion. If this were filtered out as "nothing to
		// send", deleting a session offline would never reach the second device.
		expect(work.size()).toBe(1);
		expect(work.sendable()[0].row).toBeNull();
	});
});

describe('surviving the tab', () => {
	it('is still there when a second instance opens the same storage', () => {
		const cells = memory();
		const before = createUnsyncedWork(ONE, cells);
		before.add([write('sessions', 'a'), write('taskDone', 'b')]);

		// The reload. The in-memory half of the old sync is exactly what #57 left
		// unsolved: the row survived in `localStorage` as part of its collection,
		// but *the fact that it had not been sent* did not, so the write sat there
		// until something else happened to touch the same row.
		const after = createUnsyncedWork(ONE, cells);
		expect(ids(after.sendable())).toEqual(['sessions/a', 'taskDone/b']);
	});

	it('keeps two athletes on one device apart', () => {
		const cells = memory();
		const mine = createUnsyncedWork(ONE, cells);
		mine.add([write('sessions', 'a')]);

		const yours = createUnsyncedWork(TWO, cells);
		yours.add([write('sessions', 'b')]);

		// One shared `localStorage`, two accounts, and neither may replay the
		// other's writes into their own record. The account is in the key, which is
		// the same rule that keeps the fifteen collections apart (#56).
		expect(ids(mine.sendable())).toEqual(['sessions/a']);
		expect(ids(yours.sendable())).toEqual(['sessions/b']);
		expect(cells.getItem(UNSYNCED_KEY(ONE))).not.toBe(null);
		expect(cells.getItem(UNSYNCED_KEY(TWO))).not.toBe(null);
	});

	it('starts empty rather than throwing when storage holds nonsense', () => {
		const cells = memory();
		cells.setItem(UNSYNCED_KEY(ONE), '{ not json');
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const work = createUnsyncedWork(ONE, cells);

		// Unreadable storage must not stop the app from starting — but it must not
		// be silent either, because what was just lost is training the athlete
		// recorded.
		expect(work.sendable()).toEqual([]);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('runs in memory when there is no storage at all', () => {
		// jsdom under Vitest, and Safari with storage denied. A degradation, not a
		// crash: the work lives as long as the tab does.
		const work = createUnsyncedWork(ONE, undefined);
		work.add([write('sessions', 'a')]);
		expect(ids(work.sendable())).toEqual(['sessions/a']);
	});
});

describe('a write the server will never accept', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('does not stall the writes behind it', () => {
		const work = createUnsyncedWork(ONE, memory());
		work.add([write('sessions', 'bad'), write('taskDone', 'good')]);

		const sent = work.sendable();
		work.settle(sent, [{ collection: 'sessions', key: 'bad', reason: 'unknown collection' }]);

		// The whole reason this state exists. Replay is in order, so a write the
		// server refuses on every attempt would otherwise be retried forever with
		// every later write stuck behind it — and the athlete would be told
		// nothing, because a refusal is a 200.
		expect(ids(work.sendable())).toEqual([]);
		expect(work.refused().map((r) => r.write.key)).toEqual(['bad']);
	});

	it('is still unsynced work, and still counted', () => {
		const work = createUnsyncedWork(ONE, memory());
		work.add([write('sessions', 'bad')]);
		work.settle(work.sendable(), [
			{ collection: 'sessions', key: 'bad', reason: 'unknown collection' },
		]);

		// `CONTEXT.md`: work that can never be sent is unsynced work *in its final
		// state*, not a separate thing. So it leaves `sendable()` and stays in
		// `size()` — an indicator that dropped it would tell the athlete their
		// training reached the server when it never will.
		expect(work.sendable()).toEqual([]);
		expect(work.size()).toBe(1);
	});

	it('survives a reload, so the athlete can still be told', () => {
		const cells = memory();
		const before = createUnsyncedWork(ONE, cells);
		before.add([write('sessions', 'bad')]);
		before.settle(before.sendable(), [
			{ collection: 'sessions', key: 'bad', reason: 'unknown collection' },
		]);

		const after = createUnsyncedWork(ONE, cells);
		expect(after.refused().map((r) => r.write.key)).toEqual(['bad']);
		expect(after.refused()[0].reason).toBe('unknown collection');
	});

	it('is retried when the athlete edits that row again', () => {
		const work = createUnsyncedWork(ONE, memory());
		work.add([write('sessions', 'a', { v: 1 })]);
		work.settle(work.sendable(), [{ collection: 'sessions', key: 'a', reason: 'bad shape' }]);
		expect(work.sendable()).toEqual([]);

		work.add([write('sessions', 'a', { v: 2 }, T1 + 1000)]);

		// A refusal is a fact about the row that was sent, not a ban on the key.
		// The athlete has since changed it, and refusing to try the new content
		// would strand every later edit of that row on this device forever.
		expect(ids(work.sendable())).toEqual(['sessions/a']);
		expect(work.refused()).toEqual([]);
	});

	it('does not shield the row from a hydrate any more', () => {
		const work = createUnsyncedWork(ONE, memory());
		work.add([write('sessions', 'a')]);
		expect(work.holds('sessions', 'a')).toBe(true);

		work.settle(work.sendable(), [{ collection: 'sessions', key: 'a', reason: 'bad shape' }]);

		// While a write is waiting, the local row is newer than anything the server
		// can hold and a hydrate must not overwrite it. Once the server has refused
		// it, that stops being true: the row can never be sent, so the server's copy
		// is the only one that will ever be real, and continuing to shield it would
		// pin a row this device can never reconcile.
		expect(work.holds('sessions', 'a')).toBe(false);
	});
});

describe('what a delivered batch clears', () => {
	it('drops exactly the writes that were sent', () => {
		const work = createUnsyncedWork(ONE, memory());
		work.add([write('sessions', 'a'), write('taskDone', 'b')]);
		const sent = work.sendable();

		work.settle(sent, []);

		expect(work.sendable()).toEqual([]);
		expect(work.size()).toBe(0);
	});

	it('keeps an edit made while the batch was in flight', () => {
		const work = createUnsyncedWork(ONE, memory());
		work.add([write('sessions', 'a', { v: 1 })]);
		const sent = work.sendable();

		// The athlete ticks the same task again before the PUT comes back.
		work.add([write('sessions', 'a', { v: 2 }, T1 + 1000)]);
		work.settle(sent, []);

		// Clearing by key would drop this: the server acknowledged `v: 1`, and
		// `v: 2` has never been sent. The first cut of the in-memory version got
		// this right and it is the assertion most easily lost in a rewrite.
		expect(ids(work.sendable())).toEqual(['sessions/a']);
		expect(work.sendable()[0].row).toEqual({ v: 2 });
	});

	it('persists the clear, so a reload does not resend delivered work', () => {
		const cells = memory();
		const before = createUnsyncedWork(ONE, cells);
		before.add([write('sessions', 'a')]);
		before.settle(before.sendable(), []);

		const after = createUnsyncedWork(ONE, cells);
		expect(after.sendable()).toEqual([]);
	});
});
