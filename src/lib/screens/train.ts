// What Train reads.
//
// One resolved task per scheduled exercise: which variant is running after the
// swap chain, what it is prescribed at after progression and phase scaling, which
// per-set fields it logs, and whatever sets are already recorded against it
// today.
//
// The prescription is **resolved**, not fabricated. `buildTrain` in
// `prototype-fixtures.ts` handed back `ex.variants[0]` and called the variant
// index 0, which is how the resolver being unported went unnoticed across three
// screens: the numbers on the screen looked prescribed and nothing had prescribed
// them (#69). Every number below comes out of `prescription.ts` reading the
// store.
import type { Content, Variant } from '$lib/content/types';
import { isoDayOf } from '$lib/dates';
import { weekdayLabel } from '$lib/format';
import {
	asExerciseId,
	type ExerciseId,
	loadKey,
	type TaskKey,
	taskKey,
	type WeekdayKey,
	type WeekId,
	weekdayKeyOf,
} from '$lib/ids';
import { fieldsFor, midOf, prefilledSet, type SetField } from '$lib/loggedSet';
import {
	effectiveVariant,
	resolveSwapIndex,
	trainableExerciseIds,
	variantOf,
	workingLoadFor,
} from '$lib/prescription';
import type { Task } from '$lib/screens/today';
import type { TrainingRecord } from '$lib/store/record';
import type { LoggedSet, WorkingLoad } from '$lib/types';
import {
	currentBodyweightKg,
	isWeightedExercise,
	type LoadSuggestion,
	loadRange,
	suggestLoad,
} from '$lib/workingLoad';

/**
 * A task with its **prescription** resolved, and the sets logged against it.
 *
 * It extends `Task` rather than restating it: this is the same unit the athlete
 * ticks off on Today, carrying what the logger additionally needs. Two screens,
 * one concept, one declaration of `key`/`exercise`/`exName`/`done`.
 *
 * The adjective is on the right noun. It was `ResolvedTask` for one commit, which
 * put it on the wrong one — it is not the task that gets resolved, it is the
 * prescription (`CONTEXT.md`: "the targets an exercise is to be trained at in a
 * specific slot, after swaps, overrides, weekly progression, and phase scaling
 * are all resolved"). That is the same error `FlagArea` and `RehabArea` made,
 * and it lost for the same reason (#69).
 */
export interface PrescribedTask extends Task {
	cat: string;
	/** CSS custom-property name driving this exercise's accent, e.g. `--violet`.
	 *  It is which family the exercise belongs to, not a hex value. */
	catVar: string;
	variantIndex: number;
	/** Every swappable option, for the variant picker. */
	variants: { name: string; tool?: string; speed?: string }[];
	/** What the athlete is asked to do, after swaps, overrides, weekly progression
	 *  and phase scaling are all applied (`CONTEXT.md`). */
	prescription: Variant;
	/** Which per-set fields this exercise logs, in column order. */
	fields: SetField[];
	sets: LoggedSet[];
	/** Has interval timings the rest timer can run. */
	timed: boolean;
	/**
	 * The load this exercise is actually trained at, at this variant, or `null`
	 * before the athlete has answered for it.
	 *
	 * It is already inside `prescription.loadKg` — `effectiveVariant` reads it as
	 * the base the week's progression scales — so the card does not need this to
	 * render a number. It is carried so the card can say **where the number came
	 * from**, which a range cannot: a load the athlete measured and one they
	 * recalled are not the same evidence (#29).
	 */
	workingLoad: WorkingLoad | null;
	/**
	 * The question to put at first contact, or `null` when there is none to put:
	 * this is not a weighted exercise, or it already has a working load.
	 *
	 * Non-null is exactly "the athlete has never said what to load this with",
	 * which is the condition [#88](https://github.com/YgorPerez/send-lab/issues/88)
	 * asks the screen to notice.
	 */
	ask: LoadSuggestion | null;
}

export interface TrainScreen {
	weekday: WeekdayKey;
	weekdayLabel: string;
	week: WeekId;
	tasks: PrescribedTask[];
	/** Library exercises not in today's slot, for the add-exercise picker. */
	available: { exercise: ExerciseId; name: string; cat: string }[];
	note: string;
	durationMin: number | null;
	/** Nothing is logged today and there is a session behind it, so "repeat last
	 *  session" has something to repeat. */
	canRepeatLast: boolean;
}

/** Everything Train reads, resolved against the record. */
export function resolveTrain(content: Content, record: TrainingRecord, now: number): TrainScreen {
	const at = isoDayOf(now);
	const weekday = weekdayKeyOf(at);
	const week = record.currentWeek;
	const scheduled = trainableExerciseIds(content, record, week, weekday);
	const session = record.sessions.find((s) => s.at === at);

	const tasks = scheduled.map((exercise) =>
		scheduledTask(content, record, week, weekday, exercise, session?.exercises),
	);

	return {
		weekday,
		weekdayLabel: weekdayLabel(content, weekday),
		week,
		tasks,
		available: availableFrom(content, scheduled),
		note: session?.note ?? '',
		durationMin: session?.durationMin ?? null,
		canRepeatLast: !session && record.sessions.length > 0,
	};
}

