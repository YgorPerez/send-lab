// The account document, as collections.
//
// ADR 0007 is the decision this file implements: one JSON document per account
// becomes typed keyed row sets, because the granularity the athlete's offline
// writes have to merge at is the row, and the document shape is what stood in
// the way. TanStack DB settles the shape by construction — `getKey` is required
// on every collection type and there is no document primitive — so the split is
// not a style choice made here, it is the substrate's only spelling.
//
// LEVEL 2, NOT LEVEL 3
// --------------------
// `localStorageCollectionOptions`, not SQLite-in-WebAssembly. The account state
// is roughly 28 KB and the WASM path downloads 500–775 KB gzipped to hold it, on
// an app whose mobile-first requirement is explicit — and it is where both of the
// library's own data-loss defects sit. The `localStorage` path is a separate code
// path with no failing tests of its own. ADR 0007 has the measurements.
//
// ONE COLLECTION PER SURVIVING FIELD
// ----------------------------------
// `server/stateOps.ts`'s `defaultState()` is the inventory of what survived the
// keep/drop audit, and every field of it is a collection below. Two departures,
// both deliberate:
//
//   * **`log` is not here.** #12 dropped it — two of its three kinds died with
//     `metrics[]`, `'rec'` was written nowhere, and the survivor was a drifting
//     copy of `taskDone`. `lib/types.ts` already deleted `LogEntry`;
//     `defaultState()` is the stale half and #57 owns removing it.
//   * **`workouts` is `sessions` and `assessment` is `baseline`.** Both old names
//     are on the glossary's _Avoid_ list for the thing they hold, and these keys
//     are new storage rather than a migration of the SvelteKit document — there
//     is nothing to carry across (#11, *Out of scope*). #57 renames the same two
//     keys server-side when it mounts `sanitizeState`.
//
// SINGLETONS ARE STILL COLLECTIONS
// --------------------------------
// Five fields are genuinely one value — the training week, the active program,
// the baseline, the rehab block, the preferences — and each is a collection
// holding at most one row under a fixed key. That is *not* the arrangement
// ADR 0007 rejected: what it rejected was collapsing the **whole document** into
// one row, which leaves the engine inert over everything and preserves
// whole-document last-write-wins. Here `taskDone`, `sessions` and the rest are
// row-per-thing, which is where the merging has to happen; a program is one
// program however it is stored.
//
// A nullable singleton is spelled as an **absent row**, not as a row holding
// `null`: no baseline is no baseline, and a row saying so would be one more state
// to get wrong.
//
// NOTHING HERE WRITES TO A SERVER
// -------------------------------
// There are no `onInsert`/`onUpdate`/`onDelete` handlers, so a mutation persists
// to `localStorage` and stops. That is the whole of #56 — the read half. ADR 0008
// is explicit that `@tanstack/offline-transactions` is what makes a write safe,
// and it is deliberately not installed yet: the queue, the sync handlers and the
// per-key `/api/state` path all land together in #57.
import { createCollection, localStorageCollectionOptions, type StorageApi } from '@tanstack/db';
import type { DayTypeId } from '$lib/content/types';
import type { ExerciseId, SlotKey, TaskKey, WeekId } from '$lib/ids';
import type {
	Baseline,
	BodyweightReading,
	LoggedReadinessCheck,
	Program,
	Rehab,
	SavedProgram,
	SelfCheck,
	Session,
} from '$lib/types';

/** Namespaced the way `readinessDraft.ts` namespaces its own key. One key per
 *  collection: the document is split in storage, not only in memory. */
const PREFIX = 'sendlab:';

/** The key every singleton row is filed under. Its value is never read — the
 *  collection holds one row or none, and which one it is is not a question. */
const ONLY = 'only';

// ------------------------------------------------------------------- row shapes
//
// The sparse records of `ResolverState` are maps in the document and row sets
// here. Each row names its key after what the key *is*, so a `TaskKey` column is
// never mistaken for an `ExerciseId` one.

/** Library-wide variant choice for an exercise — the weakest swap. */
export interface SwapRow {
	exercise: ExerciseId;
	variant: number;
}

/** Per-slot day type, overriding the weekday template for that slot alone. */
export interface DayPlanRow {
	slot: SlotKey;
	dayType: DayTypeId;
}

/** Per-slot exercise list, overriding the day type's defaults for that slot. */
export interface DayExercisesRow {
	slot: SlotKey;
	exercises: ExerciseId[];
}

