// Log — the three chapters of the history.
//
// This is the screen that punishes low density, and the brief says so up front.
// Twenty-six sessions and fourteen readiness checks set as editorial index
// entries is a long scroll, and no amount of typographic care changes that
// arithmetic. Two things keep it navigable without abandoning the direction:
//
//   * **Months are headings, not rows.** Grouping the sessions under a display-size
//     month gives the scroll landmarks, which is what a dense list gets from
//     sheer information and a sparse one has to earn.
//   * **Everything is one line until it is opened.** A closed entry is date,
//     title, and the one number that distinguishes it. The set rows — the densest
//     thing in the whole app — are inside.
//
// It is still the weakest screen for this direction. That is a finding, not a
// bug, and it is on the ticket.
import { useState } from 'react';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import type { WorkoutSet } from '$lib/types';
import type {
	LogFixture,
	LoggedReadinessFixture,
	LoggedSessionFixture,
	SetField,
} from '../prototype-fixtures';
import { Chapter } from './Editorial';

const OUTCOME_LABEL = [
	() => m.rd_outcome_bailed(),
	() => m.rd_outcome_flat(),
	() => m.rd_outcome_ok(),
	() => m.rd_outcome_strong(),
];

const TYPE_LABEL: Record<string, () => string> = {
	rec: () => m.log_type_rec(),
	day: () => m.log_type_day(),
	test: () => m.log_type_test(),
};

const SHOW: Record<Exclude<SetField, 'grip'>, (v: number) => string> = {
	weight: (v) => `${v} kg`,
	edge: (v) => `${v} mm`,
	time: (v) => `${v} s`,
	reps: (v) => `${v}×`,
	rest: (v) => `${v} s`,
	rpe: (v) => `RPE ${v}`,
};

function summarize(set: WorkoutSet, fields: SetField[]): string {
	const parts: string[] = [];
	for (const f of fields) {
		if (f === 'grip') continue;
		const v = set[f];
		if (v == null) continue;
		parts.push(SHOW[f](v));
	}
	return parts.join(' · ');
}

