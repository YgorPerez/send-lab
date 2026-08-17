// The Latch — Direction D's tick control, and the direction's whole argument.
//
// WHY IT IS SHAPED LIKE THIS
// --------------------------
// The brief asked for swipe-to-tick. The device tests (#54) then made the
// collision an *Android* question: Android's gesture navigation claims a strip
// along **both** screen edges for its back gesture. The web cannot measure that
// strip (there is no API) and cannot opt out of it (`systemGestureExclusionRects`
// is native-only). A drag that *begins* inside the strip is the OS's, and the app
// never sees more than a `pointercancel`.
//
// So the horizontal drag survives, but only inside a guarded region. The latch is
// laid out as three columns:
//
//     [ 52px jaw ][            track            ][ 52px state ]
//
// with the card sitting 12px in from the page edge. On a 360px screen that puts
// the knob's rest position 64px from the left edge and its *done* rest position
// 64px from the right edge — both clear of `--edge-guard` (44px), which is the
// widest documented Android back-sensitivity inset plus finger slop. The two
// 52px columns are not padding invented to buy that clearance; they carry the
// category colour and the state icon. The guard pays for itself.
//
// The knob is also a button. `drag="x"` leaves `touch-action: pan-y` in place, so
// the row still scrolls vertically under the finger (confirmed by #54's finding
// that switches do not block scrolling on Android), and a plain tap toggles the
// same state the drag does. Every gesture here has a tappable equivalent because
// it *is* the tappable equivalent — one control, two inputs, one state.
//
// No haptics. The athlete declined them (#54), so the confirmation is carried
// entirely by weight and motion: the knob is heavy, it snaps past the halfway
// point on its own, and the track floods with the accent behind it.
import { Check, ChevronsRight, Lock } from 'lucide-react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import { pill } from './physical';

/** Snap. Stiff and well-damped: equipment settles, it does not wobble. */
const SNAP = { type: 'spring', stiffness: 620, damping: 42, mass: 0.9 } as const;

/** How far across the track a drag has to get before it commits on release.
 *  Below half so a decisive shove works; above a third so a stray graze does not. */
const COMMIT_AT = 0.45;

export interface LatchProps {
	label: string;
	/** Second line — the exercise category, or why the task is held. */
	sub?: string;
	/** CSS colour for the jaw and the flood, e.g. `var(--violet)`. */
	accent?: string;
	checked: boolean;
	/** Held work: the verdict caps intensity below what this task demands, so the
	 *  latch is locked rather than hidden. Held, not cancelled (CONTEXT.md). */
	locked?: boolean;
	/** Shown as a chip on the header line. */
	tag?: string;
	onChange: (next: boolean) => void;
	/** Tapping the state column. Used for "why is this held" and for detail. */
	onInfo?: () => void;
	infoLabel?: string;
}

