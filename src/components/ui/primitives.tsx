// The domain-blind components: shapes, not screens.
//
// Nothing in this file names a verdict, a set, an exercise or a readiness score.
// That is the test that puts a component here rather than one directory up: a
// primitive takes a label, a value and children, so it can be used anywhere,
// and a component that names the training domain in its props can only be used
// where that domain object already is.
import type { ReactNode, Ref } from 'react';
import { cn } from '$lib/utils';

/**
 * The furniture rank of the type scale: a field label, a unit, a meta reading.
 *
 * Three ranks, not one. The first pass had a single 10px eyebrow doing both
 * "this is a section of the screen" and "this labels the field below it", so
 * every heading on Today weighed the same and the screen read as one long list —
 * the athlete's "a hierarquia ficou confusa". The ranks are `.h-screen-title`,
 * `.h-section` (Inter since #125) and `.eyebrow`, defined in `app.css`, and they differ on size,
 * weight *and* colour at once because at this density any one axis alone is too
 * quiet to register.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn('eyebrow', className)}>{children}</div>;
}

/**
 * How every screen opens (#114, spec #113 story 78): the title in the top rank,
 * one line of meta under it, and at most one thing on the right.
 *
 * The one `<h1>` on a screen goes through here, so the title's rank, where the
 * meta sits and the space below are decided once. The space below is the page's
 * own `gap-sections`: the header is the first of the screen's sections.
 *
 * The right-hand side holds one of two things, never both (the types refuse it):
 * - `reading` — a short count or reading about the whole screen (`3/12 sets`,
 *   `Week 5 / 8`), baseline-aligned with the title so the two read as one line.
 *   A reading, not a control: Today's week reading was a link to Week until the
 *   navigation carried Week (#115); it is plain text since #117.
 * - `action` — a single icon control, centred on the title's line because an
 *   icon has no baseline. A screen action belongs in the top strip's slot once
 *   the shell has one (#115); this is where the Timer's cue settings sit until
 *   then.
 *
 * NEITHER SETS THE TITLE'S HEIGHT. A 44px control beside a 24px title line used
 * to push the title down: by baseline on Today (the week link) and by centring
 * on the Timer (the cue settings), so the title sat at three heights across the
 * eight screens and jumped on every navigation (#114's critique, measured at
 * 61.5 / 69 / 71.5px). So the right-hand slot takes `-my-2.5`: up to 44px of
 * hit area overhangs the title's 24px line by 10px each way instead of growing
 * it, into the 6px above (and the strip's 8px under it) and the sections gap
 * below.
 *
 * `lede` is a sentence under the title for a screen that has to explain itself
 * before it asks anything (the intake). Most screens have none.
 */
export function ScreenHeader({
	title,
	meta,
	lede,
	reading,
	action,
	titleRef,
}: {
	title: ReactNode;
	/** One line, furniture: the date, the phase. Truncated, never wrapped. */
	meta?: ReactNode;
	lede?: ReactNode;
	/** For a screen that moves focus to its title as it arrives (the intake's
	 *  proposal, #123): the title becomes focusable from script, with no ring,
	 *  as the readiness sheet's questions are. */
	titleRef?: Ref<HTMLHeadingElement>;
} & ({ reading?: ReactNode; action?: never } | { action?: ReactNode; reading?: never })) {
	return (
		<header data-screen-header="" className="flex items-baseline justify-between gap-2 pt-1.5">
			<div className="min-w-0">
				{titleRef ? (
					<h1 ref={titleRef} tabIndex={-1} className="h-screen-title outline-none">
						{title}
					</h1>
				) : (
					<h1 className="h-screen-title">{title}</h1>
				)}
				{meta ? <p className="mt-1 truncate text-[11px] text-ink-faint">{meta}</p> : null}
				{lede ? <p className="mt-1.5 text-[13px] leading-snug text-ink-dim">{lede}</p> : null}
			</div>
			{reading ? (
				<div className="num -my-2.5 shrink-0 text-[11px] text-ink-faint">{reading}</div>
			) : null}
			{/* `self-start` and the overhang put a 44px control's centre on the
			    title line's centre (24px line, 44px control: 10px over each way). */}
			{action ? <div className="-my-2.5 shrink-0 self-start">{action}</div> : null}
		</header>
	);
}

