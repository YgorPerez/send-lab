// The working load: which exercises have one, what to start it at, and what the
// athlete is offered when they are asked.
//
// A **working load** is the load an exercise is actually trained at, held per
// exercise *and variant* (`CONTEXT.md`). It is not an override and never lands
// in `program.overrides` — ADR 0020 has the three reasons, any one of them
// sufficient. This module is the domain half; `store/workingLoad.ts` writes one,
// `prescription.ts` reads one, and `components/WorkingLoadAsk.tsx` asks.
//
// THE LADDER
// ----------
// [#40](https://github.com/YgorPerez/send-lab/issues/40) decided the question is
// asked **in Train at first contact**, not in the intake: it is answerable
// exactly when it is asked — the athlete is standing at the hangboard looking at
// the edge — and asking it in the intake would mean seven required number fields
// in a flow that already asks eleven questions and, under ADR 0019, may prefill
// none of them.
//
// Three rungs, in this order, and the tier is recorded with the number because
// #29 grades a test and a guess differently:
//
//   1. **A tested max**, if the athlete has one.
//   2. **The load they usually use** — a self-report, no test required.
//   3. **Start here** — the safe floor below, beside `strength.ts`'s prediction.
//
// WHY THE FLOOR IS ZERO, AND WHY NOT FOR `pinch`
// ----------------------------------------------
// Bodyweight-only on a 20mm edge is a genuine prescription — plenty of climbers
// train max hangs there for months — so zero added kilograms is a real answer
// and not a refusal to answer. On a **pinch block the added load is the entire
// load**: a block with nothing on it is not a set, it is standing still. That
// asymmetry is why the floor is a function of the exercise rather than a
// constant, and it is called out in ADR 0020's consequences.
import type { Range, Variant } from '$lib/content/types';
import type { ExerciseId } from '$lib/ids';
import { midOf } from '$lib/loggedSet';
import { defaultMm, isPinch, type LoadPrediction, predictLoad } from '$lib/strength';
import type { Baseline, BodyweightReading, Level, WorkingLoad } from '$lib/types';

/**
 * The exercises a working load applies to — `CONTEXT.md`'s **weighted
 * exercise**: one where added load is part of what is prescribed, rather than
 * one answered by grade or time alone.
 *
 * These seven, and the provenance matters. They are exactly the set the
 * SvelteKit app's `PREFILL_FROM_METRIC` addressed, inventoried by #40 before any
 * of this was decided — so the "six of the seven" that `store/baseline.ts` and
 * ADR 0020 both quote is about this list and not a different one. `repeaters`
 * is deliberately **out**: it prescribes work, rest and rounds, so it is
 * answered by time, which is the line the glossary draws.
 */
export const WEIGHTED_EXERCISES: ReadonlySet<string> = new Set([
	'maxhang',
	'recruit',
	'density',
	'abra',
	'slopdens',
	'pinch',
	'pull',
]);

/** Whether this exercise is one a working load is asked for at all. */
export function isWeightedExercise(exercise: ExerciseId): boolean {
	return WEIGHTED_EXERCISES.has(exercise);
}

/**
 * A working load as a prescription range.
 *
 * One number, not a range to choose within: the athlete said what they load this
 * with, and offering them a spread around their own answer would be the app
 * hedging on their behalf. Here rather than spelled out at each of the three
 * places that substitute it — `effectiveVariant`, an off-script task, and the
 * card taking the answer at the tap — because three spellings of one
 * substitution is three chances for them to drift.
 */
export function loadRange(load: WorkingLoad): Range {
	return { min: load.addedKg, max: load.addedKg };
}

/**
 * The smallest added load that makes a pinch block a set rather than a stance.
 *
 * NO EVIDENCE — OUR JUDGMENT (#29), and cheap to be wrong about in the safe
 * direction: it is the commonest single plate, and the load search moves it from
 * the first session. What it is not allowed to be is zero.
 */
const PINCH_FLOOR_KG = 5;

