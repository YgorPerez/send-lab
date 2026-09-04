// A half-finished baseline, persisted locally so onboarding can be left and
// come back to.
//
// The fourth of the ephemeral stores (`lib/ephemeral.ts`) and the same shape as
// the readiness draft: `use-local-storage-state` for the mechanism (#18, 680 B),
// with the key, the shape and the scope decided here because the library has no
// opinion about any of them. What the component does with it is idiom 2 in
// `docs/component-vocabulary.md`, unchanged: one read at mount, one write keyed
// on the value.
//
// IT IS EPHEMERAL, AND THE BASELINE IS NOT
// ----------------------------------------
// The line ADR 0008 draws is that ephemeral UI never syncs and losing it costs a
// re-entry, where losing account data costs training. A *finished* baseline is
// account data and goes to `store/baseline.ts`, through the collections, to the
// server. A finished baseline is also the moment this draft is deleted. So the
// two never hold the same answers: this is the form, that is the record.
//
// THE SCOPE IS THE ACCOUNT
// ------------------------
// The other three ephemeral stores are scoped to something shorter-lived than an
// account — the readiness draft to a day, the session draft to a slot, the
// timer's setup to a protocol — and `ephemeral.ts` says why none of them is
// account-scoped, while naming the case that would change it: two athletes
// sharing a device.
//
// This is that case, and it is not hypothetical here. Onboarding is the one
// screen a *second* athlete on a shared device is guaranteed to open, because it
// is what a new account opens first — and the answers on it are a training
// history in miniature (a niggle, a grade, a bodyweight). Offering athlete A's
// half-finished intake to athlete B is the app lying in exactly the way the scope
// rule exists to prevent, and it is a worse lie than yesterday's readiness
// answers, because these are attributable.
//
// It is also the right expiry. A baseline draft must **not** expire with the day:
// the athlete who starts this on Monday night and finishes on Tuesday morning has
// not changed their goals overnight, and a day-scoped draft would silently blank
// four answered questions. It expires when the baseline is written, and when the
// account changes. Nothing else.
import type { Dispatch, SetStateAction } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { ephemeralKey, inScope, type Scoped, scoped } from '$lib/ephemeral';
import { type BaselineDraft, draftFrom, parseDraft } from '$lib/screens/welcome';
import { useActiveAccount } from '$lib/store/record';
import type { Baseline } from '$lib/types';

const KEY = ephemeralKey('baselineDraft', 1);

/** The storage scope for a draft written while signed out.
 *
 *  A plain string that could not be an `AthleteId`, for the reason
 *  `store/collections.ts` gives about its own `NO_ACCOUNT`: a sentinel that could
 *  pass for a real id is how one athlete's data ends up read as another's. The
 *  practical consequence is that a draft started before signing in does not
 *  follow the athlete into their account, which is correct — the app cannot know
 *  the two are the same person, and guessing wrong is the failure this scope
 *  prevents. */
const SIGNED_OUT = 'signed-out';

export interface BaselineDraftState {
	/** The answers to edit: the stored draft when one is in scope, otherwise a
	 *  fresh one — blank for a new account, prefilled for a redo. */
	draft: BaselineDraft;
	/** Whether `draft` came out of storage. What lets Today offer to *resume*
	 *  rather than to start, and it is read off the presence of the stored value
	 *  rather than off the answers in it: a draft whose first question is answered
	 *  and a draft that was opened and abandoned are the same object, and only
	 *  storage knows which happened. */
	resumed: boolean;
	setDraft: Dispatch<SetStateAction<BaselineDraft>>;
	/** Forget the draft. Called once the baseline is written, and the reason this
	 *  hook returns three things rather than two: the readiness draft expires on
	 *  its own when the day turns, and this one has no clock to expire against. */
	clear: () => void;
}

/**
 * The in-progress baseline, live.
 *
 * `baseline` is the account's stored one, or null. It is what a fresh draft is
 * seeded from — a redo starts from the athlete's own previous answers rather than
 * from nothing — and it is deliberately *not* consulted when a draft exists: the
 * draft is more recent by construction.
 *
 * **Which puts an obligation on the caller: do not let the athlete answer
 * anything until the record has arrived.** `null` here means both "no baseline"
 * and "`/api/state` has not answered", and the two are indistinguishable at this
 * layer. Seeded from the second, one tap persists a blank-plus-one draft — and
 * the rule above then prefers it forever, so the real previous answers are gone.
 * `Welcome` holds its whole flow behind `useRecordSettled` for exactly this, and
 * nothing else should read this hook without doing the same.
 *
 * Read by two screens. Welcome edits it; Today reads `resumed` to decide whether
 * to offer resuming. One key and one hook, so they cannot disagree.
 */
export function useBaselineDraft(baseline: Baseline | null): BaselineDraftState {
	const account = useActiveAccount();
	const scope = account ?? SIGNED_OUT;
	const [stored, setStored, { removeItem }] = useLocalStorageState<Scoped<unknown> | undefined>(
		KEY,
		{ defaultValue: undefined },
	);

	const inThisScope = inScope(stored, scope);
	// Narrowed rather than cast, every time it is read: what comes back is JSON
	// this build did not necessarily write. `parseDraft` drops anything that is
	// not an answer the form could have produced, which reads as unanswered.
	const draft = inThisScope === undefined ? draftFrom(baseline) : parseDraft(inThisScope);

	const setDraft: Dispatch<SetStateAction<BaselineDraft>> = (next) =>
		setStored((prev) => {
			// Resolved against the *stored* previous value and not against the `draft`
			// this render closed over, for the reason `readinessDraft.ts` gives: the
			// stepper sets one answer at a time as `(prev) => ({ ...prev, … })`, and
			// two picks inside one tick would otherwise both build on the same stale
			// object and the first would be lost.
			const previous = inScope(prev, scope);
			const current = previous === undefined ? draftFrom(baseline) : parseDraft(previous);
			return scoped(scope, typeof next === 'function' ? next(current) : next);
		});

	return { draft, resumed: inThisScope !== undefined, setDraft, clear: removeItem };
}
