// The read half of the store: collections in, one training record out.
//
// **Training record** is a `CONTEXT.md` term: everything one athlete's account
// holds. An account is the identity that owns it; this is the thing owned, which
// is why the store below is a `RecordStore` and not an account one. The collections below it are fifteen keyed row sets
// (ADR 0007); every screen and every domain module above it wants maps and
// arrays. This module is the one place that turns one into the other, so nothing
// upstream has to know that `taskDone` is rows rather than an object.
//
// IT SATISFIES `ResolverState`
// ---------------------------
// `TrainingRecord` extends the interface `prescription.ts` declared for itself
// (#69), which is why the resolver can be handed a live store without knowing
// anything about TanStack DB. That was the whole point of naming the interface
// there: the resolver depends on a shape, and this is the first thing to
// implement it. `getPrototypeFixtures().resolverState` was the hand-built stand-in
// and is gone.
//
// PURE FIRST, HOOK SECOND
// -----------------------
// `readTrainingRecord(store)` is a plain function of a store, and
// `useTrainingRecord()` is a thin wrapper that makes each collection live. The
// split is the same one `prescription.ts` made for the same reason: everything
// worth testing is testable without rendering.
import { useLiveQuery } from '@tanstack/react-db';
import { useMemo } from 'react';
import { getContent } from '$lib/content';
import type { DayTypeId } from '$lib/content/types';
import { asWeekId, type ExerciseId, type SlotKey, type TaskKey } from '$lib/ids';
import { getLocale } from '$lib/paraglide/runtime';
import type { ResolverState } from '$lib/prescription';
import type {
	BodyweightReading,
	LoggedReadinessCheck,
	Program,
	Rehab,
	SavedProgram,
	SelfCheck,
	Session,
} from '$lib/types';
import {
	type BaselineRow,
	type CurrentWeekRow,
	createRecordStore,
	type DayExercisesRow,
	type DayPlanRow,
	type DaySwapRow,
	type PrefsRow,
	type ProgramRow,
	type RecordStore,
	type RehabRow,
	type SwapRow,
	type TaskDoneRow,
} from './collections';
import { seedRecordStore } from './seed';

/** Display units, notification opt-in and the athlete's language, without the
 *  key the singleton row is filed under. */
export type Prefs = Omit<PrefsRow, 'id'>;

/**
 * Everything one account's training record holds, assembled from the collections.
 *
 * Extends `ResolverState` rather than restating it: the resolver's slice is
 * exactly the plan-and-history half, and a second declaration of those nine
 * fields would be a second thing to keep in step.
 */
export interface TrainingRecord extends ResolverState {
	readonly readinessLog: readonly LoggedReadinessCheck[];
	readonly selfCheckLog: readonly SelfCheck[];
	readonly bodyweight: readonly BodyweightReading[];
	readonly savedPrograms: readonly SavedProgram[];
	readonly rehab: Rehab | null;
	readonly prefs: Prefs;
}

/** The program an account runs before it has one of its own. Deliberately not
 *  imported from `server/programOps.defaultProgram()`: that is the server's copy
 *  of this value and the two meet at `/api/state` (#57), not through the client
 *  reaching across the boundary for it. */
const NO_PROGRAM: Program = { weeks: 8, template: {}, targets: {}, phases: [], autoProgress: true };

/** Preferences before the athlete has set any. `locale: null` means follow the
 *  device — its resolution order is #57's. */
const NO_PREFS: Prefs = { weight: 'kg', length: 'mm', notify: false, locale: null };

/** The first training week, for an account that has not started a block. */
const FIRST_WEEK = asWeekId(1);

/** Rows to the sparse record `ResolverState` asks for. The result is `Partial`,
 *  so a key with no row reads as `undefined` at the type level rather than by
 *  convention. */
function byKey<Row, K extends string, V>(
	rows: readonly Row[],
	key: (row: Row) => K,
	value: (row: Row) => V,
): Readonly<Partial<Record<K, V>>> {
	const out: Partial<Record<K, V>> = {};
	for (const row of rows) out[key(row)] = value(row);
	return out;
}