export function Latch({
	label,
	sub,
	accent = 'var(--flag)',
	checked,
	locked = false,
	tag,
	onChange,
	onInfo,
	infoLabel,
}: LatchProps) {
	const trackRef = useRef<HTMLDivElement>(null);
	const knobRef = useRef<HTMLButtonElement>(null);
	const draggedRef = useRef(false);
	const [travel, setTravel] = useState(0);
	const x = useMotionValue(0);
	// The flood behind the knob is the progress readout. It is the only feedback
	// there is, so it tracks the finger rather than waiting for the release.
	const flood = useTransform(x, (v) => (travel > 0 ? Math.min(1, Math.max(0, v / travel)) : 0));

	useEffect(() => {
		const track = trackRef.current;
		const knob = knobRef.current;
		if (!track || !knob) return;
		const measure = () => setTravel(Math.max(0, track.clientWidth - knob.offsetWidth - 8));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(track);
		return () => observer.disconnect();
	}, []);

	// The knob follows the state, whoever changed it — drag, tap, or the screen
	// resetting the whole list.
	useEffect(() => {
		const controls = animate(x, checked ? travel : 0, SNAP);
		return () => controls.stop();
	}, [checked, travel, x]);

	const toggle = useCallback(() => {
		if (locked) {
			onInfo?.();
			return;
		}
		onChange(!checked);
	}, [checked, locked, onChange, onInfo]);

	const done = checked && !locked;

	return (
		<div className="slab overflow-hidden rounded-lg">
			<div className="flex items-start gap-2 px-3 pt-3 pb-2">
				<div className="min-w-0 flex-1">
					<p className="text-[17px] leading-tight font-semibold tracking-tight text-ink">{label}</p>
					{sub ? <p className="mt-0.5 text-[12px] leading-snug text-ink-dim">{sub}</p> : null}
				</div>
				{tag ? (
					<span className={pill({ tone: locked ? 'gold' : done ? 'teal' : 'line' })}>{tag}</span>
				) : null}
			</div>

			<div className="grid grid-cols-[52px_1fr_52px] items-stretch">
				{/* The fixed jaw. Category colour, knurled — it is the part you brace
				    against, and it is what pushes the drag start clear of the edge. */}
				<div
					aria-hidden="true"
					className="knurl m-2 mr-0 rounded-md"
					style={{ background: accent, boxShadow: 'inset 0 1px 0 var(--lip-strong)' }}
				/>

				<div ref={trackRef} className="well relative m-2 h-14 overflow-hidden rounded-md">
					<motion.span
						aria-hidden="true"
						className="absolute inset-0 origin-left"
						style={{ background: accent, opacity: flood, scaleX: flood }}
					/>
					{/* The state word sits on whichever side the knob is *not*. Ticked, the
					    knob has travelled right, so the word moves left into the space it
					    left behind — otherwise the confirmation is hidden under the thumb
					    that just produced it. */}
					<span
						aria-hidden="true"
						className={`pointer-events-none absolute inset-y-0 flex items-center gap-1 ${
							done ? 'left-3' : 'right-3'
						}`}
					>
						{done ? (
							<span className="font-mono text-[11px] tracking-wider text-bg uppercase">
								{m.slide_done()}
							</span>
						) : (
							<>
								<ChevronsRight className="size-4 text-ink-faint" strokeWidth={3} />
								<span className="font-mono text-[11px] tracking-wider text-ink-faint uppercase">
									{locked ? m.td_held() : m.slide_todo()}
								</span>
							</>
						)}
					</span>

					<motion.button
						ref={knobRef}
						type="button"
						role="switch"
						aria-checked={checked}
						aria-label={label}
						drag={locked ? false : 'x'}
						dragConstraints={{ left: 0, right: travel }}
						dragElastic={0.04}
						dragMomentum={false}
						onDragStart={() => {
							draggedRef.current = true;
						}}
						onDragEnd={() => {
							const past = travel > 0 && x.get() > travel * COMMIT_AT;
							if (past === checked) animate(x, checked ? travel : 0, SNAP);
							else onChange(past);
							// A drag ends with a click on some engines; swallow exactly one.
							window.setTimeout(() => {
								draggedRef.current = false;
							}, 0);
						}}
						onClick={() => {
							if (draggedRef.current) return;
							toggle();
						}}
						className="knurl absolute top-1 bottom-1 left-1 flex w-[58px] cursor-grab items-center justify-center rounded-[10px] active:cursor-grabbing"
						style={{
							x,
							background: 'linear-gradient(178deg, var(--panel-3), var(--panel))',
							boxShadow:
								'inset 0 1px 0 var(--lip-strong), 0 2px 0 rgba(0,0,0,.7), 0 6px 12px -6px rgba(0,0,0,.9)',
						}}
					>
						{locked ? (
							<Lock className="size-5 text-gold" strokeWidth={2.5} />
						) : done ? (
							<Check className="size-6 text-teal" strokeWidth={3.5} />
						) : (
							<span aria-hidden="true" className="h-6 w-[3px] rounded-full bg-ink-faint" />
						)}
					</motion.button>
				</div>

				<button
					type="button"
					onClick={onInfo}
					aria-label={infoLabel ?? m.show_more()}
					disabled={!onInfo}
					className="m-2 ml-0 flex items-center justify-center rounded-md bg-panel-2 text-ink-dim transition-transform duration-75 active:translate-y-[2px] disabled:opacity-40"
					style={{ boxShadow: 'inset 0 1px 0 var(--lip)' }}
				>
					<span aria-hidden="true" className="font-mono text-[15px] leading-none">
						?
					</span>
				</button>
			</div>
		</div>
	);
}
