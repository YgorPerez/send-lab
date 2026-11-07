// The readiness check: the daily questionnaire, in `CONTEXT.md`'s words, and
// never "the quiz".
//
// A full-height sheet that asks one question at a time (#116, spec #113). It was
// a block of six to nine stacked option lists near the foot of Today, each with a
// paragraph of rationale, and the athlete scrolled past the input the verdict
// needs to reach everything else. Now Today shows an invitation or a one-line
// summary, and the questions live here.
//
// What it decides, and where:
//
//   1. Which question comes next is `lib/readinessFlow.ts`, a pure function of
//      the answers. A follow-up joins the check as its own step only while an
//      answer calls for it, so the rail can grow by a segment mid-check: that
//      is the check staying as short as the glossary promises, said honestly.
//   2. Picking an answer moves on. On the last step it does not: the pick stays
//      on screen, and the advance ("Done") closes the sheet, so the verdict the
//      athlete sees next is one they watched themselves finish.
//   3. Nothing is preselected (ADR 0021): the body is the only instrument for a
//      reading, so each step opens with no option pressed and its advance waits
//      for one, saying so. Closing the sheet is always there instead, and keeps
//      what was answered.
//   4. "Why we ask" is collapsed under the question. Shown in full it lengthened
//      every step; hidden behind a page it would cost the thing that makes the
//      check read as a coach rather than a form. A disclosure under the question
//      keeps it one tap away and out of the way.
//
// The answers are not held here. Today holds them (`readinessDraft`, idiom 2)
// and re-runs `computeReadiness` against them, so the verdict behind the sheet
// moves with every pick and is already there when the sheet closes. Which step
// is showing is the sheet's own state, and it starts fresh on every open, at
// `openingStep`: the first unanswered question, or the first question when the
// check is finished and being edited.
import { Dialog } from '@base-ui/react/dialog';
import { ChevronDown, ExternalLink, X } from 'lucide-react';
import { useId, useState } from 'react';
import type { Answers } from '$lib/content';
import * as m from '$lib/paraglide/messages';
import { checkSteps, openingStep, stepAfter, stepBefore } from '$lib/readinessFlow';
import type { Question } from '$lib/screens/today';
import { STUDIES } from '$lib/studies';
import { Stepper } from './ui/Stepper';
import { option } from './ui/variants';

const studyUrl = (id?: string) => (id ? STUDIES.find((s) => s.id === id)?.url : undefined);

/** Focus a step's question as it arrives, so a keyboard or a screen reader is
 *  taken to the new question rather than left on the option that just went. */
const focusOnArrival = (el: HTMLElement | null) => el?.focus({ preventScroll: true });

/**
 * The sheet. Open and closed by Today, which also holds the answers.
 *
 * On a phone it rises from the bottom edge and takes the height of the screen,
 * like More's sheet; from `lg` it is a dialog of phone width centred in the
 * window (story 32), so a question is still one column and the options are still
 * thumb-sized lines rather than 900px bars.
 */
