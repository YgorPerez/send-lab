<script lang="ts">
import { goto } from '$app/navigation';
import { Button } from '$lib/components/ui/button';
import { Card, CardContent } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import { getContent } from '$lib/content';
import LanguageSwitcher from '$lib/LanguageSwitcher.svelte';
import * as m from '$lib/paraglide/messages';
import { generateProgram, trainingDays } from '$lib/programGen';
import {
	type Assessment,
	appState,
	type Focus,
	type Goal,
	type Level,
	saveAssessment,
	today,
} from '$lib/state.svelte';

const content = getContent();
const a = appState.assessment;

let goal = $state<Goal>(a?.goal ?? 'boulder');
let focus = $state<Focus>(a?.focus ?? 'fingers');
let level = $state<Level>(a?.level ?? 'advanced');
let days = $state(a?.daysPerWeek ?? 4);
let bodyweight = $state<number | null>(a?.bodyweight ?? null);
let pull = $state<number | null>(null);
let pinch = $state<number | null>(null);
let maxhang = $state<number | null>(null);

let step = $state<'form' | 'proposal'>('form');

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
const goalNote: Record<Goal, () => string> = {
	boulder: m.prop_goal_boulder,
	sport: m.prop_goal_sport,
	all: m.prop_goal_all,
};
const focusNote: Record<Focus, () => string> = {
	fingers: m.prop_focus_fingers,
	power: m.prop_focus_power,
	endurance: m.prop_focus_endurance,
	tissue: m.prop_focus_tissue,
};

const metric = (id: string) => content.metrics.find((mm) => mm.id === id);

// The weekdays the generated program will train (shown on the proposal step).
const planDays = $derived(
	trainingDays(content, { goal, focus, level, daysPerWeek: days } as Assessment).map(
		(k) => content.days.find((d) => d.k === k)?.label ?? k,
	),
);

function generate() {
	const assessment: Assessment = {
		goal,
		focus,
		level,
		daysPerWeek: days,
		bodyweight,
		completedAt: today(),
	};
	saveAssessment(assessment, { pull, pinch, maxhang });
	// Tailor the actual program to the answers (not just the proposal text).
	appState.program = generateProgram(content, assessment, { pull, pinch, maxhang });
	step = 'proposal';
}
</script>

<div class="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-5 py-10">
	<div class="absolute top-5 right-5"><LanguageSwitcher /></div>

	<h1 class="flex items-center gap-2.5 text-2xl font-black tracking-tight">
		<span class="inline-block h-6 w-3 -skew-x-12 bg-flag shadow-[3px_0_0_var(--flag-deep)]"></span>
		SEND&nbsp;LAB
	</h1>

	{#if step === 'form'}
		<div>
			<h2 class="text-xl font-extrabold tracking-tight">{m.welcome_title()}</h2>
			<p class="mt-1 text-sm text-ink-dim">{m.welcome_sub()}</p>
		</div>

		<Card>
			<CardContent class="flex flex-col gap-4">
				<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
					{m.field_goal()}
					<Select type="single" value={goal} onValueChange={(v) => v && (goal = v as Goal)}>
						<SelectTrigger class="bg-panel-2">{goalLabel[goal]()}</SelectTrigger>
						<SelectContent>
							{#each Object.keys(goalLabel) as g (g)}
								<SelectItem value={g}>{goalLabel[g as Goal]()}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</label>

				<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
					{m.field_focus()}
					<Select type="single" value={focus} onValueChange={(v) => v && (focus = v as Focus)}>
						<SelectTrigger class="bg-panel-2">{focusLabel[focus]()}</SelectTrigger>
						<SelectContent>
							{#each Object.keys(focusLabel) as f (f)}
								<SelectItem value={f}>{focusLabel[f as Focus]()}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</label>

				<div class="grid grid-cols-2 gap-3">
					<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
						{m.field_level()}
						<Select type="single" value={level} onValueChange={(v) => v && (level = v as Level)}>
							<SelectTrigger class="bg-panel-2">{levelLabel[level]()}</SelectTrigger>
							<SelectContent>
								{#each Object.keys(levelLabel) as l (l)}
									<SelectItem value={l}>{levelLabel[l as Level]()}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</label>
					<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
						{m.field_days()}
						<Input type="number" min="1" max="7" bind:value={days} class="bg-panel-2" />
					</label>
				</div>

				<div class="mt-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
					{m.welcome_metrics_label()}
				</div>
				<div class="grid grid-cols-2 gap-3">
					<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
						{m.field_bodyweight()}
						<Input type="number" step="any" bind:value={bodyweight} class="bg-panel-2" />
					</label>
					<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
						{metric('pull')?.name} ({metric('pull')?.unit})
						<Input type="number" step="any" bind:value={pull} class="bg-panel-2" />
					</label>
					<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
						{metric('pinch')?.name} ({metric('pinch')?.unit})
						<Input type="number" step="any" bind:value={pinch} class="bg-panel-2" />
					</label>
					<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
						{metric('maxhang')?.name} ({metric('maxhang')?.unit})
						<Input type="number" step="any" bind:value={maxhang} class="bg-panel-2" />
					</label>
				</div>

				<Button class="mt-2 bg-flag text-white hover:bg-flag/90" onclick={generate}>
					{m.btn_generate()}
				</Button>
			</CardContent>
		</Card>
	{:else}
		<div>
			<h2 class="text-xl font-extrabold tracking-tight">{m.prop_title()}</h2>
			<p class="mt-1 text-sm text-ink-dim">
				{m.prop_intro()}
				<b class="text-chalk">{goalLabel[goal]()}</b> ·
				<b class="text-chalk">{focusLabel[focus]()}</b> · {levelLabel[level]()}
			</p>
		</div>

		<Card>
			<CardContent class="flex flex-col gap-3 text-sm text-ink-dim">
				<p class="border-l-2 border-flag pl-3"><b class="text-chalk">{m.prop_week()}</b></p>
				<div>
					<div class="mb-1.5 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
						{m.prop_training_days({ n: planDays.length })}
					</div>
					<div class="flex flex-wrap gap-1.5">
						{#each content.days as d (d.k)}
							{@const on = planDays.includes(d.label)}
							<span
								class={on
									? 'rounded-md bg-flag/15 px-2 py-1 font-mono text-[11px] text-flag'
									: 'rounded-md border border-line px-2 py-1 font-mono text-[11px] text-ink-faint'}
							>
								{d.label}
							</span>
						{/each}
					</div>
				</div>
				<p>{goalNote[goal]()}</p>
				<p>{focusNote[focus]()}</p>
			</CardContent>
		</Card>

		<div class="flex gap-2.5">
			<Button class="bg-flag text-white hover:bg-flag/90" onclick={() => goto('/')}>
				{m.prop_start()}
			</Button>
			<Button variant="outline" onclick={() => (step = 'form')}>{m.welcome_edit()}</Button>
		</div>
	{/if}
</div>
