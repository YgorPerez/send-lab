// TODAY — Direction A.
//
// The screen that decides whether "dense and calm" survives contact with a
// phone. It carries, in one scroll: the read, the five wellness dimensions
// behind it, the plan and the work the read holds back, the carry-forward from
// a missed day, three counters, a fourteen-point trend, two watch-outs with
// their advice, a nine-question check, the bodyweight nudge, and two injury
// entry points.
//
// The ordering rule is *decision first, evidence second, input last*: the
// verdict is the top of the screen because it is the answer; the check that
// produced it is near the bottom because it is already answered. That inverts
// the SvelteKit screen, where the quiz came first and the athlete scrolled past
// nine questions to reach the one line they opened the app for.
//
// The screen is genuinely live. It re-runs the real `computeReadiness` against
// whatever the check currently says, using the same load signals and personal
// baseline the fixture derived — so changing an answer moves the score, the
// verdict, the watch-outs and which exercises the plan holds back. #42 puts the
// training logic out of scope for the redesign; this renders it rather than
// re-deciding it.
import { createFileRoute, Link } from '@tanstack/react-router';
import { Check, ChevronRight, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
	type Answers,
	computeReadiness,
	type FlagArea,
	getContent,
	visibleQuestionsOrdered,
} from '$lib/content';
import * as m from '$lib/paraglide/messages';
import { capByVerdict } from '$lib/readinessPlan';
import { acwr, readinessInsights, weekLoad } from '$lib/stats';
import { cn } from '$lib/utils';
import { OUTCOME_LABEL, WELLNESS_LABEL } from '../components/format';
import { DeepCheckSheet, RehabStarter } from '../components/InjurySection';
import { ReadinessCheck } from '../components/ReadinessCheck';
import { Sparkline } from '../components/Sparkline';
import {
	Bare,
	button,
	card,
	chip,
	Eyebrow,
	input,
	Meter,
	Prose,
	Section,
	Stat,
} from '../components/ui';
import { getPrototypeFixtures, type QuizFixture } from '../prototype-fixtures';

export const Route = createFileRoute('/')({ component: Today });

/** Severity → surface tone. `info` deliberately gets no tint: three tinted
 *  panels in a row is how a calm screen turns into a warning screen. */
const FLAG_CARD = { stop: 'stop', warn: 'warn', info: 'plain' } as const;
const FLAG_CHIP = { stop: 'stop', warn: 'warn', info: 'neutral' } as const;

