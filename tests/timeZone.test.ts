// The one field on the account that the device fills in rather than the athlete.
//
// The trap is the one the module's own header names: this runs on **every** boot,
// so "write the zone" and "write the zone only when it is not already there" look
// identical on the first launch and differ on every launch after it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SINGLETON_KEY } from '../src/lib/store/collections.ts';
import { NO_PREFS, recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { deviceTimeZone, recordDeviceTimeZone } from '../src/lib/store/timeZone.ts';

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
	vi.restoreAllMocks();
	if (original) Object.defineProperty(window, 'localStorage', original);
	resetRecordStore();
});

/** Make the browser answer `zone`, or refuse to answer at all. */
function browserSays(zone: string | null) {
	vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
		() =>
			({
				resolvedOptions: () => ({ timeZone: zone === null ? '' : zone }),
			}) as unknown as Intl.DateTimeFormat,
	);
}

describe('reading the zone off the browser', () => {
	it('reports what the runtime resolves', () => {
		browserSays('America/Sao_Paulo');
		expect(deviceTimeZone()).toBe('America/Sao_Paulo');
	});

	it('reports a machine really set to UTC as UTC', () => {
		// Not filtered as a placeholder: it is a real answer, and dropping it would
		// leave the one athlete it is true for reading as having no zone at all.
		browserSays('UTC');
		expect(deviceTimeZone()).toBe('UTC');
	});

	it('reports a runtime that names no zone as absent', () => {
		browserSays(null);
		expect(deviceTimeZone()).toBeNull();
	});

	it('survives a runtime that throws', () => {
		vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
			throw new Error('no zone database');
		});
		expect(deviceTimeZone()).toBeNull();
	});
});

describe('putting it on the account', () => {
	it('records the zone, leaving the rest of the row at its defaults', async () => {
		browserSays('America/Sao_Paulo');
		await recordDeviceTimeZone();

		expect(recordStore().prefs.get(SINGLETON_KEY)).toMatchObject({
			...NO_PREFS,
			timeZone: 'America/Sao_Paulo',
		});
	});

	it('writes nothing on a boot where the account already agrees', async () => {
		browserSays('America/Sao_Paulo');
		await recordDeviceTimeZone();
		const first = recordStore().prefs.get(SINGLETON_KEY);

		await recordDeviceTimeZone();

		// The same row object, not merely an equal one: an update would replace it,
		// and an equal replacement is exactly the write this exists to skip.
		expect(recordStore().prefs.get(SINGLETON_KEY)).toBe(first);
	});

	it('moves the account when the device does', async () => {
		browserSays('America/Sao_Paulo');
		await recordDeviceTimeZone();

		browserSays('Europe/Madrid');
		await recordDeviceTimeZone();

		expect(recordStore().prefs.toArray).toHaveLength(1);
		expect(recordStore().prefs.get(SINGLETON_KEY)?.timeZone).toBe('Europe/Madrid');
	});

	it('leaves the account alone when the browser names no zone', async () => {
		browserSays(null);
		await recordDeviceTimeZone();

		// Absent, and not a row full of invented defaults: an account that has never
		// reported a zone has to read as one that never has.
		expect(recordStore().prefs.toArray).toEqual([]);
	});
});
