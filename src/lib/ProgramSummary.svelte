<script lang="ts">
import CheckIcon from '@lucide/svelte/icons/check';
import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
import Bars from '$lib/Bars.svelte';
import { Card } from '$lib/components/ui/card';
import { getContent } from '$lib/content';
import * as m from '$lib/paraglide/messages';
import { qualityLabel, regionLabel } from '$lib/plan';
import { programSummary } from '$lib/programStats';

const content = getContent();
const summary = $derived(programSummary(content));

const REGION_COLOR: Record<string, string> = {
	fingers: 'var(--flag)',
	wrist: 'var(--gold)',
	pull: 'var(--violet)',
	antagonist: 'var(--teal)',
};
const regionBars = $derived(
	summary.regions.map((b) => ({
		label: regionLabel(b.key),
		value: b.value,
		color: REGION_COLOR[b.key],
	})),
);
const qualityBars = $derived(
	summary.qualities.map((b) => ({ label: qualityLabel(b.key), value: b.value })),
);
</script>

<Card class="gap-4 p-[18px]">
	<div class="flex items-center justify-between gap-3">
		<span class="font-bold">{m.prog_summary()}</span>
		<div class="flex gap-4 font-mono text-[11px] text-ink-faint">
			<span>{m.prog_week_sets()} <span class="text-chalk">{summary.totalSets}</span></span>
			<span>{m.prog_week_cns()} <span class="text-chalk">{summary.totalCns}</span></span>
		</div>
	</div>

	<div class="grid gap-5 sm:grid-cols-2">
		<div>
			<div class="mb-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
				{m.stats_by_region()}
			</div>
			<Bars bars={regionBars} unit={m.stats_sets()} />
		</div>
		<div>
			<div class="mb-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
				{m.stats_by_quality()}
			</div>
			<Bars bars={qualityBars} unit={m.stats_sets()} />
		</div>
	</div>

	{#if summary.warnings.length}
		<div class="flex flex-col gap-1.5">
			{#each summary.warnings as w (w)}
				<div class="flex items-start gap-2 text-[13px] text-ink-dim">
					<AlertTriangleIcon class="mt-0.5 size-3.5 flex-none text-gold" />
					{w}
				</div>
			{/each}
		</div>
	{:else}
		<div class="flex items-center gap-2 text-[13px] text-teal">
			<CheckIcon class="size-3.5 flex-none" />
			{m.prog_ok()}
		</div>
	{/if}
</Card>
