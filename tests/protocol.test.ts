// The interval protocol, driven a second at a time.
//
// This is the test the four prototypes could not write, because each of them had
// the arithmetic tangled into a component. Running the whole protocol tick by
// tick and asserting the segment sequence is the only way to catch an off-by-one
// in a transition that only happens on the last round of the last set.
import { describe, expect, test } from 'vitest';
import {
	back,
	beginning,
	CUE_DEFAULTS,
	type Delivery,
	elapsedOf,
	IDLE,
	nextOf,
	type Protocol,
	planCues,
	protocolOf,
	type Run,
	readProtocol,
	remainingOf,
	type Segment,
	segmentLengthOf,
	skip,
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
	cooldown: 0,
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
		{ prepare: 0, work: 5, rest: 0, rounds: 1, sets: 1, setRest: 0, cooldown: 0 },
		{ prepare: 3, work: 2, rest: 1, rounds: 4, sets: 1, setRest: 0, cooldown: 0 },
		{ prepare: 0, work: 2, rest: 1, rounds: 1, sets: 3, setRest: 6, cooldown: 0 },
		{ prepare: 7, work: 3, rest: 2, rounds: 3, sets: 2, setRest: 9, cooldown: 0 },
	])('agrees with the clock for %j', (c) => {
		expect(run(c).seconds).toBe(totalOf(c));
	});

	test('runs prepare, then work/rest per round, then the set rest, then finishes', () => {
		const { segments } = run({
			prepare: 3,
			work: 2,
			rest: 1,
			rounds: 2,
			sets: 2,
			setRest: 4,
			cooldown: 0,
		});
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
		const c = { prepare: 0, work: 2, rest: 5, rounds: 2, sets: 1, setRest: 0, cooldown: 0 };
		expect(run(c).segments).toEqual(['work', 'rest', 'work', 'done']);
		// Two efforts and exactly one rest between them.
		expect(run(c).seconds).toBe(2 * 2 + 5);
	});

	// `run` collapses consecutive identical segments, so back-to-back rounds with no
	// rest between them show as one `work` — the assertion that matters is that
	// both rounds were actually spent rather than one being swallowed.
	test('skips a zero-length segment rather than sitting in it', () => {
		const noRest = run({
			prepare: 0,
			work: 2,
			rest: 0,
			rounds: 2,
			sets: 1,
			setRest: 0,
			cooldown: 0,
		});
		expect(noRest.segments).toEqual(['work', 'done']);
		expect(noRest.seconds).toBe(4);

		const noSetRest = run({
			prepare: 0,
			work: 2,
			rest: 0,
			rounds: 1,
			sets: 2,
			setRest: 0,
			cooldown: 0,
		});
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
			cooldown: 0,
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

	// Skip and back never invent a position: they land only on seconds the clock
	// itself passes through, so the total, the time left and the progress bar
	// read the same after a jump as they would have had the clock got there.
	test('a skip or a back lands on a second the clock passes through', () => {
		const passed = new Set<string>();
		const trace: Run[] = [];
		for (let r = beginning(REPEATERS); ; r = step(r, REPEATERS)) {
			passed.add(JSON.stringify(r));
			trace.push(r);
			if (r.segment === 'done') break;
		}
		for (const r of trace) {
			for (const jumped of [skip(r, REPEATERS), back(r, REPEATERS)]) {
				expect(passed.has(JSON.stringify(jumped)), JSON.stringify({ r, jumped })).toBe(true);
				expect(elapsedOf(jumped, REPEATERS) + remainingOf(jumped, REPEATERS)).toBe(SECONDS);
			}
		}
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

/** Two rounds, two sets, every segment present — short enough to write out. */
const SMALL: Protocol = {
	prepare: 3,
	work: 2,
	rest: 1,
	rounds: 2,
	sets: 2,
	setRest: 4,
	cooldown: 0,
};

/** Every segment of `SMALL`, at its first second, in the order the clock runs them.
 *  Written out by hand from the protocol's rules rather than generated, so the
 *  jumps below are checked against something they did not compute. */
const SMALL_STARTS: Run[] = [
	{ segment: 'prepare', remaining: 3, round: 1, set: 1 },
	{ segment: 'work', remaining: 2, round: 1, set: 1 },
	{ segment: 'rest', remaining: 1, round: 2, set: 1 },
	{ segment: 'work', remaining: 2, round: 2, set: 1 },
	{ segment: 'setRest', remaining: 4, round: 2, set: 1 },
	{ segment: 'work', remaining: 2, round: 1, set: 2 },
	{ segment: 'rest', remaining: 1, round: 2, set: 2 },
	{ segment: 'work', remaining: 2, round: 2, set: 2 },
];
const SMALL_DONE: Run = { segment: 'done', remaining: 0, round: 2, set: 2 };

describe('skipping a segment', () => {
	test('from the start of each segment, lands on the start of the next', () => {
		const visited: Run[] = [];
		let r = beginning(SMALL);
		while (r.segment !== 'done') {
			visited.push(r);
			r = skip(r, SMALL);
		}
		expect(visited).toEqual(SMALL_STARTS);
		expect(r).toEqual(SMALL_DONE);
	});

	test('from part-way through a segment, lands on the start of the next', () => {
		const midSetRest: Run = { segment: 'setRest', remaining: 2, round: 2, set: 1 };
		expect(skip(midSetRest, SMALL)).toEqual(SMALL_STARTS[5]);
		const midPrepare: Run = { segment: 'prepare', remaining: 1, round: 1, set: 1 };
		expect(skip(midPrepare, SMALL)).toEqual(SMALL_STARTS[1]);
	});

	test('from the last segment, finishes the protocol', () => {
		expect(skip({ segment: 'work', remaining: 1, round: 2, set: 2 }, SMALL)).toEqual(SMALL_DONE);
	});

	test('is total — idle and done return themselves', () => {
		expect(skip(IDLE, SMALL)).toEqual(IDLE);
		expect(skip(SMALL_DONE, SMALL)).toEqual(SMALL_DONE);
	});
});

describe('going back a segment', () => {
	test('at the start of a segment, goes to the start of the one before', () => {
		for (let i = 1; i < SMALL_STARTS.length; i++) {
			expect(back(SMALL_STARTS[i], SMALL)).toEqual(SMALL_STARTS[i - 1]);
		}
	});

	test('from the first segment, restarts it', () => {
		expect(back(SMALL_STARTS[0], SMALL)).toEqual(SMALL_STARTS[0]);
		expect(back({ segment: 'prepare', remaining: 1, round: 1, set: 1 }, SMALL)).toEqual(
			SMALL_STARTS[0],
		);
	});

	// A 10s effort: up to three seconds in, back means "the one before"; past
	// that, it means "redo this one".
	test('restarts the segment once it has run for more than three seconds', () => {
		const c: Protocol = {
			prepare: 5,
			work: 10,
			rest: 6,
			rounds: 2,
			sets: 1,
			setRest: 0,
			cooldown: 0,
		};
		const work = (remaining: number): Run => ({ segment: 'work', remaining, round: 1, set: 1 });
		const prepare: Run = { segment: 'prepare', remaining: 5, round: 1, set: 1 };
		expect(back(work(9), c)).toEqual(prepare);
		expect(back(work(7), c)).toEqual(prepare);
		expect(back(work(6), c)).toEqual(work(10));
		expect(back(work(1), c)).toEqual(work(10));
	});

	// Finishing on a botched last hang is the case back exists for.
	test('from done, goes to the start of the last segment', () => {
		expect(back(SMALL_DONE, SMALL)).toEqual(SMALL_STARTS[SMALL_STARTS.length - 1]);
	});

	test('undoes a skip taken at the start of a segment', () => {
		for (const start of SMALL_STARTS) {
			expect(back(skip(start, SMALL), SMALL)).toEqual(start);
		}
	});

	test('is total — idle returns itself', () => {
		expect(back(IDLE, SMALL)).toEqual(IDLE);
	});

	// A field edited mid-run can leave the clock somewhere the protocol no longer
	// goes — round 4 of what is now a two-round set. There is no "before" to find,
	// so back redoes the segment it is in.
	test('in a round the edited protocol no longer has, restarts the segment', () => {
		const stranded: Run = { segment: 'work', remaining: 1, round: 4, set: 1 };
		expect(back(stranded, SMALL)).toEqual({ ...stranded, remaining: 2 });
	});
});

// Cooldown (#104): the easy minutes after the last set, a segment of their own.
// `SMALL` with five seconds of it, written out by hand like `SMALL_STARTS`.
const COOLED: Protocol = { ...SMALL, cooldown: 5 };
const COOLED_LAST_WORK: Run = { segment: 'work', remaining: 2, round: 2, set: 2 };
const COOLED_COOLDOWN: Run = { segment: 'cooldown', remaining: 5, round: 2, set: 2 };
const COOLED_DONE: Run = { segment: 'done', remaining: 0, round: 2, set: 2 };

describe('a cooldown', () => {
	test('runs after the last set, and then the protocol is done', () => {
		expect(run(COOLED).segments).toEqual([
			'prepare',
			'work',
			'rest',
			'work',
			'setRest',
			'work',
			'rest',
			'work',
			'cooldown',
			'done',
		]);
	});

	test('is not in the segment order at all when it is zero', () => {
		expect(run(SMALL).segments).not.toContain('cooldown');
	});

	// SMALL: 3 + 2 × (2 + 1 + 2) + 4 = 17s; five of cooldown makes 22.
	test('counts toward the total, and the clock spends exactly that', () => {
		expect(totalOf(SMALL)).toBe(17);
		expect(totalOf(COOLED)).toBe(22);
		expect(run(COOLED).seconds).toBe(22);
	});

	test('keeps elapsed and remaining adding up, one second per tick, through to done', () => {
		let r = beginning(COOLED);
		for (let i = 0; i < 22; i++) {
			expect(elapsedOf(r, COOLED)).toBe(i);
			expect(remainingOf(r, COOLED)).toBe(22 - i);
			r = step(r, COOLED);
		}
		expect(r).toEqual(COOLED_DONE);
		expect(remainingOf(r, COOLED)).toBe(0);
	});

	test('is five seconds long on the ring', () => {
		expect(segmentLengthOf(COOLED_COOLDOWN, COOLED)).toBe(5);
		expect(segmentLengthOf({ ...COOLED_COOLDOWN, remaining: 2 }, COOLED)).toBe(5);
	});

	test('is what the last effort previews, and it previews done', () => {
		expect(nextOf(COOLED_LAST_WORK, COOLED)).toEqual({ segment: 'cooldown', seconds: 5 });
		expect(nextOf(COOLED_COOLDOWN, COOLED)).toEqual({ segment: 'done', seconds: 0 });
		expect(nextOf(COOLED_LAST_WORK, SMALL)).toEqual({ segment: 'done', seconds: 0 });
	});

	test('is where a skip from the last effort lands, and a skip from it finishes', () => {
		expect(skip(COOLED_LAST_WORK, COOLED)).toEqual(COOLED_COOLDOWN);
		expect(skip({ ...COOLED_COOLDOWN, remaining: 3 }, COOLED)).toEqual(COOLED_DONE);
	});

	test('goes back to the last effort from its start, and restarts once it has run', () => {
		expect(back(COOLED_COOLDOWN, COOLED)).toEqual(COOLED_LAST_WORK);
		expect(back({ ...COOLED_COOLDOWN, remaining: 1 }, COOLED)).toEqual(COOLED_COOLDOWN);
	});

	test('is where back from done goes', () => {
		expect(back(COOLED_DONE, COOLED)).toEqual(COOLED_COOLDOWN);
	});

	test('jumps only to seconds the clock passes through', () => {
		const passed = new Set<string>();
		const trace: Run[] = [];
		for (let r = beginning(COOLED); ; r = step(r, COOLED)) {
			passed.add(JSON.stringify(r));
			trace.push(r);
			if (r.segment === 'done') break;
		}
		for (const r of trace) {
			for (const jumped of [skip(r, COOLED), back(r, COOLED)]) {
				expect(passed.has(JSON.stringify(jumped)), JSON.stringify({ r, jumped })).toBe(true);
			}
		}
	});

	test('is announced as its own cue and phrase, and counted down like any segment', () => {
		const last: Run = { ...COOLED_LAST_WORK, remaining: 1 };
		expect(planCues({ from: last, to: step(last, COOLED), running: true })).toEqual([
			{ kind: 'sound', cue: 'cooldown' },
			{ kind: 'buzz', cue: 'cooldown' },
			{ kind: 'speech', key: 'cues_say_cooldown' },
			// And it flashes in its own colour, as every change does (#107).
			{ kind: 'flash', segment: 'cooldown', ms: expect.any(Number) },
		]);
		const ending: Run = { ...COOLED_COOLDOWN, remaining: 1 };
		expect(
			planCues({ from: { ...ending, remaining: 2 }, to: ending, running: true }),
		).toContainEqual({ kind: 'sound', cue: 'countdown' });
		expect(planCues({ from: ending, to: step(ending, COOLED), running: true })).toEqual([
			{ kind: 'sound', cue: 'done' },
			{ kind: 'buzz', cue: 'done' },
			{ kind: 'speech', key: 'cues_say_done' },
			{ kind: 'flash', segment: 'done', ms: expect.any(Number) },
		]);
	});
});

// What the clock reads a protocol out of — a stored draft, a synced row — was
// written by whatever build was current, and a build before #104 wrote no
// cooldown. Read as none, so the protocol runs exactly as it did.
describe('reading a protocol back', () => {
	const BEFORE_COOLDOWN = { prepare: 10, work: 7, rest: 3, rounds: 6, sets: 4, setRest: 180 };

	test('reads a missing cooldown as none', () => {
		expect(readProtocol(BEFORE_COOLDOWN)).toEqual({ ...BEFORE_COOLDOWN, cooldown: 0 });
	});

	test('keeps a cooldown that is there', () => {
		expect(readProtocol({ ...BEFORE_COOLDOWN, cooldown: 120 })?.cooldown).toBe(120);
	});

	test.each([
		['nothing', null],
		['a number', 7],
		['a field missing', { prepare: 10, work: 7, rest: 3, rounds: 6, sets: 4 }],
		['a field that is not a number', { ...BEFORE_COOLDOWN, work: '7' }],
		['a field that is not finite', { ...BEFORE_COOLDOWN, rest: Number.NaN }],
		['a cooldown that is not a number', { ...BEFORE_COOLDOWN, cooldown: 'none' }],
	])('refuses %s', (_, value) => {
		expect(readProtocol(value)).toBeNull();
	});
});

// Which cues a transition fires used to be decided inside the clock component,
// out of reach of any test. These pin today's behaviour — the SvelteKit app's,
// carried over — so the cue tickets that follow change it on purpose and not by
// accident.
/** A plan without its flash. The tests below pin what the athlete hears, feels
 *  and is told; the flash (#107) is seen, and is pinned in its own block below so
 *  that adding it moved none of these. */
const unflashed = (planned: Delivery[]) => planned.filter((d) => d.kind !== 'flash');

describe('the cue planner', () => {
	const START = beginning(REPEATERS);

	test('pressing Start sounds and buzzes the start cue, and says prepare', () => {
		expect(unflashed(planCues({ from: IDLE, to: START, running: true }))).toEqual([
			{ kind: 'sound', cue: 'start' },
			{ kind: 'buzz', cue: 'start' },
			{ kind: 'speech', key: 'cues_say_prepare' },
		]);
	});

	// No prepare: the run opens on work, and work is what it announces. Only
	// prepare handing over earns "go".
	test('pressing Start with no prepare announces work, not go', () => {
		const c = { ...REPEATERS, prepare: 0 };
		expect(unflashed(planCues({ from: IDLE, to: beginning(c), running: true }))).toEqual([
			{ kind: 'sound', cue: 'work' },
			{ kind: 'buzz', cue: 'work' },
			{ kind: 'speech', key: 'cues_say_work' },
		]);
	});

	test.each<{ name: string; from: Run; to: Run; cue: string; say: string }>([
		{
			name: 'prepare → work',
			from: { segment: 'prepare', remaining: 1, round: 1, set: 1 },
			to: { segment: 'work', remaining: 7, round: 1, set: 1 },
			cue: 'go',
			say: 'cues_say_work',
		},
		{
			name: 'work → rest',
			from: { segment: 'work', remaining: 1, round: 1, set: 1 },
			to: { segment: 'rest', remaining: 3, round: 2, set: 1 },
			cue: 'rest',
			say: 'cues_say_rest',
		},
		{
			name: 'rest → work',
			from: { segment: 'rest', remaining: 1, round: 2, set: 1 },
			to: { segment: 'work', remaining: 7, round: 2, set: 1 },
			cue: 'work',
			say: 'cues_say_work',
		},
		{
			name: 'work → work, with no rest between rounds',
			from: { segment: 'work', remaining: 1, round: 1, set: 1 },
			to: { segment: 'work', remaining: 7, round: 2, set: 1 },
			cue: 'work',
			say: 'cues_say_work',
		},
		{
			name: 'end of a set → set rest',
			from: { segment: 'work', remaining: 1, round: 6, set: 1 },
			to: { segment: 'setRest', remaining: 180, round: 6, set: 1 },
			cue: 'setRest',
			say: 'cues_say_setrest',
		},
		{
			name: 'set rest → work',
			from: { segment: 'setRest', remaining: 1, round: 6, set: 1 },
			to: { segment: 'work', remaining: 7, round: 1, set: 2 },
			cue: 'work',
			say: 'cues_say_work',
		},
		{
			name: 'end of a set → work, with no set rest',
			from: { segment: 'work', remaining: 1, round: 6, set: 1 },
			to: { segment: 'work', remaining: 7, round: 1, set: 2 },
			cue: 'work',
			say: 'cues_say_work',
		},
		{
			name: 'the last effort → done',
			from: { segment: 'work', remaining: 1, round: 6, set: 2 },
			to: { segment: 'done', remaining: 0, round: 6, set: 2 },
			cue: 'done',
			say: 'cues_say_done',
		},
	])('$name sounds and buzzes $cue, and says $say', ({ from, to, cue, say }) => {
		expect(unflashed(planCues({ from, to, running: true }))).toEqual([
			{ kind: 'sound', cue },
			{ kind: 'buzz', cue },
			{ kind: 'speech', key: say },
		]);
	});

	// Three, two, one — sounded and spoken, never buzzed.
	test('counts down the last three seconds of a segment aloud, with no buzz', () => {
		const at = (remaining: number) =>
			unflashed(
				planCues({
					from: { segment: 'work', remaining: remaining + 1, round: 1, set: 1 },
					to: { segment: 'work', remaining, round: 1, set: 1 },
					running: true,
				}),
			);
		expect(at(4)).toEqual([]);
		for (const remaining of [3, 2, 1]) {
			expect(at(remaining)).toEqual([
				{ kind: 'sound', cue: 'countdown' },
				{ kind: 'speech', key: 'cues_say_count', n: remaining },
			]);
		}
	});

	test('a paused clock counts nothing down', () => {
		const r: Run = { segment: 'rest', remaining: 2, round: 2, set: 1 };
		expect(unflashed(planCues({ from: r, to: r, running: false }))).toEqual([]);
	});

	test('resetting to idle is silent', () => {
		const r: Run = { segment: 'work', remaining: 5, round: 3, set: 1 };
		expect(unflashed(planCues({ from: r, to: IDLE, running: false }))).toEqual([]);
	});

	// A skip is a change of segment the athlete asked for, and it sounds like one:
	// the segment it lands on is announced exactly as if the clock had got there.
	test.each<{ name: string; from: Run; cue: string; say: string }>([
		{
			name: 'skipping prepare',
			from: { segment: 'prepare', remaining: 2, round: 1, set: 1 },
			cue: 'go',
			say: 'cues_say_work',
		},
		{
			name: 'skipping an effort',
			from: { segment: 'work', remaining: 2, round: 1, set: 1 },
			cue: 'rest',
			say: 'cues_say_rest',
		},
		{
			name: 'skipping a rest',
			from: { segment: 'rest', remaining: 1, round: 2, set: 1 },
			cue: 'work',
			say: 'cues_say_work',
		},
		{
			name: 'skipping the last effort of a set',
			from: { segment: 'work', remaining: 2, round: 2, set: 1 },
			cue: 'setRest',
			say: 'cues_say_setrest',
		},
		{
			name: 'skipping the set rest',
			from: { segment: 'setRest', remaining: 3, round: 2, set: 1 },
			cue: 'work',
			say: 'cues_say_work',
		},
		{
			name: 'skipping the last effort',
			from: { segment: 'work', remaining: 2, round: 2, set: 2 },
			cue: 'done',
			say: 'cues_say_done',
		},
	])('$name announces $cue, as the clock getting there would', ({ from, cue, say }) => {
		expect(unflashed(planCues({ from, to: skip(from, SMALL), running: true }))).toEqual([
			{ kind: 'sound', cue },
			{ kind: 'buzz', cue },
			{ kind: 'speech', key: say },
		]);
	});

	// `SMALL`'s rests are one second long, so the second a skip lands on is
	// inside the countdown window. It is announced, not counted: the countdown is
	// for the seconds that follow, as it is when the clock arrives on its own.
	test('a skip into a short segment announces it and counts nothing', () => {
		const from: Run = { segment: 'work', remaining: 2, round: 1, set: 1 };
		const heard = unflashed(planCues({ from, to: skip(from, SMALL), running: true }));
		expect(heard).not.toContainEqual({ kind: 'sound', cue: 'countdown' });
		expect(heard).not.toContainEqual(expect.objectContaining({ key: 'cues_say_count' }));
	});

	test('going back to the segment before announces that segment', () => {
		const work: Run = { segment: 'work', remaining: 2, round: 2, set: 1 };
		expect(unflashed(planCues({ from: work, to: back(work, SMALL), running: true }))).toEqual([
			{ kind: 'sound', cue: 'rest' },
			{ kind: 'buzz', cue: 'rest' },
			{ kind: 'speech', key: 'cues_say_rest' },
		]);
	});

	// Restarting stays in the same segment, round and set, so it would otherwise
	// read as one second on — silent. It is the effort starting again, and the
	// athlete hears it start.
	test('restarting a segment announces it again', () => {
		const c: Protocol = {
			prepare: 5,
			work: 10,
			rest: 6,
			rounds: 2,
			sets: 1,
			setRest: 0,
			cooldown: 0,
		};
		const late: Run = { segment: 'work', remaining: 2, round: 1, set: 1 };
		const restarted = back(late, c);
		expect(restarted.remaining).toBe(10);
		expect(unflashed(planCues({ from: late, to: restarted, running: true }))).toEqual([
			{ kind: 'sound', cue: 'work' },
			{ kind: 'buzz', cue: 'work' },
			{ kind: 'speech', key: 'cues_say_work' },
		]);
	});

	// The whole session, a second at a time, as the clock drives it. What the
	// athlete hears on a 2-round, 2-set protocol with every segment in it.
	test('cues a whole session in the order the athlete hears it', () => {
		const c: Protocol = {
			prepare: 4,
			work: 4,
			rest: 2,
			rounds: 2,
			sets: 2,
			setRest: 5,
			cooldown: 0,
		};
		const heard: string[] = [];
		let before = IDLE;
		let r = beginning(c);
		for (;;) {
			for (const d of unflashed(planCues({ from: before, to: r, running: true }))) {
				heard.push(
					d.kind === 'speech'
						? `speech:${d.key.slice(9)}${'n' in d ? d.n : ''}`
						: `${d.kind}:${d.cue}`,
				);
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
		// The voice says what the beeps mean: each place by name, and the
		// countdown as numbers, beat for beat with its sound.
		const said = heard.filter((h) => h.startsWith('speech:')).map((h) => h.slice(7));
		const spoken = ['count3', 'count2', 'count1'];
		expect(said).toEqual([
			'prepare',
			...spoken,
			'work',
			...spoken,
			'rest',
			'count1',
			'work',
			...spoken,
			'setrest',
			...spoken,
			'work',
			...spoken,
			'rest',
			'count1',
			'work',
			...spoken,
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
		unflashed(
			planCues(
				{
					from: { segment: 'work', remaining: remaining + 1, round: 1, set: 1 },
					to: { segment: 'work', remaining, round: 1, set: 1 },
					running: true,
				},
				prefs,
			),
		);
	const count = (n: number) => [
		{ kind: 'sound', cue: 'countdown' },
		{ kind: 'speech', key: 'cues_say_count', n },
	];

	/** Everything a whole REPEATERS session plans, in order, as `kind:what`. */
	const heard = (prefs?: Parameters<typeof planCues>[1]) => {
		const out: string[] = [];
		let before = IDLE;
		let r = beginning(REPEATERS);
		for (;;) {
			for (const d of unflashed(planCues({ from: before, to: r, running: true }, prefs))) {
				out.push(
					d.kind === 'speech' ? `speech:${d.key}${'n' in d ? d.n : ''}` : `${d.kind}:${d.cue}`,
				);
			}
			if (r.segment === 'done') break;
			before = r;
			r = step(r, REPEATERS);
		}
		return out;
	};

	test.each([
		3, 5, 10,
	] as const)('a %is countdown counts exactly the last %i seconds', (countdown) => {
		const counted = Array.from({ length: 20 }, (_, i) => 20 - i).filter(
			(remaining) => at(remaining, { ...CUE_DEFAULTS, countdown }).length > 0,
		);
		expect(counted).toEqual(
			{ 3: [3, 2, 1], 5: [5, 4, 3, 2, 1], 10: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] }[countdown],
		);
		expect(at(1, { ...CUE_DEFAULTS, countdown })).toEqual(count(1));
		expect(at(countdown, { ...CUE_DEFAULTS, countdown })).toEqual(count(countdown));
	});

	test('the defaults are three seconds, the buzz on, the voice on and the flash on', () => {
		expect(CUE_DEFAULTS).toEqual({ countdown: 3, buzz: true, voice: true, flash: true });
		expect(at(4)).toEqual([]);
		expect(at(3)).toEqual(count(3));
	});

	test('with the buzz off, a segment change only sounds', () => {
		const off = { ...CUE_DEFAULTS, buzz: false };
		expect(
			unflashed(
				planCues(
					{
						from: { segment: 'prepare', remaining: 1, round: 1, set: 1 },
						to: { segment: 'work', remaining: 7, round: 1, set: 1 },
						running: true,
					},
					off,
				),
			),
		).toEqual([
			{ kind: 'sound', cue: 'go' },
			{ kind: 'speech', key: 'cues_say_work' },
		]);
		expect(
			unflashed(planCues({ from: IDLE, to: beginning(REPEATERS), running: true }, off)),
		).toEqual([
			{ kind: 'sound', cue: 'start' },
			{ kind: 'speech', key: 'cues_say_prepare' },
		]);
	});

	test('with the buzz off, a whole session never buzzes and sounds exactly what it did', () => {
		const quiet = heard({ ...CUE_DEFAULTS, buzz: false });
		expect(quiet.filter((h) => h.startsWith('buzz:'))).toEqual([]);
		expect(quiet).toEqual(heard().filter((h) => !h.startsWith('buzz:')));
		expect(quiet.filter((h) => h.startsWith('sound:')).at(-1)).toBe('sound:done');
	});

	// #106. Nothing is planned for the voice when it is off — not a phrase, not
	// a number — and nothing else moves: the beeps carry the timing alone.
	test('with the voice off, a whole session says nothing and sounds and buzzes exactly what it did', () => {
		const silent = heard({ ...CUE_DEFAULTS, voice: false });
		expect(silent.filter((h) => h.startsWith('speech:'))).toEqual([]);
		expect(silent).toEqual(heard().filter((h) => !h.startsWith('speech:')));
		expect(silent.at(-1)).toBe('buzz:done');
	});

	test('with the voice off, the countdown only beeps', () => {
		expect(at(2, { ...CUE_DEFAULTS, voice: false, countdown: 5 })).toEqual([
			{ kind: 'sound', cue: 'countdown' },
		]);
	});
});

// The screen flash (#107): the segment change seen from the corner of the eye.
// It is planned with the other deliveries, so whether it shows, in which
// colour, and how long it lasts under reduced motion are all decided here.
describe('the flash on a segment change', () => {
	/** A protocol with every segment in it, run a second at a time from Start. */
	const ALL: Protocol = {
		prepare: 4,
		work: 4,
		rest: 2,
		rounds: 2,
		sets: 2,
		setRest: 5,
		cooldown: 3,
	};
	const session = (
		prefs?: Parameters<typeof planCues>[1],
		reducedMotion?: boolean,
	): Delivery[][] => {
		const out: Delivery[][] = [];
		let before = IDLE;
		let r = beginning(ALL);
		for (;;) {
			out.push(planCues({ from: before, to: r, running: true, reducedMotion }, prefs));
			if (r.segment === 'done') break;
			before = r;
			r = step(r, ALL);
		}
		return out;
	};
	const flashes = (planned: Delivery[][]) => planned.flat().filter((d) => d.kind === 'flash');

	test('flashes once on every segment change, in the segment it arrives in', () => {
		expect(flashes(session()).map((d) => d.segment)).toEqual([
			'prepare',
			'work',
			'rest',
			'work',
			'setRest',
			'work',
			'rest',
			'work',
			'cooldown',
			'done',
		]);
	});

	test('flashes exactly when the change is announced, and never on a countdown second', () => {
		for (const planned of session()) {
			const announced = planned.some((d) => d.kind === 'sound' && d.cue !== 'countdown');
			expect(planned.some((d) => d.kind === 'flash')).toBe(announced);
		}
	});

	test.each<{ name: string; from: Run; to: Run; segment: Segment }>([
		{
			name: 'prepare → work',
			from: { segment: 'prepare', remaining: 1, round: 1, set: 1 },
			to: { segment: 'work', remaining: 7, round: 1, set: 1 },
			segment: 'work',
		},
		{
			name: 'work → rest',
			from: { segment: 'work', remaining: 1, round: 1, set: 1 },
			to: { segment: 'rest', remaining: 3, round: 2, set: 1 },
			segment: 'rest',
		},
		{
			name: 'work → work, with no rest between rounds',
			from: { segment: 'work', remaining: 1, round: 1, set: 1 },
			to: { segment: 'work', remaining: 7, round: 2, set: 1 },
			segment: 'work',
		},
		{
			name: 'end of a set → set rest',
			from: { segment: 'work', remaining: 1, round: 6, set: 1 },
			to: { segment: 'setRest', remaining: 180, round: 6, set: 1 },
			segment: 'setRest',
		},
		{
			name: 'the last effort → done',
			from: { segment: 'work', remaining: 1, round: 6, set: 2 },
			to: { segment: 'done', remaining: 0, round: 6, set: 2 },
			segment: 'done',
		},
	])('$name flashes $segment', ({ from, to, segment }) => {
		const flash = planCues({ from, to, running: true }).filter((d) => d.kind === 'flash');
		expect(flash).toEqual([{ kind: 'flash', segment, ms: expect.any(Number) }]);
	});

	// A jump is announced where it lands, so it flashes there too — the skip the
	// athlete tapped from the wall is confirmed without looking.
	test('a skip, a back and a restart each flash the segment they land on', () => {
		const work: Run = { segment: 'work', remaining: 2, round: 2, set: 1 };
		const landed = (to: Run) =>
			planCues({ from: work, to, running: true }).filter((d) => d.kind === 'flash');
		expect(landed(skip(work, SMALL))).toEqual([
			{ kind: 'flash', segment: 'setRest', ms: expect.any(Number) },
		]);
		expect(landed(back(work, SMALL))).toEqual([
			{ kind: 'flash', segment: 'rest', ms: expect.any(Number) },
		]);
		const c: Protocol = {
			prepare: 5,
			work: 10,
			rest: 6,
			rounds: 2,
			sets: 1,
			setRest: 0,
			cooldown: 0,
		};
		const late: Run = { segment: 'work', remaining: 2, round: 1, set: 1 };
		expect(
			planCues({ from: late, to: back(late, c), running: true }).filter((d) => d.kind === 'flash'),
		).toEqual([{ kind: 'flash', segment: 'work', ms: expect.any(Number) }]);
	});

	test('a paused clock, a plain second and a reset never flash', () => {
		const r: Run = { segment: 'rest', remaining: 8, round: 2, set: 1 };
		expect(planCues({ from: r, to: r, running: false })).toEqual([]);
		expect(planCues({ from: r, to: { ...r, remaining: 7 }, running: true })).toEqual([]);
		expect(planCues({ from: r, to: IDLE, running: false })).toEqual([]);
	});

	test('lasts long enough to be caught from the corner of the eye', () => {
		for (const d of flashes(session())) expect(d.ms).toBeGreaterThanOrEqual(250);
	});

	// ADR 0011: under reduced motion every animation finishes inside one frame.
	// The flash is still planned — it is a delivery like the others, and the
	// athlete did not switch it off — but it is over before a frame is drawn.
	test('under reduced motion, finishes in one frame', () => {
		const reduced = flashes(session(undefined, true));
		expect(reduced).toHaveLength(10);
		for (const d of reduced) expect(d.ms).toBe(0);
	});

	test('reduced motion changes the flash and nothing else', () => {
		const strip = (planned: Delivery[][]) =>
			planned.map((ds) => ds.filter((d) => d.kind !== 'flash'));
		expect(strip(session(undefined, true))).toEqual(strip(session()));
	});

	test('switched off, nothing flashes and everything else is planned as before', () => {
		const off = session({ ...CUE_DEFAULTS, flash: false });
		expect(flashes(off)).toEqual([]);
		expect(off).toEqual(session().map((ds) => ds.filter((d) => d.kind !== 'flash')));
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
		).toEqual({ prepare: 10, work: 7, rest: 3, rounds: 6, sets: 4, setRest: 180, cooldown: 0 });
	});

	test('reads a single effort per set when the variant names no rounds', () => {
		expect(protocolOf({ workSec: { min: 10, max: 10 }, sets: { min: 3, max: 3 } })).toEqual({
			prepare: 10,
			work: 10,
			rest: 0,
			rounds: 1,
			sets: 3,
			setRest: 0,
			cooldown: 0,
		});
	});

	test('keeps a prepare length the variant sets', () => {
		expect(protocolOf({ workSec: { min: 5, max: 5 }, prepareSec: 3 })?.prepare).toBe(3);
	});

	test('has nothing to run for a variant with no work length', () => {
		expect(protocolOf({ reps: { min: 4, max: 6 }, sets: { min: 3, max: 4 } })).toBeNull();
	});
});
