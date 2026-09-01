// Prescription resolution: which protocol a slot runs, which exercises are in
// it, and at what numbers — after swaps, overrides, weekly progression and phase
// scaling are all applied. `CONTEXT.md` calls that result the **prescription**,
// which is what this module is named for.
//
// Ported from `main:src/lib/plan.ts` (#69), the largest domain module on `main`
// and the last one with no counterpart here. It is *not* called `plan.ts`: the
// glossary puts "plan" on Program's avoid-list, and the file was named for a
// concept the vocabulary does not have.
//
// WHAT DID NOT COME ACROSS
// -----------------------
// `plan.ts` was 700 lines because resolution and mutation shared a file — every
// function read the Svelte runes store, so `resolveDay` and `setDayPlan` were
// equally coupled to it and there was nothing to separate. Only the resolving
// half is here (~300 lines). The mutations belong to `/api/state` and
// `server/state/*` (#57), the label helpers to `format.ts`, and `taskKey` is
// superseded by `ids.ts`, which brands it.
//
// `setDayPlan` is quoted as history and has no counterpart here: the concept it
// wrote is `slotDayType`, renamed by #72 under ADR 0014. `resolveDay` is not
// history — it is live below, and its `day` is the content library's `Day`,
// which #72 left alone. ADR 0014's audit list owns that one.
//
// STATE IS AN ARGUMENT
// --------------------
// Every function on `main` read `appState` directly, which is why none of them
// could be tested without rendering. Here they are pure functions of
// `(content, state, …)`. That is what lets `tests/prescription.test.ts` drive the
// whole fallback chain from plain objects, and what lets #56's collections feed
// the same functions without this module knowing what holds the state.
//
// IDENTITIES AT THE CONTENT BOUNDARY
// ----------------------------------
// `Day.k` and `Day.ex` are plain `string` in `content/types.ts` and stay that
// way: branding them would make the content layer import `$lib/ids`, and the
// dependency runs app → content. So the vouching happens here, on the way out —
// `asWeekdayKey(d.k)` and `d.ex.map(asExerciseId)`. This module is the seam
// where content's strings become the app's identities.
//
// It resolves, and it does not format. Every localized label the resolver's
// answers need — the weekday's name, the variant's name — is in `format.ts`,
// which is why `missedYesterday` hands back a `WeekdayKey` and not a label.
import type {
	Content,
	Day,
	DayTypeId,
	Exercise,
	Range,
	Variant,
	VariantParams,
} from '$lib/content/types';
import { isoDay } from '$lib/dates';
import {
	asExerciseId,
	asWeekdayKey,
	asWeekId,
	type ExerciseId,
	overrideKey,
	type SlotKey,
	slotKey,
	type TaskKey,
	taskKey,
	type WeekdayKey,
	type WeekId,
	weekdayKeyOf,
	weekNumberOf,
} from '$lib/ids';
import { progressionFactor, SYNERGY, weeklyRate } from '$lib/progression';
import { adherenceRatio, pendingExercises } from '$lib/readinessPlan';
import type { Baseline, Level, Override, Phase, Program, Session } from '$lib/types';

/**
 * The account state the resolver reads — and nothing more.
 *
 * A read-only slice of the persisted document, named here rather than in
 * `lib/types.ts` because that module holds *entities* and this is a view over a
 * store. Naming it at all is the point: it is the interface #56's collections
 * implement and #57 writes through, so the resolver depends on a shape rather
 * than on whatever happens to hold it (ADR 0007 owns that question, and #59 has
 * not answered it).
 *
 * Every sparse record is `Partial`, so a miss is `undefined` at the type level
 * rather than by convention — the whole resolver is fallback chains over misses,
 * and `noUncheckedIndexedAccess` is off in this repo.
 */
