// LOG.
//
// Every day the athlete checked in or trained, as one timeline (#120, spec #113
// stories 60–64): five weeks of them on a seeded store, and more every week after.
//
// A history is a list, and a list earns its keep by having a stable row shape you
// can run your eye down. Every row is the same line, when · the score · what was
// trained · how much, set on a common grid so the dates align, the scores align,
// and the eye only moves vertically. It was two lists, checks and sessions, and
// reading a day meant matching them by date across the screen.
//
// Opening a row shows what it summarises: the check's answers and the verdict
// they produced, and the session's sets. From `lg` the open day sits beside the
// timeline instead of under its row, so the second column holds the detail rather
// than a second list.
//
// Past sets are read-only here (see `components/SetRows.tsx`). Editing them is a
// repair job, not the reason this screen exists, and 28 sessions of live inputs
// would make the history feel like a spreadsheet that has to be finished.
import { createFileRoute, Link } from '@tanstack/react-router';
import { type ReactNode, useId, useMemo, useState } from 'react';
import { getContent } from '$lib/content';
import { OUTCOME_LABEL } from '$lib/format';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import {
	type LogDay,
	type LoggedCheckRow,
	type LoggedSessionRow,
	resolveLog,
} from '$lib/screens/log';
import { useTrainingRecord } from '$lib/store/record';
import { cn } from '$lib/utils';
import { SetTable } from '../components/SetRows';
import { Empty, Pane, Panes, ScreenHeader } from '../components/ui/primitives';
import { Row, RowGroup, RowsEnd, useRowsInPlace } from '../components/ui/Rows';
import { button, card, chip, SEVERITY_CHIP, STATE_MARK } from '../components/ui/variants';

export const Route = createFileRoute('/log')({ component: Log });

/** A count with its noun, singular at one. The message format has no plurals. */
function counted(
	n: number,
	one: (a: { n: number }) => string,
	other: (a: { n: number }) => string,
) {
	return n === 1 ? one({ n }) : other({ n });
}

/** Chalk on every line of the selected row from `lg` (`Row`'s `aside`). */
const PICKED = 'lg:group-data-[current]:text-chalk';

