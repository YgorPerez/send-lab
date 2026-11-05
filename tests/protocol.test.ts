// The interval protocol, driven a second at a time.
//
// This is the test the four prototypes could not write, because each of them had
// the arithmetic tangled into a component. Running the whole protocol tick by
// tick and asserting the segment sequence is the only way to catch an off-by-one
// in a transition that only happens on the last round of the last set.
import { describe, expect, test } from 'vitest';
import {
	beginning,
	CUE_DEFAULTS,
	elapsedOf,
	IDLE,
	nextOf,
	type Protocol,
	planCues,
	protocolOf,
	type Run,
	remainingOf,
	type Segment,
	step,
	totalOf,
} from '../src/lib/protocol.ts';

/** A 6×(7s on / 3s off) repeater, twice, with 3 minutes between sets. */
const REPEATERS: Protocol = {
	prepare: 10,
	work: 7,
	rest: 3,
	rounds: 6,
	sets: 2,
	setRest: 180,
};

/** Run the protocol to completion and report every second of it. */
function run(c: Protocol, limit = 5000): { segments: Segment[]; seconds: number } {
	const segments: Segment[] = [];
	let r = beginning(c);
	let seconds = 0;
	let previous: Segment | null = null;
	while (r.segment !== 'done' && seconds < limit) {
		if (r.segment !== previous) {
			segments.push(r.segment);
			previous = r.segment;
		}
		r = step(r, c);
		seconds += 1;
	}
	segments.push(r.segment);
	return { segments, seconds };
}

describe('the protocol', () => {
	// The claim `totalOf` makes to the athlete, checked against the clock actually
	// ticking. The prototype's formula said 310s here — it billed a rest after the
	// last round of each set, which the protocol does not run.
	// 10 + 2×(6×7 + 5×3) + 180 = 304.
	test('spends exactly the time it says it will', () => {
		expect(totalOf(REPEATERS)).toBe(304);
		expect(run(REPEATERS).seconds).toBe(304);
	});

	test.each([
		{ prepare: 0, work: 5, rest: 0, rounds: 1, sets: 1, setRest: 0 },
		{ prepare: 3, work: 2, rest: 1, rounds: 4, sets: 1, setRest: 0 },
		{ prepare: 0, work: 2, rest: 1, rounds: 1, sets: 3, setRest: 6 },
		{ prepare: 7, work: 3, rest: 2, rounds: 3, sets: 2, setRest: 9 },
	])('agrees with the clock for %j', (c) => {
		expect(run(c).seconds).toBe(totalOf(c));
	});

	test('runs prepare, then work/rest per round, then the set rest, then finishes', () => {
		const { segments } = run({ prepare: 3, work: 2, rest: 1, rounds: 2, sets: 2, setRest: 4 });
		expect(segments).toEqual([
			'prepare',
			'work',
			'rest',
			'work',
			'setRest',
			'work',
			'rest',
			'work',
			'done',
		]);
	});

	// The last round of a set has no rest after it — the set rest takes its place.
	// Getting this wrong adds `rest` seconds per set and is invisible until the
	// session over-runs by half a minute.
	test('does not rest after the final round of a set', () => {
		const c = { prepare: 0, work: 2, rest: 5, rounds: 2, sets: 1, setRest: 0 };
		expect(run(c).segments).toEqual(['work', 'rest', 'work', 'done']);
		// Two efforts and exactly one rest between them.
		expect(run(c).seconds).toBe(2 * 2 + 5);
	});

	// `run` collapses consecutive identical segments, so back-to-back rounds with no
	// rest between them show as one `work` — the assertion that matters is that
	// both rounds were actually spent rather than one being swallowed.
	test('skips a zero-length segment rather than sitting in it', () => {
		const noRest = run({ prepare: 0, work: 2, rest: 0, rounds: 2, sets: 1, setRest: 0 });
		expect(noRest.segments).toEqual(['work', 'done']);
		expect(noRest.seconds).toBe(4);

		const noSetRest = run({ prepare: 0, work: 2, rest: 0, rounds: 1, sets: 2, setRest: 0 });
		expect(noSetRest.segments).toEqual(['work', 'done']);
		expect(noSetRest.seconds).toBe(4);
	});

	test('is total — idle and done return themselves', () => {
		expect(step(IDLE, REPEATERS)).toEqual(IDLE);
		const done: Run = { segment: 'done', remaining: 0, round: 6, set: 2 };
		expect(step(done, REPEATERS)).toEqual(done);
	});

	// A protocol prescribing zero seconds of work would otherwise sit forever on
	// `remaining: 0`, because the tick only advances when `remaining <= 1`.
	test('cannot stall on a zero-second effort', () => {
		const { segments, seconds } = run({
			prepare: 0,
			work: 0,
			rest: 0,
			rounds: 2,
			sets: 1,
			setRest: 0,
		});
		expect(segments[segments.length - 1]).toBe('done');
		expect(seconds).toBeLessThan(10);
	});
});

