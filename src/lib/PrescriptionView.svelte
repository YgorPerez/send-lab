<script lang="ts">
import type { Prescription } from '$lib/content/types';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { formatSeconds } from '$lib/plan';

interface Props {
	spec: Prescription;
}

let { spec }: Props = $props();

// Fixed display order; only the fields that are set are rendered. Timings are
// stored in seconds and formatted; counts/loads pass through as-is.
const fields = $derived(
	(
		[
			[m.presc_sets, spec.sets],
			[m.presc_reps, spec.reps],
			[m.presc_work, spec.workSec != null ? formatSeconds(spec.workSec) : undefined],
			[m.presc_rest, spec.restSec != null ? formatSeconds(spec.restSec) : undefined],
			[m.presc_rounds, spec.rounds != null ? `×${spec.rounds}` : undefined],
			[m.presc_setrest, spec.setRestSec != null ? formatSeconds(spec.setRestSec) : undefined],
			[m.presc_load, spec.load],
			[m.presc_edge, spec.edge],
			[m.presc_intensity, spec.intensity],
		] as const
	).filter(([, v]) => v != null && v !== ''),
);
</script>

<div class="flex flex-col gap-1.5">
	{#if fields.length}
		<div class="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12.5px]">
			{#each fields as [label, value] (label())}
				<span class="whitespace-nowrap">
					<span class="text-[10px] tracking-wider text-ink-faint uppercase">{label()}</span>
					<span class="ml-1 text-chalk"><Prose value={value ?? ''} /></span>
				</span>
			{/each}
		</div>
	{/if}
	{#if spec.note}
		<div class="text-[12.5px] text-ink-dim"><Prose value={spec.note} /></div>
	{/if}
</div>
