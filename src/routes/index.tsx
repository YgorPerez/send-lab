// Channel 01 — TODAY.
//
// The densest screen, and the one that decides whether the direction works. It
// is thirteen sections stacked with no gap between them, each opened by a 2px
// rule and indexed in a 26px rail. There is not a single card, a single rounded
// corner or a single shadow on it.
//
// What the readout gets and the rest does not: the verdict is the only place on
// the screen that gets a 56px numeral, a saturated hue and its own lifted
// ground. Everything else is one weight of ink on one ground, separated by
// rules. That is the whole hierarchy — an instrument has one needle.

import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { Answers } from '$lib/content';
import * as m from '$lib/paraglide/messages';
import { rich } from '$lib/prototype/rich';
import { usePrototype } from '$lib/prototype/usePrototype';
import { round } from '$lib/utils';
import { Frame } from '../components/Frame';
import {
	Bench,
	Chips,
	Gauge,
	KV,
	Lbl,
	Prose,
	Readout,
	Row,
	Section,
	Spark,
	Tick,
} from '../components/kit';
import { ReadinessCheck } from '../components/ReadinessCheck';

export const Route = createFileRoute('/')({ component: TodayScreen });

const DIM_LABELS: Record<string, () => string> = {
	sleep: m.rd_sleep,
	fatigue: m.rd_fatigue,
	soreness: m.rd_soreness,
	stress: m.rd_stress,
	mood: m.rd_mood,
};

const VS_LABELS: Record<string, () => string> = {
	below: m.rd_vs_below,
	usual: m.rd_vs_usual,
	above: m.rd_vs_above,
};

const TREND_LABELS: Record<string, () => string> = {
	up: m.trend_up,
	down: m.trend_down,
	flat: m.trend_flat,
};

const BAND_LABELS: Record<string, () => string> = {
	manageable: m.deep_band_manageable,
	moderate: m.deep_band_moderate,
	significant: m.deep_band_significant,
};

const OUTCOMES = [
	{ v: 3, label: m.rd_outcome_strong },
	{ v: 2, label: m.rd_outcome_ok },
	{ v: 1, label: m.rd_outcome_flat },
	{ v: 0, label: m.rd_outcome_bailed },
];

