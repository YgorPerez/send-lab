<script lang="ts">
import CheckIcon from '@lucide/svelte/icons/check';
import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';
import { Badge } from '$lib/components/ui/badge';
import { Button } from '$lib/components/ui/button';
import { Card, CardContent } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import {
	type Answers,
	computeReadiness,
	type FlagArea,
	getContent,
	visibleQuestions,
} from '$lib/content';
import DailyFlags from '$lib/DailyFlags.svelte';
import DeepAssessment from '$lib/DeepAssessment.svelte';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import {
	programWeeks,
	rehabToday,
	resolveDay,
	resolveExerciseIds,
	resolveSwapIndex,
	taskKey,
} from '$lib/plan';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState, type ReadinessEntry, today } from '$lib/state.svelte';
import {
	acwr,
	completedSessions,
	probeReadiness,
	readinessInsights,
	sessionsLast7,
	trainStreak,
	weekLoad,
} from '$lib/stats';
import { STUDIES } from '$lib/studies';
import TrendChart from '$lib/TrendChart.svelte';
import { toMetricCanonical } from '$lib/units';
import { cn } from '$lib/utils';

// Daily bodyweight nudge — it anchors the % bodyweight strength estimates.
let bwInput = $state('');
const bwLoggedToday = $derived(appState.metrics.bodyweight.some((e) => e.date === today()));
function logBodyweight() {
	const n = Number.parseFloat(bwInput);
	if (Number.isNaN(n)) return;
	appState.metrics.bodyweight.push({
		date: today(),
		at: Date.now(),
		v: toMetricCanonical('bodyweight', n),
	});
	bwInput = '';
}

const content = getContent();

// Today's planned protocol = the microcycle slot for the real weekday.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = WEEKDAYS[new Date().getDay()];
const week = $derived(appState.currentWeek);
const day = $derived(resolveDay(content, week, weekday));
const dayLabel = $derived(content.days.find((d) => d.k === weekday)?.label ?? weekday);

interface Task {
	id: string;
	label: string;
	done: boolean;
}

const tasks = $derived<Task[]>(
	resolveExerciseIds(content, week, weekday).flatMap((exId) => {
		const ex = content.exercises[exId];
		// `rest` is not a task — a day with no tasks is a rest day.
		if (!ex) return [];
		const idx = resolveSwapIndex(week, weekday, exId);
		if (exId === 'rest' && idx === 0) return [];
		return [{ id: exId, label: ex.name, done: !!appState.taskDone[taskKey(week, weekday, exId)] }];
	}),
);
const isRestDay = $derived(tasks.length === 0);

// Final week of the block → prompt a retest to calibrate the next one.
let reassessDismissed = $state(false);
const needsReassess = $derived(
	!reassessDismissed && appState.assessment != null && week >= programWeeks(),
);

let answers = $state<Answers>({});
// Climbing-specific objective probe: today's quick max pull (kg), optional.
let probeValue = $state<number | null>(null);
const probeResult = $derived(probeReadiness(appState.probeLog, probeValue));
// Objective signals: EWMA acute:chronic ratio (null < ~3 weeks), Foster training
// monotony, and the max-pull probe vs baseline — all feed the recommendation.
const loadSignals = $derived({
	acwr: acwr(appState.workouts, Date.now())?.status ?? null,
	monotony:
		weekLoad(appState.workouts, Date.now())?.status === 'monotonous' ? ('high' as const) : null,
	probe: probeResult.status,
});
// Personalization from logged history: baseline, trend and outcome calibration.
const insights = $derived(readinessInsights(appState.readinessLog));
// Adaptive: show the core, reveal follow-ups only when they'd change the result.
const visible = $derived(visibleQuestions(answers));
const visibleQuiz = $derived(content.quiz.filter((q) => visible.includes(q.id)));
const complete = $derived(visible.every((id) => answers[id] != null));
const readiness = $derived(complete ? computeReadiness(answers, loadSignals, insights) : null);
const verdict = $derived(readiness ? content.verdicts[readiness.verdict] : null);
const flags = $derived(readiness?.flags ?? []);

// Today's score vs the user's personal norm.
const baselineLabel = $derived.by(() => {
	if (!readiness || insights.baseline == null) return null;
	const d = readiness.score - insights.baseline;
	return d <= -10 ? m.rd_vs_below() : d >= 10 ? m.rd_vs_above() : m.rd_vs_usual();
});

// Honest framing of the score: the weighting is a reasoned default heuristic
// until enough post-session feedback (the calibration threshold) personalizes it.
const calibrated = $derived(appState.readinessLog.filter((e) => e.outcome != null).length >= 4);
const scoreNote = $derived(calibrated ? m.rd_note_tuned() : m.rd_note_heuristic());