/**
 * The deliberately conservative load to start at — the third rung, stated as a
 * starting point rather than as a prescription.
 *
 * Zero everywhere but `pinch`, and zero is a real prescription rather than a
 * blank: bodyweight on a 20mm edge is how most max-hang blocks begin.
 */
export function safeFloorKg(exercise: ExerciseId): number {
	return isPinch(exercise) ? PINCH_FLOOR_KG : 0;
}

/**
 * The hold size a suggestion is computed against: what the slot actually
 * prescribes, else the exercise's own reference size.
 *
 * The prescribed edge is the one the athlete is standing in front of, which is
 * the whole reason the question is asked here rather than at the intake.
 *
 * **`pull` hangs from no edge, and that is fine rather than fudged.** With no
 * `edgeMm` it falls to `defaultMm`, which is the 20mm reference — where
 * `edgeFactor` is exactly 1 and the conversion is the identity. So a weighted
 * pull-up's suggestion is the target index read straight as a share of
 * bodyweight, which is how weighted pull-ups are prescribed anyway. Nothing
 * about a finger edge is being asserted of a pull-up.
 */
export function suggestionMm(exercise: ExerciseId, prescription: Variant | undefined): number {
	return midOf(prescription?.edgeMm) ?? defaultMm(exercise);
}

/**
 * The athlete's current weight, for the estimate to divide by: the last logged
 * reading, else the one the intake captured, else nothing.
 *
 * Nothing is a real answer — an account with neither gets **no prediction**
 * rather than one made against an invented divisor. ADR 0009 kept bodyweight
 * through the marker cull precisely because other numbers are expressed against
 * it, and this is the first thing to read it that way.
 */
export function currentBodyweightKg(
	series: readonly BodyweightReading[],
	baseline: Baseline | null,
): number | null {
	// Oldest first (`store/record.ts` sorts it), so the last entry is the latest.
	return series[series.length - 1]?.kg ?? baseline?.bodyweight ?? null;
}

/** The two numbers the third rung offers, each labelled for what it is. */
export interface LoadSuggestion {
	/** The safe starting load. Always present — it needs nothing to compute. */
	floorKg: number;
	/** What we think the athlete can take, or `null` when nothing can be
	 *  predicted. Never presented as the floor, and never the other way round. */
	predicted: LoadPrediction | null;
	/**
	 * The estimate did not clear the floor, so there is **one** number to offer
	 * rather than two.
	 *
	 * Distinct from `predicted: null`, which is no estimate at all. This is an
	 * estimate that came out at or below the safe start — on a 10mm edge,
	 * bodyweight alone already converts to a 20mm-equivalent index above the
	 * target — and it is flagged rather than clamped silently because taking a
	 * clamped estimate would file the *floor* under `source: 'predicted'`. The
	 * provenance is the point of the collection, so the screen offers the floor as
	 * the floor and states what the estimate said.
	 */
	atFloor: boolean;
}

/**
 * The third rung: a floor, and beside it a prediction.
 *
 * The prediction is clamped up to the floor and never below it. On a small edge
 * the honest arithmetic goes negative — nobody holds 135% of bodyweight on 6mm —
 * and a suggestion to hang eleven kilos *lighter* than bodyweight is not
 * something this screen can offer. `strength.ts` returns the raw number and the
 * clamp lives here, so the estimate stays honest and the suggestion stays
 * usable — with `atFloor` saying which of the two happened.
 */
export function suggestLoad(
	exercise: ExerciseId,
	level: Level,
	prescription: Variant | undefined,
	bwKg: number | null,
): LoadSuggestion {
	const floorKg = safeFloorKg(exercise);
	const raw = predictLoad(exercise, level, suggestionMm(exercise, prescription), bwKg);
	if (!raw) return { floorKg, predicted: null, atFloor: false };
	return {
		floorKg,
		predicted: { ...raw, addedKg: Math.max(floorKg, raw.addedKg) },
		atFloor: raw.addedKg <= floorKg,
	};
}
