import type { PhaseId, VerdictId } from './types';

export type Answers = Record<string, number>;
export type FlagArea = 'fingers' | 'elbow' | 'shoulder' | 'wrist';
/** Acute:chronic workload ratio band (see stats.ts `acwr`). */
type AcwrStatus = 'low' | 'optimal' | 'high' | 'spike';
type FlagSeverity = 'stop' | 'warn' | 'info';

/** Objective signals fed into the recommendation. ACWR is one input among several
 *  (it has been critiqued — Impellizzeri 2020 — so it never decides alone);
 *  monotony adds Foster's load-variability dimension; probe adds a climbing-specific
 *  neuromuscular reading. */
export interface LoadSignals {
	/** Acute:chronic workload ratio band (EWMA; see stats.ts `acwr`). */
	acwr?: AcwrStatus | null;
	/** 'high' when weekly training monotony crosses Foster's risk threshold. */
	monotony?: 'high' | null;
	/** Objective max-pull probe vs personal baseline (see stats.ts `probeReadiness`). */
	probe?: 'fresh' | 'normal' | 'fatigued' | 'low' | null;
}

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
const CORE_QUESTIONS = ['sleep', 'fatigue', 'soreness', 'body', 'illness', 'time'];

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

// Each answer is 0–10 (10 = best). Perceived fatigue/recovery carries the most
// weight — Saw, Main & Gastin (2016) found fatigue, physical recovery and general
// well-being the most load-responsive subjective items, and the Perceived Recovery
// Status scale (Laurent 2011) tracks next-session performance (r≈-.63). Soreness
// and sleep follow; note Saw found self-rated sleep *quality* among the *less*
// load-responsive items, so sleep is no longer privileged above soreness here
// (it still matters for recovery — Fullagar 2015 — hence not the lowest). stress
// & mood default to neutral-good when not asked, so the score stays comparable.
//
// NOTE: the *direction* (fatigue weighted most) has support, but these exact
// weights — and the band thresholds in `intensityFromScore` — are a reasoned
// default, NOT empirically derived (the literature on per-item weighting is
// genuinely mixed). The principled validation is the per-user feedback loop
// (stats.ts `readinessInsights` → `hist.calibration`), which nudges the score
// toward how the individual's sessions actually go. Treat the constants as a
// sensible starting heuristic, not calibrated truth.
const WELLNESS: { id: string; weight: number; fallback: number }[] = [
	{ id: 'fatigue', weight: 1.2, fallback: 8 },
	{ id: 'soreness', weight: 1, fallback: 8 },
	{ id: 'sleep', weight: 1, fallback: 8 },
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

// Band thresholds are a heuristic (see the WELLNESS note); the calibration loop,
// not these cutoffs, is what tunes the score to the individual.
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
	load: LoadSignals = {},
	hist: ReadinessContext = {},
): Readiness {
	// Personal calibration nudges the raw wellness score toward how the user trains.
	const score = Math.max(0, Math.min(100, readinessScore(answers) + (hist.calibration ?? 0)));
	let intensity = injuryCap(answers, intensityFromScore(score));
	const area = bodyArea(answers);
	const sev = severityOf(answers);
	const flags: DailyFlag[] = [];

	if (area && sev) flags.push(areaFlag(area, sev === 'painful' || sev === 'sharp'));

	// Illness gate ("neck check"): systemic symptoms (fever / below the neck) are a
	// hard stop — training a taxed system risks more than it gains (Schwellnus 2016).
	// Above-the-neck symptoms only → keep it easy.
	const illness = answers.illness ?? 0;
	if (illness >= 2) {
		intensity = cap(intensity, 'rest');
		flags.push({ id: 'illness_systemic', severity: 'stop' });
	} else if (illness === 1) {
		intensity = cap(intensity, 'moderate');
		flags.push({ id: 'illness_mild', severity: 'warn' });
	}

	if (load.acwr === 'spike') {
		intensity = cap(intensity, 'moderate');
		flags.push({ id: 'acwr_spike', severity: 'warn' });
	} else if (load.acwr === 'high') {
		flags.push({ id: 'acwr_high', severity: 'info' });
	} else if (load.acwr === 'low') {
		flags.push({ id: 'acwr_low', severity: 'info' });
	}

	// High training monotony (Foster): same load every day, no easy days — back off
	// to inject the variability that protects against overload.
	if (load.monotony === 'high') {
		intensity = cap(intensity, 'moderate');
		flags.push({ id: 'monotony_high', severity: 'warn' });
	}

	// Objective probe: a sizeable drop in maximal pull vs baseline is acute
	// neuromuscular fatigue regardless of how you feel; a fresh reading just
	// confirms it's safe to push.
	if (load.probe === 'low') {
		intensity = cap(intensity, 'tissue');
		flags.push({ id: 'probe_low', severity: 'warn' });
	} else if (load.probe === 'fatigued') {
		intensity = cap(intensity, 'moderate');
		flags.push({ id: 'probe_fatigued', severity: 'warn' });
	} else if (load.probe === 'fresh') {
		flags.push({ id: 'probe_fresh', severity: 'info' });
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
