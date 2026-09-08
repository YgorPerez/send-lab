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
// `server/stateOps.ts`'s `defaultState()` was the inventory of what survived the
// keep/drop audit, and every field of it is a collection below. (That module is
// gone as of #57 — ADR 0015 — and `server/record/rows.ts` is the same inventory
// stated per key. `tests/recordRows.test.ts` holds the two lists against each
// other.) Two departures, both deliberate:
//
//   * **`log` is not here.** #12 dropped it — two of its three kinds died with
//     `metrics[]`, `'rec'` was written nowhere, and the survivor was a drifting
//     copy of `taskDone`. `lib/types.ts` deleted `LogEntry`, and #57 deleted
//     `defaultState()` along with the rest of the document skeleton.
//   * **`workouts` is `sessions` and `assessment` is `baseline`.** Both old names
//     are on the glossary's _Avoid_ list for the thing they hold, and these keys
//     are new storage rather than a migration of the SvelteKit document — there
//     is nothing to carry across (#11, *Out of scope*). The server says the same
//     two words: `server/record/rows.ts` is the per-key guard #57 built in place of
//     `sanitizeState`. ADR 0014 is the general rule this instance produced.
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
// EVERY COLLECTION WRITES, AND NONE OF THEM WAITS
// -----------------------------------------------
// #56 left the three handlers off; #57 adds them. Each one hands its mutations to
// `push`, which queues them for `/api/state` and returns — it does **not** await
// the network, and the reason is in the library's own ordering: the localStorage
// collection awaits this handler *before* persisting to storage, and rolls the
// mutation back if it throws. A handler that awaited `fetch` would mean ticking a
// task offline blocks, times out, and then un-ticks itself.
//
// So the local write is unconditional and the server write trails it. `store/sync.ts`
// carries what that leaves unsolved and why it is #58's: the queue is in memory,
// so the *intent* to sync does not survive a reload even though the row does.
// ADR 0008 is still the ruling that `@tanstack/offline-transactions` is what makes
// a write durable; this is the online path only.
import { createCollection, localStorageCollectionOptions, type StorageApi } from '@tanstack/db';
import type { DayTypeId } from '$lib/content/types';
import { isEphemeralKey } from '$lib/ephemeral';
import type { AthleteId, ExerciseId, SlotKey, TaskKey, WeekId } from '$lib/ids';
import type { UnsyncedWrite } from '$lib/recordWire';
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

/** One key per collection: the document is split in storage, not only in memory.
 *
 *  Shares the `sendlab:` namespace with the ephemeral stores but not their shape —
 *  those are `sendlab:<name>:v<n>` (`lib/ephemeral.ts`), these are
 *  `sendlab:<account>:<collection>`. The difference is deliberate: a collection is
 *  account data whose shape changes are a migration, and an ephemeral draft is
 *  throwaway whose shape changes are a version bump that discards it. */
const PREFIX = 'sendlab:';

/** The storage segment a store with no account gets.
 *
 *  A plain string, and deliberately never an `AthleteId`: signed out is `null`
 *  everywhere above this line. A sentinel that could pass for a real id is how one
 *  athlete's rows end up under another's prefix, and `tests/ids.test.ts` refuses
 *  the assertion that would create one. */
const NO_ACCOUNT = 'signed-out';

/**
 * The accounts whose records this device is still holding.
 *
 * Read off the storage keys, because nothing else lists them: the collections
 * are namespaced `sendlab:<account>:<collection>` and the only pointer anywhere
 * is `sendlab:account`, which names the *active* one and is cleared the moment a
 * session resolves to absent. So after an expiry there is no record of who was
 * here except the records themselves — which is precisely what `login` has to
 * know, since #24 decided expiry clears neither the store nor the queue and the
 * page must not imply otherwise.
 *
 * `NO_ACCOUNT` is excluded on purpose. Training logged with nobody signed in is
 * real and is kept, but it is not an account and signing in opens the account's
 * own record rather than carrying it over.
 *
 * Plain strings, and deliberately not `AthleteId`s: these are storage segments
 * this module read back off the device, not identities anything vouched for, and
 * `lib/ids.ts` is the only door that mints one (`tests/ids.test.ts` refuses the
 * assertion that would open a second). The only question asked of them here is
 * whether there are any.
 */
export function heldAccounts(): readonly string[] {
	const found = new Set<string>();
	for (const key of storageKeys()) {
		if (!key.startsWith(PREFIX) || isEphemeralKey(key)) continue;
		const [account, collection, ...rest] = key.slice(PREFIX.length).split(':');
		if (!account || !collection || rest.length > 0) continue;
		if (account === NO_ACCOUNT) continue;
		found.add(account);
	}
	return [...found];
}