/** A task the program scheduled: the resolver decides the variant and the
 *  numbers, and today's session supplies whatever is already logged against it. */
function scheduledTask(
	content: Content,
	record: TrainingRecord,
	week: WeekId,
	weekday: WeekdayKey,
	exercise: ExerciseId,
	logged: TrainingRecord['sessions'][number]['exercises'] | undefined,
): PrescribedTask {
	const ex = content.exercises[exercise];
	const variantIndex = resolveSwapIndex(record, week, weekday, exercise);
	const prescription = effectiveVariant(
		content,
		record,
		variantOf(ex, variantIndex),
		variantIndex,
		week,
		weekday,
		exercise,
	);
	const sets = (logged ?? []).find((e) => e.exercise === exercise)?.sets;
	return task(ex, exercise, taskKey(week, weekday, exercise), variantIndex, prescription, {
		sets,
		// A task is trained once one of its sets is (ADR-0001, **Trained**).
		done: sets?.some((set) => set.done) ?? false,
		workingLoad: workingLoadFor(record, exercise, variantIndex) ?? null,
		ask: loadAsk(record, exercise, variantIndex, prescription),
	});
}

/**
 * The question to put at first contact with a weighted exercise, or `null`.
 *
 * Exported because Train has to re-ask it twice more than the resolver runs:
 * when the athlete **swaps the variant** mid-session — a different variant is a
 * different working load, and the old one's answer does not carry over — and
 * when they **answer it**, which is what makes the question go away without a
 * reload.
 *
 * The level falls back to `intermediate` and **not** to `loadPct`'s `advanced`.
 * That fallback scales a percentage and this one puts weight on a finger, so the
 * two absences are not worth the same guess: an account with no baseline gets
 * the lightest rung of a ladder it is about to be shown anyway.
 */
export function loadAsk(
	record: TrainingRecord,
	exercise: ExerciseId,
	variantIndex: number,
	prescription: Variant | undefined,
): LoadSuggestion | null {
	if (!isWeightedExercise(exercise)) return null;
	if (record.workingLoads[loadKey(exercise, variantIndex)]) return null;
	return suggestLoad(
		exercise,
		record.baseline?.level ?? 'intermediate',
		prescription,
		currentBodyweightKg(record.bodyweight, record.baseline),
	);
}

/**
 * A task for an exercise the athlete adds mid-session.
 *
 * It arrives at the variant's built-in targets rather than at a resolved
 * prescription, and that is the honest answer rather than a shortcut: nothing
 * scheduled it, so there is no slot for the resolver to apply an override or a
 * week's progression against. Off-script work still counts toward training
 * (`CONTEXT.md`, **Trained**).
 *
 * Here rather than in the route because it is the same decision `scheduledTask`
 * makes — what a task starts out as — and the two were drifting apart the moment
 * they were written twice.
 */
export function libraryTask(
	content: Content,
	record: TrainingRecord,
	exercise: ExerciseId,
	key: TaskKey,
): PrescribedTask | null {
	const ex = content.exercises[exercise];
	if (!ex) return null;
	// The working load *does* carry over, unlike everything else here. It is keyed
	// exercise and variant and carries no slot at all (ADR 0020), so an athlete
	// who adds a max hang off-script is loading the same fingers on the same edge
	// as the one their program schedules — and being asked again would be the app
	// forgetting an answer it holds.
	const base = ex.variants[0];
	return task(ex, exercise, key, 0, loadedVariant(record, exercise, 0, base), {
		workingLoad: workingLoadFor(record, exercise, 0) ?? null,
		ask: loadAsk(record, exercise, 0, base),
	});
}

/**
 * A built-in variant with the athlete's working load laid over its `loadKg`.
 *
 * The same substitution `effectiveVariant` makes, without the slot: a task that
 * nothing scheduled has no weekday for an override or a week for a progression
 * to apply against, but it is still the same exercise on the same edge, and the
 * working load is keyed on neither of those.
 */
function loadedVariant(
	record: TrainingRecord,
	exercise: ExerciseId,
	variantIndex: number,
	base: Variant,
): Variant {
	const load = workingLoadFor(record, exercise, variantIndex);
	return load ? { ...base, loadKg: loadRange(load) } : base;
}

