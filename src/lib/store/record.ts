// The read half of the store: collections in, one training record out.
//
// **Training record** is a `CONTEXT.md` term: everything one athlete's account
// holds. An account is the identity that owns it; this is the thing owned, which
// is why the store below is a `RecordStore` and not an account one. The collections below it are sixteen keyed row sets
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
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { DayTypeId } from '$lib/content/types';
import {
	type AthleteId,
	asWeekId,
	type ExerciseId,
	type LoadKey,
	loadKey,
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
	WorkingLoad,
} from '$lib/types';
import {
	type BaselineRow,
	type CurrentWeekRow,
	createRecordStore,
	type PrefsRow,
	type ProgramRow,
	type RecordStore,
	type RehabRow,
	type SlotDayTypeRow,
	type SlotExercisesRow,
	type SwapRow,
	type TaskDoneRow,
	type TaskSwapRow,
} from './collections';
import { createRecordSync, type RecordSync } from './sync';

/** Display units, the notification switches, the athlete's language and their
 *  time zone, without the key the singleton row is filed under. */
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
const NO_PROGRAM: Program = {
	weeks: 8,
	template: {},
	overrides: {},
	phases: [],
	autoProgress: true,
};

/** Preferences before the athlete has set any. `locale: null` means follow the
 *  device; `store/locale.ts` is the resolution order that phrase stands for, and
 *  it needs this as the base of the row it inserts on a first locale switch.
 *
 *  Both notification switches are **off**, so installing the app never produces a
 *  permission prompt nobody asked for, and `timeZone` is **null** rather than the
 *  device's zone: this value is what a record with no prefs row reads as, and a
 *  guess here would be indistinguishable from a zone the athlete really reported.
 *  `store/timeZone.ts` writes the real one on boot. */
