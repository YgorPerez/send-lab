// TODAY.
//
// The screen that decides whether "dense and calm" survives contact with a phone.
// It carries, in one scroll: the read, the five wellness dimensions behind it,
// the plan and the work the read holds back, the carry-forward from a missed day,
// three counters, a fourteen-point trend, the watch-outs with their advice, a
// nine-question readiness check, the bodyweight nudge, and two injury entry
// points.
//
// The ordering rule is *decision first, evidence second, input last*: the verdict
// is the top of the screen because it is the answer; the check that produced it
// is near the bottom because it is already answered. That inverts the SvelteKit
// screen, where the check came first and the athlete scrolled past nine questions
// to reach the one line they opened the app for.
//
// The screen is genuinely live, and as of #56 it is live over the real store. It
// re-runs `computeReadiness` against whatever the check currently says, using the
// load signals and the personal calibration the account's own history produced —
// so changing an answer moves the score, the verdict, the watch-outs and which
// exercises the plan holds back. #42 puts the training logic out of scope for the
// redesign; this renders it rather than re-deciding it.
//
// WHAT IS PAGE COMPOSITION AND WHAT IS NOT
// ----------------------------------------
// Anything that appears exactly once and only *arranges* primitives stays in
// this file — named, but local. The test is whether it owns a *decision* or only
// an *arrangement*: `Timer` owns the interval protocol and is a component in
// `components/` though it appears once; `PlanCard` is a card, a list and a
// hairline, and stays here. See the note above the sections at the foot of the
// file for why length alone is not a reason to promote one.
import { createFileRoute, Link } from '@tanstack/react-router';
import { Check, ChevronRight, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { type Answers, type BodyArea, computeReadiness, getContent } from '$lib/content';
import type { Content, VerdictId } from '$lib/content/types';
import { isoDayOf } from '$lib/dates';
import { displayDate } from '$lib/displayDate';
import { OUTCOME_LABEL, WELLNESS_LABEL } from '$lib/format';
import type { ExerciseId, TaskKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { loadReadinessDraft, saveReadinessDraft } from '$lib/readinessDraft';
import {
	heldExercises,
	type Question,
	resolveQuestions,
	resolveToday,
	type Task,
	type TodayScreen,
} from '$lib/screens/today';
import { useTrainingRecord } from '$lib/store/record';
import { cn } from '$lib/utils';
import { ReadinessCheck } from '../components/ReadinessCheck';
import { RehabStarter, SelfCheckSheet } from '../components/SelfCheck';
import { Bare, Eyebrow, Meter, Prose, Section, Stat } from '../components/ui/primitives';
import { Sparkline } from '../components/ui/Sparkline';
import { button, card, chip, input } from '../components/ui/variants';

export const Route = createFileRoute('/')({ component: Today });

/** Severity → surface tone. `info` deliberately gets no tint: three tinted
 *  panels in a row is how a calm screen turns into a warning screen. */
const FLAG_CARD = { stop: 'stop', warn: 'warn', info: 'plain' } as const;
const FLAG_CHIP = { stop: 'stop', warn: 'warn', info: 'neutral' } as const;

function Today() {
	const now = useMemo(() => Date.now(), []);
	// The store, live. Everything below is a function of it: `resolveToday` reads
	// the plan and the history out of the collections, and nothing on this screen
	// is fabricated any more (#56).
	const record = useTrainingRecord();
	const locale = getLocale();
	const content = useMemo(() => getContent(locale), [locale]);
	const t = useMemo(() => resolveToday(content, record, now), [content, record, now]);

	// A DRAFT THAT PERSISTS — the second of the three recurring patterns (#53,
	// obligation 3).
	//
	// The Svelte version was a `$state` object plus an `$effect` that wrote it.
	// The React shape is deliberately the same two halves, with the storage in a
	// named `lib/` module and neither half doing the other's job:
	//
	//   * A **lazy initialiser** reads once, at mount. Reading during render
	//     without the lazy form re-reads `localStorage` on every keystroke; doing
	//     it in an effect renders one frame of the wrong answers first.
	//   * **One effect writes**, keyed on the value. Not on every setter call —
	//     that is how a save gets forgotten at the third call site.
	//
	// `loadReadinessDraft` is guarded for a missing `window` because the shell
	// prerenders. The route itself never does (ADR 0006, `ssr: false`).
	const [answers, setAnswers] = useState<Answers>(() => {
		const draft = loadReadinessDraft();
		return Object.keys(draft.answers).length ? draft.answers : t.answers;
	});
	useEffect(() => saveReadinessDraft(answers), [answers]);

	const [done, setDone] = useState<Record<TaskKey, boolean>>(() =>
		Object.fromEntries(t.tasks.map((task) => [task.key, task.done])),
	);
	const [outcome, setOutcome] = useState<number | null>(null);
	const [missedTaken, setMissedTaken] = useState(false);
	const [bodyweight, setBodyweight] = useState('');
	const [bodyweightLogged, setBodyweightLogged] = useState(false);
	const [selfCheckOpen, setSelfCheckOpen] = useState(false);
	const [checkOpen, setCheckOpen] = useState(true);

	// A DERIVED PRESCRIPTION — the third pattern. Svelte's `$derived` becomes
	// `useMemo` over the *inputs*, never a second piece of state kept in step by
	// an effect: the verdict is a function of the answers and the history, and
	// storing it would let it disagree with them.
	//
	// The two history-derived inputs come off the screen rather than being
	// recomputed here, because they are the same signals the record produced and
	// both read the history *behind* today (`lib/screens/today.ts`). What is live
	// is the answers: change one and the score, the verdict, the watch-outs and
	// which work is held all move.
	const insights = t.insights;
	const readiness = useMemo(
		() => computeReadiness(answers, t.load, insights),
		[answers, t.load, insights],
	);

	const verdict = content.verdicts[readiness.verdict];
	const heldSet = useMemo(
		() => heldExercises(t.tasks, readiness.verdict),
		[t.tasks, readiness.verdict],
	);

	// Follow-ups appear and disappear as the core answers change, so the rendered
	// list is rebuilt on every answer rather than resolved once.
	const questions = useMemo<Question[]>(
		() => resolveQuestions(content, answers),
		[answers, content],
	);
	const answered = questions.filter((q) => q.answer != null).length;

	const delta = insights.baseline == null ? 0 : readiness.score - insights.baseline;
	const vsBaseline =
		delta <= -10 ? m.rd_vs_below() : delta >= 10 ? m.rd_vs_above() : m.rd_vs_usual();
	const breakdown = ['sleep', 'fatigue', 'soreness', 'stress', 'mood']
		.filter((id) => answers[id] != null)
		.map((id) => ({ id, value: answers[id] }));
	const nextTask = t.tasks.find((x) => !done[x.key] && !heldSet.has(x.exercise));

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
					{m.week_label({ n: t.weekNumber })}
				</span>
			</header>

			<ReadCard
				verdict={verdict}
				score={readiness.score}
				vsBaseline={vsBaseline}
				breakdown={breakdown}
				scoreNote={t.scoreNote}
				nextTaskLabel={nextTask?.exName ?? null}
			/>

			{/* Post-session outcome: the input that turns the heuristic weighting into
			    a personal one.

			    Lifted out of the read card. It was the fifth rule-separated block
			    inside it, and it is the one thing on this screen answered *after*
			    training — sitting inside the morning's read, under its own hairline, it
			    read as another part of the verdict. Its own section, its own heading,
			    no box: the heading is the question. */}
			<Section label={m.rd_outcome_q()}>
				<div className="grid grid-cols-2 gap-1.5">
					{[3, 2, 1, 0].map((v) => (
						<button
							key={v}
							type="button"
							aria-pressed={outcome === v}
							onClick={() => setOutcome(v)}
							className={button({
								kind: 'quiet',
								size: 'md',
								class: cn('min-h-11 px-1 text-[12px]', outcome === v && 'border-teal/50 text-teal'),
							})}
						>
							{OUTCOME_LABEL[v]()}
						</button>
					))}
				</div>
				{outcome != null ? <p className="text-[11px] text-teal">{m.rd_outcome_saved()}</p> : null}
			</Section>

			<PlanCard
				day={t.day}
				phase={t.phase}
				tasks={t.tasks}
				isRestDay={t.isRestDay}
				done={done}
				heldSet={heldSet}
				onToggle={(key) => setDone((p) => ({ ...p, [key]: !p[key] }))}
				missed={missedTaken ? null : t.missed}
				onTakeMissed={() => setMissedTaken(true)}
			/>

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

			<WatchOuts
				flags={readiness.flags}
				content={content}
				onSelfCheck={() => setSelfCheckOpen(true)}
			/>

			{/* ---- the readiness check. Answered, so it opens as a receipt with the
			     form underneath; the toggle collapses it back to the receipt. */}
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

			<BodyweightNudge
				bodyweight={t.bodyweight}
				draft={bodyweight}
				onDraftChange={setBodyweight}
				logged={bodyweightLogged}
				onLog={() => setBodyweightLogged(true)}
			/>

			{/* The library has an instrument for three of the four body areas and none
			    for the wrist (#71), so the whole section is conditional rather than
			    rendering a check with nothing behind it. */}
			{t.selfCheck ? (
				<>
					<InjuryEntry selfCheck={t.selfCheck} onSelfCheck={() => setSelfCheckOpen(true)} />
					<SelfCheckSheet
						area={t.selfCheck.area}
						instrument={t.selfCheck.instrument}
						last={t.selfCheck.last}
						open={selfCheckOpen}
						onOpenChange={setSelfCheckOpen}
					/>
				</>
			) : null}
		</div>
	);
}

// ---------------------------------------------------------------------------
// PAGE COMPOSITION
//
// Five sections of this one screen, each used exactly once and each only
// *arranging* primitives. They are local functions in the route file rather than
// modules under `components/`, and that is the line the vocabulary draws:
// something goes to `components/` when it owns a decision (the interval
// protocol, how a set row wraps at 360px, how a self-check scores) or when a
// second screen needs it. `PlanCard` is neither — it is Today's plan, and only
// Today has one.
//
// The old app had `Rehab`, `Periodization` and `SavedPrograms` as components for
// the opposite reason — they were long — and each turned out to be a section of
// one screen wearing a component's clothes. Length is a reason to give something
// a *name*, which is what these are; it is not a reason to give it a file, a
// public interface and a place in a vocabulary nine other pages read.
//
// `react-doctor` warns about more than one component per file, and this file
// deliberately accepts that warning. The alternative — a directory of
// single-use, single-caller modules per screen — is the failure mode this ticket
// exists to prevent, and it would trade a warning nobody reads for forty files
// nobody can navigate.
// ---------------------------------------------------------------------------

/** The read: the anchor of the screen, and the only place a 30px number appears. */
function ReadCard({
	verdict,
	score,
	vsBaseline,
	breakdown,
	scoreNote,
	nextTaskLabel,
}: {
	verdict: Content['verdicts'][VerdictId];
	score: number;
	vsBaseline: string;
	breakdown: { id: string; value: number }[];
	scoreNote: 'heuristic' | 'tuned';
	nextTaskLabel: string | null;
}) {
	return (
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
					<div className="num text-[30px] leading-none font-bold text-chalk">{score}</div>
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

			{/* The five wellness dimensions, one per line. Two columns would fit in
			    English and clip "Recuperação" in pt-BR; five 18px rows is the price of
			    a breakdown that is readable in both. */}
			<div className="flex flex-col gap-1 border-t border-line-soft px-3.5 py-3">
				{breakdown.map((b) => (
					<Meter key={b.id} label={WELLNESS_LABEL[b.id]?.() ?? b.id} value={b.value} />
				))}
				<p className="mt-1.5 text-[10.5px] leading-snug text-ink-faint italic">
					{scoreNote === 'tuned' ? m.rd_note_tuned() : m.rd_note_heuristic()}
				</p>
				{/* Was its own rule-separated strip. It is a footnote on the read, so it
				    sits inside the read rather than under another hairline. */}
				{nextTaskLabel ? (
					<p className="mt-2 text-[12px] text-ink-faint">
						{m.td_applies()} <b className="font-semibold text-chalk">{nextTaskLabel}</b>
					</p>
				) : null}
			</div>
		</div>
	);
}

/** Today's plan: the phase it sits in, the tasks, and the carry-forward. */
function PlanCard({
	day,
	phase,
	tasks,
	isRestDay,
	done,
	heldSet,
	onToggle,
	missed,
	onTakeMissed,
}: {
	day: TodayScreen['day'];
	phase: TodayScreen['phase'];
	tasks: Task[];
	isRestDay: boolean;
	done: Record<TaskKey, boolean>;
	heldSet: ReadonlySet<ExerciseId>;
	onToggle: (key: TaskKey) => void;
	missed: TodayScreen['missed'];
	onTakeMissed: () => void;
}) {
	return (
		<Section
			label={`${day.type} · ${day.load}`}
			meta={
				<Link to="/train" className="text-ink-dim">
					{m.btn_view_session()}
				</Link>
			}
		>
			<div className={card({ pad: 'none' })}>
				{/* The block phase belongs here, not in the page header: it is the reason
				    today's prescription looks the way it does, and in the header it was a
				    truncated fragment next to the date. */}
				<div className="border-b border-line-soft px-3 py-2">
					<p className="text-[11.5px] leading-snug font-medium text-chalk">{phase.name}</p>
					<p className="mt-0.5 text-[11px] leading-snug text-ink-faint">{phase.banner}</p>
					<p className="mt-1 text-[11px] leading-snug text-ink-faint">
						{day.prime} · {day.sec}
					</p>
				</div>
				{/* A rest day is an answer, not an empty list. The day type prescribes no
				    exercises, it never counts against adherence, and it is what the
				    athlete opened the app to find out — so it says so, in the place the
				    tasks would have been. */}
				{isRestDay ? <p className="px-3 py-3 text-[13px] text-ink-dim">{m.td_rest_day()}</p> : null}
				<ul>
					{tasks.map((task) => {
						// Keyed by `TaskKey`, not by exercise id. The same exercise appears
						// in several weekdays of a block, and a tick keyed by exercise would
						// tick every slot that prescribes it (ADR-0001).
						const isDone = done[task.key];
						const held = heldSet.has(task.exercise) && !isDone;
						return (
							<li
								key={task.key}
								className={cn(
									'flex items-center gap-2 border-b border-line-soft px-3 py-2 last:border-b-0',
									held && 'bg-panel-2/40',
								)}
							>
								<button
									type="button"
									aria-pressed={isDone}
									aria-label={task.exName}
									onClick={() => onToggle(task.key)}
									className={cn(
										'flex size-11 shrink-0 items-center justify-center rounded-md border transition-colors',
										isDone ? 'border-teal/60 bg-teal/15 text-teal' : 'border-line text-transparent',
									)}
								>
									<Check size={16} strokeWidth={2.6} />
								</button>
								<span
									className={cn(
										'min-w-0 flex-1 truncate text-[13.5px]',
										isDone ? 'text-ink-faint line-through' : held ? 'text-ink-faint' : 'text-ink',
									)}
								>
									{task.exName}
								</span>
								{held ? (
									<span className={chip({ tone: 'warn' })}>{m.td_held()}</span>
								) : isDone ? (
									<span className={chip({ tone: 'ok' })}>{m.lbl_done()}</span>
								) : (
									<Link
										to="/train"
										className="flex min-h-11 shrink-0 items-center gap-0.5 text-[11px] text-ink-dim"
									>
										{m.td_open_train()}
										<ChevronRight size={13} />
									</Link>
								)}
							</li>
						);
					})}
				</ul>

				{/* Carry-forward lives inside the plan rather than as a banner above it:
				    it is one more thing that could be trained today. */}
				{missed ? (
					<div className="flex items-center gap-2 border-t border-line px-3 py-2">
						<span className="min-w-0 flex-1 text-[12px] leading-snug text-ink-dim">
							{m.td_missed({ day: missed.weekdayLabel })}
							<span className="text-ink-faint"> · {missed.labels.join(' · ')}</span>
						</span>
						<button
							type="button"
							onClick={onTakeMissed}
							className={button({ size: 'md', class: 'min-h-11 shrink-0' })}
						>
							{m.td_missed_do()}
						</button>
					</div>
				) : null}
			</div>
		</Section>
	);
}

/** The flags the readiness check surfaced, with their advice. */
function WatchOuts({
	flags,
	content,
	onSelfCheck,
}: {
	flags: { id: string; severity: 'stop' | 'warn' | 'info'; area?: BodyArea }[];
	content: Content;
	onSelfCheck: () => void;
}) {
	if (!flags.length) return null;
	return (
		<Section label={m.flags_heading()}>
			<div className="flex flex-col gap-2">
				{flags.map((f) => {
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
										onClick={onSelfCheck}
										className={button({ size: 'md', class: 'min-h-11' })}
									>
										{m.flag_deep()}
									</button>
									<button type="button" className={button({ size: 'md', class: 'min-h-11' })}>
										{m.flag_rehab_today()}
									</button>
									<button
										type="button"
										className={button({ kind: 'bare', size: 'md', class: 'min-h-11' })}
									>
										{m.flag_rehab_plan()}
									</button>
								</div>
							) : null}
						</div>
					);
				})}
			</div>
		</Section>
	);
}

