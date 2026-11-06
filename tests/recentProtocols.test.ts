// Recent (#111): the last protocols the athlete ran on the Timer screen, kept on
// this device so the list can offer them again under Saved.
//
// Only the last protocol used to be kept (the clock shelf's `last`), and that is
// where the clock was *pointed*, not what was *run*. This is the second thing: a
// short list, newest first, read through what the screen can still run.
import { describe, expect, it } from 'vitest';
import { asExerciseId, newSavedProtocolId, presetKey, savedProtocolKey } from '../src/lib/ids.ts';
import { RECENT_SHOWN, ran, recentOf } from '../src/lib/recentProtocols.ts';

const MAX = presetKey(asExerciseId('maxHangs'), 0);
const REPEATERS = presetKey(asExerciseId('repeaters'), 0);
const DENSITY = presetKey(asExerciseId('density'), 1);
const PINCH = presetKey(asExerciseId('pinch'), 0);
const MINE = savedProtocolKey(newSavedProtocolId());
const GONE = presetKey(asExerciseId('noSuchExercise'), 3);

/** What the screen can run, as the list would hand it in. */
const listing = (key: string) => ({ key, name: key });
const RUNNABLE = [MINE, MAX, REPEATERS, DENSITY, PINCH].map(listing);
const SAVED = new Set<string>([MINE]);

describe('recording a run', () => {
	it('puts the protocol just run first', () => {
		expect(ran(undefined, MAX)).toEqual([MAX]);
		expect(ran([MAX], REPEATERS)).toEqual([REPEATERS, MAX]);
	});

	it('moves one run again to the front rather than listing it twice', () => {
		expect(ran([REPEATERS, MAX, DENSITY], DENSITY)).toEqual([DENSITY, REPEATERS, MAX]);
	});

	it('keeps a handful, enough to fill Recent after the saved ones are taken out', () => {
		let stored: unknown;
		for (const key of [MINE, MAX, REPEATERS, DENSITY, PINCH, MINE, GONE, MAX, DENSITY, PINCH]) {
			stored = ran(stored, key);
		}
		const kept = stored as string[];
		expect(kept.length).toBeGreaterThan(RECENT_SHOWN);
		expect(kept.length).toBeLessThanOrEqual(8);
		expect(kept[0]).toBe(PINCH);
	});

	it('reads anything that is not a list of keys as nothing run yet', () => {
		expect(ran({ last: MAX }, REPEATERS)).toEqual([REPEATERS]);
		expect(ran([MAX, 3, null], REPEATERS)).toEqual([REPEATERS, MAX]);
	});
});

describe('what Recent lists', () => {
	it('is the last three run, newest first', () => {
		const stored = [PINCH, DENSITY, REPEATERS, MAX];
		expect(recentOf(stored, RUNNABLE, SAVED).map((r) => r.key)).toEqual([
			PINCH,
			DENSITY,
			REPEATERS,
		]);
		expect(RECENT_SHOWN).toBe(3);
	});

	it('never repeats a row Saved already shows, and fills its place from further back', () => {
		const stored = [MINE, MAX, REPEATERS, DENSITY];
		expect(recentOf(stored, RUNNABLE, SAVED).map((r) => r.key)).toEqual([MAX, REPEATERS, DENSITY]);
	});

	it('skips a protocol the screen can no longer run', () => {
		expect(recentOf([GONE, MAX], RUNNABLE, SAVED).map((r) => r.key)).toEqual([MAX]);
	});

	it('is empty before anything has been run', () => {
		expect(recentOf(undefined, RUNNABLE, SAVED)).toEqual([]);
		expect(recentOf('garbage', RUNNABLE, SAVED)).toEqual([]);
	});
});