describe('derived readings', () => {
	const SECONDS = totalOf(REPEATERS);

	test('elapsed and remaining always add up to the total', () => {
		let r = beginning(REPEATERS);
		for (let i = 0; i < SECONDS; i++) {
			expect(elapsedOf(r, REPEATERS) + remainingOf(r, REPEATERS)).toBe(SECONDS);
			r = step(r, REPEATERS);
		}
	});

	// The progress bar is this number. A reading that goes backwards mid-session
	// is the visible symptom of elapsed being counted rather than derived.
	test('elapsed advances by exactly one second per tick, and never rewinds', () => {
		let r = beginning(REPEATERS);
		let previous = elapsedOf(r, REPEATERS);
		for (let i = 0; i < SECONDS; i++) {
			r = step(r, REPEATERS);
			const now = elapsedOf(r, REPEATERS);
			expect(now - previous).toBe(1);
			previous = now;
		}
		expect(previous).toBe(SECONDS);
	});

	test('idle reports nothing done and done reports everything', () => {
		expect(elapsedOf(IDLE, REPEATERS)).toBe(0);
		expect(remainingOf(IDLE, REPEATERS)).toBe(totalOf(REPEATERS));
		const done: Run = { segment: 'done', remaining: 0, round: 6, set: 2 };
		expect(remainingOf(done, REPEATERS)).toBe(0);
	});
});

describe('the next-up preview', () => {
	// The preview and the transition come from the same table, so this asserts
	// they agree rather than asserting a hardcoded sequence twice.
	test('names the segment the protocol actually goes to', () => {
		let r = beginning(REPEATERS);
		while (r.segment !== 'done') {
			const preview = nextOf(r, REPEATERS);
			const after = step({ ...r, remaining: 1 }, REPEATERS);
			expect(preview?.segment).toBe(after.segment);
			r = step(r, REPEATERS);
		}
	});

	test('has nothing to preview before the start or after the end', () => {
		expect(nextOf(IDLE, REPEATERS)).toBeNull();
		expect(nextOf({ segment: 'done', remaining: 0, round: 1, set: 1 }, REPEATERS)).toBeNull();
	});
});