export interface ResolverState {
	/** The training week the athlete is on. */
	readonly currentWeek: WeekId;
	readonly program: Program;
	/** Library-wide variant choice per exercise — the weakest swap. */
	readonly swaps: Readonly<Partial<Record<ExerciseId, number>>>;
	/** Per-slot day type, overriding the template for that slot alone. */
	readonly slotDayType: Readonly<Partial<Record<SlotKey, DayTypeId>>>;
	/** Per-slot exercise list, overriding the template for that slot alone. */
	readonly slotExercises: Readonly<Partial<Record<SlotKey, ExerciseId[]>>>;
	/** Per-task variant choice — the strongest swap. */
	readonly taskSwaps: Readonly<Partial<Record<TaskKey, number>>>;
	/** Which tasks are ticked off. ADR-0001 makes this the one record that says
	 *  whether a slot was trained, which is why adherence and carry-forward both
	 *  read it rather than counting sessions. */
	readonly taskDone: Readonly<Partial<Record<TaskKey, boolean>>>;
	/** The training history. Named for the glossary's **session** at every layer
	 *  it passes through, which is what ADR 0014 settled: #56 named the store's
	 *  collection, and #57 carried it into storage and onto the wire. The old
	 *  `workouts` — the first word on Session's _Avoid_ list — is gone rather than
	 *  adapted around; `server/record/rows.ts` refuses it as an unknown
	 *  collection. */
	readonly sessions: readonly Session[];
	/** The onboarding intake, or null before it is taken. Read for `level`, which
	 *  scales the weekly progression rate. */
	readonly baseline: Baseline | null;
}

// ------------------------------------------------------------------ day types

/** The day type a weekday runs in the built-in week — its calendar default. */
export function builtInDayType(content: Content, weekday: WeekdayKey): DayTypeId {
	return content.days.find((d) => d.k === weekday)?.id ?? content.days[0].id;
}

/** A day type, by its stable id. Independent of when it is scheduled (ADR-0002). */
export function dayTemplate(content: Content, dayType: DayTypeId): Day {
	return content.days.find((d) => d.id === dayType) ?? content.days[0];
}

/**
 * The day type a slot actually runs: per-slot override → program template →
 * the weekday's built-in default.
 *
 * Called `resolveDayType`, not `main`'s `resolveDayKey`: a "day key" was the
 * exact overload ADR-0002 closed and #55 finished removing, and this function
 * returns a day type.
 */
function resolveDayType(
	content: Content,
	state: ResolverState,
	week: WeekId,
	weekday: WeekdayKey,
): DayTypeId {
	return (
		state.slotDayType[slotKey(week, weekday)] ??
		state.program.template[weekday]?.dayType ??
		builtInDayType(content, weekday)
	);
}

/**
 * The day a slot will actually run, after overrides.
 *
 * A custom focus name replaces the day type's *localized label* and leaves its
 * `id` alone: the name is what the athlete calls this day, the id is what the
 * protocol is. Overwriting the id with the name is the overload ADR-0002 closed.
 */
export function resolveDay(
	content: Content,
	state: ResolverState,
	week: WeekId,
	weekday: WeekdayKey,
): Day {
	const base = dayTemplate(content, resolveDayType(content, state, week, weekday));
	const name = state.program.template[weekday]?.name;
	return name ? { ...base, type: name } : base;
}

/** The exercises a slot runs: per-slot list → template list → the day's own. */
export function resolveExerciseIds(
	content: Content,
	state: ResolverState,
	week: WeekId,
	weekday: WeekdayKey,
): ExerciseId[] {
	return (
		state.slotExercises[slotKey(week, weekday)] ??
		state.program.template[weekday]?.exercises ??
		resolveDay(content, state, week, weekday).ex.map(asExerciseId)
	);
}

// ---------------------------------------------------------- swaps and variants

/**
 * The program's prescription override for an exercise on a weekday, if any.
 *
 * Keyed by `overrideKey(weekday, exercise)` — a weekday and no week, so one
 * override holds across the whole block. Week-addressing it would make overrides
 * per-week, which is a product change rather than a typing one (`ids.ts`).
 */
