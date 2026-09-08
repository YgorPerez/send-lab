// Domain entity types — the vocabulary from CONTEXT.md, as data.
//
// Extracted from the SvelteKit app's `state.svelte.ts` during the TanStack Start
// scaffold (issue #21) so the framework-agnostic domain modules survive the port
// untouched. This module holds *entities*, never the store that contains them:
// what holds the interactive state is ADR 0007's answer, and `AppState`
// deliberately did not come across.
//
// RECONCILED WITH THE GLOSSARY — #55
// ----------------------------------
// Every type here is a bare `CONTEXT.md` noun. Three exceptions, each because
// the bare noun is already taken by something else:
//
//   `LoggedSet`             — `Set` shadows JavaScript's `Set` in any module
//                             that imports it, and `ReadonlySet` is in use.
//   `LoggedExercise`        — `Exercise` is the glossary's *library* movement.
//                             This is one instance of one, not a synonym.
//   `LoggedReadinessCheck`  — `ReadinessCheck` is the component that asks the
//                             nine questions (`docs/component-vocabulary.md`,
//                             ADR 0010). This is the record one leaves behind.
//
// The rule in all three: the entity yields when something else already holds the
// bare noun, and `Logged` says what distinguishes it — these are history.
//
// Three names were deleted rather than renamed: `MetricEntry` (Marker is
// *Leaving*; bodyweight survives on its own as ADR 0009's divisor), `LogEntry`
// (`log[]` was dropped by #12 — two of its three kinds died with `metrics[]`,
// `'rec'` was written nowhere, and the survivor was a drifting copy of
// `taskDone`), and `WeekdayTemplate.dayKey`, which was named for a weekday and
// held a day type: the exact overload ADR-0002 closed.
//
// NO ENTITY STORES A FORMATTED DATE
// ---------------------------------
// ADR-0003: a display string is never an identity. Every entity below carries an
// ISO calendar date or an epoch timestamp and nothing else; the localized label
// is derived at render by `displayDate(iso)`. Five entities used to carry a
// `date` string as well, and two code paths compared it against a freshly
// formatted `today()` — a comparison that cannot match once the athlete switches
// language, because the stored half is frozen in whatever wrote it. The field and
// both comparisons went together (#55).
//
// Identity is branded, key-side only (#20). `src/lib/ids.ts` is the only module
// that mints one, so a localized label reaching a key is a compile error rather
// than a screen that renders correctly in English.
import type { SelfCheckBand } from '$lib/content/logic';
import type { BodyArea, DayTypeId, Grip, RehabStage, VerdictId } from '$lib/content/types';
import type { ExerciseId, OverrideKey, WeekdayKey } from '$lib/ids';

/** `BodyArea` and `RehabStage` are declared a layer down, in `content/types.ts`,
 *  and re-exported here so the entities below and their app-side consumers read
 *  from one place. They used to be declared twice — `FlagArea` in
 *  `content/logic.ts` and `RehabArea` here — and #69 moved the canonical copy
 *  *down* rather than importing *up*, which would have inverted the layering
 *  this module's own imports establish. See the note on `BodyArea` for why
 *  neither old name survived. */
export type { BodyArea, RehabStage };

/** A bodyweight reading. Not a marker — nothing is tested and no effort is
 *  expended, and it is read as the divisor other numbers are expressed against
 *  rather than as progress in its own right (ADR 0009). */
export interface BodyweightReading {
	/** Epoch ms when logged. The day is `isoDayOf(at)`; there is no stored label. */
	at: number;
	/** Kilograms. Storage is always canonical; `prefs.weight` is display only. */
	kg: number;
}

/** One logged effort within a session. Every field is nullable in practice — the
 *  athlete logs what applies to the exercise in front of them. */
export interface LoggedSet {
	/** Added load in kg. Named to match `Override.loadKg`, and deliberately not
	 *  `weight` — the glossary keeps that word away from Bodyweight. */
	loadKg: number | null;
	/** Edge depth or block width in mm. */
	edgeMm: number | null;
	/** Work duration in seconds. */
	workSec: number | null;
	reps: number | null;
	/** Rest taken after the set, in seconds. */
	restSec: number | null;
	/** Rated effort, RPE 0–10. */
	rpe: number | null;
	grip: Grip | null;
	/** Whether the set was completed. */
	done: boolean;
}

/** One exercise inside a session, with the sets logged against it. The library
 *  movement it instantiates is `exercise`; everything else is history. */
export interface LoggedExercise {
	exercise: ExerciseId;
	/** Which variant of that exercise was trained, as an index into its
	 *  `variants`. The label is `exerciseLabel(exercise, variant)` at render.
	 *
	 *  This replaced a stored localized `name` (#69), which was ADR 0012's last
	 *  standing violation: a session logged in English showed English names after
	 *  a switch to pt-BR, because the stored half was frozen in whatever wrote it.
	 *  An index is not a display string, so it records what was actually done —
	 *  which the alternative, resolving the *current* program swap at render,
	 *  would not: swapping a variant would relabel every past session that used
	 *  the old one. */
	variant: number;
	sets: LoggedSet[];
}

