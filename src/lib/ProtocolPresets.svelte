<script lang="ts">
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { getContent } from '$lib/content';
import * as m from '$lib/paraglide/messages';
import { buildPreset, PRESETS } from '$lib/presets';
import { appState } from '$lib/state.svelte';

const content = getContent();

const NAME: Record<string, () => string> = {
	'boulder-power': m.preset_boulder_power_name,
	'sport-endurance': m.preset_sport_endurance_name,
	'finger-base': m.preset_finger_base_name,
	'tissue-base': m.preset_tissue_base_name,
	'all-round': m.preset_all_round_name,
};
const DESC: Record<string, () => string> = {
	'boulder-power': m.preset_boulder_power_desc,
	'sport-endurance': m.preset_sport_endurance_desc,
	'finger-base': m.preset_finger_base_desc,
	'tissue-base': m.preset_tissue_base_desc,
	'all-round': m.preset_all_round_desc,
};

function use(id: string) {
	const program = buildPreset(content, id);
	if (!program) return;
	appState.program = program;
	toast.success(m.preset_applied());
}
</script>

<Card class="gap-3 p-[18px]">
	<div>
		<span class="font-bold">{m.preset_title()}</span>
		<p class="mt-0.5 max-w-[64ch] text-xs text-ink-dim">{m.preset_desc()}</p>
	</div>
	<div class="flex flex-col gap-1.5">
		{#each PRESETS as p (p.id)}
			<div class="flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-3 py-2">
				<div class="min-w-0 flex-1">
					<div class="text-[13px] font-semibold text-chalk">{NAME[p.id]()}</div>
					<div class="text-xs text-ink-faint">{DESC[p.id]()}</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					class="flex-none border-line text-xs"
					onclick={() => use(p.id)}
				>
					{m.preset_use()}
				</Button>
			</div>
		{/each}
	</div>
</Card>
