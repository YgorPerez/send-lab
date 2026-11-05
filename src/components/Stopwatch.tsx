// The stopwatch, on the Timer screen's second tab (#108).
//
// The clock's sibling, built the clock's way: the arithmetic is `lib/stopwatch.ts`,
// pure and unit-tested, and this component owns the tick, the wake lock and the
// shape. It has the same two faces as `Timer` — a strip that sits sticky above
// the list, and a full-screen face read from the wall — in the same type, the
// same controls at the same 48px, and the same Dialog for the same reason
// (`Timer.tsx`'s `FullScreenClock`: a sticky `backdrop-blur` ancestor traps a
// fixed overlay). What it does not have is a protocol: no segments, no ring, no
// cues. It counts until the athlete stops it.
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
// Its open state is its own, unlike the clock's: the clock is remounted per
// protocol and its dialog must survive that, while there is one stopwatch and
// nothing remounts it.
import { Dialog } from '@base-ui/react/dialog';
import { Flag, Maximize2, Pause, Play, RotateCcw, X } from 'lucide-react';
import { type Ref, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
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
import type { ClockHandle } from './Timer';
import { Empty, Eyebrow, Section } from './ui/primitives';
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

/** The face: the seconds at full size, the tenth set smaller beside them, as the
 *  clock sets its `s`. */
function Face({ ms, className }: { ms: number; className?: string }) {
	const { whole, fraction } = stopwatchClock(ms, getLocale());
	return (
		<span className={className}>
			{whole}
			<span className="text-[0.5em] text-ink-dim">{fraction}</span>
		</span>
	);
}

/** Ready, running or paused — what the colour beside the number reports. */
function statusOf(watch: Watch): { label: string; color: string } {
	if (watch.running) return { label: m.stopwatch_running(), color: 'var(--ok)' };
	if (watch.elapsed > 0) return { label: m.stopwatch_paused(), color: 'var(--warn)' };
	return { label: m.timer_ready(), color: 'var(--ink-dim)' };
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
}: {
	ref?: Ref<ClockHandle>;
	/** Called on Start, so the screen can pause the protocol clock. */
	onStart?: () => void;
}) {
	// A draft that persists, read once (the vocabulary's second idiom): the count
	// and the laps survive a reload and a trip to another screen, and come back
	// paused. `restoredStopwatch` guarantees the pause.
	const [stored, persist] = useStopwatchDraft();
	const [watch, setWatch] = useState<Watch>(() => restoredStopwatch(stored));
	const [open, setOpen] = useState(false);

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
		setOpen(true);
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
		<div className="flex flex-col gap-6">
			<FullScreenStopwatch
				open={open}
				onOpenChange={setOpen}
				watch={watch}
				status={status}
				current={current}
				laps={laps}
				onToggle={toggle}
				onLap={mark}
				onReset={clear}
			/>
			<LapAnnouncer laps={laps} />

			<div className="sticky top-[44px] z-10 -mx-3 bg-bg/95 px-3 pt-1 pb-2 backdrop-blur">
				<div className="rounded-lg border border-line bg-panel">
					<p id={readingId} className="sr-only">
						{spokenOf(watch)}
					</p>
					<div className="flex items-baseline justify-between gap-2 px-3 pt-2.5">
						<Eyebrow className="min-w-0 truncate">{m.timer_tab_stopwatch()}</Eyebrow>
						<span
							className="num shrink-0 text-[10px] tracking-wider uppercase"
							style={{ color: status.color }}
						>
							{status.label}
						</span>
					</div>

					<div className="flex items-end justify-between gap-3 px-3 pt-1.5">
						<button
							type="button"
							onClick={() => setOpen(true)}
							aria-label={m.stopwatch_fullscreen()}
							aria-describedby={readingId}
							className="text-chalk"
						>
							<Face ms={watch.elapsed} className="num text-[46px] leading-none font-bold" />
						</button>
						<span className="num shrink-0 pb-1 text-right text-[12px] text-ink-faint">
							{m.stopwatch_lap_n({ n: current.n })}{' '}
							<span className="text-ink-dim">{written(current.time)}</span>
						</span>
					</div>

					<div className="flex gap-1.5 px-3 pt-2 pb-2.5">
						<button
							type="button"
							onClick={toggle}
							className={button({
								kind: watch.running ? 'quiet' : 'primary',
								size: 'touch',
								class: 'flex-1',
							})}
						>
							{watch.running ? <Pause size={16} /> : <Play size={16} />}
							{watch.running ? m.btn_pause() : startLabel(watch)}
						</button>
						<button
							type="button"
							onClick={mark}
							disabled={!watch.running}
							className={button({ size: 'touch', class: 'flex-1' })}
						>
							<Flag size={16} />
							{m.stopwatch_lap()}
						</button>
						<button
							type="button"
							aria-label={m.btn_reset()}
							onClick={clear}
							className={button({ size: 'touch', class: 'w-12 px-0' })}
						>
							<RotateCcw size={16} />
						</button>
						<button
							type="button"
							aria-label={m.stopwatch_fullscreen()}
							onClick={() => setOpen(true)}
							className={button({ size: 'touch', class: 'w-12 px-0' })}
						>
							<Maximize2 size={16} />
						</button>
					</div>
				</div>
			</div>

			<Section
				label={m.stopwatch_laps()}
				meta={laps.length > 0 ? <span className="num">{laps.length}</span> : null}
			>
				{laps.length > 0 ? <LapTable laps={laps} /> : <Empty value={m.stopwatch_no_laps()} />}
			</Section>
		</div>
	);
}

