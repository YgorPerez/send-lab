<script lang="ts">
import TimerIcon from '@lucide/svelte/icons/timer';
import { goto } from '$app/navigation';
import { Button } from '$lib/components/ui/button';
import { getContent, type MetricId } from '$lib/content';
import { gradeLabel, isGradeMetric } from '$lib/grades';
import MetricCard from '$lib/MetricCard.svelte';
import Modal from '$lib/Modal.svelte';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState, round } from '$lib/state.svelte';
import { metricUnit, showMetric } from '$lib/units';

const content = getContent();

type Metric = (typeof content.metrics)[number];
let openMetric = $state<Metric | null>(null);

// The exercise that produces each metric — the assessment is run as that
// exercise in the Train tab.
const METRIC_EXERCISE: Partial<Record<MetricId, string>> = {
	rfd: 'recruit',
	contact: 'recruit',
	cf: 'repeaters',
	pinch: 'pinch',
	pull: 'pull',
	maxhang: 'maxhang',
	density: 'density',
};

/** Open the Train tab, adding the metric's exercise to today and selecting it.
 *  The `assess` flag tells Train to auto-record this metric when the set is logged. */
function openInTrain(metric: Metric) {
	const exId = METRIC_EXERCISE[metric.id];
	if (!exId) return;
	openMetric = null;
	void goto(`/train?ex=${exId}&assess=${metric.id}`);
}
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_metrics()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">
		<Prose value={m.lede_metrics()} />
	</p>

	<div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
		{#each content.metrics as metric (metric.id)}
			<MetricCard {metric} onInfo={(mm) => (openMetric = mm)} />
		{/each}
	</div>
</section>

{#if openMetric}
	{@const exId = METRIC_EXERCISE[openMetric.id]}
	{@const ex = exId ? content.exercises[exId] : undefined}
	{@const history = appState.metrics[openMetric.id] ?? []}
	<Modal open={true} title={openMetric.name} onClose={() => (openMetric = null)}>
		<div class="mb-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.metric_howto()}
		</div>
		<p class="mb-3 text-sm leading-relaxed text-ink-dim"><Prose value={openMetric.desc} /></p>
		<div class="mb-4 font-mono text-xs text-ink-faint">
			{m.metric_unit_label()}:
			<span class="text-chalk">{metricUnit(openMetric.id, openMetric.unit)}</span>
		</div>
		{#if ex}
			<div class="mb-2 font-mono text-xs text-ink-faint">
				{m.metric_via()} <span class="text-chalk">{ex.name}</span>
			</div>
			<Button
				class="mb-4 w-full bg-flag text-white hover:bg-flag/90"
				onclick={() => openMetric && openInTrain(openMetric)}
			>
				<TimerIcon class="mr-1.5 size-4" />{m.metric_to_train()}
			</Button>
		{/if}

		<div class="mb-1.5 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.metric_history()}
		</div>
		{#if history.length}
			<div class="flex flex-col gap-1">
				{#each [...history].reverse().slice(0, 12) as e (e.date + e.v)}
					<div class="flex justify-between border-b border-line/60 py-1 font-mono text-xs">
						<span class="text-ink-faint">{e.date}</span>
						<span class="text-chalk">
							{#if isGradeMetric(openMetric.id)}
								{gradeLabel(openMetric.id, e.v)}
							{:else}
								{round(showMetric(openMetric.id, e.v))}
								{metricUnit(openMetric.id, openMetric.unit)}
							{/if}
						</span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-xs text-ink-faint">{m.metric_no_history()}</p>
		{/if}
	</Modal>
{/if}
