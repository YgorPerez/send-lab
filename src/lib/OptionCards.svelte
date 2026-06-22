<script lang="ts" generics="T extends string">
import { cn } from '$lib/utils';

interface Props {
	value: T;
	options: { value: T; label: string }[];
	onSelect: (v: T) => void;
}
let { value, options, onSelect }: Props = $props();
</script>

<div class="grid grid-cols-2 gap-2">
	{#each options as o (o.value)}
		<button
			type="button"
			onclick={() => onSelect(o.value)}
			aria-pressed={value === o.value}
			class={cn(
				'rounded-lg border px-3 py-2.5 text-sm transition',
				value === o.value
					? 'border-flag bg-flag/15 font-semibold text-chalk'
					: 'border-line text-ink-dim hover:border-ink-faint hover:text-ink'
			)}
		>
			{o.label}
		</button>
	{/each}
</div>
