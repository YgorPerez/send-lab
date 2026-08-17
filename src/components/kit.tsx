// Direction B's parts bin.
//
// There are no cards here. Grouping is carried by four things, and every one of
// them is in this file so the ticket can report on which of them actually
// survived a 360px screen:
//
//   1. **Weight of rule.** `border-rule` (2px, light) opens a section;
//      `border-line` (1px, dark) separates rows inside it. Two weights is the
//      whole hierarchy.
//   2. **The index rail.** A 26px left column carrying a two-digit channel
//      number, with a hairline down its right edge running the section's full
//      height. This is what a card's left edge used to do.
//   3. **Graticule fill.** Ruled paper behind a region that is present but not
//      live — held work, spent controls.
//   4. **Spacing, sparingly.** 8px between rows, 0px between sections. Air is
//      what the other three directions have; this one does not get to use it.
//
// Nothing in here is rounded, and nothing in here has a shadow.

import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { cn } from '$lib/utils';

/** The fixture hands out accents in two shapes — `catVar` is a bare custom
 *  property name (`--violet`), `day.color` and `verdict.color` are already
 *  wrapped (`var(--violet)`). One helper so no call site has to know which. */
export function cssVar(name: string): string {
	return name.startsWith('var(') ? name : `var(${name})`;
}

// ------------------------------------------------------------------- section

interface SectionProps {
	/** Two-digit channel index, printed in the rail. Identity, not decoration:
	 *  it is how a section is referred to at a glance on a dense screen. */
	index: string;
	title: string;
	/** Right-aligned reading in the section header — a count, a unit, a state. */
	meta?: ReactNode;
	/** CSS custom-property name (`--violet`) painting the header's left accent.
	 *  The fixture's `catVar` is grouping information, so it survives even though
	 *  the surface is monochrome. */
	accent?: string;
	children: ReactNode;
}

export function Section({ index, title, meta, accent, children }: SectionProps) {
	return (
		<section className="border-rule border-t-2">
			<header className="flex items-center gap-2 py-1.5 pr-3 pl-3">
				{accent ? (
					<span
						aria-hidden="true"
						className="-ml-3 h-3.5 w-[3px] shrink-0"
						style={{ background: cssVar(accent) }}
					/>
				) : null}
				<h2 className="lbl min-w-0 text-ink">{title}</h2>
				{meta != null ? <div className="lbl ml-auto shrink-0 text-ink-faint">{meta}</div> : null}
			</header>
			<div className="grid grid-cols-[26px_minmax(0,1fr)]">
				<div className="border-line border-r pt-[3px] text-center">
					<span className="lbl text-ink-faint">{index}</span>
				</div>
				<div className="min-w-0">{children}</div>
			</div>
		</section>
	);
}

// ----------------------------------------------------------------------- row

const row = tv({
	base: 'min-w-0 border-line border-b px-3 py-2 last:border-b-0',
	variants: {
		tone: {
			live: '',
			/** Present, but the plan is not asking for it today. */
			held: 'graticule text-ink-faint',
			/** A readout block — lifted a shade off the case. */
			readout: 'bg-panel',
		},
		pad: { normal: '', none: 'px-0 py-0', tight: 'px-3 py-1' },
	},
	defaultVariants: { tone: 'live', pad: 'normal' },
});

export function Row({
	children,
	className,
	tone,
	pad,
}: {
	children: ReactNode;
	className?: string;
	tone?: 'live' | 'held' | 'readout';
	pad?: 'normal' | 'none' | 'tight';
}) {
	return <div className={cn(row({ tone, pad }), className)}>{children}</div>;
}

// --------------------------------------------------------------------- label

export function Lbl({ children, className }: { children: ReactNode; className?: string }) {
	return <span className={cn('lbl', className)}>{children}</span>;
}