/**
 * Bodyweight: a nudge, one row, with the series it feeds.
 *
 * ADR 0009 — it survived the marker cull because nothing is tested and no effort
 * is spent; it is the divisor other numbers are expressed against.
 */
function BodyweightNudge({
	bodyweight,
	draft,
	onDraftChange,
	logged,
	onLog,
}: {
	bodyweight: TodayScreen['bodyweight'];
	draft: string;
	onDraftChange: (v: string) => void;
	logged: boolean;
	onLog: () => void;
}) {
	const series = bodyweight.series;
	// Nothing weighed yet. The nudge has no series to sit above and no number to
	// compare against, so the section stays off the screen until there is one.
	if (bodyweight.latestKg == null) return null;
	const delta = series.length > 1 ? bodyweight.latestKg - series[0].kg : 0;
	return (
		<Section label={m.field_bodyweight()}>
			<div>
				<div className="min-w-0">
					<div className="num text-[18px] leading-none font-bold text-chalk">
						{bodyweight.latestKg}
						<span className="text-[11px] text-ink-faint"> kg</span>
						<span
							className={cn(
								'ml-1.5 text-[11px]',
								delta < 0 ? 'text-teal' : delta > 0 ? 'text-gold' : 'text-ink-faint',
							)}
						>
							{delta > 0 ? '+' : ''}
							{Math.round(delta * 10) / 10}
						</span>
					</div>
					<div className="mt-1 w-full">
						<Sparkline
							points={series.map((s) => ({ value: s.kg, label: displayDate(isoDayOf(s.at)) }))}
							color="var(--violet)"
							height={20}
						/>
					</div>
				</div>
				{bodyweight.promptToday && !logged ? (
					<div className="mt-2 flex items-center gap-2 border-t border-line-soft pt-2">
						<label className="min-w-0 flex-1 text-[12px] text-ink-dim" htmlFor="bw">
							{m.bw_prompt()}
						</label>
						<input
							id="bw"
							className={input({ class: 'h-11 w-20 shrink-0' })}
							type="number"
							inputMode="decimal"
							step="any"
							value={draft}
							onChange={(e) => onDraftChange(e.currentTarget.value)}
						/>
						<button
							type="button"
							disabled={draft === ''}
							onClick={onLog}
							className={button({ kind: 'primary', size: 'md', class: 'min-h-11 shrink-0' })}
						>
							{m.btn_save()}
						</button>
					</div>
				) : null}
			</div>
		</Section>
	);
}

