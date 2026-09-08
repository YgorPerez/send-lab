// The write half of preferences: one row, every field, merged in place.
//
// The trap is the one `store/locale.ts` already names — a preferences row that
// exists has every field, so a write of one field must never invent the others
// afresh, and a second write must land on the first rather than beside it.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SINGLETON_KEY } from '../src/lib/store/collections.ts';
import { writePrefs } from '../src/lib/store/prefs.ts';
import { recordStore, resetRecordStore } from '../src/lib/store/record.ts';

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

describe('writing a preference', () => {
	it('records the field and keeps the rest of the row at its default', async () => {
		await writePrefs({ weight: 'lb' });

		const prefs = recordStore().prefs.get(SINGLETON_KEY);
		expect(prefs?.weight).toBe('lb');
		expect(prefs).toMatchObject({
			length: 'mm',
			cueNotices: false,
			dailyNotice: false,
			timeZone: null,
			locale: null,
		});
	});

	it('lands a second write on the same row', async () => {
		await writePrefs({ weight: 'lb' });
		await writePrefs({ length: 'in' });

		const rows = recordStore().prefs.toArray;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ weight: 'lb', length: 'in' });
	});
});
