// Direction A's primitive layer: the handful of shapes every screen reuses.
//
// The whole direction rests on repetition — one card, one eyebrow, one chip,
// one input, one row rhythm — because that is what lets a screen carry this
// much and still read as calm. Anything that looks bespoke on a screen is a
// deliberate exception, not a second system.
//
// Variants are `tailwind-variants` (#46). Animation lives in the variant where
// there is any; there is deliberately very little.
import { tv } from 'tailwind-variants';
import { cn } from '$lib/utils';

/** The one surface. `flush` drops the padding for cards that own their own
 *  internal rules; `inset` is the recessed step used for inputs and targets. */
export const card = tv({
	base: 'rounded-lg border border-line bg-panel',
	variants: {
		pad: { none: '', sm: 'p-3', md: 'p-3.5' },
		tone: {
			plain: '',
			inset: 'border-line-soft bg-panel-2',
			ok: 'border-teal/35 bg-teal/[0.06]',
			warn: 'border-gold/35 bg-gold/[0.06]',
			stop: 'border-flag/40 bg-flag/[0.07]',
		},
	},
	defaultVariants: { pad: 'md', tone: 'plain' },
});

/** Small state token. Colour here always reports state, never decoration. */
export const chip = tv({
	base: 'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] leading-[1.4] tracking-wide whitespace-nowrap',
	variants: {
		tone: {
			neutral: 'border-line text-ink-dim',
			ok: 'border-teal/40 text-teal',
			warn: 'border-gold/40 text-gold',
			stop: 'border-flag/45 text-flag',
			ghost: 'border-transparent bg-panel-2 text-ink-faint',
		},
	},
	defaultVariants: { tone: 'neutral' },
});

/** Every text/number input on every screen.
 *
 *  `text-base` is not a style choice: a computed font-size under 16px makes iOS
 *  zoom the viewport on focus (#54). iOS is best-effort here, but the rule also
 *  sets the floor for how narrow a set-row column can get, which is the single
 *  tightest constraint on the Train screen — so it is honoured everywhere. */
export const input = tv({
	base: 'w-full min-w-0 rounded-md border border-line bg-panel-2 px-2 py-1.5 text-base text-ink tabular-nums outline-none transition-colors focus:border-ink-faint',
	variants: {
		align: { left: 'text-left', center: 'text-center' },
	},
	defaultVariants: { align: 'center' },
});

/** Buttons. `quiet` is the default — a dense screen with loud buttons is not
 *  calm — and `primary` is rationed to one per screen. */
export const button = tv({
	// `min-h` rather than `h`, and no `whitespace-nowrap`. Both are pt-BR
	// decisions: "Como esperado", "Mudar para protocolo de reabilitação" and
	// "Concluir e registrar treino" are 1.4–2× their English labels, and a fixed
	// height with nowrap turns every one of them into horizontal overflow. Labels
	// wrap and the button grows.
	// A disabled button drops its fill and its border rather than fading out.
	// `opacity-40` put "Repeat last session" at 2.46:1 and a disabled primary at
	// 3.75:1. WCAG exempts inactive controls, so neither was a violation — but at
	// 2.46:1 a control reads as *broken* rather than as unavailable, which is a
	// worse outcome than the rule was protecting against. Losing the fill says
	// "not now" just as clearly and keeps the label readable at 7.14:1.
	base: 'inline-flex items-center justify-center gap-1.5 rounded-md border text-center text-[13px] leading-tight font-medium transition-colors select-none disabled:border-line-soft disabled:bg-transparent disabled:text-ink-faint',
	variants: {
		kind: {
			primary: 'border-flag bg-flag text-white active:bg-flag-deep',
			quiet: 'border-line bg-panel-2 text-ink-dim active:bg-panel-3 active:text-ink',
			bare: 'border-transparent bg-transparent text-ink-faint active:text-ink',
		},
		size: {
			sm: 'min-h-8 px-2 py-1',
			md: 'min-h-9 px-3 py-1.5',
			lg: 'min-h-11 px-4 py-2 text-[15px]',
		},
	},
	defaultVariants: { kind: 'quiet', size: 'sm' },
});

/** An option in the readiness check / deep check / rehab picker. Selected state
 *  is carried by weight and a border, not by a fill — a screen of filled pills
 *  stops being restful. */