export function programOverride(
	state: ResolverState,
	weekday: WeekdayKey,
	exercise: ExerciseId,
): Override | undefined {
	return state.program.overrides[overrideKey(weekday, exercise)];
}

/**
 * The variant index the program runs for an exercise on a weekday: the
 * program's own swap, then the library-wide one, then the default.
 *
 * Deliberately blind to per-slot swaps — this is what the Program editor shows,
 * and one slot's swap is not a change to the program.
 */
export function programVariantIndex(
	state: ResolverState,
	weekday: WeekdayKey,
	exercise: ExerciseId,
): number {
	return programOverride(state, weekday, exercise)?.variant ?? state.swaps[exercise] ?? 0;
}

/**
 * The variant index for an exercise in one slot: per-slot swap → the program's
 * swap for that weekday → the library-wide swap → the default.
 *
 * Each step tests for `undefined` rather than falsiness, because index 0 is a
 * real answer: a swap *back* to the default variant is a choice the athlete
 * made, and under `||` it would lose to the weaker swap it was meant to override.
 */
export function resolveSwapIndex(
	state: ResolverState,
	week: WeekId,
	weekday: WeekdayKey,
	exercise: ExerciseId,
): number {
	const perSlot = state.taskSwaps[taskKey(week, weekday, exercise)];
	if (perSlot != null) return perSlot;
	return programVariantIndex(state, weekday, exercise);
}

/**
 * The variant at a swap index, falling back to the default (index 0).
 *
 * The fallback is what makes a stored `LoggedExercise.variant` safe to read back:
 * an index that outlived the variant it pointed at resolves to the exercise's
 * default rather than to nothing. `main` spelled the parameter as a structural
 * `<T extends { variants: Variant[] }>`; `content/types.ts` already names that
 * shape `Exercise`, and the type parameter was used once.
 */
export function variantOf(exercise: Exercise, index: number): Variant {
	return exercise.variants[index] ?? exercise.variants[0];
}

// --------------------------------------------------------------- periodization

/**
 * The phase covering a training week, or null when the program declares none.
 *
 * **Weeks past the declared span hold the last phase.** That rule is invisible in
 * the data — nothing in `Program` says the phases have to add up to `weeks`, and
 * they routinely do not — which is why #55 struck the `CONTEXT.md` sentence
 * claiming a block's length is the sum of its phases. It was a behavioural claim
 * in a glossary, and it was false. This is the behaviour that replaced it.
 *
 * A phase always occupies at least one week, so a zero-week phase neither
 * disappears nor swallows the next phase's first week.
 */
export function phaseForWeek(state: ResolverState, week: WeekId): Phase | null {
	const phases = state.program.phases;
	if (!phases.length) return null;
	const n = weekNumberOf(week);
	let acc = 0;
	for (const phase of phases) {
		acc += Math.max(1, phase.weeks);
		if (n <= acc) return phase;
	}
	return phases[phases.length - 1];
}

// ------------------------------------------------------- trained, and how much

/**
 * The rest placeholder's exercise id.
 *
 * Spelled the same as `REST_DAY_TYPE` and a different thing: that is the day type
 * a slot runs, this is the entry that sits in its exercise list. The overload
 * predates the rebuild and is not this ticket's to close, so it is at least named
 * on both sides.
 *
 * Minted rather than left a bare literal, so it is comparable to the branded ids
 * it is compared against instead of merely assignable to them.
 */
const REST_EXERCISE = asExerciseId('rest');

/**
 * The scheduled, trainable exercises in a slot — what a screen lists, and what
 * every count of scheduled work is taken over.
 *
 * Exported rather than kept private because the two exclusions below are the
 * whole of the answer, and a caller that re-derives them gets one of them wrong:
 * `prototype-fixtures.ts` filtered `id !== 'restSec'` — a set field, not the
 * placeholder — so every rest day resolved as trainable work and was logged as a
 * session (#69).
 *
 * Two exclusions, and both matter. `rest` goes **by id**: it is a real entry in
 * the exercise library — a Recovery pseudo-exercise with its own prose and
 * variants — so a filter that keeps everything the library knows keeps it, and
 * every rest day then counts as scheduled work. And an id the library does not
 * know goes too: the library closed when #12 dropped athlete-authored exercises,
 * so a stored id can outlive its exercise.
 */
