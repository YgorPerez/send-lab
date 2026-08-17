// The readiness trend — and, honestly, the only chart this app has left.
//
// MacroFactor is chart-heavy because it *has* series: weight, energy
// expenditure, macros, all daily and all long. This app dropped `metrics` and
// `stats` in the rebuild (#12), which took every progression graph with them.
// What survives is fourteen readiness scores and a seven-point bodyweight
// series — so this direction ships one small chart and no chart furniture. No
// axes, no gridlines, no legend, no tooltip: at fourteen points on a 360px
// screen those are decoration pretending to be analysis.
//
// What it does show is the one comparison that changes a decision: today's
// score against the athlete's own rolling baseline.
import { useId } from 'react';

interface Props {
	points: { value: number; label: string }[];
	/** The athlete's rolling mean, drawn as the reference rule. */
	baseline?: number | null;
	/** Today's reading, marked at the right-hand edge. */
	current?: number;
	color?: string;
	height?: number;
}

export function Sparkline({
	points,
	baseline,
	current,
	color = 'var(--teal)',
	height = 44,
}: Props) {
	const id = useId();
	if (points.length < 2) return null;

	const values = points.map((p) => p.value);
	const all = current == null ? values : [...values, current];
	const lo = Math.min(...all, baseline ?? Number.POSITIVE_INFINITY);
	const hi = Math.max(...all, baseline ?? Number.NEGATIVE_INFINITY);
	// A flat series would divide by zero and, worse, render as a line pinned to
	// the top of the box — which reads as "at maximum" rather than "unchanged".
	const span = hi - lo || 1;
	const pad = 3;
	const W = 100;
	const H = height;
	const y = (v: number) => pad + (1 - (v - lo) / span) * (H - pad * 2);
	const x = (i: number) => (i / (values.length - 1)) * W;

	const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`);
	const area = `${line.join(' ')} L${W},${H} L0,${H} Z`;

	return (
		<div className="flex items-stretch gap-2">
			<div className="num flex w-[22px] shrink-0 flex-col justify-between py-px text-right text-[9px] text-ink-faint">
				<span>{Math.round(hi)}</span>
				<span>{Math.round(lo)}</span>
			</div>
			<svg
				className="min-w-0 flex-1"
				viewBox={`0 0 ${W} ${H}`}
				preserveAspectRatio="none"
				height={H}
				role="img"
				aria-label={points.map((p) => `${p.label} ${p.value}`).join(', ')}
			>
				<defs>
					<linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={color} stopOpacity="0.22" />
						<stop offset="100%" stopColor={color} stopOpacity="0" />
					</linearGradient>
				</defs>
				{baseline != null ? (
					<line
						x1="0"
						x2={W}
						y1={y(baseline)}
						y2={y(baseline)}
						stroke="var(--ink-faint)"
						strokeWidth="1"
						strokeDasharray="2 3"
						vectorEffect="non-scaling-stroke"
					/>
				) : null}
				<path d={area} fill={`url(#g${id})`} />
				<path
					d={line.join(' ')}
					fill="none"
					stroke={color}
					strokeWidth="1.5"
					strokeLinejoin="round"
					strokeLinecap="round"
					vectorEffect="non-scaling-stroke"
				/>
				{current != null ? (
					<circle
						cx={W}
						cy={y(current)}
						r="2.5"
						fill="var(--chalk)"
						vectorEffect="non-scaling-stroke"
					/>
				) : null}
			</svg>
		</div>
	);
}
