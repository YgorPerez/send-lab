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
import {
	asExerciseId,
	asWeekdayKey,
	asWeekId,
	presetKey,
	protocolKey,
	taskKey,
} from '../src/lib/ids.ts';
import type { Protocol, Run } from '../src/lib/protocol.ts';
import { IDLE, planCues } from '../src/lib/protocol.ts';
import {
	draftOn,
	lastOn,
	restored,
	SHELF_LIMIT,
	shelve,
	type TimerSetup,
	timerDraftKey,
} from '../src/lib/timerSetup.ts';

const CONFIG: Protocol = {
	prepare: 10,
	work: 7,
	rest: 3,
	rounds: 6,
	sets: 3,
	setRest: 60,
	cooldown: 0,
};

const SEEDED: Protocol = { ...CONFIG, work: 5 };

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
		const edited: Protocol = { ...CONFIG, work: 9 };
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

	it('comes back from a draft stored before cooldown existed, with none', () => {
		// Every draft written before #104 has six fields. Refusing one for the
		// seventh would reset every clock on the first load after the update.
		const { cooldown: _, ...before } = CONFIG;
		const back = restored(stored({ config: before, run: MID } as never), PULL, SEEDED);

		expect(back.config).toEqual({ ...CONFIG, cooldown: 0 });
		expect(back.run).toEqual(MID);
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

// The clock asks the planner about every move from the run it last saw to the
// run it sees now. At mount the run it last saw is the one it was restored to:
// nothing has moved, and a clock that came back paused says nothing (spec stories
// 32 and 33). Counted from idle instead, every return to a screen with a paused
// draft beeped, buzzed and said the segment name, as if the athlete had pressed
// Start.
describe('a clock restored paused, at mount', () => {
	const places: Run[] = [
		{ segment: 'prepare', remaining: 2, round: 1, set: 1 },
		MID,
		{ segment: 'work', remaining: 2, round: 3, set: 2 },
		{ segment: 'rest', remaining: 3, round: 2, set: 1 },
		{ segment: 'setRest', remaining: 40, round: 6, set: 1 },
		{ segment: 'cooldown', remaining: 1, round: 6, set: 3 },
	];

	it.each(places)('plans no cue in $segment with $remaining s left', (place) => {
		const back = restored(stored({ config: CONFIG, run: place }), PULL, SEEDED);
		expect(planCues({ from: back.run, to: back.run, running: back.running })).toEqual([]);
	});

	it('would have announced the segment if the clock counted the mount from idle', () => {
		const back = restored(stored({ config: CONFIG, run: MID }), PULL, SEEDED);
		expect(planCues({ from: IDLE, to: back.run, running: back.running })).not.toEqual([]);
	});
});

// The Timer screen (#101) runs presets: library protocols the athlete cannot
// edit. Its clock comes back under the same two rules, plus one — the protocol is
// the library's, so a stored copy of it is never the source of truth.
describe('a preset’s clock', () => {
	const REPEATERS = presetKey(asExerciseId('repeaters'), 0);
	const fixed = { fixed: true } as const;

	it('restores the place it was left, paused', () => {
		const back = restored(
			stored({ config: SEEDED, run: MID }, REPEATERS),
			REPEATERS,
			SEEDED,
			fixed,
		);

		expect(back.config).toEqual(SEEDED);
		expect(back.run).toEqual(MID);
		expect(back.running).toBe(false);
	});

	it('keeps its place across the update that added cooldown', () => {
		// A preset runs no cooldown, so a draft from before it is the same
		// protocol as the library's — not one that "disagrees" and loses its place.
		const { cooldown: _, ...before } = SEEDED;
		const back = restored(
			stored({ config: before, run: MID } as never, REPEATERS),
			REPEATERS,
			SEEDED,
			fixed,
		);

		expect(back.run).toEqual(MID);
	});

	it('runs the library’s numbers when the stored copy disagrees with them', () => {
		// The library changed the preset since the clock was left, or a hand edit
		// did. `round 3 of 6` described the old protocol, so the place goes too.
		const back = restored(
			stored({ config: CONFIG, run: MID }, REPEATERS),
			REPEATERS,
			SEEDED,
			fixed,
		);

		expect(back.config).toEqual(SEEDED);
		expect(back.run).toEqual(IDLE);
	});
});

// Train and the Timer screen each keep a clock. Sharing one stored draft made
// each overwrite the other: leave Train mid-protocol for the Timer and back, and
// Train came back idle. One key per screen keeps both positions.
describe('where each screen’s clock is kept', () => {
	it('keeps Train’s clock where it has always been, so no draft is lost', () => {
		expect(timerDraftKey('train')).toBe('sendlab:timer:v1');
	});

	it('keeps the Timer screen’s clock apart from Train’s', () => {
		expect(timerDraftKey('timer')).not.toBe(timerDraftKey('train'));
	});
});

// The Timer screen lists every protocol, and a tap on another row is the
// commonest thing done on it. Its draft is scoped to the protocol (spec: "for a
// saved protocol that is its id, for a preset its variant"), so it keeps one per
// protocol: a stray tap away and back finds the place where it was left.
describe('the Timer screen’s drafts, one per protocol', () => {
	const A = presetKey(asExerciseId('repeaters'), 0);
	const B = presetKey(asExerciseId('maxhang'), 1);

	it('keeps a protocol’s place when another one is run', () => {
		let shelf = shelve(undefined, A, { config: CONFIG, run: MID });
		shelf = shelve(shelf, B, { config: SEEDED, run: { ...MID, round: 1 } });

		const back = restored(draftOn(shelf, A), A, CONFIG, { fixed: true });
		expect(back.run).toEqual(MID);
		expect(back.running).toBe(false);
	});

	it('remembers the protocol last looked at, even one at the start', () => {
		let shelf = shelve(undefined, A, { config: CONFIG, run: MID });
		shelf = shelve(shelf, B, { config: SEEDED, run: IDLE });

		expect(lastOn(shelf)).toBe(B);
		// Nothing worth keeping for a protocol at its start: no place, and the
		// numbers are the protocol's own.
		expect(draftOn(shelf, B)).toBeUndefined();
		expect(draftOn(shelf, A)).toBeDefined();
	});

	it('forgets a place once the athlete resets it', () => {
		let shelf = shelve(undefined, A, { config: CONFIG, run: MID });
		shelf = shelve(shelf, A, { config: CONFIG, run: IDLE });

		expect(draftOn(shelf, A)).toBeUndefined();
	});

	it('keeps only the places most recently left', () => {
		let shelf = shelve(undefined, A, { config: CONFIG, run: MID });
		for (let i = 0; i < SHELF_LIMIT; i++) {
			shelf = shelve(shelf, presetKey(asExerciseId('repeaters'), i + 1), {
				config: CONFIG,
				run: MID,
			});
		}

		expect(shelf.drafts).toHaveLength(SHELF_LIMIT);
		expect(draftOn(shelf, A)).toBeUndefined();
	});

	it('reads anything else in storage as nothing kept', () => {
		for (const junk of [null, 7, 'x', { last: 3 }, { drafts: 'no' }, { drafts: [null] }]) {
			expect(draftOn(junk, A)).toBeUndefined();
			expect(lastOn(junk)).toBeUndefined();
		}
		// And writing over it starts a clean shelf rather than throwing.
		expect(draftOn(shelve({ drafts: 'no' }, A, { config: CONFIG, run: MID }), A)).toBeDefined();
	});
});
