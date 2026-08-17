// Locale switching for the direction prototypes, without a page reload.
//
// Paraglide's `setLocale()` reloads the document by default, which is correct
// for a normal app and wrong here: the four prototypes are judged by switching
// to pt-BR *mid-screen* and looking at what breaks, and a reload throws away
// every bit of `useState` the screen was holding (a half-answered readiness
// check, a typed set, an open accordion). So the locale is set with
// `reload: false` and React is told to re-render instead.
//
// Everything localized in this prototype resolves at render time —
// `getPrototypeFixtures()` reads `getContent()` and `m.*()` reads `getLocale()`
// on every call — so a re-render is genuinely sufficient. Nothing is memoized
// across the switch except through `useLocale()` itself.
//
// Subscribing is per-component on purpose: TanStack Router memoizes the matched
// route component, so a re-render of the shell does not reach the screen inside
// `<Outlet />`. Every screen calls `useLocale()` itself.

import { useSyncExternalStore } from 'react';
import { getLocale, type locales, setLocale } from '$lib/paraglide/runtime';

/** The compiled runtime exports `locales` as a value but no `Locale` *type* —
 *  it is a JSDoc typedef inside the generated `.js`, not something importable.
 *  Derived from the value instead. */
export type AppLocale = (typeof locales)[number];

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
	listeners.add(onChange);
	return () => {
		listeners.delete(onChange);
	};
}

const readLocale = (): AppLocale => getLocale() as AppLocale;

/** Server snapshot: the prerendered shell is user-independent (ADR 0006) and
 *  never renders a screen, so the base locale is the only honest answer. */
const serverSnapshot = (): AppLocale => 'en-US';

/** The active locale, as a subscription. Call it in anything that renders
 *  localized content — including screens behind `<Outlet />`. */
export function useLocale(): AppLocale {
	return useSyncExternalStore(subscribe, readLocale, serverSnapshot);
}

/** Switch locale in place. Persists through Paraglide's `localStorage`
 *  strategy, so the choice survives the next cold start. */
export function switchLocale(next: AppLocale): void {
	if (next === getLocale()) return;
	void setLocale(next, { reload: false });
	for (const l of listeners) l();
}
