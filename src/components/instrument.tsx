// The instrument kit — Direction B's whole vocabulary, in one file.
//
// THE PROBLEM THIS SOLVES
// ----------------------
// The direction bans cards, so something else has to answer "which of these
// things belong together?" on a 360px screen. The answer here is three devices,
// used consistently and never mixed:
//
//   1. `Band`   — a labelled panel legend: small-caps mono label, a structural
//                 rule running from it to the right edge, and an optional
//                 right-hand reading. This is the *only* thing that opens a
//                 group. It is what a legend silk-screened onto an instrument's
//                 front panel does, and it costs one line instead of a card's
//                 border + padding + radius + fill.
//   2. `Row`    — a full-bleed line with a hairline under it. Rows inside one
//                 band read as one block because the hairlines are evenly
//                 spaced and the band's rule caps them.
//   3. A ground shift — `panel` for a readout well, `panel-2` for an input
//                 well. Used sparingly: with rules doing the grouping, a fill is
//                 emphasis, and three fills in a row is just cards again.
//
// Everything is square. Everything numeric is mono. Colour appears only as
// signal — a 3px channel bar, a filled meter segment, a single glyph.
import type * as React from 'react';
import { tv } from 'tailwind-variants';
import { cn } from '$lib/utils';

// ─────────────────────────────────────────────────────────────── band + rows

interface BandProps {
	/** Panel legend. Rendered small-caps; keep it to one or two words — pt-BR
	 *  runs ~30% longer and this is the least forgiving place for it. */
	label: string;
	/** Right-hand reading on the legend line. Mono, dim, never wraps. */
	reading?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}

/** A group. The legend line is the group's only border. */
export function Band({ label, reading, children, className }: BandProps) {
	return (
		<section className={cn('mt-7 first:mt-4', className)}>
			<div className="flex items-center gap-3 px-4 pb-2.5">
				<h2 className="inst-label shrink-0 text-ink">{label}</h2>
				<span aria-hidden className="h-px min-w-3 flex-1 bg-line-2" />
				{reading ? (
					<span className="inst-label-xs shrink-0 whitespace-nowrap">{reading}</span>
				) : null}
			</div>
			{children}
		</section>
	);
}

/** A nested group inside a band — same idea, one step quieter. */
export function SubBand({ label, reading, children, className }: BandProps) {
	return (
		<div className={cn('mt-4', className)}>
			<div className="flex items-center gap-3 px-4 pb-2">
				<h3 className="inst-label-xs shrink-0">{label}</h3>
				<span aria-hidden className="h-px min-w-3 flex-1 bg-line" />
				{reading ? (
					<span className="inst-label-xs shrink-0 whitespace-nowrap">{reading}</span>
				) : null}
			</div>
			{children}
		</div>
	);
}

const row = tv({
	base: 'flex w-full items-center gap-3 border-b border-line px-4 text-left transition-colors duration-150',
	variants: {
		tone: {
			plain: '',
			/* Held work: present, legible, and visibly not on today's list. A dashed
			   under-rule rather than a lower opacity — dimming a whole row at 10px
			   mono is where precision starts costing legibility. */
			held: 'border-dashed text-ink-faint',
			done: 'text-ink-faint',
		},
		size: { sm: 'min-h-10 py-2', md: 'min-h-12 py-2.5', lg: 'min-h-14 py-3' },
		interactive: { true: 'active:bg-panel-2 hover:bg-panel', false: '' },
	},
	defaultVariants: { tone: 'plain', size: 'md', interactive: false },
});

type RowTone = 'plain' | 'held' | 'done';

export function Row({
	tone,
	size,
	className,
	children,
	channel,
}: {
	tone?: RowTone;
	size?: 'sm' | 'md' | 'lg';
	className?: string;
	children: React.ReactNode;
	/** A CSS custom-property name (`--violet`) painting the 3px channel bar at the
	 *  row's left edge. This is how exercise family survives a palette that
	 *  refuses to colour text. */
	channel?: string;
}) {
	return (
		<div className={cn(row({ tone, size }), channel && 'relative', className)}>
			{channel ? (
				<span
					aria-hidden
					className="absolute top-0 bottom-0 left-0 w-[3px]"
					style={{ background: `var(${channel})` }}
				/>
			) : null}
			{children}
		</div>
	);
}

/** The tappable version. Same line, same rule — a row does not become a button
 *  by growing a border. */
