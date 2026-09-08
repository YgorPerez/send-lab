// Normalizing finger-strength markers across hold sizes so different lifts grade
// against each other. There's no exact public edge→force law — Amca et al. (2012)
// found force rises with edge depth, concave and grip-dependent — so this is a
// documented ESTIMATE that converts a lift to its 20mm-equivalent % bodyweight,
// paired with a confidence grade reflecting how far the edge is from the band
// where the estimate is trustworthy. See the Studies tab.
//
// IT RUNS BOTH WAYS NOW (#90)
// ---------------------------
// It used to run lift → index only, for a **marker** tracked over time. The
// rebuild stopped tracking markers, and `CONTEXT.md`'s Strength index entry said
// the concept left with them — which was true of the tracking and false of the
// estimate. What survives is the **inverse**: bodyweight and a target index in,
// added load out, read once to suggest what to load a weighted exercise with the
// first time the athlete meets it. Read for a starting number, never kept as a
// series.
//
// THE CLAIM THIS MODULE NOW CARRIES
// ---------------------------------
// The conversion is anchored on Amca. **The target index is not.** It is our own
// judgment about what a climber of a given level trains at, and it is the one
// new unsourced number [#40](https://github.com/YgorPerez/send-lab/issues/40)
// priced and accepted — the same species as the three `0.9` multipliers
// [#87](https://github.com/YgorPerez/send-lab/issues/87) deleted. #29's rule is
// that a number may be graded *"no evidence — our judgment"* but may never reach
// the athlete with nothing attached, so the grade travels with the number in
// `LoadPrediction` and the screen shows it. **Do not attach a citation to
// `TARGET_INDEX` unless a paper is actually read for it**: a plausible citation
// is worse than none, because it launders a guess into a fact.
import type { Level } from './types';

export type Confidence = 'high' | 'med' | 'low';

/**
 * How a number is backed — #29's distinction, as one bit.
 *
 * `judgment` is an acceptable, sayable answer and the whole reason this type
 * exists: what is forbidden is a number with *nothing* attached, not a number
 * with weak backing. The full `Claim` model is #29's to build; this is the
 * grade the app can already show.
 */
export type Evidence = 'study' | 'judgment';

export interface StrengthEstimate {
	/** 20mm-equivalent strength as % of bodyweight. */
	index: number;
	confidence: Confidence;
}

const EDGE_REF = 20; // mm — the standard testing edge
const EDGE_K = 10; // offset for the concave correction (tunable)
const PINCH_REF = 80; // mm — reference pinch-block width

/** 20mm-equivalent multiplier for a load held on `mm` (>1 below 20mm). Concave:
 *  force ≈ linear-with-offset in depth, so the ratio saturates as edges grow. */
function edgeFactor(mm: number): number {
	return (EDGE_REF + EDGE_K) / (Math.max(1, mm) + EDGE_K);
}

/** Confidence in the edge→20mm conversion: high near the reference, low outside
 *  the validated band (<6mm is anthropometry-dominated; very deep edges drift). */
function edgeConfidence(mm: number): Confidence {
	if (mm < 6 || mm > 30) return 'low';
	if (mm >= 14 && mm <= 22) return 'high';
	return 'med';
}

/** Max-hang strength: total load (bodyweight + added) on `mm`, expressed as a
 *  20mm-equivalent % of bodyweight. Null without a bodyweight to divide by. */
export function maxhangStrength(
	addedKg: number,
	mm: number,
	bwKg: number | null,
): StrengthEstimate | null {
	if (!bwKg) return null;
	const equiv = (bwKg + addedKg) * edgeFactor(mm);
	return { index: Math.round((equiv / bwKg) * 100), confidence: edgeConfidence(mm) };
}

/** Pinch strength: added load scaled by block width (wider = harder). Always low
 *  confidence — pinch normalization is far less validated than edge hangs. */
export function pinchStrength(addedKg: number, mm: number): StrengthEstimate {
	return { index: Math.round(addedKg * (mm / PINCH_REF)), confidence: 'low' };
}

/**
 * Whether this exercise loads a **pinch block** rather than an edge.
 *
 * One predicate rather than an `=== 'pinch'` written wherever the difference
 * bites, and it bites in four places: the default hold size, the direction the
 * estimate is solved in, the safe floor (`lib/workingLoad.ts`) and the sentence
 * the screen puts under the number. A pinch is not a small edge — it is
 * normalized on block width, carries no bodyweight term, and is the one hold
 * where zero added load is not a set.
 */
export function isPinch(exercise: string): boolean {
	return exercise === 'pinch';
}

/** Markers that carry a size (mm) and get a normalized strength index. */
export const SIZED_METRICS = new Set(['maxhang', 'pinch']);

/** Default size (mm) for a sized marker when none is recorded. */
export function defaultMm(id: string): number {
	return isPinch(id) ? PINCH_REF : EDGE_REF;
}

// ------------------------------------------------------------- the inverse
//
// Everything above answers *how strong was that lift*. Everything below answers
// *what should this be loaded with*, which is the same arithmetic run backwards
// against a target — and one number that is nobody's arithmetic.

