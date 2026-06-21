<script lang="ts">
interface Bar {
	label: string;
	value: number;
	color?: string;
}
interface Props {
	bars: Bar[];
	unit?: string;
}

let { bars, unit = '' }: Props = $props();

const max = $derived(Math.max(1, ...bars.map((b) => b.value)));
</script>

<div class="flex flex-col gap-1.5">
	{#each bars as b (b.label)}
		<div class="flex items-center gap-2.5">
			<span class="w-24 flex-none truncate text-right font-mono text-[11px] text-ink-dim">
				{b.label}
			</span>
			<div class="h-2.5 flex-1 overflow-hidden rounded bg-panel-2">
				<div
					class="h-full rounded"
					style:width="{(b.value / max) * 100}%"
					style:background={b.color ?? 'var(--gold)'}
				></div>
			</div>
			<span class="w-14 flex-none font-mono text-[11px] text-ink-faint">
				{b.value}{unit ? ` ${unit}` : ''}
			</span>
		</div>
	{/each}
</div>
