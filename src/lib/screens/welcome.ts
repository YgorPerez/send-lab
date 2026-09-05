// What Welcome reads, and what it hands back.
//
// The other three resolvers in this directory read a record and return what a
// screen shows. This one is the mirror image: the intake has almost nothing to
// read — an account with no baseline is the whole point of it — and what it needs
// pure and testable is the other direction, the athlete's answers on their way to
// becoming a `Baseline` and a `Program`.
//
// So this module holds three things, none of which renders:
//
//   1. The **draft** — every answer as the form holds it, including "not yet
//      answered", which a `Baseline` cannot express.
//   2. `toBaseline`, the one place a draft becomes the entity.
//   3. `resolveProposal`, what the athlete is shown *before* any of it is saved.
//
// AN INTAKE QUESTION HAS NO DEFAULT (ADR 0019)
// ---------------------------------------------
// The rule the whole draft shape exists to keep, and it is #61's rule pointed at
// input instead of output. #61 found that Today scored a readiness check's
// *fallbacks* when nothing was answered, and put a verdict made of nothing in
// front of the athlete. The SvelteKit intake form did the same thing one
// layer earlier: it opened with `goal = 'boulder'`, `focus = 'fingers'`,
// `level = 'advanced'`, four days a week and all four pieces of gear already
// selected, so an athlete who tapped Next four times got a program built from
// somebody else's answers — and `niggle` and `synovitis` defaulted to `false`,
// which is not "no niggle", it is "nobody asked".
//
// Every required field below therefore starts `null`, `''` or `[]`, and a step
// cannot be advanced until the athlete has answered it. Nothing is preselected.
// It costs four taps and it is the difference between a program the athlete chose
// and one the form chose.
//
// Optional fields are genuinely optional and say so: the two grades, the birth
// date, the bodyweight and the session length all mean something absent, and
// `Baseline` already types every one of them as nullable.
import { type Content, REST_DAY_TYPE } from '$lib/content/types';
import {
	type Baseline,
	EQUIPMENT,
	type Equipment,
	FOCUSES,
	type Focus,
	GOALS,
	type Goal,
	LEVELS,
	type Level,
	type Program,
} from '$lib/types';

/**
 * The athlete's answers, mid-flow.
 *
 * Deliberately **not** a `Partial<Baseline>`. Two of the thirteen fields
 * distinguish unanswered from answered-no — `niggle` and `synovitis` are
 * `boolean` on the entity, and `false` there means the athlete said no — and a
 * `Partial` would spell "unanswered" as an absent key, which is the same shape
 * `false` collapses into the moment anything writes a default. Four more are
 * numbers the athlete types, and those are held as **text**: a half-typed `7.`
 * is not a number, and re-parsing on every keystroke is how a decimal point
 * cannot be entered. Today's bodyweight nudge holds its draft the same way.
 */
export interface BaselineDraft {
	goal: Goal | null;
	focus: Focus | null;
	level: Level | null;
	/** 1–6. Six, not seven: Sunday is always the rest day, and `generateProgram`
	 *  clamps to six for that reason. */
	daysPerWeek: number | null;
	/** Gear on hand. Required non-empty — see `STEP_ANSWERS`. */
	equipment: Equipment[];
	/** Minutes, as typed. Empty means no cap on exercises per day. */
	sessionMinutes: string;
	/** Kilograms, as typed. Storage is canonical (ADR 0009); `prefs.weight` is
	 *  display only, and `format.ts` is the seam that will convert it. */
	bodyweight: string;
	/** Free text, e.g. "V8" / "7c" — informational, and calibration:
	 *  `programGen`'s `gradeLevel` reads a V-number out of the boulder grade and
	 *  it wins over the self-selected level. Deliberately not a closed union. */
	boulderGrade: string;
	routeGrade: string;
	/** ISO `YYYY-MM-DD`, or empty. Informational. */
	birthDate: string;
	/** A current finger/tendon niggle. `null` until answered, because it caps
	 *  finger RPE in the generated program and softens every phase — a default
	 *  here is a training decision nobody made. */
	niggle: boolean | null;
	/** Finger-joint pain or swelling, from the fist-hook self-check. `null` for
	 *  the same reason. */
	synovitis: boolean | null;
	/** Which step the athlete is on, 0-based. Persisted with the answers so a
	 *  resumed flow reopens where it stopped rather than at the beginning. */
	step: number;
}

/** The steps, in order, and which answers each one requires before it advances.
 *
 *  The list *is* the sequence: `STEP_ANSWERS.length` is how many steps there
 *  are, and a step's index into it is its position. One declaration, so a step
 *  cannot be added to the shell without saying what it asks for. */
export const STEP_ANSWERS: readonly (readonly (keyof BaselineDraft)[])[] = [
	// Goal — what you train for. Reorders which weekdays train, and bumps the
	// focus's signature day to the front of that order.
	['goal', 'focus'],
	// Level — how hard the block pushes. The grades sit here rather than with the
	// other informational fields because the boulder grade *recalibrates* this
	// answer, and asking them apart hides that.
	['level'],
	// Week — what can be prescribed at all: how many days, how long a session
	// runs, and which exercises the gear supports.
	['daysPerWeek', 'equipment'],
	// Body — the two finger questions, and the two readings that are only ever
	// read as context.
	['niggle', 'synovitis'],
];

