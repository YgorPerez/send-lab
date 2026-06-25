<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import { getContent } from '$lib/content';
import Modal from '$lib/Modal.svelte';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { timerSeedFor } from '$lib/plan';
import Timer from '$lib/Timer.svelte';
import { configureTimer, dismissTimer } from '$lib/timerStore.svelte';

// A focused, single-exercise baseline test: the exercise's cue + its interval
// timer + one result field — no full Train UI. The result fills the baseline.
let {
	exId,
	name,
	unit,
	onSave,
	onClose,
}: {
	exId: string;
	name: string;
	unit: string;
	onSave: (v: number) => void;
	onClose: () => void;
} = $props();

const content = getContent();
const variant = $derived(content.exercises[exId]?.variants[0]);
// Drive the shared timer with this exercise's interval prescription (if any).
const seed = $derived(variant ? timerSeedFor(variant, `assess:${exId}`, name) : null);
let result = $state<number | null>(null);

$effect(() => {
	if (seed) configureTimer(seed, true);
	return () => dismissTimer();
});

function save() {
	if (result == null || Number.isNaN(result)) return;
	onSave(result);
}
</script>

<Modal open={true} title={name} onClose={onClose}>
	{#if variant}
		<p class="mb-2 text-sm text-ink-dim">{variant.what}</p>
		{#if variant.note}
			<p class="mb-3 text-xs text-ink-faint"><Prose value={variant.note} /></p>
		{/if}
	{/if}

	{#if seed}
		<div class="mb-4"><Timer /></div>
	{/if}

	<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
		{m.assess_result()} ({unit})
		<Input type="number" step="any" bind:value={result} class="bg-panel-2" />
	</label>

	<div class="mt-4 flex gap-2.5">
		<Button variant="outline" class="flex-1" onclick={onClose}>{m.btn_close()}</Button>
		<Button class="flex-1 bg-flag text-white hover:bg-flag/90" onclick={save}>
			{m.assess_save()}
		</Button>
	</div>
</Modal>