function Log() {
	// The history, live. `useTrainingRecord` subscribes to the collections, so a
	// session logged on Train appears here without this screen knowing anything
	// about how it got stored.
	const record = useTrainingRecord();
	const locale = getLocale();
	const { days, counts } = useMemo(
		() => resolveLog(getContent(locale), record, locale),
		[record, locale],
	);

	// TWO THINGS, KEPT APART. Which row is open under itself (a phone), and
	// which day the pane beside the timeline shows (from `lg`). A phone opens on
	// the timeline with nothing open: the closed row already says what the day
	// was (#120 critique). The pane shows the last day opened, the newest until
	// one is, and closing a row leaves it there, so a wide screen never shows an
	// empty second pane.
	const [open, setOpen] = useState<string | null>(null);
	const [picked, setPicked] = useState<string | null>(null);
	const openRows = open ? [open] : [];
	const day = days.find((d) => d.iso === picked) ?? days[0] ?? null;
	const { end, hold } = useRowsInPlace();
	const detailId = useId();

	return (
		// The page's frame, not a `Pane`: at `lg` this is two panes, so the frame is
		// the full width the shell hands over and the header spans both.
		<div className="flex flex-col gap-sections">
			<ScreenHeader
				title={m.sec_log()}
				meta={
					<>
						{counted(counts.sessions, m.log_sessions_one, m.log_sessions_other)} ·{' '}
						{counted(counts.checkedDays, m.log_checked_days_one, m.log_checked_days_other)}
					</>
				}
			/>

			{days.length === 0 ? (
				// An empty timeline is copy, not an empty box (#61), and it names both
				// things a day is made of. Zero stays in the header, which is honest.
				<Pane>
					<Empty
						value={m.log_empty()}
						action={
							<Link to="/" className={button({ size: 'md', class: 'min-h-11' })}>
								{m.log_go_today()}
							</Link>
						}
					/>
				</Pane>
			) : (
				// THE CUT (#52, #120). The timeline on the left, the open day on the
				// right, held in view while the timeline scrolls. Contiguous in the
				// phone order because the right pane is not on the phone at all: there
				// the open day is its row's own panel.
				<Panes
					stickySecondary
					primary={
						// The rows are `h3`s (`Row`), so the list is headed for the
						// outline a screen reader walks; the eye has the header above.
						<section aria-labelledby={`${detailId}-days`}>
							<h2 id={`${detailId}-days`} className="sr-only">
								{m.log_timeline()}
							</h2>
							<RowGroup
								value={openRows}
								onValueChange={(next, event) => {
									hold(openRows, next, event);
									setOpen(next[0] ?? null);
									if (next[0]) setPicked(next[0]);
								}}
							>
								{days.map((d) => (
									<Row
										key={d.iso}
										value={d.iso}
										aside
										current={d.iso === day?.iso}
										summary={<DaySummary day={d} />}
									>
										<DayDetail day={d} level={4} />
									</Row>
								))}
							</RowGroup>
						</section>
					}
					secondary={
						// A region named by its date, and a tab stop: it scrolls inside
						// itself when the day is taller than the window, so a keyboard
						// has to be able to reach it (`Panes`' `stickySecondary` caps it).
						day ? (
							<section
								data-day-detail=""
								aria-labelledby={`${detailId}-date`}
								// biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll container a keyboard must reach
								tabIndex={0}
								className={card({
									pad: 'md',
									class:
										'hidden lg:flex lg:max-h-[calc(100dvh-116px)] lg:flex-col lg:gap-3 lg:overflow-y-auto lg:overscroll-contain',
								})}
							>
								<h2
									id={`${detailId}-date`}
									className="text-[15px] leading-tight font-semibold text-ink"
								>
									{day.fullDate}
								</h2>
								<DayDetail day={day} level={3} />
							</section>
						) : null
					}
				/>
			)}
			<RowsEnd ref={end} />
		</div>
	);
}

/** A day's closed line: the date, the score, the session, how many sets. */
function DaySummary({ day }: { day: LogDay }) {
	const { check, session } = day;
	return (
		<span className="flex items-baseline gap-2.5">
			<span
				className={cn('num w-[68px] shrink-0 text-[11px] whitespace-nowrap text-ink-faint', PICKED)}
			>
				{day.dateLabel}
			</span>
			<span className="flex w-10 shrink-0 items-baseline gap-1.5">
				{check ? (
					<>
						<span
							data-score-tone=""
							aria-hidden="true"
							className={cn('size-2 shrink-0 self-center rounded-full', STATE_MARK[check.tone])}
						/>
						<span className={cn('num text-[13px] font-semibold text-ink', PICKED)}>
							<span className="sr-only">{m.rd_score()} </span>
							{check.score}
							<span className="sr-only">, {check.verdict.title}.</span>
						</span>
					</>
				) : (
					<span className="num text-[13px] text-ink-faint">
						<span aria-hidden="true">—</span>
						<span className="sr-only">{m.log_no_check()}.</span>
					</span>
				)}
			</span>
			{/* The day type wraps at its spaces, never inside a word, and the set
			    count drops under it when the two do not fit: pt-BR's "Limite /
			    Potência" was cut to "Limite / Potên…" at 360px, and breaking
			    anywhere split "Performance" at 320px (#120 critique). */}
			<span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
				<span
					className={cn(
						'text-[13px] leading-snug',
						session ? 'text-ink' : 'text-ink-faint',
						PICKED,
						'lg:group-data-[current]:font-semibold',
					)}
				>
					{session ? session.dayType : m.log_no_session()}
				</span>
				{session ? (
					<span className={cn('num ml-auto shrink-0 text-[11px] text-ink-faint', PICKED)}>
						{counted(session.setCount, m.log_sets_one, m.log_sets_other)}
					</span>
				) : null}
			</span>
		</span>
	);
}