export function trainableExerciseIds(
	content: Content,
	state: ResolverState,
	week: WeekId,
	weekday: WeekdayKey,
): ExerciseId[] {
	return resolveExerciseIds(content, state, week, weekday).filter(
		(id) => id !== REST_EXERCISE && content.exercises[id],
	);
}

/**
 * Whether a slot was trained: at least one of its tasks ticked.
 *
 * One tick is enough (ADR-0001, and `CONTEXT.md`'s **Trained**). A slot is
 * trained or it is not — what share of its tasks got done is a different
 * question, and answering this one with a fraction is how adherence starts
 * reporting parts of a day.
 */
export function isSlotTrained(
	content: Content,
	state: ResolverState,
	week: WeekId,
	weekday: WeekdayKey,
): boolean {
	return trainableExerciseIds(content, state, week, weekday).some(
		(id) => state.taskDone[taskKey(week, weekday, id)],
	);
}

/**
 * A training week's completion: how many of its scheduled slots were trained.
 *
 * Counted in **slots**, not tasks — it is the numerator and denominator of
 * adherence, which `CONTEXT.md` defines as the share of a week's scheduled slots
 * that were trained, and which scales how far progression carries into later
 * weeks. A slot with no trainable work is not scheduled and cannot be missed.
 */
export function weekCompletion(
	content: Content,
	state: ResolverState,
	week: WeekId,
): { trained: number; scheduled: number } {
	let scheduled = 0;
	let trained = 0;
	for (const day of content.days) {
		// `Day.k` is calendar position and plain `string` in the content layer; this
		// is the boundary where it becomes an identity.
		const weekday = asWeekdayKey(day.k);
		if (trainableExerciseIds(content, state, week, weekday).length === 0) continue;
		scheduled += 1;
		if (isSlotTrained(content, state, week, weekday)) trained += 1;
	}
	return { trained, scheduled };
}

// ---------------------------------------------------------------- prefills

/**
 * A sensible starting load (kg) for a set: the prescription's midpoint if it has
 * one, else the heaviest load the athlete actually completed the last time they
 * trained this variant, else null.
 *
 * `main` filled the second branch from a **marker** — 0.9 × the athlete's tested
 * max hang for `maxhang`, 0.6 for `recruit`, and so on down a table of seven.
 * `CONTEXT.md` marks Marker *Leaving* and the rebuild does not track tested
 * numbers, so that table had no data source left and the whole branch would have
 * ported as dead code. The athlete's own logged history replaces it: measured
 * rather than tested, and this exercise rather than a fraction of a different one.
 *
 * Three things it is careful about, each of which returns a plausible number when
 * got wrong:
 *
 *   * **Completed sets only.** A prefilled set that was never trained still
 *     carries the load that was prefilled into it, so counting it would let one
 *     prefill seed the next and the number would drift on its own.
 *   * **The variant that was trained**, matched on `LoggedExercise.variant`. A
 *     swapped variant is different work — seeding weighted pull-ups from a
 *     one-arm ladder is worse than seeding nothing. A variant with no completed
 *     history prefills blank, which is honest.
 *   * **The most recent session, not the best ever.** Seeding from a peak would
 *     fight every deload, and the athlete would correct it down for three weeks.
 */