/**
 * The training record a store currently holds.
 *
 * Ordering is decided here rather than left to the collections: rows come out in
 * insertion order and every reader of `sessions` — the streak, the workload
 * ratio, the log screen — wants them newest first, so sorting once here is
 * cheaper and safer than five callers each remembering to.
 */
export function readTrainingRecord(store: RecordStore): TrainingRecord {
	return assemble({
		currentWeek: store.currentWeek.toArray,
		program: store.program.toArray,
		baseline: store.baseline.toArray,
		rehab: store.rehab.toArray,
		prefs: store.prefs.toArray,
		swaps: store.swaps.toArray,
		dayPlan: store.dayPlan.toArray,
		dayExercises: store.dayExercises.toArray,
		daySwaps: store.daySwaps.toArray,
		taskDone: store.taskDone.toArray,
		sessions: store.sessions.toArray,
		readinessLog: store.readinessLog.toArray,
		selfCheckLog: store.selfCheckLog.toArray,
		bodyweight: store.bodyweight.toArray,
		savedPrograms: store.savedPrograms.toArray,
	});
}

/** Every collection's rows, as the hook and the pure reader both have them.
 *
 *  Spelled out rather than derived from `RecordStore`: a collection's own row
 *  type carries the library's virtual `$key`/`$synced` props, and naming those
 *  here would make this module's shape a function of an internal detail of a
 *  pre-1.0 dependency. Both callers hand over something assignable to plain
 *  rows, which is all this needs. */
interface Rows {
	currentWeek: readonly CurrentWeekRow[];
	program: readonly ProgramRow[];
	baseline: readonly BaselineRow[];
	rehab: readonly RehabRow[];
	prefs: readonly PrefsRow[];
	swaps: readonly SwapRow[];
	dayPlan: readonly DayPlanRow[];
	dayExercises: readonly DayExercisesRow[];
	daySwaps: readonly DaySwapRow[];
	taskDone: readonly TaskDoneRow[];
	sessions: readonly Session[];
	readinessLog: readonly LoggedReadinessCheck[];
	selfCheckLog: readonly SelfCheck[];
	bodyweight: readonly BodyweightReading[];
	savedPrograms: readonly SavedProgram[];
}

function assemble(rows: Rows): TrainingRecord {
	return {
		currentWeek: rows.currentWeek[0]?.week ?? FIRST_WEEK,
		program: rows.program[0]?.program ?? NO_PROGRAM,
		baseline: rows.baseline[0]?.baseline ?? null,
		rehab: rows.rehab[0]?.rehab ?? null,
		prefs: rows.prefs[0] ?? NO_PREFS,
		swaps: byKey<SwapRow, ExerciseId, number>(
			rows.swaps,
			(r) => r.exercise,
			(r) => r.variant,
		),
		dayPlan: byKey<DayPlanRow, SlotKey, DayTypeId>(
			rows.dayPlan,
			(r) => r.slot,
			(r) => r.dayType,
		),
		dayExercises: byKey<DayExercisesRow, SlotKey, ExerciseId[]>(
			rows.dayExercises,
			(r) => r.slot,
			(r) => r.exercises,
		),
		daySwaps: byKey<DaySwapRow, TaskKey, number>(
			rows.daySwaps,
			(r) => r.task,
			(r) => r.variant,
		),
		taskDone: byKey<TaskDoneRow, TaskKey, boolean>(
			rows.taskDone,
			(r) => r.task,
			(r) => r.done,
		),
		// Newest first. `at` is an ISO calendar date, so a string sort is a date
		// sort — which is one of the reasons ADR-0003 keeps display strings out of
		// identities.
		sessions: [...rows.sessions].sort((a, b) => b.at.localeCompare(a.at)),
		// Oldest first: the trend chart, the personal baseline and the calibration
		// all read this as a series running forward in time.
		readinessLog: [...rows.readinessLog].sort((a, b) => a.at - b.at),
		// Newest first — Today shows the last one.
		selfCheckLog: [...rows.selfCheckLog].sort((a, b) => b.at - a.at),
		bodyweight: [...rows.bodyweight].sort((a, b) => a.at - b.at),
		savedPrograms: rows.savedPrograms,
	};
}

