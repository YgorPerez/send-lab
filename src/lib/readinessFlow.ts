// Which question the readiness check asks next (#116, spec #113).
//
// The check is a sheet that shows one question at a time, and what "the next
// question" means is decided here rather than in the sheet, so it can be tested
// without rendering anything. Every function takes the answers so far and
// nothing else, because that is all the order depends on: the six core
// questions always, and a follow-up only while an answer calls for it
// (`visibleQuestions` in `content/logic.ts` decides which, and this file does not
// second-guess it). A follow-up comes straight after the question that revealed
// it, so "how does it feel" is asked right after "anything hurting".
//
// The list is recomputed from the answers on every call, never kept: a pick can
// add a follow-up (poor sleep adds stress and drive) or withdraw one (nothing
// hurting after all drops the severity question), and a frozen list would keep
// asking a question the last answer took away.
import type { Answers } from '$lib/content';
import { visibleQuestionsOrdered } from '$lib/content';

/** The question ids the check asks for these answers, in the order it asks them. */
export function checkSteps(answers: Answers): string[] {
	return visibleQuestionsOrdered(answers).map((q) => q.id);
}

/**
 * Where the sheet opens: the first question still unanswered, or the first
 * question when every one is answered.
 *
 * Closing the check halfway keeps what was answered (the draft does that), so
 * reopening it resumes where the athlete stopped. A finished check opens at the
 * top, because reopening it means editing it. An answer to a follow-up the
 * answers no longer ask for does not count: it is not on the list.
 */
export function openingStep(answers: Answers): string {
	const steps = checkSteps(answers);
	return steps.find((id) => answers[id] == null) ?? steps[0];
}

/**
 * The question after `id`, or `null` when `id` is the last one (or not asked
 * at all).
 *
 * Picking an answer moves here, so `answers` should already hold the pick: it
 * is the pick that decides whether a follow-up comes next. It is the next step
 * in order, not the next unanswered one, so editing a finished check walks
 * through it rather than closing on the first change.
 */
export function stepAfter(answers: Answers, id: string): string | null {
	const steps = checkSteps(answers);
	const at = steps.indexOf(id);
	return at === -1 ? null : (steps[at + 1] ?? null);
}

/** The question before `id`, or `null` on the first one (or one not asked). */
export function stepBefore(answers: Answers, id: string): string | null {
	const steps = checkSteps(answers);
	const at = steps.indexOf(id);
	return at <= 0 ? null : steps[at - 1];
}

/**
 * The one answer a follow-up asks about, or `null` when it asks about none.
 *
 * The sheet shows it above the follow-up, because "How does it feel?" is about
 * the answer one step back, which is off screen. Only the severity question has
 * one: stress and drive join the check on poor sleep *or* low recovery, and skin
 * on the whole wellness read pointing hard, so the question displayed above
 * them is where they sit, not why they are asked, and naming it would give the
 * athlete the wrong reason.
 */
export function followsFrom(id: string): string | null {
	return id === 'pain' ? 'body' : null;
}