export function prefillLoadKg(
	state: ResolverState,
	exercise: ExerciseId,
	variant: number,
	spec: VariantParams,
): number | null {
	if (spec.loadKg) return Math.round((spec.loadKg.min + spec.loadKg.max) / 2);
	// `sessions` is newest-first, so the first match is the most recent.
	for (const session of state.sessions) {
		const logged = session.exercises.find((e) => e.exercise === exercise && e.variant === variant);
		if (!logged) continue;
		const loads = logged.sets
			.filter((set) => set.done)
			.map((set) => set.loadKg)
			.filter((load): load is number => load != null);
		if (loads.length) return Math.round(Math.max(...loads));
	}
	return null;
}

// ------------------------------------------------------- the prescription itself

/** Scale a range by a percentage, never below `floor`. */
function scaleRange(r: Range, pct: number, floor = 0): Range {
	const f = pct / 100;
	return {
		min: Math.max(floor, Math.round(r.min * f)),
		max: Math.max(floor, Math.round(r.max * f)),
	};
}

const fixedRange = (v: number): Range => ({ min: v, max: v });

/**
 * Weeks of build credit elapsed before `week`, each scaled by that week's
 * adherence — so the load climbs only as far as the athlete actually trained.
 *
 * Returns `1 + the sum of those ratios`, which is what `progressionFactor`
 * expects: with full adherence it equals a plain count of prior non-deload weeks,
 * and in week 1 it is 1, giving an exponent of 0 and no gain at all. Deload weeks
 * are skipped rather than scored, because a week designed to be easy is not a
 * week the athlete missed.
 */
function buildWeeksThrough(content: Content, state: ResolverState, week: WeekId): number {
	let sum = 0;
	for (let w = 1; w < weekNumberOf(week); w++) {
		const id = asWeekId(w);
		if (phaseForWeek(state, id)?.deload) continue;
		const completion = weekCompletion(content, state, id);
		sum += adherenceRatio(completion.trained, completion.scheduled);
	}
	return 1 + sum;
}

/** Whether an exercise is programmed anywhere in a training week (for synergy). */
function programIncludesExercise(
	content: Content,
	state: ResolverState,
	week: WeekId,
	exercise: ExerciseId,
): boolean {
	return content.days.some((day) =>
		resolveExerciseIds(content, state, week, asWeekdayKey(day.k)).includes(exercise),
	);
}

/**
 * The load multiplier (percent) for an exercise in a week.
 *
 * With auto-progression on, a deload week still cuts to its phase's intensity
 * rather than progressing — the whole point of a deload is that it is not a
 * continuation of the ramp. Otherwise the rate compounds over the built weeks,
 * scaled by the athlete's level and doubled where a synergy partner is programmed
 * in the same week (progression.ts). With auto-progression off, the phase's
 * intensity is the only thing that moves the load.
 */
function loadPct(
	content: Content,
	state: ResolverState,
	week: WeekId,
	exercise: ExerciseId,
	phase: Phase | null,
): number {
	if (!state.program.autoProgress) return phase ? phase.intensity : 100;
	if (phase?.deload) return phase.intensity;
	const level: Level = state.baseline?.level ?? 'advanced';
	const partner = SYNERGY[exercise];
	const synergy = partner
		? programIncludesExercise(content, state, week, asExerciseId(partner))
		: false;
	const rate = weeklyRate(exercise, level, synergy);
	return progressionFactor(rate, buildWeeksThrough(content, state, week)) * 100;
}

/**
 * The prescription a slot actually runs — `CONTEXT.md`'s **prescription**: the
 * built-in variant with the program's overrides applied, its load progressed and
 * scaled for the week, and its volume scaled by the phase.
 *
 * The order is not interchangeable. An override sets an *absolute* target, so it
 * collapses a range to a fixed value first; progression and phase scaling then
 * act on whatever that left. Scaling first and overriding second would let a
 * deload week silently discard the number the athlete typed.
 *
 * Returns `base` itself when nothing modifies it, so an untouched prescription
 * costs no allocation on a screen that renders one per task.
 */
