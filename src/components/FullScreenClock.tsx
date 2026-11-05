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
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils';
import { button } from './ui/variants';

/**
 * The full-screen face's size, stepped by how many glyphs it has to fit, as a
 * share of `--face`: the size a two-glyph reading is drawn at, which each clock
 * sets for itself — the protocol's from its ring, the stopwatch's from the
 * screen — upright and on its side.
 *
 * One size for every reading was chosen for seconds, and `2:00` at that size ran
 * through the ring on both sides; one size for the longest would leave the
 * common case a third smaller than it can be. The steps are the ones each clock
 * had measured on its own, which turned out to be the same steps.
 */
function faceSize(whole: string): string {
	if (whole.length <= 2) return 'text-[length:var(--face)]';
	if (whole.length <= 4) return 'text-[length:calc(var(--face)*0.65)]';
	if (whole.length <= 5) return 'text-[length:calc(var(--face)*0.52)]';
	return 'text-[length:calc(var(--face)*0.38)]';
}

/**
 * A clock reading as it is drawn: the part read from the wall, and the part set
 * smaller beside it. A protocol's seconds carry their unit (`7s`), quiet because
 * it is not data; a stopwatch's tenth (`1:04.3`) is a digit, so it stays legible.
 *
 * `fill` sizes it for the full-screen clock, against the `--face` its clock
 * sets; without it the caller's class sets the size, as the strips' 46px does.
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
		<span className={cn(className, fill && faceSize(whole))}>
			{whole}
			{unit ? <span className="text-[0.38em] text-ink-faint">{unit}</span> : null}
			{fraction ? <span className="text-[0.5em] text-ink-dim">{fraction}</span> : null}
		</span>
	);
}

/** Where the clock is, in a word and a colour: a segment, or running/paused. */
export interface ClockStatus {
	label: string;
	color: string;
}

export function FullScreenClock({
	open,
	onOpenChange,
	label,
	status,
	name,
	spoken,
	toggleLabel,
	onToggle,
	children,
	detail,
	readout,
	controls,
	layer,
	announcer,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The dialog's accessible name. */
	label: string;
	/** The title: where the clock is. */
	status: ClockStatus;
	/** What is being run, under the title, or nothing. */
	name: string | null;
	/** The reading, said rather than shown, for whoever cannot see it. */
	spoken: string;
	/** What a tap on the face does: Start, Resume or Pause. */
	toggleLabel: string;
	onToggle: () => void;
	/** The face: the number, and the ring if it has one. The tap target. */
	children: ReactNode;
	/** The lines that say where the run is — round and set, the lap — under the
	 *  face upright, and in the middle of the right-hand column on its side. */
	detail?: ReactNode;
	/** The line above the controls: a protocol's elapsed, left and total. */
	readout?: ReactNode;
	/** The control row. 56px each, in the order the clock asks for. */
	controls: ReactNode;
	/** Drawn behind everything and never in the way of a tap: the flash. */
	layer?: ReactNode;
	/** A live region, if the clock says its changes out loud. */
	announcer?: ReactNode;
}) {
	const readingId = useId();
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Popup
					aria-label={label}
					className={cn(
						'fixed inset-0 z-50 flex h-dvh w-dvw flex-col overflow-y-auto bg-bg transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
						// On its side: the face down the left, the header at the top right
						// and the controls at the bottom right, nothing below the fold.
						'sideways:grid sideways:grid-cols-2 sideways:grid-rows-[auto_1fr_auto]',
					)}
				>
					{layer}
					{announcer}
					<p id={readingId} className="sr-only">
						{spoken}
					</p>
					<div className="flex items-start gap-2 px-4 pt-4 lg:mx-auto lg:w-full lg:max-w-[560px] sideways:col-start-2 sideways:row-start-1">
						<div className="min-w-0 flex-1">
							<Dialog.Title
								className="num text-[13px] tracking-wider uppercase"
								style={{ color: status.color }}
							>
								{status.label}
							</Dialog.Title>
							{name ? <p className="eyebrow mt-1 truncate">{name}</p> : null}
						</div>
						<Dialog.Close
							aria-label={m.btn_close()}
							className={button({ kind: 'quiet', size: 'touch', class: 'size-12 shrink-0 px-0' })}
						>
							<X size={20} />
						</Dialog.Close>
					</div>

					{/* The face and its detail, centred together upright. On its side the
					    wrapper steps out of the way (`display: contents`, the trick
					    `Panes` uses) so each becomes a cell of its own: the face down the
					    whole left column at the screen's full height, the detail in the
					    middle of the right one, where it would otherwise be empty. */}
					<div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 sideways:contents">
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
							<div className="flex flex-col items-center gap-4 sideways:col-start-2 sideways:row-start-2 sideways:gap-3 sideways:self-center sideways:px-4">
								{detail}
							</div>
						) : null}
					</div>

					<div className="flex flex-col gap-2 px-4 pb-6 lg:mx-auto lg:w-full lg:max-w-[560px] sideways:col-start-2 sideways:row-start-3 sideways:pb-4">
						{readout}
						<div className="mt-1 flex gap-2">{controls}</div>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
