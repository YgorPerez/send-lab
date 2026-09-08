// The working load: the ladder, the two numbers under its third rung, and the
// number surviving into the next session.
//
// What this suite is really holding is the pair of claims the tickets are about,
// because both are the kind that go quietly false.
//
//   * **The floor is not a target, and the prediction is not the floor.** They
//     are two different statements about the same exercise and each is labelled
//     for what it is. Collapsing them into one number is the failure mode, and it
//     is invisible unless something asserts that both are offered.
//   * **A number with nothing attached never reaches the athlete** (#29). The
//     per-level target index is our own judgment — the same species as the three
//     `0.9` multipliers #87 deleted — so it carries a grade, and the estimate
//     carries the Amca-anchored confidence of the size conversion beside it.
//
// The rendering half is `renderToString` over the real route tree, as in
// `tests/screens.test.ts`, and it runs in **both locales**: the question and its
// two suggestions are the first new prose on Train since the store landed.

import type { StorageApi } from '@tanstack/db';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getContent } from '../src/lib/content/index.ts';
import {
	asAthleteId,
	asExerciseId,
	asWeekdayKey,
	asWeekId,
	type ExerciseId,
	loadKey,
	taskKey,
} from '../src/lib/ids.ts';
import { prefilledSet } from '../src/lib/loggedSet.ts';
import * as m from '../src/lib/paraglide/messages.js';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { effectiveVariant, variantOf } from '../src/lib/prescription.ts';
import { libraryTask, loadAsk, resolveTrain, withWorkingLoad } from '../src/lib/screens/train.ts';
import { createRecordStore } from '../src/lib/store/collections.ts';
import {
	readTrainingRecord,
	recordStore,
	resetRecordStore,
	type TrainingRecord,
} from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import {
	addedKgForIndex,
	maxhangStrength,
	pinchAddedKgForIndex,
	pinchStrength,
	predictLoad,
	TARGET_INDEX_EVIDENCE,
} from '../src/lib/strength.ts';
import type { WorkingLoad } from '../src/lib/types.ts';
import { isWeightedExercise, safeFloorKg, suggestLoad } from '../src/lib/workingLoad.ts';
import { routeTree } from '../src/routeTree.gen.ts';

const ACCOUNT = asAthleteId('athlete-1');

// Paraglide's real strategy is `localStorage` first (ADR 0006) and jsdom under
// Vitest has none, so an un-overridden `getLocale()` throws where content is
// resolved. Same pin as the other store suites.
let locale: 'en-US' | 'pt-BR' = 'en-US';
overwriteGetLocale(() => locale);

/** A Thursday in week 5 of the seeded block — a training day with a full slot,
 *  which is what makes a first-contact question something to look for. */
const THURSDAY = new Date('2026-08-13T09:30:00');
const NOW = THURSDAY.getTime();

const MAXHANG = asExerciseId('maxhang');
const PULL = asExerciseId('pull');
const PINCH = asExerciseId('pinch');

function memoryStorage(): StorageApi {
	const cells = new Map<string, string>();
	return {
		getItem: (k) => cells.get(k) ?? null,
		setItem: (k, v) => void cells.set(k, v),
		removeItem: (k) => void cells.delete(k),
	};
}

function seeded(storage: StorageApi = memoryStorage()) {
	const store = createRecordStore(ACCOUNT, undefined, storage);
	seedRecordStore(store, getContent('en-US'), 'en-US', NOW);
	return store;
}

/** A record with one working load in it, and nothing else changed. */
function withLoad(load: WorkingLoad): TrainingRecord {
	const store = seeded();
	store.workingLoads.insert(load);
	return readTrainingRecord(store);
}

const load = (
	exercise: ExerciseId,
	variant: number,
	addedKg: number,
	source: WorkingLoad['source'] = 'usual',
): WorkingLoad => ({ exercise, variant, addedKg, source, at: NOW });

// --------------------------------------------------------------- the key

describe('a working load is keyed exercise and variant', () => {
	// The whole reason for a fourth key shape (ADR 0020): an override key is
	// `weekday:exercise` and carries no variant, so it cannot spell this at all,
	// and a task key carries a week this has no business knowing about.
	it('carries the variant and no slot', () => {
		expect(loadKey(MAXHANG, 2)).toBe('maxhang@2');
		expect(loadKey(MAXHANG, 0)).not.toBe(loadKey(MAXHANG, 1));
	});
});

// -------------------------------------------------------- the seven, and rest