export function RowButton({
	tone,
	size,
	className,
	children,
	onClick,
	channel,
	...rest
}: {
	tone?: RowTone;
	size?: 'sm' | 'md' | 'lg';
	className?: string;
	children: React.ReactNode;
	onClick?: () => void;
	channel?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className' | 'children'>) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(row({ tone, size, interactive: true }), channel && 'relative', className)}
			{...rest}
		>
			{channel ? (
				<span
					aria-hidden
					className="absolute top-0 bottom-0 left-0 w-[3px]"
					style={{ background: `var(${channel})` }}
				/>
			) : null}
			{children}
		</button>
	);
}

// ────────────────────────────────────────────────────────────────── readings

/** A primary reading: the big mono number, its unit, and a caption under it.
 *  Sized for arm's length — this is the thing the athlete reads without picking
 *  the phone up. */
export function Readout({
	value,
	unit,
	caption,
	color,
	size = 'lg',
}: {
	value: React.ReactNode;
	unit?: string;
	caption?: string;
	color?: string;
	size?: 'lg' | 'md' | 'sm';
}) {
	const scale =
		size === 'lg'
			? 'text-[46px] leading-[0.85]'
			: size === 'md'
				? 'text-[26px] leading-[0.9]'
				: 'text-[19px] leading-none';
	return (
		<div className="min-w-0">
			<div className="flex items-baseline gap-1">
				<span
					className={cn('font-mono font-bold tracking-[-0.03em] text-ink', scale)}
					style={color ? { color } : undefined}
				>
					{value}
				</span>
				{unit ? <span className="inst-label-xs">{unit}</span> : null}
			</div>
			{caption ? <div className="inst-label-xs mt-1.5 break-words">{caption}</div> : null}
		</div>
	);
}

/** A 0–10 bargraph, drawn as ten discrete cells. A segmented bar is what a
 *  bench meter does, and — unlike a smooth fill — it can still be *read* as a
 *  number from across a room. */
export function Meter({ value, max = 10 }: { value: number; max?: number }) {
	const color = value >= 7 ? 'var(--teal)' : value >= 4 ? 'var(--gold)' : 'var(--flag)';
	return (
		<span aria-hidden className="flex h-2.5 min-w-0 flex-1 gap-[2px]">
			{Array.from({ length: max }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: the cells *are* the index — cell 3 is always the third segment.
					key={i}
					className="flex-1 border border-line"
					style={i < value ? { background: color, borderColor: color } : undefined}
				/>
			))}
		</span>
	);
}

const tag = tv({
	base: 'inline-flex items-center border px-1.5 py-[3px] font-mono text-[10px] leading-none tracking-[0.08em] uppercase whitespace-nowrap',
	variants: {
		tone: {
			quiet: 'border-line text-ink-faint',
			ink: 'border-line-2 text-ink-dim',
			flag: 'border-flag/60 text-flag',
			teal: 'border-teal/60 text-teal',
			gold: 'border-gold/60 text-gold',
		},
	},
	defaultVariants: { tone: 'quiet' },
});

/** A square hairline chip. Not a pill — a pill is the consumer-app tell this
 *  direction is furthest from. */
export function Tag({
	children,
	tone,
	className,
}: {
	children: React.ReactNode;
	tone?: 'quiet' | 'ink' | 'flag' | 'teal' | 'gold';
	className?: string;
}) {
	return <span className={cn(tag({ tone }), className)}>{children}</span>;
}

