// The stopwatch, opened from the first row of the Timer screen's list (#108,
// #111).
//
// The clock's sibling, built the clock's way: the arithmetic is `lib/stopwatch.ts`,
// pure and unit-tested, and this component owns the tick, the wake lock and the
// shape. It has the same two faces as `Timer` — the mini bar at the bottom of
// the list while it counts, and a full-screen face read from the wall — in the
// same type, the same controls at the same 48px, and the very same dialog
// (`FullScreenClock.tsx`, which takes either run). What it does not have is a
// protocol: no segments, no ring, no cues. It counts until the athlete stops it.
//
// THE TICK HANDS IN WHAT PASSED
// -----------------------------
// `tick(watch, ms)` takes the milliseconds since the last time the watch was
// brought up to date, measured on `performance.now()`. A lap and a pause bring
// it up to date first, so the split is where the finger landed rather than
// where the last 100ms interval happened to fire. The instant last accounted
// for is a ref, written in the interval and in the handlers, never during
// render; each updater is handed a number and stays pure.
//
// Its open state is the screen's, as the clock's is: the row that opens it is the
// list's, and the screen is what knows which of its two clocks the bar belongs to.
import { Flag, Pause, Play, RotateCcw } from 'lucide-react';
import { Fragment, type Ref, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { stopwatchClock } from '$lib/format';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import {
	currentLapOf,
	type Lap,
	lap,
	lapsOf,
	pause,
	reset,
	start,
	tick,
	type Stopwatch as Watch,
} from '$lib/stopwatch';
import { restoredStopwatch, useStopwatchDraft } from '$lib/stopwatchDraft';
import { useWakeLock } from '$lib/wakeLock';
import { type ClockStatus, clockControl, Face, FullScreenClock } from './FullScreenClock';
import type { ClockHandle } from './Timer';
import { BottomBar } from './ui/primitives';
import { button } from './ui/variants';

/** How often the face redraws while it runs. Tenths are shown, so a tenth. */
const FRAME_MS = 100;

/** Milliseconds since the watch was last brought up to date — and now it is. */
function sinceAccounted(accountedAt: { current: number }): number {
	const now = performance.now();
	const ms = now - accountedAt.current;
	accountedAt.current = now;
	return ms;
}

/** A reading as one string, for a table cell or a sentence: `1:04.3`. */
function written(ms: number): string {
	const { whole, fraction } = stopwatchClock(ms, getLocale());
	return `${whole}${fraction}`;
}

/** Ready, running or paused: the label's colour, and the digits'.
 *
 *  Neutral, always (#110: "a neutral field and no segment colour"). Teal and
 *  gold here read from the wall as rest and prepare, which a stopwatch never
 *  is. So the state is in the word and in the weight of ink, as on its mini
 *  bar: running, the digits are chalk, the most legible colour there is for the
 *  number being read; paused, they dim, so a face tapped by accident *looks*
 *  paused and does not only say so (#108's review). */
interface Status extends ClockStatus {
	face: string;
}

function statusOf(watch: Watch): Status {
	if (watch.running)
		return { label: m.stopwatch_running(), color: 'var(--ink)', face: 'var(--chalk)' };
	if (watch.elapsed > 0) {
		return { label: m.stopwatch_paused(), color: 'var(--ink)', face: 'var(--ink-dim)' };
	}
	return { label: m.timer_ready(), color: 'var(--ink-dim)', face: 'var(--ink-dim)' };
}

/**
 * Whether Reset is there at all. Not while it runs, and not at zero: a reset
 * takes every lap with it and cannot be undone, and mid-run a thumb is reaching
 * for Lap in the same row (#108's review). Pause first, then reset, which is the
 * order every stopwatch the athlete has used asks for — and the protocol clock's
 * rule (#110), so the two clocks' rows behave alike.
 */
function resettable(watch: Watch): boolean {
	return !watch.running && watch.elapsed > 0;
}

/** What the number says, for whoever cannot see it. */
function spokenOf(watch: Watch): string {
	const current = currentLapOf(watch);
	return m.stopwatch_spoken({
		total: written(watch.elapsed),
		n: current.n,
		lap: written(current.time),
	});
}

/** Start, or Resume once there is a count to resume. */
function startLabel(watch: Watch): string {
	return watch.elapsed > 0 ? m.btn_resume() : m.btn_start();
}

export function Stopwatch({
	ref,
	onStart,
	open,
	onOpenChange,
	bar,
}: {
	ref?: Ref<ClockHandle>;
	/** Called on Start, so the screen can pause the protocol clock. */
	onStart?: () => void;
	/** Whether the full-screen stopwatch is up. */
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Whether the mini bar is the stopwatch's, while it has a count: the screen
	 *  gives it to whichever of its two clocks was started last. */
	bar: boolean;
}) {
	// A draft that persists, read once (the vocabulary's second idiom): the count
	// and the laps survive a reload and a trip to another screen, and come back
	// paused. `restoredStopwatch` guarantees the pause.
	const [stored, persist] = useStopwatchDraft();
	const [watch, setWatch] = useState<Watch>(() => restoredStopwatch(stored));

	// One effect writes. Not on `running`: a pause writes nothing new.
	useEffect(() => {
		persist({ elapsed: watch.elapsed, marks: watch.marks });
	}, [persist, watch.elapsed, watch.marks]);

	const accountedAt = useRef(0);
	useEffect(() => {
		if (!watch.running) return;
		accountedAt.current = performance.now();
		const id = setInterval(() => {
			const ms = sinceAccounted(accountedAt);
			setWatch((s) => tick(s, ms));
		}, FRAME_MS);
		return () => clearInterval(id);
	}, [watch.running]);

	useWakeLock(watch.running);

	const begin = () => {
		setWatch(start);
		onStart?.();
	};
	const hold = () => {
		const ms = sinceAccounted(accountedAt);
		setWatch((s) => pause(tick(s, ms)));
	};
	const mark = () => {
		const ms = sinceAccounted(accountedAt);
		setWatch((s) => lap(tick(s, ms)));
	};
	const clear = () => setWatch(reset);
	const toggle = () => (watch.running ? hold() : begin());
	useImperativeHandle(ref, () => ({ pause: hold }));

	const status = statusOf(watch);
	const current = currentLapOf(watch);
	// Newest first: the lap just marked is the one being compared.
	const laps = lapsOf(watch).reverse();
	const readingId = useId();

	return (
		<div>
			<FullScreenStopwatch
				open={open}
				onOpenChange={onOpenChange}
				watch={watch}
				status={status}
				current={current}
				laps={laps}
				onToggle={toggle}
				onLap={mark}
				onReset={clear}
			/>
			<LapAnnouncer laps={laps} />
			<p id={readingId} className="sr-only">
				{spokenOf(watch)}
			</p>

			{/* THE MINI BAR (#111): the protocol's one line, without a segment to
			    colour it. The stopwatch keeps the panel and no accent at all: on a
			    bar beside the protocol's, teal and gold read as rest and prepare
			    from the wall. Running or paused is said in the word and in the
			    digits' weight of ink. The reading is one target back to the
			    full-screen face; the toggle beside it pauses and resumes without
			    leaving the list. */}
			{bar && (watch.running || watch.elapsed > 0) ? (
				<BottomBar>
					<div className="flex min-h-[72px] items-center gap-2.5 rounded-2xl border border-line bg-panel py-2 pr-2 pl-4">
						<button
							type="button"
							onClick={() => onOpenChange(true)}
							aria-label={m.stopwatch_fullscreen()}
							aria-describedby={readingId}
							className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch text-left"
						>
							<span className="flex min-w-0 flex-1 flex-col gap-1.5">
								<span className="display truncate text-[17px] leading-none font-bold tracking-[0.05em] text-ink uppercase">
									{status.label}
								</span>
								<span className="display truncate text-[15px] leading-none font-semibold tracking-[0.03em] text-ink-dim uppercase">
									{watch.marks.length > 0
										? `${m.stopwatch_lap_n({ n: current.n })} ${written(current.time)}`
										: m.timer_stopwatch()}
								</span>
							</span>
							<span className={watch.running ? 'shrink-0 text-ink' : 'shrink-0 text-ink-dim'}>
								<Face
									{...stopwatchClock(watch.elapsed, getLocale())}
									className="display text-[44px] leading-[0.9] font-bold"
								/>
							</span>
						</button>
						<button
							type="button"
							onClick={toggle}
							// The clock control running and paused alike: the stopwatch has no
							// field, so its bar is always off one (#118).
							className={button({
								kind: 'clock',
								size: 'touch',
								class: 'size-[52px] shrink-0 rounded-[14px] px-0',
							})}
						>
							{watch.running ? (
								<Pause size={22} fill="currentColor" strokeWidth={0} aria-hidden="true" />
							) : (
								<Play size={22} fill="currentColor" strokeWidth={0} aria-hidden="true" />
							)}
							<span className="sr-only">{watch.running ? m.btn_pause() : startLabel(watch)}</span>
						</button>
					</div>
				</BottomBar>
			) : null}
		</div>
	);
}

/** Says a lap once, when it is marked — never the count, which changes ten
 *  times a second and would talk over everything. */
function LapAnnouncer({ laps }: { laps: Lap[] }) {
	const last = laps[0];
	return (
		<p aria-live="polite" className="sr-only">
			{last ? `${m.stopwatch_lap_n({ n: last.n })}: ${written(last.time)}` : ''}
		</p>
	);
}

/**
 * The stopwatch's run in the full-screen clock (`FullScreenClock.tsx`): the
 * count as large as the viewport allows, the lap being timed under it, the last
 * laps marked, and the controls in the clock's row. Tapping the number starts
 * and pauses it, as tapping the clock does.
 */
function FullScreenStopwatch({
	open,
	onOpenChange,
	watch,
	status,
	current,
	laps,
	onToggle,
	onLap,
	onReset,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	watch: Watch;
	status: Status;
	current: Lap;
	laps: Lap[];
	onToggle: () => void;
	onLap: () => void;
	onReset: () => void;
}) {
	const face = stopwatchClock(watch.elapsed, getLocale());
	return (
		<FullScreenClock
			open={open}
			onOpenChange={onOpenChange}
			label={m.timer_stopwatch()}
			status={status}
			name={m.timer_stopwatch()}
			spoken={spokenOf(watch)}
			toggleLabel={watch.running ? m.btn_pause() : startLabel(watch)}
			onToggle={onToggle}
			detail={
				watch.marks.length > 0 ? (
					<>
						<span className="display text-[19px] font-semibold text-ink-dim">
							{m.stopwatch_lap_n({ n: current.n })}{' '}
							<span className="text-chalk">{written(current.time)}</span>
						</span>
						{/* Every lap, newest first, under its own heads so the second
						    number is not left to be guessed at. Three show, and the rest
						    scroll: the strip that used to hold the whole table left with
						    the Timer screen's tabs (#111), so this is the one list. A
						    region a keyboard can reach and scroll, named for what it
						    holds. */}
						<section
							aria-label={m.stopwatch_laps()}
							// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region is reached by keyboard only through a tab stop of its own.
							tabIndex={0}
							className="display grid max-h-[7rem] grid-cols-3 gap-x-6 gap-y-1 overflow-y-auto text-right text-[18px] font-medium text-ink-faint"
						>
							<span className="microlabel sticky top-0 bg-bg text-left">{m.stopwatch_lap()}</span>
							<span className="microlabel sticky top-0 bg-bg">{m.stopwatch_time()}</span>
							<span className="microlabel sticky top-0 bg-bg">{m.timer_total()}</span>
							{laps.map((l) => (
								<Fragment key={l.n}>
									<span className="text-left">{l.n}</span>
									<span className="text-ink-dim">{written(l.time)}</span>
									<span>{written(l.total)}</span>
								</Fragment>
							))}
						</section>
					</>
				) : null
			}
			// The protocol clock's row (#110): the large toggle in the middle, a
			// square either side. Lap on the left, in back's place, there whenever
			// the toggle is. Reset only while paused, in skip's place, as the paused
			// protocol keeps its own (#110: "Reset only exists while paused"); while
			// it counts, and at zero, that place is held empty, so the toggle never
			// moves under the thumb.
			controls={
				<>
					<button
						type="button"
						onClick={onLap}
						disabled={!watch.running}
						aria-label={m.stopwatch_lap()}
						className={clockControl('side', false)}
					>
						<Flag size={24} />
					</button>
					<button type="button" onClick={onToggle} className={clockControl('main', false)}>
						{watch.running ? (
							<Pause size={28} fill="currentColor" strokeWidth={0} />
						) : (
							<Play size={22} fill="currentColor" strokeWidth={0} />
						)}
						{watch.running ? m.btn_pause() : startLabel(watch)}
					</button>
					{resettable(watch) ? (
						<button
							type="button"
							aria-label={m.btn_reset()}
							onClick={onReset}
							className={clockControl('side', false)}
						>
							<RotateCcw size={24} />
						</button>
					) : (
						<span aria-hidden="true" className="size-16 shrink-0" />
					)}
				</>
			}
		>
			{/* No field: the stopwatch is never a segment, so it keeps the ground. */}
			<span style={{ color: status.face }}>
				<Face {...face} fill className="display leading-[0.8] font-bold" />
			</span>
		</FullScreenClock>
	);
}
