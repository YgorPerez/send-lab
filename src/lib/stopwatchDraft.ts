// The stopwatch's draft: its count and its laps, on this device only (#108).
//
// The fourth ephemeral store (`ephemeral.ts`), and the clock's rules exactly
// (`timerSetup.ts`): it survives a reload or a trip to another screen, it comes
// back **paused** — nothing here knows how long the page was gone, so a watch
// that resumed itself would be wrong by exactly that much — and it never syncs
// (ADR 0008). A stopwatch is not training: it records no session and no set.
//
// It is the one store with no scope. The others belong to a day, a slot or a
// protocol, and are lies once that has moved on; a stopwatch belongs to nothing
// but itself, and is current until the athlete resets it.
//
// `storageSync: false` for the timer's reason: two tabs each ticking would fight
// over `elapsed` ten times a second.
import { useCallback } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { ephemeralKey, isRecord } from '$lib/ephemeral';
import { type Stopwatch, ZERO } from '$lib/stopwatch';

const KEY = ephemeralKey('stopwatch', 1);

/** What is kept: the count and the laps. Never `running` — see above. */
export type StopwatchDraft = Pick<Stopwatch, 'elapsed' | 'marks'>;

/**
 * The stopwatch to open with, given what was stored: paused, always, and at
 * zero if what was stored cannot be a stopwatch.
 *
 * Parsed rather than trusted, as the clock's draft is. Laps out of order or past
 * the count describe no run that happened, and a lap list built from them would
 * show a negative lap.
 */
export function restoredStopwatch(stored: unknown): Stopwatch {
	if (!isRecord(stored) || !isCount(stored.elapsed) || !Array.isArray(stored.marks)) return ZERO;
	const marks: number[] = [];
	for (const mark of stored.marks as unknown[]) {
		if (!isCount(mark) || mark <= (marks.at(-1) ?? 0) || mark > stored.elapsed) return ZERO;
		marks.push(mark);
	}
	return { elapsed: stored.elapsed, marks, running: false };
}

function isCount(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Persist the stopwatch. A sink, like the clock's: the component holds the
 * watch as state and reads this back once, in a lazy initialiser.
 */
export function useStopwatchDraft(): [unknown, (draft: StopwatchDraft) => void] {
	const [stored, setStored] = useLocalStorageState<StopwatchDraft | undefined>(KEY, {
		defaultValue: undefined,
		storageSync: false,
	});
	// Stable, because the caller writes from an effect keyed on it.
	const persist = useCallback(
		(draft: StopwatchDraft) => setStored({ elapsed: draft.elapsed, marks: draft.marks }),
		[setStored],
	);
	return [stored, persist];
}
