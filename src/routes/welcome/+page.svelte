<script lang="ts">
import { goto } from '$app/navigation';
import AssessmentProposal from '$lib/AssessmentProposal.svelte';
import { Button } from '$lib/components/ui/button';
import { Card, CardContent } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { getContent } from '$lib/content';
import LanguageSwitcher from '$lib/LanguageSwitcher.svelte';
import OptionCards from '$lib/OptionCards.svelte';
import * as m from '$lib/paraglide/messages';
import { generateProgram, trainingDays } from '$lib/programGen';
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
import { metricUnit, showKg, toKg, toMetricCanonical } from '$lib/units';
import { cn } from '$lib/utils';

const content = getContent();
const a = appState.assessment;

let goal = $state<Goal>(a?.goal ?? 'boulder');
let focus = $state<Focus>(a?.focus ?? 'fingers');
let level = $state<Level>(a?.level ?? 'advanced');
let days = $state(a?.daysPerWeek ?? 4);
let bodyweight = $state<number | null>(a?.bodyweight != null ? showKg(a.bodyweight) : null);
let equipment = $state<Equipment[]>(a?.equipment ?? ['hangboard', 'board', 'rings', 'weights']);
let boulderGrade = $state(a?.boulderGrade ?? '');
let routeGrade = $state(a?.routeGrade ?? '');
let niggle = $state(a?.niggle ?? false);
let age = $state<number | null>(a?.age ?? null);
let sessionMinutes = $state<number | null>(a?.sessionMinutes ?? null);
let pull = $state<number | null>(null);
let pinch = $state<number | null>(null);
let maxhang = $state<number | null>(null);
let contact = $state<number | null>(null);
let cf = $state<number | null>(null);
let rfd = $state<number | null>(null);
let density = $state<number | null>(null);

let step = $state<1 | 2 | 3 | 'proposal'>(1);

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

const metric = (id: string) => content.metrics.find((mm) => mm.id === id);
const metricLabel = (id: string) =>
	`${metric(id)?.name ?? id} (${metricUnit(id, metric(id)?.unit ?? '')})`;

const STEPS = [m.welcome_step_goals, m.welcome_step_context, m.welcome_step_baseline];

const planDays = $derived(
	trainingDays(content, { goal, focus, level, daysPerWeek: days } as Assessment).map(
		(k) => content.days.find((d) => d.k === k)?.label ?? k,
	),
);

function generate() {
	const canon = (id: string, v: number | null) => (v == null ? null : toMetricCanonical(id, v));
	const baselines = {
		pull: canon('pull', pull),
		pinch: canon('pinch', pinch),
		maxhang: canon('maxhang', maxhang),
		contact: canon('contact', contact),
		cf: canon('cf', cf),
		rfd: canon('rfd', rfd),
		density: canon('density', density),
	};
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
		age,
		sessionMinutes,
		completedAt: today(),
	};
	saveAssessment(assessment, baselines);
	appState.program = generateProgram(content, assessment, baselines);
	step = 'proposal';
}

function next() {
	if (step === 3) generate();
	else if (typeof step === 'number') step = (step + 1) as 1 | 2 | 3;
}
function back() {
	if (typeof step === 'number' && step > 1) step = (step - 1) as 1 | 2 | 3;
}
</script>

<div class="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-5 py-10">
	<div class="absolute top-5 right-5"><LanguageSwitcher /></div>

	<h1 class="flex items-center gap-2.5 text-2xl font-black tracking-tight">
		<span class="inline-block h-6 w-3 -skew-x-12 bg-flag shadow-[3px_0_0_var(--flag-deep)]"></span>
		SEND&nbsp;LAB
	</h1>

	{#if step !== 'proposal'}
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
							<Input bind:value={boulderGrade} placeholder="V8" class="bg-panel-2" />
						</label>
						<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
							{m.field_route_grade()}
							<Input bind:value={routeGrade} placeholder="7c" class="bg-panel-2" />
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
					<label class="flex items-center gap-2 text-xs text-ink-dim">
						<input type="checkbox" bind:checked={niggle} class="size-4 accent-flag" />
						{m.field_niggle()}
					</label>
				{:else}
					<div class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
						{m.welcome_metrics_label()}
					</div>
					<div class="grid grid-cols-2 gap-3">
						<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
							{m.field_bodyweight()} ({appState.prefs.weight})
							<Input type="number" step="any" bind:value={bodyweight} class="bg-panel-2" />
						</label>
						<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
							{metricLabel('pull')}
							<Input type="number" step="any" bind:value={pull} class="bg-panel-2" />
						</label>
						<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
							{metricLabel('pinch')}
							<Input type="number" step="any" bind:value={pinch} class="bg-panel-2" />
						</label>
						<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
							{metricLabel('maxhang')}
							<Input type="number" step="any" bind:value={maxhang} class="bg-panel-2" />
						</label>
						<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
							{metricLabel('contact')}
							<Input type="number" step="any" bind:value={contact} class="bg-panel-2" />
						</label>
						<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
							{metricLabel('cf')}
							<Input type="number" step="any" bind:value={cf} class="bg-panel-2" />
						</label>
						<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
							{metricLabel('rfd')}
							<Input type="number" step="any" bind:value={rfd} class="bg-panel-2" />
						</label>
						<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
							{metricLabel('density')}
							<Input type="number" step="any" bind:value={density} class="bg-panel-2" />
						</label>
					</div>
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
	{:else}
		<AssessmentProposal
			{goal}
			{focus}
			{level}
			{planDays}
			days={content.days}
			onStart={() => goto('/')}
			onEdit={() => (step = 1)}
		/>
	{/if}
</div>