/** Per-task variant choice — the strongest swap. */
export interface DaySwapRow {
	task: TaskKey;
	variant: number;
}

/** One tick. ADR-0001 makes this the record that says whether a slot was
 *  trained, and it is the collection ADR 0007 was written for: two devices
 *  ticking two different tasks stop colliding because the write got smaller. */
export interface TaskDoneRow {
	task: TaskKey;
	done: boolean;
}

/** The training week the athlete is on. */
export interface CurrentWeekRow {
	id: typeof ONLY;
	week: WeekId;
}

export interface ProgramRow {
	id: typeof ONLY;
	program: Program;
}

export interface BaselineRow {
	id: typeof ONLY;
	baseline: Baseline;
}

export interface RehabRow {
	id: typeof ONLY;
	rehab: Rehab;
}

/** Display units, notification opt-in, and the athlete's language.
 *
 *  `locale` is account data rather than a cookie (ADR 0006): `/mcp` authenticates
 *  by bearer token and never reads cookies, so localized MCP output cannot come
 *  from anything the browser sets, and this is what carries the choice to a
 *  second device. Null means follow the device. **Its resolution order is #57's**
 *  — this ticket only gives it somewhere to live. */
export interface PrefsRow {
	id: typeof ONLY;
	weight: 'kg' | 'lb';
	length: 'mm' | 'in';
	notify: boolean;
	locale: string | null;
}

// ------------------------------------------------------------------ the store

/** Every collection the account is held in. */
export interface AccountStore {
	readonly currentWeek: ReturnType<typeof currentWeekCollection>;
	readonly program: ReturnType<typeof programCollection>;
	readonly baseline: ReturnType<typeof baselineCollection>;
	readonly rehab: ReturnType<typeof rehabCollection>;
	readonly prefs: ReturnType<typeof prefsCollection>;
	readonly swaps: ReturnType<typeof swapsCollection>;
	readonly dayPlan: ReturnType<typeof dayPlanCollection>;
	readonly dayExercises: ReturnType<typeof dayExercisesCollection>;
	readonly daySwaps: ReturnType<typeof daySwapsCollection>;
	readonly taskDone: ReturnType<typeof taskDoneCollection>;
	readonly sessions: ReturnType<typeof sessionsCollection>;
	readonly readinessLog: ReturnType<typeof readinessLogCollection>;
	readonly selfCheckLog: ReturnType<typeof selfCheckLogCollection>;
	readonly bodyweight: ReturnType<typeof bodyweightCollection>;
	readonly savedPrograms: ReturnType<typeof savedProgramsCollection>;
}

/** How one collection is configured, everywhere.
 *
 *  `startSync: true` so the rows are in memory the moment the collection exists.
 *  The default is lazy, and lazy would mean the first render of a screen reads an
 *  empty store and then re-renders — which on Today is a rest day, three zeroed
 *  counters and an empty chart, drawn for one frame before the real answer. */
function options(name: string, storage?: StorageApi) {
	return { storageKey: `${PREFIX}${name}`, startSync: true, ...(storage ? { storage } : {}) };
}

const currentWeekCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<CurrentWeekRow, string>({
			...options('currentWeek', s),
			getKey: (row) => row.id,
		}),
	);

const programCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<ProgramRow, string>({
			...options('program', s),
			getKey: (row) => row.id,
		}),
	);

const baselineCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<BaselineRow, string>({
			...options('baseline', s),
			getKey: (row) => row.id,
		}),
	);

const rehabCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<RehabRow, string>({
			...options('rehab', s),
			getKey: (row) => row.id,
		}),
	);

const prefsCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<PrefsRow, string>({
			...options('prefs', s),
			getKey: (row) => row.id,
		}),
	);

const swapsCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<SwapRow, string>({
			...options('swaps', s),
			getKey: (row) => row.exercise,
		}),
	);

const dayPlanCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<DayPlanRow, string>({
			...options('dayPlan', s),
			getKey: (row) => row.slot,
		}),
	);

const dayExercisesCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<DayExercisesRow, string>({
			...options('dayExercises', s),
			getKey: (row) => row.slot,
		}),
	);

const daySwapsCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<DaySwapRow, string>({
			...options('daySwaps', s),
			getKey: (row) => row.task,
		}),
	);

const taskDoneCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<TaskDoneRow, string>({
			...options('taskDone', s),
			getKey: (row) => row.task,
		}),
	);

