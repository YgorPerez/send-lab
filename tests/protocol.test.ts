// The interval protocol, driven a second at a time.
//
// This is the test the four prototypes could not write, because each of them had
// the arithmetic tangled into a component. Running the whole protocol tick by
// tick and asserting the segment sequence is the only way to catch an off-by-one
// in a transition that only happens on the last round of the last set.
import { describe, expect, test } from 'vitest';
import {
	beginning,
	elapsedOf,
	IDLE,
	nextOf,
	type Protocol,
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
