<script lang="ts">
import { browser } from '$app/environment';
import BaselineStep from '$lib/BaselineStep.svelte';
import { Button } from '$lib/components/ui/button';
import { Card, CardContent } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import { getContent } from '$lib/content';
import { BOULDER_SCALE, gradeIndex, ROUTE_SCALE } from '$lib/grades';
import OptionCards from '$lib/OptionCards.svelte';
import PainCheck from '$lib/PainCheck.svelte';
import * as m from '$lib/paraglide/messages';
import { generateProgram } from '$lib/programGen';
import {
	type Assessment,
	appState,
	type Equipment,
	type Focus,
	type Goal,
	type Level,
	saveAssessment,
	today,
} from '$lib/state.svelte';
import { showKg, showMetric, toKg, toMetricCanonical } from '$lib/units';
import { cn } from '$lib/utils';

let { onComplete }: { onComplete: () => void } = $props();

const content = getContent();
const a = appState.assessment;

// Persist the in-progress wizard so a refresh mid-assessment doesn't lose it.
const DRAFT_KEY = 'sendlab:assessmentDraft';
function loadDraft(): Record<string, unknown> | null {
	if (!browser) return null;
	try {
		return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
	} catch {
		return null;
	}
}
const d = loadDraft();

let goal = $state<Goal>((d?.goal as Goal) ?? a?.goal ?? 'boulder');
let focus = $state<Focus>((d?.focus as Focus) ?? a?.focus ?? 'fingers');
let level = $state<Level>((d?.level as Level) ?? a?.level ?? 'advanced');
let days = $state<number>((d?.days as number) ?? a?.daysPerWeek ?? 4);
// Sensible starting weights for a brand-new assessment (skipped on a redo, where
// real markers already exist). Stored canonically; shown in the chosen unit.
const FRESH_LOAD: Record<Level, { maxhang: number; pull: number; pinch: number }> = {
	intermediate: { maxhang: 15, pull: 15, pinch: 10 },
	advanced: { maxhang: 30, pull: 30, pinch: 18 },
	elite: { maxhang: 45, pull: 45, pinch: 28 },
};
let bodyweight = $state<number | null>(
	(d?.bodyweight as number | null) ?? showKg(a?.bodyweight ?? (a ? null : 70)),
);
let equipment = $state<Equipment[]>(
	(d?.equipment as Equipment[]) ?? a?.equipment ?? ['hangboard', 'board', 'rings', 'weights'],
);
let boulderGrade = $state<string>((d?.boulderGrade as string) ?? a?.boulderGrade ?? '');
let routeGrade = $state<string>((d?.routeGrade as string) ?? a?.routeGrade ?? '');
let niggle = $state<boolean>((d?.niggle as boolean) ?? a?.niggle ?? false);
let synovitis = $state<boolean>((d?.synovitis as boolean) ?? a?.synovitis ?? false);
let age = $state<number | null>((d?.age as number | null) ?? a?.age ?? null);
let sessionMinutes = $state<number | null>(
	(d?.sessionMinutes as number | null) ?? a?.sessionMinutes ?? null,
);
const BASELINES = ['pull', 'pinch', 'maxhang', 'contact', 'cf', 'rfd', 'density'];
// Baseline test values keyed by marker id (display units; converted on submit).
function freshBaseline(): Record<string, number | null> {
	if (a) return {}; // redo: leave blank — real markers already live in Metrics
	const L = FRESH_LOAD[level];
	return {
		maxhang: showMetric('maxhang', L.maxhang),
		pull: showMetric('pull', L.pull),
		pinch: showMetric('pinch', L.pinch),
	};
}
let baseline = $state<Record<string, number | null>>(
	(d?.baseline as Record<string, number | null>) ?? freshBaseline(),
);

let step = $state<1 | 2 | 3>((d?.step as 1 | 2 | 3) ?? 1);

$effect(() => {
	if (!browser) return;
	const snapshot = {
		goal,
		focus,
		level,
		days,
		bodyweight,
		equipment,
		boulderGrade,
		routeGrade,
		niggle,
		synovitis,
		age,
		sessionMinutes,
		baseline,
		step,
	};
	localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
});

const goalLabel: Record<Goal, () => string> = {
	boulder: m.goal_boulder,
	sport: m.goal_sport,
	all: m.goal_all,
};
const focusLabel: Record<Focus, () => string> = {
	fingers: m.focus_fingers,
	power: m.focus_power,
	endurance: m.focus_endurance,
	tissue: m.focus_tissue,
};
const levelLabel: Record<Level, () => string> = {
	intermediate: m.level_intermediate,
	advanced: m.level_advanced,
	elite: m.level_elite,
};
const levelDesc: Record<Level, () => string> = {
	intermediate: m.level_desc_intermediate,
	advanced: m.level_desc_advanced,
	elite: m.level_desc_elite,
};
const goalOpts = $derived(
	(['boulder', 'sport', 'all'] as Goal[]).map((g) => ({ value: g, label: goalLabel[g]() })),
);
const focusOpts = $derived(
	(['fingers', 'power', 'endurance', 'tissue'] as Focus[]).map((f) => ({
		value: f,
		label: focusLabel[f](),
	})),
);
const levelOpts = $derived(
	(['intermediate', 'advanced', 'elite'] as Level[]).map((l) => ({
		value: l,
		label: levelLabel[l](),
		description: levelDesc[l](),
	})),
);

const EQUIPMENT: Equipment[] = ['hangboard', 'board', 'rings', 'weights'];
const equipLabel: Record<Equipment, () => string> = {
	hangboard: m.equip_hangboard,
	board: m.equip_board,
	rings: m.equip_rings,
	weights: m.equip_weights,
};
function toggleEquip(e: Equipment) {
	equipment = equipment.includes(e) ? equipment.filter((x) => x !== e) : [...equipment, e];
}

