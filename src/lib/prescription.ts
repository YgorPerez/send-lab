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
// wrote is `slotDayType`, renamed by #72 under ADR 0014. `main`'s `resolveDay` is
// live below under a truer name — ADR 0014's audit list carried it for three
// tickets, and the 2026-09-08 pass took it once ADR 0016 had split `Day` into
// `DayType` and `BuiltInWeekday` and left the old name plainly rather than
// ambiguously wrong.
//
// **The pair below changed meaning, not just spelling.** `resolveDayType` used to
// be the function that returns an **id**; that one is now `resolveDayTypeId`, and
// the name it vacated belongs to the one returning the **day type**. A diff across
// that commit reads as a no-op and is not, so the compiler is the thing to trust:
// the two return `DayTypeId` and `DayType`, which do not substitute.
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
// which is why `carryForwardFromYesterday` hands back a `WeekdayKey` and not a label.
import type { Content, DayType, DayTypeId, Exercise, Range, Variant } from '$lib/content/types';
import { isoDay } from '$lib/dates';
import {
	asExerciseId,
	asWeekdayKey,
	asWeekId,
	type ExerciseId,
	type LoadKey,
	loadKey,
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
import type { Baseline, Level, Override, Phase, Program, Session, WorkingLoad } from '$lib/types';
import { loadRange } from '$lib/workingLoad';

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
	/** The baseline, or null before an intake is taken. Read for `level`, which
	 *  scales the weekly progression rate. */
	readonly baseline: Baseline | null;
	/**
	 * The load each weighted exercise is actually trained at, keyed exercise
	 * **and variant** (`maxhang@0`) — `CONTEXT.md`'s **working load**.
	 *
	 * A sixteenth collection and not `program.overrides`, for ADR 0020's three
	 * reasons. `effectiveVariant` reads it as the load the exercise runs at —
	 * which is what finally gives `progression.ts`'s study-backed weekly rates
	 * something to multiply on the six weighted exercises that prescribe no load
	 * of their own. It does not multiply it *yet*: the glossary scales a working
	 * load only once it has **settled**, and settling is #91's.
	 */
	readonly workingLoads: Readonly<Partial<Record<LoadKey, WorkingLoad>>>;
}

// ------------------------------------------------------------------ day types

/** The day type a weekday runs in the built-in week — its calendar default. */
export function builtInDayType(content: Content, weekday: WeekdayKey): DayTypeId {
	return (
		content.builtInWeek.find((d) => d.k === weekday)?.dayType ?? content.builtInWeek[0].dayType
	);
}

/** A day type, by its stable id. Independent of when it is scheduled (ADR-0002). */
export function dayTemplate(content: Content, dayType: DayTypeId): DayType {
	return content.dayTypes.find((d) => d.id === dayType) ?? content.dayTypes[0];
}

/**
 * The **id** of the day type a slot actually runs: per-slot override → program
 * template → the weekday's built-in default.
 *
 * Not `main`'s `resolveDayKey`: a "day key" was the exact overload ADR-0002 closed
 * and #55 finished removing. The `Id` suffix is the second half of the same
 * distinction — this returns the identity, `resolveDayType` below returns the day
 * type, and ADR-0003 is the reason those are two different things rather than one
 * with two shapes.
 *
 * Exported since ADR 0017: a session records the day type it actually ran, and
 * stamping that at the moment it is logged is this question asked once, rather
 * than re-asked of the current program every time the history is rendered.
 */
