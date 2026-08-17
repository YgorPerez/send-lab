// The readiness check.
//
// Nine questions — five core, four revealed — each with four options and a
// one-line rationale. It is by a wide margin the tallest thing on `/`, and the
// place where "dense and calm" is hardest to hold: the questions are prose, the
// options are prose, and none of it compresses into a number.
//
// Two decisions carry it:
//
//   1. It sits *below* the verdict, not above it. The check produces the read,
//      but the athlete opens the app to see the read, not to take the quiz —
//      and once it is answered (which, on this screen, it is) it is a record.
//      Above the fold it is a one-line receipt; the form is underneath.
//   2. "Why we ask" is never hidden. It is set at 11px in faint ink and clamped
//      to two lines. Hiding it behind a disclosure would buy ~90px on this
//      screen and cost the one thing that makes the check feel like a coach
//      rather than a form.
//
// Answers are held here and reported up: `/` re-runs the *real* `computeReadiness`
// against them, so changing an answer moves the score, the verdict, the flags
// and which work the plan holds back — exactly as the app would.
import { ExternalLink } from 'lucide-react';
import type { Answers } from '$lib/content';
import * as m from '$lib/paraglide/messages';
import { STUDIES } from '$lib/studies';
import { cn } from '$lib/utils';
import type { QuizFixture } from '../prototype-fixtures';
import { option } from './ui';

const studyUrl = (id?: string) => (id ? STUDIES.find((s) => s.id === id)?.url : undefined);

function Question({
	q,
	n,
	onPick,
}: {
	q: QuizFixture;
	n: number | null;
	onPick: (id: string, v: number) => void;
}) {
	const url = studyUrl(q.study);
	return (
		<div className={cn(q.sub && 'border-l border-line pl-2.5')}>
			<div className="flex gap-1.5 text-[13.5px] leading-snug font-medium text-ink">
				<span className="num shrink-0 pt-px text-[11px] text-ink-faint">
					{q.sub ? '↳' : String(n).padStart(2, '0')}
				</span>
				<span className="min-w-0">{q.question}</span>
			</div>
			{q.why ? (
				<p className="mt-0.5 line-clamp-2 pl-[22px] text-[11px] leading-snug text-ink-faint">
					{q.why}
					{url ? (
						<a
							href={url}
							target="_blank"
							rel="noopener noreferrer"
							className="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-ink-dim underline decoration-line underline-offset-2"
						>
							{m.rd_evidence()}
							<ExternalLink size={9} />
						</a>
					) : null}
				</p>
			) : null}
			<div className="mt-1.5 flex flex-wrap gap-1.5 pl-[22px]">
				{q.options.map((o) => (
					<button
						key={o.label}
						type="button"
						aria-pressed={q.answer === o.value}
						onClick={() => onPick(q.id, o.value)}
						className={option({
							on: q.answer === o.value,
							class: 'min-w-[86px] basis-[calc(50%-3px)]',
						})}
					>
						{o.label}
					</button>
				))}
			</div>
		</div>
	);
}

export function ReadinessCheck({
	questions,
	answers,
	onPick,
}: {
	questions: QuizFixture[];
	answers: Answers;
	onPick: (id: string, v: number) => void;
}) {
	let n = 0;
	return (
		<div className="flex flex-col gap-3.5">
			{questions.map((q) => {
				if (!q.sub) n += 1;
				return (
					<Question
						key={q.id}
						q={{ ...q, answer: answers[q.id] ?? null }}
						n={q.sub ? null : n}
						onPick={onPick}
					/>
				);
			})}
		</div>
	);
}
