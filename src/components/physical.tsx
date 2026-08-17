// Direction D's surface language, in one place.
//
// The whole direction rests on one idea: a control looks like it protrudes, and
// pressing it looks like it sank. That is two CSS utilities (`.slab`, `.well`,
// defined in `app.css`) plus the travel — and the travel lives in the variant,
// which is where #46 put animation.
//
// Everything here is sized off one number: **56px**. It is the minimum a chalky
// thumb hits reliably without looking, and it is why this direction cannot show
// as many rows per screen as the other three. Nothing shrinks below it.
import type * as React from 'react';
import { tv } from 'tailwind-variants';

/** The pressable surface. `press` is the physical travel: 2px down, lip off. */
export const slab = tv({
	base: 'slab rounded-lg transition-[transform,box-shadow] duration-75 ease-out',
	variants: {
		press: {
			true: 'active:slab-press',
			false: '',
		},
		tone: {
			plain: 'text-ink',
			hot: 'text-ink [--panel:#7a2409] [--panel-2:#ff4d17]',
			live: 'text-bg [--panel:#00b39e] [--panel-2:#00e0c6]',
		},
	},
	defaultVariants: { press: true, tone: 'plain' },
});

/** A control the athlete puts a finger *into*: tracks, wells, input recesses. */
export const well = tv({
	base: 'well rounded-lg',
});

/** The direction's one button. 60px tall minimum, label centred, real travel. */
export const bigButton = tv({
	base: [
		'slab rounded-lg text-center font-semibold tracking-tight',
		'flex items-center justify-center gap-2',
		'transition-[transform,box-shadow] duration-75 ease-out active:slab-press',
		'disabled:opacity-45 disabled:active:transform-none',
		// pt-BR runs long inside a fixed-height button, so labels wrap rather than
		// clip and the height is a floor, not a fixed value.
		'min-h-[60px] px-4 py-3 text-[16px] leading-tight text-balance',
	],
	variants: {
		tone: {
			plain: 'text-ink',
			hot: 'text-white [--panel:#c2380c] [--panel-2:#ff4d17] [--lip:rgba(255,255,255,0.28)]',
			quiet: 'text-ink-dim',
		},
		wide: { true: 'w-full', false: '' },
	},
	defaultVariants: { tone: 'plain', wide: true },
});

/** Small state chip. Never a tap target — it is a readout. */
export const pill = tv({
	base: 'inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] tracking-wider uppercase',
	variants: {
		tone: {
			line: 'bg-panel-2 text-ink-dim',
			hot: 'bg-flag/18 text-flag',
			gold: 'bg-gold/18 text-gold',
			teal: 'bg-teal/18 text-teal',
			violet: 'bg-violet/18 text-violet',
			chalk: 'bg-chalk/14 text-chalk',
		},
	},
	defaultVariants: { tone: 'line' },
});

/** A card. `accent` paints the 4px bar down its left edge — the colour coding
 *  the fixture carries as `catVar` / `day.color`, kept as *grouping*, not decoration. */
export function Panel({
	accent,
	className = '',
	children,
}: {
	accent?: string;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div className={`${slab({ press: false })} relative overflow-hidden ${className}`}>
			{accent ? (
				<span
					aria-hidden="true"
					className="absolute inset-y-0 left-0 w-[5px]"
					style={{ background: accent }}
				/>
			) : null}
			{children}
		</div>
	);
}

/** Section heading. Mono, wide-tracked, small — the label etched into a machine
 *  panel rather than a headline. */
export function Head({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
	return (
		<div className="mt-7 mb-3 flex items-end justify-between gap-3 px-1">
			<h2 className="min-w-0 font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
				{children}
			</h2>
			{/* pt-BR runs ~30% longer than English and headings are where it lands
			    first. The right slot may wrap; it may not push the row wider. */}
			{right ? (
				<div className="max-w-[45%] shrink-0 text-right text-[12px] leading-tight text-ink-faint">
					{right}
				</div>
			) : null}
		</div>
	);
}

/**
 * Copy from the content library carries inline `<b>` — roughly 37 occurrences
 * across verdicts, flag advice, phase banners and exercise cues — and the
 * rebuild has nothing that renders it. Left alone the athlete reads a literal
 * `<b>` in the middle of the instruction.
 *
 * Tokenised rather than injected. `dangerouslySetInnerHTML` would work today and
 * would be a standing invitation for the next string to come from somewhere less
 * trustworthy; the emphasis is one tag, and one tag is cheap to parse.
 *
 * The emphasis is not decoration: in every one of these strings the bold span is
 * the actual instruction ("**7/3 repeaters**", "**under ~40%**"), which is why
 * this direction renders it heavier and brighter rather than merely bolder.
 */
export function Rich({ html, className = '' }: { html: string; className?: string }) {
	const parts = html.split(/(<b>[\s\S]*?<\/b>)/g).filter((part) => part !== '');
	return (
		<p className={className}>
			{parts.map((part, index) => {
				const bold = /^<b>([\s\S]*?)<\/b>$/.exec(part);
				const key = `${index}:${part.slice(0, 12)}`;
				return bold ? (
					<strong key={key} className="font-bold text-chalk">
						{decode(bold[1])}
					</strong>
				) : (
					<span key={key}>{decode(part)}</span>
				);
			})}
		</p>
	);
}

/** The content library also escapes a handful of entities — `ACWR &gt; 1.5`.
 *  The browser used to decode those for free when this was injected as HTML;
 *  tokenising means doing it here, or the athlete reads the entity. */
function decode(text: string): string {
	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&');
}