describe('which exercises carry one', () => {
	it('is the seven weighted exercises and nothing else', () => {
		for (const id of ['maxhang', 'recruit', 'density', 'abra', 'slopdens', 'pinch', 'pull']) {
			expect(isWeightedExercise(asExerciseId(id))).toBe(true);
		}
		// `repeaters` prescribes work, rest and rounds — answered by time, which is
		// the line `CONTEXT.md` draws. `rest` is a real library entry and is the
		// exclusion every count in this app has had to make by hand.
		expect(isWeightedExercise(asExerciseId('repeaters'))).toBe(false);
		expect(isWeightedExercise(asExerciseId('rest'))).toBe(false);
		expect(isWeightedExercise(asExerciseId('limitboulder'))).toBe(false);
	});
});

// ------------------------------------------------------------ the third rung

describe('the safe floor', () => {
	it('is bodyweight-only on an edge, which is a real prescription', () => {
		expect(safeFloorKg(MAXHANG)).toBe(0);
		expect(safeFloorKg(asExerciseId('abra'))).toBe(0);
	});

	// The consequence ADR 0020 records: on a pinch block the added load *is* the
	// entire load, and a block with nothing on it is not a set.
	it('is never zero for a pinch', () => {
		expect(safeFloorKg(PINCH)).toBeGreaterThan(0);
	});
});

describe('the prediction beside it', () => {
	const content = getContent('en-US');
	/** Max hang on the reference edge — variant 2, which prescribes 18–20mm.
	 *  Variant 0 is a **10mm** edge and is the interesting case below. */
	const onTwenty = variantOf(content.exercises.maxhang, 2);
	/** The same exercise on 10mm. */
	const onTen = variantOf(content.exercises.maxhang, 0);
	/** The same variant on a different hold. A real library variant with one field
	 *  moved, rather than a hand-built object: `Variant` carries its localized
	 *  prose, and a stub of it is a `Variant` only by assertion. */
	const onEdge = (v: typeof onTwenty, mm: number) => ({ ...v, edgeMm: { min: mm, max: mm } });

	it('offers both numbers, and they are not the same claim', () => {
		const s = suggestLoad(MAXHANG, 'advanced', onTwenty, 72);
		expect(s.predicted).not.toBeNull();
		// The floor is where it is safe to begin; the prediction is what we think
		// the athlete can take. On a 20mm edge for an advanced climber the second is
		// well above the first, and a build that collapsed them would fail here.
		expect(s.predicted?.addedKg).toBeGreaterThan(s.floorKg);
	});

	// And the case where they legitimately agree, which is the estimate working
	// rather than failing: on a 10mm edge, bodyweight alone already converts to a
	// 20mm-equivalent index above the target, so the honest suggestion is to hang
	// bodyweight. Both numbers are still shown, still labelled, and they coincide.
	it('agrees with the floor on a hold that is hard enough at bodyweight', () => {
		const s = suggestLoad(MAXHANG, 'advanced', onTen, 72);
		expect(s.predicted?.addedKg).toBe(s.floorKg);
		expect(s.predicted?.confidence).toBe('med');
		// Flagged rather than clamped silently. Offering a clamped estimate as its
		// own rung would file the *floor* under `source: 'predicted'`, and which
		// rung a number came from is the whole reason the collection stores one.
		expect(s.atFloor).toBe(true);
		expect(suggestLoad(MAXHANG, 'advanced', onTwenty, 72).atFloor).toBe(false);
	});

	it('never reaches the screen as a bare number', () => {
		const p = suggestLoad(MAXHANG, 'advanced', onTwenty, 72).predicted;
		// #29's rule: a number may be graded "no evidence — our judgment", and may
		// never arrive with nothing attached. Both halves travel with it — the
		// index it solved for, and how that index is backed.
		expect(p?.index).toBeGreaterThan(0);
		expect(p?.evidence).toBe(TARGET_INDEX_EVIDENCE);
		expect(TARGET_INDEX_EVIDENCE).toBe('judgment');
	});

	it('climbs with the level', () => {
		const at = (level: 'intermediate' | 'advanced' | 'elite') =>
			suggestLoad(MAXHANG, level, onTwenty, 72).predicted?.addedKg ?? 0;
		expect(at('intermediate')).toBeLessThan(at('advanced'));
		expect(at('advanced')).toBeLessThan(at('elite'));
	});

	// The Amca-anchored half, carried through rather than swallowed: a prediction
	// off a 6mm edge is not the same claim as one off 20mm, and the module has
	// always known the difference.
	it('carries the edge conversion’s confidence', () => {
		expect(predictLoad('maxhang', 'advanced', 20, 72)?.confidence).toBe('high');
		expect(predictLoad('maxhang', 'advanced', 5, 72)?.confidence).toBe('low');
		expect(predictLoad('maxhang', 'advanced', 40, 72)?.confidence).toBe('low');
	});

	it('is low for a pinch whatever the block measures', () => {
		expect(predictLoad('pinch', 'elite', 80, 72)?.confidence).toBe('low');
		expect(predictLoad('pinch', 'elite', 20, 72)?.confidence).toBe('low');
	});

	it('predicts nothing on an edge with no bodyweight to divide by', () => {
		expect(predictLoad('maxhang', 'advanced', 20, null)).toBeNull();
		expect(suggestLoad(MAXHANG, 'advanced', onTwenty, null).predicted).toBeNull();
	});

	// On a small enough edge the honest arithmetic goes negative — nobody holds
	// 135% of bodyweight on 6mm. `strength.ts` says so and the suggestion clamps,
	// so what the athlete is offered is never below the floor.
	it('clamps to the floor rather than offering assistance', () => {
		const raw = predictLoad('maxhang', 'elite', 5, 72);
		expect(raw?.addedKg).toBeLessThan(0);
		const s = suggestLoad(MAXHANG, 'elite', onEdge(onTwenty, 5), 72);
		expect(s.predicted?.addedKg).toBe(s.floorKg);
	});

	it('never suggests nothing on a pinch block', () => {
		const s = suggestLoad(PINCH, 'intermediate', variantOf(content.exercises.pinch, 0), 72);
		expect(s.floorKg).toBeGreaterThan(0);
		expect(s.predicted?.addedKg).toBeGreaterThan(0);
	});
});

