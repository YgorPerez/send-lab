// The interval protocol: prepare → (work → rest) × rounds → set rest → … → done.
//
// THE FIRST OF THE THREE RECURRING PATTERNS (#53, obligation 3)
// -------------------------------------------------------------
// The rest timer is the hardest thing in the app to write well in React, and all
// four direction prototypes had to rewrite theirs — `react-doctor` fails the gate
// on impure state updaters and on refs mutated during render, and the obvious
// translation of the Svelte version trips both. The obvious translation keeps
// four `useState`s (segment, remaining, round, set), advances them from inside a
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
// the behavioural reference. Which cues it fired is `planCues`, at the end of
// this file; playing them is `lib/cues.ts`. The persistence it did by hand
// belongs to the store (#18).

import type { VariantParams } from '$lib/content/types';
import { midOf } from '$lib/loggedSet';

/** Every segment, in the order a run passes through them.
 *
 *  The array is the declaration and the union is derived from it, rather than the
 *  other way round, because #59 needs the members at *runtime* — a stored run is
 *  parsed back out of `localStorage` and its segment has to be checked against
 *  something. Written as a second hand-kept list, a segment added here would not
 *  fail to compile there, and the check would silently start rejecting a real
 *  state. Same shape as `DAY_TYPE_IDS` in `content/types.ts`. */
export const SEGMENTS = ['idle', 'prepare', 'work', 'rest', 'setRest', 'done'] as const;

export type Segment = (typeof SEGMENTS)[number];

/** The fields a protocol is made of. Derived-from, not duplicated-by,
 *  `Protocol` — for the same reason as `SEGMENTS`: `timerSetup.ts` checks a
 *  parsed config field by field, and a field added to the type but not to the
 *  check is a config that passes validation with a hole in it. */
export const PROTOCOL_FIELDS = ['prepare', 'work', 'rest', 'rounds', 'sets', 'setRest'] as const;

/** The protocol to run. Seconds throughout; counts are whole. */
export type Protocol = Record<(typeof PROTOCOL_FIELDS)[number], number>;

/**
 * The protocol a library variant runs, or `null` if it carries none.
 *
 * A variant carries a protocol exactly when it sets a work length — the same
 * predicate as `PrescribedTask.timed`. Each range runs at its middle, rounded,
 * because a clock cannot run "three to four sets"; an absent count is one, an
 * absent rest is none, and an absent prepare is ten seconds to get on the board.
 *
 * Train used to keep this mapping private to its route. The Timer screen's
 * presets (#101) need the same one, and two copies of it are how a preset and
 * the prescription of the same variant would come to run different numbers.
 */
export function protocolOf(v: VariantParams): Protocol | null {
	if (!v.workSec) return null;
	return {
		prepare: v.prepareSec ?? 10,
		work: midOf(v.workSec) ?? 10,
		rest: midOf(v.restSec) ?? 0,
		rounds: midOf(v.rounds) ?? 1,
		sets: midOf(v.sets) ?? 1,
		setRest: midOf(v.setRestSec) ?? 0,
	};
}

/** Where the session currently is. */
export interface Run {
	segment: Segment;
	remaining: number;
	round: number;
	set: number;
}

export const IDLE: Run = { segment: 'idle', remaining: 0, round: 1, set: 1 };

/** The state a fresh run starts in — prepare if there is one, else straight to work. */
export function beginning(c: Protocol): Run {
	return c.prepare > 0
		? { segment: 'prepare', remaining: c.prepare, round: 1, set: 1 }
		: { segment: 'work', remaining: Math.max(1, c.work), round: 1, set: 1 };
}

/**
 * One second of the protocol. Pure and total: same input, same output, and every
 * segment has an answer — including `idle` and `done`, which return themselves so a
 * tick that outlives its `clearInterval` cannot corrupt the run.
 */
export function step(r: Run, c: Protocol): Run {
	if (r.remaining > 1) return { ...r, remaining: r.remaining - 1 };
	switch (r.segment) {
		case 'prepare':
			return { ...r, segment: 'work', remaining: Math.max(1, c.work) };
		case 'work':
			if (r.round < c.rounds) {
				return c.rest > 0
					? { ...r, segment: 'rest', round: r.round + 1, remaining: c.rest }
					: { ...r, segment: 'work', round: r.round + 1, remaining: Math.max(1, c.work) };
			}
			if (r.set < c.sets) {
				return c.setRest > 0
					? { ...r, segment: 'setRest', remaining: c.setRest }
					: { segment: 'work', set: r.set + 1, round: 1, remaining: Math.max(1, c.work) };
			}
			return { ...r, segment: 'done', remaining: 0 };
		case 'rest':
			return { ...r, segment: 'work', remaining: Math.max(1, c.work) };
		case 'setRest':
			return { segment: 'work', set: r.set + 1, round: 1, remaining: Math.max(1, c.work) };
		default:
			return r;
	}
}

