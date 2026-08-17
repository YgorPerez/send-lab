// TODAY — Direction D.
//
// The densest screen in the slice, rendered at this direction's sizes. Order is
// deliberate: what the app *decided* first, what it wants the athlete to *do*
// next, then the readouts, then the entry points. Nothing here is a link into a
// menu; every secondary surface arrives as a sheet from the bottom.
import { createFileRoute, Link } from '@tanstack/react-router';
import {
	Activity,
	ChevronRight,
	ChevronsRight,
	HeartPulse,
	Scale,
	Stethoscope,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import { STUDIES } from '$lib/studies';
import { EdgeGuardProbe } from '../components/EdgeGuardProbe';
import { Latch } from '../components/Latch';
import { bigButton, Head, Panel, pill, Rich } from '../components/physical';
import { Sheet } from '../components/Sheet';
import { getPrototypeFixtures } from '../prototype-fixtures';

export const Route = createFileRoute('/')({ component: Today });

const DIMENSION_LABEL: Record<string, () => string> = {
	sleep: () => m.rd_sleep(),
	fatigue: () => m.rd_fatigue(),
	soreness: () => m.rd_soreness(),
	stress: () => m.rd_stress(),
	mood: () => m.rd_mood(),
};

/** Bar height for one bodyweight reading, scaled against the series' own spread. */
function bodyweightPct(value: number, series: { v: number }[]): number {
	const values = series.map((entry) => entry.v);
	const min = Math.min(...values);
	const max = Math.max(...values);
	if (max === min) return 60;
	return 25 + ((value - min) / (max - min)) * 75;
}

const OUTCOMES = [
	{ value: 3, label: () => m.rd_outcome_strong() },
	{ value: 2, label: () => m.rd_outcome_ok() },
	{ value: 1, label: () => m.rd_outcome_flat() },
	{ value: 0, label: () => m.rd_outcome_bailed() },
];

function Today() {
	// One snapshot per mount. Switching locale reloads the page (Paraglide's
	// `setLocale`), so there is no stale-content case to guard against.
	const fx = useMemo(() => getPrototypeFixtures(), []);
	const t = fx.today;

	const [done, setDone] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(t.tasks.map((task) => [task.exId, task.done])),
	);
	const [answers, setAnswers] = useState<Record<string, number>>(() =>
		Object.fromEntries(t.questions.map((q) => [q.id, q.answer ?? -1])),
	);
	const [outcome, setOutcome] = useState<number | null>(null);
	const [bodyweight, setBodyweight] = useState<string>('');
	const [bwLogged, setBwLogged] = useState(false);
	const [missedTaken, setMissedTaken] = useState(false);
	const [checkOpen, setCheckOpen] = useState(false);
	const [deepOpen, setDeepOpen] = useState(false);
	const [heldInfo, setHeldInfo] = useState<string | null>(null);

	const nextTask = t.tasks.find((task) => !done[task.exId] && !task.held) ?? t.tasks[0];
	const trendLabel =
		t.trend === 'up' ? m.trend_up() : t.trend === 'down' ? m.trend_down() : m.trend_flat();
	const vsBaseline =
		t.vsBaseline === 'below'
			? m.rd_vs_below()
			: t.vsBaseline === 'above'
				? m.rd_vs_above()
				: m.rd_vs_usual();

	return (
		<>
			{/* ── the verdict ─────────────────────────────────────────────────── */}
			<section className="mt-4">
				<Panel accent={t.day.color} className="py-4 pr-4 pl-5">
					<div className="flex flex-wrap items-center gap-2">
						<span className={pill({ tone: 'chalk' })}>{t.day.type}</span>
						<span className={pill({ tone: 'hot' })}>{t.day.load}</span>
						<span className={pill()}>{m.week_label({ n: t.week })}</span>
						<span className={pill()}>{t.dateLabel}</span>
					</div>

					<div className="mt-4 flex items-end gap-4">
						<div className="well shrink-0 rounded-lg px-4 py-3 text-center">
							<p className="font-mono text-[46px] leading-none font-bold tracking-tighter text-flag">
								{t.score}
							</p>
							<p className="mt-1 font-mono text-[10px] tracking-widest text-ink-faint uppercase">
								{m.rd_score()}
							</p>
						</div>
						<div className="min-w-0 flex-1">
							<p className="text-[20px] leading-[1.1] font-bold tracking-tight text-balance text-ink">
								{t.verdict.title}
							</p>
							<p className="mt-1 text-[13px] leading-snug text-ink-dim">
								{vsBaseline}
								{t.baseline == null ? '' : ` · ${t.baseline}`} · {trendLabel}
							</p>
						</div>
					</div>

					<div className="mt-3 flex flex-wrap gap-2">
						<span className={pill({ tone: 'gold' })}>{t.verdict.tag}</span>
						{t.verdict.focus.map((f) => (
							<span key={f} className={pill()}>
								{f}
							</span>
						))}
					</div>

					<Rich className="mt-3 text-[14px] leading-relaxed text-ink" html={t.verdict.text} />

					<p className="mt-3 border-t border-line pt-3 text-[12px] leading-snug text-ink-faint">
						{t.scoreNote === 'tuned' ? m.rd_note_tuned() : m.rd_note_heuristic()}
					</p>

					<div className="mt-3 flex items-center gap-2 text-[13px] text-ink-dim">
						<Activity className="size-4 shrink-0 text-flag" strokeWidth={2.5} />
						<span className="min-w-0">
							{m.td_applies()} <strong className="text-ink">{nextTask?.label}</strong>
						</span>
					</div>

					{/* The second way into Train, from the content rather than the rail —
					    and the one that shows the screen transition on a real intent. */}
					<Link to="/train" className={bigButton({ tone: 'hot', class: 'mt-3' })}>
						{m.td_open_train()} · {m.td_next_task()}
						<ChevronRight className="size-5 shrink-0" strokeWidth={2.75} />
					</Link>
				</Panel>

				<Panel className="mt-2 p-3">
					<p className="text-[13px] leading-snug text-ink-dim">{t.phase.name}</p>
					<Rich className="mt-1 text-[13px] leading-snug text-ink" html={t.phase.banner} />
					<p className="mt-2 text-[12px] leading-snug text-ink-faint">
						{t.day.prime} · {t.day.sec}
					</p>
				</Panel>
			</section>

			{/* ── tasks: the latch ────────────────────────────────────────────── */}
			<Head right={<span>{t.tasks.length - t.held.length}</span>}>{m.tasks_heading()}</Head>
			{/* Discoverability for the drag, and the statement that it is optional.
			    The gesture is never the only way in — the same knob is a button. */}
			<p className="mb-2 flex items-center gap-2 px-1 text-[12px] leading-snug text-ink-faint">
				<ChevronsRight className="size-4 shrink-0 text-flag" strokeWidth={3} />
				{m.swipe_tick()}
			</p>
			<div className="flex flex-col gap-2">
				{t.tasks
					.filter((task) => !task.held)
					.map((task) => (
						<Latch
							key={task.exId}
							label={task.label}
							checked={done[task.exId] ?? false}
							accent={`var(${fx.train.items.find((i) => i.exId === task.exId)?.catVar ?? '--flag'})`}
							onChange={(next) => setDone((prev) => ({ ...prev, [task.exId]: next }))}
							onInfo={() => setHeldInfo(task.exId)}
							infoLabel={m.show_more()}
						/>
					))}
			</div>

			{/* Held work is on the screen, locked — not hidden. CONTEXT.md: held,
			    not cancelled; it comes back as carry-forward. */}
			<Head right={<span>{t.held.length}</span>}>{m.held_heading()}</Head>
			<div className="flex flex-col gap-2">
				{t.held.map((task) => (
					<Latch
						key={task.exId}
						label={task.label}
						sub={t.verdict.title}
						locked
						tag={m.td_held()}
						accent="var(--gold)"
						checked={false}
						onChange={() => {}}
						onInfo={() => setHeldInfo(task.exId)}
						infoLabel={m.show_more()}
					/>
				))}
			</div>

			{/* ── carry-forward ───────────────────────────────────────────────── */}
			<Head>{m.td_missed_do()}</Head>
			<Panel className="p-3">
				<p className="text-[14px] leading-snug text-ink-dim">
					{m.td_missed({ day: t.missed?.weekdayLabel ?? '' })}
				</p>
				<p className="mt-1 text-[15px] leading-snug font-semibold text-ink">
					{t.missed?.labels.join(' · ')}
				</p>
				<button
					type="button"
					className={bigButton({ tone: missedTaken ? 'plain' : 'hot', class: 'mt-3' })}
					onClick={() => setMissedTaken((v) => !v)}
				>
					{missedTaken ? m.lbl_done() : m.td_missed_do()}
				</button>
			</Panel>

			{/* ── readiness readouts ──────────────────────────────────────────── */}
			<Head right={<span>{`${t.trendPoints.length}`}</span>}>{m.readiness_trend()}</Head>
			<Panel className="p-3">
				<div className="well flex h-24 items-end gap-[3px] rounded-md p-2">
					{t.trendPoints.map((point) => (
						<span
							key={point.label}
							className="min-w-0 flex-1 rounded-t-[3px] bg-flag/70"
							style={{ height: `${Math.max(6, point.value)}%` }}
							title={`${point.label} · ${point.value}`}
						/>
					))}
				</div>
				<div className="mt-2 flex justify-between font-mono text-[10px] tracking-wider text-ink-faint uppercase">
					<span>{t.trendPoints[0]?.label}</span>
					<span>{t.trendPoints[t.trendPoints.length - 1]?.label}</span>
				</div>
			</Panel>

			<Head>{m.breakdown_heading()}</Head>
			<Panel className="p-3">
				{t.breakdown.map((dim) => (
					<div key={dim.id} className="mt-2 first:mt-0">
						<div className="flex items-baseline justify-between">
							<span className="text-[13px] text-ink-dim">
								{DIMENSION_LABEL[dim.id]?.() ?? dim.id}
							</span>
							<span className="font-mono text-[13px] font-bold text-ink">{dim.value}</span>
						</div>
						<div className="well mt-1 h-3 overflow-hidden rounded-full">
							<span
								className="block h-full rounded-full bg-flag"
								style={{ width: `${dim.value * 10}%` }}
							/>
						</div>
					</div>
				))}
				<button
					type="button"
					className={bigButton({ tone: 'hot', class: 'mt-4' })}
					onClick={() => setCheckOpen(true)}
				>
					<HeartPulse className="size-5 shrink-0" strokeWidth={2.5} />
					{m.open_check()}
				</button>
				<p className="mt-2 text-center text-[12px] text-ink-faint">{m.td_recheck()}</p>
			</Panel>

			{/* ── outcome capture ─────────────────────────────────────────────── */}
			{t.awaitingOutcome ? (
				<>
					<Head>{m.rd_outcome_q()}</Head>
					<div className="grid grid-cols-2 gap-2">
						{OUTCOMES.map((option) => (
							<button
								key={option.value}
								type="button"
								aria-pressed={outcome === option.value}
								className={bigButton({ tone: outcome === option.value ? 'hot' : 'plain' })}
								onClick={() => setOutcome(option.value)}
							>
								{option.label()}
							</button>
						))}
					</div>
					{outcome == null ? null : (
						<p className="mt-2 px-1 text-[12px] text-teal">{m.rd_outcome_saved()}</p>
					)}
				</>
			) : null}

			{/* ── stats ───────────────────────────────────────────────────────── */}
			<Head>{m.sec_stats()}</Head>
			<div className="grid grid-cols-3 gap-2">
				{[
					{ value: t.stats.streak, label: m.stat_streak() },
					{ value: t.stats.last7, label: m.stat_week_sessions() },
					{ value: t.stats.total, label: m.stat_total() },
				].map((stat) => (
					<Panel key={stat.label} className="px-2 py-3 text-center">
						<p className="font-mono text-[30px] leading-none font-bold text-chalk">{stat.value}</p>
						<p className="mt-1.5 text-[11px] leading-tight text-ink-faint">{stat.label}</p>
					</Panel>
				))}
			</div>

			{/* ── bodyweight (ADR 0009 — writes to the bodyweight series) ─────── */}
			<Head right={<span>{m.bw_last({ kg: t.bodyweight.latestKg })}</span>}>
				{m.field_bodyweight()}
			</Head>
			<Panel className="p-3">
				<div className="flex h-12 items-end gap-1">
					{t.bodyweight.series.map((entry) => (
						<span
							key={entry.at}
							className="min-w-0 flex-1 rounded-t-[3px] bg-teal/70"
							// Scaled against the series' own range, not an absolute zero:
							// bodyweight moves by under a kilo here and a zero-based axis
							// would draw seven identical bars.
							style={{ height: `${bodyweightPct(entry.v, t.bodyweight.series)}%` }}
						/>
					))}
				</div>
				{t.bodyweight.promptToday ? (
					<div className="mt-3 flex items-stretch gap-2">
						<label className="well flex min-w-0 flex-1 items-center gap-2 rounded-md px-3">
							<Scale className="size-5 shrink-0 text-ink-faint" strokeWidth={2.5} />
							<span className="sr-only">{m.bw_prompt()}</span>
							<input
								type="number"
								inputMode="decimal"
								step="0.1"
								value={bodyweight}
								placeholder={String(t.bodyweight.latestKg)}
								onChange={(e) => setBodyweight(e.target.value)}
								className="min-h-[56px] w-full bg-transparent font-mono text-base font-bold text-ink outline-none"
							/>
						</label>
						<button
							type="button"
							disabled={!bodyweight}
							className={bigButton({ tone: 'hot', wide: false, class: 'px-5' })}
							onClick={() => setBwLogged(true)}
						>
							{bwLogged ? m.lbl_done() : m.btn_save()}
						</button>
					</div>
				) : null}
			</Panel>

			{/* ── flags ───────────────────────────────────────────────────────── */}
			<Head right={<span>{t.flags.length}</span>}>{m.flags_heading()}</Head>
			<div className="flex flex-col gap-2">
				{t.flags.map((flag) => (
					<Panel
						key={flag.id}
						accent={flag.severity === 'warn' ? 'var(--flag)' : 'var(--gold)'}
						className="py-3 pr-3 pl-5"
					>
						<p className="text-[16px] leading-tight font-bold tracking-tight text-ink">
							{flag.title}
						</p>
						<Rich className="mt-1 text-[13px] leading-snug text-ink-dim" html={flag.text} />
						<div className="mt-2 flex flex-wrap gap-1.5">
							{flag.focus.map((f) => (
								<span key={f} className={pill({ tone: flag.severity === 'warn' ? 'hot' : 'gold' })}>
									{f}
								</span>
							))}
						</div>
					</Panel>
				))}
			</div>

			{/* ── the two entry points that are not tasks ─────────────────────── */}
			<Head>{m.rehab_title()}</Head>
			<div className="flex flex-col gap-2">
				<Panel className="p-3">
					<p className="text-[13px] leading-snug text-ink-dim">{m.rehab_desc()}</p>
					<button type="button" className={bigButton({ class: 'mt-3' })}>
						<Stethoscope className="size-5 shrink-0" strokeWidth={2.5} />
						{m.rehab_start()}
					</button>
				</Panel>

				<Panel accent="var(--teal)" className="py-3 pr-3 pl-5">
					<p className="text-[16px] leading-tight font-bold text-ink">{t.deep.assessment.title}</p>
					<p className="mt-1 text-[12px] text-ink-faint">
						{m.deep_last({ score: t.deep.last.score, date: t.deep.last.date })}
					</p>
					<button
						type="button"
						className={bigButton({ class: 'mt-3' })}
						onClick={() => setDeepOpen(true)}
					>
						{m.flag_deep()}
						<ChevronRight className="size-5 shrink-0" strokeWidth={2.5} />
					</button>
				</Panel>
			</div>

			{/* ── the instrument that answers the ticket's open question ──────── */}
			<EdgeGuardProbe />

			{/* ── sheets ──────────────────────────────────────────────────────── */}
			<Sheet
				open={checkOpen}
				onOpenChange={setCheckOpen}
				title={m.sec_today()}
				description={m.log_rd_responses()}
			>
				{t.questions.map((question) => {
					const study = question.study ? STUDIES.find((s) => s.id === question.study) : undefined;
					return (
						<div
							key={question.id}
							className={`mt-4 first:mt-0 ${question.sub ? 'border-l-[5px] border-l-gold pl-3' : ''}`}
						>
							<p className="text-[16px] leading-snug font-semibold text-ink">{question.question}</p>
							{question.why ? (
								<p className="mt-1 text-[12px] leading-snug text-ink-faint">{question.why}</p>
							) : null}
							{study ? (
								<p className="mt-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
									{m.rd_evidence()} · {study.authors} · {study.year}
								</p>
							) : null}
							<div className="mt-2 flex flex-col gap-2">
								{question.options.map((option) => {
									const on = answers[question.id] === option.value;
									return (
										<button
											key={option.label}
											type="button"
											aria-pressed={on}
											className={bigButton({ tone: on ? 'hot' : 'plain', class: 'justify-start' })}
											onClick={() =>
												setAnswers((prev) => ({ ...prev, [question.id]: option.value }))
											}
										>
											{option.label}
										</button>
									);
								})}
							</div>
						</div>
					);
				})}
			</Sheet>

			<Sheet
				open={deepOpen}
				onOpenChange={setDeepOpen}
				title={t.deep.assessment.title}
				description={m.deep_based_on({ source: t.deep.assessment.source })}
			>
				<p className="text-[13px] leading-snug text-ink-dim">{t.deep.assessment.intro}</p>
				<p className="mt-2 text-[12px] text-teal">
					{m.deep_last({ score: t.deep.last.score, date: t.deep.last.date })}
				</p>
				{t.deep.assessment.questions.map((question) => (
					<div key={question.id} className="mt-4">
						<p className="text-[16px] leading-snug font-semibold text-ink">{question.q}</p>
						<div className="mt-2 flex flex-col gap-2">
							{question.a.map((option) => (
								<button
									key={option.t}
									type="button"
									className={bigButton({ class: 'justify-start' })}
								>
									{option.t}
								</button>
							))}
						</div>
					</div>
				))}
			</Sheet>

			<Sheet
				open={heldInfo != null}
				onOpenChange={(next) => {
					if (!next) setHeldInfo(null);
				}}
				title={t.tasks.find((task) => task.exId === heldInfo)?.label ?? ''}
				description={t.verdict.tag}
			>
				<Rich className="text-[14px] leading-relaxed text-ink" html={t.verdict.text} />
				<p className="mt-3 text-[13px] leading-snug text-ink-dim">{m.td_held()}</p>
				<div className="mt-2 flex flex-wrap gap-1.5">
					{t.verdict.focus.map((f) => (
						<span key={f} className={pill({ tone: 'gold' })}>
							{f}
						</span>
					))}
				</div>
			</Sheet>
		</>
	);
}