/** The training actually done in one slot on one calendar date. A slot is a
 *  plan; a session is the history. */
export interface Session {
	/** ISO calendar date (YYYY-MM-DD, local). Identifies the session's day, and
	 *  drives ordering, streaks and weekly buckets. */
	at: string;
	/** The weekday slot trained. Never a localized label (ADR-0003). */
	weekday: WeekdayKey;
	/** The day type actually trained, stamped when the session is logged.
	 *
	 *  Recorded rather than derived, because it cannot be re-derived. ADR 0016
	 *  split the day type from the weekday and made visible that a session held
	 *  neither: the Log screen looked the weekday up in the **built-in week** and
	 *  showed whatever day type that runs *today*, so editing a weekday's day type
	 *  silently relabelled every past session on it. A session is history
	 *  (`CONTEXT.md`), and history cannot be a function of the current program. */
	dayType: DayTypeId;
	exercises: LoggedExercise[];
	note: string;
	/** Session length in minutes — the duration term of internal load
	 *  (effort × minutes; Foster). Estimated from logged work + rest when absent. */
	durationMin?: number;
}

/** A logged injury self-check. Informs training, never diagnoses. */
export interface SelfCheck {
	/** Epoch ms when the check was completed. */
	at: number;
	area: BodyArea;
	/** 0–100, from the area's validated instrument. */
	score: number;
	/** Which band the score fell in — the same closed set the content library
	 *  scores to. It routes to a rehab stage, so it is never free text. */
	band: SelfCheckBand;
}

/** A daily readiness check recorded for the trend over time. */
export interface LoggedReadinessCheck {
	/** Epoch ms when the check was first completed — drives the logged
	 *  time-of-day, and the day is `isoDayOf(at)`. */
	at: number;
	/** The ceiling set on today's session. */
	verdict: VerdictId;
	/** Readiness score 0–100, higher meaning fresher. */
	score: number;
	/** Every answer given (question id → chosen value), so the history can show
	 *  exactly what was reported. */
	answers?: Record<string, number>;
	/** The flags surfaced at the time. */
	flags?: { id: string; severity: string; area?: string }[];
	/** Post-session outcome, set after training: 0 bailed · 1 flat · 2
	 *  as-expected · 3 strong. Feeds the athlete's calibration. */
	outcome?: number;
}

// The four closed sets an intake answers in. Arrays rather than bare
// unions for the same reason as the content library's: a `Baseline` arrives over
// the wire on every hydrate, and the write path checks these at runtime. They stay
// here rather than moving down beside the content library's own sets — ADR 0013
// moves a set down when it is shared *across* that boundary, and `content/` reads
// none of these.
export const GOALS = ['boulder', 'sport', 'all'] as const;
export type Goal = (typeof GOALS)[number];

export const FOCUSES = ['fingers', 'power', 'endurance', 'tissue'] as const;
export type Focus = (typeof FOCUSES)[number];

export const LEVELS = ['intermediate', 'advanced', 'elite'] as const;
export type Level = (typeof LEVELS)[number];

