// What a set logs, and what it starts as.
//
// A **set** is one logged effort within a session (`CONTEXT.md`) and the entity
// is `LoggedSet`. This module holds the three decisions that surround it: which
// of its seven fields an exercise actually shows, what a *first* row is prefilled
// with, and what a *later* row starts as.
//
// It exists because both were written twice — `routes/train.tsx` and
// `prototype-fixtures.ts` each carried a private `fieldsFor` and `prefilledSet`,
// and nothing made the copies agree. #56 collapsed them here rather than have
// the store hand a third copy to the screens.
//
// A prescription is a range; a logged set is a number. `midOf` is where that
// collapse happens, and it is the only place it should: the rest timer runs one
// number of seconds and a prefilled row shows one number of kilograms, and both
// of them mean "the middle of what was asked for". Keeping it here rather than
// in `format.ts` is deliberate — nothing in this module produces a string.
import type { Range, Variant } from '$lib/content/types';
import type { LoggedSet } from '$lib/types';

/** The per-set fields the logger can show, in column order. `grip` is the only
 *  one that is not a number, which is why `stats.ts` has its own `NumField`
 *  without it — a grip has nothing to plot. */
export type SetField = 'loadKg' | 'edgeMm' | 'workSec' | 'reps' | 'grip' | 'restSec' | 'rpe';

/**
 * The middle of a prescribed range, rounded — the single number something has to
 * run when a range will not do.
 *
 * `null` rather than `0` for an absent range: zero added load is a real
 * prescription, so a missing field and a zero field cannot share a value.
 */
export function midOf(r?: Range): number | null {
	return r ? Math.round((r.min + r.max) / 2) : null;
}

/**
 * Which per-set fields this exercise logs, in column order.
 *
 * Load and edge are always offered even when the variant prescribes neither:
 * weight can be added to almost anything and a different edge can be chosen for
 * anything hung from, and the athlete logs what they actually did rather than
 * what was asked. Grip is the exception — it appears only when the variant loads
 * one, because an exercise that does not grip anything has no answer to give.
 */
export function fieldsFor(prescription: Variant | undefined): SetField[] {
	const fields: SetField[] = ['loadKg', 'edgeMm', 'workSec', 'reps'];
	if (prescription?.grip) fields.push('grip');
	fields.push('restSec', 'rpe');
	return fields;
}

/**
 * A fresh set, prefilled from the prescription's midpoints — except the effort
 * rating, which is not a plan and is left empty.
 *
 * `restSec` falls back to `setRestSec` because it is the rest the athlete
 * actually takes *after* the set: a variant that alternates only within a set
 * prescribes no between-rounds rest, and showing an empty column there reads as
 * "no rest" rather than as "the set rest applies".
 *
 * **`rpe` is the one field a prescription cannot open.** Every other column
 * here is a target the athlete edits when they do something else — the load they
 * actually pulled, the reps they actually got — so opening at the midpoint saves
 * six taps and states nothing untrue. An effort rating is not a target that got
 * done, it is a *reading*, and the only instrument for it is the athlete. Filled
 * from `midOf(prescription.rpe)`, a `recruit` row opened at 9 because 8–9 was
 * what was asked for, and an untouched 9 became indistinguishable from a 9 they
 * felt — #61's bug class, one screen over (ADR 0021; #89, decided on #40). What was asked
 * for is still shown, beside the input rather than in place of the answer:
 * `SetEditor` takes a `prescribedRpe`.
 */
export function prefilledSet(prescription: Variant): LoggedSet {
	return {
		loadKg: midOf(prescription.loadKg),
		edgeMm: midOf(prescription.edgeMm),
		workSec: midOf(prescription.workSec),
		reps: midOf(prescription.reps),
		restSec: midOf(prescription.restSec ?? prescription.setRestSec),
		rpe: null,
		grip: prescription.grip ?? null,
		done: false,
	};
}

/**
 * What the *second* set of a task opens as: the one before it, again.
 *
 * A later row starts from the athlete's own last row rather than from the
 * prescription, because by then their edits are the better default — the load
 * they actually pulled, on the edge they actually used, is what the next set is
 * most likely to be too. Two fields refuse to come along, and for the same
 * reason: neither is a plan.
 *
 * `done` is obvious. **`rpe` is the one `prefilledSet` leaves empty (ADR 0021), and
 * carrying it would put the prefill straight back** — one rung further from the
 * prescription and no better sourced. An effort rating is a reading of *that*
 * set, and the third set of a hard hangboard exercise is precisely where it stops
 * matching the first; a row that opens holding set 1's 8 and is never touched
 * stores an 8 nobody felt, which is the whole of what this ticket removed.
 *
 * Here rather than inline in the route, where it was, because "what a later row
 * starts as" is the same decision `prefilledSet` makes for the first one — and
 * the route is where it could not be tested.
 */
export function nextSet(previous: LoggedSet): LoggedSet {
	return { ...previous, rpe: null, done: false };
}
