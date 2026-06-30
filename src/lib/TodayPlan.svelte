<script lang="ts">
import CheckIcon from '@lucide/svelte/icons/check';
import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
import { Card } from '$lib/components/ui/card';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils';

interface Task {
	id: string;
	label: string;
	done: boolean;
}

let {
	day,
	dayLabel,
	week,
	isRestDay,
	tasks,
	heldIds = new Set<string>(),
}: {
	day: { color: string; load: string; sec: string };
	dayLabel: string;
	week: number;
	isRestDay: boolean;
	tasks: Task[];
	/** Exercise ids held back by today's readiness cap — shown but de-emphasised. */
	heldIds?: Set<string>;
} = $props();
</script>

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
				{@const held = heldIds.has(task.id) && !task.done}
				<a
					href="/train?ex={task.id}"
					class={cn(
						'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition',
						task.done
							? 'border-teal/40 bg-teal/5 text-ink-faint'
							: held
								? 'border-dashed border-line bg-transparent text-ink-faint hover:text-ink'
								: 'border-line bg-panel-2 text-ink-dim hover:border-flag hover:text-chalk'
					)}
				>
					{#if task.done}
						<CheckIcon class="size-4 flex-none text-teal" />
					{/if}
					<span class={cn('flex-1', task.done && 'line-through')}>{task.label}</span>
					<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
						{task.done ? m.lbl_done() : held ? m.td_held() : m.td_open_train()}
					</span>
					<ChevronRightIcon class="size-4" />
				</a>
			{/each}
		</div>
	{/if}
</Card>