const STEPS = [m.welcome_step_goals, m.welcome_step_context, m.welcome_step_baseline];

function generate() {
	const canon = (id: string, v: number | null) => (v == null ? null : toMetricCanonical(id, v));
	const grade = (id: string, label: string) => {
		const i = gradeIndex(id, label);
		return i >= 0 ? i : null;
	};
	const baselines: Record<string, number | null> = {
		boulder: grade('boulder', boulderGrade),
		route: grade('route', routeGrade),
	};
	for (const id of BASELINES) baselines[id] = canon(id, baseline[id] ?? null);
	const assessment: Assessment = {
		goal,
		focus,
		level,
		daysPerWeek: days,
		bodyweight: bodyweight == null ? null : toKg(bodyweight),
		equipment,
		boulderGrade: boulderGrade.trim() || null,
		routeGrade: routeGrade.trim() || null,
		niggle,
		synovitis,
		age,
		sessionMinutes,
		completedAt: today(),
	};
	saveAssessment(assessment, baselines);
	appState.program = generateProgram(content, assessment, baselines);
	if (browser) localStorage.removeItem(DRAFT_KEY);
	onComplete();
}

function next() {
	if (step === 3) generate();
	else step = (step + 1) as 1 | 2 | 3;
}
function back() {
	if (step > 1) step = (step - 1) as 1 | 2 | 3;
}
</script>

<div>
	<h2 class="text-xl font-extrabold tracking-tight">{m.welcome_title()}</h2>
	<p class="mt-1 text-sm text-ink-dim">{m.welcome_sub()}</p>
</div>

<div class="flex items-center gap-2">
	{#each STEPS as label, i (label)}
		<div class="flex-1">
			<div class={cn('h-1.5 rounded', step >= i + 1 ? 'bg-flag' : 'bg-line')}></div>
			<div
				class={cn(
					'mt-1 font-mono text-[10px] tracking-wider uppercase',
					step >= i + 1 ? 'text-ink-dim' : 'text-ink-faint'
				)}
			>
				{label()}
			</div>
		</div>
	{/each}
</div>

<Card>
	<CardContent class="flex flex-col gap-4">
		{#if step === 1}
			<p class="text-xs text-ink-faint">{m.welcome_goals_help()}</p>
			<div class="flex flex-col gap-1.5">
				<span class="text-xs text-ink-dim">{m.field_goal()}</span>
				<OptionCards value={goal} options={goalOpts} onSelect={(v) => (goal = v)} />
			</div>
			<div class="flex flex-col gap-1.5">
				<span class="text-xs text-ink-dim">{m.field_focus()}</span>
				<OptionCards value={focus} options={focusOpts} onSelect={(v) => (focus = v)} />
			</div>
			<div class="flex flex-col gap-1.5">
				<span class="text-xs text-ink-dim">{m.field_level()}</span>
				<OptionCards value={level} options={levelOpts} onSelect={(v) => (level = v)} />
			</div>
			<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
				{m.field_days()}
				<Input type="number" min="1" max="7" bind:value={days} class="bg-panel-2" />
			</label>
		{:else if step === 2}
			<p class="text-xs text-ink-faint">{m.welcome_context_help()}</p>
			<div class="flex flex-col gap-1.5">
				<span class="text-xs text-ink-dim">{m.field_equipment()}</span>
				<div class="flex flex-wrap gap-1.5">
					{#each EQUIPMENT as eq (eq)}
						<button
							type="button"
							onclick={() => toggleEquip(eq)}
							aria-pressed={equipment.includes(eq)}
							class={cn(
								'rounded-md border px-2.5 py-1 text-xs transition',
								equipment.includes(eq)
									? 'border-flag bg-flag/15 text-flag'
									: 'border-line text-ink-faint hover:text-ink'
							)}
						>
							{equipLabel[eq]()}
						</button>
					{/each}
				</div>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
					{m.field_boulder_grade()}
					<Select type="single" value={boulderGrade} onValueChange={(v) => (boulderGrade = v ?? '')}>
						<SelectTrigger class="bg-panel-2">{boulderGrade || '—'}</SelectTrigger>
						<SelectContent>
							{#each BOULDER_SCALE as g (g)}<SelectItem value={g}>{g}</SelectItem>{/each}
						</SelectContent>
					</Select>
				</label>
				<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
					{m.field_route_grade()}
					<Select type="single" value={routeGrade} onValueChange={(v) => (routeGrade = v ?? '')}>
						<SelectTrigger class="bg-panel-2">{routeGrade || '—'}</SelectTrigger>
						<SelectContent>
							{#each ROUTE_SCALE as g (g)}<SelectItem value={g}>{g}</SelectItem>{/each}
						</SelectContent>
					</Select>
				</label>
				<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
					{m.field_age()}
					<Input type="number" min="0" bind:value={age} class="bg-panel-2" />
				</label>
				<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
					{m.field_session()}
					<Input type="number" min="0" bind:value={sessionMinutes} class="bg-panel-2" />
				</label>
			</div>
			<PainCheck bind:niggle bind:synovitis />
		{:else}
			<BaselineStep bind:bodyweight bind:baseline />
		{/if}

		<div class="mt-1 flex gap-2.5">
			{#if step > 1}
				<Button variant="outline" onclick={back}>{m.btn_back()}</Button>
			{/if}
			<Button class="flex-1 bg-flag text-white hover:bg-flag/90" onclick={next}>
				{step === 3 ? m.btn_generate() : m.btn_next()}
			</Button>
		</div>
	</CardContent>
</Card>
