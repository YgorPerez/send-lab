// Chapter III — the readiness check.
//
// The check is nine questions with four options apiece, plus a "why we ask" and a
// study behind most of them. Rendered flat that is the densest thing on `/`, and
// it is the part of this direction that had to be genuinely re-thought rather
// than re-spaced.
//
// It renders in two states, and both are real:
//
//   * **Answered** (the default, because the fixture's check is complete) — a
//     transcript. One line per question: what was asked, what was answered. The
//     options, the rationale and the study sit behind that line, one tap away.
//     Nothing in the fixture is unreachable.
//   * **Re-checking** — one question at a time, filling the screen. This is the
//     direction's actual claim about the check, and `td_recheck` is how you get
//     to see it. Answering advances; there is no submit.
//
// The transcript is what makes the sequence honest. A stepper on its own would
// render one ninth of the fixture and call it progressive disclosure.
import { useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { QuizFixture, TodayFixture } from '../../prototype-fixtures';
import { Chapter, Disclose, Rule } from '../Editorial';
import { Prose } from '../Prose';

/** The studies the readiness questions actually cite. Resolved through an
 *  explicit map rather than by building a message key from the id: the key set is
 *  a compile-time fact and a dynamic lookup would fail silently in one locale. */
const STUDY_TITLE: Record<string, () => string> = {
	sleep: () => m.study_sleep_title(),
	prs: () => m.study_prs_title(),
	hooper: () => m.study_hooper_title(),
	illness: () => m.study_illness_title(),
};

const DIMENSION: Record<string, () => string> = {
	sleep: () => m.rd_sleep(),
	fatigue: () => m.rd_fatigue(),
	soreness: () => m.rd_soreness(),
	stress: () => m.rd_stress(),
	mood: () => m.rd_mood(),
};

const OUTCOMES = [
	{ v: 0, label: () => m.rd_outcome_bailed() },
	{ v: 1, label: () => m.rd_outcome_flat() },
	{ v: 2, label: () => m.rd_outcome_ok() },
	{ v: 3, label: () => m.rd_outcome_strong() },
];

const VS_BASELINE: Record<TodayFixture['vsBaseline'], () => string> = {
	below: () => m.rd_vs_below(),
	usual: () => m.rd_vs_usual(),
	above: () => m.rd_vs_above(),
};

function OptionList({
	question,
	answer,
	onPick,
	large,
}: {
	question: QuizFixture;
	answer: number | null;
	onPick: (v: number) => void;
	large?: boolean;
}) {
	return (
		<ul className="divide-y divide-line border-line border-t border-b">
			{question.options.map((o) => {
				const chosen = o.value === answer;
				return (
					<li key={o.value}>
						<button
							type="button"
							onClick={() => onPick(o.value)}
							aria-pressed={chosen}
							className={`flex w-full items-center gap-3 py-3 text-left ${
								large ? 'text-[19px]' : 'text-[15px]'
							} ${chosen ? 'text-flag' : 'text-ink-dim'}`}
						>
							<span aria-hidden="true" className="w-4 flex-none">
								{chosen ? '—' : ''}
							</span>
							<span>{o.label}</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

function Rationale({ question }: { question: QuizFixture }) {
	if (!question.why && !question.study) return null;
	return (
		<div className="mt-3">
			<Disclose label={m.c_why()}>
				{question.why ? (
					<p className="text-[13px] text-ink-dim">
						<Prose>{question.why}</Prose>
					</p>
				) : null}
				{question.study && STUDY_TITLE[question.study] ? (
					<p className="mt-2 text-[13px] text-ink-faint">
						{m.rd_evidence()} · {STUDY_TITLE[question.study]()}
					</p>
				) : null}
			</Disclose>
		</div>
	);
}

/** One answered question in the transcript. Closed it is two lines; open it is
 *  everything the fixture holds about that question. */
function TranscriptRow({
	question,
	answer,
	onPick,
}: {
	question: QuizFixture;
	answer: number | null;
	onPick: (v: number) => void;
}) {
	const [open, setOpen] = useState(false);
	const chosen = question.options.find((o) => o.value === answer);
	return (
		<li className={question.sub ? 'border-line border-l pl-4' : ''}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				className="w-full py-4 text-left"
			>
				<span className="block text-[13px] text-ink-dim">{question.question}</span>
				<span className="mt-1 block font-display text-[19px] text-ink">{chosen?.label ?? '—'}</span>
			</button>
			{open ? (
				<div className="pb-5">
					<p className="c-eyebrow mb-2">{m.c_options()}</p>
					<OptionList question={question} answer={answer} onPick={onPick} />
					<Rationale question={question} />
				</div>
			) : null}
		</li>
	);
}

export function Check({ today, index }: { today: TodayFixture; index: number }) {
	const [answers, setAnswers] = useState<Record<string, number | null>>(() =>
		Object.fromEntries(today.questions.map((q) => [q.id, q.answer])),
	);
	// `null` = the transcript; a number = the question the stepper is on.
	const [step, setStep] = useState<number | null>(null);
	const [outcome, setOutcome] = useState<number | null>(null);

	const total = today.questions.length;

	function pick(id: string, value: number) {
		setAnswers((a) => ({ ...a, [id]: value }));
	}

	if (step != null) {
		const q = today.questions[step];
		return (
			<Chapter id="check" index={index} label={m.c_ch_check()}>
				<p className="c-eyebrow">{m.c_step({ n: step + 1, total })}</p>
				<h2 className="c-display mt-4 text-[clamp(1.6rem,7.5vw,2.25rem)]">{q.question}</h2>
				<div className="mt-8">
					<OptionList
						question={q}
						answer={answers[q.id] ?? null}
						large
						onPick={(v) => {
							pick(q.id, v);
							setStep(step + 1 < total ? step + 1 : null);
						}}
					/>
				</div>
				<Rationale question={q} />
				<button
					type="button"
					onClick={() => setStep(null)}
					className="c-eyebrow mt-10 self-start text-ink-dim"
				>
					{m.btn_close()}
				</button>
			</Chapter>
		);
	}

	return (
		<Chapter id="check" index={index} label={m.c_ch_check()}>
			<div className="flex items-end gap-4">
				<span className="c-numeral text-[3rem] text-ink">{today.score}</span>
				<span className="pb-1 text-[13px] text-ink-dim">
					{m.rd_score()}
					<br />
					{VS_BASELINE[today.vsBaseline]()}
				</span>
			</div>

			<div className="mt-8 flex flex-col gap-2">
				{today.breakdown.map((b) => (
					<div key={b.id} className="flex items-center gap-3">
						<span className="w-24 flex-none text-[13px] text-ink-dim">
							{DIMENSION[b.id]?.() ?? b.id}
						</span>
						<span className="h-px flex-1 bg-line">
							<span className="block h-px bg-flag" style={{ width: `${(b.value / 10) * 100}%` }} />
						</span>
						<span className="w-6 flex-none text-right text-[13px] tabular-nums text-ink-faint">
							{b.value}
						</span>
					</div>
				))}
			</div>

			<p className="mt-6 text-[13px] leading-relaxed text-ink-dim">
				{today.scoreNote === 'tuned' ? m.rd_note_tuned() : m.rd_note_heuristic()}
			</p>

			<Rule className="mt-10" />

			<p className="c-eyebrow mt-6">{m.log_rd_responses()}</p>
			<ul className="mt-2 divide-y divide-line">
				{today.questions.map((q) => (
					<TranscriptRow
						key={q.id}
						question={q}
						answer={answers[q.id] ?? null}
						onPick={(v) => pick(q.id, v)}
					/>
				))}
			</ul>

			<button
				type="button"
				onClick={() => setStep(0)}
				className="mt-6 self-start border-ink border-b font-display text-[17px] text-ink"
			>
				{m.td_recheck()}
			</button>

			{today.awaitingOutcome ? (
				<div className="mt-12">
					<p className="font-display text-[21px] text-ink">{m.rd_outcome_q()}</p>
					{outcome == null ? (
						<ul className="mt-3 divide-y divide-line border-line border-t border-b">
							{OUTCOMES.map((o) => (
								<li key={o.v}>
									<button
										type="button"
										onClick={() => setOutcome(o.v)}
										className="w-full py-3 text-left text-[17px] text-ink-dim"
									>
										{o.label()}
									</button>
								</li>
							))}
						</ul>
					) : (
						<p className="mt-3 text-[15px] text-flag">{m.rd_outcome_saved()}</p>
					)}
				</div>
			) : null}
		</Chapter>
	);
}
