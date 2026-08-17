// Chapter II — the plan.
//
// Four tasks, two of which the verdict is holding back. Held work is the piece a
// sparse layout is most tempted to drop, and dropping it would be a lie: held is
// not cancelled, it is carry-forward, and an athlete who cannot see it will
// assume the app forgot. So it stays on the page, below a rule, un-tickable, with
// the reason attached.
//
// The tick is a ring that fills. Not a switch, not a chunky control with a
// pressed state — this direction's controls are the same weight as its text.
import { useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { TaskFixture, TodayFixture } from '../../prototype-fixtures';
import { Chapter, Rule } from '../Editorial';

function TaskRow({
	task,
	done,
	onToggle,
}: {
	task: TaskFixture;
	done: boolean;
	onToggle: () => void;
}) {
	return (
		<li>
			<button
				type="button"
				onClick={onToggle}
				aria-pressed={done}
				className="flex w-full items-center gap-4 py-4 text-left"
			>
				<span
					className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border transition-colors ${
						done ? 'border-flag bg-flag text-primary-foreground' : 'border-line'
					}`}
					aria-hidden="true"
				>
					{done ? '✓' : ''}
				</span>
				<span
					className={`font-display text-[21px] leading-tight ${
						done ? 'text-ink-faint line-through' : 'text-ink'
					}`}
				>
					{task.label}
				</span>
			</button>
		</li>
	);
}

export function Plan({ today, index }: { today: TodayFixture; index: number }) {
	// The fixture is a snapshot, not a store (its module header is explicit about
	// that), so the ticks live here.
	const [done, setDone] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(today.tasks.map((t) => [t.exId, t.done])),
	);
	const [missedTaken, setMissedTaken] = useState(false);

	const live = today.tasks.filter((t) => !t.held);

	return (
		<Chapter id="plan" index={index} label={m.c_ch_plan()}>
			<p className="c-eyebrow">
				{today.weekdayLabel} · {today.dateLabel}
			</p>
			<h2
				className="c-display mt-2 text-[clamp(1.75rem,8vw,2.5rem)]"
				style={{ color: today.day.color }}
			>
				{today.day.type}
			</h2>
			<p className="mt-3 text-[15px] text-ink-dim">{today.day.prime}</p>
			<p className="mt-1 text-[13px] text-ink-faint">{today.day.sec}</p>
			<p className="c-eyebrow mt-3" style={{ color: today.day.color }}>
				{today.day.load}
			</p>

			<Rule className="mt-8" />

			{today.isRestDay ? (
				<p className="py-8 text-[17px] text-ink-dim">{m.td_rest_day()}</p>
			) : (
				<ul className="divide-y divide-line">
					{live.map((t) => (
						<TaskRow
							key={t.exId}
							task={t}
							done={!!done[t.exId]}
							onToggle={() => setDone((d) => ({ ...d, [t.exId]: !d[t.exId] }))}
						/>
					))}
				</ul>
			)}

			{today.held.length > 0 ? (
				<div className="mt-8 border-line border-t pt-5">
					<p className="c-eyebrow">{m.td_held()}</p>
					<ul className="mt-2">
						{today.held.map((t) => (
							<li key={t.exId} className="py-2 font-display text-[19px] text-ink-faint">
								{t.label}
							</li>
						))}
					</ul>
				</div>
			) : null}

			{today.missed ? (
				<div className="mt-10 border-flag border-l-2 pl-4">
					<p className="text-[15px] text-ink">{m.td_missed({ day: today.missed.weekdayLabel })}</p>
					<p className="mt-1 text-[13px] text-ink-faint">{today.missed.labels.join(' · ')}</p>
					{missedTaken ? (
						<p className="c-eyebrow mt-3 text-flag">{m.lbl_done()}</p>
					) : (
						<button
							type="button"
							onClick={() => setMissedTaken(true)}
							className="mt-3 border-ink border-b font-display text-[17px] text-ink"
						>
							{m.td_missed_do()}
						</button>
					)}
				</div>
			) : null}
		</Chapter>
	);
}