/** Every answer unanswered. A function and not a shared constant: a draft is
 *  mutable state, and one frozen object handed to two callers is one object two
 *  callers edit. */
function blank(): BaselineDraft {
	return {
		goal: null,
		focus: null,
		level: null,
		daysPerWeek: null,
		equipment: [],
		sessionMinutes: '',
		bodyweight: '',
		boulderGrade: '',
		routeGrade: '',
		birthDate: '',
		niggle: null,
		synovitis: null,
		step: 0,
	};
}

/**
 * The draft an intake opens with.
 *
 * Blank for an account with no baseline, and prefilled from the baseline it
 * already has for one redoing it — where nothing is fabricated, because every
 * value is the athlete's own previous answer. `step` restarts at 0 either way: a
 * redo is the same four questions, and reopening one at the last step would hide
 * the three the athlete came back to change.
 */
export function draftFrom(baseline: Baseline | null): BaselineDraft {
	if (!baseline) return blank();
	return {
		goal: baseline.goal,
		focus: baseline.focus,
		level: baseline.level,
		daysPerWeek: baseline.daysPerWeek,
		equipment: [...baseline.equipment],
		sessionMinutes: baseline.sessionMinutes == null ? '' : String(baseline.sessionMinutes),
		bodyweight: baseline.bodyweight == null ? '' : String(baseline.bodyweight),
		boulderGrade: baseline.boulderGrade ?? '',
		routeGrade: baseline.routeGrade ?? '',
		birthDate: baseline.birthDate ?? '',
		niggle: baseline.niggle,
		synovitis: baseline.synovitis,
		step: 0,
	};
}

/** Whether one answer has been given. The shapes an unanswered field takes —
 *  `null`, `''`, `[]` — in one place, so a step's gate cannot disagree with the
 *  next step's. */