/** An index entry: a heading you can open. The whole Log screen is made of these. */
function Entry({
	eyebrow,
	title,
	titleColor,
	aside,
	children,
}: {
	eyebrow: string;
	title: string;
	titleColor?: string;
	aside?: string;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	return (
		<li className="border-line border-b">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-baseline gap-3 py-5 text-left"
			>
				<span className="min-w-0 flex-1">
					<span className="c-eyebrow block">{eyebrow}</span>
					<span
						className="mt-1 block font-display text-[19px] leading-tight"
						style={{ color: titleColor }}
					>
						{title}
					</span>
				</span>
				{aside ? (
					<span className="c-numeral flex-none text-[1.5rem] text-ink-faint">{aside}</span>
				) : null}
			</button>
			{open ? <div className="pb-6">{children}</div> : null}
		</li>
	);
}

function ReadinessEntryRow({ entry }: { entry: LoggedReadinessFixture }) {
	return (
		<Entry
			eyebrow={`${entry.dateLabel} · ${entry.timeLabel}`}
			title={entry.verdict.title}
			titleColor={entry.verdict.color}
			aside={String(entry.score)}
		>
			{entry.responses.length > 0 ? (
				<>
					<p className="c-eyebrow">{m.log_rd_responses()}</p>
					<dl className="mt-2 mb-6">
						{entry.responses.map((r) => (
							<div key={r.question} className="flex items-baseline justify-between gap-4 py-1.5">
								<dt className="text-[13px] text-ink-dim">{r.question}</dt>
								<dd className="flex-none text-[13px] text-ink">{r.answer}</dd>
							</div>
						))}
					</dl>
				</>
			) : null}
			<p className="c-eyebrow">{m.log_rd_conclusion()}</p>
			<p className="mt-1 font-display text-[17px] text-ink">{entry.verdict.title}</p>
			{entry.outcome != null ? (
				<p className="mt-1 text-[13px] text-ink-faint">{OUTCOME_LABEL[entry.outcome]?.() ?? ''}</p>
			) : null}
			{entry.flagTitles.length > 0 ? (
				<ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-faint">
					{entry.flagTitles.map((t) => (
						<li key={t} className="border-line border-b pb-0.5">
							{t}
						</li>
					))}
				</ul>
			) : null}
		</Entry>
	);
}

function SessionEntryRow({ session }: { session: LoggedSessionFixture }) {
	return (
		<Entry
			eyebrow={`${session.dateLabel} · ${session.weekdayLabel}`}
			title={session.dayType}
			aside={`${session.setCount}`}
		>
			{session.exercises.map((ex) => (
				<div key={ex.exId} className="mb-5">
					<p className="font-display text-[17px] text-ink">{ex.name}</p>
					<ul className="mt-1">
						{ex.sets.map((s, i) => (
							<li
								// A logged set has no identity beyond its position in the exercise.
								// biome-ignore lint/suspicious/noArrayIndexKey: position is the identity
								key={i}
								className="flex items-baseline gap-3 border-line border-b py-1.5 text-[13px]"
							>
								<span className="c-eyebrow w-14 flex-none">{m.c_set_n({ n: i + 1 })}</span>
								<span className="tabular-nums text-ink-dim">{summarize(s, ex.fields)}</span>
								{s.done ? (
									<span className="ml-auto flex-none text-flag">
										<span className="sr-only">{m.lbl_done()}</span>
										<span aria-hidden="true">✓</span>
									</span>
								) : null}
							</li>
						))}
					</ul>
				</div>
			))}
			{session.note ? <p className="text-[13px] text-ink-dim italic">“{session.note}”</p> : null}
			{session.durationMin != null ? (
				<p className="c-eyebrow mt-2">
					{session.durationMin} {m.train_duration()}
				</p>
			) : null}
		</Entry>
	);
}

/** Sessions bucketed by calendar month, newest first, preserving fixture order. */
function byMonth(
	sessions: LoggedSessionFixture[],
): { key: string; label: string; rows: LoggedSessionFixture[] }[] {
	const out: { key: string; label: string; rows: LoggedSessionFixture[] }[] = [];
	for (const s of sessions) {
		const key = s.iso.slice(0, 7);
		let bucket = out.find((b) => b.key === key);
		if (!bucket) {
			const [y, mo] = key.split('-').map(Number);
			bucket = {
				key,
				// A month name is a date format, not app copy — no message key exists or
				// should. `getLocale()` is what makes it Portuguese under pt-BR.
				label: new Date(y, mo - 1, 1).toLocaleDateString(getLocale(), {
					month: 'long',
					year: 'numeric',
				}),
				rows: [],
			};
			out.push(bucket);
		}
		bucket.rows.push(s);
	}
	return out;
}

export function LogReadiness({ log, index }: { log: LogFixture; index: number }) {
	return (
		<Chapter id="log-readiness" index={index} label={m.log_readiness()}>
			<h2 className="c-display text-[clamp(1.75rem,8vw,2.5rem)]">{m.log_readiness()}</h2>
			<ul className="mt-8 border-line border-t">
				{log.readiness.map((r) => (
					<ReadinessEntryRow key={r.iso} entry={r} />
				))}
			</ul>
		</Chapter>
	);
}

export function LogSessions({ log, index }: { log: LogFixture; index: number }) {
	return (
		<Chapter id="log-sessions" index={index} label={m.log_workouts()}>
			<h2 className="c-display text-[clamp(1.75rem,8vw,2.5rem)]">{m.log_workouts()}</h2>
			{byMonth(log.sessions).map((bucket) => (
				<section key={bucket.key} className="mt-10">
					<h3 className="c-display text-[22px] text-ink-faint first-letter:uppercase">
						{bucket.label}
					</h3>
					<ul className="mt-3 border-line border-t">
						{bucket.rows.map((s) => (
							<SessionEntryRow key={s.iso} session={s} />
						))}
					</ul>
				</section>
			))}
		</Chapter>
	);
}

export function LogActivity({ log, index }: { log: LogFixture; index: number }) {
	return (
		<Chapter id="log-activity" index={index} label={m.log_activity()}>
			<h2 className="c-display text-[clamp(1.75rem,8vw,2.5rem)]">{m.log_activity()}</h2>
			{log.activity.length === 0 ? (
				<p className="mt-8 text-[15px] text-ink-dim">{m.log_empty()}</p>
			) : (
				<ul className="mt-8 border-line border-t">
					{log.activity.map((a) => (
						<li key={`${a.date}-${a.type}-${a.label}`} className="border-line border-b py-4">
							<p className="c-eyebrow flex items-baseline gap-3">
								<span>{a.date}</span>
								<span style={{ color: a.color }}>{TYPE_LABEL[a.type]?.() ?? a.type}</span>
							</p>
							<p className="mt-1 font-display text-[19px] text-ink">{a.label}</p>
							{a.note ? <p className="mt-1 text-[13px] text-ink-dim">{a.note}</p> : null}
						</li>
					))}
				</ul>
			)}
		</Chapter>
	);
}