/** Key/value pair for a spec sheet: mono label above, mono value below. */
export function Spec({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="min-w-0">
			<div className="inst-label-xs truncate">{label}</div>
			<div className="mt-0.5 font-mono text-[13px] whitespace-nowrap text-chalk">{value}</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────── controls

/** The tick. A 24px square with a hairline; engaged, it fills solid. No switch,
 *  no animation on the fill — the athlete is looking at it with chalky hands
 *  mid-set and needs a binary, not a transition. */
export function Tick({
	checked,
	onChange,
	label,
}: {
	checked: boolean;
	onChange: (next: boolean) => void;
	label: string;
}) {
	return (
		<input
			type="checkbox"
			aria-label={label}
			checked={checked}
			onChange={(e) => onChange(e.currentTarget.checked)}
			className={cn(
				'size-6 shrink-0 appearance-none border bg-transparent transition-colors duration-100',
				// A filled square, not a tick glyph: it is the same mark whether you
				// are 20cm away confirming a set or 2m away checking the whole list.
				checked
					? 'border-teal bg-teal shadow-[inset_0_0_0_3px_var(--bg)]'
					: 'border-line-2 active:bg-panel-2',
			)}
		/>
	);
}

const field = tv({
	base: 'w-full border-b bg-transparent px-0 py-1.5 font-mono text-[16px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-flag',
	variants: {
		align: { center: 'text-center', left: 'text-left' },
		state: { idle: 'border-line-2', empty: 'border-line text-ink-faint' },
	},
	defaultVariants: { align: 'center', state: 'idle' },
});

/**
 * A numeric field drawn as a ruled blank on a lab sheet: no box, no fill, just
 * the value sitting on a baseline rule.
 *
 * The 16px size is not cosmetic — anything smaller makes iOS zoom the viewport
 * on focus, and it is also the smallest size a number stays readable at while
 * the athlete is hanging off something. It is what makes seven columns fit
 * across 360px: dropping the box recovers ~14px per column.
 */
export function NumField({
	value,
	onChange,
	label,
	align = 'center',
	placeholder,
}: {
	value: number | null;
	onChange: (next: number | null) => void;
	label: string;
	align?: 'center' | 'left';
	placeholder?: string;
}) {
	return (
		<input
			type="number"
			inputMode="decimal"
			step="any"
			aria-label={label}
			placeholder={placeholder ?? '—'}
			value={value ?? ''}
			onChange={(e) => {
				const n = Number.parseFloat(e.currentTarget.value);
				onChange(e.currentTarget.value === '' || Number.isNaN(n) ? null : n);
			}}
			className={field({ align, state: value == null ? 'empty' : 'idle' })}
		/>
	);
}

export function TextField({
	value,
	onChange,
	label,
	placeholder,
}: {
	value: string;
	onChange: (next: string) => void;
	label: string;
	placeholder?: string;
}) {
	return (
		<input
			type="text"
			aria-label={label}
			placeholder={placeholder}
			value={value}
			onChange={(e) => onChange(e.currentTarget.value)}
			className={cn(field({ align: 'left' }), 'font-sans')}
		/>
	);
}

const choice = tv({
	base: 'relative flex w-full items-center gap-3 border-b border-line py-2.5 pr-4 pl-4 text-left text-[14px] transition-colors duration-150',
	variants: {
		selected: {
			true: 'bg-panel font-medium text-ink',
			false: 'text-ink-dim active:bg-panel-2',
		},
	},
	defaultVariants: { selected: false },
});

/**
 * One answer of the readiness check, as a full-width ruled line.
 *
 * This replaces the old flex-wrap grid of chips, and it is the single biggest
 * pt-BR win in the direction: an option is never competing for horizontal space,
 * so "Mal consegui dormir" takes the same one line "Barely slept" does. A chip
 * grid reflows into a ragged two-and-a-half rows under Portuguese; a ruled list
 * cannot.
 */
export function Choice({
	label,
	selected,
	onSelect,
}: {
	label: string;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={choice({ selected })}
			aria-pressed={selected}
		>
			<span
				aria-hidden
				className={cn(
					'size-2.5 shrink-0 border',
					selected ? 'border-flag bg-flag' : 'border-line-2',
				)}
			/>
			<span className="min-w-0 flex-1">{label}</span>
		</button>
	);
}

// ────────────────────────────────────────────────────────────────────── prose

/**
 * Training copy carries inline `<b>` emphasis. Rendered as tokens rather than
 * through `dangerouslySetInnerHTML` — the copy is trusted and static, but a
 * component that can inject HTML is a component someone later points at athlete
 * input.
 *
 * The SvelteKit `Prose` also turned glossary terms into tap-to-define popovers.
 * Deferred here, deliberately: it is a *content* affordance, identical in all
 * four directions, and it would have been the one rounded floating surface in a
 * design whose whole argument is that nothing floats. Written up on #48.
 */
export function Prose({ value, className }: { value: string; className?: string }) {
	const parts = value.split(/<b>(.*?)<\/b>/g);
	return (
		<span className={className}>
			{parts.map((part, i) =>
				i % 2 === 1 ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: positional tokens of one immutable string
					<b key={i} className="font-semibold text-chalk">
						{part}
					</b>
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: positional tokens of one immutable string
					<span key={i}>{part}</span>
				),
			)}
		</span>
	);
}

/** Body copy. Sans, not mono: an instrument sets its *labels* in mono and its
 *  prose in something you can actually read a paragraph of. */
export function Note({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<p className={cn('px-4 text-[13.5px] leading-[1.55] text-ink-dim', className)}>{children}</p>
	);
}
