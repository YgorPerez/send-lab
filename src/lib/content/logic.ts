import type { PhaseId, VerdictId } from './types';

export type Answers = Record<string, number>;

/** Day-recommender scoring — locale-independent; returns the verdict id.
 *  `fatigue` is an objective adjustment from recent logged effort (≤ 0 = tired). */
export function computeVerdictId(answers: Answers, fatigue = 0): VerdictId {
	const score = Object.values(answers).reduce((a, b) => a + b, 0) + fatigue;
	const sharp = answers.fingers <= -5;
	const tender = answers.fingers === -2;

	if (sharp) return 'rest';
	if (tender || score <= -2) return 'tissue';
	if (score <= 2) return 'moderate';
	if (answers.slot <= 0) return 'short';
	return 'green';
}

/** Training phase for a given week (1–8). */
export function phaseId(w: number): PhaseId {
	if (w >= 8) return 'deload';
	if (w >= 5) return 'phase2';
	return 'phase1';
}
