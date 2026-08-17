// LOG — Direction A.
//
// Fourteen readiness checks, twenty-eight sessions and eight activity entries.
// The screen that punishes low density, and the one where this direction has
// the clearest answer: a history is a *list*, and a list earns its keep by
// having a stable row shape you can run your eye down.
//
// Every row is the same three-part line — when · the number · what it
// concluded — set on a common grid so the dates align, the scores align, and
// the eye only has to move vertically. The detail underneath is what the row
// summarises, not more of the same: a check opens to the answers that produced
// it, a session opens to the sets that were actually logged.
//
// Past sets are read-only here (see `sets.tsx`). Editing them is a repair job,
// not the reason this screen exists, and 28 sessions of live inputs would make
// the history feel like a spreadsheet that has to be finished.
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils';
import { OUTCOME_LABEL } from '../components/format';
import { Row, RowGroup } from '../components/Rows';
import { SetTable } from '../components/sets';
import { card, chip, Eyebrow, Section } from '../components/ui';
import { getPrototypeFixtures } from '../prototype-fixtures';

export const Route = createFileRoute('/log')({ component: Log });

const TYPE_LABEL: Record<string, () => string> = {
	rec: m.log_type_rec,
	day: m.log_type_day,
	test: m.log_type_test,
};

function Log() {
	const fx = useMemo(() => getPrototypeFixtures(), []);
	const { readiness, sessions, activity } = fx.log;

	return (
		<div className="flex flex-col gap-4">
			<header className="flex items-baseline justify-between gap-2 pt-1">
				<h1 className="text-[17px] leading-tight font-semibold text-ink">{m.sec_log()}</h1>
				<span className="num shrink-0 text-[11px] text-ink-faint">
					{sessions.length} · {readiness.length}
				</span>
			</header>

			<Section label={m.log_readiness()} meta={<span className="num">{readiness.length}</span>}>
				<RowGroup>
					{readiness.map((r) => (
						<Row
							key={r.iso}
							value={r.iso}
							summary={
								<span className="flex items-baseline gap-2">
									<span className="num w-[62px] shrink-0 text-[10px] whitespace-nowrap text-ink-faint">
										{r.dateLabel}
									</span>
									<span
										className="num w-[30px] shrink-0 rounded px-1 py-px text-center text-[11px] font-bold"
										style={{
											color: r.verdict.color,
											background: `color-mix(in srgb, ${r.verdict.color} 14%, transparent)`,
										}}
									>
										{r.score}
									</span>
									<span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
										{r.verdict.title}
									</span>
									{r.outcome != null ? (
										<span className={chip({ tone: 'ghost' })}>{OUTCOME_LABEL[r.outcome]()}</span>
									) : null}
								</span>
							}
						>
							<Eyebrow className="mb-1">
								{m.log_rd_responses()} · {r.timeLabel}
							</Eyebrow>
							<dl className="flex flex-col gap-0.5">
								{r.responses.map((row) => (
									<div key={row.question} className="flex items-baseline gap-2">
										<dt className="min-w-0 flex-1 truncate text-[12px] text-ink-faint">
											{row.question}
										</dt>
										<dd className="shrink-0 text-[12px] font-semibold text-chalk">{row.answer}</dd>
									</div>
								))}
							</dl>
							<Eyebrow className="mt-2.5 mb-1">{m.log_rd_conclusion()}</Eyebrow>
							<p className="text-[12.5px] text-ink-dim">
								<b className="font-semibold text-chalk">{r.verdict.title}</b> · {r.verdict.tag}
							</p>
							{r.flagTitles.length ? (
								<div className="mt-1.5 flex flex-wrap gap-1">
									{r.flagTitles.map((titleText) => (
										<span key={titleText} className={chip({ tone: 'warn' })}>
											{titleText}
										</span>
									))}
								</div>
							) : null}
						</Row>
					))}
				</RowGroup>
			</Section>

			<Section label={m.log_workouts()} meta={<span className="num">{sessions.length}</span>}>
				<RowGroup>
					{sessions.map((s) => (
						<Row
							key={s.iso}
							value={s.iso}
							summary={
								<span className="flex items-baseline gap-2">
									<span className="num w-[62px] shrink-0 text-[10px] whitespace-nowrap text-ink-faint">
										{s.dateLabel}
									</span>
									<span className="num w-[30px] shrink-0 text-center text-[11px] text-chalk">
										{s.setCount}
									</span>
									<span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
										{s.dayType}
									</span>
									<span className="num shrink-0 text-[11px] text-ink-faint">
										{s.durationMin != null ? `${s.durationMin}′` : '—'}
									</span>
								</span>
							}
						>
							<div className="flex flex-col gap-2.5">
								{s.exercises.map((ex) => (
									<div key={ex.exId}>
										<div className="mb-0.5 text-[12.5px] font-semibold text-chalk">{ex.name}</div>
										<SetTable fields={ex.fields} sets={ex.sets} />
									</div>
								))}
							</div>
							{s.note ? (
								<p className="mt-2 border-t border-line-soft pt-2 text-[12px] text-ink-dim italic">
									“{s.note}”
								</p>
							) : null}
						</Row>
					))}
				</RowGroup>
			</Section>

			<Section label={m.log_activity()} meta={<span className="num">{activity.length}</span>}>
				<div className={card({ pad: 'none' })}>
					{activity.map((e, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: an activity entry has no id; date + type repeat
							key={`${e.date}-${e.type}-${i}`}
							className={cn(
								'flex items-baseline gap-2 border-b border-line-soft px-2.5 py-2 last:border-b-0',
							)}
						>
							<span className="num w-[62px] shrink-0 text-[10px] whitespace-nowrap text-ink-faint">
								{e.date}
							</span>
							<span
								className="num w-[30px] shrink-0 rounded px-1 py-px text-center text-[10px] font-bold uppercase"
								style={{
									color: e.color,
									background: `color-mix(in srgb, ${e.color} 14%, transparent)`,
								}}
							>
								{TYPE_LABEL[e.type]?.() ?? e.type}
							</span>
							<span className="min-w-0 flex-1 text-[12.5px] text-ink">
								{e.label}
								{e.note ? <span className="text-ink-faint"> · {e.note}</span> : null}
							</span>
						</div>
					))}
				</div>
			</Section>
		</div>
	);
}