/** Every lap marked: its number, its own time, and the total where it ended. */
function LapTable({ laps }: { laps: Lap[] }) {
	return (
		<table className="num w-full text-[13px]">
			<thead>
				<tr className="microlabel border-b border-line-soft text-left">
					<th scope="col" className="py-1.5 font-normal">
						{m.stopwatch_lap()}
					</th>
					<th scope="col" className="py-1.5 text-right font-normal">
						{m.stopwatch_time()}
					</th>
					<th scope="col" className="py-1.5 text-right font-normal">
						{m.timer_total()}
					</th>
				</tr>
			</thead>
			<tbody>
				{laps.map((l) => (
					<tr key={l.n} className="border-b border-line-soft">
						<th scope="row" className="py-2 text-left font-normal text-ink-dim">
							{l.n}
						</th>
						<td className="py-2 text-right text-chalk">{written(l.time)}</td>
						<td className="py-2 text-right text-ink-dim">{written(l.total)}</td>
					</tr>
				))}
			</tbody>
		</table>
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
 * The full-screen face: the count as large as the viewport allows, the lap
 * being timed under it, the last laps marked, and the controls in the clock's
 * row. Tapping the number starts and pauses it, as tapping the clock does.
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
	status: { label: string; color: string };
	current: Lap;
	laps: Lap[];
	onToggle: () => void;
	onLap: () => void;
	onReset: () => void;
}) {
	const readingId = useId();
	// An hour adds three characters; the face steps down rather than overflow.
	const long = watch.elapsed >= 3_600_000;
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Popup
					aria-label={m.timer_tab_stopwatch()}
					className="fixed inset-0 z-50 flex h-dvh w-dvw flex-col bg-bg transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
				>
					<p id={readingId} className="sr-only">
						{spokenOf(watch)}
					</p>
					<div className="flex items-start gap-2 px-4 pt-4">
						<div className="min-w-0 flex-1">
							<Dialog.Title
								className="num text-[13px] tracking-wider uppercase"
								style={{ color: status.color }}
							>
								{status.label}
							</Dialog.Title>
							<p className="eyebrow mt-1 truncate">{m.timer_tab_stopwatch()}</p>
						</div>
						<Dialog.Close
							aria-label={m.btn_close()}
							className={button({ kind: 'quiet', size: 'touch', class: 'size-12 shrink-0 px-0' })}
						>
							<X size={20} />
						</Dialog.Close>
					</div>

					<button
						type="button"
						onClick={onToggle}
						aria-label={watch.running ? m.btn_pause() : startLabel(watch)}
						aria-describedby={readingId}
						className="flex flex-1 flex-col items-center justify-center gap-4 px-4"
					>
						<Face
							ms={watch.elapsed}
							className={
								long
									? 'num text-[min(16vw,14dvh)] leading-none font-bold tabular-nums text-chalk'
									: 'num text-[min(22vw,18dvh)] leading-none font-bold tabular-nums text-chalk'
							}
						/>
						<span className="num text-[15px] text-ink-dim">
							{m.stopwatch_lap_n({ n: current.n })}{' '}
							<span className="text-chalk">{written(current.time)}</span>
						</span>
						{laps.length > 0 ? (
							<span className="num flex flex-col items-center gap-1 text-[14px] text-ink-faint">
								{laps.slice(0, 3).map((l) => (
									<span key={l.n}>
										{m.stopwatch_lap_n({ n: l.n })}{' '}
										<span className="text-ink-dim">{written(l.time)}</span> · {written(l.total)}
									</span>
								))}
							</span>
						) : null}
					</button>

					<div className="flex gap-2 px-4 pb-6">
						<button
							type="button"
							onClick={onToggle}
							className={button({
								kind: watch.running ? 'quiet' : 'primary',
								size: 'touch',
								class: 'h-14 flex-1 text-[17px]',
							})}
						>
							{watch.running ? <Pause size={20} /> : <Play size={20} />}
							{watch.running ? m.btn_pause() : startLabel(watch)}
						</button>
						<button
							type="button"
							onClick={onLap}
							disabled={!watch.running}
							className={button({ size: 'touch', class: 'h-14 flex-1 text-[17px]' })}
						>
							<Flag size={20} />
							{m.stopwatch_lap()}
						</button>
						<button
							type="button"
							aria-label={m.btn_reset()}
							onClick={onReset}
							className={button({ size: 'touch', class: 'h-14 w-14 px-0' })}
						>
							<RotateCcw size={20} />
						</button>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
