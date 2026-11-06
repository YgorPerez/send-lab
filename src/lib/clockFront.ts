// Which of the Timer screen's two clocks has the mini bar (#111): the one
// started last.
//
// The sixth ephemeral store (`ephemeral.ts`), on this device only and never
// synced (ADR 0008). Only one of the protocol clock and the stopwatch runs at a
// time (#108), and the bar at the bottom of the list belongs to whichever was
// started last. Both come back paused from another screen, each from its own
// draft, so neither draft can say which of the two was started after the other.
// Held in the screen's state alone, the answer went back to the protocol on
// every return, and a stopwatch left mid-count came back with no bar.
//
// Unscoped, like the stopwatch's draft: it belongs to the screen, and is current
// until the other clock is started. Cross-tab sync off, as every clock store's
// is: two tabs each starting a clock would hand the bar back and forth.
import useLocalStorageState from 'use-local-storage-state';
import { ephemeralKey } from '$lib/ephemeral';

const KEY = ephemeralKey('clockFront', 1);

/** Which clock the mini bar belongs to. */
export type ClockFront = 'protocol' | 'stopwatch';

/** What was stored, parsed rather than trusted: anything else is the protocol's,
 *  which is what the screen opened on before the stopwatch existed. */
export function frontOf(stored: unknown): ClockFront {
	return stored === 'stopwatch' ? 'stopwatch' : 'protocol';
}

/** The clock the bar belongs to, and the call that hands it to the other. */
export function useClockFront(): [ClockFront, (front: ClockFront) => void] {
	const [stored, setStored] = useLocalStorageState<unknown>(KEY, {
		defaultValue: undefined,
		storageSync: false,
	});
	return [frontOf(stored), setStored];
}