/**
 * The task as it reads once a working load is known for it: the number in the
 * prescription, the provenance beside it, and no question left to ask.
 *
 * Exported so the screen can apply the athlete's answer to the card at the tap,
 * rather than waiting for the write to land and the record to come back round.
 * Both paths therefore agree by construction: the substitution itself is
 * `loadRange`, which `effectiveVariant` and `loadedVariant` also go through.
 */
export function withWorkingLoad(task: PrescribedTask, load: WorkingLoad): PrescribedTask {
	return {
		...task,
		prescription: { ...task.prescription, loadKg: loadRange(load) },
		// **The sets on screen take it too, and this is the point of asking here.**
		// Without it the athlete answers "+20kg" standing at the hangboard and the
		// load column of the set they are about to log keeps whatever it opened
		// with until *next* session — which would make first contact a form that
		// files paperwork.
		//
		// Two rows are left alone, and the second is the one that is easy to miss.
		// A **completed** set is history. And a set the athlete has typed their own
		// number into is their answer for that set — but "has a number in it" is
		// not the test, because `prefilledSet` opens every row at the
		// prescription's own midpoint. On `pull`, the one variant in the library
		// carrying a built-in `loadKg`, that midpoint is 38kg, so a naive
		// not-null check would leave the athlete looking at the library's number
		// one second after telling the app they load it with 20.
		sets: task.sets.map((set) =>
			set.done || (set.loadKg != null && set.loadKg !== midOf(task.prescription.loadKg))
				? set
				: { ...set, loadKg: load.addedKg },
		),
		workingLoad: load,
		ask: null,
	};
}

/**
 * The same task at a different variant — what a mid-session swap produces.
 *
 * Here rather than in the route for `libraryTask`'s reason: what a task *is* at
 * a given variant is one decision, and the route was making three-quarters of it
 * inline. It carries the athlete's logged sets across untouched, because swapping
 * the variant does not un-train the sets already done.
 *
 * It arrives at the **built-in** variant plus the working load, not at a
 * re-resolved prescription. That is the behaviour the route already had, and it
 * is deliberate rather than incidental: the swap is not written to the store, so
 * `effectiveVariant` would resolve the override and the progression of the
 * variant the athlete just swapped *away* from.
 */
export function atVariant(
	content: Content,
	record: TrainingRecord,
	task: PrescribedTask,
	variantIndex: number,
): PrescribedTask {
	const ex = content.exercises[task.exercise];
	const base = ex?.variants[variantIndex] ?? task.prescription;
	const prescription = loadedVariant(record, task.exercise, variantIndex, base);
	return {
		...task,
		variantIndex,
		prescription,
		fields: fieldsFor(prescription),
		timed: prescription.workSec != null,
		workingLoad: workingLoadFor(record, task.exercise, variantIndex) ?? null,
		ask: loadAsk(record, task.exercise, variantIndex, base),
	};
}

/** The shape both kinds of task share, once the variant and its numbers are
 *  settled. */
function task(
	ex: Content['exercises'][string],
	exercise: ExerciseId,
	key: TaskKey,
	variantIndex: number,
	prescription: Variant,
	logged: {
		sets?: LoggedSet[];
		done?: boolean;
		workingLoad?: WorkingLoad | null;
		ask?: LoadSuggestion | null;
	},
): PrescribedTask {
	return {
		key,
		exercise,
		exName: ex.name,
		done: logged.done ?? false,
		cat: ex.cat,
		catVar: ex.catVar,
		variantIndex,
		variants: ex.variants.map((v) => ({
			name: v.name,
			...(v.tool ? { tool: v.tool } : {}),
			...(v.speed ? { speed: v.speed } : {}),
		})),
		prescription,
		fields: fieldsFor(prescription),
		// `prefilledSet` reads `prescription.loadKg`, which `effectiveVariant` has
		// already filled from the working load and scaled for the week — so the
		// next session's load comes off the athlete's own answer rather than off
		// `midOf` of a range six of the seven weighted exercises do not have
		// (#88).
		sets: logged.sets ?? [prefilledSet(prescription)],
		timed: prescription.workSec != null,
		workingLoad: logged.workingLoad ?? null,
		ask: logged.ask ?? null,
	};
}

/**
 * The library minus what is already on the screen.
 *
 * One of the two places an `ExerciseId` is minted, and the warrant is that these
 * keys come out of the exercise library itself. `rest` is excluded by id: it is a
 * real entry in the library with its own prose and variants, so a filter that
 * keeps everything the library knows offers the athlete "Rest" as an exercise to
 * add (#69).
 */
function availableFrom(content: Content, scheduled: readonly ExerciseId[]) {
	const REST = asExerciseId('rest');
	const already = new Set<string>(scheduled);
	return Object.entries(content.exercises)
		.map(([id, ex]) => ({ exercise: asExerciseId(id), name: ex.name, cat: ex.cat }))
		.filter((e) => e.exercise !== REST && !already.has(e.exercise));
}
