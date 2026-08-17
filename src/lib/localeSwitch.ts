// Switching locale without reloading the page.
//
// Paraglide's `setLocale` reloads by default, and here that is the wrong trade:
// the prototype holds its interactive state (ticked tasks, typed sets, answered
// questions) in React, and a reload throws all of it away just to read a
// different string table. `{ reload: false }` writes the choice to localStorage
// and swaps the module-level locale; this store then bumps a version so every
// subscribed component re-renders and its `getContent()` / `m.*()` calls resolve
// against the new locale.
//
// The re-render is the whole mechanism: `getContent()` is read at render time
// and is not reactive, so nothing short of running the render again would pick
// the new strings up.
import { useSyncExternalStore } from 'react';
import { getLocale, type Locale, locales, setLocale } from '$lib/paraglide/runtime';

let version = 0;
const listeners = new Set<() => void>();

const read = () => version;

function subscribe(fn: () => void): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

/** Re-render this component whenever the locale changes. */
export function useLocaleSync(): void {
	useSyncExternalStore(subscribe, read, read);
}

export function switchLocale(next: Locale): void {
	if (next === getLocale()) return;
	setLocale(next, { reload: false });
	if (typeof document !== 'undefined') document.documentElement.lang = next;
	version += 1;
	for (const fn of listeners) fn();
}

/** The two locales, in the order the function strip shows them. */
export const LOCALES: readonly Locale[] = locales;

/** Two letters, for the function strip. Deliberately not localized: a language
 *  switch has to be readable *in the language you cannot read*. */
export function localeTag(locale: string): string {
	return locale.slice(0, 2).toUpperCase();
}