export const NO_PREFS: Prefs = {
	weight: 'kg',
	length: 'mm',
	cueNotices: false,
	dailyNotice: false,
	timeZone: null,
	locale: null,
};

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
		slotDayType: store.slotDayType.toArray,
		slotExercises: store.slotExercises.toArray,
		taskSwaps: store.taskSwaps.toArray,
		taskDone: store.taskDone.toArray,
		sessions: store.sessions.toArray,
		readinessLog: store.readinessLog.toArray,
		selfCheckLog: store.selfCheckLog.toArray,
		bodyweight: store.bodyweight.toArray,
		savedPrograms: store.savedPrograms.toArray,
		workingLoads: store.workingLoads.toArray,
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
	slotDayType: readonly SlotDayTypeRow[];
	slotExercises: readonly SlotExercisesRow[];
	taskSwaps: readonly TaskSwapRow[];
	taskDone: readonly TaskDoneRow[];
	sessions: readonly Session[];
	readinessLog: readonly LoggedReadinessCheck[];
	selfCheckLog: readonly SelfCheck[];
	bodyweight: readonly BodyweightReading[];
	savedPrograms: readonly SavedProgram[];
	workingLoads: readonly WorkingLoad[];
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
		slotDayType: byKey<SlotDayTypeRow, SlotKey, DayTypeId>(
			rows.slotDayType,
			(r) => r.slot,
			(r) => r.dayType,
		),
		slotExercises: byKey<SlotExercisesRow, SlotKey, ExerciseId[]>(
			rows.slotExercises,
			(r) => r.slot,
			(r) => r.exercises,
		),
		taskSwaps: byKey<TaskSwapRow, TaskKey, number>(
			rows.taskSwaps,
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
		// The whole row, not just the kilograms: which rung of the ladder the
		// number came from is read beside it (#29 grades a test and a guess
		// differently), and a map of bare numbers would drop it one layer above
		// the collection that carefully stores it.
		workingLoads: byKey<WorkingLoad, LoadKey, WorkingLoad>(
			rows.workingLoads,
			(r) => loadKey(r.exercise, r.variant),
			(r) => r,
		),
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
 * sixteen empty collections, and files whatever they log next somewhere that
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
 *  `unsynced()` on a sync is `CONTEXT.md`'s **unsynced work**. Settings reads the
 *  refused half of it through `useRefusedWork` and gates sign-out on the sendable
 *  half (#82); the top strip reads the sendable half through `useSendableWork`
 *  and says "Saving…" while it is not zero (#83). The third of ADR 0008's states
 *  — the unmissable message when a write has been *refused* — is still nowhere:
 *  `useRefusedWork` is read by Settings alone, which is not a screen the athlete
 *  opens mid-set. */
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
 * is nothing to gain from constructing sixteen of them while rendering a shell
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
	const sync = account === null ? null : createRecordSync(account);
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
	// Signed out there is no sync by construction, and since #83 this is read from
	// the top strip on every screen — including `/login`, where building the
	// signed-out account's sixteen collections to be told `null` is sixteen
	// collections nobody asked for.
	if (active === null) return null;
	recordStore();
	return syncs.get(active) ?? null;
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
 * Whether the account's record has arrived — live.
 *
 * **What it is for: telling "the account holds no such row" from "the account
 * has not answered yet".** Every nullable field of a `TrainingRecord` collapses
 * those two into one value — `assemble` reads `rows.baseline[0]?.baseline ??
 * null` — and a screen that reads the absence as an answer is wrong for as long
 * as `/api/state` takes. `store/prefs.ts` already had to solve this on the write
 * side, and its reasoning is the same one: before the account has answered there
 * is always no row, so anything decided in that window is decided from nothing.
 *
 * `RecordSync.settled()` is the underlying promise and it resolves on a *failed*
 * hydrate too, which is what makes this safe offline: the answer is "as much of
 * the record as this device is ever going to see", not "the network agreed".
 *
 * Signed out it is `true` from the first render — there is no account, so there
 * is nothing to wait for and no server copy that could contradict the device.
 */
export function useRecordSettled(): boolean {
	// Re-read when the account changes: a different athlete's record has not
	// arrived just because this one's had.
	const account = useActiveAccount();
	const [settled, setSettled] = useState(() => recordSync() === null);

	useEffect(() => {
		// Read off `account` rather than calling `recordSync()` blind, which makes
		// the dependency below a real one instead of one the linter has to be told
		// to keep: this effect waits for *this* account's record, and `recordSync()`
		// returns `null` for no account anyway.
		const sync = account === null ? null : recordSync();
		if (sync === null) {
			setSettled(true);
			return;
		}
		// Back to false first: this is a *different* account's record now, and
		// carrying the previous one's answer over is the whole failure mode.
		setSettled(false);
		let cancelled = false;
		void sync.settled().then(() => {
			if (!cancelled) setSettled(true);
		});
		return () => {
			cancelled = true;
		};
	}, [account]);

	return settled;
}

/** The unsubscribe for a sync that is not there to subscribe to. */
const NOT_WATCHING = () => {};

/** The two work hooks' snapshots, module-level so their identity is stable
 *  across renders. The server has no store to ask and no athlete to tell. */
const anyRefusedWork = () => (builtSync()?.refused().length ?? 0) > 0;
const noRefusedWork = () => false;
const sendableWork = () => builtSync()?.sendable() ?? 0;
const noSendableWork = () => 0;

/**
 * The active account's sync **if it has already been built**, and never a reason
 * to build one.
 *
 * The distinction from `recordSync()` is which phase may call it. `recordSync()`
 * builds on a miss — sixteen collections and a `hydrate` — and both of those are
 * side effects, which `useSyncExternalStore` forbids in a `getSnapshot`: the
 * snapshot is read during render, more than once, and by React's own tearing
 * check. It got away with it while `useRefusedWork` was read by Settings alone,
 * on a screen that had already built the store through `useTrainingRecord`. #83
 * put a reader in the strip, which renders on every screen and *above* the one
 * that builds it, so the snapshot would have been the thing constructing the
 * account.
 *
 * The build still happens, one phase later and in the right place: `useSyncWatch`
 * calls `recordSync()` from the subscription effect, and React re-reads the
 * snapshot immediately after subscribing. So a tab that reloads holding unsent
 * work reads `0` for one render and the real count on the next, which is a frame,
 * not a wrong answer that sticks. Measured in a real browser rather than reasoned
 * from the contract: the strip says "Saving…" on a cold load of a screen that has
 * not built the store.
 */
function builtSync(): RecordSync | null {
	return active === null ? null : (syncs.get(active) ?? null);
}

/**
 * A subscription to the active account's sync, re-made when the account changes.
 *
 * Shared by both hooks below rather than written twice, because the subtlety is
 * the same one in both and it is not visible at the call site: that is a
 * *different* sync after a sign-in, and a subscription left on the previous one
 * reports the previous athlete's work. `account` is read rather than
 * `recordSync()` called blind, for `useRecordSettled`'s reason — it makes the
 * dependency a real one rather than one the linter has to be told to keep.
 */
function useSyncWatch(): (notify: () => void) => () => void {
	const account = useActiveAccount();
	return useCallback(
		(notify: () => void) =>
			(account === null ? undefined : recordSync()?.subscribe(notify)) ?? NOT_WATCHING,
		[account],
	);
}

/**
 * Whether the server has refused any of this account's work — live.
 *
 * The refusal is the one failure in the write path with no symptom: it arrives
 * as a 200 whose report named the row, so nothing throws, nothing retries and the
 * athlete's device holds training the server has declined. `RecordSync.refused()`
 * exists to be said out loud, and this is what a screen reads it through.
 *
 * Live rather than read once, because almost no flush belongs to the screen
 * watching it: the debounce fires 250ms after any write anywhere in the app, the
 * `online` listener fires on reconnect, and a fresh sync replays what the last tab
 * left behind. A refusal can land while Settings is open and untouched.
 *
 * A boolean rather than the list: `useSyncExternalStore` compares snapshots by
 * value, and `refused()` builds a new array on every call — returning it would
 * re-render on every check forever. Nothing shows the refusals themselves yet;
 * when something does, it wants the array memoised against a version counter, not
 * this.
 */
export function useRefusedWork(): boolean {
	return useSyncExternalStore(useSyncWatch(), anyRefusedWork, noRefusedWork);
}

/**
 * How much unsynced work this device is still holding for the server — live.
 *
 * **`sendable()`, not `unsynced()`.** The two differ by the refused work, and
 * that difference is the whole reason this hook is a separate one rather than a
 * number added to `useRefusedWork`: refused work can never be delivered, so a
 * count including it never returns to zero, and the "Saving…" it drives would
 * become the permanent status ADR 0008 spent a paragraph refusing. What this
 * counts is work that is still going to reach the server.
 *
 * Live for the same reason the refusals are, and one more that is stronger here:
 * since #83 the sync reports the *push* as well as the settle, so the count rises
 * the instant a task is ticked anywhere in the app rather than a debounce later.
 * A screen reading it once at mount would show the athlete a number that was true
 * before they trained.
 *
 * A number rather than a boolean, though the strip only asks whether it is zero:
 * `sendable()` already returns one, `useSyncExternalStore` compares it by value
 * so nothing re-renders on an unchanged count, and the shape that has to be
 * avoided is the *array* one — see `useRefusedWork`.
 *
 * Signed out it is `0` from the first render, and on the server too: there is no
 * account, so there is no sync and nothing that could be waiting.
 */
export function useSendableWork(): number {
	return useSyncExternalStore(useSyncWatch(), sendableWork, noSendableWork);
}

/**
 * The training record, live.
 *
 * Sixteen subscriptions rather than one: each collection notifies on its own, so
 * ticking a task re-renders without the sessions, the readiness log or the
 * bodyweight series being re-read. That granularity is the thing ADR 0007 bought.
 *
 * Signed out, this reads the signed-out store — empty until the athlete trains,
 * and never sent anywhere. The screens render the same either way; what differs
 * is whether the rows have an account to belong to.
 */
export function useTrainingRecord(): TrainingRecord {
	// Re-read when the account changes: signing in swaps all sixteen collections
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
	const slotDayType = useLiveQuery(() => s.slotDayType, [account]).data;
	const slotExercises = useLiveQuery(() => s.slotExercises, [account]).data;
	const taskSwaps = useLiveQuery(() => s.taskSwaps, [account]).data;
	const taskDone = useLiveQuery(() => s.taskDone, [account]).data;
	const sessions = useLiveQuery(() => s.sessions, [account]).data;
	const readinessLog = useLiveQuery(() => s.readinessLog, [account]).data;
	const selfCheckLog = useLiveQuery(() => s.selfCheckLog, [account]).data;
	const bodyweight = useLiveQuery(() => s.bodyweight, [account]).data;
	const savedPrograms = useLiveQuery(() => s.savedPrograms, [account]).data;
	const workingLoads = useLiveQuery(() => s.workingLoads, [account]).data;

	return useMemo(
		() =>
			assemble({
				currentWeek: currentWeek ?? [],
				program: program ?? [],
				baseline: baseline ?? [],
				rehab: rehab ?? [],
				prefs: prefs ?? [],
				swaps: swaps ?? [],
				slotDayType: slotDayType ?? [],
				slotExercises: slotExercises ?? [],
				taskSwaps: taskSwaps ?? [],
				taskDone: taskDone ?? [],
				sessions: sessions ?? [],
				readinessLog: readinessLog ?? [],
				selfCheckLog: selfCheckLog ?? [],
				bodyweight: bodyweight ?? [],
				savedPrograms: savedPrograms ?? [],
				workingLoads: workingLoads ?? [],
			}),
		[
			currentWeek,
			program,
			baseline,
			rehab,
			prefs,
			swaps,
			slotDayType,
			slotExercises,
			taskSwaps,
			taskDone,
			sessions,
			readinessLog,
			selfCheckLog,
			bodyweight,
			savedPrograms,
			workingLoads,
		],
	);
}
