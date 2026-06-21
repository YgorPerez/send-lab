<script lang="ts">
import type { Point } from '$lib/stats';

interface Props {
	points: Point[];
	color?: string;
	/** Highlight the maximum point as a PR. */
	pr?: boolean;
}

let { points, color = 'var(--flag)', pr = false }: Props = $props();

const W = 320;
const H = 140;
const L = 34; // left padding for y labels
const R = 8;
const T = 14;
const B = 116;

const view = $derived.by(() => {
	const vals = points.map((p) => p.value);
	const mn = Math.min(...vals);
	const mx = Math.max(...vals);
	const rng = mx - mn || 1;
	const n = points.length;
	const px = (i: number) => (n === 1 ? (L + (W - R)) / 2 : L + (i / (n - 1)) * (W - R - L));
	const py = (v: number) => B - ((v - mn) / rng) * (B - T);
	const coords = points.map((p, i) => ({ x: px(i), y: py(p.value), value: p.value }));
	const maxI = vals.indexOf(mx);
	return { coords, mn, mx, maxI };
});

const path = $derived(
	view.coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' '),
);
const round = (n: number) => Math.round(n * 10) / 10;
</script>

<svg class="h-auto w-full" viewBox="0 0 {W} {H}" role="img" aria-label="trend">
	<!-- y guides -->
	<line x1={L} y1={T} x2={W - R} y2={T} stroke="var(--line)" stroke-dasharray="2 4" />
	<line x1={L} y1={B} x2={W - R} y2={B} stroke="var(--line)" />
	<text x="2" y={T + 4} font-size="9" fill="var(--ink-faint)" font-family="monospace">
		{round(view.mx)}
	</text>
	<text x="2" y={B} font-size="9" fill="var(--ink-faint)" font-family="monospace">
		{round(view.mn)}
	</text>

	{#if points.length > 1}
		<path
			d={path}
			fill="none"
			stroke={color}
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/if}
	{#each view.coords as c, i (i)}
		{@const isPr = pr && i === view.maxI}
		<circle cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r={isPr ? 5 : 3} fill={color} />
		{#if isPr}
			<circle cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r="8" fill="none" stroke={color} />
		{/if}
	{/each}

	<!-- x labels: first & last -->
	{#if points.length}
		<text x={L} y={H - 4} font-size="9" fill="var(--ink-faint)" font-family="monospace">
			{points[0].label}
		</text>
		{#if points.length > 1}
			<text
				x={W - R}
				y={H - 4}
				font-size="9"
				fill="var(--ink-faint)"
				font-family="monospace"
				text-anchor="end"
			>
				{points[points.length - 1].label}
			</text>
		{/if}
	{/if}
</svg>