/**
 * The 20mm-equivalent index (% bodyweight) we expect a climber of each level to
 * **train** at on an edge. NOT a tested max: 135 is a working load an advanced
 * climber repeats, not the single heaviest hang they own.
 *
 * NO EVIDENCE — OUR JUDGMENT (#29). Three numbers, one claim. They are anchored
 * on nothing but coaching convention and the level boundaries `programGen`
 * already infers from a boulder grade, and the honest thing to do with them is
 * say so on screen rather than find a paper that is nearly about them. Amca
 * backs the *conversion* these are fed through, and backs none of these.
 *
 * They are deliberately conservative for the same reason the safe floor is: this
 * is a **starting** number, and the load search (#91) is what moves it. Being
 * light on the first session costs one easy session; being heavy costs a finger.
 */
const TARGET_INDEX: Record<Level, number> = {
	intermediate: 120,
	advanced: 135,
	elite: 150,
};

/**
 * The same claim for a pinch block, in the units `pinchStrength` normalizes to:
 * added kg on an 80mm block, since a pinch index is not a share of bodyweight.
 *
 * NO EVIDENCE — OUR JUDGMENT (#29), and weaker than the edge numbers above,
 * which is why every pinch estimate is graded `low` whatever the block measures.
 * It is bodyweight-independent, which is a real defect and not a rounding one —
 * a 55kg and a 90kg climber get the same suggestion.
 */
const PINCH_TARGET_INDEX: Record<Level, number> = {
	intermediate: 8,
	advanced: 12,
	elite: 16,
};

/** How the per-level target index is backed. Exported so the screen can say it
 *  rather than infer it, and so the day a paper is actually read for it, one
 *  constant changes and the display follows. */
export const TARGET_INDEX_EVIDENCE: Evidence = 'judgment';

/** A suggested added load, with everything needed to present it honestly. */
export interface LoadPrediction {
	/** Added load in kg. May be **negative** on a small edge, which is the true
	 *  answer — nobody holds 135% of bodyweight on 6mm, and the honest reading is
	 *  that assistance is wanted. The caller decides what to show; this does not
	 *  quietly clamp it to something plausible. */
	addedKg: number;
	/** The target index it solved for. Carried so the number is never bare. */
	index: number;
	/** Confidence in the **size → 20mm conversion**, which is the Amca-anchored
	 *  half. A prediction from a 6mm edge is not the same claim as one from 20mm,
	 *  and this is the app already knowing the difference. */
	confidence: Confidence;
	/** How the **target index** is backed, which is the other half and is graded
	 *  separately. Reporting one number for both would swallow whichever grade
	 *  happened to be weaker; they are two claims and the athlete sees two. */
	evidence: Evidence;
}

/**
 * The added load that puts a hang at `index` on an `mm` edge — `maxhangStrength`
 * solved for `addedKg`.
 *
 * From `equiv = (bw + added) × edgeFactor(mm)` and `index = equiv / bw × 100`:
 * `added = bw × (index / 100) / edgeFactor(mm) − bw`. Null without a bodyweight,
 * for the same reason the forward direction is: there is nothing to divide by,
 * and inventing one would be a training decision made by arithmetic.
 */
export function addedKgForIndex(index: number, mm: number, bwKg: number | null): number | null {
	if (!bwKg) return null;
	return Math.round((bwKg * (index / 100)) / edgeFactor(mm) - bwKg);
}

/** The added load that puts a pinch at `index` on an `mm` block —
 *  `pinchStrength` solved for `addedKg`. No bodyweight anywhere in it. */
export function pinchAddedKgForIndex(index: number, mm: number): number {
	return Math.round(index / (Math.max(1, mm) / PINCH_REF));
}

/**
 * What we think this athlete can take on this hold — the predicted half of the
 * suggestion [#40](https://github.com/YgorPerez/send-lab/issues/40) asked for,
 * shown beside the safe floor and never presented as it.
 *
 * `null` when it cannot be predicted rather than a fallback number: an edge
 * exercise with no bodyweight on record has nothing to solve against, and a
 * suggestion made up in that gap is exactly the fabrication
 * [#61](https://github.com/YgorPerez/send-lab/issues/61) is about.
 */
export function predictLoad(
	exercise: string,
	level: Level,
	mm: number,
	bwKg: number | null,
): LoadPrediction | null {
	if (isPinch(exercise)) {
		const index = PINCH_TARGET_INDEX[level];
		return {
			addedKg: pinchAddedKgForIndex(index, mm),
			index,
			// `pinchStrength` grades itself `low` unconditionally and this is its
			// inverse: block-width normalization is far less validated than edge
			// hangs, and running the arithmetic backwards does not validate it.
			confidence: 'low',
			evidence: TARGET_INDEX_EVIDENCE,
		};
	}
	const index = TARGET_INDEX[level];
	const addedKg = addedKgForIndex(index, mm, bwKg);
	if (addedKg === null) return null;
	return { addedKg, index, confidence: edgeConfidence(mm), evidence: TARGET_INDEX_EVIDENCE };
}