export function resolveDayTypeId(
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
 * The day type a slot will actually run, after overrides.
 *
 * Named for what it returns. It was `resolveDay`, which said *day* for a **day
 * type** — a weekday says when and a day type says what (ADR 0016), and *day* is
 * on both terms' `_Avoid_` lists in `CONTEXT.md`.
 *
 * A custom focus name replaces the day type's *localized label* and leaves its
 * `id` alone: the name is what the athlete calls this day, the id is what the
 * protocol is. Overwriting the id with the name is the overload ADR-0002 closed.
 */
export function resolveDayType(
	content: Content,
	state: ResolverState,
	week: WeekId,
	weekday: WeekdayKey,
): DayType {
	const base = dayTemplate(content, resolveDayTypeId(content, state, week, weekday));
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
		resolveDayType(content, state, week, weekday).ex.map(asExerciseId)
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
	for (const day of content.builtInWeek) {
		// `BuiltInWeekday.k` is calendar position and plain `string` in the content
		// layer; this is the boundary where it becomes an identity.
		const weekday = asWeekdayKey(day.k);
		if (trainableExerciseIds(content, state, week, weekday).length === 0) continue;
		scheduled += 1;
		if (isSlotTrained(content, state, week, weekday)) trained += 1;
	}
	return { trained, scheduled };
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
	return content.builtInWeek.some((day) =>
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
 * The working load an exercise runs at a variant, or `undefined` before the
 * athlete has answered for it.
 *
 * **No week and no weekday**, which is the whole of ADR 0020 in a signature: a
 * working load is a property of the exercise and the variant and of nothing
 * else, so the same exercise scheduled Wednesday and Saturday is one answer
 * rather than two that can disagree.
 *
 * The variant index is an argument rather than re-resolved from the state,
 * because the two differ exactly when it matters: Train lets the athlete swap a
 * variant mid-session without writing the swap, and re-resolving here would hand
 * that task the *stored* variant's load — 30kg of weighted pull-ups on a one-arm
 * ladder.
 */
export function workingLoadFor(
	state: ResolverState,
	exercise: ExerciseId,
	variantIndex: number,
): WorkingLoad | undefined {
	return state.workingLoads[loadKey(exercise, variantIndex)];
}

/**
 * The prescription a slot actually runs — `CONTEXT.md`'s **prescription**: the
 * built-in variant with the program's overrides applied, its load progressed and
 * scaled for the week, and its volume scaled by the phase.
 *
 * The order is not interchangeable. The **working load** replaces the variant's
 * built-in `loadKg` — it is the load this exercise is actually trained at, which
 * is a stronger statement than the library's suggestion. An override then sets
 * an *absolute* target over the top, collapsing a range to a fixed value.
 * Progression and phase scaling act last, on whatever that left, because scaling
 * first would let a deload week silently discard the number the athlete typed —
 * and load scaling is skipped entirely where a working load supplied the number,
 * for the reason spelled out at that line.
 *
 * The override still wins over the working load, and that is legacy rather than
 * a live conflict: **no override in the rebuild has ever carried a `loadKg`**
 * (#87 deleted the only thing that seeded one), and ADR 0020 forbids #65's
 * override editor from growing a load field. If one is ever found in a stored
 * program it was put there deliberately, so it stands.
 *
 * `variantIndex` travels beside `base` because `base` is `variantOf(ex, index)`
 * and the working load is keyed on the index. Re-deriving it from the state here
 * would be wrong exactly where it matters: Train lets a variant be swapped
 * mid-session without writing the swap, and the stored index is then not the one
 * on screen.
 *
 * Returns `base` itself when nothing modifies it, so an untouched prescription
 * costs no allocation on a screen that renders one per task.
 */
export function effectiveVariant(
	content: Content,
	state: ResolverState,
	base: Variant,
	variantIndex: number,
	week: WeekId,
	weekday: WeekdayKey,
	exercise: ExerciseId,
): Variant {
	const override = programOverride(state, weekday, exercise);
	const phase = phaseForWeek(state, week);
	const working = workingLoadFor(state, exercise, variantIndex);
	if (!override && !phase && !working && !state.program.autoProgress) return base;

	const v: Variant = { ...base };
	// Before the override, so an override that carries a load still wins over it.
	if (working) v.loadKg = loadRange(working);
	if (override) {
		if (override.sets != null) v.sets = fixedRange(override.sets);
		if (override.reps != null) v.reps = fixedRange(override.reps);
		if (override.loadKg != null) v.loadKg = fixedRange(override.loadKg);
		if (override.edgeMm != null) v.edgeMm = fixedRange(override.edgeMm);
		if (override.workSec != null) v.workSec = fixedRange(override.workSec);
		if (override.restSec != null) v.restSec = fixedRange(override.restSec);
		if (override.rpe != null) v.rpe = fixedRange(override.rpe);
	}
	// Progression moves the library's number and leaves the athlete's alone.
	//
	// `CONTEXT.md` is explicit that a working load is *settling* until two
	// consecutive on-target sessions agree, "after which progression scales it" —
	// and settling is [#91](https://github.com/YgorPerez/send-lab/issues/91)'s to
	// build, so every working load stored today is unsettled by definition. What
	// that buys immediately is the thing first contact needs: an athlete who says
	// 40kg in week 5 is prescribed 40kg, not 40 compounded by four weeks they
	// trained this exercise without a load at all.
	if (v.loadKg && !working) {
		v.loadKg = scaleRange(v.loadKg, loadPct(content, state, week, exercise, phase));
	}
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
export function carryForwardFromYesterday(
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
