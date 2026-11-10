// The full-screen clock: one dialog for both of the Timer screen's clocks.
//
// Spec #98: "The dialog takes either a protocol run or a stopwatch run." The
// protocol clock (`Timer.tsx`) and the stopwatch (`Stopwatch.tsx`) each used to
// carry their own copy of this shell — the Dialog, the header, the tap-to-toggle
// face, the 56px control row — and two copies of a layout are two layouts the
// first time one of them is fixed. So the shell, the face and the layout live
// here, and each clock hands in what only it knows: its status, its reading,
// its controls. The protocol's ring and flash, and the stopwatch's laps, are
// what it hands in, never something this file knows the shape of.
//
// It is a Dialog rather than a `position: fixed` div because both clocks live
// inside a `StickyStrip`, whose `backdrop-blur` makes it the containing block for
// a fixed descendant: a plain overlay would be trapped inside a 120px strip. The
// portal also brings the focus trap and Escape handling for free.
//
// TWO LAYOUTS, ONE DOM (spec story 24)
// ------------------------------------
// Upright, the face fills the middle and the controls sit under the thumb. On
// its side a phone is 360px tall, and that stack ran Start, skip and back off
// the bottom of the screen; scrolling reached them, which is a floor and not a
// layout. So `sideways:` (a short landscape viewport, `app.css`) turns the same
// blocks into two columns: the face on the left at the height the screen has,
// the header, the detail and the controls on the right, every control on screen,
// and the screen's whole height spent on the number. CSS
// only, as ADR 0018 rules for the desktop layout and for the same reason: the
// shell is baked once, before any window exists.
//
// THE FIELD (#110)
// ----------------
// A running protocol hands in a `field`: its segment's colour, which then *is*
// the screen, with the ground colour as ink on it. From two metres the athlete
// reads the segment by colour before reading any word, and a screen with no
// colour is a clock that is not running. Every accent measures ≥6.4:1 against
// the ground, so ground-coloured ink clears the floor on all four; white would
// not (3.11:1 on the vermilion). Without a field the screen is the ground, as
// before: paused, done, and the stopwatch.
//
// A `summary` replaces the face with what the clock is about to run — the
// ready state, before Start — so tapping a protocol lands on its shape, not on
// a number nobody is counting yet.
//
// TWO WAYS OUT (#131, spec #130)
// ------------------------------
// Leaving a run and abandoning it are different things, so the header has one
// control for each. Back (‹), on the left, closes the clock and leaves the run
// as it is, running or paused. Close (✕), on the right, resets the run and then
// closes: what the clock hands in as `onResetAndClose`, and only where there is
// something to reset, so the ready state and a stopwatch at zero have Back
// alone. Everything else that closes a dialog — Escape, a tap outside, the
// system back gesture — is Back's: a shortcut never throws a run away.
//
// Where there is progress to lose, Close asks for a second tap (#132): the
// first arms it and a ring runs once round it for 3 seconds, a second inside
// that resets and closes, and any other tap in the clock disarms it. The clock
// says when there is progress (`closeAsks`); the arming is this file's, since
// both clocks share the header it guards.
import { Dialog } from '@base-ui/react/dialog';
import { ChevronLeft, X } from 'lucide-react';
import { type ReactNode, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { Segment } from '$lib/protocol';
import { cn } from '$lib/utils';
import { button } from './ui/variants';

/**
 * The colour each segment runs in: the field the clock fills the screen with,
 * and the mark beside a segment wherever one is listed — the ready state's
 * sequence, the editor's rows — so a row is recognised by the field it will
 * fill. Gold prepare, vermilion work, teal for both rests, violet cooldown
 * (#110); before the start and after the end, no colour.
 */
export const SEGMENT_COLOR: Record<Segment, string> = {
	idle: 'var(--ink-dim)',
	prepare: 'var(--warn)',
	work: 'var(--stop)',
	rest: 'var(--ok)',
	setRest: 'var(--ok)',
	cooldown: 'var(--cooldown)',
	done: 'var(--ink-dim)',
};

/**
 * The three control shapes of the clock's row (#110), as class strings: the
 * large middle one, the two square ones beside it. On a field they are drawn
 * in the field's own terms — a ground-filled middle, outlined squares in the
 * ink — so they need no colour of their own; off a field every one of them is
 * the clock control (`button({ kind: 'clock' })`, #118), the side ones too, so
 * a paused row speaks one language and none of it is filled vermilion: the
 * fill is the screen's one primary, and the clock is a tool on the screen. 84px
 * tall in the middle and 64px square at the sides, past the 48px floor because
 * they are found by direction, mid-hang, without looking.
 *
 * Here and not among the `ui/variants.ts` recipes (ADR 0010): it knows the
 * clock's field, which is this file's decision, and only the two clocks that
 * run in this dialog use it.
 */
export function clockControl(shape: 'main' | 'side', onField: boolean): string {
	if (shape === 'side') {
		return onField
			? 'flex size-16 shrink-0 items-center justify-center rounded-[18px] border-2 border-current disabled:opacity-100'
			: button({ kind: 'clock', size: 'touch', class: 'size-16 shrink-0 rounded-[18px] px-0' });
	}
	return onField
		? 'flex h-[84px] min-w-[132px] flex-1 max-w-[220px] items-center justify-center gap-2 rounded-[22px] bg-bg text-[20px] font-bold'
		: button({
				kind: 'clock',
				size: 'touch',
				class: 'h-[84px] min-w-[132px] max-w-[220px] flex-1 rounded-[22px] text-[20px] font-bold',
			});
}

/**
 * The full-screen face's size, stepped by how many glyphs it has to fit, as a
 * share of `--face`: the size a two-glyph reading is drawn at, set from the
 * screen, upright and on its side (`FACE`).
 *
 * One size for every reading would leave the common case — seconds — a third
 * smaller than it can be. The steps are measured in Barlow Condensed (#110): a
 * glyph is ~0.46em and a colon ~0.2em, so `2:30` fills the width at 0.58 and
 * `10:00` at 0.47. A stopwatch's tenth (`,3` at half size) counts as a glyph
 * and a half, or `0:00,0` runs off both sides of the screen.
 */
/** `--face`: most of the width upright; on its side the left column's width or
 *  the screen's height, whichever runs out first; on a desktop the height left
 *  over once the header and the controls have theirs. One value for both clocks,
 *  so it is set where the face is drawn rather than by each. */
const FACE =
	'[--face:min(88vw,46dvh)] lg:[--face:min(60vw,calc(100dvh-16rem))] sideways:[--face:min(40vw,78dvh)]';

function faceSize(glyphs: number): string {
	if (glyphs <= 2) return 'text-[length:var(--face)]';
	if (glyphs <= 4) return 'text-[length:calc(var(--face)*0.58)]';
	if (glyphs <= 5) return 'text-[length:calc(var(--face)*0.47)]';
	if (glyphs <= 6) return 'text-[length:calc(var(--face)*0.4)]';
	return 'text-[length:calc(var(--face)*0.33)]';
}

/**
 * A clock reading as it is drawn: the part read from the wall, and the part set
 * smaller beside it. A protocol's seconds carry their unit (`7s`), quiet because
 * it is not data; a stopwatch's tenth (`1:04.3`) is a digit, so it stays legible.
 *
 * `fill` sizes it for the full-screen clock, against `--face`; without it the
 * caller's class sets the size, as the bars' 44px does.
 */
export function Face({
	whole,
	unit,
	fraction,
	fill = false,
	className,
}: {
	whole: string;
	unit?: string;
	fraction?: string;
	fill?: boolean;
	className?: string;
}) {
	return (
		// The line box is the glyph's, not 1.5× it: the arbitrary size utility
		// carries its own line-height, which left ~120px between a two-glyph face
		// and the count meant to sit under it (#110's finish review).
		<span
			className={cn(className, fill && [FACE, faceSize(whole.length + (fraction ? 1.5 : 0))])}
			style={fill ? { lineHeight: 0.8 } : undefined}
		>
			{whole}
			{unit ? <span className="text-[0.38em]">{unit}</span> : null}
			{fraction ? <span className="text-[0.5em] text-ink-dim">{fraction}</span> : null}
		</span>
	);
}

/** The header's two controls, Back and Close: a 48px square, outlined in the
 *  ink on a field (#110) and the quiet control off one. */
function headerControl(onField: boolean): string {
	return onField
		? 'relative flex size-12 shrink-0 items-center justify-center self-start rounded-[14px] border-2 border-current'
		: button({ kind: 'quiet', size: 'touch', class: 'relative size-12 shrink-0 self-start px-0' });
}

/**
 * Close armed (#132): a ring once round the button for the window, the only
 * sign that a second tap resets and closes — no overlay, no icon swap, no
 * text. Drawn in the button's own ink, so it shows on a field and off one,
 * 3.5px outside the button's edge so it never sits on the field's outline,
 * and starting at the top, emptied clockwise as a clock hand sweeps.
 *
 * With motion, `.a-ring` sweeps it in one pass (`app.css`). Under reduced
 * motion there is no animation: the drawing is the seconds left, stepped once
 * a second, three steps. A countdown is a reading of time, like the face
 * changing every second, not an animation (ADR 0011's note).
 */
function ArmedRing({ left, onField }: { left: number; onField: boolean }) {
	// The button's corner (14px on a field, `rounded-md`'s 8px off one) plus
	// the 3.5px the stroke's centre sits outside it, on a 55px square inset
	// 1.5px in the 58px drawing: the button's 48px and 5px either side.
	const r = onField ? 17.5 : 11.5;
	const [lo, hi] = [1.5 + r, 56.5 - r];
	const d = `M29 1.5H${hi}A${r} ${r} 0 0 1 56.5 ${lo}V${hi}A${r} ${r} 0 0 1 ${hi} 56.5H${lo}A${r} ${r} 0 0 1 1.5 ${hi}V${lo}A${r} ${r} 0 0 1 ${lo} 1.5Z`;
	const gone = ((ARMED_SECONDS - left) / ARMED_SECONDS) * 100;
	return (
		<svg
			data-ring
			aria-hidden="true"
			viewBox="0 0 58 58"
			className="pointer-events-none absolute -inset-[5px] size-[58px] overflow-visible"
		>
			<path
				d={d}
				fill="none"
				stroke="currentColor"
				strokeWidth={3}
				pathLength={100}
				strokeDasharray="100 100"
				className="a-ring"
				style={{ strokeDashoffset: gone === 0 ? 0 : -gone, animationDuration: `${ARMED_SECONDS}s` }}
			/>
		</svg>
	);
}

/**
 * The running title's size: 30px, or less when the label does not fit between
 * Back and Close. With Back beside it (#131) a phone on its side has 168px
 * for the title, 114px with the time left beside it, and `DESAQUECIMENTO` is
 * 206px and `ENTRE SÉRIES` 164px at 30px. Sized by glyph count, as `faceSize`
 * is, against the title's own width (`cqi`): measured in Barlow Condensed
 * caps, a letter of a long label takes at most 0.54em with its tracking
 * (`COOLDOWN`) and a space about half that. The short labels that take more
 * (`WORK`, 0.57em) are never short of room.
 *
 * A label of two words may instead take two lines at up to 24px, two lines
 * being the 48px of Back and Close beside it, so the header never grows and
 * the face never moves at a segment change. Whichever is larger wins: at
 * 114px `ENTRE SÉRIES` is 24px on two lines, not 18px on one, under the time
 * left's 24px number (#131's critique).
 */
function titleSize(label: string): string {
	const words = label.split(' ');
	const em = (glyphs: number) => (glyphs * 0.54).toFixed(2);
	const oneLine = `min(30px, calc(100cqi / ${em(label.length - (words.length - 1) / 2)}))`;
	if (words.length === 1) return oneLine;
	const longest = Math.max(...words.map((w) => w.length));
	return `max(${oneLine}, min(24px, calc(100cqi / ${em(longest)})))`;
}

/** How long Close stays armed for its second tap (#132). */
const ARMED_SECONDS = 3;

/** The part of the platform's `CloseWatcher` the clock uses, declared here
 *  because not every browser has one. */
type CloseWatcherClass = new () => { onclose: (() => void) | null; destroy: () => void };

/** Where the clock is, in a word and a colour: a segment, or running/paused. */
export interface ClockStatus {
	label: string;
	color: string;
}

export function FullScreenClock({
	open,
	onOpenChange,
	onResetAndClose,
	closeAsks = false,
	label,
	status,
	field = null,
	name,
	spoken,
	toggleLabel,
	onToggle,
	children,
	detail,
	controls,
	summary,
	layer,
	announcer,
	actions,
	aside,
}: {
	open: boolean;
	/** Opens the clock, and closes it leaving the run as it is: Back, Escape, a
	 *  tap outside, the system back gesture. */
	onOpenChange: (open: boolean) => void;
	/** Close (✕): resets the run and closes the clock — on the second tap where
	 *  `closeAsks`. Absent where there is nothing to reset, and then only Back
	 *  shows. */
	onResetAndClose?: () => void;
	/** Close asks for a second tap first (#132): there is progress to lose — a
	 *  protocol running or paused, a stopwatch with time on it. */
	closeAsks?: boolean;
	/** The dialog's accessible name. */
	label: string;
	/** The title: where the clock is. */
	status: ClockStatus;
	/** The colour the whole screen takes — a running segment's — or nothing,
	 *  for the ground. Ink on a field is the ground colour. */
	field?: string | null;
	/** What is being run, under the title, or nothing. */
	name?: string | null;
	/** The reading, said rather than shown, for whoever cannot see it. */
	spoken: string;
	/** What a tap on the face does: Start, Resume or Pause. */
	toggleLabel: string;
	onToggle: () => void;
	/** The face: the number. The tap target. */
	children: ReactNode;
	/** The lines that say where the run is — round and set, the lap — under the
	 *  face upright, and in the middle of the right-hand column on its side. */
	detail?: ReactNode;
	/** The control row, in the order the clock asks for. */
	controls: ReactNode;
	/** The ready state: shown instead of the face and its detail, titled by
	 *  `label`. */
	summary?: ReactNode;
	/** Drawn behind everything and never in the way of a tap: the flash. */
	layer?: ReactNode;
	/** A live region, if the clock says its changes out loud. */
	announcer?: ReactNode;
	/** What the protocol can do besides run, at the right of the ready state's
	 *  header, where there is no Close — the list row's own ⋯ (#110, #111). */
	actions?: ReactNode;
	/** A short reading beside Close once the clock is past its ready state —
	 *  the protocol's session time left (#129) — in the header's own colour. */
	aside?: ReactNode;
}) {
	const readingId = useId();
	const onField = field != null;
	// The dialog's scroll lock reserves the scrollbar's gutter on the root
	// (`scrollbar-gutter: stable`), which the fixed popup cannot cover: a strip
	// of something else down the right edge of every field on a desktop or a
	// phone on its side. Painting the gutter the field's colour still left a
	// seam — a composited popup and the root are not guaranteed the same pixels
	// — so while the clock is open the gutter is not reserved at all. For the
	// whole time it is open, not only on a field: tied to the field, every pause
	// gave the gutter back and moved the centred controls under the finger by
	// its width. A class on the root (`app.css`), not an inline style, because
	// the scroll lock saves and restores the root's inline style itself.
	useEffect(() => {
		if (!open) return;
		const root = document.documentElement;
		root.classList.add('clock-field');
		return () => root.classList.remove('clock-field');
	}, [open]);
	// The system back gesture is Back (#131). The dialog hears Escape and a tap
	// outside on its own, but Android's back reaches a page as a close request,
	// which only a `CloseWatcher` hears; without one the gesture went back a page,
	// out from under a clock that was counting. Where there is no `CloseWatcher`
	// the gesture does what it did before.
	const leave = useEffectEvent(() => onOpenChange(false));
	useEffect(() => {
		if (!open) return;
		const Watcher = (globalThis as { CloseWatcher?: CloseWatcherClass }).CloseWatcher;
		if (!Watcher) return;
		const watcher = new Watcher();
		watcher.onclose = () => leave();
		return () => watcher.destroy();
	}, [open]);
	// Close armed (#132): the seconds left in which a second tap resets and
	// closes, 0 when it is not armed. Counted down once a second, so the ring
	// can step by the second under reduced motion.
	const [armedFor, setArmedFor] = useState(0);
	// However the clock closed, it opens disarmed: set from the change of `open`
	// itself, React's idiom for state that follows a prop (as `Timer`'s
	// `openSeen`), so no frame of the reopened clock is armed.
	const [openSeen, setOpenSeen] = useState(open);
	if (open !== openSeen) {
		setOpenSeen(open);
		setArmedFor(0);
	}
	const armed = armedFor > 0;
	useEffect(() => {
		if (!armed) return;
		const id = setInterval(() => setArmedFor((s) => s - 1), 1000);
		return () => clearInterval(id);
	}, [armed]);
	// Any other tap — the face, the control row, Back — disarms Close and goes
	// on to do its own job: heard on the way down, before the control acts.
	const closeRef = useRef<HTMLButtonElement>(null);
	const disarmOnOtherTap = (event: { target: EventTarget }) => {
		if (armed && !closeRef.current?.contains(event.target as Node)) setArmedFor(0);
	};
	const onClose = () => {
		if (closeAsks && !armed) setArmedFor(ARMED_SECONDS);
		else onResetAndClose?.();
	};
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Popup
					aria-label={label}
					onClickCapture={disarmOnOtherTap}
					style={onField ? { background: field, color: 'var(--bg)' } : undefined}
					className={cn(
						'fixed inset-0 z-50 flex h-dvh w-dvw flex-col overflow-y-auto bg-bg text-ink transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
						// A focus ring in the signature vermilion vanishes on the work
						// field, so on a field it is drawn in the ink.
						onField && '[&_:focus-visible]:outline-current',
						// On its side: the face down the left, the header at the top right
						// and the controls at the bottom right, nothing below the fold.
						!summary && 'sideways:grid sideways:grid-cols-2 sideways:grid-rows-[auto_1fr_auto]',
					)}
				>
					{layer}
					{announcer}
					<p id={readingId} className="sr-only">
						{spoken}
					</p>
					<div className="flex items-center gap-3 px-4 pt-4 lg:mx-auto lg:w-full lg:max-w-pane sideways:col-start-2 sideways:row-start-1">
						{/* Back, not "back a segment" (⏮), which can be on the same
						    screen: this one leaves the clock. The chevron is 26px to the
						    X's 22px because it draws half the X's ink, and the way out
						    that keeps the run must not be the fainter of the two. */}
						<Dialog.Close aria-label={m.btn_back()} className={headerControl(onField)}>
							<ChevronLeft size={26} aria-hidden="true" />
						</Dialog.Close>
						<div className="@container min-w-0 flex-1">
							{summary ? (
								<Dialog.Title className="text-[25px] leading-[1.15] font-semibold tracking-[-0.015em] text-ink">
									{label}
								</Dialog.Title>
							) : (
								<Dialog.Title
									className="display leading-none font-bold tracking-[0.04em] uppercase"
									style={{
										fontSize: titleSize(status.label),
										...(onField ? {} : { color: status.color }),
									}}
								>
									{status.label}
								</Dialog.Title>
							)}
							{name ? (
								<p className="mt-1.5 truncate text-[14px] font-medium text-ink-dim">{name}</p>
							) : null}
						</div>
						{summary ? actions : aside}
						{onResetAndClose ? (
							<button
								ref={closeRef}
								type="button"
								aria-label={armed ? m.timer_reset_close_armed() : m.timer_reset_close()}
								onClick={onClose}
								className={headerControl(onField)}
							>
								<X size={22} aria-hidden="true" />
								{armed ? <ArmedRing left={armedFor} onField={onField} /> : null}
							</button>
						) : null}
					</div>

					{summary ? (
						<div className="flex flex-1 flex-col px-5 lg:mx-auto lg:w-full lg:max-w-pane">
							{summary}
						</div>
					) : (
						// The face and its detail, centred together upright. On its side the
						// wrapper steps out of the way (`display: contents`, the trick
						// `Panes` uses) so each becomes a cell of its own: the face down the
						// whole left column at the screen's full height, the detail in the
						// middle of the right one, where it would otherwise be empty.
						<div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 sideways:contents">
							{/* Tapping the face starts and pauses — the whole point is not
							    having to find a control with chalky hands — and the buttons
							    underneath are the tappable equivalent for anyone who does not
							    discover that, since a gesture is never the only way in. Upright
							    it reaches 48px past the face above and below, over the detail
							    lines, which do nothing when tapped, with the margin taken back so
							    the layout does not move: a target as wide as the screen. */}
							<button
								type="button"
								onClick={onToggle}
								aria-label={toggleLabel}
								aria-describedby={readingId}
								className="relative z-[1] -my-12 flex items-center justify-center self-stretch py-12 sideways:col-start-1 sideways:row-span-3 sideways:row-start-1 sideways:my-0 sideways:px-4 sideways:py-0"
							>
								{children}
							</button>
							{detail ? (
								<div className="flex flex-col items-center gap-2 sideways:col-start-2 sideways:row-start-2 sideways:gap-2 sideways:self-center sideways:px-4">
									{detail}
								</div>
							) : null}
						</div>
					)}

					<div className="flex items-center justify-center gap-4 px-4 pt-3 pb-7 lg:mx-auto lg:w-full lg:max-w-pane sideways:col-start-2 sideways:row-start-3 sideways:pb-4">
						{controls}
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