describe('the inverse is the forward direction run backwards', () => {
	it('recovers the load a hang was graded from', () => {
		for (const mm of [10, 20, 25]) {
			const index = maxhangStrength(24, mm, 72)?.index ?? 0;
			// Both directions round to whole numbers, so the recovery is within a
			// kilogram rather than exact — which is the honest tolerance for an
			// estimate whose confidence grade is the point.
			expect(addedKgForIndex(index, mm, 72) ?? 0).toBeCloseTo(24, -0.5);
		}
	});

	it('recovers the load a pinch was graded from', () => {
		expect(pinchAddedKgForIndex(pinchStrength(18, 60).index, 60)).toBeCloseTo(18, -0.5);
	});

	it('has nothing to solve without a bodyweight', () => {
		expect(addedKgForIndex(140, 20, null)).toBeNull();
	});
});

// ----------------------------------------------------------- the collection

describe('the sixteenth collection', () => {
	it('round-trips through a reload', () => {
		const storage = memoryStorage();
		const first = seeded(storage);
		first.workingLoads.insert(load(MAXHANG, 1, 28, 'tested'));

		// A second store over the same bytes is what the next page load is.
		const next = createRecordStore(ACCOUNT, undefined, storage);
		const record = readTrainingRecord(next);
		const stored = record.workingLoads[loadKey(MAXHANG, 1)];
		expect(stored?.addedKg).toBe(28);
		// The rung is stored with the number, because #29 grades a test and a guess
		// differently and the load search reads which it is.
		expect(stored?.source).toBe('tested');
	});

	it('holds one answer per variant', () => {
		const record = withLoad(load(PULL, 0, 30));
		expect(record.workingLoads[loadKey(PULL, 0)]?.addedKg).toBe(30);
		// 30kg on weighted pull-ups says nothing about a one-arm ladder.
		expect(record.workingLoads[loadKey(PULL, 1)]).toBeUndefined();
	});
});

// ------------------------------------------------------------- the resolver

