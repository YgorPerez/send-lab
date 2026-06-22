<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { Card, CardContent } from '$lib/components/ui/card';
import type { Day } from '$lib/content/types';
import * as m from '$lib/paraglide/messages';
import type { Focus, Goal, Level } from '$lib/state.svelte';

interface Props {
	goal: Goal;
	focus: Focus;
	level: Level;
	planDays: string[];
	days: Day[];
	onStart: () => void;
	onEdit: () => void;
}
let { goal, focus, level, planDays, days, onStart, onEdit }: Props = $props();

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
</script>

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
				{#each days as d (d.k)}
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
	<Button class="bg-flag text-white hover:bg-flag/90" onclick={onStart}>{m.prop_start()}</Button>
	<Button variant="outline" onclick={onEdit}>{m.welcome_edit()}</Button>
</div>
