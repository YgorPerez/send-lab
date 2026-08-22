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
import { useMemo, useSyncExternalStore } from 'react';
import type { DayTypeId } from '$lib/content/types';
import {
	type AthleteId,
	asWeekId,
	type ExerciseId,
	parseAthleteId,
	type SlotKey,
	type TaskKey,
} from '$lib/ids';
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
import { createRecordSync, type RecordSync } from './sync';

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
 *  device; `store/locale.ts` is the resolution order that phrase stands for, and
 *  it needs this as the base of the row it inserts on a first locale switch. */
export const NO_PREFS: Prefs = { weight: 'kg', length: 'mm', notify: false, locale: null };

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

// ------------------------------------------------------- the active account
//
// One store per account, and the active one is whichever athlete is signed in.
// The account is set from outside rather than read from the session here: this
// module is the store, and importing `auth-client` into it would put a network
// call behind every screen test that renders one.

/**
 * Where the last signed-in account is remembered.
 *
 * The session is a network call, and offline it simply fails — so without this,
 * a cold start with no network reads the signed-out store, shows the athlete
 * fifteen empty collections, and files whatever they log next somewhere that
 * never syncs. Remembering the id is what makes an offline launch open the right
 * record. It is cleared when the session resolves to *absent*, which is a real
 * sign-out, and never when it merely fails to resolve.
 */
const REMEMBERED = 'sendlab:account';

function remembered(): AthleteId | null {
	try {
		return parseAthleteId(localStorage.getItem(REMEMBERED));
	} catch {
		// No `window`, or storage denied. Both mean: nothing remembered.
		return null;
	}
}

let active: AthleteId | null = remembered();
const stores = new Map<string, RecordStore>();
/** Held beside the stores so an account keeps the same sync for as long as its
 *  collections live — a second one would mean two queues over one store, each
 *  flushing rows the other still thinks are unsynced.
 *
 *  Nothing reads this from outside yet. `unsynced()` on a sync is `CONTEXT.md`'s
 *  **unsynced work**, and showing it to the athlete is the one thing #57 leaves
 *  on the table: `sync_saving` / `sync_offline` already exist in both locales,
 *  but where the indicator goes is a component-vocabulary decision and the
 *  browser tier that would measure it has not been re-run since the store
 *  landed. */
const syncs = new Map<string, RecordSync | null>();
const listeners = new Set<() => void>();

/**
 * Point the store at an account, or at nobody.
 *
 * **Only call this once the session has actually resolved.** A session that is
 * still pending, or that failed because the device is offline, is not a signed-out
 * athlete — and treating it as one swaps the store for an empty namespace that
 * never syncs. `__root.tsx` carries that guard.
 *
 * Signing out does **not** clear the previous account's rows: they stay under
 * their own storage prefix, so signing back in is instant and offline, and the
 * writes #58's queue has not yet flushed are still there to flush. What keeps two
 * athletes apart on one device is the prefix, not deletion. What is forgotten is
 * only *which* account was last active.
 */
export function setActiveAccount(accountId: string | null): void {
	const next = parseAthleteId(accountId);
	if (next === active) return;
	active = next;
	try {
		if (next === null) localStorage.removeItem(REMEMBERED);
		else localStorage.setItem(REMEMBERED, next);
	} catch {
		// Storage denied. The account still switches for this tab; only the
		// offline-launch shortcut is lost.
	}
	for (const notify of listeners) notify();
}

/**
 * The store for the account currently signed in.
 *
 * Built on first use rather than at module scope: on the server there is no
 * `localStorage` and the collections fall back to an in-memory store, and there
 * is nothing to gain from constructing fifteen of them while rendering a shell
 * that reads none of them (ADR 0006 — the shell is the only thing prerendered,
 * and it must stay account-independent).
 *
 * **It starts empty.** #56 seeded a fabricated five weeks here, because nothing
 * fetched an account yet and three screens would otherwise have had nothing to
 * render. That is exactly what must not happen now: the seed ran synchronously on
 * first read, before any fetch could return, so a real account would hydrate into
 * a store already holding invented history. `store/seed.ts` survives as the
 * scenario the tests assert against and the app imports it nowhere.
 */
