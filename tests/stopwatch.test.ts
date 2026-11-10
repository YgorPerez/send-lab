// The stopwatch, driven the way the clock drives it (#108).
//
// The protocol's sibling: a count-up instead of a countdown, and laps instead of
// segments. Same posture as `protocol.test.ts` — the reducer is total, so every
// operation is asserted from every state that matters, and the lap arithmetic is
// asserted against worked numbers rather than recomputed the way the code does.
import { describe, expect, test } from 'vitest';
import { stopwatchClock } from '../src/lib/format.ts';
import {
	currentLapOf,
	lap,
	lapsOf,
	pause,
	reset,
	type Stopwatch,
	start,
	tick,
	underway,
	ZERO,
} from '../src/lib/stopwatch.ts';
import { restoredStopwatch } from '../src/lib/stopwatchDraft.ts';

/** Run a script of operations from zero. A number is that many ms of ticking. */
function play(...ops: (number | ((s: Stopwatch) => Stopwatch))[]): Stopwatch {
	return ops.reduce<Stopwatch>((s, op) => (typeof op === 'number' ? tick(s, op) : op(s)), ZERO);
}

describe('the stopwatch', () => {
	test('starts at zero, paused, with no laps', () => {
		expect(ZERO).toEqual({ elapsed: 0, marks: [], running: false });
	});

	test('counts only while it runs', () => {
		expect(play(1500).elapsed).toBe(0);
		expect(play(start, 1500).elapsed).toBe(1500);
		expect(play(start, 1500, 250).elapsed).toBe(1750);
	});

	test('pause holds the count, and a resume carries on from it', () => {
		const paused = play(start, 2000, pause, 5000);
		expect(paused).toEqual({ elapsed: 2000, marks: [], running: false });
		expect(play(start, 2000, pause, 5000, start, 300).elapsed).toBe(2300);
	});

	test('a tick that is not a forward amount of time changes nothing', () => {
		const s = play(start, 1000);
		expect(tick(s, 0)).toBe(s);
		expect(tick(s, -40)).toBe(s);
		expect(tick(s, Number.NaN)).toBe(s);
		expect(tick(s, Number.POSITIVE_INFINITY)).toBe(s);
	});

	test('starting a running watch, or pausing a paused one, is the same watch', () => {
		const running = play(start, 1000);
		expect(start(running)).toBe(running);
		const paused = pause(running);
		expect(pause(paused)).toBe(paused);
	});

	test('reset goes back to zero and stops, from any state', () => {
		expect(reset(play(start, 4000, lap, 1000))).toEqual(ZERO);
		expect(reset(play(start, 4000, lap, pause))).toEqual(ZERO);
		expect(reset(ZERO)).toEqual(ZERO);
	});

	test('a lap marks where the count stood, and keeps counting', () => {
		const s = play(start, 21400, lap, 19800, lap, 500);
		expect(s.marks).toEqual([21400, 41200]);
		expect(s.elapsed).toBe(41700);
		expect(s.running).toBe(true);
	});

	test('no lap while paused, and no lap of no length', () => {
		// Paused, a lap would record a split nobody was timing.
		const paused = play(start, 3000, pause);
		expect(lap(paused)).toBe(paused);
		// A second press in the same instant, and a press before any time has run,
		// would each add a zero-length lap to compare attempts against.
		const marked = play(start, 3000, lap);
		expect(lap(marked)).toBe(marked);
		const fresh = start(ZERO);
		expect(lap(fresh)).toBe(fresh);
	});
});

// What the full-screen stopwatch's Close guards (#130's review): a watch
// running counts as progress from the press of Start, before its first tick
// has added any time, and a paused one counts while it holds time. Laps never
// stand alone: a lap needs time before it.
describe('a stopwatch underway', () => {
	test('at zero and stopped it is not underway', () => {
		expect(underway(ZERO)).toBe(false);
		expect(underway(reset(play(start, 4000, lap, 1000)))).toBe(false);
	});

	test('running it is underway, before any time has run', () => {
		expect(underway(start(ZERO))).toBe(true);
		expect(underway(play(start, 1500))).toBe(true);
	});

	test('paused with time on it, laps or none, it is underway', () => {
		expect(underway(play(start, 2000, pause))).toBe(true);
		expect(underway(play(start, 2000, lap, 300, pause))).toBe(true);
	});
});

describe('lap arithmetic', () => {
	// Three boulder attempts and the rest before a fourth: 21.4s, 19.8s, 23.1s.
	const s = play(start, 21400, lap, 19800, lap, 23100, lap, 4200);

	test('each lap is its own time and the running total where it ended', () => {
		expect(lapsOf(s)).toEqual([
			{ n: 1, time: 21400, total: 21400 },
			{ n: 2, time: 19800, total: 41200 },
			{ n: 3, time: 23100, total: 64300 },
		]);
	});

	test('the lap running now counts from the last mark', () => {
		expect(currentLapOf(s)).toEqual({ n: 4, time: 4200, total: 68500 });
	});

	test('before any lap, the lap running now is the whole count', () => {
		expect(lapsOf(play(start, 9000))).toEqual([]);
		expect(currentLapOf(play(start, 9000))).toEqual({ n: 1, time: 9000, total: 9000 });
		expect(currentLapOf(ZERO)).toEqual({ n: 1, time: 0, total: 0 });
	});

	test('the laps add up to the total', () => {
		const sum = lapsOf(s).reduce((a, l) => a + l.time, 0) + currentLapOf(s).time;
		expect(sum).toBe(68500);
	});
});

describe('the stopwatch face', () => {
	test('minutes, seconds and tenths, never rounded up', () => {
		expect(stopwatchClock(0, 'en-US')).toEqual({ whole: '0:00', fraction: '.0' });
		// 21.46s has not reached 21.5s, so the face does not say it has.
		expect(stopwatchClock(21460, 'en-US')).toEqual({ whole: '0:21', fraction: '.4' });
		expect(stopwatchClock(64300, 'en-US')).toEqual({ whole: '1:04', fraction: '.3' });
	});

	test('hours once there are any', () => {
		expect(stopwatchClock(3_723_900, 'en-US')).toEqual({ whole: '1:02:03', fraction: '.9' });
	});

	test('the decimal mark is the locale’s', () => {
		expect(stopwatchClock(21460, 'pt-BR')).toEqual({ whole: '0:21', fraction: ',4' });
	});
});

describe('what the stopwatch comes back as', () => {
	test('paused, with its count and its laps', () => {
		expect(restoredStopwatch({ elapsed: 41700, marks: [21400, 41200] })).toEqual({
			elapsed: 41700,
			marks: [21400, 41200],
			running: false,
		});
	});

	test('paused even when it was stored running', () => {
		// The page was gone for an unknown time; resuming would count from a
		// number that is wrong by exactly that much.
		expect(restoredStopwatch({ elapsed: 5000, marks: [], running: true }).running).toBe(false);
	});

	test('at zero when nothing is stored', () => {
		expect(restoredStopwatch(undefined)).toEqual(ZERO);
	});

	test('at zero when what is stored cannot be a stopwatch', () => {
		for (const bad of [
			null,
			'41700',
			{ elapsed: 'x', marks: [] },
			{ elapsed: -1, marks: [] },
			{ elapsed: 5000 },
			{ elapsed: 5000, marks: [1000, 'x'] },
			// Laps out of order, or past the count, describe no run that happened.
			{ elapsed: 5000, marks: [3000, 1000] },
			{ elapsed: 5000, marks: [6000] },
		]) {
			expect(restoredStopwatch(bad), JSON.stringify(bad)).toEqual(ZERO);
		}
	});
});
