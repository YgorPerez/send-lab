// LOG.
//
// Every readiness check and every session the account holds — five weeks of them
// on a seeded store, and more every week after.
//
// The screen that punishes low density, and the one where this direction has the
// clearest answer: a history is a *list*, and a list earns its keep by having a
// stable row shape you can run your eye down.
//
// Every row is the same three-part line — when · the number · what it concluded —
// set on a common grid so the dates align, the scores align, and the eye only has
// to move vertically. The detail underneath is what the row summarises, not more
// of the same: a check opens to the answers that produced it, a session opens to
// the sets that were actually logged.
//
// Past sets are read-only here (see `components/SetRows.tsx`). Editing them is a
// repair job, not the reason this screen exists, and 28 sessions of live inputs
// would make the history feel like a spreadsheet that has to be finished.
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { getContent } from '$lib/content';
import { OUTCOME_LABEL } from '$lib/format';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { resolveLog } from '$lib/screens/log';
import { useTrainingRecord } from '$lib/store/record';
import { SetTable } from '../components/SetRows';
import { Eyebrow, Panes, Section } from '../components/ui/primitives';
import { Row, RowGroup } from '../components/ui/Rows';
import { chip } from '../components/ui/variants';

export const Route = createFileRoute('/log')({ component: Log });

function Log() {
	// The history, live. `useTrainingRecord` subscribes to the collections, so a
	// session logged on Train appears here without this screen knowing anything
	// about how it got stored.
	const record = useTrainingRecord();
	const locale = getLocale();
	const { checks, sessions } = useMemo(
		() => resolveLog(getContent(locale), record, locale),
		[record, locale],
	);

	return (
		// The page's frame, not a `Column`: at `lg` this is two columns, so the frame
		// is the full width the shell hands over and the header spans both.
		<div className="flex flex-col gap-7">
			<header className="flex items-baseline justify-between gap-2 pt-1.5">
				<h1 className="h-screen-title">{m.sec_log()}</h1>
				<span className="num shrink-0 text-[11px] text-ink-faint">
					{sessions.length} · {checks.length}
				</span>
			</header>

			{/* THE CUT (#52).
			    Log's two lists are genuinely independent — a check and a session are
			    different things, and neither list's rows depend on the other's — so a
			    wide screen puts them side by side and halves the page. Not two columns
			    of *one* list: these are accordions, and opening a row in a column
			    reflows only its own column, where opening one in a two-column flow of
			    the same list would move the rows beside it.
			    It is also the page with the most to gain from plain width. The summary
			    line truncates first in pt-BR — "15 de ago." against "Aug 15" — and the
			    column here is wider than the whole phone screen. */}
			<Panes
				primary={
					<Section label={m.log_readiness()} meta={<span className="num">{checks.length}</span>}>
						<RowGroup>
							{checks.map((r) => (
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
												<span className={chip({ tone: 'ghost' })}>
													{OUTCOME_LABEL[r.outcome]()}
												</span>
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
												<dd className="shrink-0 text-[12px] font-semibold text-chalk">
													{row.answer}
												</dd>
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
				}
				secondary={
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
											<div key={ex.exercise}>
												<div className="mb-0.5 text-[12.5px] font-semibold text-chalk">
													{ex.name}
												</div>
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
				}
			/>
		</div>
	);
}