// --------------------------------------------------------------- the singleton

let store: RecordStore | null = null;

/**
 * The one store this browser tab reads.
 *
 * Built on first use rather than at module scope: on the server there is no
 * `localStorage` and the collections fall back to an in-memory store, and there
 * is nothing to gain from constructing fifteen of them while rendering a shell
 * that reads none of them (ADR 0006 — the shell is the only thing prerendered,
 * and it must stay account-independent).
 *
 * Seeding happens here, once, because "the collections are never all empty" is an
 * invariant of the store rather than of any screen. #57 replaces the seed with
 * the server's answer and this function does not change.
 *
 * **The account boundary is not here yet.** One store, no `AthleteId`: what keeps
 * two athletes' records apart on a shared device is #57's, and it is the reason
 * the storage keys are namespaced rather than bare.
 */
export function recordStore(): RecordStore {
	if (!store) {
		store = createRecordStore();
		const locale = getLocale();
		seedRecordStore(store, getContent(locale), locale, Date.now());
	}
	return store;
}

/** Drop the store, so the next reader builds and re-seeds a fresh one. For tests
 *  and for #57's sign-out. */
export function resetRecordStore(): void {
	store = null;
}

/**
 * The training record, live.
 *
 * Fifteen subscriptions rather than one: each collection notifies on its own, so
 * ticking a task re-renders without the sessions, the readiness log or the
 * bodyweight series being re-read. That granularity is the thing ADR 0007 bought.
 */
export function useTrainingRecord(): TrainingRecord {
	const s = recordStore();
	const currentWeek = useLiveQuery(() => s.currentWeek).data;
	const program = useLiveQuery(() => s.program).data;
	const baseline = useLiveQuery(() => s.baseline).data;
	const rehab = useLiveQuery(() => s.rehab).data;
	const prefs = useLiveQuery(() => s.prefs).data;
	const swaps = useLiveQuery(() => s.swaps).data;
	const dayPlan = useLiveQuery(() => s.dayPlan).data;
	const dayExercises = useLiveQuery(() => s.dayExercises).data;
	const daySwaps = useLiveQuery(() => s.daySwaps).data;
	const taskDone = useLiveQuery(() => s.taskDone).data;
	const sessions = useLiveQuery(() => s.sessions).data;
	const readinessLog = useLiveQuery(() => s.readinessLog).data;
	const selfCheckLog = useLiveQuery(() => s.selfCheckLog).data;
	const bodyweight = useLiveQuery(() => s.bodyweight).data;
	const savedPrograms = useLiveQuery(() => s.savedPrograms).data;

	return useMemo(
		() =>
			assemble({
				currentWeek: currentWeek ?? [],
				program: program ?? [],
				baseline: baseline ?? [],
				rehab: rehab ?? [],
				prefs: prefs ?? [],
				swaps: swaps ?? [],
				dayPlan: dayPlan ?? [],
				dayExercises: dayExercises ?? [],
				daySwaps: daySwaps ?? [],
				taskDone: taskDone ?? [],
				sessions: sessions ?? [],
				readinessLog: readinessLog ?? [],
				selfCheckLog: selfCheckLog ?? [],
				bodyweight: bodyweight ?? [],
				savedPrograms: savedPrograms ?? [],
			}),
		[
			currentWeek,
			program,
			baseline,
			rehab,
			prefs,
			swaps,
			dayPlan,
			dayExercises,
			daySwaps,
			taskDone,
			sessions,
			readinessLog,
			selfCheckLog,
			bodyweight,
			savedPrograms,
		],
	);
}
