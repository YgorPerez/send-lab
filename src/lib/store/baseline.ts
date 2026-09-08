// The write half of an intake: the baseline, and the program it generates.
//
// The second module of its kind, after `store/prefs.ts`, and it follows that
// one's rule for the same reason: **wait for the hydrate, then update or
// insert.** With no row yet there is nothing to update, and a singleton
// collection throws on an `insert` over a key it already holds — so "is there a
// baseline" has to be answered against the hydrated store rather than against an
// empty one.
//
// **What the await buys, precisely, and what it does not.** It makes that
// question answerable, so the write lands as an update instead of throwing. It
// does *not* protect the account's existing baseline: an update replaces it, and
// so does the `program` write below, which takes the athlete's slot and phase
// edits with it. That is correct — replacing them is what redoing a baseline
// means, and the screen calling this has just shown the athlete the week that
// replaces theirs. What must not happen is reaching here *without* the athlete
// having asked for a redo, and the guard against that is one layer up:
// `useRecordSettled` is what stops Welcome seeding a blank draft, and Today
// offering an intake, on an account whose record has simply not arrived yet.
//
// It is three rows and not one, and they are written in an order that means
// something.
//
// WHY THE PROGRAM IS WRITTEN HERE AND NOT GENERATED ON READ
// ---------------------------------------------------------
// `generateProgram` is a pure function of the baseline, so the program could in
// principle be derived at render and never stored. It is stored because the
// athlete edits it: the Week and Program pages exist to change a slot's day type,
// swap an exercise and reshape the phases, and a program re-derived from the
// baseline on every read would throw all of that away the next time the page
// mounted. The baseline is the intake; the program is a thing that then has its
// own history.
//
// WHY THE BLOCK RESTARTS AT WEEK 1
// --------------------------------
// A generated program is a new block, and its first phase is week 1 of it — which
// is what the proposal the athlete just accepted says on screen. An account with
// no `currentWeek` row already reads as week 1 (`store/record.ts`), so this only
// does anything on a redo; and on a redo it is the difference between the
// promise on the proposal and what Today shows the next morning. Written
// explicitly rather than left to the fallback, because "the absence of a row
// happens to mean the right thing" is not a decision, and a redo is the case
// where the absence is not there to lean on.

import type { Content } from '$lib/content/types';
import { asWeekId } from '$lib/ids';
import { generateProgram } from '$lib/programGen';
import type { Baseline, Program } from '$lib/types';
import {
	type BaselineRow,
	type CurrentWeekRow,
	type ProgramRow,
	SINGLETON_KEY,
} from './collections';
import { recordStore, recordSync } from './record';

/** The week a fresh block starts on. */
const FIRST_WEEK = asWeekId(1);

/**
 * The program a baseline generates.
 *
 * Exported because the proposal screen shows it *before* it is stored: the
 * athlete is shown the week the program actually runs, not a second derivation of
 * the same answers that could disagree with it (`screens/welcome.ts`).
 *
 * **It prescribes no starting load, on six of the seven weighted exercises.**
 * `generateProgram` used to seed one per exercise from the baseline **tests** —
 * the marker readings — and `CONTEXT.md` marks Marker *Leaving*: the rebuild
 * stopped tracking tested numbers, so the only field the old third intake step
 * collected that survives is bodyweight, which is not a test. #87 deleted the
 * table once nothing could feed it.
 *
 * What fills the gap is nothing, and that is worth saying plainly because the
 * comment here used to claim otherwise. It read "the variant's own built-in
 * target plus `autoProgress`", and neither half holds. Exactly one variant in the
 * library carries a `loadKg` (`pull`, `content/exercises.ts`), so the built-in
 * target covers one exercise in seven. And `autoProgress` is a flag, not a
 * number: what it switches on is `loadPct`, which resolves `progression.ts`'s
 * weekly rate to a *percentage* and scales the prescribed range by it. A
 * percentage of nothing is nothing, so progression cannot move load on the other
 * six at all.
 *
 * [#88](https://github.com/YgorPerez/send-lab/issues/88) is what closes it: Train
 * asks at first contact and stores the answer in its own collection, keyed
 * exercise *and* variant. Until then the athlete meets an empty load field.
 */
export function programFor(content: Content, baseline: Baseline): Program {
	return generateProgram(content, baseline);
}

/**
 * Record the baseline and the program it generated.
 *
 * Resolves once all three rows are in the store. The caller does not have to
 * await it to show the athlete something — the collections are live — but
 * the intake does, because what it does next is navigate to a screen that reads
 * them.
 *
 * The program goes in **before** the baseline, and the order is the point: the
 * baseline is what every screen reads as "this account has taken an intake",
 * so writing it first would open a frame in which an account that has is still
 * running the built-in week.
 */
export async function writeBaseline(baseline: Baseline, program: Program): Promise<void> {
	const sync = recordSync();
	// Signed out there is nothing to wait for: the rows are local-only, and there
	// is no server copy for a local insert to beat.
	if (sync) await sync.settled();

	const store = recordStore();
	upsert<ProgramRow>(store.program, { program });
	upsert<CurrentWeekRow>(store.currentWeek, { week: FIRST_WEEK });
	upsert<BaselineRow>(store.baseline, { baseline });
}

/** As much of a singleton collection as `upsert` touches.
 *
 *  Written out rather than imported: the library's own `Collection` type is
 *  generic over four more parameters and intersected with a marker type, and
 *  naming that here would make this module's shape a function of an internal
 *  detail of a pre-1.0 dependency — the same reason `store/record.ts` spells out
 *  its `Rows` instead of deriving it from `RecordStore`. */
interface Singleton<Row> {
	has: (key: string) => boolean;
	insert: (row: Row) => unknown;
	update: (key: string, updater: (draft: Row) => void) => unknown;
}

/** Update the singleton row, or insert it.
 *
 *  The row type is given explicitly at each call rather than inferred, because
 *  `Omit<Row, 'id'>` is not an inference site and TypeScript otherwise resolves
 *  `Row` to the constraint and rejects all three collections.
 *
 *  `store/prefs.ts` is the one caller that cannot use this — a preference patch
 *  is partial, so its insert has to fill the other fields in from `NO_PREFS` —
 *  and it says so. Everything else writing a singleton wants exactly this, and
 *  writing the branch out per collection is how the third one gets it wrong. */
function upsert<Row extends { id: string }>(
	collection: Singleton<Row>,
	fields: Omit<Row, 'id'>,
): void {
	if (collection.has(SINGLETON_KEY)) {
		collection.update(SINGLETON_KEY, (draft) => {
			Object.assign(draft, fields);
		});
	} else {
		collection.insert({ id: SINGLETON_KEY, ...fields } as Row);
	}
}
