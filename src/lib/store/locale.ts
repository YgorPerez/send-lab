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
import { useEffect, useState } from 'react';
import { getLocale, setLocale } from '$lib/paraglide/runtime';
import { SINGLETON_KEY } from './collections';
import { NO_PREFS, recordStore, recordSync, useActiveAccount } from './record';

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
 * **The device half is immediate; the account half waits for the hydrate.** With
 * no prefs row yet there is nothing to update, and inserting one means inventing
 * the athlete's *other* preferences — units, notifications — and stamping the
 * invention with the current clock. Before the account has answered there is
 * always no row, so a switch in that window would push fabricated defaults that
 * then beat the athlete's real `lb`/`in` under last-write-wins. Waiting costs the
 * athlete nothing they can see; guessing costs them their settings.
 */
export function chooseLocale(locale: AppLocale): void {
	setLocale(locale, { reload: false });
	void writeLocaleToAccount(locale);
}

async function writeLocaleToAccount(locale: AppLocale): Promise<void> {
	const sync = recordSync();
	// Signed out there is nothing to wait for and nothing to race: the row is
	// local-only, and inventing the rest of it costs nobody anything.
	if (sync) await sync.settled();

	const prefs = recordStore().prefs;
	if (prefs.has(SINGLETON_KEY)) {
		prefs.update(SINGLETON_KEY, (draft) => {
			draft.locale = locale;
		});
	} else {
		prefs.insert({ id: SINGLETON_KEY, ...NO_PREFS, locale });
	}
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
 * Held as state at the top of the app tree rather than read at each use: the
 * whole subtree is re-keyed on it, because `m.*()` reads the locale when it is
 * called and a component that does not re-render keeps rendering the old
 * language.
 */
export function useResolvedLocale(): [AppLocale, (next: AppLocale) => void] {
	const [locale, setLocalState] = useState<AppLocale>(() => {
		// Read lazily and guarded: the shell prerenders, and `getLocale()` reaches
		// for `localStorage` first under the configured strategy.
		try {
			const boot: unknown = getLocale();
			return isAppLocale(boot) ? boot : 'en-US';
		} catch {
			return 'en-US';
		}
	});

	const fromAccount = useAccountLocale();
	useEffect(() => {
		// The account's answer arriving, on a device whose local guess was wrong.
		// Not written back — this *is* the account's value, and `chooseLocale` is
		// for a choice the athlete made.
		if (!fromAccount || fromAccount === locale) return;
		setLocale(fromAccount, { reload: false });
		setLocalState(fromAccount);
	}, [fromAccount, locale]);

	return [
		locale,
		(next) => {
			chooseLocale(next);
			setLocalState(next);
		},
	];
}