export function effectiveVariant(
	content: Content,
	state: ResolverState,
	base: Variant,
	week: WeekId,
	weekday: WeekdayKey,
	exercise: ExerciseId,
): Variant {
	const override = programOverride(state, weekday, exercise);
	const phase = phaseForWeek(state, week);
	if (!override && !phase && !state.program.autoProgress) return base;

	const v: Variant = { ...base };
	if (override) {
		if (override.sets != null) v.sets = fixedRange(override.sets);
		if (override.reps != null) v.reps = fixedRange(override.reps);
		if (override.loadKg != null) v.loadKg = fixedRange(override.loadKg);
		if (override.edgeMm != null) v.edgeMm = fixedRange(override.edgeMm);
		if (override.workSec != null) v.workSec = fixedRange(override.workSec);
		if (override.restSec != null) v.restSec = fixedRange(override.restSec);
		if (override.rpe != null) v.rpe = fixedRange(override.rpe);
	}
	if (v.loadKg) v.loadKg = scaleRange(v.loadKg, loadPct(content, state, week, exercise, phase));
	if (phase) {
		// A floor of 1: a prescription of zero sets is not a lighter week, it is no
		// exercise at all.
		if (v.sets) v.sets = scaleRange(v.sets, phase.volume, 1);
		if (v.rounds) v.rounds = scaleRange(v.rounds, phase.volume, 1);
	}
	return v;
}

// -------------------------------------------------------------- carry-forward

/**
 * What went untrained yesterday, offered as a catch-up today.
 *
 * Returns the *unfinished* subset, which covers both a day that was skipped
 * whole and one that was trained but left work behind — `CONTEXT.md` defines
 * carry-forward as scheduled work that went untrained, "skipped or held", and
 * one mechanism answers both. It reads the same per-task record as
 * `weekCompletion`, so carry-forward and adherence can never disagree about what
 * was trained (ADR-0001).
 *
 * Two changes from `main`. It takes `nowMs` instead of reading the clock, which
 * is what makes it testable at all. And it returns the **weekday key** where
 * `main` returned the day's localized label beside the ids — a display string
 * travelling as data, out of a function whose result then keys a slot (ADR-0003).
 * The label is `weekdayLabel(content, weekday)` at render.
 */
export function missedYesterday(
	content: Content,
	state: ResolverState,
	nowMs: number,
): { weekday: WeekdayKey; exerciseIds: ExerciseId[] } | null {
	// `setDate` rather than subtracting 86_400_000: the arithmetic is calendar
	// days, and a millisecond subtraction lands an hour out across a DST change.
	const yesterday = new Date(nowMs);
	yesterday.setDate(yesterday.getDate() - 1);
	const weekday = weekdayKeyOf(isoDay(yesterday));

	const week = state.currentWeek;
	const scheduled = trainableExerciseIds(content, state, week, weekday);
	if (scheduled.length === 0) return null; // a rest day scheduled nothing to miss

	const done = scheduled.filter((id) => state.taskDone[taskKey(week, weekday, id)]);
	const exerciseIds = pendingExercises(scheduled, done).map(asExerciseId);
	return exerciseIds.length ? { weekday, exerciseIds } : null;
}

/**
 * A slot's exercise list with missed work carried into it: what it already runs,
 * then whatever it does not already run, in the order it was offered.
 *
 * Pure, and so it *returns* the list rather than storing it. On `main` this
 * looped over a mutator that also cleared the override when the result matched
 * the day type's default; deciding whether the new list is worth persisting is
 * the writer's business (#57), and folding it in here is what made every
 * function in `plan.ts` untestable.
 */
export function carryForward(
	content: Content,
	state: ResolverState,
	week: WeekId,
	weekday: WeekdayKey,
	exerciseIds: readonly ExerciseId[],
): ExerciseId[] {
	const current = resolveExerciseIds(content, state, week, weekday);
	const held = new Set<string>(current);
	const out = [...current];
	for (const id of exerciseIds) {
		if (held.has(id)) continue;
		held.add(id);
		out.push(id);
	}
	return out;
}