/**
 * A strip held under the 44px app bar while the page scrolls beneath it.
 *
 * The clock on Train and on the Timer screen, and the stopwatch: each is the one
 * element that has to survive scrolling to a set row three cards down, or to the
 * twentieth protocol in a list. Bled to the page edge so the list does not show
 * through its sides, and blurred rather than opaque so the scroll still reads.
 *
 * Its `backdrop-blur` makes it the containing block for any fixed descendant,
 * which is why the full-screen clock inside it is a portalled dialog
 * (`FullScreenClock.tsx`).
 */
export function StickyStrip({ children }: { children: ReactNode }) {
	return (
		<div className="sticky top-[44px] z-10 -mx-3 bg-bg/95 px-3 pt-1 pb-2 backdrop-blur">
			{children}
		</div>
	);
}

/**
 * A bar held at the bottom of the screen while the page scrolls above it — the
 * Timer screen's mini bar (#111), a clock running behind the list.
 *
 * Fixed, so nothing it sits inside may carry a `backdrop-filter` or a
 * transform (`StickyStrip` does, and would trap it). It leaves a space of its
 * own height at the end of the page, so the last row can still be scrolled out
 * from under it. It sits on top of the navigation bar (`--nav-clear`, #115), and
 * clears the home indicator itself only where there is no bar under it. From
 * `lg` it starts right of the rail, on the measure's left edge, capped as
 * `Pane` is, so it lines up with the list it runs behind.
 */
export function BottomBar({ children }: { children: ReactNode }) {
	return (
		<>
			<div aria-hidden="true" className="h-[84px]" />
			{/* The band under the bar is the ground and takes the tap: a thumb that
			    lands just below the bar must not open whatever row shows through. */}
			<div
				data-bottom-bar=""
				className="fixed inset-x-0 bottom-[var(--nav-clear)] z-30 bg-[linear-gradient(to_top,var(--bg)_55%,transparent)] px-2.5 pt-3 pb-[calc(0.875rem+max(0px,env(safe-area-inset-bottom)-var(--nav-clear)))] lg:left-[var(--nav-rail)] lg:px-0"
			>
				<div className="mx-auto max-w-pane lg:max-w-[1000px] lg:px-gutter">
					<div className="rounded-2xl shadow-[0_10px_30px_-8px_rgb(0_0_0/0.8)] lg:max-w-pane">
						{children}
					</div>
				</div>
			</div>
		</>
	);
}

/**
 * A screen section: heading, optional right-hand meta, body.
 *
 * The gap under the heading is deliberately larger than the gaps within the
 * body. The athlete asked for the hierarchy to be carried by *space* as well as
 * by type, and a heading sitting 6px off its content reads as a caption rather
 * than as a heading. Sections themselves sit `gap-sections` (28px) apart, so the
 * space between things is larger than the space inside them — which is what
 * makes eight things read as eight rather than as one long column.
 */
