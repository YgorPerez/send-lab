<script lang="ts">
import { goto } from '$app/navigation';
import { METRIC_EXERCISE } from '$lib/assessment';
import { Input } from '$lib/components/ui/input';
import { getContent, type MetricId } from '$lib/content';
import * as m from '$lib/paraglide/messages';
import { appState } from '$lib/state.svelte';
import { metricUnit } from '$lib/units';

let {
	bodyweight = $bindable(),
	baseline = $bindable(),
}: { bodyweight: number | null; baseline: Record<string, number | null> } = $props();

const content = getContent();
const BASELINES = ['pull', 'pinch', 'maxhang', 'contact', 'cf', 'rfd', 'density'];
const metric = (id: string) => content.metrics.find((mm) => mm.id === id);
const metricLabel = (id: string) =>
	`${metric(id)?.name ?? id} (${metricUnit(id, metric(id)?.unit ?? '')})`;
</script>

<p class="text-xs text-ink-faint">{m.welcome_baseline_help()}</p>
<div class="grid grid-cols-2 gap-3">
	<label class="flex flex-col gap-1 text-xs text-ink-dim">
		{m.field_bodyweight()} ({appState.prefs.weight})
		<Input type="number" step="any" bind:value={bodyweight} class="bg-panel-2" />
	</label>
	{#each BASELINES as id (id)}
		<div class="flex flex-col gap-1 text-xs text-ink-dim">
			<label class="flex flex-col gap-1">
				{metricLabel(id)}
				<Input type="number" step="any" bind:value={baseline[id]} class="bg-panel-2" />
			</label>
			<span class="text-[10px] leading-snug text-ink-faint">{metric(id)?.desc}</span>
			{#if METRIC_EXERCISE[id as MetricId]}
				<button
					type="button"
					class="self-start font-mono text-[10px] tracking-wider text-flag uppercase hover:underline"
					onclick={() => goto(`/train?ex=${METRIC_EXERCISE[id as MetricId]}&assess=${id}&from=welcome`)}
				>
					{m.assess_test_in_train()}
				</button>
			{/if}
		</div>
	{/each}
</div>