// Which cues a transition fires used to be decided inside the clock component,
// out of reach of any test. These pin today's behaviour — the SvelteKit app's,
// carried over — so the cue tickets that follow change it on purpose and not by
// accident.
describe('the cue planner', () => {
	const START = beginning(REPEATERS);

	test('pressing Start sounds and buzzes the start cue', () => {
		expect(planCues({ from: IDLE, to: START, running: true })).toEqual([
			{ kind: 'sound', cue: 'start' },
			{ kind: 'buzz', cue: 'start' },
		]);
	});

	// No prepare: the run opens on work, and work is what it announces. Only
	// prepare handing over earns "go".
	test('pressing Start with no prepare announces work, not go', () => {
		const c = { ...REPEATERS, prepare: 0 };
		expect(planCues({ from: IDLE, to: beginning(c), running: true })).toEqual([
			{ kind: 'sound', cue: 'work' },
			{ kind: 'buzz', cue: 'work' },
		]);
	});

	test.each<{ name: string; from: Run; to: Run; cue: string }>([
		{
			name: 'prepare → work',
			from: { segment: 'prepare', remaining: 1, round: 1, set: 1 },
			to: { segment: 'work', remaining: 7, round: 1, set: 1 },
			cue: 'go',
		},
		{
			name: 'work → rest',
			from: { segment: 'work', remaining: 1, round: 1, set: 1 },
			to: { segment: 'rest', remaining: 3, round: 2, set: 1 },
			cue: 'rest',
		},
		{
			name: 'rest → work',
			from: { segment: 'rest', remaining: 1, round: 2, set: 1 },
			to: { segment: 'work', remaining: 7, round: 2, set: 1 },
			cue: 'work',
		},
		{
			name: 'work → work, with no rest between rounds',
			from: { segment: 'work', remaining: 1, round: 1, set: 1 },
			to: { segment: 'work', remaining: 7, round: 2, set: 1 },
			cue: 'work',
		},
		{
			name: 'end of a set → set rest',
			from: { segment: 'work', remaining: 1, round: 6, set: 1 },
			to: { segment: 'setRest', remaining: 180, round: 6, set: 1 },
			cue: 'setRest',
		},
		{
			name: 'set rest → work',
			from: { segment: 'setRest', remaining: 1, round: 6, set: 1 },
			to: { segment: 'work', remaining: 7, round: 1, set: 2 },
			cue: 'work',
		},
		{
			name: 'end of a set → work, with no set rest',
			from: { segment: 'work', remaining: 1, round: 6, set: 1 },
			to: { segment: 'work', remaining: 7, round: 1, set: 2 },
			cue: 'work',
		},
		{
			name: 'the last effort → done',
			from: { segment: 'work', remaining: 1, round: 6, set: 2 },
			to: { segment: 'done', remaining: 0, round: 6, set: 2 },
			cue: 'done',
		},
	])('$name sounds and buzzes $cue', ({ from, to, cue }) => {
		expect(planCues({ from, to, running: true })).toEqual([
			{ kind: 'sound', cue },
			{ kind: 'buzz', cue },
		]);
	});

	// Three, two, one — sounded, never buzzed.
	test('counts down the last three seconds of a segment with a sound and no buzz', () => {
		const at = (remaining: number) =>
			planCues({
				from: { segment: 'work', remaining: remaining + 1, round: 1, set: 1 },
				to: { segment: 'work', remaining, round: 1, set: 1 },
				running: true,
			});
		expect(at(4)).toEqual([]);
		for (const remaining of [3, 2, 1]) {
			expect(at(remaining)).toEqual([{ kind: 'sound', cue: 'countdown' }]);
		}
	});

	test('a paused clock counts nothing down', () => {
		const r: Run = { segment: 'rest', remaining: 2, round: 2, set: 1 };
		expect(planCues({ from: r, to: r, running: false })).toEqual([]);
	});

	test('resetting to idle is silent', () => {
		const r: Run = { segment: 'work', remaining: 5, round: 3, set: 1 };
		expect(planCues({ from: r, to: IDLE, running: false })).toEqual([]);
	});

	// The whole session, a second at a time, as the clock drives it. What the
	// athlete hears on a 2-round, 2-set protocol with every segment in it.
	test('cues a whole session in the order the athlete hears it', () => {
		const c: Protocol = { prepare: 4, work: 4, rest: 2, rounds: 2, sets: 2, setRest: 5 };
		const heard: string[] = [];
		let before = IDLE;
		let r = beginning(c);
		for (;;) {
			for (const d of planCues({ from: before, to: r, running: true })) {
				heard.push(`${d.kind}:${d.cue}`);
			}
			if (r.segment === 'done') break;
			before = r;
			r = step(r, c);
		}
		const sounds = heard.filter((h) => h.startsWith('sound:')).map((h) => h.slice(6));
		const buzzes = heard.filter((h) => h.startsWith('buzz:')).map((h) => h.slice(5));
		const counted = ['countdown', 'countdown', 'countdown'];
		expect(sounds).toEqual([
			'start',
			...counted,
			'go',
			...counted,
			// A 2s rest is announced at 2 and counted only at 1.
			'rest',
			'countdown',
			'work',
			...counted,
			'setRest',
			...counted,
			'work',
			...counted,
			'rest',
			'countdown',
			'work',
			...counted,
			'done',
		]);
		expect(buzzes).toEqual([
			'start',
			'go',
			'rest',
			'work',
			'setRest',
			'work',
			'rest',
			'work',
			'done',
		]);
	});
});

