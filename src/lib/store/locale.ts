// Which language the app is in, and where that answer comes from.
//
// THE ORDER, AND WHY IT IS THIS ORDER
// -----------------------------------
// **`localStorage` on boot, overridden by `prefs.locale` once the account
// hydrates, and switching writes both.** Each half does something the other
// cannot:
//
//   * `localStorage` is instant, works offline, and is readable *before anyone
//     signs in* — the account document is none of those things, and a login
//     screen in the wrong language is a bad first impression the account cannot
//     fix in time. Paraglide already resolves it, under the strategy
//     `['localStorage', 'preferredLanguage', 'baseLocale']` that
//     `scripts/paraglide-strategy.ts` declares. That is unchanged.
//   * `prefs.locale` is what carries the choice to a **second device**, and it is
//     the only thing that can localize `/mcp` output at all: that endpoint is
//     bearer-token only and never reads cookies or browser storage (ADR-0004), so
//     the athlete's language has to be account data.
//
// So the device's answer renders first and the account's answer corrects it. The
// correction is normally a no-op — the same athlete on the same phone — and shows
// up exactly when it should: on a new device, where the local answer is a guess.
//
// Locale never enters the URL (ADR 0006): a precached shell has to stay
// user-independent, and a locale-prefixed route yields either two shells or a
// redirect on every cold start.
import { useLiveQuery } from '@tanstack/react-db';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getLocale, setLocale } from '$lib/paraglide/runtime';
import { writePrefs } from './prefs';
import { recordStore, useActiveAccount } from './record';

/** The languages the app ships.
 *
 *  Declared here rather than imported: Paraglide emits `runtime.js` as
 *  JSDoc-annotated JavaScript and exports no `Locale` type, so importing one is a
 *  compile error rather than a widening. `tests/locale.test.ts` holds this list
 *  against Paraglide's own `locales` so the two cannot drift apart in silence. */
export const APP_LOCALES = ['en-US', 'pt-BR'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

function isAppLocale(value: unknown): value is AppLocale {
	return APP_LOCALES.includes(value as AppLocale);
}

// ------------------------------------------------------------ the live value
//
// The active locale is a module-level value with subscribers, not React state.
// `useResolvedLocale` sits at the top of the tree, and the settings screen
// switches the locale from three routes down with no prop path between them; a
// value held in one component's `useState` can only be changed through that
// component. This is the same shape `record.ts` uses for the active account.

/** The locale this tab has been switched to, or `null` before any switch. */
let chosen: AppLocale | null = null;
const listeners = new Set<() => void>();

/** What the device says, read lazily and guarded: the shell prerenders, and
 *  `getLocale()` reaches for `localStorage` first under the configured strategy. */
function deviceLocale(): AppLocale {
	try {
		const boot: unknown = getLocale();
		return isAppLocale(boot) ? boot : 'en-US';
	} catch {
		return 'en-US';
	}
}

/** The locale the app is in right now. */
export function currentLocale(): AppLocale {
	return chosen ?? deviceLocale();
}

/** Be told when the locale changes. Returns the unsubscribe. */
export function subscribeLocale(notify: () => void): () => void {
	listeners.add(notify);
	return () => void listeners.delete(notify);
}

/** Switch Paraglide and this tab, telling nobody's account about it. */
function applyLocale(locale: AppLocale): void {
	setLocale(locale, { reload: false });
	chosen = locale;
	for (const notify of listeners) notify();
}

/**
 * Record a locale choice in both places.
 *
 * `setLocale` is Paraglide's, and under the configured strategy it is what writes
 * `localStorage`; the prefs row is the account's copy. Called together, from one
 * function, because "switching writes both" is a single rule and splitting it
 * across two call sites is how one half stops happening.
 *
 * `reload: false` because the app re-renders on the locale instead — `__root.tsx`
 * re-keys the whole subtree, which Paraglide's `m.*()` calls require since they
 * read the locale at call time.
 *
 * The device half is immediate; the account half is `writePrefs`, which waits
 * for the hydrate for the reason given there.
 */
export function chooseLocale(locale: AppLocale): void {
	applyLocale(locale);
	void writePrefs({ locale });
}

/** The locale the account has stored, or `null` for "follow the device". */
function useAccountLocale(): AppLocale | null {
	const account = useActiveAccount();
	const rows = useLiveQuery(() => recordStore().prefs, [account]).data;
	const stored = rows?.[0]?.locale;
	// A locale the app no longer ships is not an error — it is a preference that
	// has outlived a release, and falling back to the device is the right answer.
	return isAppLocale(stored) ? stored : null;
}

/**
 * The active locale, and the one way to change it.
 *
 * Held at the top of the app tree rather than read at each use: the whole
 * subtree is re-keyed on it, because `m.*()` reads the locale when it is called
 * and a component that does not re-render keeps rendering the old language.
 *
 * One reader for both snapshots. In the prerender there is no `window`, so
 * `currentLocale()` falls back to `en-US` on its own, and `__root.tsx` is what
 * keeps the first client render matching that baked answer (#70) — this hook
 * does not have to pretend a second time.
 */
export function useResolvedLocale(): [AppLocale, (next: AppLocale) => void] {
	const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);

	const fromAccount = useAccountLocale();
	// Seeded `null`, not with the first render's answer (#82). The prefs collection
	// is localStorage-backed with `startSync: true` — "the rows are in memory the
	// moment the collection exists" — so a first render that yields the row would
	// seed `seen` with the very value the effect exists to apply, and the account's
	// locale would never be applied at boot. It works out today only because
	// `useLiveQuery().data` happens to be `undefined` on that render, which is a
	// property of the library rather than one this guard should depend on.
	const seen = useRef<AppLocale | null>(null);
	useEffect(() => {
		// The account's answer *arriving*, on a device whose local guess was wrong.
		// Only when it changes: for a moment after `chooseLocale` the account still
		// holds the previous locale — the write waits for the hydrate and then for
		// the live query — and applying its stale answer on every disagreement
		// switched the athlete back for one render before switching them forward
		// again. Not written back either way: this *is* the account's value, and
		// `chooseLocale` is for a choice the athlete made.
		if (fromAccount === seen.current) return;
		seen.current = fromAccount;
		if (fromAccount && fromAccount !== currentLocale()) applyLocale(fromAccount);
	}, [fromAccount]);

	return [locale, chooseLocale];
}
