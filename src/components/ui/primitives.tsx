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