// Post-session outcome (set after training) feeds the calibration loop.
const todayEntry = $derived(appState.readinessLog.find((e) => e.date === today()));
function setOutcome(v: number) {
	const e = appState.readinessLog.find((x) => x.date === today());
	if (!e) return;
	e.outcome = v;
	toast.success(m.rd_outcome_saved());
}

const studyUrl = (id?: string) => (id ? STUDIES.find((s) => s.id === id)?.url : undefined);

// The wellness dimensions behind the readiness score (for the breakdown).
const WELLNESS_DIMS = [
	{ id: 'sleep', label: () => m.rd_sleep() },
	{ id: 'fatigue', label: () => m.rd_fatigue() },
	{ id: 'soreness', label: () => m.rd_soreness() },
	{ id: 'stress', label: () => m.rd_stress() },
	{ id: 'mood', label: () => m.rd_mood() },
];
const breakdown = $derived(
	WELLNESS_DIMS.filter((d) => answers[d.id] != null).map((d) => ({
		label: d.label(),
		v: answers[d.id],
	})),
);

function startRehabToday(area: FlagArea) {
	rehabToday(content, week, weekday, area);
	toast.success(m.toast_rehab_today());
}

let deepArea = $state<FlagArea | null>(null);

const streak = $derived(trainStreak(appState.workouts));
const last7 = $derived(sessionsLast7(appState.workouts));
const totalSessions = $derived(completedSessions(appState.workouts));

function pick(qid: string, value: number) {
	answers = { ...answers, [qid]: value };
}

function recheck() {
	answers = {};
	probeValue = null;
}

