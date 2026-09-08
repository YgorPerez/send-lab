// What a row of the training record is allowed to be, per collection.
//
// This replaces `server/stateOps.ts`, and the replacement is the shape change
// rather than a rewrite. That module guarded **one JSON document per account**:
// `defaultState()` was a complete skeleton and `sanitizeState()` coerced anything
// wrong back onto it, never throwing. It had to, because the unit of the write
// was the whole document — rejecting a malformed document would have discarded
// everything the athlete had.
//
// ADR 0007 made the unit of the write a **row**, so the guard changes with it:
//
//   * **A bad row is rejected, not coerced.** Rejecting one row keeps the other
//     fourteen collections and every other row in this one, so the reason a
//     document sanitizer had to guess is gone. Coercion at this granularity would
//     be worse than useless — it would silently store a *different* row than the
//     athlete's device sent, under the key the athlete's device chose, and the
//     next hydrate would read the lie back as fact.
//   * **There is no default document.** Absence is representable per key now: a
//     brand-new account is fifteen empty collections, and the client already has
//     its own answer for each one (`store/record.ts`'s `NO_PROGRAM`, `NO_PREFS`,
//     `FIRST_WEEK`). A server-side skeleton would be a second copy of those
//     defaults, one HTTP hop away from the first.
//
// STRUCTURAL, NOT REFERENTIAL
// ---------------------------
// A row is checked for *shape* — is `at` a number, is `dayType` one of the seven
// day types — and never for whether the things it names still exist. An
// `ExerciseId` is validated as a non-empty string, exactly as `ids.ts` validates
// it, and deliberately not against the exercise library.
//
// That line was drawn by a real defect. #56's review found `resolveLog` throwing
// on an exercise id the library no longer carried, which on the Log screen blanks
// five weeks of history over one unrenderable row. The library is the app's and
// it changes; the session is the athlete's and it happened. A stored id that has
// dropped out of the library is stale content, not a malformed row, and refusing
// to store it would lose the record of a session that was genuinely trained.
//
// THE KEY IS DERIVED, THEN CROSS-CHECKED
// --------------------------------------
// Every collection has a `getKey` in `store/collections.ts`, and `keyOf` below is
// its server-side twin. A write carries both the key and the row, and the two
// must agree: the client picks the key, the server re-derives it, and a
// disagreement is a rejection. Without that check a client bug could file one
// session under two keys, and last-write-wins per row key cannot merge two rows
// that never collide.
//
// THE NAMES ARE THE GLOSSARY'S
// ----------------------------
// ADR 0014 assigned this module the rename: `workouts` is **`sessions`** and
// `assessment` is **`baseline`**, both old names being the first word on their
// term's _Avoid_ list. `log` is not here at all — #12 dropped it and
// `lib/types.ts` deleted `LogEntry`; `defaultState()` was the stale half.
import { z } from 'zod';
import { SELF_CHECK_BANDS } from '$lib/content/logic';
import { BODY_AREAS, DAY_TYPE_IDS, GRIPS, REHAB_STAGES, VERDICT_IDS } from '$lib/content/types';
import {
	type ExerciseId,
	type OverrideKey,
	parseExerciseId,
	parseOverrideKey,
	parseSlotKey,
	parseTaskKey,
	parseWeekdayKey,
	parseWeekId,
	type SlotKey,
	type TaskKey,
	type WeekdayKey,
	type WeekId,
} from '$lib/ids';
import { EQUIPMENT, FOCUSES, GOALS, LEVELS } from '$lib/types';

/** The fixed key every singleton collection files its one row under. Mirrors
 *  `SINGLETON_KEY` in `store/collections.ts`; declared again rather than imported
 *  because the server must not pull in a module that constructs `localStorage`
 *  collections at import time. */
const ONLY = 'only';

// ------------------------------------------------------------- branded ids
//
// `ids.ts` already owns "this string, from untrusted input, is that identity" —
// one `parse*` per brand. These wrap them so a validated row comes out branded
// rather than as a bare string, which is what keeps the identity discipline (#20)
// intact across the wire rather than only inside the client.

const id = {
	week: z.custom<WeekId>((v) => parseWeekId(v) !== null, 'not a week id'),
	weekday: z.custom<WeekdayKey>((v) => parseWeekdayKey(v) !== null, 'not a weekday key'),
	exercise: z.custom<ExerciseId>((v) => parseExerciseId(v) !== null, 'not an exercise id'),
	task: z.custom<TaskKey>((v) => parseTaskKey(v) !== null, 'not a task key'),
	slot: z.custom<SlotKey>((v) => parseSlotKey(v) !== null, 'not a slot key'),
	override: z.custom<OverrideKey>((v) => parseOverrideKey(v) !== null, 'not an override key'),
};

