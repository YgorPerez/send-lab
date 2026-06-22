<script lang="ts" generics="T extends string">
import { cn } from '$lib/utils';

interface Option {
	value: T;
	label: string;
	description?: string;
}
interface Props {
	value: T;
	options: Option[];
	onSelect: (v: T) => void;
}
let { value, options, onSelect }: Props = $props();

// With descriptions, stack full-width rows; otherwise a compact 2-up grid.
const described = $derived(options.some((o) => o.description));
</script>

<div class={described ? 'flex flex-col gap-2' : 'grid grid-cols-2 gap-2'}>
	{#each options as o (o.value)}
		<button
			type="button"
			onclick={() => onSelect(o.value)}
			aria-pressed={value === o.value}
			class={cn(
				'rounded-lg border px-3 py-2.5 text-left text-sm transition',
				value === o.value
					? 'border-flag bg-flag/15 text-chalk'
					: 'border-line text-ink-dim hover:border-ink-faint hover:text-ink'
			)}
		>
			<span class="font-semibold">{o.label}</span>
			{#if o.description}
				<span class="mt-0.5 block text-xs leading-snug text-ink-faint">{o.description}</span>
			{/if}
		</button>
	{/each}
</div>