/** Injury. Last section on purpose — rarely needed, never hidden. */
function InjuryEntry({
	selfCheck,
	onSelfCheck,
}: {
	selfCheck: NonNullable<TodayScreen['selfCheck']>;
	onSelfCheck: () => void;
}) {
	return (
		<Section label={m.rehab_title()}>
			<div className={card({ pad: 'none' })}>
				<div className="border-b border-line-soft p-3">
					<RehabStarter />
				</div>
				<button
					type="button"
					onClick={onSelfCheck}
					className="flex w-full items-center gap-2 p-3 text-left transition-colors active:bg-panel-2"
				>
					<span className="min-w-0 flex-1">
						<span className="block text-[13px] font-medium text-ink">
							{selfCheck.instrument.title}
						</span>
						{selfCheck.last ? (
							<span className="num mt-0.5 block text-[11px] text-ink-faint">
								{m.deep_last({
									score: selfCheck.last.score,
									date: displayDate(isoDayOf(selfCheck.last.at)),
								})}
							</span>
						) : null}
					</span>
					<ChevronRight size={15} className="shrink-0 text-ink-faint" />
				</button>
				<p className="border-t border-line-soft px-3 py-2 text-[10.5px] leading-snug text-ink-faint">
					{m.deep_based_on({ source: selfCheck.instrument.source })}{' '}
					<a
						href={selfCheck.instrument.url}
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
	);
}