/**
 * Skip: jump to the first second of the segment that follows — from the last
 * one, to `done`. Pure and total like `step`, and for the same reason idle and
 * done return themselves.
 *
 * It is `step` taken from the segment's final second, so the segment it lands on
 * is the one the clock would have reached anyway. The skip has no transition
 * table of its own that could disagree with the clock. A segment added to
 * `step` (cooldown, #104) can be skipped into and out of with no change here.
 */
export function skip(r: Run, c: Protocol): Run {
	if (r.segment === 'idle' || r.segment === 'done') return r;
	return step({ ...r, remaining: 1 }, c);
}

/** How long a segment has to have run before back restarts it rather than
 *  going to the one before. Short enough that a botched hang is still caught a
 *  few seconds in, and long enough that a tap just after a change goes back
 *  across that change. Music players draw the same line in the same place. */
const BACK_RESTARTS_AFTER = 3;

/** Whether two runs are in the same segment of the same round of the same set. */
function samePlace(a: Run, b: Run): boolean {
	return a.segment === b.segment && a.round === b.round && a.set === b.set;
}

/**
 * Back: restart the segment if it has run for more than a few seconds,
 * otherwise go to the first second of the one before. From the first segment it
 * restarts it; from `done` it goes to the start of the last segment, which is
 * the botched final hang; idle returns itself. Pure and total, like `step`.
 *
 * The segment before is found by walking the protocol forward from the
 * beginning, one segment at a time through `skip`, rather than by a reverse
 * transition table. A second table, written backwards, is one more place a new
 * segment has to be taught about and one more chance to disagree with `step`.
 * The walk is as long as the protocol has segments, which is a few dozen.
 */
export function back(r: Run, c: Protocol): Run {
	if (r.segment === 'idle') return r;
	let before: Run | null = null;
	for (let s = beginning(c); s.segment !== 'done'; s = skip(s, c)) {
		if (r.segment !== 'done' && samePlace(s, r)) {
			return s.remaining - r.remaining > BACK_RESTARTS_AFTER || !before ? s : before;
		}
		before = s;
	}
	if (r.segment === 'done') return before ?? r;
	// A place the protocol no longer passes through, because a field was edited
	// mid-run (round 4 of what is now two rounds). There is no "before" to find,
	// so redo the segment the clock is in.
	return { ...r, remaining: Math.max(1, segmentLengthOf(r, c)) };
}

/**
 * One set: every round's effort, with a rest between rounds but not after the
 * last one — the set rest takes that place.
 */
