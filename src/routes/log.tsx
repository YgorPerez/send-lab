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
import { type ReactNode, useMemo, useState } from 'react';
import { getContent } from '$lib/content';
import { OUTCOME_LABEL } from '$lib/format';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import {
	type LogDay,
	type LoggedCheckRow,
	type LoggedSessionRow,
	resolveLog,
	type ScoreTone,
} from '$lib/screens/log';
import { useTrainingRecord } from '$lib/store/record';
import { cn } from '$lib/utils';
import { SetTable } from '../components/SetRows';
import { Empty, Pane, Panes, ScreenHeader } from '../components/ui/primitives';
import { Row, RowGroup, RowsEnd, useRowsInPlace } from '../components/ui/Rows';
import { button, card, chip } from '../components/ui/variants';

export const Route = createFileRoute('/log')({ component: Log });

/** A count with its noun, singular at one. The message format has no plurals. */
function counted(
	n: number,
	one: (a: { n: number }) => string,
	other: (a: { n: number }) => string,
) {
	return n === 1 ? one({ n }) : other({ n });
}

/** The score's mark: its verdict's state as a dot, which clears 3:1 as a mark on
 *  every surface a row takes, where the accents as 11px text do not (DESIGN.md ›
 *  The Pair, Not the Palette Rule). Never the library's verdict colour: it
 *  paints a good day vermilion (`screens/log.ts`). */
const TONE_MARK: Record<ScoreTone, string> = {
	ok: 'bg-teal',
	warn: 'bg-gold',
	stop: 'bg-flag',
};

/** Chalk on every line of the selected row from `lg` (`Row`'s `aside`). */
const PICKED = 'lg:group-data-[panel-open]:text-chalk';

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

	// THE OPEN DAY. `undefined` until the athlete picks: the newest day, so the
	// second pane on a wide screen is never empty on arrival and the phone opens
	// on what was done last. `null` is a choice too: everything closed.
	const [chosen, setChosen] = useState<string | null | undefined>(undefined);
	const open = chosen === undefined ? (days[0]?.iso ?? null) : chosen;
	const openRows = open ? [open] : [];
	const day = days.find((d) => d.iso === open) ?? null;
	const { end, hold } = useRowsInPlace();

	return (
		// The page's frame, not a `Pane`: at `lg` this is two panes, so the frame is
		// the full width the shell hands over and the header spans both.
		<div className="flex flex-col gap-sections">
			<ScreenHeader
				title={m.sec_log()}
				meta={
					<>
						{counted(counts.sessions, m.log_sessions_one, m.log_sessions_other)} ·{' '}
						{counted(counts.checks, m.log_checks_one, m.log_checks_other)}
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
						<RowGroup
							value={openRows}
							onValueChange={(next, event) => {
								hold(openRows, next, event);
								setChosen(next[0] ?? null);
							}}
						>
							{days.map((d) => (
								<Row key={d.iso} value={d.iso} aside summary={<DaySummary day={d} />}>
									<DayDetail day={d} level={4} />
								</Row>
							))}
						</RowGroup>
					}
					secondary={
						<div data-day-detail="" className="hidden lg:flex lg:flex-col">
							{day ? (
								<div className={card({ pad: 'md', class: 'flex flex-col gap-3' })}>
									<h2 className="text-[15px] leading-tight font-semibold text-ink">
										{day.fullDate}
									</h2>
									<DayDetail day={day} level={3} />
								</div>
							) : (
								<Empty value={m.log_pick_day()} />
							)}
						</div>
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
							className={cn('size-2 shrink-0 self-center rounded-full', TONE_MARK[check.tone])}
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
			<span
				className={cn(
					'min-w-0 flex-1 truncate text-[13px]',
					session ? 'text-ink' : 'text-ink-faint',
					PICKED,
					'lg:group-data-[panel-open]:font-semibold',
				)}
			>
				{session ? session.dayType : m.log_no_session()}
			</span>
			{session ? (
				<span className={cn('num shrink-0 text-[11px] text-ink-faint', PICKED)}>
					{counted(session.setCount, m.log_sets_one, m.log_sets_other)}
				</span>
			) : null}
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
				<Heading className="h-section-sans min-w-0">{title}</Heading>
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
					className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE_MARK[check.tone])}
				/>
				<p className="min-w-0 text-[13px] leading-snug">
					<span className="num font-semibold text-ink">{check.score}</span>{' '}
					<b className="font-semibold text-ink">{check.verdict.title}</b>
					<span className="block text-ink-dim">{check.verdict.tag}</span>
				</p>
			</div>
			{check.flagTitles.length ? (
				<div className="flex flex-wrap gap-1">
					{check.flagTitles.map((title) => (
						<span key={title} className={chip({ tone: 'warn' })}>
							{title}
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
					<div key={ex.exercise}>
						<div className="mb-0.5 text-[13px] font-semibold text-ink">{ex.name}</div>
						<SetTable fields={ex.fields} sets={ex.sets} />
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