/** Keyed by ISO calendar date: a session is the training done in one slot on one
 *  date, so the date is its identity and a second session that day replaces it
 *  rather than doubling it. Never a localized label (ADR-0003). */
const sessionsCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<Session, string>({
			...options('sessions', s),
			getKey: (row) => row.at,
		}),
	);

/** Keyed by epoch ms — a readiness check is identified by when it was taken, and
 *  the athlete can re-check within a day. */
const readinessLogCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<LoggedReadinessCheck, number>({
			...options('readinessLog', s),
			getKey: (row) => row.at,
		}),
	);

const selfCheckLogCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<SelfCheck, number>({
			...options('selfCheckLog', s),
			getKey: (row) => row.at,
		}),
	);

const bodyweightCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<BodyweightReading, number>({
			...options('bodyweight', s),
			getKey: (row) => row.at,
		}),
	);

/**
 * Keyed by the athlete's own name for the program.
 *
 * **This is a display string used as an identity, and ADR 0003 argues against
 * it.** It is here anyway because `SavedProgram` has no id to key on, and minting
 * one is an entity decision #55 owns rather than something to invent in a
 * collection. The cost is real and worth writing down: renaming a saved program
 * re-keys its row, so under a per-key write path (#57) two devices can end up
 * holding the same program under two names. The ticket that builds the Program
 * page is where that gets an id.
 */
const savedProgramsCollection = (s?: StorageApi) =>
	createCollection(
		localStorageCollectionOptions<SavedProgram, string>({
			...options('savedPrograms', s),
			getKey: (row) => row.name,
		}),
	);

/**
 * The storage to hand the collections instead of the library's default, or
 * `undefined` to take the default.
 *
 * The library falls back to memory when there is no `window`, which covers a
 * server render. It does **not** cover a `window` whose `localStorage` is present
 * but not functional — which is exactly what jsdom under Vitest hands over, and
 * what Safari hands over in private browsing with storage denied. Left
 * unguarded, every one of the fifteen collections logs a stack trace on
 * construction and then works anyway, which is the shape of failure that gets
 * ignored rather than fixed.
 *
 * Storage that cannot be read is no storage: the collections run in memory and
 * the account lives for as long as the tab does. That is a real degradation and
 * it is #57's to surface — `CONTEXT.md` already has the word for it (**unsynced
 * work**) — but it is not a crash, and it is not silence either.
 */
function storageOverride(): StorageApi | undefined {
	const candidate: unknown = typeof window === 'undefined' ? null : window.localStorage;
	// No `window` at all: the library's own memory fallback already handles it.
	if (!candidate) return undefined;
	const api = candidate as Partial<StorageApi>;
	const broken = typeof api.getItem !== 'function' || typeof api.setItem !== 'function';
	return broken ? memoryStorage() : undefined;
}

/** A `StorageApi` backed by nothing but a `Map`. */
function memoryStorage(): StorageApi {
	const cells = new Map<string, string>();
	return {
		getItem: (k) => cells.get(k) ?? null,
		setItem: (k, v) => void cells.set(k, v),
		removeItem: (k) => void cells.delete(k),
	};
}

/**
 * A fresh, empty set of collections.
 *
 * `storage` is for tests: pass an in-memory `StorageApi` and the collections
 * persist nowhere, and two stores over the same one are what a reload is. Left
 * out, they use `window.localStorage` where it works and memory where it does
 * not.
 */
export function createAccountStore(
	storage: StorageApi | undefined = storageOverride(),
): AccountStore {
	return {
		currentWeek: currentWeekCollection(storage),
		program: programCollection(storage),
		baseline: baselineCollection(storage),
		rehab: rehabCollection(storage),
		prefs: prefsCollection(storage),
		swaps: swapsCollection(storage),
		dayPlan: dayPlanCollection(storage),
		dayExercises: dayExercisesCollection(storage),
		daySwaps: daySwapsCollection(storage),
		taskDone: taskDoneCollection(storage),
		sessions: sessionsCollection(storage),
		readinessLog: readinessLogCollection(storage),
		selfCheckLog: selfCheckLogCollection(storage),
		bodyweight: bodyweightCollection(storage),
		savedPrograms: savedProgramsCollection(storage),
	};
}

/** The fixed key every singleton collection files its one row under. */
export const SINGLETON_KEY = ONLY;
