// The session in progress on the Train screen — #59's second draft.
//
// The athlete's working copy: the sets as they are being filled in, the note, the
// duration. It lived only in `useState` until now, so a reload in the gym threw
// all of it away — and on Android a reload is one accidental pull-to-refresh away
// (#54, suppression owned by #27).
//
// NOT A SESSION, WHICH IS WHY IT IS A DRAFT
// -----------------------------------------
// `CONTEXT.md` is precise: a **Session** is *"the training actually done in one
// slot on one calendar date"* — history, not a plan. This is neither. It is what
// will become one if the athlete submits it, so it is named for the session it is
// a draft of, and it is ephemeral by ADR 0008: local-only, never synced, never
// account data. The moment it becomes real it is a row in the `sessions`
// collection and this is discarded.
//
// SCOPED BY SLOT, NOT BY DAY
// --------------------------
// A **Slot** is one weekday of one training week, and it is the unit the screen
// resolves against. Restoring last Thursday's half-filled sets onto this Thursday
// would be the app inventing training that did not happen — a far worse failure
// than losing a draft, and the reason the scope is the sharper of the two.
//
// WHY THE WHOLE WORKING COPY, RATHER THAN JUST WHAT WAS TYPED
// ----------------------------------------------------------
// Storing only the athlete's edits would mean re-resolving the prescription on
// restore and merging the edits back onto it. That is precisely what `train.tsx`
// already refuses to do while a session is open — *"re-resolving it under them
// while they are logging sets would move the targets mid-session"* — so the
// resolved copy is what is worth keeping. The cost is that the stored shape
// follows `PrescribedTask`, which is what `:v1` in the key is for: when that
// shape changes, the old draft is ignored rather than crashing the screen.
import { useCallback } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { ephemeralKey, inScope, isRecord, type Scoped, scoped } from '$lib/ephemeral';
import type { SlotKey } from '$lib/ids';
import type { PrescribedTask } from '$lib/screens/train';

const KEY = ephemeralKey('sessionDraft', 1);

/** What the athlete has in front of them, mid-session. */
export interface SessionDraft {
	readonly tasks: PrescribedTask[];
	/** How the session felt, in their own words. */
	readonly note: string;
	/** Minutes, as typed — a string because it is an input the athlete is still
	 *  editing, and `''` is a real state that `0` is not. */
	readonly duration: string;
}

/**
 * The draft to open the screen with: the stored one if it belongs to this slot
 * and is usable, otherwise what the resolver just produced.
 */
export function restoredSession(
	stored: Scoped<SessionDraft> | undefined,
	slot: SlotKey,
	fresh: SessionDraft,
): SessionDraft {
	const draft = inScope(stored, slot);
	return isDraft(draft) ? draft : fresh;
}

/**
 * Persist the working copy for one slot.
 *
 * A sink, like the timer's: `tasks` is React state that changes on every
 * keystroke, and reading it back out of storage would race the writes. The source
 * is `restoredSession()`, read once at mount.
 *
 * Cross-tab sync stays **on** — unlike the timer, there is no clock for a second
 * tab to fight over, and two tabs open on the same session should agree about
 * which sets are done.
 */
export function useSessionDraft(): [
	Scoped<SessionDraft> | undefined,
	(slot: SlotKey, draft: SessionDraft) => void,
] {
	const [stored, setStored] = useLocalStorageState<Scoped<SessionDraft> | undefined>(KEY, {
		defaultValue: undefined,
	});
	// Stable, for the same reason as the timer's: the caller writes from an effect
	// keyed on it, and a fresh arrow each render would write on every render
	// rather than on every edit.
	const persist = useCallback(
		(slot: SlotKey, draft: SessionDraft) => setStored(scoped(slot, draft)),
		[setStored],
	);
	return [stored, persist];
}

/**
 * Storage is parsed, not trusted.
 *
 * The envelope is checked rather than every field of every task: `PrescribedTask`
 * has eleven, several of them nested, and a validator that deep-checked them all
 * would be a second declaration of the type to keep in step — the drift ADR 0014
 * exists to stop. What is checked is what the screen *dereferences* on render —
 * `t.key` and `t.sets` — because one bad row there is a crash, and a draft is not
 * worth a crash. Anything subtler than that is `:v1`'s job.
 *
 * Note the deliberate absence of truthiness tests: `''` for a cleared note and
 * `[]` for a task list the athlete emptied are both real states, and a draft that
 * quietly reverted them would be losing work rather than protecting it.
 */
function isDraft(value: unknown): value is SessionDraft {
	if (!isRecord(value)) return false;
	if (typeof value.note !== 'string' || typeof value.duration !== 'string') return false;
	if (!Array.isArray(value.tasks)) return false;
	return value.tasks.every(
		(task: unknown) => isRecord(task) && typeof task.key === 'string' && Array.isArray(task.sets),
	);
}