/** What a day's row opens to, and what sits beside the timeline from `lg`. */
function DayDetail({ day, level }: { day: LogDay; level: 3 | 4 }) {
	return (
		<div className="flex flex-col divide-y divide-line-soft">
			{day.check ? <CheckDetail check={day.check} level={level} /> : null}
			{day.session ? <SessionDetail session={day.session} level={level} /> : null}
		</div>
	);
}

/** One block of a day's detail: its heading, a reading on the right, its body. */
function Block({
	level,
	title,
	reading,
	children,
}: {
	level: 3 | 4;
	title: string;
	reading?: string;
	children: ReactNode;
}) {
	const Heading = level === 3 ? 'h3' : 'h4';
	return (
		<section className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
			<header className="flex items-baseline justify-between gap-2">
				<Heading className="h-section min-w-0">{title}</Heading>
				{reading ? (
					<span className="num shrink-0 text-[11px] text-ink-faint">{reading}</span>
				) : null}
			</header>
			{children}
		</section>
	);
}

/** The check as it was answered: the verdict it produced, then the answers. */
function CheckDetail({ check, level }: { check: LoggedCheckRow; level: 3 | 4 }) {
	return (
		<Block level={level} title={m.log_day_check()} reading={check.timeLabel}>
			<div className="flex items-start gap-2">
				<span
					aria-hidden="true"
					className={cn('mt-1.5 size-2 shrink-0 rounded-full', STATE_MARK[check.tone])}
				/>
				<p className="min-w-0 text-[13px] leading-snug">
					<span className="num font-semibold text-ink">{check.score}</span>{' '}
					<b className="font-semibold text-ink">{check.verdict.title}</b>
					<span className="block text-ink-dim">{check.verdict.tag}</span>
				</p>
			</div>
			{check.flags.length ? (
				<div className="flex flex-wrap gap-1">
					{check.flags.map((f) => (
						<span key={f.title} className={chip({ tone: SEVERITY_CHIP[f.severity] })}>
							{f.title}
						</span>
					))}
				</div>
			) : null}
			<dl className="flex flex-col">
				{check.responses.map((row) => (
					<Answer key={row.question} question={row.question} answer={row.answer} />
				))}
				{check.outcome != null ? (
					<Answer question={m.log_outcome()} answer={OUTCOME_LABEL[check.outcome]()} />
				) : null}
			</dl>
		</Block>
	);
}

function Answer({ question, answer }: { question: string; answer: string }) {
	return (
		<div className="flex items-baseline justify-between gap-3 border-t border-line-soft py-1.5">
			<dt className="min-w-0 text-[13px] leading-snug text-ink-dim">{question}</dt>
			<dd className="max-w-[50%] shrink-0 text-right text-[13px] leading-snug font-semibold text-ink">
				{answer}
			</dd>
		</div>
	);
}

/** The session as it was logged: each exercise's sets, then the note. */
function SessionDetail({ session, level }: { session: LoggedSessionRow; level: 3 | 4 }) {
	return (
		<Block
			level={level}
			title={`${m.log_day_session()} · ${session.dayType}`}
			reading={session.durationMin != null ? m.log_minutes({ n: session.durationMin }) : undefined}
		>
			<div className="flex flex-col gap-3">
				{session.exercises.map((ex) => (
					<div key={ex.exercise} data-exercise="">
						<div className="mb-0.5 text-[13px] font-semibold text-ink">{ex.name}</div>
						<SetTable
							fields={ex.fields}
							sets={ex.sets}
							empty={
								<p data-no-numbers="" className="text-[13px] leading-snug text-ink-faint">
									{counted(ex.sets.length, m.log_no_numbers_one, m.log_no_numbers_other)}
								</p>
							}
						/>
					</div>
				))}
			</div>
			{session.note ? (
				<p className="border-t border-line-soft pt-2 text-[13px] leading-snug text-ink-dim italic">
					“{session.note}”
				</p>
			) : null}
		</Block>
	);
}
