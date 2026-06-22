<script lang="ts">
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { syncStatus } from '$lib/state.svelte';
import { cn } from '$lib/utils';

const time = $derived(
	syncStatus.at == null
		? ''
		: new Date(syncStatus.at).toLocaleTimeString(getLocale(), {
				hour: '2-digit',
				minute: '2-digit',
			}),
);

const label = $derived(
	syncStatus.status === 'saving'
		? m.sync_saving()
		: syncStatus.status === 'error'
			? m.sync_offline()
			: syncStatus.status === 'saved'
				? `${m.sync_saved()} ${time}`
				: '',
);

const dot = $derived(
	syncStatus.status === 'saving'
		? 'bg-gold'
		: syncStatus.status === 'error'
			? 'bg-flag'
			: 'bg-teal',
);
</script>

{#if syncStatus.status !== 'idle'}
	<div
		class="hidden items-center gap-1.5 font-mono text-[10px] text-ink-faint sm:flex"
		title={label}
	>
		<span class={cn('size-1.5 rounded-full', dot)}></span>
		{label}
	</div>
{/if}
