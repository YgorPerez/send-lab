// The one chart this app has left.
//
// MacroFactor is chart-heavy because it *has* series: weight, energy
// expenditure, macros, all daily and all long. This app dropped markers and the
// derived stat pages in the rebuild (#12, `CONTEXT.md` marks Marker
// `_Leaving_`), which took every progression graph with them. What survives is
// fourteen readiness scores and a seven-point bodyweight series — so there is
// one small chart and no chart furniture. No axes, no gridlines, no legend, no
// tooltip: at fourteen points on a 360px screen those are decoration pretending
// to be analysis.
//
// What it does show is the one comparison that changes a decision: the latest
// reading against the athlete's own rolling baseline.
import { useId } from 'react';
import { decimal } from '$lib/format';
import type { AppLocale } from '$lib/store/locale';

interface Props {
	points: { value: number; label: string }[];
	/** The rolling mean, drawn as the reference rule. */
	baseline?: number | null;
	/** The current reading, marked at the right-hand edge. */
	current?: number;
	color?: string;
	height?: number;
	/** For the decimal mark: the axis and the spoken series read `72,4` in pt-BR. */
	locale: AppLocale;
}

export function Sparkline({
	points,
	baseline,
	current,
	color = 'var(--teal)',
	height = 44,
	locale,
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
	// Whole numbers, unless they would read the same: a bodyweight series from
	// 71.6 to 72.4 was labelled "72" at the top and "72" at the bottom (#125).
	const digits = Math.round(hi) === Math.round(lo) ? 1 : 0;

	return (
		<div className="flex items-stretch gap-2">
			<div
				data-axis=""
				className="num flex w-[22px] shrink-0 flex-col justify-between py-px text-right text-[9px] text-ink-faint"
			>
				<span>{decimal(hi, locale, digits)}</span>
				<span>{decimal(lo, locale, digits)}</span>
			</div>
			{/* The drawing stretches to the width (`preserveAspectRatio="none"`), so
			    the current reading is not drawn in it: an SVG circle came out an
			    ellipse, and centred on the right edge it was cut in half (#125). It
			    is a round mark over the drawing's end instead, and the drawing lets
			    its stroke run past its box rather than clipping its ends. */}
			<div className="relative min-w-0 flex-1 pr-1">
				<svg
					className="block w-full overflow-visible"
					viewBox={`0 0 ${W} ${H}`}
					preserveAspectRatio="none"
					height={H}
					role="img"
					// The chart is the only place these numbers appear in order, so the
					// series is the accessible name rather than a summary of it.
					aria-label={points.map((p) => `${p.label} ${decimal(p.value, locale)}`).join(', ')}
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
						// `preserveAspectRatio="none"` stretches the viewBox horizontally, so
						// without this the stroke is stretched with it and the line reads
						// thicker on a wide screen than on a narrow one.
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
				{current != null ? (
					<span
						data-current=""
						aria-hidden="true"
						className="absolute right-0 size-[7px] -translate-y-1/2 rounded-full bg-chalk"
						style={{ top: `${((y(current) / H) * 100).toFixed(2)}%` }}
					/>
				) : null}
			</div>
		</div>
	);
}
