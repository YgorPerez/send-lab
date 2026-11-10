// The stopwatch: a count up, and the laps marked on it (#108).
//
// The protocol's sibling, in the protocol's shape (`protocol.ts`, the vocabulary's
// first idiom): one state object, a pure reducer over it, and a component that
// owns the tick and nothing else. What differs is only what is being counted —
// time spent rather than time left, and no protocol to say when it ends.
//
// MILLISECONDS, AND HANDED IN RATHER THAN COUNTED
// -----------------------------------------------
// The protocol ticks whole seconds, because a segment is seconds long and the
// cues land on them. A stopwatch times a boulder attempt, where two attempts are
// told apart by tenths, so it counts milliseconds — and `tick` takes how many
// passed rather than assuming the interval fired on time. A background tab
// fires a 100ms interval once a second or less; a stopwatch that added 100ms per
// firing would lose most of every minute the screen was off.
//
// A LAP IS WHERE THE COUNT STOOD, AND NOTHING ELSE
// ------------------------------------------------
// The state keeps one number per lap: the total at the moment it was marked. A
// lap's own time is the gap from the mark before, derived in `lapsOf` — storing
// both would be two numbers that have to agree, and a pause, a reset or a
// restored draft is where they would stop agreeing.

/** A stopwatch, and the laps marked on it. */
export interface Stopwatch {
	/** Milliseconds counted, across every pause. */
	readonly elapsed: number;
	/** Where each lap ended, as `elapsed` at the press, oldest first. */
	readonly marks: readonly number[];
	readonly running: boolean;
}

/** One lap: its number, its own time, and the total where it ended. */
export interface Lap {
	readonly n: number;
	readonly time: number;
	readonly total: number;
}

/** Zero, paused, no laps — a stopwatch nobody has started. */
export const ZERO: Stopwatch = { elapsed: 0, marks: [], running: false };

/** Start it, or resume it from where it was paused. */
export function start(s: Stopwatch): Stopwatch {
	return s.running ? s : { ...s, running: true };
}

/** Hold the count where it is. */
export function pause(s: Stopwatch): Stopwatch {
	return s.running ? { ...s, running: false } : s;
}

/**
 * `ms` milliseconds passing. A paused watch ignores them, and so does a running
 * one handed something that is not a forward amount of time — the function is
 * total, so a stray or late tick cannot corrupt the count.
 */
export function tick(s: Stopwatch, ms: number): Stopwatch {
	if (!s.running || !Number.isFinite(ms) || ms <= 0) return s;
	return { ...s, elapsed: s.elapsed + ms };
}

/**
 * Mark a lap where the count stands.
 *
 * Only while it runs, and never a lap of no length: a split marked on a paused
 * watch times nothing, and a second press in the same instant — or a press
 * before any time has run — would put a zero among the attempts being compared.
 */
export function lap(s: Stopwatch): Stopwatch {
	if (!s.running || s.elapsed <= (s.marks.at(-1) ?? 0)) return s;
	return { ...s, marks: [...s.marks, s.elapsed] };
}

/**
 * Whether there is a count to lose: running, from the press of Start and
 * before any time has run, or holding time. Laps need time before them, so a
 * watch with laps always has time. What the full-screen stopwatch's Close
 * guards, and whether it is there at all (#130).
 */
export function underway(s: Stopwatch): boolean {
	return s.running || s.elapsed > 0;
}

/** Back to zero, stopped, with its laps gone — from any state, as the protocol's
 *  reset is. */
export function reset(_s: Stopwatch): Stopwatch {
	return ZERO;
}

/** The laps marked so far, oldest first, each with its own time and the total. */
export function lapsOf(s: Stopwatch): Lap[] {
	return s.marks.map((total, i) => ({ n: i + 1, time: total - (s.marks[i - 1] ?? 0), total }));
}

/** The lap being timed now: from the last mark, or from zero before the first. */
export function currentLapOf(s: Stopwatch): Lap {
	return {
		n: s.marks.length + 1,
		time: s.elapsed - (s.marks.at(-1) ?? 0),
		total: s.elapsed,
	};
}
