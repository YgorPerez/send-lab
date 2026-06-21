<script lang="ts">
import XIcon from '@lucide/svelte/icons/x';
import type { Snippet } from 'svelte';
import * as m from '$lib/paraglide/messages';

interface Props {
	open: boolean;
	title?: string;
	onClose: () => void;
	children: Snippet;
}

let { open, title, onClose, children }: Props = $props();
</script>

<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape') onClose();
	}}
/>

{#if open}
	<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
		<button class="absolute inset-0 bg-black/60" aria-label={m.btn_close()} onclick={onClose}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex="-1"
			class="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-2xl"
		>
			<div class="mb-3 flex items-start justify-between gap-3">
				{#if title}<h2 class="text-[15px] font-bold">{title}</h2>{/if}
				<button
					type="button"
					class="text-ink-faint transition hover:text-flag"
					aria-label={m.btn_close()}
					onclick={onClose}
				>
					<XIcon class="size-4" />
				</button>
			</div>
			{@render children()}
		</div>
	</div>
{/if}