export const EQUIPMENT = ['hangboard', 'board', 'rings', 'weights'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/** The answers given at an intake. Shapes the generated program and its
 *  progression rate. */
export interface Baseline {
	goal: Goal;
	focus: Focus;
	level: Level;
	daysPerWeek: number;
	/** Kilograms, or null if not given. */
	bodyweight: number | null;
	/** Gear on hand — filters which exercises the generated program can use. */
	equipment: Equipment[];
	/** Hardest grades, free text (e.g. "V8", "7c"). Informational + calibration. */
	boulderGrade: string | null;
	routeGrade: string | null;
	/** A current finger/tendon niggle, which caps finger intensity. */
	niggle: boolean;
	/** Finger-joint pain or swelling, from the fist-hook self-check. */
	synovitis: boolean;
	/** ISO YYYY-MM-DD. Informational. */
	birthDate: string | null;
	/** Typical session length (min), which caps exercises per day. */
	sessionMinutes: number | null;
	completedAt: string;
}

/** One weekday's entry in the program's weekday template: the day type it runs,
 *  and any customization of it. */
export interface WeekdayTemplate {
	/** The day type this weekday runs. A weekday says *when*, a day type says
	 *  *what* (ADR-0002), which is why this is not called `dayKey`. */
	dayType: DayTypeId;
	/** Ordered exercises, primary first. Absent = the day type's defaults. */
	exercises?: ExerciseId[];
	/** Custom focus name shown instead of the day type's label. */
	name?: string;
}

/** A stored deviation from a built-in target, set by the athlete. Anything left
 *  undefined falls back to the variant's built-in value. Canonical units. */
export interface Override {
	/** Chosen variant index for this exercise. */
	variant?: number;
	sets?: number;
	reps?: number;
	loadKg?: number;
	edgeMm?: number;
	workSec?: number;
	restSec?: number;
	rpe?: number;
}

/**
 * Where a working load's number came from — the rung of the ladder the athlete
 * answered on.
 *
 * Stored with the number because **a measurement and a recollection are not the
 * same evidence** ([#29](https://github.com/YgorPerez/send-lab/issues/29) grades
 * them differently), and because the load search reads it: a number the athlete
 * measured deserves less moving than one the app suggested.
 *
 * Closed and ordered by how much it is worth. Every one of them is a **working
 * load** — what the exercise is trained at — and they differ only in how the
 * number was arrived at. `tested` is one the athlete has actually measured at
 * this variant; `usual` is a recollection of what they normally load, which is
 * honest and is not history — writing it as a session would fabricate training
 * that never happened (ADR 0020); `predicted` is `strength.ts`'s estimate, which
 * carries its own confidence; `floor` is the conservative starting point the
 * load search exists to move.
 *
 * **None of them is a tested max**, and the glossary keeps those apart: a max is
 * what an exercise can be tested at, a working load is what it is trained at, and
 * the fraction between them is per-exercise and unsourced (#87 deleted the last
 * table of them). So the first rung asks for the load, not the max.
 */
export const WORKING_LOAD_SOURCES = ['tested', 'usual', 'predicted', 'floor'] as const;
export type WorkingLoadSource = (typeof WORKING_LOAD_SOURCES)[number];

/**
 * The load an exercise is actually trained at, held per exercise **and variant**.
 *
 * `CONTEXT.md`'s **working load**, and explicitly **not an `Override`**
 * (ADR 0020): an override is addressed by the weekday it applies to and a
 * working load is not addressed by a weekday at all, and the Program page edits
 * the one while the load search rewrites the other.
 *
 * It is what `progression.ts`'s weekly rates scale — an exercise without one
 * does not progress, because a percentage of nothing is nothing.
 */
export interface WorkingLoad {
	exercise: ExerciseId;
	/** Which variant it is the load for, as an index into `variants`. 30kg on
	 *  weighted pull-ups says nothing about a one-arm ladder. */
	variant: number;
	/** Added load in kg. Zero is a real answer on an edge — bodyweight-only on a
	 *  20mm hang is a genuine prescription — and never one on a pinch block. */
	addedKg: number;
	source: WorkingLoadSource;
	/** Epoch ms when the athlete answered. There is no stored label (ADR-0003). */
	at: number;
}

/** A stretch of consecutive weeks inside a block, carrying its own intensity and
 *  volume multipliers. A deload is a phase, not a separate concept. */
export interface Phase {
	/** Athlete-authored, so localized free text. Not a `PhaseId` — that is the
	 *  content library's own three archetypes, and a different concept. */
	name: string;
	weeks: number;
	/** Percent of baseline (100 = unchanged). */
	intensity: number;
	/** Percent of baseline, for sets and rounds. */
	volume: number;
	deload: boolean;
}

/** The reusable design of the athlete's training. One is active; others can be
 *  saved and switched. */
export interface Program {
	/** The block: the run of weeks this program spans. Independent of the phases
	 *  below, which may span fewer — the last is then held for the remainder. */
	weeks: number;
	/** The weekday template. `Partial`, because it is: a weekday with no entry
	 *  runs its built-in day type, and every read of it is a fallback chain over
	 *  that absence (`prescription.ts`). A total `Record` typed the miss away
	 *  while `{}` stayed assignable, so the fallbacks were trusted rather than
	 *  checked. */
	template: Partial<Record<WeekdayKey, WeekdayTemplate>>;
	/** The athlete's overrides, keyed by `overrideKey(weekday, exercise)`. They
	 *  *feed* the prescription rather than being it — what they resolve to is
	 *  `prescription.ts`'s to compute and is stored nowhere, which is why this
	 *  field is not called `targets` (#72, ADR 0014).
	 *
	 *  Sparse by nature and `Partial` for the same reason as `template`: an
	 *  exercise with no override runs the variant's built-in target. */
	overrides: Partial<Record<OverrideKey, Override>>;
	phases: Phase[];
	/** Auto-progress working loads each week at study-backed, level-scaled rates. */
	autoProgress: boolean;
}

export interface SavedProgram {
	name: string;
	program: Program;
}

/** The mode where the program is replaced by a conservative plan for one injured
 *  area. Stashes the program that was active before, so it can be restored. */
export interface Rehab {
	area: BodyArea;
	stage: RehabStage;
	startedAt: string;
	previous: Program;
}
