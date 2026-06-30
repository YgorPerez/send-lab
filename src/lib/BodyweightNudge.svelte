<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import * as m from '$lib/paraglide/messages';
import { appState, today } from '$lib/state.svelte';
import { toMetricCanonical } from '$lib/units';

// Daily bodyweight nudge — it anchors the % bodyweight strength estimates.
// Hidden once today's bodyweight is logged.
let bwInput = $state('');
const bwLoggedToday = $derived(appState.metrics.bodyweight.some((e) => e.date === today()));
function logBodyweight() {
	const n = Number.parseFloat(bwInput);
	if (Number.isNaN(n)) return;
	appState.metrics.bodyweight.push({
		date: today(),
		at: Date.now(),
		v: toMetricCanonical('bodyweight', n),
	});
	bwInput = '';
}
</script>

{#if !bwLoggedToday}
	<div class="mb-[22px] flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5">
		<span class="flex-1 text-[13px] text-ink-dim">
			{m.bw_prompt()} ({appState.prefs.weight})
		</span>
		<Input
			type="number"
			step="any"
			bind:value={bwInput}
			class="h-8 w-24 bg-panel-2 text-center text-sm"
		/>
		<Button size="sm" class="bg-chalk text-bg hover:bg-chalk/90" onclick={logBodyweight}>
			{m.btn_save()}
		</Button>
	</div>
{/if}