function answered(draft: BaselineDraft, field: keyof BaselineDraft): boolean {
	const value = draft[field];
	if (value === null) return false;
	if (typeof value === 'string') return value.trim() !== '';
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

/** Whether the step at `index` has every answer it asks for. What the stepper's
 *  primary is disabled on — disabled and not hidden, with the line that says what
 *  it is waiting for (`docs/component-vocabulary.md`). */
export function stepComplete(draft: BaselineDraft, index: number): boolean {
	return (STEP_ANSWERS[index] ?? []).every((field) => answered(draft, field));
}

/**
 * The first step still missing an answer, or `-1` when the draft is complete.
 *
 * Here rather than in the route because it is a decision and not an arrangement:
 * it is what the **last** step's primary is gated on, and what that primary says
 * it is waiting for. Every other step only has to be finished to be left, but the
 * last one converts the draft, and `toBaseline` refuses a draft with a hole
 * anywhere in it — so gating that button on its own step alone lets it come up
 * enabled over a draft that cannot convert, and the tap then does nothing at all.
 *
 * It is reachable rather than theoretical: `parseDraft` drops any answer this
 * build cannot recognise while `clampStep` keeps the stored step, so a draft can
 * legitimately reopen at the last step with the first one blank. Which is also
 * why this returns *which* step rather than a boolean — the athlete has to be
 * told the question that is missing, and it is not the one in front of them.
 */
export function firstIncompleteStep(draft: BaselineDraft): number {
	return STEP_ANSWERS.findIndex((_, index) => !stepComplete(draft, index));
}

/** Whether every step is complete — what makes a draft convertible. */
export function draftComplete(draft: BaselineDraft): boolean {
	return firstIncompleteStep(draft) === -1;
}

/** How far through the flow a draft got, as a count of complete steps. Read by
 *  Today, which offers to resume and has to say how much is already answered. */
export function stepsAnswered(draft: BaselineDraft): number {
	return STEP_ANSWERS.filter((_, index) => stepComplete(draft, index)).length;
}

/** A typed number, or null. Rejects blanks, junk, negatives and zero — a
 *  bodyweight of 0 kg and a session of 0 minutes are both "not given" spelled as
 *  a measurement, and `sessionCap` would read the second as a two-exercise cap.
 *  The comma is accepted because a pt-BR keyboard offers it as the decimal
 *  separator and `Number('71,5')` is `NaN`. */
function positive(text: string): number | null {
	const value = Number(text.trim().replace(',', '.'));
	return Number.isFinite(value) && value > 0 ? value : null;
}

/** Free text, trimmed, or null. */
function given(value: string): string | null {
	return value.trim() || null;
}

/**
 * The entity a completed draft becomes, or null while it is not complete.
 *
 * `null` rather than a `Baseline` with holes in it, because the holes are the
 * thing: three of the required answers have no honest default, and two of those
 * three change the training. The caller's own gate is `draftComplete`; this
 * re-checks it rather than trusting it, so there is no path from an unanswered
 * question to a stored `false`.
 *
 * `completedAt` is passed in rather than read off the clock, so the function is
 * pure and a test can pin the day. It is an ISO calendar date and never a label
 * (ADR 0003).
 */
export function toBaseline(draft: BaselineDraft, completedAt: string): Baseline | null {
	if (
		draft.goal === null ||
		draft.focus === null ||
		draft.level === null ||
		draft.daysPerWeek === null ||
		draft.niggle === null ||
		draft.synovitis === null ||
		draft.equipment.length === 0
	)
		return null;
	return {
		goal: draft.goal,
		focus: draft.focus,
		level: draft.level,
		daysPerWeek: draft.daysPerWeek,
		bodyweight: positive(draft.bodyweight),
		equipment: [...draft.equipment],
		boulderGrade: given(draft.boulderGrade),
		routeGrade: given(draft.routeGrade),
		niggle: draft.niggle,
		synovitis: draft.synovitis,
		birthDate: given(draft.birthDate),
		sessionMinutes: positive(draft.sessionMinutes),
		completedAt,
	};
}

/**
 * A stored draft, narrowed back to one.
 *
 * Every closed-set field is checked against its own array rather than cast,
 * which is what those arrays in `types.ts` exist for — "a `Baseline` arrives over
 * the wire on every hydrate, and the write path checks these at runtime". A
 * persisted draft is the same problem one layer out: it comes back from storage,
 * where an older build or a hand-edited key can have left anything, and a value
 * that is not an answer the form could have produced is dropped rather than
 * trusted. Dropping it reads as unanswered, which is the honest handling and the
 * one the whole module is built around.
 */
export function parseDraft(value: unknown): BaselineDraft {
	if (typeof value !== 'object' || value === null) return blank();
	const raw = value as Partial<Record<keyof BaselineDraft, unknown>>;
	const one = <T extends string>(set: readonly T[], v: unknown): T | null =>
		typeof v === 'string' && (set as readonly string[]).includes(v) ? (v as T) : null;
	const str = (v: unknown): string => (typeof v === 'string' ? v : '');
	const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
	const days = Number(raw.daysPerWeek);
	const equipment = raw.equipment;
	return {
		goal: one(GOALS, raw.goal),
		focus: one(FOCUSES, raw.focus),
		level: one(LEVELS, raw.level),
		daysPerWeek: Number.isInteger(days) && days >= 1 && days <= 6 ? days : null,
		equipment: Array.isArray(equipment) ? EQUIPMENT.filter((eq) => equipment.includes(eq)) : [],
		sessionMinutes: str(raw.sessionMinutes),
		bodyweight: str(raw.bodyweight),
		boulderGrade: str(raw.boulderGrade),
		routeGrade: str(raw.routeGrade),
		birthDate: str(raw.birthDate),
		niggle: bool(raw.niggle),
		synovitis: bool(raw.synovitis),
		step: clampStep(raw.step),
	};
}

/** A stored step, held inside the flow. A draft written by a build with more
 *  steps than this one has would otherwise reopen past the end of the stepper. */
export function clampStep(value: unknown): number {
	const step = Math.trunc(Number(value));
	if (!Number.isFinite(step)) return 0;
	return Math.min(STEP_ANSWERS.length - 1, Math.max(0, step));
}

/** One weekday of the proposed week, and whether the program trains it. */
export interface ProposedDay {
	/** Stable weekday key. Never matched against the label (ADR 0003). */
	key: string;
	label: string;
	trains: boolean;
}

/** What the athlete is shown before anything is saved. */
export interface Proposal {
	/** The whole week, in calendar order, each weekday marked. */
	week: ProposedDay[];
	/** How many of them train. */
	trainingDays: number;
	/** The generated block's first phase, by the name the program gives it. */
	firstPhase: string;
	/** A niggle was reported, so finger effort is capped and every phase softened. */
	niggle: boolean;
	/** Finger-joint pain or swelling was reported. */
	synovitis: boolean;
}

/**
 * The proposal, read off the program that will actually be stored.
 *
 * Derived from the generated `Program` rather than re-derived from the baseline,
 * which is the difference between showing what will run and showing what was
 * asked for. The two come apart on purpose: `generateProgram` rests out a weekday
 * whose exercises the athlete's gear cannot support, so a four-day answer can
 * produce a three-day week — and the SvelteKit proposal, which called
 * `trainingDays(content, assessment)` directly, showed the four.
 */
export function resolveProposal(content: Content, program: Program, baseline: Baseline): Proposal {
	const template: Record<string, { dayType: string } | undefined> = program.template;
	const week = content.builtInWeek.map((weekday) => ({
		key: weekday.k,
		label: weekday.label,
		// A weekday with no template entry runs its built-in day type — the same
		// fallback chain every other read of the template makes.
		trains: (template[weekday.k]?.dayType ?? weekday.dayType) !== REST_DAY_TYPE,
	}));
	return {
		week,
		trainingDays: week.filter((day) => day.trains).length,
		firstPhase: program.phases[0]?.name ?? '',
		niggle: baseline.niggle,
		synovitis: baseline.synovitis,
	};
}
