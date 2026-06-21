<script lang="ts">
import type { MetricEntry } from './state.svelte';

interface Props {
	data: MetricEntry[];
	catVar: string;
}

let { data, catVar }: Props = $props();

interface Point {
	x: number;
	y: number;
}

const points = $derived.by<Point[]>(() => {
	if (!data.length) return [];
	const vals = data.map((d) => d.v);
	const mn = Math.min(...vals);
	const mx = Math.max(...vals);
	const rng = mx - mn || 1;
	return data.map((d, i) => {
		const x = data.length === 1 ? 100 : (i / (data.length - 1)) * 200;
		const y = 38 - ((d.v - mn) / rng) * 32 - 3;
		return { x, y };
	});
});

const path = $derived(
	points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
);
</script>

<svg class="mt-3.5 h-[42px] w-full" viewBox="0 0 200 42" preserveAspectRatio="none">
	{#if !data.length}
		<line x1="0" y1="38" x2="200" y2="38" stroke="var(--line)" stroke-dasharray="3 4" />
	{:else}
		<path
			d={path}
			fill="none"
			stroke="var({catVar})"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		{#each points as p, i (i)}
			<circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.4" fill="var({catVar})" />
		{/each}
	{/if}
</svg>
