// What the rest timer restores after a reload — #59.
//
// This exists because of a hazard measured elsewhere on the rebuild: on Android,
// **pull-to-refresh fires a real reload in the installed app** (#54, carried by
// #27). The athlete is mid-repeater, hand on the phone, and the page reloads. Up
// to now the clock came back idle and their place in the protocol was gone.
//
// Restoring it is only safe under two rules, and both are here rather than in the
// component because both are arithmetic rather than rendering:
//
//   1. It restores **paused, never running**. Wall-clock time passed while the
//      page was gone and nothing on the device knows how much, so a clock that
//      resumed itself would count from a `remaining` that is simply wrong — and
//      it would do so silently, on a screen the athlete is deliberately not
//      looking at.
//   2. It restores **only for the protocol it was saved under**. The timer is
//      remounted per pinned task and variant, and one exercise's position shown
//      on another's card is worse than no memory at all.
import { describe, expect, it } from 'vitest';
import { scoped } from '../src/lib/ephemeral.ts';
import { asExerciseId, asWeekdayKey, asWeekId, protocolKey, taskKey } from '../src/lib/ids.ts';
import type { IntervalConfig, Run } from '../src/lib/intervalProtocol.ts';
import { IDLE } from '../src/lib/intervalProtocol.ts';
import { restored, type TimerSetup } from '../src/lib/timerSetup.ts';

const CONFIG: IntervalConfig = {
	prepare: 10,
	work: 7,
	rest: 3,
	rounds: 6,
	sets: 3,
	setRest: 60,
};

const SEEDED: IntervalConfig = { ...CONFIG, work: 5 };

/** Mid-session: third round of the second set, four seconds of work left. */
const MID: Run = { segment: 'work', remaining: 4, round: 3, set: 2 };

/** Minted rather than spelled, so the test cannot pass against a key shape the
 *  app does not actually produce. */
const keyFor = (exercise: string) =>
	protocolKey(taskKey(asWeekId(1), asWeekdayKey('Thu'), asExerciseId(exercise)), 0);
const PULL = keyFor('pull');
const PINCH = keyFor('pinch');

const stored = (setup: TimerSetup, scope = PULL) => scoped(scope, setup);

describe('what the clock comes back as', () => {
	it('restores the place it was left, paused', () => {
		const back = restored(stored({ config: CONFIG, run: MID }), PULL, SEEDED);

		expect(back.run).toEqual(MID);
		expect(back.config).toEqual(CONFIG);
		// The rule that makes restoring safe at all. Nothing here knows how long
		// the reload took, so `remaining` is a number from before an unmeasured
		// gap; the athlete taps to resume and that tap is the correction.
		expect(back.running).toBe(false);
	});

	it('ignores a setup saved under a different protocol', () => {
		const back = restored(stored({ config: CONFIG, run: MID }), PINCH, SEEDED);

		// A different pinned task, or the same task on a different variant. The
		// prescription for what is on screen now wins, and the clock starts clean.
		expect(back.config).toEqual(SEEDED);
		expect(back.run).toEqual(IDLE);
		expect(back.running).toBe(false);
	});

	it('starts from the prescription when nothing is stored', () => {
		const back = restored(undefined, PULL, SEEDED);

		expect(back.config).toEqual(SEEDED);
		expect(back.run).toEqual(IDLE);
	});

	it('keeps the athlete’s edit to the protocol over the prescription', () => {
		// They opened the setup and shortened the work interval. That edit is the
		// whole reason the config is persisted, and re-seeding from the
		// prescription on every reload would quietly undo it.
		const edited: IntervalConfig = { ...CONFIG, work: 9 };
		const back = restored(stored({ config: edited, run: IDLE }), PULL, SEEDED);

		expect(back.config.work).toBe(9);
	});

	it('falls back to the prescription when the stored setup is malformed', () => {
		// An older build's shape, or a hand-edited key. `:v1` in the key is what
		// makes a *deliberate* shape change cheap; this is the accidental case,
		// and it must not leave the clock counting from `undefined`.
		const back = restored(stored({ config: null, run: MID } as never), PULL, SEEDED);

		expect(back.config).toEqual(SEEDED);
		expect(back.run).toEqual(IDLE);
	});

	it('refuses a run that is not a state the protocol can be in', () => {
		const back = restored(
			stored({ config: CONFIG, run: { segment: 'sideways', remaining: 4 } } as never),
			PULL,
			SEEDED,
		);

		expect(back.run).toEqual(IDLE);
	});

	it('does not restore a finished session', () => {
		// `done` is not a place worth coming back to — it is a clock that has
		// nothing left to run, and restoring it shows the athlete a dead timer
		// they have to reset before they can use it.
		const back = restored(
			stored({ config: CONFIG, run: { segment: 'done', remaining: 0, round: 6, set: 3 } }),
			PULL,
			SEEDED,
		);

		expect(back.run).toEqual(IDLE);
		// The configuration still survives: it is the athlete's setup, and it
		// outlives any one run of it.
		expect(back.config).toEqual(CONFIG);
	});
});
