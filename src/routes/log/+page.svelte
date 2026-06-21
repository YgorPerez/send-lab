<script lang="ts">
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import * as m from '$lib/paraglide/messages';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState, resetAll } from '$lib/state.svelte';

const typeLabel: Record<string, () => string> = {
	rec: m.log_type_rec,
	day: m.log_type_day,
	test: m.log_type_test,
};

function remove(idx: number) {
	appState.log.splice(idx, 1);
}

function reset() {
	if (confirm(m.reset_confirm())) {
		resetAll();
		toast.success(m.toast_all_reset());
	}
}
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_log()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">{m.lede_log()}</p>

	{#if appState.log.length === 0}
		<div class="rounded-xl border border-dashed border-line px-5 py-[46px] text-center text-sm text-ink-faint">
			{m.log_empty()}
		</div>
	{:else}
		<div class="flex flex-col gap-2.5">
			{#each appState.log.slice(0, 120) as entry, idx (entry)}
				<div class="flex items-center gap-3.5 rounded-[10px] border border-line bg-panel px-4 py-3.5">
					<span class="w-[90px] flex-none font-mono text-xs text-ink-faint">{entry.date}</span>
					<span
						class="flex-none rounded-md px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide uppercase"
						style:background="color-mix(in srgb, {entry.color} 18%, transparent)"
						style:color={entry.color}
					>
						{typeLabel[entry.type]?.() ?? entry.type}
					</span>
					<span class="flex-1 text-[13px] text-ink-dim">
						<b class="text-chalk">{entry.label}</b>{entry.note ? ` · ${entry.note}` : ''}
					</span>
					<button
						type="button"
						title="delete"
						onclick={() => remove(idx)}
						class="px-1 text-base text-ink-faint transition hover:text-flag"
					>
						✕
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<Button
		variant="outline"
		size="sm"
		onclick={reset}
		class="mt-3.5 border-line font-mono text-[11px] text-ink-faint hover:border-flag hover:text-flag"
	>
		{m.btn_reset_all()}
	</Button>
</section>