// The athlete's cue preferences (#105). The planner takes them as a second
// argument, and leaving it out has to be exactly the behaviour pinned above —
// which is also what an athlete who never opens the setting hears.
describe("the cue planner, under the athlete's cue preferences", () => {
	/** What one second of a long work segment plans, at `remaining` left. */
	const at = (remaining: number, prefs?: Parameters<typeof planCues>[1]) =>
		planCues(
			{
				from: { segment: 'work', remaining: remaining + 1, round: 1, set: 1 },
				to: { segment: 'work', remaining, round: 1, set: 1 },
				running: true,
			},
			prefs,
		);
	const COUNT = [{ kind: 'sound', cue: 'countdown' }];

	test.each([
		3, 5, 10,
	] as const)('a %is countdown counts exactly the last %i seconds', (countdown) => {
		const counted = Array.from({ length: 20 }, (_, i) => 20 - i).filter(
			(remaining) => at(remaining, { ...CUE_DEFAULTS, countdown }).length > 0,
		);
		expect(counted).toEqual(
			{ 3: [3, 2, 1], 5: [5, 4, 3, 2, 1], 10: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] }[countdown],
		);
		expect(at(1, { ...CUE_DEFAULTS, countdown })).toEqual(COUNT);
	});

	test('the defaults are today: three seconds, and the buzz on', () => {
		expect(CUE_DEFAULTS).toEqual({ countdown: 3, buzz: true });
		expect(at(4)).toEqual([]);
		expect(at(3)).toEqual(COUNT);
	});

	test('with the buzz off, a segment change only sounds', () => {
		const off = { ...CUE_DEFAULTS, buzz: false };
		expect(
			planCues(
				{
					from: { segment: 'prepare', remaining: 1, round: 1, set: 1 },
					to: { segment: 'work', remaining: 7, round: 1, set: 1 },
					running: true,
				},
				off,
			),
		).toEqual([{ kind: 'sound', cue: 'go' }]);
		expect(planCues({ from: IDLE, to: beginning(REPEATERS), running: true }, off)).toEqual([
			{ kind: 'sound', cue: 'start' },
		]);
	});

	test('with the buzz off, a whole session never buzzes and sounds exactly what it did', () => {
		const heard = (prefs?: Parameters<typeof planCues>[1]) => {
			const out: string[] = [];
			let before = IDLE;
			let r = beginning(REPEATERS);
			for (;;) {
				for (const d of planCues({ from: before, to: r, running: true }, prefs)) {
					out.push(`${d.kind}:${d.cue}`);
				}
				if (r.segment === 'done') break;
				before = r;
				r = step(r, REPEATERS);
			}
			return out;
		};
		const quiet = heard({ ...CUE_DEFAULTS, buzz: false });
		expect(quiet.filter((h) => h.startsWith('buzz:'))).toEqual([]);
		expect(quiet).toEqual(heard().filter((h) => h.startsWith('sound:')));
		expect(quiet.at(-1)).toBe('sound:done');
	});
});

// The one place a library variant becomes something the clock can run. Train's
// pinned task and the Timer screen's presets both go through it (#101), so a
// preset and a prescription of the same variant cannot run different numbers.
describe("a variant's protocol", () => {
	test('runs the middle of each prescribed range', () => {
		// Repeaters 7/3, as the library writes it: three to four sets.
		expect(
			protocolOf({
				workSec: { min: 7, max: 7 },
				restSec: { min: 3, max: 3 },
				rounds: { min: 6, max: 6 },
				sets: { min: 3, max: 4 },
				setRestSec: { min: 180, max: 180 },
			}),
		).toEqual({ prepare: 10, work: 7, rest: 3, rounds: 6, sets: 4, setRest: 180 });
	});

	test('reads a single effort per set when the variant names no rounds', () => {
		expect(protocolOf({ workSec: { min: 10, max: 10 }, sets: { min: 3, max: 3 } })).toEqual({
			prepare: 10,
			work: 10,
			rest: 0,
			rounds: 1,
			sets: 3,
			setRest: 0,
		});
	});

	test('keeps a prepare length the variant sets', () => {
		expect(protocolOf({ workSec: { min: 5, max: 5 }, prepareSec: 3 })?.prepare).toBe(3);
	});

	test('has nothing to run for a variant with no work length', () => {
		expect(protocolOf({ reps: { min: 4, max: 6 }, sets: { min: 3, max: 4 } })).toBeNull();
	});
});
