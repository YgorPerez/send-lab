import type { PhaseId, VerdictId } from './types';

export type Answers = Record<string, number>;
export type FlagArea = 'fingers' | 'elbow' | 'shoulder' | 'wrist';
/** Acute:chronic workload ratio band (see stats.ts `acwr`). */
type AcwrStatus = 'low' | 'optimal' | 'high' | 'spike';
type FlagSeverity = 'stop' | 'warn' | 'info';

/** A surfaced readiness problem: which advice (`id`), how serious, and which body
 *  area it can route to rehab. Prose lives in the localized `flags` map. */
export interface DailyFlag {
	id: string;
	severity: FlagSeverity;
	area?: FlagArea;
}

// ---------------- adaptive questionnaire ----------------

/** Always asked. Follow-ups are revealed by `visibleQuestions` only when their
 *  answer could change the recommendation, so no daily question is ever inert. */
const CORE_QUESTIONS = ['sleep', 'fatigue', 'soreness', 'body', 'time'];

// The `body` answer encodes the worst-affected area (0 = nothing bothering you).
const BODY_AREA: (FlagArea | null)[] = [null, 'fingers', 'elbow', 'shoulder', 'wrist'];
/** The injured area chosen in the `body` question, or null. */
function bodyArea(answers: Answers): FlagArea | null {
	return BODY_AREA[answers.body ?? 0] ?? null;
}

// The `severity` follow-up: 0 stiff · 1 tender · 2 painful · 3 sharp.
type Severity = 'stiff' | 'tender' | 'painful' | 'sharp';
const SEVERITY: Severity[] = ['stiff', 'tender', 'painful', 'sharp'];
const severityOf = (answers: Answers): Severity | null =>
	bodyArea(answers) ? (SEVERITY[answers.severity ?? 0] ?? 'stiff') : null;

// ---------------- subjective wellness → 0–100 ----------------

// Each answer is 0–10 (10 = best). Sleep & fatigue carry the most weight — per
// Saw, Main & Gastin (2016), subjective wellness (led by sleep/fatigue) is the
// most load-sensitive monitoring tool. stress/mood default to neutral-good when
// not asked, so the score stays comparable day to day.
const WELLNESS: { id: string; weight: number; fallback: number }[] = [
	{ id: 'sleep', weight: 1.2, fallback: 8 },
	{ id: 'fatigue', weight: 1.2, fallback: 8 },
	{ id: 'soreness', weight: 1, fallback: 8 },
	{ id: 'stress', weight: 0.8, fallback: 8 },
	{ id: 'mood', weight: 0.8, fallback: 8 },
];

/** Overall readiness, 0–100 (higher = fresher); weighted-normalized like the
 *  deep-assessment scoring. */
function readinessScore(answers: Answers): number {
	let num = 0;
	let den = 0;
	for (const it of WELLNESS) {
		num += it.weight * (answers[it.id] ?? it.fallback);
		den += it.weight * 10;
	}
	return den ? Math.round((num / den) * 100) : 0;
}

// ---------------- recommendation engine ----------------

type Intensity = 'rest' | 'tissue' | 'moderate' | 'high';
const INTENSITY_ORDER: Intensity[] = ['rest', 'tissue', 'moderate', 'high'];
/** The more restrictive of two intensities. */
const cap = (a: Intensity, b: Intensity): Intensity =>
	INTENSITY_ORDER[Math.min(INTENSITY_ORDER.indexOf(a), INTENSITY_ORDER.indexOf(b))];

const intensityFromScore = (score: number): Intensity =>
	score >= 78 ? 'high' : score >= 60 ? 'moderate' : 'tissue';

/** Apply the area-specific injury gate to an intensity. */
function injuryCap(answers: Answers, i: Intensity): Intensity {
	const sev = severityOf(answers);
	if (bodyArea(answers) === 'fingers' && sev === 'sharp') return 'rest';
	if (sev === 'painful') return cap(i, 'tissue');
	if (sev === 'tender') return cap(i, 'moderate');
	return i;
}

/** Intensity from wellness + the injury gate (raw score, no personalization). Used
 *  to decide whether asking about skin matters. */
function baseIntensity(answers: Answers): Intensity {
	return injuryCap(answers, intensityFromScore(readinessScore(answers)));
}

const timeShort = (answers: Answers): boolean => (answers.time ?? 10) <= 3;

/** Which questions to show now — core, plus follow-ups only when they'd change
 *  the outcome: severity (when something hurts), stress + mood (when sleep/fatigue
 *  are low), and skin (only when a hard, skin-intensive day is otherwise on). */
export function visibleQuestions(answers: Answers): string[] {
	const out = [...CORE_QUESTIONS];
	if ((answers.body ?? 0) > 0) out.push('severity');
	if ((answers.sleep ?? 10) <= 3 || (answers.fatigue ?? 10) <= 4) out.push('stress', 'mood');
	// Skin only matters on a hard day — ask it once the wellness core is in and the
	// day is still pointing high (don't surface it on the initial defaults).
	const wellnessIn = answers.sleep != null && answers.fatigue != null && answers.soreness != null;
	if (wellnessIn && baseIntensity(answers) === 'high') out.push('skin');
	return out;
}