export function ReadinessCheck({
	open,
	onOpenChange,
	questions,
	answers,
	onPick,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The check as it renders for these answers: `resolveQuestions`. */
	questions: readonly Question[];
	answers: Answers;
	onPick: (id: string, value: number) => void;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
				<Dialog.Popup
					className={
						// The phone: the bottom edge up to just under the status bar.
						'fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] bottom-0 z-50 mx-auto flex max-w-[520px] flex-col rounded-t-xl border border-b-0 border-line bg-panel pb-[env(safe-area-inset-bottom)] transition-[translate,opacity] duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full ' +
						// `lg`: centred, at phone width, a fixed height so the controls
						// do not move from one question to the next. It fades rather than
						// rises: there is no edge for it to come from.
						'lg:top-1/2 lg:right-auto lg:bottom-auto lg:left-1/2 lg:h-[min(42rem,calc(100dvh-4rem))] lg:w-100 lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-xl lg:border-b lg:pb-0 lg:data-[ending-style]:-translate-y-1/2 lg:data-[ending-style]:opacity-0 lg:data-[starting-style]:-translate-y-1/2 lg:data-[starting-style]:opacity-0'
					}
				>
					<Steps
						questions={questions}
						answers={answers}
						onPick={onPick}
						onDone={() => onOpenChange(false)}
					/>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

/**
 * The inside of the sheet. Its own component so the step is initialised when the
 * sheet opens (the popup's content mounts then) and not before: a lazy
 * `useState`, no effect to keep it in step with the answers.
 */
function Steps({
	questions,
	answers,
	onPick,
	onDone,
}: {
	questions: readonly Question[];
	answers: Answers;
	onPick: (id: string, value: number) => void;
	onDone: () => void;
}) {
	const [at, setAt] = useState(() => openingStep(answers));
	const steps = checkSteps(answers);
	// A step the answers have since withdrawn (a follow-up whose reason changed)
	// is not a step any more; the sheet goes where it would have opened.
	const current = steps.includes(at) ? at : openingStep(answers);
	const index = steps.indexOf(current);
	const q = questions.find((x) => x.id === current);
	const before = stepBefore(answers, current);
	const after = stepAfter(answers, current);
	const answered = answers[current] != null;
	const progress = m.rd_check_progress({ n: index + 1, total: steps.length });

	const pick = (value: number) => {
		onPick(current, value);
		// The pick decides what comes next (it may call for a follow-up), so the
		// next step is read off the answers *with* it.
		const next = stepAfter({ ...answers, [current]: value }, current);
		if (next) setAt(next);
	};

	return (
		<>
			{/* The title and the close on one line, as on More's sheet. */}
			<div className="flex items-center gap-2 py-1 pr-1 pl-4">
				<div className="min-w-0 flex-1">
					<Dialog.Title className="text-[15px] leading-tight font-semibold text-ink">
						{m.rd_check_title()}
					</Dialog.Title>
					{/* The rail says this to a screen reader already, as its name. */}
					<p aria-hidden="true" className="mt-0.5 text-[11px] leading-tight text-ink-faint">
						{progress}
					</p>
				</div>
				<Dialog.Close
					aria-label={m.btn_close()}
					className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink"
				>
					<X size={20} strokeWidth={1.75} aria-hidden="true" />
				</Dialog.Close>
			</div>

			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-2 pb-4">
				<Stepper
					className="flex-1"
					steps={steps.map((id) => ({ id }))}
					at={index}
					railLabel={progress}
					{...(before ? { back: { label: m.btn_back(), onClick: () => setAt(before) } } : {})}
					next={{
						label: after ? m.btn_next() : m.btn_done(),
						onClick: () => (after ? setAt(after) : onDone()),
						disabled: !answered,
						waitingFor: m.rd_check_need(),
					}}
				>
					{q ? (
						<Ask
							key={q.id}
							q={q}
							parent={parentOf(questions, q)}
							answer={answers[q.id]}
							onPick={pick}
						/>
					) : null}
				</Stepper>
			</div>
		</>
	);
}

/** The core question a follow-up hangs off, and what it was answered: the
 *  nearest question above it that is not itself a follow-up. */
function parentOf(questions: readonly Question[], q: Question): Question | undefined {
	if (!q.sub) return undefined;
	const at = questions.indexOf(q);
	return questions.slice(0, at).findLast((x) => !x.sub);
}

/** One step: the question, why it is asked, and its options as full-width lines. */
function Ask({
	q,
	parent,
	answer,
	onPick,
}: {
	q: Question;
	parent: Question | undefined;
	answer: number | undefined;
	onPick: (value: number) => void;
}) {
	const id = useId();
	const url = studyUrl(q.study);
	const parentAnswer = parent?.options.find((o) => o.value === parent.answer)?.label;
	return (
		<fieldset aria-labelledby={id} className="flex min-w-0 flex-col gap-group">
			<div>
				{/* A follow-up says what it follows. "How does it feel?" is a question
				    about the answer one step back, and the step back is off screen. */}
				{parent && parentAnswer ? (
					<p className="mb-1 text-[13px] leading-snug text-ink-faint">
						{parent.question} · <span className="text-ink-dim">{parentAnswer}</span>
					</p>
				) : null}
				<h3
					id={id}
					ref={focusOnArrival}
					tabIndex={-1}
					className="text-[21px] leading-tight font-semibold tracking-[-0.01em] text-ink outline-none"
				>
					{q.question}
				</h3>
			</div>

			{q.why ? (
				<details className="group">
					<summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 text-[13px] text-ink-dim transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
						{m.rd_why()}
						<ChevronDown
							size={16}
							strokeWidth={2}
							aria-hidden="true"
							className="transition-transform duration-200 group-open:rotate-180"
						/>
					</summary>
					<p className="pb-1 text-[13px] leading-snug text-ink-dim">
						{q.why}
						{url ? (
							<a
								href={url}
								target="_blank"
								rel="noopener noreferrer"
								className="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-ink underline decoration-line underline-offset-2"
							>
								{m.rd_evidence()}
								<ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
							</a>
						) : null}
					</p>
				</details>
			) : null}

			{/* Full-width lines, not a chip grid: every answer costs the same in both
			    languages, where a grid reflows into ragged rows the moment pt-BR runs
			    long ("Melhor que o normal"). 48px and the 15px a thumb lands on: the
			    sheet has the height to spend, and this is the whole of the step. */}
			<div className="flex flex-col gap-1.5">
				{q.options.map((o) => (
					<button
						key={o.label}
						type="button"
						aria-pressed={answer === o.value}
						onClick={() => onPick(o.value)}
						className={option({
							on: answer === o.value,
							width: 'full',
							class: 'min-h-12 px-3 text-[15px]',
						})}
					>
						{o.label}
					</button>
				))}
			</div>
		</fieldset>
	);
}