/** Every key in `localStorage`, or none where there is no usable one.
 *
 *  `storageOverride()` below already answers exactly that question — it hands
 *  back a substitute precisely when the real `localStorage` cannot be used (no
 *  `window`, storage denied, or the jsdom shape whose methods are not functions)
 *  — so this asks it rather than repeating the guard.
 *
 *  A substitute means there is nothing to enumerate: the collections are in a
 *  `Map` that outlives nothing. That reads as "no account held", which is the
 *  safer of the two answers to be wrong about, because it promises nothing. */
function storageKeys(): string[] {
	try {
		if (typeof window === 'undefined' || storageOverride() !== undefined) return [];
		return Object.keys(window.localStorage);
	} catch {
		return [];
	}
}

/** Everything `collectionOptions` decides, as one value. `getKey` is the only
 *  thing a factory still supplies for itself — it is the one part that differs.
 *
 *  Declared rather than inferred: the builder returns different shapes depending
 *  on whether it was given storage and a `push`, and spreading that union into
 *  `localStorageCollectionOptions` makes its overload resolution pick the wrong
 *  one. */
interface CollectionOptions {
	storageKey: string;
	startSync: boolean;
	storage?: StorageApi;
	onInsert?: WriteHandler;
	onUpdate?: WriteHandler;
	onDelete?: WriteHandler;
}

/** What the collection calls when rows change.
 *
 *  It returns a promise because the library's types require one, and an
 *  immediately-resolved promise is the whole point: the collection awaits this
 *  before persisting to storage, so anything slower than a microtask here is a
 *  local write held up by the network. */
type WriteHandler = (params: { transaction: { mutations: readonly Mutated[] } }) => Promise<void>;

/** Hand changed rows to whatever is going to send them. Never awaited.
 *
 *  `UnsyncedWrite` is declared in `lib/recordWire.ts`, below both this module and
 *  the server's — the first cut had it here and a byte-identical `StateWrite` on
 *  the server, which is exactly the drift the comment on it warned about. */
export type PushWrites = (writes: readonly UnsyncedWrite[]) => void;

/** The shape of a mutation, as much of it as a handler here reads. Written out
 *  rather than imported: the library's own type is generic over the row and all
 *  fifteen collections share this one handler. */
interface Mutated {
	readonly key: unknown;
	readonly modified?: unknown;
	readonly metadata?: unknown;
}

/**
 * What a hydrate tags its own writes with, so they are not sent straight back.
 *
 * `store/sync.ts` passes this when it applies the server's answer to the
 * collections; the handlers below skip anything carrying it. Metadata rather than
 * a "we are hydrating right now" flag, because the library invokes the handler
 * when the transaction commits rather than inside `insert()` — a flag would
 * already be down by then, and the echo it let through would re-stamp every row's
 * `updated_at` with *now*, beating a real edit made on another device.
 */
export const HYDRATED = { hydrated: true } as const;

function isHydration(mutation: Mutated): boolean {
	return (
		typeof mutation.metadata === 'object' &&
		mutation.metadata !== null &&
		(mutation.metadata as { hydrated?: unknown }).hydrated === true
	);
}

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
export interface SlotDayTypeRow {
	slot: SlotKey;
	dayType: DayTypeId;
}

/** Per-slot exercise list, overriding the day type's defaults for that slot. */
export interface SlotExercisesRow {
	slot: SlotKey;
	exercises: ExerciseId[];
}

