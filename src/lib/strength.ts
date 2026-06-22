// Normalizing finger-strength markers across hold sizes so different lifts grade
// against each other. There's no exact public edge→force law — Amca et al. (2012)
// found force rises with edge depth, concave and grip-dependent — so this is a
// documented ESTIMATE that converts a lift to its 20mm-equivalent % bodyweight,
// paired with a confidence grade reflecting how far the edge is from the band
// where the estimate is trustworthy. See the Studies tab.
export type Confidence = 'high' | 'med' | 'low';

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

/** Markers that carry a size (mm) and get a normalized strength index. */
export const SIZED_METRICS = new Set(['maxhang', 'pinch']);

/** Default size (mm) for a sized marker when none is recorded. */
export function defaultMm(id: string): number {
	return id === 'pinch' ? PINCH_REF : EDGE_REF;
}
