// A partial readiness check, persisted locally so navigating away or reloading
// mid-answer does not lose it. It belongs to **one day** and resets on the next.
//
// #59 moved this off a hand-written `load`/`save` pair onto
// `use-local-storage-state` (#18's decision, 680 B). The component-side idiom
// `docs/component-vocabulary.md` describes is unchanged and is what the hook now
// provides directly: one read at mount rather than on every keystroke, and one
// write keyed on the value rather than a call at each setter. What stays in this
// module is the part the library has no opinion about — the key, the shape, and
// the fact that a draft expires with the day.
//
// The day comparison itself is `ephemeral.ts`'s `inScope`, shared with the
// session draft and the timer. It used to be written out here, and this file is
// where the bug that shape prevents actually happened: a legacy branch compared a
// stored *localized* date against a freshly formatted `today()`, which cannot
// match across a language switch (#55, ADR 0003). The scope is an ISO day for
// exactly that reason — never a label.
import type { Dispatch, SetStateAction } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import type { Answers } from '$lib/content';
import { isoToday } from '$lib/dates';
import { ephemeralKey, inScope, type Scoped, scoped } from '$lib/ephemeral';

const KEY = ephemeralKey('readinessDraft', 1);

/**
 * The athlete's in-progress answers, persisted for today only.
 *
 * `fallback` is what to show when there is no draft for today — the answers the
 * screen resolved, which for a re-check is what they last submitted.
 *
 * Cross-tab sync is left **on** here, unlike the timer: two tabs answering the
 * same questionnaire should agree, and there is no clock for a second tab to
 * fight over.
 */
export function useReadinessDraft(fallback: Answers): [Answers, Dispatch<SetStateAction<Answers>>] {
	const [stored, setStored] = useLocalStorageState<Scoped<Answers> | undefined>(KEY, {
		defaultValue: undefined,
	});

	const today = isoToday();
	const answers = effective(inScope(stored, today), fallback);

	// The updater form is resolved against the *stored* previous value, not
	// against the `answers` this render closed over. `ReadinessCheck` sets one
	// answer at a time as `(prev) => ({ ...prev, [id]: v })`, and two picks inside
	// one tick would otherwise both build on the same stale object and the first
	// would be lost.
	const setAnswers: Dispatch<SetStateAction<Answers>> = (next) =>
		setStored((prev) => {
			const current = effective(inScope(prev, today), fallback);
			return scoped(today, typeof next === 'function' ? next(current) : next);
		});

	return [answers, setAnswers];
}

/**
 * What the athlete should see: their draft, or the resolved answers.
 *
 * An empty draft is not a draft. Without this, opening the screen and touching
 * nothing would blank a re-check's previous answers — the athlete's own earlier
 * submission, replaced by `{}` because a draft technically existed.
 */
function effective(draft: Answers | undefined, fallback: Answers): Answers {
	return draft && Object.keys(draft).length > 0 ? draft : fallback;
}
