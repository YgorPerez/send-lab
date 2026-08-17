// The readiness trend, drawn as a chart-recorder trace.
//
// Fourteen samples is too few to be a "chart" and too many to be a list, so it
// is drawn the way a bench recorder draws one: a fixed 0–100 frame with ruled
// gridlines, a dashed datum at the athlete's own rolling baseline, square sample
// markers on the trace, and the newest sample called out. The frame is fixed
// rather than fitted to the data on purpose — an auto-scaled y-axis makes a flat
// fortnight look like a crisis, which is exactly the misreading this screen must
// not cause.
import * as m from '$lib/paraglide/messages';
import type { TrendPoint } from '../prototype-fixtures';

const H = 76;
const W = 320;
const PAD_T = 8;
const PAD_B = 8;

export function Trace({
	points,
	baseline,
	color,
}: {
	points: TrendPoint[];
	/** The athlete's own rolling mean — the datum the trace is read against. */
	baseline: number | null;
	/** Verdict colour for the newest sample. */
	color: string;
}) {
	if (points.length < 2) return null;

	const y = (v: number) => PAD_T + (1 - v / 100) * (H - PAD_T - PAD_B);
	const x = (i: number) => (i / (points.length - 1)) * W;

	const path = points
		.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
		.join(' ');
	const last = points[points.length - 1];
	const values = points.map((p) => p.value);

	return (
		<div className="px-4">
			{/* The frame is labelled rather than fitted. Empty space above and below a
			    flat fortnight is *information* once 0 and 100 are printed against it;
			    without the scale it just reads as a chart that failed to fill. */}
			<div className="flex items-stretch gap-2">
				<svg
					viewBox={`0 0 ${W} ${H}`}
					preserveAspectRatio="none"
					className="h-[76px] min-w-0 flex-1"
					role="img"
					aria-label={`${m.readiness_trend()} — ${values.join(', ')}`}
				>
					<title>{m.readiness_trend()}</title>
					{[25, 50, 75].map((g) => (
						<line
							key={g}
							x1={0}
							x2={W}
							y1={y(g)}
							y2={y(g)}
							stroke="var(--line)"
							strokeWidth={1}
							vectorEffect="non-scaling-stroke"
						/>
					))}
					{baseline != null ? (
						<line
							x1={0}
							x2={W}
							y1={y(baseline)}
							y2={y(baseline)}
							stroke="var(--teal)"
							strokeWidth={1}
							strokeDasharray="3 4"
							vectorEffect="non-scaling-stroke"
						/>
					) : null}
					<path
						d={path}
						fill="none"
						stroke="var(--chalk)"
						strokeWidth={1.5}
						vectorEffect="non-scaling-stroke"
					/>
					{points.map((p, i) => (
						<rect
							key={p.label}
							x={x(i) - 1.5}
							y={y(p.value) - 1.5}
							width={3}
							height={3}
							fill={i === points.length - 1 ? color : 'var(--ink-faint)'}
							vectorEffect="non-scaling-stroke"
						/>
					))}
				</svg>
				<div className="flex w-6 shrink-0 flex-col justify-between py-[6px] text-right">
					<span className="inst-label-xs">100</span>
					<span className="inst-label-xs">50</span>
					<span className="inst-label-xs">0</span>
				</div>
			</div>
			<div className="mt-1 flex items-baseline justify-between gap-2">
				<span className="inst-label-xs">{points[0].label}</span>
				{baseline != null ? (
					<span className="font-mono text-[10px] tracking-[0.08em] text-teal">⌀ {baseline}</span>
				) : null}
				<span className="font-mono text-[10px] tracking-[0.08em]" style={{ color }}>
					{last.label} · {last.value}
				</span>
			</div>
		</div>
	);
}