/** Per-task variant choice — the strongest swap. */
export interface TaskSwapRow {
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

/** Display units, the two notification switches, the athlete's language, and
 *  where in the world their day starts.
 *
 *  `locale` is account data rather than a cookie (ADR 0006): `/mcp` authenticates
 *  by bearer token and never reads cookies, so localized MCP output cannot come
 *  from anything the browser sets, and this is what carries the choice to a
 *  second device. Null means follow the device. Its resolution order is
 *  `store/locale.ts`'s: the device on boot, the account once it hydrates, and a
 *  switch writes both.
 *
 *  **`cueNotices` and `dailyNotice` were one boolean called `notify`** (#75). It
 *  gated nothing at all, and it was about to gate two capabilities that share
 *  neither a permission story nor a failure mode: one is a local notification
 *  raised by this device with no server anywhere in it, the other is a push the
 *  server sends to a subscription this device registered. One switch cannot mean
 *  both, so there are two, and both default to off — turning either on is the
 *  gesture that asks the OS for permission.
 *
 *  **`timeZone` is the field nobody had noticed was missing.** Preferences carry
 *  units and a locale and nothing that says when the athlete's day *starts*, so a
 *  daily job running at a fixed UTC hour would compute a "today" that is the
 *  athlete's yesterday or tomorrow. An IANA zone, captured from the browser on
 *  boot by `store/timeZone.ts`. Null is **absent**, not a guess: an account that
 *  has never reported one is a fact the server should be able to read, and
 *  defaulting it to `UTC` would look identical to an athlete who really is in
 *  London. */
export interface PrefsRow {
	id: typeof ONLY;
	weight: 'kg' | 'lb';
	length: 'mm' | 'in';
	/** Raise a notification when the timer's segment changes and the app is
	 *  backgrounded. Local to this device; works with no signal. */
	cueNotices: boolean;
	/** Receive the one morning push naming today's day type. Needs the server.
	 *
	 *  **Nothing reads this yet, on purpose.** #75 is the prefactor: the switch is
	 *  #81's and the job that sends the push is #80's, and neither can be built on
	 *  a boolean that also means the timer. A field with no reader is normally a
	 *  question with no answer — this one is the answer arriving first. */
	dailyNotice: boolean;
	/** IANA zone — `America/Sao_Paulo`. Null means the account has never
	 *  reported one. */
	timeZone: string | null;
	locale: string | null;
}

// ------------------------------------------------------------------ the store

/** Every collection the account is held in. */
export interface RecordStore {
	readonly currentWeek: ReturnType<typeof currentWeekCollection>;
	readonly program: ReturnType<typeof programCollection>;
	readonly baseline: ReturnType<typeof baselineCollection>;
	readonly rehab: ReturnType<typeof rehabCollection>;
	readonly prefs: ReturnType<typeof prefsCollection>;
	readonly swaps: ReturnType<typeof swapsCollection>;
	readonly slotDayType: ReturnType<typeof slotDayTypeCollection>;
	readonly slotExercises: ReturnType<typeof slotExercisesCollection>;
	readonly taskSwaps: ReturnType<typeof taskSwapsCollection>;
	readonly taskDone: ReturnType<typeof taskDoneCollection>;
	readonly sessions: ReturnType<typeof sessionsCollection>;
	readonly readinessLog: ReturnType<typeof readinessLogCollection>;
	readonly selfCheckLog: ReturnType<typeof selfCheckLogCollection>;
	readonly bodyweight: ReturnType<typeof bodyweightCollection>;
	readonly savedPrograms: ReturnType<typeof savedProgramsCollection>;
}

/**
 * How one collection is configured, everywhere.
 *
 * `startSync: true` so the rows are in memory the moment the collection exists.
 * The default is lazy, and lazy would mean the first render of a screen reads an
 * empty store and then re-renders — which on Today is a rest day, three zeroed
 * counters and an empty chart, drawn for one frame before the real answer.
 *
 * The storage key carries the **account** — `sendlab:<accountId>:taskDone`. That
 * is what keeps two athletes' records apart on one device, and it is why #56
 * namespaced these keys rather than leaving them bare. Signing out does not clear
 * them: signing back in is then instant and offline, and #58's queue needs the
 * unsynced rows to still be there.
 */
function collectionOptions(
	account: string,
	name: string,
	storage: StorageApi | undefined,
	push?: PushWrites,
): CollectionOptions {
	return {
		storageKey: `${PREFIX}${account}:${name}`,
		startSync: true,
		...(storage ? { storage } : {}),
		...writeHandlers(name, push),
	};
}

/** The three handlers, or none at all when there is nothing to push to.
 *
 *  A delete is spelled as a write of `null` rather than as its own operation,
 *  matching the server: under last-write-wins a deletion is content like any
 *  other, ordered by the same clock. */
function writeHandlers(name: string, push?: PushWrites): Partial<CollectionOptions> {
	if (!push) return {};
	const send =
		(deleted: boolean): WriteHandler =>
		async ({ transaction }) => {
			const rows = transaction.mutations.filter((m) => !isHydration(m));
			if (rows.length === 0) return;
			// One timestamp for the whole transaction: the mutations happened in the
			// same interaction, and stamping them apart would invent an ordering the
			// athlete did not express.
			const at = Date.now();
			push(
				rows.map((m) => ({
					collection: name,
					key: String(m.key),
					row: deleted ? null : m.modified,
					at,
				})),
			);
		};
	return { onInsert: send(false), onUpdate: send(false), onDelete: send(true) };
}

const currentWeekCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<CurrentWeekRow, string>({
			...o,
			getKey: (row) => row.id,
		}),
	);

const programCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<ProgramRow, string>({
			...o,
			getKey: (row) => row.id,
		}),
	);

const baselineCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<BaselineRow, string>({
			...o,
			getKey: (row) => row.id,
		}),
	);

const rehabCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<RehabRow, string>({
			...o,
			getKey: (row) => row.id,
		}),
	);

const prefsCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<PrefsRow, string>({
			...o,
			getKey: (row) => row.id,
		}),
	);

const swapsCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<SwapRow, string>({
			...o,
			getKey: (row) => row.exercise,
		}),
	);

const slotDayTypeCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<SlotDayTypeRow, string>({
			...o,
			getKey: (row) => row.slot,
		}),
	);

const slotExercisesCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<SlotExercisesRow, string>({
			...o,
			getKey: (row) => row.slot,
		}),
	);

const taskSwapsCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<TaskSwapRow, string>({
			...o,
			getKey: (row) => row.task,
		}),
	);

const taskDoneCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<TaskDoneRow, string>({
			...o,
			getKey: (row) => row.task,
		}),
	);

/** Keyed by ISO calendar date: a session is the training done in one slot on one
 *  date, so the date is its identity and a second session that day replaces it
 *  rather than doubling it. Never a localized label (ADR-0003). */
const sessionsCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<Session, string>({
			...o,
			getKey: (row) => row.at,
		}),
	);

/** Keyed by epoch ms — a readiness check is identified by when it was taken, and
 *  the athlete can re-check within a day. */
const readinessLogCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<LoggedReadinessCheck, number>({
			...o,
			getKey: (row) => row.at,
		}),
	);

const selfCheckLogCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<SelfCheck, number>({
			...o,
			getKey: (row) => row.at,
		}),
	);

const bodyweightCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<BodyweightReading, number>({
			...o,
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
const savedProgramsCollection = (o: CollectionOptions) =>
	createCollection(
		localStorageCollectionOptions<SavedProgram, string>({
			...o,
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
 * Exported because #58's unsynced work has to make the *same* decision: a device
 * whose storage is unusable must not persist the collections in memory while
 * believing the record of what has not been sent is durable, or the two disagree
 * about what survives a reload.
 *
 * Storage that cannot be read is no storage: the collections run in memory and
 * the account lives for as long as the tab does. That is a real degradation and
 * it is #57's to surface — `CONTEXT.md` already has the word for it (**unsynced
 * work**) — but it is not a crash, and it is not silence either.
 */
export function storageOverride(): StorageApi | undefined {
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
 * A fresh, empty set of collections for one account.
 *
 * `account` segments the storage keys, so two athletes on one device hold two
 * records and neither can read the other's. `push` is what makes the collections
 * write to the server; without it they persist locally and stop, which is what
 * #56 shipped and what a signed-out store still does.
 *
 * `storage` is for tests: pass an in-memory `StorageApi` and the collections
 * persist nowhere, and two stores over the same one are what a reload is. Left
 * out, they use `window.localStorage` where it works and memory where it does
 * not.
 */
export function createRecordStore(
	account: AthleteId | null,
	push?: PushWrites,
	storage: StorageApi | undefined = storageOverride(),
): RecordStore {
	const segment = account ?? NO_ACCOUNT;
	const options = (name: string) => collectionOptions(segment, name, storage, push);
	return {
		currentWeek: currentWeekCollection(options('currentWeek')),
		program: programCollection(options('program')),
		baseline: baselineCollection(options('baseline')),
		rehab: rehabCollection(options('rehab')),
		prefs: prefsCollection(options('prefs')),
		swaps: swapsCollection(options('swaps')),
		slotDayType: slotDayTypeCollection(options('slotDayType')),
		slotExercises: slotExercisesCollection(options('slotExercises')),
		taskSwaps: taskSwapsCollection(options('taskSwaps')),
		taskDone: taskDoneCollection(options('taskDone')),
		sessions: sessionsCollection(options('sessions')),
		readinessLog: readinessLogCollection(options('readinessLog')),
		selfCheckLog: selfCheckLogCollection(options('selfCheckLog')),
		bodyweight: bodyweightCollection(options('bodyweight')),
		savedPrograms: savedProgramsCollection(options('savedPrograms')),
	};
}

/** The fixed key every singleton collection files its one row under. */
export const SINGLETON_KEY = ONLY;