/** The key a singleton row must carry, and the only key its collection accepts. */
const only = z.literal(ONLY);

// ---------------------------------------------------------------- entities

const loggedSet = z.object({
	loadKg: z.number().nullable(),
	edgeMm: z.number().nullable(),
	workSec: z.number().nullable(),
	reps: z.number().nullable(),
	restSec: z.number().nullable(),
	rpe: z.number().nullable(),
	grip: z.enum(GRIPS).nullable(),
	done: z.boolean(),
});

const loggedExercise = z.object({
	exercise: id.exercise,
	variant: z.number().int().min(0),
	sets: z.array(loggedSet),
});

/** ISO calendar date, `YYYY-MM-DD`. The identity of a session, and the reason a
 *  string sort is a date sort (ADR-0003). */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'not an ISO calendar date');

/** Epoch milliseconds. Non-negative and finite: it is a row key as well as a
 *  timestamp, and `NaN` as a primary key is a row that can never be addressed. */
const epochMs = z.number().int().min(0);

const session = z.object({
	at: isoDate,
	weekday: id.weekday,
	dayType: z.enum(DAY_TYPE_IDS),
	exercises: z.array(loggedExercise),
	note: z.string(),
	durationMin: z.number().optional(),
});

const selfCheck = z.object({
	at: epochMs,
	area: z.enum(BODY_AREAS),
	score: z.number(),
	band: z.enum(SELF_CHECK_BANDS),
});

const loggedReadinessCheck = z.object({
	at: epochMs,
	verdict: z.enum(VERDICT_IDS),
	score: z.number(),
	answers: z.record(z.string(), z.number()).optional(),
	// `severity` and `area` are the content library's own vocabulary rather than
	// the app's, and a flag is a snapshot of what was surfaced at the time. Left
	// as strings for that reason: a flag whose id the library has since retired is
	// still a true record of the check.
	flags: z
		.array(z.object({ id: z.string(), severity: z.string(), area: z.string().optional() }))
		.optional(),
	outcome: z.number().optional(),
});

const bodyweightReading = z.object({ at: epochMs, kg: z.number() });

const override = z.object({
	variant: z.number().int().min(0).optional(),
	sets: z.number().optional(),
	reps: z.number().optional(),
	loadKg: z.number().optional(),
	edgeMm: z.number().optional(),
	workSec: z.number().optional(),
	restSec: z.number().optional(),
	rpe: z.number().optional(),
});

const weekdayTemplate = z.object({
	dayType: z.enum(DAY_TYPE_IDS),
	exercises: z.array(id.exercise).optional(),
	name: z.string().optional(),
});

const phase = z.object({
	name: z.string(),
	weeks: z.number().int().min(1),
	intensity: z.number(),
	volume: z.number(),
	deload: z.boolean(),
});

/** Both maps are sparse by nature and typed `Partial` upstream — a weekday with
 *  no entry runs its built-in day type, an exercise with no override runs the
 *  variant's built-in target. A record with branded keys is assignable to that
 *  `Partial`, so the sparseness survives validation. */
const program = z.object({
	weeks: z.number().int().min(1),
	template: z.record(id.weekday, weekdayTemplate),
	overrides: z.record(id.override, override),
	phases: z.array(phase),
	autoProgress: z.boolean(),
});

const baseline = z.object({
	goal: z.enum(GOALS),
	focus: z.enum(FOCUSES),
	level: z.enum(LEVELS),
	daysPerWeek: z.number().int().min(0).max(7),
	bodyweight: z.number().nullable(),
	equipment: z.array(z.enum(EQUIPMENT)),
	boulderGrade: z.string().nullable(),
	routeGrade: z.string().nullable(),
	niggle: z.boolean(),
	synovitis: z.boolean(),
	birthDate: isoDate.nullable(),
	sessionMinutes: z.number().nullable(),
	completedAt: z.string(),
});

const rehab = z.object({
	area: z.enum(BODY_AREAS),
	stage: z.enum(REHAB_STAGES),
	startedAt: z.string(),
	previous: program,
});

// ----------------------------------------------------------- the registry

/** One collection's contract: what a row of it looks like, and what its key is.
 *
 *  `keyOf` is the server's copy of the collection's `getKey`, and
 *  `tests/recordRows.test.ts` holds them together two ways: the registry names
 *  exactly the fifteen collections `createRecordStore()` builds, and each one's
 *  two derivations are run over the same row and required to agree. The second
 *  assertion arrived late: for two tickets only the *names* were checked, so a
 *  `getKey` could move without its twin and nothing failed. */
interface CollectionSpec<Row> {
	readonly row: z.ZodType<Row>;
	readonly keyOf: (row: Row) => string;
}

function spec<Row>(row: z.ZodType<Row>, keyOf: (row: Row) => string): CollectionSpec<Row> {
	return { row, keyOf };
}