export const option = tv({
	base: 'min-h-9 flex-1 rounded-md border px-2 py-1.5 text-left text-[13px] leading-tight transition-colors',
	variants: {
		on: {
			true: 'border-chalk/60 bg-panel-3 font-semibold text-chalk',
			false: 'border-line bg-panel-2 text-ink-dim',
		},
	},
	defaultVariants: { on: false },
});

/** Section eyebrow. The repeated device that carries the hierarchy. */
export function Eyebrow({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return <div className={cn('eyebrow', className)}>{children}</div>;
}

/** A screen section: heading, optional right-hand meta, body.
 *
 *  The heading is `h-section`, a rank above the eyebrows inside it. The gap
 *  under it is deliberately larger than the gaps within the body: the athlete
 *  asked for the hierarchy to be carried by *space* as well as by type, and a
 *  heading sitting 6px off its content reads as a caption, not as a heading. */
export function Section({
	label,
	meta,
	children,
	className,
}: {
	label: React.ReactNode;
	meta?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section className={cn('flex flex-col gap-2.5', className)}>
			<header className="flex items-baseline justify-between gap-2">
				<h2 className="h-section min-w-0">{label}</h2>
				{meta ? <div className="eyebrow shrink-0 normal-case">{meta}</div> : null}
			</header>
			{children}
		</section>
	);
}

/** A group with no box around it — a rule above, and space.
 *
 *  Half the sections on Today were a bordered card holding a handful of rows,
 *  which is what made the screen read as boxes-inside-boxes ("tirar as coisas
 *  de caixa, dar mais espaçamento"). A card now has to earn itself: it carries
 *  state colour, or it holds a list whose rows need a shared edge. Everything
 *  else groups by a hairline and whitespace, which costs nothing and reads
 *  quieter at this density. */
export function Bare({ children, className }: { children: React.ReactNode; className?: string }) {
	return <div className={cn('border-t border-line-soft pt-3', className)}>{children}</div>;
}

/** Training prose carries inline `<b>` emphasis. Parsed rather than injected —
 *  the content is trusted, but `dangerouslySetInnerHTML` on localized strings is
 *  how an XSS lands the first time someone makes the library user-editable. */
export function Prose({ value, className }: { value: string; className?: string }) {
	const parts = value.split(/(<b>.*?<\/b>)/g).filter(Boolean);
	return (
		<span className={className}>
			{parts.map((part, i) =>
				part.startsWith('<b>') ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: split output has no stable id
					<b key={i} className="font-semibold text-chalk">
						{part.slice(3, -4)}
					</b>
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: split output has no stable id
					<span key={i}>{part}</span>
				),
			)}
		</span>
	);
}

/** A 0–10 wellness reading. Two glyphs of information — the number and how far
 *  along the track it sits — in one 20px row, because five of these have to fit
 *  under the verdict without becoming a chart. */
export function Meter({ label, value }: { label: string; value: number }) {
	const tone = value >= 7 ? 'var(--ok)' : value >= 4 ? 'var(--warn)' : 'var(--stop)';
	return (
		<div className="flex items-center gap-2">
			<span className="w-[76px] shrink-0 truncate text-[11px] text-ink-dim">{label}</span>
			<span className="h-[3px] flex-1 overflow-hidden rounded-full bg-panel-3">
				<span
					className="block h-full rounded-full"
					style={{ width: `${value * 10}%`, background: tone }}
				/>
			</span>
			<span className="num w-[26px] shrink-0 text-right text-[11px]" style={{ color: tone }}>
				{value}
			</span>
		</div>
	);
}

/** One reading in the three-up stat strip. Divider-separated rather than three
 *  cards: three bordered boxes for three integers is the densest-looking and
 *  least dense arrangement there is. */
export function Stat({
	value,
	suffix,
	label,
	accent,
}: {
	value: number | string;
	suffix?: string;
	label: string;
	accent?: boolean;
}) {
	return (
		<div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1">
			<span
				className={cn(
					'num text-[22px] leading-none font-bold',
					accent ? 'text-flag' : 'text-chalk',
				)}
			>
				{value}
				{suffix ? <span className="text-[13px] text-ink-faint">{suffix}</span> : null}
			</span>
			<span className="eyebrow w-full text-center">{label}</span>
		</div>
	);
}
