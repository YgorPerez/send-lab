<script lang="ts">
import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
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
import ReadinessQuiz from '$lib/ReadinessQuiz.svelte';
import ReadinessVerdict from '$lib/ReadinessVerdict.svelte';
import Rehab from '$lib/Rehab.svelte';
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
import TodayPlan from '$lib/TodayPlan.svelte';
import TrendChart from '$lib/TrendChart.svelte';
import { toMetricCanonical } from '$lib/units';

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

// Auto-log the readiness check once every shown question is answered: upsert
// today's entry with the full response + conclusion. No manual save needed; the
// early-return on no-change keeps the write from re-triggering this effect.
$effect(() => {
	if (!complete || !readiness) return;
	const d = today();
	const rl = appState.readinessLog;
	const existing = rl.find((e) => e.date === d);
	const flags = readiness.flags.map((f) => ({
		id: f.id,
		severity: f.severity,
		...(f.area ? { area: f.area } : {}),
	}));
	const snap = { ...answers };
	if (
		existing &&
		existing.score === readiness.score &&
		existing.verdict === readiness.verdict &&
		JSON.stringify(existing.answers) === JSON.stringify(snap) &&
		JSON.stringify(existing.flags) === JSON.stringify(flags)
	)
		return;
	const entry: ReadinessEntry = {
		date: d,
		at: existing?.at ?? Date.now(),
		verdict: readiness.verdict,
		score: readiness.score,
		answers: snap,
		flags,
		...(existing?.outcome != null ? { outcome: existing.outcome } : {}),
	};
	if (existing) Object.assign(existing, entry);
	else rl.push(entry);
});

// Bank today's objective probe reading (for the personal baseline) once the
// check is complete and a value has been entered.
$effect(() => {
	if (!complete) return;
	const v = probeValue;
	if (v == null || Number.isNaN(v) || v <= 0) return;
	const d = today();
	const pe = appState.probeLog.find((p) => p.date === d);
	if (pe) {
		if (pe.value !== v) pe.value = v;
	} else {
		appState.probeLog.push({ date: d, at: Date.now(), value: v });
	}
});
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_today()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">
		<Prose value={m.lede_today()} />
	</p>


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

	<TodayPlan {day} {dayLabel} {week} {isRestDay} {tasks} />

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

	<ReadinessQuiz
		questions={visibleQuiz}
		{answers}
		onPick={pick}
		{studyUrl}
		{probeValue}
		onProbe={(v) => (probeValue = v)}
		{probeResult}
	/>

	{#if verdict && readiness}
		<ReadinessVerdict
			{verdict}
			score={readiness.score}
			{baselineLabel}
			{breakdown}
			{scoreNote}
			firstTaskLabel={tasks[0]?.label}
			showOutcomeCapture={!!todayEntry && todayEntry.outcome == null}
			outcomeSaved={todayEntry?.outcome != null}
			onRecheck={recheck}
			onSetOutcome={setOutcome}
		/>
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

	<!-- Injury / rehab entry point: start (or end) a conservative rehab block right here. -->
	<div class="mt-[22px]">
		<Rehab />
	</div>
</section>

{#if deepArea}
	<DeepAssessment area={deepArea} onClose={() => (deepArea = null)} />
{/if}
