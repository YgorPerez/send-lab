<script lang="ts">
import { goto } from '$app/navigation';
import { customMarkers, type Marker, METRIC_EXERCISE } from '$lib/assessment';
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
const BUILTIN = ['pull', 'pinch', 'maxhang', 'contact', 'cf', 'rfd', 'density'];
const builtinMarkers = BUILTIN.map((id): Marker => {
	const mm = content.metrics.find((x) => x.id === id);
	return {
		id,
		name: mm?.name ?? id,
		abbr: '',
		cat: mm?.cat ?? '',
		unit: mm?.unit ?? '',
		desc: mm?.desc ?? '',
	};
});
const markers = $derived<Marker[]>([...builtinMarkers, ...customMarkers()]);

const markerExercise = (mk: Marker) =>
	METRIC_EXERCISE[mk.id as MetricId] ?? (mk.custom ? mk.id : undefined);
</script>

<p class="text-xs text-ink-faint">{m.welcome_baseline_help()}</p>
<div class="grid grid-cols-2 gap-3">
	<label class="flex flex-col gap-1 text-xs text-ink-dim">
		{m.field_bodyweight()} ({appState.prefs.weight})
		<Input type="number" step="any" bind:value={bodyweight} class="bg-panel-2" />
	</label>
	{#each markers as mk (mk.id)}
		{@const exId = markerExercise(mk)}
		<div class="flex flex-col gap-1 text-xs text-ink-dim">
			<label class="flex flex-col gap-1">
				{mk.name} ({metricUnit(mk.id, mk.unit)})
				<Input type="number" step="any" bind:value={baseline[mk.id]} class="bg-panel-2" />
			</label>
			<span class="text-[10px] leading-snug text-ink-faint">{mk.desc}</span>
			{#if exId}
				<button
					type="button"
					class="self-start font-mono text-[10px] tracking-wider text-flag uppercase hover:underline"
					onclick={() => goto(`/train?ex=${exId}&assess=${mk.id}&from=welcome`)}
				>
					{m.assess_test_in_train()}
				</button>
			{/if}
		</div>
	{/each}
</div>
