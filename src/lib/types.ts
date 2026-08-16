// Domain entity types — the vocabulary from CONTEXT.md, as data.
//
// Extracted from the SvelteKit app's `state.svelte.ts` during the TanStack Start
// scaffold (issue #21) so the framework-agnostic domain modules survive the port
// untouched. This module holds *entities*, never the store that contains them:
// what holds the interactive state is ADR 0007's question, and `AppState`
// deliberately did not come across.
//
// Nothing here is locale-dependent. Every identity is a stable id or an ISO date
// (ADR-0003) — a display string is never matched on, because the English weekday
// labels are byte-identical to the stable keys and the whole bug class is
// invisible outside pt-BR.

/** A marker reading in a tracked series (finger strength, pull max, bodyweight). */
export interface MetricEntry {
	/** Localized day label for display (e.g. "Jun 24"). */
	date: string;
	v: number;
	/** Epoch ms when logged — the precise timestamp behind the day label. */
	at?: number;
	/** Edge depth / block width (mm) for size-dependent markers (maxhang, pinch). */
	mm?: number;
	/** Bodyweight (kg) at test time, so the %BW strength index stays accurate. */
	bw?: number;
}

export interface LogEntry {
	date: string;
	type: 'rec' | 'day' | 'test';
	label: string;
	color: string;
	note: string;
}

/** One logged set within a workout (all fields optional — log what applies). */
export interface WorkoutSet {
	weight: number | null;
	edge: number | null;
	time: number | null;
	reps: number | null;
	rest: number | null;
	/** Rated effort, RPE 0–10. */
	rpe: number | null;
	/** Grip used (a Grip id, or null). */
	grip: string | null;
	/** Whether the set has been completed. */
	done: boolean;
}

export interface WorkoutLogExercise {
	exId: string;
	name: string;
	sets: WorkoutSet[];
}

export interface WorkoutEntry {
	/** Localized display date (e.g. "Jun 21"). Display only — never matched on. */
	date: string;
	/** ISO calendar date (YYYY-MM-DD, local). Identifies the session's day, and
	 *  drives ordering / streaks / weekly buckets. */
	at: string;
	/** Stable weekday key (Mon..Sun) for the slot trained. Never a localized label
	 *  — a language switch used to orphan the session (ADR-0003). */
	day: string;
	exercises: WorkoutLogExercise[];
	note: string;
	/** Session length in minutes — the duration term of sRPE internal load
	 *  (sRPE = session-RPE × minutes; Foster). Optional; estimated from logged
	 *  work + rest when absent. */
	durationMin?: number;
}

/** A logged injury self-check result (deep assessment), newest last. */
export interface DeepEntry {
	date: string;
	area: string;
	score: number;
	band: string;
}

/** A daily readiness check recorded for the trend over time. */
export interface ReadinessEntry {
	date: string;
	/** Epoch ms when the check was first completed (drives the logged time-of-day). */
	at: number;
	/** The recommended session type (VerdictId). */
	verdict: string;
	/** Overall readiness score 0–100 (higher = fresher). */
	score: number;
	/** The full set of answers given (question id → chosen value), so the history
	 *  can show exactly what was reported. */
	answers?: Record<string, number>;
	/** The surfaced flags at the time (the conclusion's warnings). */
	flags?: { id: string; severity: string; area?: string }[];
	/** Post-session outcome, set after training: 0 bailed · 1 flat · 2 as-expected
	 *  · 3 strong. Feeds the personal calibration of future scores. */
	outcome?: number;
}

export type Goal = 'boulder' | 'sport' | 'all';
export type Focus = 'fingers' | 'power' | 'endurance' | 'tissue';
export type Level = 'intermediate' | 'advanced' | 'elite';
export type Equipment = 'hangboard' | 'board' | 'rings' | 'weights';

/** Baseline assessment captured at onboarding (goals + context). */
export interface Assessment {
	goal: Goal;
	focus: Focus;
	level: Level;
	daysPerWeek: number;
	bodyweight: number | null;
	/** Gear on hand — filters which exercises the generated program can use. */
	equipment: Equipment[];
	/** Hardest grades, free text (e.g. "V8", "7c"); informational + calibration. */
	boulderGrade: string | null;
	routeGrade: string | null;
	/** A current finger/tendon niggle → the program caps finger intensity. */
	niggle: boolean;
	/** Finger-joint pain/swelling from the fist-hook synovitis self-check. */
	synovitis: boolean;
	/** Birth date (ISO YYYY-MM-DD), informational. Replaces the old free-text age. */
	birthDate: string | null;
	/** Typical session length (min) → caps exercises per day. */
	sessionMinutes: number | null;
	completedAt: string;
}

/** A per-weekday slot in the program template. */
export interface ProgramDayCfg {
	/** Day-type id (category / load / color / default exercises) this weekday runs. */
	dayKey: string;
	/** Ordered exercise ids (primary first); absent = the day-type's defaults. */
	ex?: string[];
	/** Custom focus name shown instead of the day-type label. */
	name?: string;
}

/** Per-exercise prescription override in the program (canonical kg / mm / seconds).
 *  Any field left undefined falls back to the variant's built-in target. */
export interface ProgramTarget {
	/** Chosen variant index for this exercise in the program. */
	variant?: number;
	sets?: number;
	reps?: number;
	loadKg?: number;
	edgeMm?: number;
	workSec?: number;
	restSec?: number;
	rpe?: number;
}

/** A periodization phase spanning a run of weeks. */
export interface ProgramPhase {
	name: string;
	weeks: number;
	/** Load multiplier, percent of baseline (100 = unchanged). */
	intensity: number;
	/** Volume multiplier (sets / rounds), percent of baseline. */
	volume: number;
	deload: boolean;
}

export interface Program {
	weeks: number;
	template: Record<string, ProgramDayCfg>;
	/** Prescription overrides keyed `${weekday}:${exId}`. */
	targets: Record<string, ProgramTarget>;
	/** Ordered phases; their weeks need not sum to `weeks` (the tail repeats). */
	phases: ProgramPhase[];
	/** Auto-progress working loads each week at study-backed, level-scaled rates. */
	autoProgress: boolean;
}

export interface SavedProgram {
	name: string;
	program: Program;
}

/** The injured area a rehab block targets. */
export type RehabArea = 'fingers' | 'elbow' | 'shoulder' | 'wrist';
/** How far along that rehab block is — it gates which work is allowed. */
export type RehabStage = 'acute' | 'subacute' | 'returning';

/** Active injury rehab. Stashes the program that was active before rehab so it
 *  can be restored when rehab ends. */
export interface RehabState {
	area: RehabArea;
	stage: RehabStage;
	startedAt: string;
	previous: Program;
}