function TodayScreen() {
	const fx = usePrototype();
	const t = fx.today;

	// The screen's own state over the snapshot — the fixture is read-only and
	// deliberately not a store (see its module header).
	const [answers, setAnswers] = useState<Answers>(t.answers);
	const [stale, setStale] = useState(false);
	const [done, setDone] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(t.tasks.map((task) => [task.exId, task.done])),
	);
	const [outcome, setOutcome] = useState<number | null>(null);
	const [mass, setMass] = useState('');
	const [massLogged, setMassLogged] = useState(false);
	const [carried, setCarried] = useState(false);
	const [deepOpen, setDeepOpen] = useState(false);

	const live = t.tasks.filter((task) => !task.held);
	const doneCount = live.filter((task) => done[task.exId]).length;
	const next = live.find((task) => !done[task.exId]);

	const trendValues = t.trendPoints.map((p) => p.value);
	const massValues = t.bodyweight.series.map((e) => e.v);

	return (
		<Frame>
			{/* 00 — the reading. */}
			<Section index="00" meta={`${t.weekdayLabel} · ${t.dateLabel}`} title={m.rd_score()}>
				<Row pad="none" tone="readout">
					<div className="ruled flex items-start gap-3 px-3 py-3">
						<Readout accent={t.verdict.color} size="hero" unit="/100" value={t.score} />
						<div className="min-w-0 flex-1 pt-1">
							<Lbl className="text-ink-faint">{VS_LABELS[t.vsBaseline]()}</Lbl>
							<div className="mt-1.5 space-y-1">
								<KV k={m.lbl_baseline()} v={t.baseline ?? '—'} />
								<KV k={m.readiness_trend()} v={t.trend ? TREND_LABELS[t.trend]() : '—'} />
							</div>
						</div>
					</div>
				</Row>
				<Row>
					<div className="flex items-baseline gap-2">
						<span
							aria-hidden="true"
							className="h-3 w-[3px] shrink-0 self-center"
							style={{ background: t.verdict.color }}
						/>
						<span className="min-w-0 text-[15px] text-ink leading-tight">{t.verdict.title}</span>
					</div>
					<Lbl className="mt-1 block">{t.verdict.tag}</Lbl>
					<Prose className="mt-2">{rich(t.verdict.text)}</Prose>
					<Chips accent={t.verdict.color} items={t.verdict.focus} />
				</Row>
				<Row>
					<Lbl className="text-ink-faint">
						{t.scoreNote === 'tuned' ? m.rd_note_tuned() : m.rd_note_heuristic()}
					</Lbl>
				</Row>
				{stale ? (
					<Row className="flex items-center gap-3">
						<span className="min-w-0 flex-1 text-[13px] text-flag leading-tight">
							{m.lbl_stale()}
						</span>
						<Bench kind="signal" onClick={() => setStale(false)}>
							{m.td_recheck()}
						</Bench>
					</Row>
				) : null}
			</Section>

			{/* 01 — the five wellness dimensions the score is made of. */}
			<Section index="01" meta={`${t.breakdown.length} / 5`} title={m.sec_breakdown()}>
				<Row className="space-y-2">
					{t.breakdown.map((d) => (
						<div key={d.id}>
							<div className="flex items-baseline justify-between gap-2">
								<Lbl>{DIM_LABELS[d.id]?.() ?? d.id}</Lbl>
								<span className="num text-[13px] text-ink">{d.value}</span>
							</div>
							<div className="mt-1">
								<Gauge accent={t.verdict.color} value={d.value} />
							</div>
						</div>
					))}
				</Row>
			</Section>

			{/* 02 — fourteen days of readings, as a trace. */}
			<Section index="02" meta={`${t.trendPoints.length} pt`} title={m.readiness_trend()}>
				<Row pad="none">
					<div className="px-3 pt-2">
						<Spark points={trendValues} />
					</div>
					<div className="flex items-baseline justify-between gap-2 px-3 pt-1 pb-2">
						<Lbl className="text-ink-faint">{t.trendPoints[0]?.label}</Lbl>
						<Lbl className="text-ink-faint">
							{Math.min(...trendValues)}–{Math.max(...trendValues)}
						</Lbl>
						<Lbl className="text-ink-faint">{t.trendPoints[t.trendPoints.length - 1]?.label}</Lbl>
					</div>
				</Row>
			</Section>

			{/* 03 — what slot this is. */}
			<Section accent={t.day.color} index="03" meta={t.day.load} title={m.wk_protocol()}>
				<Row>
					<Readout size="large" value={t.day.type} />
					<div className="mt-2 space-y-1">
						<KV k={m.wk_current_week()} v={`${t.week}/${t.blockWeeks}`} />
						<KV k={m.prog_phase()} v={m.week_label({ n: t.week })} />
					</div>
					<div className="mt-2 space-y-0.5 text-[13px] text-ink-dim leading-snug">
						<div>{t.day.prime}</div>
						<div className="text-ink-faint">{t.day.sec}</div>
					</div>
				</Row>
				<Row>
					<Lbl className="block text-ink">{t.phase.name}</Lbl>
					<Prose className="mt-1.5">{rich(t.phase.banner)}</Prose>
				</Row>
			</Section>

			{/* 04 — the work. Held rows stay on the screen, ruled out rather than
			    removed: the athlete has to see what the verdict took away. */}
			<Section index="04" meta={`${doneCount}/${live.length}`} title={m.sec_tasks()}>
				{t.tasks.map((task) => (
					<Row
						className="flex items-center gap-3"
						key={task.exId}
						tone={task.held ? 'held' : 'live'}
					>
						{task.held ? (
							<span aria-hidden="true" className="h-6 w-6 shrink-0 border border-line" />
						) : (
							<Tick
								label={task.label}
								on={Boolean(done[task.exId])}
								onToggle={() => setDone((d) => ({ ...d, [task.exId]: !d[task.exId] }))}
							/>
						)}
						<div className="min-w-0 flex-1">
							<div
								className={`text-[14px] leading-tight ${
									task.held ? 'text-ink-faint line-through' : 'text-ink'
								}`}
							>
								{task.label}
							</div>
							{task.held ? <Lbl className="mt-0.5 block text-flag">{m.td_held()}</Lbl> : null}
						</div>
						<Lbl className="shrink-0 text-ink-faint">{task.exId}</Lbl>
					</Row>
				))}
				<Row className="flex items-center gap-3">
					<div className="min-w-0 flex-1">
						{next ? (
							<>
								<Lbl className="block">{m.td_applies()}</Lbl>
								<div className="mt-0.5 text-[14px] text-ink leading-tight">{next.label}</div>
							</>
						) : (
							<span className="text-[13px] text-ink-dim leading-tight">{m.td_all_done()}</span>
						)}
					</div>
					<Link
						className="lbl lbl-tight inline-flex min-h-[38px] shrink-0 items-center border border-ink bg-ink px-3 text-bg"
						to="/train"
					>
						{m.td_open_train()}
					</Link>
				</Row>
			</Section>

			{/* 05 — yesterday's untrained slot. */}
			{t.missed ? (
				<Section index="05" meta={t.missed.weekdayLabel} title={m.sec_carry()}>
					<Row tone={carried ? 'held' : 'live'}>
						<Prose>{m.td_missed({ day: t.missed.weekdayLabel })}</Prose>
						<div className="mt-1.5 space-y-0.5">
							{t.missed.labels.map((label) => (
								<div className="text-[13px] text-ink leading-tight" key={label}>
									{label}
								</div>
							))}
						</div>
						<Bench
							className="mt-2"
							kind={carried ? 'spent' : 'plain'}
							onClick={() => setCarried(true)}
							wide
						>
							{m.td_missed_do()}
						</Bench>
					</Row>
				</Section>
			) : null}

			{/* 06 — the flags, with their advice. */}
			<Section index="06" meta={String(t.flags.length)} title={m.flags_heading()}>
				{t.flags.map((flag) => (
					<Row key={flag.id}>
						<div className="flex items-baseline gap-2">
							<span
								aria-hidden="true"
								className="h-3 w-[3px] shrink-0 self-center"
								style={{
									background: flag.severity === 'warn' ? 'var(--flag)' : 'var(--ink-faint)',
								}}
							/>
							<span className="min-w-0 flex-1 text-[14px] text-ink leading-tight">
								{flag.title}
							</span>
							<Lbl className="shrink-0 text-ink-faint">{flag.severity}</Lbl>
						</div>
						<Prose className="mt-1.5">{rich(flag.text)}</Prose>
						<Chips items={flag.focus} />
					</Row>
				))}
			</Section>

			{/* 07 — the check itself, adaptive follow-ups and all. */}
			<Section index="07" meta={m.sec_today()} title={m.sec_check()}>
				<Row pad="none">
					<ReadinessCheck
						answers={answers}
						onAnswer={(id, value) => {
							setAnswers((a) => ({ ...a, [id]: value }));
							setStale(true);
						}}
					/>
				</Row>
			</Section>

			{/* 08 — how the last session actually went. */}
			<Section index="08" title={m.sec_session()}>
				<Row>
					<Prose>{m.rd_outcome_q()}</Prose>
					<div className="mt-2 grid grid-cols-2 gap-px bg-line">
						{OUTCOMES.map((o) => (
							<Bench
								key={o.v}
								kind={outcome === o.v ? 'solid' : 'plain'}
								onClick={() => setOutcome(o.v)}
								wide
							>
								{o.label()}
							</Bench>
						))}
					</div>
					{outcome != null ? (
						<Lbl className="mt-2 block text-ink-faint">{m.rd_outcome_saved()}</Lbl>
					) : null}
				</Row>
			</Section>

			{/* 09 — the counters. */}
			<Section index="09" title={m.sec_counters()}>
				<Row className="grid grid-cols-3 gap-px bg-line" pad="none">
					<div className="bg-bg px-3 py-2">
						<Readout caption={m.stat_streak()} size="large" value={t.stats.streak} />
					</div>
					<div className="bg-bg px-3 py-2">
						<Readout caption={m.stat_week_sessions()} size="large" value={t.stats.last7} />
					</div>
					<div className="bg-bg px-3 py-2">
						<Readout caption={m.stat_total()} size="large" value={t.stats.total} />
					</div>
				</Row>
			</Section>

			{/* 10 — bodyweight (ADR 0009: a series, not a marker). */}
			<Section index="10" meta={`${t.bodyweight.series.length} pt`} title={m.field_bodyweight()}>
				<Row pad="none">
					<div className="flex items-end gap-3 px-3 pt-2">
						<Readout size="large" unit="kg" value={round(t.bodyweight.latestKg)} />
						<div className="min-w-0 flex-1">
							<Spark accent="--teal" height={32} points={massValues} />
						</div>
					</div>
					<div className="flex items-end gap-3 px-3 pt-2 pb-2">
						<label className="min-w-0 flex-1" htmlFor="bw">
							<Lbl className="block">{m.bw_prompt()}</Lbl>
							<input
								className="bench-input mt-1"
								id="bw"
								inputMode="decimal"
								onChange={(e) => setMass(e.target.value)}
								placeholder={String(round(t.bodyweight.latestKg))}
								value={mass}
							/>
						</label>
						<Bench
							kind={massLogged ? 'spent' : 'plain'}
							onClick={() => setMassLogged(mass.trim().length > 0)}
						>
							{m.btn_save()}
						</Bench>
					</div>
				</Row>
			</Section>

			{/* 11 — the rehab entry point. */}
			<Section index="11" meta={m.rehab_label()} title={m.rehab_title()}>
				<Row>
					<Prose>{m.rehab_desc()}</Prose>
					<Bench className="mt-2" wide>
						{m.rehab_start()}
					</Bench>
				</Row>
			</Section>

			{/* 12 — the deep injury self-check. */}
			<Section index="12" meta={t.deep.area} title={m.flag_deep()}>
				<Row>
					<div className="text-[14px] text-ink leading-tight">{t.deep.assessment.title}</div>
					<Prose className="mt-1.5">{t.deep.assessment.intro}</Prose>
					<div className="mt-2 space-y-1">
						<KV k={m.deep_result()} v={BAND_LABELS[t.deep.last.band]?.() ?? t.deep.last.band} />
						<KV
							k={m.deep_last({ score: t.deep.last.score, date: t.deep.last.date })}
							v={t.deep.last.score}
						/>
					</div>
					<Lbl className="mt-2 block text-ink-faint">
						{m.deep_based_on({ source: t.deep.assessment.source })}
					</Lbl>
					<a
						className="lbl mt-1 inline-block text-flag underline"
						href={t.deep.assessment.url}
						rel="noreferrer"
						target="_blank"
					>
						{m.deep_source_link()}
					</a>
					<Bench className="mt-2" onClick={() => setDeepOpen((v) => !v)} wide>
						{deepOpen ? m.btn_close() : m.assess_test_it()}
					</Bench>
				</Row>
				{deepOpen
					? t.deep.assessment.questions.map((q) => (
							<Row key={q.id}>
								<div className="text-[13px] text-ink leading-snug">{q.q}</div>
								<div className="mt-1.5 flex flex-wrap gap-1">
									{q.a.map((o) => (
										<span
											className="lbl lbl-tight border border-line px-1.5 py-0.5 text-ink-dim"
											key={`${q.id}-${o.v}`}
										>
											{o.t}
										</span>
									))}
								</div>
							</Row>
						))
					: null}
			</Section>
		</Frame>
	);
}
