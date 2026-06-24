<script lang="ts">
// A compact line chart of a metric's history for the detail modal — bigger than
// the card sparkline, with value range + date-range labels and per-point hover
// tooltips. Points come in chronological order in display units.
interface ChartPoint {
	v: number;
	label: string;
}
let { points, catVar, fmt }: { points: ChartPoint[]; catVar: string; fmt: (v: number) => string } =
	$props();

const W = 280;
const H = 96;
const PAD = 8;

const geom = $derived.by(() => {
	if (points.length < 2) return null;
	const vals = points.map((p) => p.v);
	const mn = Math.min(...vals);
	const mx = Math.max(...vals);
	const rng = mx - mn || 1;
	const pts = points.map((p, i) => ({
		x: PAD + (i / (points.length - 1)) * (W - 2 * PAD),
		y: PAD + (1 - (p.v - mn) / rng) * (H - 2 * PAD),
		label: p.label,
		v: p.v,
	}));
	return { mn, mx, pts };
});

const path = $derived(
	geom
		? geom.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
		: '',
);
</script>

{#if geom}
	<div class="flex flex-col gap-1 rounded-md border border-line bg-panel-2 p-2.5">
		<span class="font-mono text-[10px] text-ink-faint">{fmt(geom.mx)}</span>
		<svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label={fmt(geom.pts[geom.pts.length - 1].v)}>
			<path
				d={path}
				fill="none"
				stroke="var({catVar})"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			{#each geom.pts as p, i (i)}
				<circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.6" fill="var({catVar})">
					<title>{p.label}: {fmt(p.v)}</title>
				</circle>
			{/each}
		</svg>
		<div class="flex justify-between font-mono text-[10px] text-ink-faint">
			<span>{fmt(geom.mn)}</span>
			<span>{points[0].label} → {points[points.length - 1].label}</span>
		</div>
	</div>
{/if}