function perSetOf(c: Protocol): number {
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
 * (`tests/protocol.test.ts`), not by reading either expression.
 */
export function totalOf(c: Protocol): number {
	return c.prepare + c.sets * perSetOf(c) + Math.max(0, c.sets - 1) * c.setRest;
}

/**
 * How long the segment currently running lasts, for the ring.
 *
 * Idle and done have no segment of their own and report 0, which callers render as
 * a full ring rather than an empty one — an empty ring on a finished protocol
 * reads as "nothing done".
 */
export function segmentLengthOf(r: Run, c: Protocol): number {
	switch (r.segment) {
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
export function elapsedOf(r: Run, c: Protocol): number {
	if (r.segment === 'idle') return 0;
	if (r.segment === 'done') return totalOf(c);
	if (r.segment === 'prepare') return c.prepare - r.remaining;

	const beforeSet = c.prepare + (r.set - 1) * (perSetOf(c) + c.setRest);
	if (r.segment === 'setRest') {
		return beforeSet + perSetOf(c) + (c.setRest - r.remaining);
	}
	const intoSet =
		r.segment === 'work'
			? (r.round - 1) * (c.work + c.rest) + (c.work - r.remaining)
			: (r.round - 2) * (c.work + c.rest) + c.work + (c.rest - r.remaining);
	return Math.max(0, Math.min(totalOf(c), beforeSet + intoSet));
}

/** Seconds left in the whole session. */
export function remainingOf(r: Run, c: Protocol): number {
	return Math.max(0, totalOf(c) - elapsedOf(r, c));
}

/**
 * The segment that follows this one, and how long it lasts — the "next up" line
 * Timer Plus shows and this app did not.
 *
 * Computed by skipping the current segment rather than by a second switch
 * statement. One transition table, so the preview cannot disagree with what
 * actually happens next, nor with where the skip button goes.
 */
export function nextOf(r: Run, c: Protocol): { segment: Segment; seconds: number } | null {
	if (r.segment === 'idle' || r.segment === 'done') return null;
	const next = skip(r, c);
	if (next.segment === 'done') return { segment: 'done', seconds: 0 };
	return { segment: next.segment, seconds: next.remaining };
}

/**
 * One event in a running protocol the athlete has to be told about while they
 * are not looking at the screen. Named for what happened, never for what it
 * sounds like: the glossary's **Cue** is the event, and the sound and the buzz
 * are two of its deliveries (`Delivery`, below).
 */
export type Cue =
	/** The athlete pressed Start. */
	| 'start'
	/** Prepare is over — begin the effort. Distinct on purpose. */
	| 'go'
	/** An effort ended; rest begins. */
	| 'rest'
	/** A rest ended; the next round begins. */
	| 'work'
	/** A set ended; the longer between-sets rest begins. */
	| 'setRest'
	/** The last seconds of any segment, one beat each: three of them unless
	 *  the athlete chose five or ten (`CuePrefs.countdown`). */
	| 'countdown'
	/** The protocol is finished. */
	| 'done';

/** The cues that buzz. The countdown does not: it fires once a second for up
 *  to ten seconds, and a phone buzzing continuously reads as a malfunction
 *  rather than as a countdown. Typed rather than tabled, so `cues.ts` cannot be asked for a
 *  buzz pattern the planner never plans. */
export type BuzzedCue = Exclude<Cue, 'countdown'>;

/** The segments a voice names on arrival. Idle is never arrived at with a cue:
 *  reset is silent. */
type SpokenSegment = Exclude<Segment, 'idle'>;

/**
 * The message key that names a segment aloud: `cues_say_work`, `cues_say_setrest`
 * and so on (#106). A key and never a string, so the phrase is said in the
 * locale the athlete has when it is said, not the one the clock planned it in
 * (ADR 0012).
 *
 * Derived from the segment's name rather than tabled beside it, so a segment
 * added to `SEGMENTS` (the cooldown, #104) is planned a phrase with no edit
 * here; what it needs is its message, which `PHRASES` in `cues.ts` refuses to
 * compile without. Lower-cased because the message catalogue is
 * (`timer_setrest`).
 */
export type SegmentPhrase = `cues_say_${Lowercase<SpokenSegment>}`;

/** The key that says one beat of the countdown, a number, in the locale's words. */
export type CountPhrase = 'cues_say_count';

/**
 * One way a cue reaches the athlete. A discriminated union, so a new delivery
 * is a new member here and a new branch in `cues.ts`, and the exhaustive switch
 * there refuses to compile until it is played.
 *
 * Speech carries a message key and, for a countdown beat, the number it says;
 * `cues.ts` turns the key into words in the active locale when it speaks.
 */
export type Delivery =
	| { kind: 'sound'; cue: Cue }
	| { kind: 'buzz'; cue: BuzzedCue }
	| { kind: 'speech'; key: SegmentPhrase }
	| { kind: 'speech'; key: CountPhrase; n: number }
	/** The screen washing over in the colour of the segment arrived in (#107),
	 *  fading out over `ms`. The clock draws it; `cues.ts` hands it over. */
	| { kind: 'flash'; segment: Segment; ms: number };

/** How long a flash takes to fade. Long enough to catch from the corner of the
 *  eye with both hands on a board; short enough to be over before the second
 *  it marks is half gone. */
const FLASH_MS = 450;

/** The phrase that names arriving in `segment`. */
function phraseOf(segment: SpokenSegment): SegmentPhrase {
	return `cues_say_${segment.toLowerCase() as Lowercase<SpokenSegment>}`;
}

/** Which cue announces arriving in a segment. Mirrors the SvelteKit app exactly. */
const ARRIVAL: Record<Segment, BuzzedCue | null> = {
	idle: null,
	prepare: 'start',
	work: 'work',
	rest: 'rest',
	setRest: 'setRest',
	done: 'done',
};

/** How many final seconds of a segment are counted down, one cue each. The
 *  athlete's choice (#105), from this closed set: Timer Plus offers the same
 *  three, and a free number would be a field to validate for no protocol the
 *  library prescribes. */
export const COUNTDOWN_LENGTHS = [3, 5, 10] as const;
export type CountdownLength = (typeof COUNTDOWN_LENGTHS)[number];

/**
 * How the athlete wants cues delivered. Part of their preferences (the prefs row
 * extends this), so it follows the account; read by the planner rather than by
 * `cues.ts`, because whether a delivery happens is a decision and the player
 * makes none.
 *
 * Each field is one delivery or one parameter of one. A new one is a field here,
 * a default below, a column on the server's prefs row and a row in
 * `CueSettings` — nothing else has to move.
 */
export interface CuePrefs {
	/** Seconds counted down at the end of every segment. */
	countdown: CountdownLength;
	/** Whether segment changes vibrate. The sound plays either way. */
	buzz: boolean;
	/** Whether a voice names each segment as it begins and says the countdown
	 *  (#106). The sound plays either way, so the timing never depends on it. */
	voice: boolean;
	/** Whether segment changes flash the full-screen clock (#107). */
	flash: boolean;
}

/** What an athlete who never opened the setting gets, and what a row written
 *  before the setting existed reads as: exactly the clock before #105. */
export const CUE_DEFAULTS: CuePrefs = { countdown: 3, buzz: true, voice: true, flash: true };

/**
 * What the athlete is told when the clock moves from one run to the next.
 *
 * Pure, like `step`: the clock component hands it the run it last saw and the
 * run it sees now, and plays whatever comes back. Every rule about which cue
 * follows which transition lives here, where a test can reach it, and none in
 * the component — a decision made inside an effect is one only a browser can
 * check.
 *
 * `running` is part of the input because the component asks again when the
 * clock is paused or resumed without the run moving: a paused clock counts
 * nothing down, and one resumed inside the last seconds counts on from there.
 *
 * A move to another segment, round or set announces the place it arrived at,
 * and so does the same place with more time left than before: the clock only
 * ever counts down, so that is the segment restarted by `back`. Anything else is
 * the same segment one second on, which is silent until the countdown.
 *
 * Skip and back go through the same rules as the tick, with no case of their
 * own. A jump announces where it landed, as the clock getting there would. It
 * never counts down on landing, even on a segment short enough that its first
 * second is inside the countdown window, because a jump is never "one second
 * on".
 *
 * `prefs` is the athlete's say in how (#105): how long the countdown is, and
 * whether a change buzzes, is spoken and flashes as well as sounded. Left out,
 * it is `CUE_DEFAULTS`.
 *
 * The voice (#106) follows the sound exactly: it names the segment arrived in
 * and says each countdown beat as a number. It names the segment and not the
 * cue, so prepare handing over says "work" while the sound plays its own "go".
 *
 * The flash (#107) marks a segment change only, in the colour of the segment
 * arrived in. A countdown beat is the same segment, so it never flashes.
 *
 * `reducedMotion` is the device's say (#107): whether the athlete asked their
 * system for reduced motion. It is a fact about the device rather than a
 * preference the account carries, so it sits with the move, not with `prefs`.
 * Under it the flash is still planned — the athlete did not switch it off — but
 * it finishes inside one frame, as everything in the app does (ADR 0011), which
 * means it is over before it is drawn.
 */
export function planCues(
	{
		from,
		to,
		running,
		reducedMotion = false,
	}: {
		from: Run;
		to: Run;
		running: boolean;
		reducedMotion?: boolean;
	},
	prefs: CuePrefs = CUE_DEFAULTS,
): Delivery[] {
	if (samePlace(from, to) && to.remaining <= from.remaining) {
		if (!running || to.remaining <= 0 || to.remaining > prefs.countdown) return [];
		const beat: Delivery[] = [{ kind: 'sound', cue: 'countdown' }];
		if (prefs.voice) beat.push({ kind: 'speech', key: 'cues_say_count', n: to.remaining });
		return beat;
	}
	// Prepare handing over to work is the one transition that gets its own
	// two-note cue: it is the moment the athlete has to move, and a single beep
	// identical to every other single beep is not enough to act on blind.
	const cue = from.segment === 'prepare' && to.segment === 'work' ? 'go' : ARRIVAL[to.segment];
	if (!cue || to.segment === 'idle') return [];
	const out: Delivery[] = [{ kind: 'sound', cue }];
	if (prefs.buzz) out.push({ kind: 'buzz', cue });
	if (prefs.voice) out.push({ kind: 'speech', key: phraseOf(to.segment) });
	if (prefs.flash)
		out.push({ kind: 'flash', segment: to.segment, ms: reducedMotion ? 0 : FLASH_MS });
	return out;
}