/** Multi-sentence copy. The one place this direction leaves mono — see the note
 *  on `.prose` in `app.css`. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
	return <p className={cn('prose', className)}>{children}</p>;
}

// ------------------------------------------------------------------ readouts

const readout = tv({
	base: 'num block text-ink leading-none',
	variants: {
		size: {
			hero: 'text-[56px] tracking-[-0.03em]',
			large: 'text-[28px]',
			medium: 'text-[19px]',
			small: 'text-[15px]',
		},
	},
	defaultVariants: { size: 'medium' },
});

export function Readout({
	value,
	unit,
	caption,
	size,
	accent,
	className,
}: {
	value: ReactNode;
	unit?: ReactNode;
	caption?: ReactNode;
	size?: 'hero' | 'large' | 'medium' | 'small';
	accent?: string;
	className?: string;
}) {
	return (
		<div className={cn('min-w-0', className)}>
			<div className="flex items-baseline gap-1">
				<span className={readout({ size })} style={accent ? { color: cssVar(accent) } : undefined}>
					{value}
				</span>
				{unit != null ? <span className="lbl text-ink-faint">{unit}</span> : null}
			</div>
			{caption != null ? <div className="lbl mt-1 text-ink-dim">{caption}</div> : null}
		</div>
	);
}

// --------------------------------------------------------------------- gauge

/** Stable keys for the tick strip. Mapping an index into a `key` is exactly the
 *  bug `noArrayIndexKey` is about, so the cells are named up front. */
const TICKS = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9'];

/** A 0–10 reading as a ten-cell tick strip. Not a progress bar: the cells are
 *  discrete because the underlying answer is (the quiz options are 0/4/7/10),
 *  and a continuous bar would claim a precision the data does not have. */
export function Gauge({ value, accent }: { value: number; accent?: string }) {
	const filled = Math.round(value);
	return (
		<div aria-hidden="true" className="flex h-2.5 gap-px">
			{TICKS.map((k, i) => (
				<span
					key={k}
					className={cn('w-full', i < filled ? '' : 'bg-line')}
					style={i < filled ? { background: cssVar(accent ?? '--ink') } : undefined}
				/>
			))}
		</div>
	);
}

// -------------------------------------------------------------------- spark

/** A stepped trace, drawn as a hairline with a graticule behind it. No fill, no
 *  curve, no dots — a plotter output, not a chart. */