describe('the prescription reads it', () => {
	const content = getContent('en-US');
	const week = (r: TrainingRecord) => r.currentWeek;

	it('prescribes the working load rather than the variant’s own number', () => {
		const record = withLoad(load(PULL, 0, 42));
		const thu = resolveTrain(content, record, NOW).weekday;
		const base = variantOf(content.exercises.pull, 0);
		const v = effectiveVariant(content, record, base, 0, week(record), thu, PULL);
		expect(v.loadKg).toEqual({ min: 42, max: 42 });
	});

	// The gap #87 named: six of the seven weighted exercises prescribe no load at
	// all, so the athlete met an empty field. They meet a number now — one they
	// gave. What progression does with it is the next test.
	it('prescribes a load where the library prescribes none', () => {
		const record = withLoad(load(MAXHANG, 0, 20));
		const thu = resolveTrain(content, record, NOW).weekday;
		const base = variantOf(content.exercises.maxhang, 0);
		expect(base.loadKg).toBeUndefined();
		const v = effectiveVariant(content, record, base, 0, week(record), thu, MAXHANG);
		expect(v.loadKg).toEqual({ min: 20, max: 20 });
	});

	// `CONTEXT.md`: a working load is *settling* until two consecutive on-target
	// sessions agree, "after which progression scales it". Settling is #91's, so
	// today an athlete who says 40kg in week 5 is prescribed 40kg — not 40
	// compounded by four weeks they trained the exercise with no load at all.
	it('does not scale a load the athlete has just given', () => {
		const record = withLoad(load(PULL, 0, 40));
		const thu = resolveTrain(content, record, NOW).weekday;
		const base = variantOf(content.exercises.pull, 0);
		const scaled = effectiveVariant(content, record, base, 0, week(record), thu, PULL);
		expect(scaled.loadKg).toEqual({ min: 40, max: 40 });

		// And the library's own number still progresses, so the skip is about the
		// athlete's answer rather than about the scaling being off.
		const noLoad = readTrainingRecord(seeded());
		const builtIn = effectiveVariant(content, noLoad, base, 0, week(noLoad), thu, PULL);
		expect(builtIn.loadKg).not.toEqual(base.loadKg);
	});

	// The acceptance criterion, stated the way the athlete meets it: the set they
	// are handed next session opens on the number they gave, not on `midOf` of a
	// range six of the seven weighted exercises do not have.
	it('prefills the next session’s set from it', () => {
		const record = withLoad(load(MAXHANG, 0, 20));
		const thu = resolveTrain(content, record, NOW).weekday;
		const v = effectiveVariant(
			content,
			record,
			variantOf(content.exercises.maxhang, 0),
			0,
			week(record),
			thu,
			MAXHANG,
		);
		expect(prefilledSet(v).loadKg).toBe(20);
		// Without one there is nothing to prefill, which is the state #88 closes.
		const empty = readTrainingRecord(seeded());
		const bare = effectiveVariant(
			content,
			empty,
			variantOf(content.exercises.maxhang, 0),
			0,
			week(empty),
			thu,
			MAXHANG,
		);
		expect(prefilledSet(bare).loadKg).toBeNull();
	});
});

// ------------------------------------------------- the answer, at the tap

describe('answering it', () => {
	const content = getContent('en-US');
	const KEY = taskKey(asWeekId(5), asWeekdayKey('Thu'), MAXHANG);

	/** A task with nothing logged against it — which is what a set row the athlete
	 *  is about to fill actually looks like. The seeded Thursday already holds a
	 *  session, and a logged set is history rather than a blank. */
	const fresh = (exercise: ExerciseId) => {
		const built = libraryTask(content, readTrainingRecord(seeded()), exercise, KEY);
		if (!built) throw new Error(`no library task for ${exercise}`);
		return built;
	};

	it('fills the set the athlete is standing in front of', () => {
		const task = fresh(MAXHANG);
		expect(task.sets[0].loadKg).toBeNull();

		const answered = withWorkingLoad(task, load(MAXHANG, 0, 20));
		// Not just the prescription: the open set row takes it too. Without this the
		// athlete answers at the hangboard and the load column stays as it opened
		// until the *next* session, which would make first contact a form that files
		// paperwork.
		expect(answered.sets[0].loadKg).toBe(20);
		expect(answered.ask).toBeNull();
		expect(answered.workingLoad?.source).toBe('usual');
	});

	// `pull` is the one variant in the library carrying a built-in `loadKg`, so its
	// set row opens on the library's midpoint rather than empty — the case a
	// not-null check would have got backwards, leaving that number on screen one
	// second after the athlete gave their own.
	it('replaces the library’s own prefill rather than treating it as an answer', () => {
		const task = fresh(PULL);
		expect(task.sets[0].loadKg).not.toBeNull();
		expect(withWorkingLoad(task, load(PULL, 0, 20)).sets[0].loadKg).toBe(20);
	});

	it('leaves a set the athlete has already answered for', () => {
		const task = fresh(MAXHANG);
		const edited = {
			...task,
			sets: [
				{ ...task.sets[0], loadKg: 12 },
				{ ...task.sets[0], loadKg: 15, done: true },
			],
		};
		const answered = withWorkingLoad(edited, load(MAXHANG, 0, 20));
		// A set with a load typed into it is that set's answer, and a completed one
		// is history. Neither is a blank waiting to be filled.
		expect(answered.sets[0].loadKg).toBe(12);
		expect(answered.sets[1].loadKg).toBe(15);
	});
});

