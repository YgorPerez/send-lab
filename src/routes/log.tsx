// Channel 03 — LOG.
//
// The most rows per screen: 28 sessions, 14 readiness checks, 8 activity rows,
// plus every set inside every session. This is the screen that pays for the
// direction — a card per session would be 28 cards, and at 360px that is a
// scroll with almost no information in it.
//
// Two things carry the grouping instead:
//
//   1. **A month band.** A single inverted 20px strip with the month in small
//      caps and the session count on the right. It is the only place on the
//      screen with a filled ground, so the eye finds it instantly while
//      scrolling fast, and it costs 20px against a card's 16px of padding
//      alone.
//   2. **Indent by rule, not by margin.** An expanded session's sets sit inside
//      a 1px left rule rather than an indent, so the set line keeps the full
//      310px it needs.
//
// A logged set is read-only, so it collapses to one mono line — `38kg · 4r ·
// 180s · RPE 9` — where the same set on `/train` needs a two-line keypad. That
// asymmetry is the direction working: precision costs width only when it has to
// be editable.

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import * as m from '$lib/paraglide/messages';
import { useLocale } from '$lib/prototype/locale';
import { rich } from '$lib/prototype/rich';
import { usePrototype } from '$lib/prototype/usePrototype';
import type { WorkoutSet } from '$lib/types';
import { cn } from '$lib/utils';
import { Frame } from '../components/Frame';
import { Chips, Lbl, Prose, Readout, Row, Section, Swatch } from '../components/kit';
import type { LoggedSessionFixture, SetField } from '../prototype-fixtures';

export const Route = createFileRoute('/log')({ component: LogScreen });

const GRIP_LABEL: Record<string, () => string> = {
	'half-crimp': m.grip_half_crimp,
	'open-hand': m.grip_open_hand,
	'full-crimp': m.grip_full_crimp,
	pinch: m.grip_pinch,
	sloper: m.grip_sloper,
	wrist: m.grip_wrist,
	jug: m.grip_jug,
};

const TYPE_LABEL: Record<string, () => string> = {
	rec: m.log_type_rec,
	day: m.log_type_day,
	test: m.log_type_test,
};

const OUTCOME_LABEL: Record<number, () => string> = {
	0: m.rd_outcome_bailed,
	1: m.rd_outcome_flat,
	2: m.rd_outcome_ok,
	3: m.rd_outcome_strong,
};

/** One logged set on one line. Units are printed, because a bare column of
 *  numbers with a header two screens up is not a reading, it is a puzzle. */
function setLine(s: WorkoutSet, fields: SetField[]): string {
	const parts: string[] = [];
	for (const f of fields) {
		if (f === 'weight' && s.weight != null) parts.push(`${s.weight}kg`);
		if (f === 'edge' && s.edge != null) parts.push(`${s.edge}mm`);
		if (f === 'time' && s.time != null) parts.push(`${s.time}s`);
		if (f === 'reps' && s.reps != null) parts.push(`${s.reps}r`);
		if (f === 'grip' && s.grip) parts.push(GRIP_LABEL[s.grip]?.() ?? s.grip);
		if (f === 'rest' && s.rest != null) parts.push(`R${s.rest}`);
		if (f === 'rpe' && s.rpe != null) parts.push(`RPE ${s.rpe}`);
	}
	return parts.join(' · ');
}

/** Sessions bucketed by calendar month, newest first. The ISO date is the
 *  identity; the month label is produced at the last moment (ADR 0003). */
function byMonth(
	sessions: LoggedSessionFixture[],
	locale: string,
): { key: string; label: string; rows: LoggedSessionFixture[] }[] {
	const groups: { key: string; label: string; rows: LoggedSessionFixture[] }[] = [];
	for (const s of sessions) {
		const key = s.iso.slice(0, 7);
		let group = groups.find((g) => g.key === key);
		if (!group) {
			const [y, mo] = key.split('-').map(Number);
			group = {
				key,
				label: new Date(y, mo - 1, 1).toLocaleDateString(locale, {
					month: 'long',
					year: 'numeric',
				}),
				rows: [],
			};
			groups.push(group);
		}
		group.rows.push(s);
	}
	return groups;
}

