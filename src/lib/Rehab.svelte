<script lang="ts">
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { getContent } from '$lib/content';
import OptionCards from '$lib/OptionCards.svelte';
import * as m from '$lib/paraglide/messages';
import { endRehab, startRehab } from '$lib/plan';
import type { RehabArea, RehabStage } from '$lib/rehab';
import { appState } from '$lib/state.svelte';

const content = getContent();
let open = $state(false);
let area = $state<RehabArea>('fingers');
let stage = $state<RehabStage>('acute');

const areaLabel: Record<RehabArea, () => string> = {
	fingers: m.area_fingers,
	elbow: m.area_elbow,
	shoulder: m.area_shoulder,
	wrist: m.area_wrist,
};
const stageLabel: Record<RehabStage, () => string> = {
	acute: m.stage_acute,
	subacute: m.stage_subacute,
	returning: m.stage_returning,
};
const stageDesc: Record<RehabStage, () => string> = {
	acute: m.stage_acute_desc,
	subacute: m.stage_subacute_desc,
	returning: m.stage_returning_desc,
};

const areaOpts = $derived(
	(['fingers', 'elbow', 'shoulder', 'wrist'] as RehabArea[]).map((a) => ({
		value: a,
		label: areaLabel[a](),
	})),
);
const stageOpts = $derived(
	(['acute', 'subacute', 'returning'] as RehabStage[]).map((s) => ({
		value: s,
		label: stageLabel[s](),
		description: stageDesc[s](),
	})),
);

function apply() {
	startRehab(content, area, stage);
	open = false;
	toast.success(m.rehab_started());
}
function end() {
	endRehab();
	toast.success(m.rehab_ended());
}
</script>

<Card class="gap-3 p-[18px]">
	<div>
		<span class="font-bold">{m.rehab_title()}</span>
		<p class="mt-0.5 max-w-[56ch] text-xs text-ink-dim">{m.rehab_desc()}</p>
	</div>

	{#if appState.rehab}
		<div class="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 font-mono text-[11px] tracking-wider text-gold uppercase">
			{m.rehab_active()} · {areaLabel[appState.rehab.area]()} · {stageLabel[appState.rehab.stage]()}
		</div>
		<Button variant="outline" size="sm" class="self-start border-line text-xs" onclick={end}>
			{m.rehab_end()}
		</Button>
	{:else if open}
		<div class="flex flex-col gap-1.5">
			<span class="text-xs text-ink-dim">{m.rehab_area()}</span>
			<OptionCards value={area} options={areaOpts} onSelect={(v) => (area = v)} />
		</div>
		<div class="flex flex-col gap-1.5">
			<span class="text-xs text-ink-dim">{m.rehab_stage()}</span>
			<OptionCards value={stage} options={stageOpts} onSelect={(v) => (stage = v)} />
		</div>
		<Button class="self-start bg-flag text-white hover:bg-flag/90" size="sm" onclick={apply}>
			{m.rehab_apply()}
		</Button>
	{:else}
		<Button
			variant="outline"
			size="sm"
			class="self-start border-line text-xs"
			onclick={() => (open = true)}
		>
			{m.rehab_start()}
		</Button>
	{/if}
</Card>
