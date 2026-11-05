// The write half of saved protocols (#103): a duplicate is a new row with its
// own id, a delete removes exactly the row it names, and both outlive the tab.
//
// Run against the app's own store over a `localStorage` stand-in, so "after a
// reload" is a second store built over the same storage — the question asked of
// the store rather than of the browser, as `recordSync.test.ts` does.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecordStore } from '../src/lib/store/collections.ts';
import { readTrainingRecord, recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { deleteSavedProtocol, duplicateProtocol } from '../src/lib/store/savedProtocols.ts';

const REPEATERS = { prepare: 10, work: 7, rest: 3, rounds: 6, sets: 4, setRest: 180 };
const T0 = 1_755_000_000_000;

let original: PropertyDescriptor | undefined;

beforeEach(() => {
	// TanStack DB's change proxy reads `localStorage`, and jsdom's is not callable
	// — see `recordSync.test.ts` for the full note.
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
	original = Object.getOwnPropertyDescriptor(window, 'localStorage');
	Object.defineProperty(window, 'localStorage', { value: shim, configurable: true });
	resetRecordStore();
});

afterEach(() => {
	if (original) Object.defineProperty(window, 'localStorage', original);
	resetRecordStore();
});

const saved = () => readTrainingRecord(recordStore()).savedProtocols;

describe('duplicating a protocol', () => {
	it('keeps a copy under the name it is given, with the numbers of its source', async () => {
		const copy = await duplicateProtocol({ name: 'Copy of Repeaters', protocol: REPEATERS }, T0);

		expect(saved()).toMatchObject([copy]);
		expect(saved()).toHaveLength(1);
		expect(copy).toMatchObject({ name: 'Copy of Repeaters', protocol: REPEATERS, createdAt: T0 });
	});

	it('gives every copy its own id, even of the same source', async () => {
		const a = await duplicateProtocol({ name: 'Warm-up', protocol: REPEATERS }, T0);
		const b = await duplicateProtocol({ name: 'Warm-up', protocol: REPEATERS }, T0 + 1);

		expect(a.id).not.toBe(b.id);
		expect(saved().map((p) => p.id)).toEqual([a.id, b.id]);
	});

	it('copies the numbers rather than sharing them with the source', async () => {
		const source = { name: 'Repeaters', protocol: { ...REPEATERS } };
		const copy = await duplicateProtocol(source, T0);
		source.protocol.work = 99;

		expect(saved()[0].protocol.work).toBe(7);
		expect(copy.protocol.work).toBe(7);
	});

	it('lists copies in the order they were made, not the order they arrived', async () => {
		const later = await duplicateProtocol({ name: 'Later', protocol: REPEATERS }, T0 + 5);
		const earlier = await duplicateProtocol({ name: 'Earlier', protocol: REPEATERS }, T0);

		expect(saved().map((p) => p.id)).toEqual([earlier.id, later.id]);
	});
});

describe('deleting a saved protocol', () => {
	it('removes that one and leaves the rest', async () => {
		const keep = await duplicateProtocol({ name: 'Keep', protocol: REPEATERS }, T0);
		const gone = await duplicateProtocol({ name: 'Gone', protocol: REPEATERS }, T0 + 1);

		await deleteSavedProtocol(gone.id);

		expect(saved()).toMatchObject([keep]);
		expect(saved()).toHaveLength(1);
	});

	it('is a no-op for one already gone', async () => {
		const gone = await duplicateProtocol({ name: 'Gone', protocol: REPEATERS }, T0);
		await deleteSavedProtocol(gone.id);
		await expect(deleteSavedProtocol(gone.id)).resolves.toBeUndefined();
		expect(saved()).toEqual([]);
	});
});

describe('surviving a reload', () => {
	it('is still there in a store built over the same storage', async () => {
		const copy = await duplicateProtocol({ name: 'Copy of Repeaters', protocol: REPEATERS }, T0);
		const gone = await duplicateProtocol({ name: 'Gone', protocol: REPEATERS }, T0 + 1);
		await deleteSavedProtocol(gone.id);

		const reloaded = readTrainingRecord(createRecordStore(null));
		expect(reloaded.savedProtocols).toMatchObject([copy]);
		expect(reloaded.savedProtocols).toHaveLength(1);
	});
});
