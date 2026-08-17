// The interval protocol: prepare → (work → rest) × rounds → set rest → … → done.
//
// THE FIRST OF THE THREE RECURRING PATTERNS (#53, obligation 3)
// -------------------------------------------------------------
// The rest timer is the hardest thing in the app to write well in React, and all
// four direction prototypes had to rewrite theirs — `react-doctor` fails the gate
// on impure state updaters and on refs mutated during render, and the obvious
// translation of the Svelte version trips both. The obvious translation keeps
// four `useState`s (phase, remaining, round, set), advances them from inside a
// `setInterval` closure, and reaches for a ref when that closure goes stale.
//
// The shape that works, and the one the vocabulary adopts for anything that
// advances on a clock:
//
//   1. **The protocol is a pure reducer, in `lib/`, with no React in it.** One
//      second of the session is `step(run, config)` — a total function from
//      state to state. It is unit-tested without rendering anything, which is
//      the part that matters: the interval arithmetic is where the bugs are, and
//      a component test cannot reach it.
//   2. **The component owns the tick and nothing else.** `setInterval(() =>
//      setRun(step))` is a pure updater over a single state object, so there is
//      no stale closure to hold in a ref, and no ref to mutate during render.
//   3. **Everything derivable is derived.** Elapsed, remaining-in-session and
//      the progress bar are computed from `(run, config)` on each render rather
//      than counted alongside it, so editing a field mid-session cannot
//      desynchronise the bar from the clock.
//
// One state object rather than four is what makes (2) possible: four separate
// setters cannot advance atomically from inside one tick.
//
// Ported from the SvelteKit app's `timerStore.svelte.ts`, whose arithmetic is
// the behavioural reference. The cues it fired are `lib/cues.ts`; the
// persistence it did by hand belongs to the store (#18).

export type Phase = 'idle' | 'prepare' | 'work' | 'rest' | 'setRest' | 'done';

/** The protocol to run. Seconds throughout; counts are whole. */
export interface IntervalConfig {
	prepare: number;
	work: number;
	rest: number;
	rounds: number;
	sets: number;
	setRest: number;
}

/** Where the session currently is. */
export interface Run {
	phase: Phase;
	remaining: number;
	round: number;
	set: number;
}

export const IDLE: Run = { phase: 'idle', remaining: 0, round: 1, set: 1 };

/** The state a fresh run starts in — prepare if there is one, else straight to work. */
export function beginning(c: IntervalConfig): Run {
	return c.prepare > 0
		? { phase: 'prepare', remaining: c.prepare, round: 1, set: 1 }
		: { phase: 'work', remaining: Math.max(1, c.work), round: 1, set: 1 };
}

/**
 * One second of the protocol. Pure and total: same input, same output, and every
 * phase has an answer — including `idle` and `done`, which return themselves so a
 * tick that outlives its `clearInterval` cannot corrupt the run.
 */
export function step(r: Run, c: IntervalConfig): Run {
	if (r.remaining > 1) return { ...r, remaining: r.remaining - 1 };
	switch (r.phase) {
		case 'prepare':
			return { ...r, phase: 'work', remaining: Math.max(1, c.work) };
		case 'work':
			if (r.round < c.rounds) {
				return c.rest > 0
					? { ...r, phase: 'rest', round: r.round + 1, remaining: c.rest }
					: { ...r, phase: 'work', round: r.round + 1, remaining: Math.max(1, c.work) };
			}
			if (r.set < c.sets) {
				return c.setRest > 0
					? { ...r, phase: 'setRest', remaining: c.setRest }
					: { phase: 'work', set: r.set + 1, round: 1, remaining: Math.max(1, c.work) };
			}
			return { ...r, phase: 'done', remaining: 0 };
		case 'rest':
			return { ...r, phase: 'work', remaining: Math.max(1, c.work) };
		case 'setRest':
			return { phase: 'work', set: r.set + 1, round: 1, remaining: Math.max(1, c.work) };
		default:
			return r;
	}
}

/**
 * One set: every round's effort, with a rest between rounds but not after the
 * last one — the set rest takes that place.
 */
function perSetOf(c: IntervalConfig): number {
	return c.rounds * c.work + Math.max(0, c.rounds - 1) * c.rest;
}

/**
 * The whole session, in seconds.
 *
 * `sets × rounds × (work + rest)` is the tempting form and it is wrong: it bills
 * a rest after the final round of every set, which the protocol does not run.
 * On the prototype's 6×(7s/3s)×2 repeaters that reported 310s against an actual
 * 304s — six seconds the athlete was told to expect and never spent. Caught by
 * running the protocol tick by tick against this number
 * (`tests/intervalProtocol.test.ts`), not by reading either expression.
 */
export function totalOf(c: IntervalConfig): number {
	return c.prepare + c.sets * perSetOf(c) + Math.max(0, c.sets - 1) * c.setRest;
}

/**
 * How long the phase currently running lasts, for the ring.
 *
 * Idle and done have no phase of their own and report 0, which callers render as
 * a full ring rather than an empty one — an empty ring on a finished protocol
 * reads as "nothing done".
 */
export function phaseLengthOf(r: Run, c: IntervalConfig): number {
	switch (r.phase) {
		case 'prepare':
			return c.prepare;
		case 'work':
			return c.work;
		case 'rest':
			return c.rest;
		case 'setRest':
			return c.setRest;
		default:
			return 0;
	}
}

/**
 * Seconds completed. Derived from the run, never counted alongside it — a
 * separately-incremented counter is what lets the progress bar drift away from
 * the clock when a field is edited mid-session.
 *
 * Note that `round` names the round *about to be worked*: `step` increments it
 * on the way into a rest, so during the rest that follows round 1 the display
 * already reads round 2. That is deliberate — a rest is time spent getting ready
 * for the next effort — and it is why the `rest` branch below counts one fewer
 * complete round than the round number suggests.
 */
export function elapsedOf(r: Run, c: IntervalConfig): number {
	if (r.phase === 'idle') return 0;
	if (r.phase === 'done') return totalOf(c);
	if (r.phase === 'prepare') return c.prepare - r.remaining;

	const beforeSet = c.prepare + (r.set - 1) * (perSetOf(c) + c.setRest);
	if (r.phase === 'setRest') {
		return beforeSet + perSetOf(c) + (c.setRest - r.remaining);
	}
	const intoSet =
		r.phase === 'work'
			? (r.round - 1) * (c.work + c.rest) + (c.work - r.remaining)
			: (r.round - 2) * (c.work + c.rest) + c.work + (c.rest - r.remaining);
	return Math.max(0, Math.min(totalOf(c), beforeSet + intoSet));
}

/** Seconds left in the whole session. */
export function remainingOf(r: Run, c: IntervalConfig): number {
	return Math.max(0, totalOf(c) - elapsedOf(r, c));
}

/**
 * The phase that follows this one, and how long it lasts — the "next up" line
 * Timer Plus shows and this app did not.
 *
 * Computed by stepping the protocol to the end of the current phase rather than
 * by a second switch statement. One transition table, so the preview cannot
 * disagree with what actually happens next.
 */
export function nextOf(r: Run, c: IntervalConfig): { phase: Phase; seconds: number } | null {
	if (r.phase === 'idle' || r.phase === 'done') return null;
	const next = step({ ...r, remaining: 1 }, c);
	if (next.phase === 'done') return { phase: 'done', seconds: 0 };
	return { phase: next.phase, seconds: next.remaining };
}
