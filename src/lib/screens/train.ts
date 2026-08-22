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
	type TaskKey,
	taskKey,
	type WeekdayKey,
	type WeekId,
	weekdayKeyOf,
} from '$lib/ids';
import { fieldsFor, prefilledSet, type SetField } from '$lib/loggedSet';
import {
	effectiveVariant,
	resolveSwapIndex,
	trainableExerciseIds,
	variantOf,
} from '$lib/prescription';
import type { TrainingRecord } from '$lib/store/account';
import type { LoggedSet } from '$lib/types';

/**
 * A **task** — one exercise as it appears in one slot — with its prescription
 * resolved and its sets attached.
 *
 * `screens/today.ts` names the same concept `Task`, and the two are not
 * duplicates: Today lists tasks to tick off, so it needs a label and a tick,
 * while Train is logged *against* one, so it needs the numbers. What
 * distinguishes this one is the resolution, which is why the name says so.
 */
export interface ResolvedTask {
	key: TaskKey;
	exercise: ExerciseId;
	exName: string;
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
}

export interface TrainScreen {
	weekday: WeekdayKey;
	weekdayLabel: string;
	week: WeekId;
	tasks: ResolvedTask[];
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
): ResolvedTask {
	const ex = content.exercises[exercise];
	const variantIndex = resolveSwapIndex(record, week, weekday, exercise);
	const prescription = effectiveVariant(
		content,
		record,
		variantOf(ex, variantIndex),
		week,
		weekday,
		exercise,
	);
	return task(ex, exercise, taskKey(week, weekday, exercise), variantIndex, prescription, {
		sets: (logged ?? []).find((e) => e.exercise === exercise)?.sets,
	});
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
	exercise: ExerciseId,
	key: TaskKey,
): ResolvedTask | null {
	const ex = content.exercises[exercise];
	if (!ex) return null;
	return task(ex, exercise, key, 0, ex.variants[0], {});
}

/** The shape both kinds of task share, once the variant and its numbers are
 *  settled. */
function task(
	ex: Content['exercises'][string],
	exercise: ExerciseId,
	key: TaskKey,
	variantIndex: number,
	prescription: Variant,
	logged: { sets?: LoggedSet[] },
): ResolvedTask {
	return {
		key,
		exercise,
		exName: ex.name,
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
		sets: logged.sets ?? [prefilledSet(prescription)],
		timed: prescription.workSec != null,
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