function Today() {
	const now = useMemo(() => Date.now(), []);
	const fx = useMemo(() => getPrototypeFixtures(now), [now]);
	const content = useMemo(() => getContent(), []);
	const t = fx.today;

	const [answers, setAnswers] = useState<Answers>(t.answers);
	const [done, setDone] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(t.tasks.map((task) => [task.exId, task.done])),
	);
	const [outcome, setOutcome] = useState<number | null>(null);
	const [missedTaken, setMissedTaken] = useState(false);
	const [bw, setBw] = useState('');
	const [bwLogged, setBwLogged] = useState(false);
	const [deepOpen, setDeepOpen] = useState(false);
	const [checkOpen, setCheckOpen] = useState(true);

	// The same inputs the fixture used, re-derived so the check is live: load
	// signals read the history *behind* today (a session logged today cannot be
	// part of the load that decided whether to train today), and the personal
	// baseline reads the logged checks, which likewise exclude today's.
	const { readiness, insights } = useMemo(() => {
		const history = fx.state.workouts.filter((w) => w.at !== t.iso);
		const ins = readinessInsights(fx.state.readinessLog);
		const load = {
			acwr: acwr(history, now)?.status ?? null,
			monotony: weekLoad(history, now)?.status === 'monotonous' ? ('high' as const) : null,
		};
		return { readiness: computeReadiness(answers, load, ins), insights: ins };
	}, [answers, fx, t.iso, now]);

	const verdict = content.verdicts[readiness.verdict];
	const heldSet = useMemo(
		() =>
			new Set(
				capByVerdict(
					t.tasks.map((x) => x.exId),
					readiness.verdict,
				).held,
			),
		[t.tasks, readiness.verdict],
	);

	// Follow-ups appear and disappear as the core answers change, so the rendered
	// list is rebuilt from the same `visibleQuestionsOrdered` the app uses rather
	// than from the fixture's frozen snapshot.
	const questions = useMemo<QuizFixture[]>(
		() =>
			visibleQuestionsOrdered(answers).map(({ id, sub }) => {
				const q = content.quiz.find((x) => x.id === id);
				return {
					id,
					sub,
					question: q?.q ?? id,
					...(q?.why ? { why: q.why } : {}),
					...(q?.study ? { study: q.study } : {}),
					options: (q?.a ?? []).map((o) => ({ label: o.t, value: o.v })),
					answer: answers[id] ?? null,
				};
			}),
		[answers, content],
	);
	const answered = questions.filter((q) => q.answer != null).length;

	const delta = insights.baseline == null ? 0 : readiness.score - insights.baseline;
	const vsBaseline =
		delta <= -10 ? m.rd_vs_below() : delta >= 10 ? m.rd_vs_above() : m.rd_vs_usual();
	const breakdown = ['sleep', 'fatigue', 'soreness', 'stress', 'mood']
		.filter((id) => answers[id] != null)
		.map((id) => ({ id, value: answers[id] }));
	const nextTask = t.tasks.find((x) => !done[x.exId] && !heldSet.has(x.exId));
	const bwSeries = t.bodyweight.series;
	const bwDelta = bwSeries.length > 1 ? t.bodyweight.latestKg - bwSeries[0].v : 0;

	return (
		// `gap-7` between sections, not `gap-4`. The screen carries the same eight
		// things it always did; what changed is that the space between them is now
		// bigger than the space inside them, which is what makes them read as eight
		// things rather than as one column of rows.
		<div className="flex flex-col gap-7">
			{/* ---- day header. Two lines, no card: the frame for everything below. */}
			<header className="flex items-baseline justify-between gap-2 pt-1.5">
				<div className="min-w-0">
					<h1 className="h-screen-title">
						{m.td_today_label()} · {t.weekdayLabel}
					</h1>
					<p className="num mt-1 truncate text-[11px] text-ink-faint">{t.dateLabel}</p>
				</div>
				<span className="num shrink-0 text-[11px] text-ink-faint">
					{m.week_label({ n: t.week })}
				</span>
			</header>

			{/* ---- the read. The anchor of the screen and the only place a 30px
			     number appears; everything else is 22px or smaller. */}
			<div className={card({ pad: 'none' })}>
				<div className="flex items-start gap-2.5 p-3.5">
					<span
						className="mt-1.5 size-2.5 shrink-0 rounded-full"
						style={{ background: verdict.color }}
					/>
					<div className="min-w-0 flex-1">
						<h2 className="text-[15px] leading-tight font-semibold text-ink">{verdict.title}</h2>
						<Eyebrow className="mt-0.5">{verdict.tag}</Eyebrow>
					</div>
					<div className="shrink-0 text-right">
						<div className="num text-[30px] leading-none font-bold text-chalk">
							{readiness.score}
						</div>
						<Eyebrow className="mt-0.5">{m.rd_score()}</Eyebrow>
						<div className="mt-0.5 text-[10px] text-ink-faint">{vsBaseline}</div>
					</div>
				</div>

				<div className="border-t border-line-soft px-3.5 py-3">
					<p className="prose-inline text-[13px] leading-snug text-ink-dim">
						<Prose value={verdict.text} />
					</p>
					<div className="mt-2 flex flex-wrap gap-1">
						{verdict.focus.map((f, i) => (
							<span key={f} className={chip({ tone: i === 0 ? 'stop' : 'neutral' })}>
								<Prose value={f} />
							</span>
						))}
					</div>
				</div>

				{/* The five wellness dimensions, one per line. Two columns would fit
				    in English and clip "Recuperação" in pt-BR; five 18px rows is the
				    price of a breakdown that is readable in both. */}
				<div className="flex flex-col gap-1 border-t border-line-soft px-3.5 py-3">
					{breakdown.map((b) => (
						<Meter key={b.id} label={WELLNESS_LABEL[b.id]?.() ?? b.id} value={b.value} />
					))}
					<p className="mt-1.5 text-[10.5px] leading-snug text-ink-faint italic">
						{t.scoreNote === 'tuned' ? m.rd_note_tuned() : m.rd_note_heuristic()}
					</p>
					{/* Was its own rule-separated strip. It is a footnote on the read, so
					    it now sits inside the read rather than under another hairline. */}
					{nextTask ? (
						<p className="mt-2 text-[12px] text-ink-faint">
							{m.td_applies()} <b className="font-semibold text-chalk">{nextTask.label}</b>
						</p>
					) : null}
				</div>
			</div>

			{/* Post-session outcome: the input that turns the heuristic weighting into
			    a personal one.

			    Lifted out of the read card. It was the fifth rule-separated block
			    inside it, and it is the one thing on this screen that is answered
			    *after* training — sitting inside the morning's read, under its own
			    hairline, it read as another part of the verdict. Its own section, its
			    own heading, no box: the heading is the question. */}
			<Section label={m.rd_outcome_q()}>
				<div className="grid grid-cols-4 gap-1">
					{[3, 2, 1, 0].map((v) => (
						<button
							key={v}
							type="button"
							aria-pressed={outcome === v}
							onClick={() => setOutcome(v)}
							className={button({
								kind: 'quiet',
								class: cn('px-1 text-[12px]', outcome === v && 'border-teal/50 text-teal'),
							})}
						>
							{OUTCOME_LABEL[v]()}
						</button>
					))}
				</div>
				{outcome != null ? <p className="text-[11px] text-teal">{m.rd_outcome_saved()}</p> : null}
			</Section>

			{/* ---- the plan. */}
			<Section
				label={`${t.day.type} · ${t.day.load}`}
				meta={
					<Link to="/train" className="text-ink-dim">
						{m.btn_view_protocol()}
					</Link>
				}
			>
				<div className={card({ pad: 'none' })}>
					{/* The block phase belongs here, not in the page header: it is the
					    reason today's prescription looks the way it does, and in the
					    header it was a truncated fragment next to the date. */}
					<div className="border-b border-line-soft px-3 py-2">
						<p className="text-[11.5px] leading-snug font-medium text-chalk">{t.phase.name}</p>
						<p className="mt-0.5 text-[11px] leading-snug text-ink-faint">{t.phase.banner}</p>
						<p className="mt-1 text-[11px] leading-snug text-ink-faint">
							{t.day.prime} · {t.day.sec}
						</p>
					</div>
					<ul>
						{t.tasks.map((task) => {
							const isDone = done[task.exId];
							const held = heldSet.has(task.exId) && !isDone;
							return (
								<li
									key={task.exId}
									className={cn(
										'flex items-center gap-2 border-b border-line-soft px-3 py-2 last:border-b-0',
										held && 'bg-panel-2/40',
									)}
								>
									<button
										type="button"
										aria-pressed={isDone}
										aria-label={task.label}
										onClick={() => setDone((p) => ({ ...p, [task.exId]: !p[task.exId] }))}
										className={cn(
											'flex size-[22px] shrink-0 items-center justify-center rounded-md border transition-colors',
											isDone
												? 'border-teal/60 bg-teal/15 text-teal'
												: 'border-line text-transparent',
										)}
									>
										<Check size={13} strokeWidth={2.6} />
									</button>
									<span
										className={cn(
											'min-w-0 flex-1 truncate text-[13.5px]',
											isDone ? 'text-ink-faint line-through' : held ? 'text-ink-faint' : 'text-ink',
										)}
									>
										{task.label}
									</span>
									{held ? (
										<span className={chip({ tone: 'warn' })}>{m.td_held()}</span>
									) : isDone ? (
										<span className={chip({ tone: 'ok' })}>{m.lbl_done()}</span>
									) : (
										<Link
											to="/train"
											className="flex shrink-0 items-center gap-0.5 text-[11px] text-ink-dim"
										>
											{m.td_open_train()}
											<ChevronRight size={13} />
										</Link>
									)}
								</li>
							);
						})}
					</ul>

					{/* Carry-forward lives inside the plan rather than as a banner above
					    it: it is one more thing that could be trained today. */}
					{t.missed && !missedTaken ? (
						<div className="flex items-center gap-2 border-t border-line px-3 py-2">
							<span className="min-w-0 flex-1 text-[12px] leading-snug text-ink-dim">
								{m.td_missed({ day: t.missed.weekdayLabel })}
								<span className="text-ink-faint"> · {t.missed.labels.join(' · ')}</span>
							</span>
							<button
								type="button"
								onClick={() => setMissedTaken(true)}
								className={button({ class: 'shrink-0' })}
							>
								{m.td_missed_do()}
							</button>
						</div>
					) : null}
				</div>
			</Section>

			{/* ---- counters. Three integers need no box: a rule above them and the
			     section spacing around them group them perfectly well, and three
			     bordered boxes for three numbers was the densest-looking and least
			     dense thing on the screen. */}
			<Bare className="flex divide-x divide-line-soft">
				<Stat accent value={t.stats.streak} label={m.stat_streak()} />
				<Stat value={t.stats.last7} suffix="/7" label={m.stat_week_sessions()} />
				<Stat value={t.stats.total} label={m.stat_total()} />
			</Bare>

			{/* ---- the trend. The one chart the rebuild still has data for. */}
			<Section
				label={m.readiness_trend()}
				meta={
					<span className="num">
						{insights.baseline != null ? `⌀ ${Math.round(insights.baseline)} · ` : ''}
						{vsBaseline}
					</span>
				}
			>
				<div>
					<Sparkline
						points={t.trendPoints}
						baseline={insights.baseline}
						current={readiness.score}
					/>
					<div className="num mt-1 flex justify-between text-[9px] text-ink-faint">
						<span>{t.trendPoints[0]?.label}</span>
						<span>{t.trendPoints[t.trendPoints.length - 1]?.label}</span>
					</div>
				</div>
			</Section>

			{/* ---- watch-outs. */}
			{readiness.flags.length ? (
				<Section label={m.flags_heading()}>
					<div className="flex flex-col gap-2">
						{readiness.flags.map((f) => {
							const c = content.flags[f.id];
							if (!c) return null;
							return (
								<div key={f.id} className={card({ pad: 'sm', tone: FLAG_CARD[f.severity] })}>
									<div className="flex items-baseline gap-2">
										<span className="flex-1 text-[13.5px] font-semibold text-ink">{c.title}</span>
										<span className={chip({ tone: FLAG_CHIP[f.severity] })}>{f.severity}</span>
									</div>
									<p className="prose-inline mt-1 text-[12.5px] leading-snug text-ink-dim">
										<Prose value={c.text} />
									</p>
									<div className="mt-1.5 flex flex-wrap gap-1">
										{c.focus.map((x) => (
											<span key={x} className={chip({ tone: 'ghost' })}>
												<Prose value={x} />
											</span>
										))}
									</div>
									{f.area ? (
										<div className="mt-2 flex flex-wrap gap-1.5">
											<button
												type="button"
												onClick={() => setDeepOpen(true)}
												className={button({ size: 'sm' })}
											>
												{m.flag_deep()}
											</button>
											<button type="button" className={button({ size: 'sm' })}>
												{m.flag_rehab_today()}
											</button>
											<button type="button" className={button({ kind: 'bare', size: 'sm' })}>
												{m.flag_rehab_plan()}
											</button>
										</div>
									) : null}
								</div>
							);
						})}
					</div>
				</Section>
			) : null}

			{/* ---- the check. Answered, so it opens as a receipt with the form
			     underneath; the toggle collapses it back to the receipt. */}
			<Section
				label={m.log_readiness()}
				meta={
					<button type="button" onClick={() => setCheckOpen((v) => !v)} className="text-ink-dim">
						{checkOpen ? m.btn_close() : m.td_recheck()}
					</button>
				}
			>
				<div>
					<div className="flex items-baseline justify-between gap-2 text-[12px] text-ink-faint">
						<span className="num">
							{answered}/{questions.length}
						</span>
						<button
							type="button"
							onClick={() => setAnswers({})}
							className="text-[11px] text-ink-dim underline decoration-line underline-offset-2"
						>
							{m.td_recheck()}
						</button>
					</div>
					{checkOpen ? (
						<div className="mt-3 border-t border-line-soft pt-3">
							<ReadinessCheck
								questions={questions}
								answers={answers}
								onPick={(id, v) => setAnswers((prev) => ({ ...prev, [id]: v }))}
							/>
						</div>
					) : null}
				</div>
			</Section>

			{/* ---- bodyweight. A nudge, one row, with the series it feeds. */}
			<Section label={m.field_bodyweight()}>
				<div>
					<div className="flex items-center gap-2">
						<div className="min-w-0 flex-1">
							<div className="num text-[18px] leading-none font-bold text-chalk">
								{t.bodyweight.latestKg}
								<span className="text-[11px] text-ink-faint"> kg</span>
								<span
									className={cn(
										'ml-1.5 text-[11px]',
										bwDelta < 0 ? 'text-teal' : bwDelta > 0 ? 'text-gold' : 'text-ink-faint',
									)}
								>
									{bwDelta > 0 ? '+' : ''}
									{Math.round(bwDelta * 10) / 10}
								</span>
							</div>
							<div className="mt-1 w-full">
								<Sparkline
									points={bwSeries.map((s) => ({ value: s.v, label: s.date }))}
									color="var(--violet)"
									height={20}
								/>
							</div>
						</div>
					</div>
					{t.bodyweight.promptToday && !bwLogged ? (
						<div className="mt-2 flex items-center gap-2 border-t border-line-soft pt-2">
							<label className="min-w-0 flex-1 text-[12px] text-ink-dim" htmlFor="bw">
								{m.bw_prompt()}
							</label>
							<input
								id="bw"
								className={input({ class: 'h-8 w-20 shrink-0' })}
								type="number"
								inputMode="decimal"
								step="any"
								value={bw}
								onChange={(e) => setBw(e.currentTarget.value)}
							/>
							<button
								type="button"
								disabled={bw === ''}
								onClick={() => setBwLogged(true)}
								className={button({ kind: 'primary', class: 'shrink-0' })}
							>
								{m.btn_save()}
							</button>
						</div>
					) : null}
				</div>
			</Section>

			{/* ---- injury. Last section on purpose — rarely needed, never hidden. */}
			<Section label={m.rehab_title()}>
				<div className={card({ pad: 'none' })}>
					<div className="border-b border-line-soft p-3">
						<RehabStarter />
					</div>
					<button
						type="button"
						onClick={() => setDeepOpen(true)}
						className="flex w-full items-center gap-2 p-3 text-left transition-colors active:bg-panel-2"
					>
						<span className="min-w-0 flex-1">
							<span className="block text-[13px] font-medium text-ink">
								{t.deep.assessment.title}
							</span>
							<span className="num mt-0.5 block text-[11px] text-ink-faint">
								{m.deep_last({ score: t.deep.last.score, date: t.deep.last.date })}
							</span>
						</span>
						<ChevronRight size={15} className="shrink-0 text-ink-faint" />
					</button>
					{/* "Based on Modelled on VISA-C…" — pre-existing content bug (the message
					    prepends "Based on"; the source string already starts with "Modelled
					    on"). Not this branch's to fix; see the note in InjurySection.tsx. */}
					<p className="border-t border-line-soft px-3 py-2 text-[10.5px] leading-snug text-ink-faint">
						{m.deep_based_on({ source: t.deep.assessment.source })}{' '}
						<a
							href={t.deep.assessment.url}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-0.5 whitespace-nowrap text-ink-dim underline decoration-line underline-offset-2"
						>
							{m.deep_source_link()}
							<ExternalLink size={9} />
						</a>
					</p>
				</div>
			</Section>

			<DeepCheckSheet
				area={t.deep.area as FlagArea}
				assessment={t.deep.assessment}
				last={t.deep.last}
				open={deepOpen}
				onOpenChange={setDeepOpen}
			/>
		</div>
	);
}