export interface Readiness {
	/** 0–100 wellness readiness. */
	score: number;
	/** Session recommendation (maps to content.verdicts). */
	verdict: VerdictId;
	/** Injured area, if any (for area-specific advice + rehab routing). */
	area: FlagArea | null;
	/** Surfaced problems/notes (render via content.flags + DailyFlags). */
	flags: DailyFlag[];
	/** Question ids currently in play (core + revealed follow-ups). */
	asked: string[];
}

function areaFlag(area: FlagArea, severe: boolean): DailyFlag {
	if (area === 'fingers')
		return severe
			? { id: 'finger_pain', severity: 'stop', area }
			: { id: 'finger_tender', severity: 'warn', area };
	return severe
		? { id: `${area}_pain`, severity: 'stop', area }
		: { id: `${area}_niggle`, severity: 'warn', area };
}

/** Personalization derived from the logged history (see stats.ts `readinessInsights`). */
export interface ReadinessContext {
	/** Score offset learned from how sessions actually went. */
	calibration?: number;
	/** Recent readiness trend. */
	trend?: 'up' | 'down' | 'flat' | null;
	/** Personal rolling-mean score, to flag a meaningful drop. */
	baseline?: number | null;
}

/** Compose the day's recommendation from wellness, the injury gate, objective load
 *  (ACWR), the time budget, and the user's own history (calibration + trend +
 *  baseline). Every input demonstrably shifts the result. */
export function computeReadiness(
	answers: Answers,
	acwr: AcwrStatus | null = null,
	hist: ReadinessContext = {},
): Readiness {
	// Personal calibration nudges the raw wellness score toward how the user trains.
	const score = Math.max(0, Math.min(100, readinessScore(answers) + (hist.calibration ?? 0)));
	let intensity = injuryCap(answers, intensityFromScore(score));
	const area = bodyArea(answers);
	const sev = severityOf(answers);
	const flags: DailyFlag[] = [];

	if (area && sev) flags.push(areaFlag(area, sev === 'painful' || sev === 'sharp'));

	if (acwr === 'spike') {
		intensity = cap(intensity, 'moderate');
		flags.push({ id: 'acwr_spike', severity: 'warn' });
	} else if (acwr === 'high') {
		flags.push({ id: 'acwr_high', severity: 'info' });
	} else if (acwr === 'low') {
		flags.push({ id: 'acwr_low', severity: 'info' });
	}

	const skin = answers.skin;
	if (skin != null && skin <= 5) {
		if (skin <= 2) intensity = cap(intensity, 'moderate');
		flags.push({ id: 'skin', severity: 'warn' });
	}

	// A multi-day downward trend signals accumulating fatigue — back off, don't push.
	if (hist.trend === 'down') {
		intensity = cap(intensity, 'moderate');
		flags.push({ id: 'readiness_declining', severity: 'warn' });
	}
	// A meaningful drop below the personal baseline is worth surfacing.
	if (hist.baseline != null && score <= hist.baseline - 12) {
		flags.push({ id: 'below_baseline', severity: 'info' });
	}

	let verdict: VerdictId;
	if (intensity === 'rest') verdict = 'rest';
	else if (intensity === 'tissue') verdict = 'tissue';
	else if (intensity === 'moderate') verdict = 'moderate';
	else verdict = timeShort(answers) ? 'short' : 'green';

	return { score, verdict, area, flags, asked: visibleQuestions(answers) };
}

// ---------------- deep injury self-checks ----------------

export type DeepBand = 'manageable' | 'moderate' | 'significant';
/** Rehab stages, mirrored from rehab.ts (kept local so content has no app import). */
type DeepStage = 'acute' | 'subacute' | 'returning';

export interface DeepResult {
	/** 0–100, where 100 = no symptoms (normalized like VISA-C). */
	score: number;
	band: DeepBand;
	stage: DeepStage;
}

/** Score an injury self-check: normalize 0–10 answers to 0–100, then band it.
 *  Thresholds track the VISA-C group means (no-pain ~83, pain ~72, limiting ~60). */
export function scoreDeep(values: number[]): DeepResult {
	const max = values.length * 10;
	const score = max ? Math.round((values.reduce((a, b) => a + b, 0) / max) * 100) : 0;
	const band: DeepBand = score >= 80 ? 'manageable' : score >= 60 ? 'moderate' : 'significant';
	const stage: DeepStage =
		band === 'manageable' ? 'returning' : band === 'moderate' ? 'subacute' : 'acute';
	return { score, band, stage };
}

/** Training phase for a given week, scaled to the block length (last week = deload). */
export function phaseId(w: number, weeks = 8): PhaseId {
	if (w >= weeks) return 'deload';
	if (w > Math.floor(weeks / 2)) return 'phase2';
	return 'phase1';
}