/** A singleton collection: one row, or none, under a fixed key. A nullable
 *  singleton is spelled as an absent row and never as a row holding `null`. */
function singleton<Row extends { id: typeof ONLY }>(row: z.ZodType<Row>): CollectionSpec<Row> {
	return spec(row, () => ONLY);
}

// The registry is heterogeneous by construction — fifteen row types under one
// map — and the variance is contained here. Everything public below takes
// `unknown` in and hands `unknown` out, so no caller ever sees an `any`.
// biome-ignore lint/suspicious/noExplicitAny: see above
const COLLECTIONS: Readonly<Record<string, CollectionSpec<any>>> = {
	currentWeek: singleton(z.object({ id: only, week: id.week })),
	program: singleton(z.object({ id: only, program })),
	baseline: singleton(z.object({ id: only, baseline })),
	rehab: singleton(z.object({ id: only, rehab })),
	prefs: singleton(
		z.object({
			id: only,
			weight: z.enum(['kg', 'lb']),
			length: z.enum(['mm', 'in']),
			// Two switches, not one `notify` (#75): a local notification this device
			// raises, and a push the server sends. Different permission stories,
			// different failure modes, so they are never one field.
			cueNotices: z.boolean(),
			dailyNotice: z.boolean(),
			// An IANA zone, checked as a string for the same reason `locale` is: the
			// zone database moves, and a name this Node build has not heard of is a
			// preference that has outlived a release rather than a malformed row.
			// Null is the account never having reported one — the daily job's cue to
			// skip it rather than to guess an hour.
			timeZone: z.string().nullable(),
			// A locale the app no longer ships is not malformed — it is a preference
			// that now falls back to the device. Checked as a string, resolved by
			// `store/locale.ts`.
			locale: z.string().nullable(),
		}),
	),
	swaps: spec(
		z.object({ exercise: id.exercise, variant: z.number().int().min(0) }),
		(r) => r.exercise,
	),
	slotDayType: spec(z.object({ slot: id.slot, dayType: z.enum(DAY_TYPE_IDS) }), (r) => r.slot),
	slotExercises: spec(z.object({ slot: id.slot, exercises: z.array(id.exercise) }), (r) => r.slot),
	taskSwaps: spec(z.object({ task: id.task, variant: z.number().int().min(0) }), (r) => r.task),
	taskDone: spec(z.object({ task: id.task, done: z.boolean() }), (r) => r.task),
	sessions: spec(session, (r) => r.at),
	readinessLog: spec(loggedReadinessCheck, (r) => String(r.at)),
	selfCheckLog: spec(selfCheck, (r) => String(r.at)),
	bodyweight: spec(bodyweightReading, (r) => String(r.at)),
	// Keyed by the athlete's own name for the program — a display string used as
	// an identity, which ADR 0003 argues against. `store/collections.ts` carries
	// the full note: `SavedProgram` has no id to key on, and minting one is the
	// Program page ticket's to do.
	savedPrograms: spec(z.object({ name: z.string().min(1), program }), (r) => r.name),
};

/** Every collection name the write path accepts, in the order a hydrate returns
 *  them. Exported for the endpoint's empty-record response and for the test that
 *  holds this registry against `createRecordStore()`. */
export const COLLECTION_NAMES: readonly string[] = Object.keys(COLLECTIONS);

/** Whether `name` is a collection of the training record. */
export function isCollection(name: string): boolean {
	return Object.hasOwn(COLLECTIONS, name);
}

/** A row that passed, ready to store, or the reason it did not.
 *
 *  The reason is returned rather than thrown: one write of a batch failing is a
 *  normal outcome that the other writes survive, and the client is told which
 *  row and why. */
export type RowCheck =
	| { readonly ok: true; readonly row: unknown }
	| { readonly ok: false; readonly reason: string };

/**
 * Check one row of one collection, against the key it is being filed under.
 *
 * Three ways to fail, in order: an unknown collection, a row of the wrong shape,
 * and a row whose own key is not the key it arrived under.
 */
export function sanitizeRow(collection: string, key: string, data: unknown): RowCheck {
	const found = COLLECTIONS[collection];
	if (!found) return { ok: false, reason: `unknown collection "${collection}"` };

	const parsed = found.row.safeParse(data);
	if (!parsed.success) {
		const first = parsed.error.issues[0];
		const at = first?.path.length ? `${first.path.join('.')}: ` : '';
		return { ok: false, reason: `${at}${first?.message ?? 'malformed row'}` };
	}

	const derived = found.keyOf(parsed.data);
	if (derived !== key) {
		return { ok: false, reason: `key "${key}" does not match the row's own key "${derived}"` };
	}

	return { ok: true, row: parsed.data };
}
