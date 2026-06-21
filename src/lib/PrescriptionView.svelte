<script lang="ts">
import type { VariantParams } from '$lib/content/types';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { costLabel, formatRange, formatSecondsRange, gripLabel } from '$lib/plan';

interface Props {
	/** A merged variant (or any params object) to render targets for. */
	spec: VariantParams & { note?: string };
}

let { spec }: Props = $props();

// Fixed display order; only the fields that are set are rendered. Timings are
// seconds ranges, counts/% pass through formatRange.
const fields = $derived(
	(
		[
			[m.presc_sets, spec.sets && formatRange(spec.sets)],
			[m.presc_reps, spec.reps && formatRange(spec.reps)],
			[m.presc_work, spec.workSec && formatSecondsRange(spec.workSec)],
			[m.presc_rest, spec.restSec && formatSecondsRange(spec.restSec)],
			[m.presc_rounds, spec.rounds && `×${formatRange(spec.rounds)}`],
			[m.presc_setrest, spec.setRestSec && formatSecondsRange(spec.setRestSec)],
			[
				m.presc_load,
				spec.loadKg && `${spec.loadKg.min >= 0 ? '+' : ''}${formatRange(spec.loadKg)}kg`,
			],
			[m.presc_edge, spec.edgeMm && `${formatRange(spec.edgeMm)}mm`],
			[m.presc_intensity, spec.intensityPct && `${formatRange(spec.intensityPct)}%`],
			[m.presc_rpe, spec.rpe && formatRange(spec.rpe)],
		] as const
	).filter(([, v]) => v),
);
</script>

<div class="flex flex-col gap-2">
	{#if fields.length}
		<div class="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12.5px]">
			{#each fields as [label, value] (label())}
				<span class="whitespace-nowrap">
					<span class="text-[10px] tracking-wider text-ink-faint uppercase">{label()}</span>
					<span class="ml-1 text-chalk">{value}</span>
				</span>
			{/each}
		</div>
	{/if}

	{#if spec.grip || spec.cnsCost || spec.toFailure}
		<div class="flex flex-wrap gap-1.5">
			{#if spec.grip}
				<span
					class="rounded-full border border-line bg-panel px-2 py-0.5 font-mono text-[10px] tracking-wide text-ink-dim uppercase"
				>
					{gripLabel(spec.grip)}
				</span>
			{/if}
			{#if spec.toFailure}
				<span
					class="rounded-full border border-flag/40 px-2 py-0.5 font-mono text-[10px] tracking-wide text-flag uppercase"
				>
					{m.presc_failure()}
				</span>
			{/if}
			{#if spec.cnsCost}
				<span
					class="rounded-full border border-line bg-panel px-2 py-0.5 font-mono text-[10px] tracking-wide text-ink-faint uppercase"
				>
					{m.presc_cns()} {costLabel(spec.cnsCost)}
				</span>
			{/if}
		</div>
	{/if}

	{#if spec.note}
		<div class="text-[12.5px] text-ink-dim"><Prose value={spec.note} /></div>
	{/if}
</div>
