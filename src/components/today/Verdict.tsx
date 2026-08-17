// Chapter I — the verdict.
//
// This is the direction's whole argument in one screenful. The athlete opens the
// app mid-session, with chalk on their hands, and gets a sentence and a button.
// Five things used to compete for this space; four of them are now chapters II–V
// of the same page, a flick or one numeral away.
//
// What is deliberately still here and not deferred: the verdict's own advice.
// It is the only prose on `/` that changes what the athlete does in the next
// minute, and a direction that hides *that* behind a tap has not simplified the
// screen, it has emptied it.
import { Link } from '@tanstack/react-router';
import * as m from '$lib/paraglide/messages';
import type { TodayFixture } from '../../prototype-fixtures';
import { Chapter, Disclose } from '../Editorial';
import { Prose } from '../Prose';

const VS_BASELINE: Record<TodayFixture['vsBaseline'], () => string> = {
	below: () => m.rd_vs_below(),
	usual: () => m.rd_vs_usual(),
	above: () => m.rd_vs_above(),
};

export function Verdict({ today, index }: { today: TodayFixture; index: number }) {
	// The first thing the athlete is actually allowed to train: held work is not a
	// next task, and neither is something already ticked.
	const next = today.tasks.find((t) => !t.held && !t.done) ?? today.tasks.find((t) => !t.held);

	return (
		<Chapter id="verdict" index={index} label={m.c_ch_verdict()}>
			<p className="c-eyebrow mb-4">
				{m.week_label({ n: today.week })} · {today.phase.name}
			</p>

			<h1
				className="c-display text-[clamp(2rem,9.5vw,2.9rem)]"
				style={{ color: today.verdict.color }}
			>
				{today.verdict.title}
			</h1>
			<p className="mt-3 text-[15px] text-ink-dim">{today.verdict.tag}</p>

			<div className="mt-7 flex items-end gap-4">
				<span className="c-numeral text-[3.5rem] text-ink">{today.score}</span>
				<span className="pb-1 text-[13px] text-ink-dim">
					{m.rd_score()}
					<br />
					{VS_BASELINE[today.vsBaseline]()}
					{today.baseline != null ? ` · ${m.c_baseline({ n: today.baseline })}` : ''}
				</span>
			</div>

			<p className="mt-6 max-w-[38ch] text-[16px] text-ink leading-[1.5]">
				<Prose>{today.verdict.text}</Prose>
			</p>

			<div className="mt-5">
				<Disclose label={m.c_details()}>
					<ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-dim">
						{today.verdict.focus.map((f) => (
							<li key={f} className="border-line border-b pb-0.5">
								{f}
							</li>
						))}
					</ul>
				</Disclose>
			</div>

			{next ? (
				<div className="mt-9">
					<p className="text-[13px] text-ink-dim">{m.td_applies()}</p>
					<p className="c-eyebrow mt-4">{m.td_next_task()}</p>
					<p className="mt-1 font-display text-[22px] text-ink">{next.label}</p>
				</div>
			) : (
				<p className="mt-12 text-[15px] text-ink-dim">{m.td_all_done()}</p>
			)}

			<Link
				to="/train"
				className="c-vt-lede mt-5 inline-flex items-baseline gap-3 self-start bg-flag px-6 py-4 font-display text-[22px] text-primary-foreground"
			>
				{m.td_open_train()}
				<span aria-hidden="true">→</span>
			</Link>
		</Chapter>
	);
}
