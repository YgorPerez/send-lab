// The domain-blind components: shapes, not screens.
//
// Nothing in this file names a verdict, a set, an exercise or a readiness score.
// That is the test that puts a component here rather than one directory up: a
// primitive takes a label, a value and children, so it can be used anywhere,
// and a component that names the training domain in its props can only be used
// where that domain object already is.
import type { ReactNode } from 'react';
import { cn } from '$lib/utils';

/**
 * The furniture rank of the type scale: a field label, a unit, a meta reading.
 *
 * Three ranks, not one. The first pass had a single 10px eyebrow doing both
 * "this is a section of the screen" and "this labels the field below it", so
 * every heading on Today weighed the same and the screen read as one long list —
 * the athlete's "a hierarquia ficou confusa". The ranks are `.h-screen-title`,
 * `.h-section` and `.eyebrow`, defined in `app.css`, and they differ on size,
 * weight *and* colour at once because at this density any one axis alone is too
 * quiet to register.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn('eyebrow', className)}>{children}</div>;
}

/**
 * A screen section: heading, optional right-hand meta, body.
 *
 * The gap under the heading is deliberately larger than the gaps within the
 * body. The athlete asked for the hierarchy to be carried by *space* as well as
 * by type, and a heading sitting 6px off its content reads as a caption rather
 * than as a heading. Sections themselves sit `gap-7` apart on a screen, so the
 * space between things is larger than the space inside them — which is what
 * makes eight things read as eight rather than as one long column.
 */
export function Section({
	label,
	meta,
	children,
	className,
}: {
	label: ReactNode;
	meta?: ReactNode;
	children: ReactNode;
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

/**
 * A group with no box around it — a rule above, and space.
 *
 * The counterpart to `card`, and the more common of the two. A card costs a
 * border on all four sides to say "these things belong together"; a hairline and
 * whitespace say the same thing for nothing and read quieter at this density.
 */
export function Bare({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn('border-t border-line-soft pt-3', className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// WHAT A PAGE IS, ON A WIDE SCREEN (#52).
//
// These two are the only place a page's desktop width is decided, and a page
// picks exactly one of them. `AppShell` hands the page up to 1000px; whether that
// becomes two panes or one capped near the phone measure is the page's call, and
// this is where it says so. The decision and the list of which page picked which are
// in ADR 0018 and the desktop section of `docs/component-vocabulary.md` — not
// repeated here.
//
// Two shapes rather than one component with an optional prop: `<Panes primary>`
// with no second pane renders no panes, and a name that is only true half the
// time is the thing this repo spends most of its effort not doing.
// ---------------------------------------------------------------------------

/**
 * One pane, capped near the phone measure — the cheap majority.
 *
 * Not a stretched phone layout: these screens were laid out against 360px, and
 * the seven-column set grid on Train is the proof that widening one is a
 * regression rather than a gift.
 *
 * `Pane`, not `Column`, and the sentence above is why: "column" already means one
 * of the four cells a set row wraps into — the measurement that sets the floor on
 * how narrow an input can get, on the app's most-used screen. A page-wide
 * `Column` beside a set-row column is one word at two scales with the small one
 * load-bearing, which is the overload ADR-0002 and ADR-0016 exist to close. The
 * pair is `Pane` and `Panes`, and they cannot be confused by accident: one takes
 * children, the other takes two halves, so a mix-up is a type error.
 */
export function Pane({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div className={cn('flex flex-col gap-7 lg:mx-auto lg:max-w-[560px]', className)}>
			{children}
		</div>
	);
}

/**
 * Two panes side by side from `lg`, stacked below it.
 *
 * **The split must be contiguous in the phone order**, and that is the whole
 * trick. `display: contents` on the wrappers makes them vanish below `lg`, so
 * their children become direct flex items of this container and stack in DOM
 * order — the phone screen is unchanged, to the pixel, by a page adopting this.
 * The price is that the columns cannot interleave: `secondary` is everything
 * after one cut point, so a screen gets two columns only if it already reads as
 * two halves. A screen that would have to be reordered does not get them.
 *
 * A page's own header goes *outside* this, in the page's wrapper, so it spans
 * both columns rather than sitting on top of the first one.
 */
export function Panes({
	primary,
	secondary,
	className,
}: {
	primary: ReactNode;
	secondary: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				'flex flex-col gap-7 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-5',
				className,
			)}
		>
			{/* `gap: inherit` rather than a second literal `gap-7`: below `lg` these
			    wrappers are not boxes at all and the outer gap is what separates every
			    child, so the vertical rhythm has one definition either way. */}
			<div className="contents lg:flex lg:flex-col lg:gap-[inherit]">{primary}</div>
			<div className="contents lg:flex lg:flex-col lg:gap-[inherit]">{secondary}</div>
		</div>
	);
}

const EMPHASIS = /(<b>.*?<\/b>)/g;

/**
 * Training copy with its inline `<b>` emphasis rendered.
 *
 * The exercise library writes emphasis as literal `<b>` tags — 37 occurrences
 * across verdict text, flag advice, prescription cues and exercise rationale —
 * and React escapes them, so a screen that interpolates one of those strings
 * shows the athlete a literal `<b>` and looks broken for a reason that has
 * nothing to do with design. All four direction prototypes had to solve this
 * separately, which is why it is here and not on a branch.
 *
 * Tokenised, never `dangerouslySetInnerHTML`. The content is the app's own and
 * trusted today; injecting localized strings is how an XSS lands the first time
 * any of it becomes athlete-editable, and the exercise library was
 * athlete-editable until the rebuild closed it.
 *
 * Pair with the `prose-inline` class on an ancestor for the `<b>` styling.
 */
export function Prose({ value, className }: { value: string; className?: string }) {
	const parts = value.split(EMPHASIS).filter(Boolean);
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

/**
 * A 0–10 reading against a track.
 *
 * Two glyphs of information — the number and how far along it sits — in one 20px
 * row, because five of these have to fit under the verdict without becoming a
 * chart. The tone is the reading's own: the caller says what the number is, not
 * what colour it should be.
 */
export function Meter({ label, value }: { label: string; value: number }) {
	const tone = value >= 7 ? 'var(--ok)' : value >= 4 ? 'var(--warn)' : 'var(--stop)';
	return (
		<div className="flex items-center gap-2">
			<span className="w-[76px] shrink-0 truncate text-[11px] text-ink-dim">{label}</span>
			<span className="h-[3px] flex-1 overflow-hidden rounded-full bg-panel-3">
				<span
					className="block h-full rounded-full"
					style={{ width: `${Math.max(0, Math.min(10, value)) * 10}%`, background: tone }}
				/>
			</span>
			<span className="num w-[26px] shrink-0 text-right text-[11px]" style={{ color: tone }}>
				{value}
			</span>
		</div>
	);
}

/**
 * One reading in a divider-separated strip.
 *
 * Divider-separated rather than three cards: three bordered boxes for three
 * integers is the densest-looking and least dense arrangement there is.
 */
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
