// What a set logs, and what it starts as.
//
// The two functions under test were written twice — once in `train.tsx` and once
// in `prototype-fixtures.ts` — and the copies had already drifted on which range
// `restSec` falls back to. #56 collapsed them into one module, and these are the
// assertions that keep the survivor honest.
import { describe, expect, it } from 'vitest';
import type { Variant } from '../src/lib/content/types.ts';
import { fieldsFor, midOf, prefilledSet } from '../src/lib/loggedSet.ts';

/** A variant is params + prose; only the params matter here. */
function variant(params: Partial<Variant>): Variant {
	return { name: 'v', what: '', why: [], ...params };
}

describe('midOf', () => {
	it('rounds the midpoint of a range', () => {
		// 7 + 3 = 10, halved = 5. Exact.
		expect(midOf({ min: 7, max: 3 })).toBe(5);
		// 18 + 21 = 39, halved = 19.5, rounded = 20.
		expect(midOf({ min: 18, max: 21 })).toBe(20);
	});

	it('is null for an absent range, never zero', () => {
		// Zero is a load the athlete can be prescribed; absence is not.
		expect(midOf(undefined)).toBeNull();
		expect(midOf({ min: 0, max: 0 })).toBe(0);
	});
});

describe('fieldsFor', () => {
	it('always offers load, edge, time and reps, then rest and effort', () => {
		// Load or a different edge can be added to anything, so the columns do not
		// depend on what the variant prescribes.
		expect(fieldsFor(variant({}))).toEqual([
			'loadKg',
			'edgeMm',
			'workSec',
			'reps',
			'restSec',
			'rpe',
		]);
	});

	it('offers grip only when the variant loads one, and in reps order', () => {
		expect(fieldsFor(variant({ grip: 'half-crimp' }))).toEqual([
			'loadKg',
			'edgeMm',
			'workSec',
			'reps',
			'grip',
			'restSec',
			'rpe',
		]);
	});

	it('answers for a missing variant rather than throwing', () => {
		// `variantOf` falls back, but an exercise added mid-session can still reach
		// here before anything has resolved it.
		expect(fieldsFor(undefined)).not.toContain('grip');
	});
});

describe('prefilledSet', () => {
	it('fills every field from the prescription midpoint', () => {
		const set = prefilledSet(
			variant({
				loadKg: { min: 20, max: 30 },
				edgeMm: { min: 18, max: 22 },
				workSec: { min: 7, max: 7 },
				reps: { min: 5, max: 7 },
				restSec: { min: 120, max: 180 },
				rpe: { min: 8, max: 9 },
				grip: 'pinch',
			}),
		);
		expect(set).toEqual({
			loadKg: 25,
			edgeMm: 20,
			workSec: 7,
			reps: 6,
			restSec: 150,
			rpe: 9, // 8 + 9 = 17, halved = 8.5, rounded = 9
			grip: 'pinch',
			done: false,
		});
	});

	it('falls back to the between-sets rest when there is no between-rounds one', () => {
		// The rest the athlete actually takes after a set. A variant that only
		// alternates within a set has no `restSec`, and the set rest is what the
		// logger should show rather than an empty column.
		expect(prefilledSet(variant({ setRestSec: { min: 60, max: 90 } })).restSec).toBe(75);
		expect(
			prefilledSet(variant({ restSec: { min: 3, max: 3 }, setRestSec: { min: 60, max: 90 } }))
				.restSec,
		).toBe(3);
	});

	it('starts undone, with nothing the prescription did not say', () => {
		const set = prefilledSet(variant({ reps: { min: 5, max: 5 } }));
		expect(set.done).toBe(false);
		expect(set.loadKg).toBeNull();
		expect(set.grip).toBeNull();
	});
});
