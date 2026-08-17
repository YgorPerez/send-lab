// One fixture snapshot per locale, shared by the chrome and the screen inside it
// — plus the live reading the chrome displays.
//
// WHY A CACHE
// -----------
// `getPrototypeFixtures()` walks 35 days of history and runs the real readiness
// and load maths to get there. Cheap enough once per render; not cheap enough
// for every component that wants a number. Worse, each call reads `Date.now()`
// separately, so two calls either side of midnight would disagree about which
// day it is. Cached by locale, because the fixture resolves its content against
// the active Paraglide locale at call time.
//
// WHY A READING STORE
// -------------------
// Direction B's chrome is an instrument's primary display: the readiness score
// stays lit on all three screens. When the athlete re-answers the check on
// Today, that display has to follow — a master readout showing a stale number is
// worse than no readout. This is the smallest thing that does it: one value, set
// by Today, read by the chrome, falling back to the fixture when nothing has set
// it yet.
import { useSyncExternalStore } from 'react';
import { useLocaleSync } from '$lib/localeSwitch';
import { getLocale } from '$lib/paraglide/runtime';
import { getPrototypeFixtures, type PrototypeFixtures } from '../prototype-fixtures';

let cache: { locale: string; value: PrototypeFixtures } | null = null;

function snapshot(): PrototypeFixtures {
	const locale = getLocale();
	if (!cache || cache.locale !== locale) {
		cache = { locale, value: getPrototypeFixtures() };
	}
	return cache.value;
}

/** The fixture, re-resolved when the locale changes. */
export function usePrototype(): PrototypeFixtures {
	useLocaleSync();
	return snapshot();
}

/** What the chrome's primary display is currently showing. `null` score means
 *  the check is unanswered — the instrument reads nothing rather than guessing. */
export interface Reading {
	score: number | null;
	color: string;
}

let reading: Reading | null = null;
const readingListeners = new Set<() => void>();

const readReading = () => reading;

function subscribeReading(fn: () => void): () => void {
	readingListeners.add(fn);
	return () => {
		readingListeners.delete(fn);
	};
}

export function publishReading(next: Reading): void {
	if (reading && reading.score === next.score && reading.color === next.color) return;
	reading = next;
	for (const fn of readingListeners) fn();
}

/** The live reading, or `null` before Today has published one. */
export function useReading(): Reading | null {
	return useSyncExternalStore(subscribeReading, readReading, readReading);
}
