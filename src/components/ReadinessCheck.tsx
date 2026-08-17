// The readiness check, as a bench form.
//
// The adaptive half is real, not staged: the visible questions are recomputed
// from the athlete's own answers through `visibleQuestionsOrdered()`, so
// answering "Nothing" to *Anything hurting today?* actually removes the
// severity follow-up, and going flat on recovery actually reveals stress and
// drive. That is the behaviour `/` most needs to show, and faking it with a
// fixed list would have hidden the layout problem it causes — a question
// appearing mid-scroll shifts everything under it.
//
// A follow-up is marked by a bracket in the rail rather than by an indent.
// Indenting costs horizontal space this direction does not have at 360px, and
// pt-BR question text is already the widest thing on the screen.
import { type Answers, getContent, visibleQuestionsOrdered } from '$lib/content';
import * as m from '$lib/paraglide/messages';
import { Bank, Prose } from './kit';

export function ReadinessCheck({
	answers,
	onAnswer,
}: {
	answers: Answers;
	onAnswer: (id: string, value: number) => void;
}) {
	const content = getContent();
	const visible = visibleQuestionsOrdered(answers);

	return (
		<div>
			{visible.map(({ id, sub }) => {
				const q = content.quiz.find((x) => x.id === id);
				if (!q) return null;
				const answer = answers[id] ?? null;
				return (
					<div className="border-line border-b last:border-b-0" key={id}>
						<div className="flex items-start gap-2 px-3 pt-2 pb-1.5">
							{sub ? (
								<span aria-hidden="true" className="mt-0.5 text-[13px] text-ink-faint leading-none">
									└
								</span>
							) : null}
							<div className="min-w-0 flex-1">
								<div className="text-[14px] text-ink leading-snug tracking-normal">{q.q}</div>
								{q.why ? (
									<details className="mt-1">
										<summary className="lbl cursor-pointer list-none text-ink-faint">
											{m.rd_evidence()}
											{q.study ? ` · ${q.study}` : ''}
										</summary>
										<Prose className="mt-1 text-[13px]">{q.why}</Prose>
									</details>
								) : null}
							</div>
							{/* The raw 0–10 value the answer carries. It is what the score is
							    actually computed from, and printing it is the difference between
							    a quiz and an instrument. */}
							<span className="num shrink-0 text-[15px] text-ink-faint tabular-nums">
								{answer == null ? '--' : String(answer).padStart(2, '0')}
							</span>
						</div>
						<Bank
							name={id}
							onSelect={(v) => onAnswer(id, v)}
							options={q.a.map((o) => ({ label: o.t, value: o.v }))}
							value={answer}
						/>
					</div>
				);
			})}
		</div>
	);
}