function LogScreen() {
	const fx = usePrototype();
	const locale = useLocale();
	const [open, setOpen] = useState<Record<string, boolean>>({});

	const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));
	const groups = byMonth(fx.log.sessions, locale);

	return (
		<Frame>
			{/* 00 — the sessions. */}
			<Section index="00" meta={String(fx.log.sessions.length)} title={m.log_workouts()}>
				{groups.map((g) => (
					<div key={g.key}>
						<div className="flex items-center gap-2 bg-ink px-3 py-1 text-bg">
							<span className="lbl text-bg">{g.label}</span>
							<span className="num ml-auto text-[12px]">{g.rows.length}</span>
						</div>
						{g.rows.map((s) => {
							const key = `s-${s.iso}`;
							const isOpen = Boolean(open[key]);
							return (
								<div className="border-line border-b" key={key}>
									<button
										aria-expanded={isOpen}
										className="flex w-full items-center gap-2 px-3 py-2 text-left"
										onClick={() => toggle(key)}
										type="button"
									>
										<span
											aria-hidden="true"
											className="num w-3 shrink-0 text-[13px] text-ink-faint"
										>
											{isOpen ? '−' : '+'}
										</span>
										<span className="num w-14 shrink-0 text-[13px] text-ink">{s.dateLabel}</span>
										<span className="min-w-0 flex-1 truncate text-[13px] text-ink-dim">
											{s.dayType}
										</span>
										<span className="lbl shrink-0 text-ink-faint">
											{s.setCount} · {s.durationMin ?? '—'}′
										</span>
									</button>
									{isOpen ? (
										<div className="border-line border-l pl-3 ml-3 mb-2">
											{s.exercises.map((ex) => (
												<div className="mt-1.5" key={`${key}-${ex.exId}`}>
													<Lbl className="block text-ink">{ex.name}</Lbl>
													{ex.sets.map((st, i) => (
														<div
															className="num flex items-baseline gap-2 text-[12px] text-ink-dim"
															key={`${key}-${ex.exId}-${st.rpe ?? 'x'}-${i === 0 ? 'a' : `b${i}`}`}
														>
															<span className="text-ink-faint">
																{String(i + 1).padStart(2, '0')}
															</span>
															<span className="min-w-0 flex-1">{setLine(st, ex.fields)}</span>
															<span className={st.done ? 'text-ink' : 'text-ink-faint'}>
																{st.done ? '✓' : '·'}
															</span>
														</div>
													))}
												</div>
											))}
											{s.note ? <Prose className="mt-2 text-[13px]">{s.note}</Prose> : null}
										</div>
									) : null}
								</div>
							);
						})}
					</div>
				))}
			</Section>

			{/* 01 — the readiness checks, with the answers that produced them. */}
			<Section index="01" meta={String(fx.log.readiness.length)} title={m.log_readiness()}>
				{fx.log.readiness.map((r) => {
					const key = `r-${r.iso}`;
					const isOpen = Boolean(open[key]);
					return (
						<div className="border-line border-b" key={key}>
							<button
								aria-expanded={isOpen}
								className="flex w-full items-center gap-2 px-3 py-2 text-left"
								onClick={() => toggle(key)}
								type="button"
							>
								<span aria-hidden="true" className="num w-3 shrink-0 text-[13px] text-ink-faint">
									{isOpen ? '−' : '+'}
								</span>
								<span className="num w-14 shrink-0 text-[13px] text-ink">{r.dateLabel}</span>
								<span
									aria-hidden="true"
									className="h-3 w-[3px] shrink-0"
									style={{ background: r.verdict.color }}
								/>
								<span className="min-w-0 flex-1 truncate text-[13px] text-ink-dim">
									{r.verdict.tag}
								</span>
								<span className="num shrink-0 text-[15px] text-ink">{r.score}</span>
							</button>
							{isOpen ? (
								<div className="border-line border-l pl-3 ml-3 mb-2">
									<Lbl className="block text-ink-faint">{r.timeLabel}</Lbl>
									<Lbl className="mt-2 block text-ink">{m.log_rd_responses()}</Lbl>
									<div className="mt-1 space-y-1">
										{r.responses.map((q) => (
											<div className="flex items-baseline gap-2" key={q.question}>
												<span className="min-w-0 flex-1 text-[12px] text-ink-dim leading-snug">
													{q.question}
												</span>
												<span className="shrink-0 text-[12px] text-ink">{q.answer}</span>
											</div>
										))}
									</div>
									<Lbl className="mt-2 block text-ink">{m.log_rd_conclusion()}</Lbl>
									<div className="text-[13px] text-ink leading-tight">{r.verdict.title}</div>
									<Prose className="mt-1 text-[13px]">{rich(r.verdict.text)}</Prose>
									{r.flagTitles.length > 0 ? <Chips items={r.flagTitles} /> : null}
									<div className="mt-2">
										<Lbl className="text-ink-faint">
											{m.rd_outcome_q()}{' '}
											{r.outcome != null ? (OUTCOME_LABEL[r.outcome]?.() ?? r.outcome) : '—'}
										</Lbl>
									</div>
								</div>
							) : null}
						</div>
					);
				})}
			</Section>

			{/* 02 — everything else that happened. */}
			<Section index="02" meta={String(fx.log.activity.length)} title={m.log_activity()}>
				{fx.log.activity.map((a) => (
					<Row className="flex items-start gap-2" key={`${a.date}-${a.type}-${a.label}`}>
						<span className="num w-14 shrink-0 text-[13px] text-ink">{a.date}</span>
						<span
							className={cn(
								'lbl lbl-tight shrink-0 border px-1 py-0.5',
								a.type === 'test' ? 'border-flag text-flag' : 'border-line text-ink-faint',
							)}
						>
							{TYPE_LABEL[a.type]?.() ?? a.type}
						</span>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5">
								<Swatch varName={a.color} />
								<span className="min-w-0 truncate text-[13px] text-ink">{a.label}</span>
							</div>
							{a.note ? <Prose className="mt-0.5 text-[12px]">{a.note}</Prose> : null}
						</div>
					</Row>
				))}
			</Section>

			{/* A closing readout, so the channel ends on a number rather than on a
			    row that could have been the first of another twenty. */}
			<Section index="03" title={m.sec_counters()}>
				<Row className="grid grid-cols-3 gap-px bg-line" pad="none">
					<div className="bg-bg px-3 py-2">
						<Readout caption={m.log_workouts()} size="large" value={fx.log.sessions.length} />
					</div>
					<div className="bg-bg px-3 py-2">
						<Readout caption={m.log_readiness()} size="large" value={fx.log.readiness.length} />
					</div>
					<div className="bg-bg px-3 py-2">
						<Readout caption={m.log_activity()} size="large" value={fx.log.activity.length} />
					</div>
				</Row>
			</Section>
		</Frame>
	);
}