export function Spark({
	points,
	height = 44,
	accent = '--ink',
}: {
	points: number[];
	height?: number;
	accent?: string;
}) {
	if (points.length === 0) return null;
	const lo = Math.min(...points);
	const hi = Math.max(...points);
	const span = hi - lo || 1;
	const w = 100;
	const step = points.length > 1 ? w / (points.length - 1) : w;
	const y = (v: number) => 4 + (1 - (v - lo) / span) * (height - 8);
	const d = points.map(
		(v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${y(v).toFixed(2)}`,
	);
	return (
		<svg
			aria-hidden="true"
			className="ruled block w-full"
			height={height}
			preserveAspectRatio="none"
			viewBox={`0 0 ${w} ${height}`}
		>
			<title>trace</title>
			<path
				d={d.join(' ')}
				fill="none"
				stroke={cssVar(accent)}
				strokeWidth={1}
				vectorEffect="non-scaling-stroke"
			/>
			<circle
				cx={w}
				cy={y(points[points.length - 1])}
				fill={cssVar(accent)}
				r={2}
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

// --------------------------------------------------------------------- tick

const tick = tv({
	base: 'flex h-6 w-6 shrink-0 items-center justify-center border transition-colors duration-150',
	variants: {
		on: {
			true: 'border-ink bg-ink text-bg',
			false: 'border-line text-transparent',
		},
	},
});

/** The one control an athlete uses with chalky hands. A 24px square with a 44px
 *  tap target around it — square because a checkbox with a corner radius is the
 *  consumer tell this direction is trying not to be. */
export function Tick({
	on,
	onToggle,
	label,
}: {
	on: boolean;
	onToggle: () => void;
	label: string;
}) {
	return (
		<button
			aria-label={label}
			aria-pressed={on}
			className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center p-2.5"
			onClick={onToggle}
			type="button"
		>
			<span aria-hidden="true" className={tick({ on })}>
				<svg fill="none" height="12" viewBox="0 0 12 12" width="12">
					<title>done</title>
					<path d="M1.5 6.5 4.5 9.5 10.5 2.5" stroke="currentColor" strokeWidth="2" />
				</svg>
			</span>
		</button>
	);
}

// -------------------------------------------------------------------- chips

/** The verdict's / flag's focus terms. Hairline boxes, not pills. */
export function Chips({ items, accent }: { items: string[]; accent?: string }) {
	if (items.length === 0) return null;
	return (
		<div className="mt-2 flex flex-wrap gap-1">
			{items.map((t) => (
				<span
					className="lbl lbl-tight border px-1.5 py-0.5 text-ink-dim"
					key={t}
					style={{ borderColor: accent ? cssVar(accent) : 'var(--line)' }}
				>
					{t}
				</span>
			))}
		</div>
	);
}

// ------------------------------------------------------------------- button

const bench = tv({
	base: 'lbl lbl-tight inline-flex min-h-[38px] items-center justify-center gap-2 border px-3 text-center transition-colors duration-150 active:bg-panel-2',
	variants: {
		kind: {
			plain: 'border-line text-ink',
			signal: 'border-flag text-flag',
			solid: 'border-ink bg-ink text-bg',
			spent: 'graticule border-line text-ink-faint',
		},
		wide: { true: 'w-full', false: '' },
	},
	defaultVariants: { kind: 'plain', wide: false },
});

export function Bench({
	children,
	kind,
	wide,
	onClick,
	disabled,
	className,
}: {
	children: ReactNode;
	kind?: 'plain' | 'signal' | 'solid' | 'spent';
	wide?: boolean;
	onClick?: () => void;
	disabled?: boolean;
	className?: string;
}) {
	return (
		<button
			className={cn(bench({ kind, wide }), className)}
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			{children}
		</button>
	);
}

// ---------------------------------------------------------------- switch bank

/** A bank of mutually exclusive settings, the way a bench box does it: full
 *  width rows, a square indicator on the left, hairlines between.
 *
 *  Vertical rather than segmented on purpose. The readiness options run to
 *  "Unwell — fever / body aches" in English and "Indisposto — febre / dores no
 *  corpo" in pt-BR; four of those side by side at 310px is three characters per
 *  cell. Vertical costs height, which this direction has, and buys legibility,
 *  which it does not. */
export function Bank({
	options,
	value,
	onSelect,
	name,
}: {
	options: { label: string; value: number }[];
	value: number | null;
	onSelect: (v: number) => void;
	name: string;
}) {
	return (
		<div className="border-line border-t">
			{options.map((o) => {
				const on = value === o.value;
				return (
					<button
						aria-pressed={on}
						className={cn(
							'flex min-h-[38px] w-full items-center gap-2.5 border-line border-b px-3 text-left transition-colors duration-150',
							on ? 'bg-panel-2 text-ink' : 'text-ink-dim',
						)}
						key={`${name}-${o.value}`}
						onClick={() => onSelect(o.value)}
						type="button"
					>
						<span
							aria-hidden="true"
							className={cn(
								'h-2.5 w-2.5 shrink-0 border',
								on ? 'border-flag bg-flag' : 'border-ink-faint',
							)}
						/>
						<span className="min-w-0 text-[13px] leading-tight tracking-normal">{o.label}</span>
					</button>
				);
			})}
		</div>
	);
}

// -------------------------------------------------------------------- swatch

/** Category coding, reduced to a 3px bar. The fixture carries `catVar` and
 *  `color`; this is the whole of what a monochrome surface does with it. */
export function Swatch({ varName }: { varName: string }) {
	return (
		<span
			aria-hidden="true"
			className="inline-block h-3 w-[3px] shrink-0"
			style={{ background: cssVar(varName) }}
		/>
	);
}

// ------------------------------------------------------------------ key/value

/** A labelled reading on one line: label left, value right, dot leaders in
 *  between. The densest way to put a number next to its name, and the reason
 *  this direction can render the whole prescription without a table. */
export function KV({ k, v, accent }: { k: ReactNode; v: ReactNode; accent?: string }) {
	return (
		<div className="flex min-w-0 items-baseline gap-1.5">
			<span className="lbl shrink-0">{k}</span>
			<span aria-hidden="true" className="h-px min-w-2 flex-1 self-center bg-line" />
			<span
				className="num shrink-0 text-[13px] text-ink"
				style={accent ? { color: cssVar(accent) } : undefined}
			>
				{v}
			</span>
		</div>
	);
}
