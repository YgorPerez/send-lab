import type { PhaseId, VerdictId } from './types';

export type Answers = Record<string, number>;

// The general-readiness questions that feed the overall score. Body-area
// questions (elbow/shoulder) drive targeted flags instead, so adding them
// doesn't skew the verdict thresholds.
const READINESS = ['recovery', 'fingers', 'slot', 'skin', 'cns'];

/** Day-recommender scoring — locale-independent; returns the verdict id.
 *  `fatigue` is an objective adjustment from recent logged effort (≤ 0 = tired). */
export function computeVerdictId(answers: Answers, fatigue = 0): VerdictId {
	const score = READINESS.reduce((a, k) => a + (answers[k] ?? 0), 0) + fatigue;
	const sharp = answers.fingers <= -5;
	const tender = answers.fingers === -2;
	const jointPain = (answers.elbow ?? 0) <= -3 || (answers.shoulder ?? 0) <= -3;

	if (sharp) return 'rest';
	if (tender || jointPain || score <= -2) return 'tissue';
	if (score <= 2) return 'moderate';
	if (answers.slot <= 0) return 'short';
	return 'green';
}

type FlagSeverity = 'stop' | 'warn' | 'info';
export type FlagArea = 'fingers' | 'elbow' | 'shoulder' | 'wrist';

/** A surfaced readiness problem: which advice (`id`), how serious, and which
 *  body area it can route to rehab. Prose lives in the localized `flags` map. */
export interface DailyFlag {
	id: string;
	severity: FlagSeverity;
	area?: FlagArea;
}

/** Targeted problems detected from the daily answers + objective fatigue. */
export function dailyFlags(answers: Answers, fatigue = 0): DailyFlag[] {
	const out: DailyFlag[] = [];
	const f = answers.fingers;
	if (f <= -5) out.push({ id: 'finger_pain', severity: 'stop', area: 'fingers' });
	else if (f === -2) out.push({ id: 'finger_tender', severity: 'warn', area: 'fingers' });

	const e = answers.elbow ?? 0;
	if (e <= -3) out.push({ id: 'elbow_pain', severity: 'stop', area: 'elbow' });
	else if (e <= -1) out.push({ id: 'elbow_niggle', severity: 'warn', area: 'elbow' });

	const s = answers.shoulder ?? 0;
	if (s <= -3) out.push({ id: 'shoulder_pain', severity: 'stop', area: 'shoulder' });
	else if (s <= -1) out.push({ id: 'shoulder_niggle', severity: 'warn', area: 'shoulder' });

	if (answers.skin <= -2) out.push({ id: 'skin', severity: 'warn' });
	if (answers.recovery <= -2) out.push({ id: 'fatigue', severity: 'warn' });
	if (answers.cns <= -2) out.push({ id: 'cns', severity: 'warn' });
	if (fatigue <= -2) out.push({ id: 'load', severity: 'info' });
	return out;
}

/** Training phase for a given week, scaled to the block length (last week = deload). */
export function phaseId(w: number, weeks = 8): PhaseId {
	if (w >= weeks) return 'deload';
	if (w > Math.floor(weeks / 2)) return 'phase2';
	return 'phase1';
}