export function Section({
	id,
	label,
	meta,
	children,
	className,
}: {
	/** An anchor, so an `Empty` elsewhere on the page can point at the section
	 *  that fills it. */
	id?: string;
	label: ReactNode;
	meta?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section id={id} className={cn('flex flex-col gap-group', className)}>
			<header className="flex items-baseline justify-between gap-2">
				{/* One section rank, in Inter (DESIGN.md › Typography). It took a
				    `face` until every screen had moved off the mono caps (#125). */}
				<h2 className="h-section min-w-0">{label}</h2>
				{/* The meta rank (11px, faint, Inter): every caller's meta is a phrase
				    or a chip, and each one undid the eyebrow's mono caps until #125. */}
				{meta ? <div className="shrink-0 text-[11px] text-ink-faint">{meta}</div> : null}
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
	return <div className={cn('border-t border-line-soft pt-inset', className)}>{children}</div>;
}

/** One control on its own line: what it is on the left, the control on the right.
 *  No horizontal padding of its own — inside a `ControlList` the list supplies it.
 *
 *  Promoted out of Settings by #105, when the cue settings needed the same row
 *  in Settings and in the Timer screen's popover. The label wraps rather than
 *  truncating: pt-BR runs longer, and the control keeps its width.
 *
 *  **One height whatever it holds** (#122): 56px, a 44px control with 6px above
 *  and below it. At `min-h-11` a switch's row was 44px and a choice's 56px, so
 *  Settings' rows stepped as the control changed; now only a label that wraps
 *  makes a row taller. */
export function ControlRow({
	id,
	label,
	children,
}: {
	/** For the control to name itself by: `Switch`'s `labelledBy`, or a
	 *  `Segmented` group's. */
	id?: string;
	label: ReactNode;
	children: ReactNode;
}) {
	return (
		<div data-control-row="" className="flex min-h-14 items-center justify-between gap-3 py-1.5">
			<span id={id} className="min-w-0 text-[13px] text-ink">
				{label}
			</span>
			{children}
		</div>
	);
}

/**
 * A group's controls, as one list (#122).
 *
 * DESIGN.md › The group pattern: a list of controls is a card of rows, one row
 * or many. Each child is one item, divided from the next by a `line-soft`
 * hairline and padded 12px each side; an item is a `ControlRow`, or a row with
 * the line that qualifies it under it (`ControlNote`). `surface={false}` keeps the
 * rows and drops the card, for a list whose container already is a surface (the
 * cue settings' popover).
 */
export function ControlList({
	children,
	surface = true,
	className,
}: {
	children: ReactNode;
	surface?: boolean;
	className?: string;
}) {
	return (
		<div
			data-control-list=""
			className={cn(
				'flex flex-col divide-y divide-line-soft',
				surface && 'rounded-lg border border-line bg-panel [&>*]:px-3',
				className,
			)}
		>
			{children}
		</div>
	);
}

/** The line under a `ControlRow` that says why its control did not do what was
 *  asked, or cannot here: a refused permission, a held sign-out, a device with no
 *  voice. Gold, because it is a warning about this device rather than a stop. */
export function ControlNote({
	id,
	role,
	children,
}: {
	id?: string;
	/** `status` for a line that answers a tap, so a screen reader hears it. */
	role?: 'status';
	children: ReactNode;
}) {
	return (
		<p id={id} role={role} className="-mt-1 pb-3 text-[13px] leading-snug text-pretty text-gold">
			{children}
		</p>
	);
}

/**
 * A typed field: its label in words over the input (#123, promoted by #124 when
 * sign-in took the intake's field rhythm).
 *
 * A real `<label>` and never a placeholder: a placeholder disappears on focus
 * and is not an accessible name. The rank is where the field sits: `field` under
 * a question or a heading that heads it (13px ink, 4px over the input: the
 * intake's grades, sign-in's email and password), `question` when the field is
 * one of its step's questions and heads itself in the section rank (the intake's
 * session length). `hint` follows the label in faint ink and is part of its
 * name: a unit, "(optional)", a password's minimum.
 */
export function Field({
	id,
	label,
	hint,
	rank = 'field',
	children,
}: {
	/** The input's id: the label points at it. */
	id: string;
	label: ReactNode;
	hint?: ReactNode;
	rank?: 'question' | 'field';
	children: ReactNode;
}) {
	return (
		<div
			className={cn('flex min-w-0 flex-1 flex-col', rank === 'question' ? 'gap-group' : 'gap-1')}
		>
			<label
				className={rank === 'question' ? 'h-section' : 'text-[13px] leading-snug text-ink'}
				htmlFor={id}
			>
				{label}
				{hint ? <span className="font-normal text-ink-faint"> {hint}</span> : null}
			</label>
			{children}
		</div>
	);
}

/** What a notice's colour says. `warn` is about this device or the network
 *  (offline, a server that could not be reached): gold. `stop` refuses what the
 *  athlete typed: vermilion, as a refused value's rule is. `info` changes nothing
 *  the athlete has to do: dim ink. */
export type NoticeTone = 'info' | 'warn' | 'stop';

const NOTICE_TONE: Record<NoticeTone, string> = {
	info: 'text-ink-dim',
	warn: 'text-gold',
	stop: 'text-flag',
};

/**
 * A line a screen says that is not under a control's row (#124): the page
 * offline, what this device is holding, a sign-in the server refused. One
 * family, so the weight of a line is its colour alone: 13px, wrapping evenly,
 * and the tone says how much it asks of the athlete. `ControlNote` is the same
 * line under a row.
 *
 * A notice about the whole screen is the first group after `ScreenHeader`
 * (DESIGN.md › The screen header), never a line pulled up into it. One that
 * answers a tap takes `role` (`alert` when it is the only thing that changed
 * after a submit, `status` otherwise).
 */
export function Notice({
	tone,
	id,
	role,
	children,
}: {
	tone: NoticeTone;
	id?: string;
	role?: 'alert' | 'status';
	children: ReactNode;
}) {
	return (
		<p
			id={id}
			role={role}
			data-notice={tone}
			className={cn('text-[13px] leading-snug text-pretty', NOTICE_TONE[tone])}
		>
			{children}
		</p>
	);
}

/**
 * What a group says when it has nothing to list (#61).
 *
 * Copy, not furniture: a `Bare`, one line of training copy with its emphasis
 * rendered, and — where one exists — the single affordance that fills it. Never
 * a `card` and never an empty `RowGroup`: a bordered box with a sentence in it is
 * the empty box the sentence exists to replace, and Log rendered two of them
 * before this existed.
 *
 * The copy says what the group is waiting for and where that comes from, in the
 * glossary's words. It is a message, so it is localized; it is `Prose`, so it can
 * carry a `<b>`. What it never does is stand in for an answer the screen could
 * not compute — a rest day is an answer and has its own line, and a verdict from
 * no answers is not a verdict (see Today).
 */
export function Empty({
	value,
	action,
	className,
}: {
	value: string;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<Bare className={cn('flex flex-col items-start gap-group', className)}>
			{/* `text-pretty`: a two-line sentence that leaves its last word alone
			    on a third reads as a mistake (#104's review, the Timer's copy). */}
			<p className="prose-inline text-[13px] leading-snug text-pretty text-ink-dim">
				<Prose value={value} />
			</p>
			{action}
		</Bare>
	);
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
 *
 * From `lg` it starts on the measure's left edge rather than centring in it
 * (#115, DESIGN.md › The grid), so its title sits where a two-pane page's does
 * and on the strip's wordmark's edge, and does not jump sideways between
 * screens.
 */
export function Pane({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div className={cn('flex flex-col gap-sections lg:max-w-pane', className)}>{children}</div>
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
	stickySecondary,
	className,
}: {
	primary: ReactNode;
	secondary: ReactNode;
	/** Hold the second pane in view while the first scrolls (Log's selected day
	 *  beside its timeline, #120): stuck 16px under the strip. A grid item can
	 *  stick because the grid is as tall as the longer pane. A pane that can be
	 *  taller than the window caps and scrolls itself (Log's does), at most the
	 *  window less the strip, `main`'s 16px above and its 56px below: any taller
	 *  and at the page's end the grid's bottom pushes it up under the strip. */
	stickySecondary?: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn(
				'flex flex-col gap-sections lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-gutter',
				className,
			)}
		>
			{/* `gap: inherit` rather than a second `gap-sections`: below `lg` these
			    wrappers are not boxes at all and the outer gap is what separates every
			    child, so the vertical rhythm has one definition either way. */}
			<div className="contents lg:flex lg:flex-col lg:gap-[inherit]">{primary}</div>
			<div
				className={cn(
					'contents lg:flex lg:flex-col lg:gap-[inherit]',
					stickySecondary && 'lg:sticky lg:top-[60px]',
				)}
			>
				{secondary}
			</div>
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
}: {
	value: number | string;
	suffix?: string;
	label: string;
}) {
	return (
		<div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1">
			{/* No accent: a count is not a state, and the vermilion streak read as
			    "stop" on the rest day that broke it (#117). */}
			<span className="num text-[22px] leading-none font-bold text-chalk">
				{value}
				{suffix ? <span className="text-[13px] text-ink-faint">{suffix}</span> : null}
			</span>
			<span className="eyebrow w-full text-center">{label}</span>
		</div>
	);
}