export function recordStore(): RecordStore {
	const account = active;
	// One entry per account, plus one for nobody — `null` is not a `Map` key worth
	// arguing about, so the signed-out store files under the empty string.
	const cacheKey = account ?? '';
	const existing = stores.get(cacheKey);
	if (existing) return existing;

	// The signed-out store does not sync: there is no account to sync it to.
	const sync = account === null ? null : createRecordSync();
	const store = createRecordStore(account, sync?.push);
	stores.set(cacheKey, store);
	syncs.set(cacheKey, sync);

	// Hydrating on the cache miss, rather than in an effect, keeps it to once per
	// account per tab however many screens mount. Guarded on `window` because the
	// prerendered shell must not reach for an account.
	if (sync && typeof window !== 'undefined') {
		void sync.hydrate(store).catch((error: unknown) => {
			// A failed hydrate is not a failed app: the collections already hold
			// whatever this device last saw, which offline is the only answer there
			// is. The next mutation's flush is the next attempt.
			console.warn('/api/state hydrate deferred:', error);
		});
	}
	return store;
}

/** Drop every store, so the next reader builds a fresh one. For tests, and for
 *  the account switch that has to forget the collections it built. */
export function resetRecordStore(): void {
	active = null;
	stores.clear();
	syncs.clear();
	try {
		localStorage.removeItem(REMEMBERED);
	} catch {
		// Nothing to forget.
	}
	for (const notify of listeners) notify();
}

/** The active account's sync, or `null` when signed out. `store/locale.ts` needs
 *  it to tell "the account holds no preferences" from "the account has not
 *  answered yet" — writing a fabricated default row before the answer arrives
 *  would beat the athlete's real one under last-write-wins. */
export function recordSync(): RecordSync | null {
	recordStore();
	return syncs.get(active ?? '') ?? null;
}

function subscribe(notify: () => void): () => void {
	listeners.add(notify);
	return () => void listeners.delete(notify);
}

/** The account the store is pointed at, live.
 *
 *  A dependency rather than a value to read: every `useLiveQuery` over a
 *  collection has to re-subscribe when this changes, or it keeps reporting the
 *  store it first saw — one athlete's rows on another athlete's screen. */
export function useActiveAccount(): AthleteId | null {
	return useSyncExternalStore(
		subscribe,
		() => active,
		() => null,
	);
}

/**
 * The training record, live.
 *
 * Fifteen subscriptions rather than one: each collection notifies on its own, so
 * ticking a task re-renders without the sessions, the readiness log or the
 * bodyweight series being re-read. That granularity is the thing ADR 0007 bought.
 *
 * Signed out, this reads the signed-out store — empty until the athlete trains,
 * and never sent anywhere. The screens render the same either way; what differs
 * is whether the rows have an account to belong to.
 */
export function useTrainingRecord(): TrainingRecord {
	// Re-read when the account changes: signing in swaps all fifteen collections
	// for a different athlete's, and every `useLiveQuery` below has to re-subscribe
	// rather than keep reporting the store it first saw.
	const account = useActiveAccount();
	const s = recordStore();
	const currentWeek = useLiveQuery(() => s.currentWeek, [account]).data;
	const program = useLiveQuery(() => s.program, [account]).data;
	const baseline = useLiveQuery(() => s.baseline, [account]).data;
	const rehab = useLiveQuery(() => s.rehab, [account]).data;
	const prefs = useLiveQuery(() => s.prefs, [account]).data;
	const swaps = useLiveQuery(() => s.swaps, [account]).data;
	const dayPlan = useLiveQuery(() => s.dayPlan, [account]).data;
	const dayExercises = useLiveQuery(() => s.dayExercises, [account]).data;
	const daySwaps = useLiveQuery(() => s.daySwaps, [account]).data;
	const taskDone = useLiveQuery(() => s.taskDone, [account]).data;
	const sessions = useLiveQuery(() => s.sessions, [account]).data;
	const readinessLog = useLiveQuery(() => s.readinessLog, [account]).data;
	const selfCheckLog = useLiveQuery(() => s.selfCheckLog, [account]).data;
	const bodyweight = useLiveQuery(() => s.bodyweight, [account]).data;
	const savedPrograms = useLiveQuery(() => s.savedPrograms, [account]).data;

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
