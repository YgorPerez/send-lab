// The locale resolution order's two testable halves: that the app's list of
// languages still matches Paraglide's, and that switching writes the account's
// copy as well as the device's.
//
// The third half — the account's answer overriding the device's on hydrate — is
// React wiring (`useResolvedLocale`) and is asserted where it is observable, in
// the screens suite's two locales.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { locales } from '../src/lib/paraglide/runtime.js';
import { SINGLETON_KEY } from '../src/lib/store/collections.ts';
import {
	APP_LOCALES,
	chooseLocale,
	currentLocale,
	subscribeLocale,
} from '../src/lib/store/locale.ts';
import { recordStore, resetRecordStore } from '../src/lib/store/record.ts';

let original: PropertyDescriptor | undefined;

beforeEach(() => {
	// Paraglide's `setLocale` writes `localStorage` under the configured strategy,
	// and TanStack DB's change proxy reads it. jsdom's is not callable — see
	// `recordSync.test.ts` for the full note.
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

describe('the app ships what Paraglide compiles', () => {
	// `store/locale.ts` declares its own list, because Paraglide emits
	// JSDoc-annotated JavaScript and exports no `Locale` type to import. This is
	// the assertion that keeps the second declaration honest.
	it('has the same locales, in the same order', () => {
		expect([...APP_LOCALES]).toEqual([...locales]);
	});
});

describe('switching writes both', () => {
	it('records the choice on the account', () => {
		chooseLocale('pt-BR');

		const prefs = recordStore().prefs.get(SINGLETON_KEY);
		expect(prefs?.locale).toBe('pt-BR');
		// The rest of the row is the default rather than absent: a preferences row
		// that exists has every field, and a switch is not the moment to invent
		// half of one.
		expect(prefs).toMatchObject({ weight: 'kg', length: 'mm', notify: false });
	});

	it('updates the row it already has rather than adding a second', () => {
		chooseLocale('pt-BR');
		chooseLocale('en-US');

		expect(recordStore().prefs.toArray).toHaveLength(1);
		expect(recordStore().prefs.get(SINGLETON_KEY)?.locale).toBe('en-US');
	});

	it('leaves the athlete’s other preferences alone', () => {
		const prefs = recordStore().prefs;
		prefs.insert({ id: SINGLETON_KEY, weight: 'lb', length: 'in', notify: true, locale: null });

		chooseLocale('pt-BR');

		expect(prefs.get(SINGLETON_KEY)).toMatchObject({
			weight: 'lb',
			length: 'in',
			notify: true,
			locale: 'pt-BR',
		});
	});
});

describe('a choice made anywhere reaches the root', () => {
	// `useResolvedLocale` sits at the top of the tree and re-keys everything on
	// the locale. The settings screen switches it from three routes down, with no
	// prop path between them — so the choice has to be observable, not only
	// written. Asserted at the module rather than by mounting: the hook is
	// `useSyncExternalStore` over exactly these two functions.
	it('notifies a subscriber and reads back as the current locale', () => {
		const seen: string[] = [];
		const stop = subscribeLocale(() => seen.push(currentLocale()));

		chooseLocale('pt-BR');
		expect(seen).toEqual(['pt-BR']);
		expect(currentLocale()).toBe('pt-BR');

		stop();
		chooseLocale('en-US');
		expect(seen).toEqual(['pt-BR']);
	});
});