// ------------------------------------------------------------ asking, once

describe('the question', () => {
	const content = getContent('en-US');
	const variant = variantOf(content.exercises.maxhang, 0);

	it('is put at first contact with a weighted exercise', () => {
		const record = readTrainingRecord(seeded());
		expect(loadAsk(record, MAXHANG, 0, variant)).not.toBeNull();
	});

	it('is not put again once answered', () => {
		const record = withLoad(load(MAXHANG, 0, 20));
		expect(loadAsk(record, MAXHANG, 0, variant)).toBeNull();
		// But the *other* variant is a different question, and is still unanswered.
		expect(loadAsk(record, MAXHANG, 1, variant)).not.toBeNull();
	});

	it('is not put for an exercise answered by grade or time', () => {
		const record = readTrainingRecord(seeded());
		expect(loadAsk(record, asExerciseId('limitboulder'), 0, variant)).toBeNull();
		expect(loadAsk(record, asExerciseId('repeaters'), 0, variant)).toBeNull();
	});

	it('reaches the screen on a slot that schedules one', () => {
		const record = readTrainingRecord(seeded());
		const screen = resolveTrain(content, record, NOW);
		const weighted = screen.tasks.filter((t) => isWeightedExercise(t.exercise));
		expect(weighted.length).toBeGreaterThan(0);
		for (const task of weighted) expect(task.ask).not.toBeNull();
		for (const task of screen.tasks.filter((t) => !isWeightedExercise(t.exercise))) {
			expect(task.ask).toBeNull();
		}
	});

	it('carries the prescribed edge into the estimate', () => {
		const record = readTrainingRecord(seeded());
		// `pinch` prescribes a block width, so the suggestion is computed against
		// the hold the athlete is actually standing in front of rather than against
		// a reference size.
		const block = variantOf(content.exercises.pinch, 0);
		const wide = loadAsk(record, PINCH, 0, { ...block, edgeMm: { min: 100, max: 100 } });
		const narrow = loadAsk(record, PINCH, 0, { ...block, edgeMm: { min: 40, max: 40 } });
		expect(wide?.predicted?.addedKg).toBeLessThan(narrow?.predicted?.addedKg ?? 0);
	});
});

// ------------------------------------------------------------- the rendering

describe('Train asks it, in both locales', () => {
	beforeAll(() => {
		// `Date` only, as in `tests/screens.test.ts`: faking timers wholesale would
		// stop React and the collections from scheduling anything.
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(THURSDAY);
		// The route reads the *module* store rather than one built here, and it has
		// to hold an account: the prediction divides by a bodyweight, so an empty
		// record renders the floor alone — which is a true rendering of an empty
		// account and not the one this asserts.
		resetRecordStore();
		seedRecordStore(recordStore(), getContent('en-US'), 'en-US', NOW);
	});
	afterAll(() => {
		vi.useRealTimers();
		resetRecordStore();
		locale = 'en-US';
	});

	async function train(as: 'en-US' | 'pt-BR'): Promise<string> {
		locale = as;
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/train'] }),
		});
		await router.load();
		return renderToString(createElement(RouterProvider, { router }));
	}

	it.each(['en-US', 'pt-BR'] as const)('puts the question and both numbers — %s', async (as) => {
		const html = await train(as);

		expect(html).toContain(m.wl_first());
		// Both rungs of the third tier, each labelled for what it is. One without
		// the other is the failure this asserts against.
		expect(html).toContain(m.wl_floor());
		expect(html).toContain(m.wl_predicted());
		// And the grade on the estimate: a number the athlete cannot tell is a
		// guess is the thing #29 exists to stop.
		expect(html).toContain(m.wl_judgment());
	});

	// ADR 0019's rule, applied one screen over from where it was paid for: no
	// question opens with an answer in it. Neither typed rung comes up pressed, so
	// an athlete who ignores this has not silently agreed to a load.
	it('opens with nothing answered', async () => {
		const html = await train('en-US');
		expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Tested max<\/button>/);
		expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>What I usually use<\/button>/);
		expect(html).not.toContain('aria-pressed="true">Tested max');
	});
});