function logVerdict() {
	if (!verdict || !readiness) return;
	appState.log.unshift({
		date: today(),
		type: 'rec',
		label: verdict.title,
		color: verdict.color,
		note: tasks[0] ? `${dayLabel} · ${tasks[0].label}` : verdict.tag,
	});
	// Record today's readiness for the trend (one entry per day; update on recheck).
	const d = today();
	const entry: ReadinessEntry = {
		date: d,
		at: Date.now(),
		verdict: readiness.verdict,
		score: readiness.score,
	};
	const rl = appState.readinessLog;
	if (rl.length && rl[rl.length - 1].date === d) rl[rl.length - 1] = entry;
	else rl.push(entry);
	// Bank today's probe reading so the personal baseline builds over time.
	if (probeValue != null && !Number.isNaN(probeValue) && probeValue > 0) {
		const pl = appState.probeLog;
		const pe = { date: d, at: Date.now(), value: probeValue };
		if (pl.length && pl[pl.length - 1].date === d) pl[pl.length - 1] = pe;
		else pl.push(pe);
	}
	toast.success(m.toast_session_logged());
}
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_today()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">
		<Prose value={m.lede_today()} />
	</p>

	{#if appState.rehab}
		<div class="mb-[22px] flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3">
			<span class="flex-1 text-[13px] text-gold">{m.rehab_active()} — {m.rehab_label()}</span>
			<a
				href="/settings"
				class="font-mono text-[11px] tracking-wider text-gold uppercase hover:underline"
			>
				{m.nav_settings()}
			</a>
		</div>
	{/if}

	{#if !bwLoggedToday}
		<div class="mb-[22px] flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5">
			<span class="flex-1 text-[13px] text-ink-dim">
				{m.bw_prompt()} ({appState.prefs.weight})
			</span>
			<Input
				type="number"
				step="any"
				bind:value={bwInput}
				class="h-8 w-24 bg-panel-2 text-center text-sm"
			/>
			<Button size="sm" class="bg-chalk text-bg hover:bg-chalk/90" onclick={logBodyweight}>
				{m.btn_save()}
			</Button>
		</div>
	{/if}

	{#if needsReassess}
		<div class="mb-[22px] flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3">
			<span class="flex-1 text-[13px] text-ink-dim">{m.reassess_note()}</span>
			<a href="/metrics" class="font-mono text-[11px] tracking-wider text-gold uppercase hover:underline">
				{m.reassess_cta()}
			</a>
			<button
				type="button"
				aria-label={m.btn_close()}
				class="text-ink-faint transition hover:text-ink"
				onclick={() => (reassessDismissed = true)}
			>
				✕
			</button>
		</div>
	{/if}

	<!-- Today's plan + per-task checklist -->
	<Card class="mb-[22px] gap-3 border-l-[3px] p-5" style="border-left-color: {day.color}">
		<div class="flex items-baseline justify-between gap-2">
			<span class="font-bold">{m.td_today_label()} · {dayLabel}</span>
			<div class="flex items-baseline gap-2.5">
				<a href="/week" class="font-mono text-[11px] text-ink-faint hover:text-ink">
					{m.week_label({ n: week })}
				</a>
				<span class="font-mono text-[11px] tracking-wider uppercase" style:color={day.color}>
					{day.load}
				</span>
			</div>
		</div>
		{#if isRestDay}
			<p class="text-sm text-teal">{m.td_rest_day()}</p>
			<p class="text-xs text-ink-dim"><Prose value={day.sec} /></p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each tasks as task (task.id)}
					<a
						href="/train?ex={task.id}"
						class={cn(
							'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition',
							task.done
								? 'border-teal/40 bg-teal/5 text-ink-faint'
								: 'border-line bg-panel-2 text-ink-dim hover:border-flag hover:text-chalk'
						)}
					>
						{#if task.done}
							<CheckIcon class="size-4 flex-none text-teal" />
						{/if}
						<span class={cn('flex-1', task.done && 'line-through')}>{task.label}</span>
						<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
							{task.done ? m.lbl_done() : m.td_open_train()}
						</span>
						<ChevronRightIcon class="size-4" />
					</a>
				{/each}
			</div>
		{/if}
	</Card>

	<div class="mb-[22px] grid grid-cols-3 gap-3">
		<Card class="items-center gap-0 p-3.5 text-center">
			<span class="font-mono text-[26px] leading-none font-bold text-flag">{streak}</span>
			<span class="mt-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
				{m.stat_streak()}
			</span>
		</Card>
		<Card class="items-center gap-0 p-3.5 text-center">
			<span class="font-mono text-[26px] leading-none font-bold text-chalk">{last7}<span
					class="text-sm text-ink-faint">/7</span
				></span>
			<span class="mt-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
				{m.stat_week_sessions()}
			</span>
		</Card>
		<Card class="items-center gap-0 p-3.5 text-center">
			<span class="font-mono text-[26px] leading-none font-bold text-chalk">{totalSessions}</span>
			<span class="mt-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
				{m.stat_total()}
			</span>
		</Card>
	</div>

	<Card class="mb-[22px] gap-0 p-6">
		<CardContent class="space-y-[22px] p-0">
			{#each visibleQuiz as q, qi (q.id)}
				<div class="animate-in fade-in duration-200">
					<div class="mb-1 text-[15px] font-semibold">
						<span class="mr-2 font-mono text-xs text-flag">0{qi + 1}</span>{q.q}
					</div>
					{#if q.why}
						<p class="mb-2 max-w-[60ch] text-[12px] leading-snug text-ink-faint">
							{q.why}{#if studyUrl(q.study)}
								<a
									href={studyUrl(q.study)}
									target="_blank"
									rel="noopener noreferrer"
									class="ml-1 whitespace-nowrap text-flag hover:underline">{m.rd_evidence()}</a
								>{/if}
						</p>
					{/if}
					<div class="flex flex-wrap gap-2">
						{#each q.a as a (a.t)}
							<button
								type="button"
								onclick={() => pick(q.id, a.v)}
								class={cn(
									'min-w-[120px] flex-1 rounded-[9px] border px-3 py-[11px] text-left text-[13.5px] transition',
									answers[q.id] === a.v
										? 'border-flag bg-flag/10 font-semibold text-chalk'
										: 'border-line bg-panel-2 text-ink-dim hover:border-ink-faint hover:text-ink'
								)}
							>
								{a.t}
							</button>
						{/each}
					</div>
				</div>
			{/each}

			<!-- Optional climbing-specific objective probe: a quick max finger pull. -->
			<div class="border-t border-line pt-[22px] animate-in fade-in duration-200">
				<div class="mb-1 text-[15px] font-semibold">
					<span class="mr-2 font-mono text-xs text-flag">+</span>{m.rd_probe_label()}
				</div>
				<p class="mb-2 max-w-[60ch] text-[12px] leading-snug text-ink-faint">
					{m.rd_probe_why()}{#if studyUrl('probe')}
						<a
							href={studyUrl('probe')}
							target="_blank"
							rel="noopener noreferrer"
							class="ml-1 whitespace-nowrap text-flag hover:underline">{m.rd_evidence()}</a
						>{/if}
				</p>
				<div class="flex items-center gap-2">
					<Input
						type="number"
						inputmode="decimal"
						step="any"
						min="0"
						value={probeValue ?? ''}
						oninput={(e) =>
							(probeValue = e.currentTarget.value === '' ? null : e.currentTarget.valueAsNumber)}
						placeholder={m.rd_probe_ph()}
						class="w-32 bg-panel-2 text-sm"
					/>
					<span class="text-xs text-ink-faint">kg</span>
					{#if probeResult.baseline != null}
						<span class="font-mono text-[11px] text-ink-faint">
							{m.rd_probe_baseline({ kg: probeResult.baseline })}{#if probeResult.deficitPct != null}
								· <span
									class={cn(
										probeResult.deficitPct >= 6
											? 'text-flag'
											: probeResult.deficitPct <= -5
												? 'text-teal'
												: 'text-ink-faint'
									)}
									>{probeResult.deficitPct > 0 ? '−' : '+'}{Math.abs(probeResult.deficitPct)}%</span
								>{/if}
						</span>
					{:else if probeValue != null}
						<span class="font-mono text-[11px] text-ink-faint">{m.rd_probe_building()}</span>
					{/if}
				</div>
			</div>
		</CardContent>
	</Card>

	{#if verdict && readiness}
		<Card class="overflow-hidden p-0 animate-in fade-in duration-300">
			<div class="flex items-center gap-3.5 border-b border-line p-5">
				<span class="size-3.5 flex-none rounded-full" style:background={verdict.color}></span>
				<div class="min-w-0 flex-1">
					<div class="text-[19px] font-extrabold tracking-tight">{verdict.title}</div>
					<div class="font-mono text-[11px] tracking-wider text-ink-faint uppercase">
						{verdict.tag}
					</div>
				</div>
				<div class="flex-none text-right">
					<div class="font-mono text-[22px] leading-none font-bold text-chalk">{readiness.score}</div>
					<div class="font-mono text-[9px] tracking-wider text-ink-faint uppercase">
						{m.rd_score()}
					</div>
					{#if baselineLabel}
						<div class="mt-0.5 font-mono text-[9px] text-ink-faint">{baselineLabel}</div>
					{/if}
				</div>
			</div>
			<div class="p-5 text-[14.5px] text-ink-dim">
				<div><Prose value={verdict.text} /></div>
				{#if breakdown.length}
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each breakdown as b (b.label)}
							<span
								class={cn(
									'rounded-full border px-2 py-0.5 font-mono text-[10px]',
									b.v >= 7
										? 'border-teal/40 text-teal'
										: b.v >= 4
											? 'border-gold/40 text-gold'
											: 'border-flag/40 text-flag'
								)}
							>
								{b.label} {b.v}/10
							</span>
						{/each}
					</div>
				{/if}
				<p class="mt-2 text-[11px] leading-snug text-ink-faint italic">{scoreNote}</p>
				{#if tasks[0]}
					<p class="mt-2.5 text-[13px] text-ink-faint">
						{m.td_applies()} <b class="text-chalk">{tasks[0].label}</b>
					</p>
				{/if}
				<div class="mt-3.5 flex flex-wrap gap-2">
					{#each verdict.focus as f, i (f)}
						<Badge
							variant="outline"
							class={cn(
								'border-line font-mono text-[11px] font-normal text-ink-dim',
								i === 0 && 'border-flag text-flag'
							)}
						>
							<Prose value={f} />
						</Badge>
					{/each}
				</div>
				<div class="mt-[18px] flex flex-wrap gap-2.5">
					<Button class="bg-flag text-white hover:bg-flag/90" onclick={logVerdict}>
						{m.btn_log_session()}
					</Button>
					<Button variant="outline" onclick={recheck}>{m.td_recheck()}</Button>
					<Button href="/week" variant="ghost">{m.btn_view_protocol()}</Button>
				</div>

				{#if todayEntry && todayEntry.outcome == null}
					<div class="mt-4 border-t border-line pt-3.5">
						<div class="mb-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
							{m.rd_outcome_q()}
						</div>
						<div class="flex flex-wrap gap-2">
							{#each [{ v: 3, l: m.rd_outcome_strong() }, { v: 2, l: m.rd_outcome_ok() }, { v: 1, l: m.rd_outcome_flat() }, { v: 0, l: m.rd_outcome_bailed() }] as o (o.v)}
								<Button
									variant="outline"
									size="sm"
									class="border-line text-xs"
									onclick={() => setOutcome(o.v)}
								>
									{o.l}
								</Button>
							{/each}
						</div>
					</div>
				{:else if todayEntry?.outcome != null}
					<p class="mt-3 font-mono text-[11px] text-teal">{m.rd_outcome_saved()}</p>
				{/if}
			</div>
		</Card>
	{/if}

	{#if appState.readinessLog.length > 1}
		<Card class="mb-[22px] gap-2 p-5">
			<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
				{m.readiness_trend()}
			</span>
			<TrendChart
				points={appState.readinessLog.slice(-14).map((e) => ({ value: e.score, label: e.date }))}
				color="var(--teal)"
				fmt={(v) => String(Math.round(v))}
			/>
		</Card>
	{/if}

	<DailyFlags
		{flags}
		{content}
		onRehab={startRehabToday}
		onPlan={() => goto('/settings')}
		onDeep={(a) => (deepArea = a)}
	/>
</section>

{#if deepArea}
	<DeepAssessment area={deepArea} onClose={() => (deepArea = null)} />
{/if}
