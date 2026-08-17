// A trend, drawn as a line and nothing else.
//
// The dark app drew this as a chart with a filled area, gridlines and a hover
// readout. On paper, at this size, all three are noise: the athlete is being
// asked one question — is this going up or down — and the answer is the slope.
// The endpoints are labelled because a line with no numbers is decoration.
interface SparklineProps {
	points: { value: number; label: string }[];
	/** CSS colour, usually a `var(--…)` handed over by the content. */
	color: string;
	/** Accessible summary — the line itself is `aria-hidden`. */
	title: string;
	/** How to render a value in the endpoint labels. */
	format?: (v: number) => string;
}

const W = 320;
const H = 64;

export function Sparkline({ points, color, title, format = (v) => String(v) }: SparklineProps) {
	if (points.length < 2) return null;

	const values = points.map((p) => p.value);
	const min = Math.min(...values);
	const max = Math.max(...values);
	// A flat series would divide by zero and, worse, would draw at the very top of
	// the box; a synthetic span puts it through the middle instead.
	const span = max - min || 1;
	const x = (i: number) => (i / (points.length - 1)) * W;
	const y = (v: number) => H - ((v - min) / span) * (H - 8) - 4;

	const d = points.map(
		(p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
	);
	const first = points[0];
	const last = points[points.length - 1];

	return (
		<figure className="m-0">
			<svg
				viewBox={`0 0 ${W} ${H}`}
				preserveAspectRatio="none"
				className="block h-16 w-full"
				role="img"
				aria-label={title}
			>
				<path
					d={d.join(' ')}
					fill="none"
					stroke={color}
					strokeWidth="1.5"
					vectorEffect="non-scaling-stroke"
				/>
				<circle cx={x(points.length - 1)} cy={y(last.value)} r="3" fill={color} />
			</svg>
			<figcaption className="mt-2 flex items-baseline justify-between text-[12px] text-ink-faint">
				<span>
					{first.label} · {format(first.value)}
				</span>
				<span className="text-ink">
					{last.label} · {format(last.value)}
				</span>
			</figcaption>
		</figure>
	);
}
