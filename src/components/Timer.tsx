// The interval timer.
//
// It is the one place this direction allows a big number: 46px in the strip, and
// as large as the viewport allows in the full-screen clock. Not because a hero is
// wanted — the ticket rules that out — but because this is the only reading in
// the app looked at from two metres away with both hands on a hangboard.
// Everything around it stays at 10–13px.
//
// It sticks to the top of the Train screen under the app bar, so it stays visible
// while the athlete scrolls to the set they are logging. That is the whole reason
// Train needs its own persistent element and Today does not.
//
// WHAT THIS COMPONENT OWNS, AND WHAT IT DOES NOT
// ----------------------------------------------
// The protocol arithmetic is `lib/protocol.ts`, pure and unit-tested; the
// sounds and the buzz are `lib/cues.ts`. What is left here — the tick, the wake
// lock, and the shape — is the part that genuinely needs a component. See the
// header of `protocol.ts` for why the split is what it is: it is the
// vocabulary's answer for anything that advances on a clock.
//
// The full-screen clock's open state is the *parent's*, not this component's.
// Re-seeding the timer for a different exercise remounts it (the parent keys on
// the protocol), and an open dialog owned here would close on that remount — the
// athlete's rule is that the clock stays up and picks up the new protocol.
import { Dialog } from '@base-ui/react/dialog';
import { ChevronDown, Maximize2, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cue, releaseCues } from '$lib/cues';
import { clock } from '$lib/format';
import type { ProtocolKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import {
	beginning,
	elapsedOf,
	IDLE,
	nextOf,
	type Protocol,
	type Run,
	remainingOf,
	type Segment,
	segmentLengthOf,
	step,
	totalOf,
} from '$lib/protocol';
import { restored, useTimerSetup } from '$lib/timerSetup';
import { cn } from '$lib/utils';
import { Eyebrow } from './ui/primitives';
import { button, input } from './ui/variants';

const SEGMENT_LABEL: Record<Segment, () => string> = {
	idle: m.timer_ready,
	prepare: m.timer_prepare,
	work: m.timer_work,
	rest: m.timer_rest,
	setRest: m.timer_setrest,
	done: m.timer_done,
};

const SEGMENT_COLOR: Record<Segment, string> = {
	idle: 'var(--ink-dim)',
	prepare: 'var(--warn)',
	work: 'var(--stop)',
	rest: 'var(--ok)',
	setRest: 'var(--ok)',
	done: 'var(--ink-dim)',
};

/** Which cue announces arriving in a segment. Mirrors the SvelteKit app exactly. */
const SEGMENT_CUE = {
	idle: null,
	prepare: 'start',
	work: 'work',
	rest: 'rest',
	setRest: 'setRest',
	done: 'done',
} as const;

const FIELDS: { key: keyof Protocol; label: () => string }[] = [
	{ key: 'prepare', label: m.timer_prepare_s },
	{ key: 'work', label: m.timer_work_s },
	{ key: 'rest', label: m.timer_rest_s },
	{ key: 'rounds', label: m.timer_rounds },
	{ key: 'sets', label: m.timer_sets },
	{ key: 'setRest', label: m.timer_setrest_s },
];

/** The last seconds of a segment get their own cue, the way Timer Plus counts in. */
const COUNTDOWN_FROM = 3;

/**
 * The clock face: seconds under a minute, `m:ss` over it.
 *
 * A hang is 7–10s and a set rest is 180s, and both are read from across the
 * room. Three raw digits of "180" is a worse read at that distance than "3:00",
 * and a leading "0:07" is a worse read than "7".
 */
function Face({ seconds, className }: { seconds: number; className?: string }) {
	if (seconds >= 60) return <span className={className}>{clock(seconds)}</span>;
	return (
		<span className={className}>
			{seconds}
			<span className="text-[0.38em] text-ink-faint">s</span>
		</span>
	);
}

/** Everything the two faces of the timer both read off the run. */
interface Reading {
	run: Run;
	config: Protocol;
	/** The number on the clock — the prepare or work length while idle. */
	shown: number;
	segmentLength: number;
	elapsed: number;
	left: number;
	total: number;
	accent: string;
	next: { segment: Segment; seconds: number } | null;
	running: boolean;
}

function readingOf(run: Run, config: Protocol, running: boolean): Reading {
	return {
		run,
		config,
		shown:
			run.segment === 'idle' ? (config.prepare > 0 ? config.prepare : config.work) : run.remaining,
		segmentLength: segmentLengthOf(run, config),
		elapsed: elapsedOf(run, config),
		left: remainingOf(run, config),
		total: totalOf(config),
		accent: SEGMENT_COLOR[run.segment],
		next: nextOf(run, config),
		running,
	};
}

/** Session progress, under both clocks. */
function ProgressBar({ reading }: { reading: Reading }) {
	const { elapsed, total, accent } = reading;
	return (
		<div className="h-[3px] overflow-hidden rounded-full bg-panel-3">
			<div
				className="h-full rounded-full transition-[width] duration-500"
				style={{ width: `${total > 0 ? (elapsed / total) * 100 : 0}%`, background: accent }}
			/>
		</div>
	);
}

/**
 * The full-screen clock.
 *
 * Asked for directly by the athlete, against Timer Plus: while a hang is running
 * the phone is on the floor or clipped to the board, and the only thing that
 * matters is the number. Everything else on Train — the sets, the targets, the
 * note — goes away entirely rather than shrinking.
 *
 * It is a Dialog rather than a `position: fixed` div because the timer lives
 * inside Train's sticky header, and that header carries `backdrop-blur`: a
 * `backdrop-filter` ancestor becomes the containing block for fixed descendants,
 * so a plain overlay would have been trapped inside a 120px-tall strip. The
 * portal also brings the focus trap and Escape handling for free.
 */
function FullScreenClock({
	open,
	onOpenChange,
	label,
	reading,
	onToggle,
	onReset,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	label: string | null;
	reading: Reading;
	onToggle: () => void;
	onReset: () => void;
}) {
	const { run, config, shown, segmentLength, accent, left, elapsed, running, next } = reading;
	const segmentLabel = SEGMENT_LABEL[run.segment]();
	// The ring reports the segment you are in, not the whole session: mid-hang the
	// useful question is "how much of *this* is left", and the session total is
	// already on the lines underneath.
	const R = 46;
	const CIRC = 2 * Math.PI * R;

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Popup
					aria-label={segmentLabel}
					className="fixed inset-0 z-50 flex h-dvh w-dvw flex-col bg-bg transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
				>
					<div className="flex items-start gap-2 px-4 pt-4">
						<div className="min-w-0 flex-1">
							<Dialog.Title
								className="num text-[13px] tracking-wider uppercase"
								style={{ color: accent }}
							>
								{segmentLabel}
							</Dialog.Title>
							{label ? <p className="eyebrow mt-1 truncate">{label}</p> : null}
						</div>
						<Dialog.Close
							aria-label={m.btn_close()}
							className={button({ kind: 'quiet', size: 'touch', class: 'size-12 shrink-0 px-0' })}
						>
							<X size={20} />
						</Dialog.Close>
					</div>

					{/* The clock. Tapping it starts and pauses — the whole point is not
					    having to find a control with chalky hands — and the buttons
					    underneath are the tappable equivalent for anyone who does not
					    discover that, since a gesture is never the only way in. */}
					<button
						type="button"
						onClick={onToggle}
						aria-label={running ? m.btn_pause() : m.btn_start()}
						className="relative flex flex-1 flex-col items-center justify-center gap-4 px-4"
					>
						<span className="relative flex items-center justify-center">
							<svg
								viewBox="0 0 100 100"
								aria-hidden="true"
								className="size-[min(78vw,52dvh)] -rotate-90"
							>
								<circle cx="50" cy="50" r={R} fill="none" stroke="var(--panel-2)" strokeWidth="3" />
								<circle
									cx="50"
									cy="50"
									r={R}
									fill="none"
									stroke={accent}
									strokeWidth="3"
									strokeLinecap="round"
									strokeDasharray={CIRC}
									strokeDashoffset={
										segmentLength > 0 ? CIRC * (1 - Math.max(0, shown) / segmentLength) : 0
									}
									style={{ transition: 'stroke-dashoffset 1s linear' }}
								/>
							</svg>
							<Face
								seconds={shown}
								className="num absolute text-[min(30vw,20dvh)] leading-none font-bold tabular-nums"
							/>
						</span>

						{/* The indicators, in the order they are asked for mid-session:
						    where am I in the protocol, what comes next, how far through the
						    whole thing am I. The athlete asked for Timer Plus's full set —
						    the prototype had the first line and nothing else. */}
						<span className="num flex items-center gap-3 text-[15px] text-ink-dim">
							<span>{m.timer_round({ n: run.round, total: config.rounds })}</span>
							<span className="text-ink-faint">·</span>
							<span>
								{m.timer_sets()} {run.set}/{config.sets}
							</span>
						</span>
						{next ? (
							<span className="num text-[14px] text-ink-faint">
								{m.timer_next()}{' '}
								<span style={{ color: SEGMENT_COLOR[next.segment] }}>
									{SEGMENT_LABEL[next.segment]()}
								</span>
								{next.seconds > 0 ? ` · ${clock(next.seconds)}` : ''}
							</span>
						) : null}
					</button>

					<div className="flex flex-col gap-2 px-4 pb-6">
						<div className="num flex justify-between text-[12px] text-ink-faint">
							<span>
								{m.timer_elapsed()} <span className="text-ink-dim">{clock(elapsed)}</span>
							</span>
							<span>
								{m.timer_left()} <span className="text-chalk">{clock(left)}</span>
							</span>
							<span>
								{m.timer_total()} {clock(reading.total)}
							</span>
						</div>
						<ProgressBar reading={reading} />
						<div className="mt-1 flex gap-2">
							<button
								type="button"
								onClick={onToggle}
								className={button({
									kind: running ? 'quiet' : 'primary',
									size: 'touch',
									class: 'h-14 flex-1 text-[17px]',
								})}
							>
								{running ? <Pause size={20} /> : <Play size={20} />}
								{running ? m.btn_pause() : m.btn_start()}
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
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export function Timer({
	protocol,
	label,
	protocolKey,
	clockOpen,
	onClockOpenChange,
}: {
	protocol: Protocol | null;
	/** The exercise this protocol came from, shown beside the title. Passed
	 *  beside the protocol rather than welded into it: it is a localized display
	 *  string, and a domain type that carries one is a domain type that can be
	 *  stored with one (ADR 0012). */
	label: string | null;
	/** What the persisted setup is scoped to — the pinned task and its variant.
	 *  The parent already computes it as this component's remount boundary, so it
	 *  is passed rather than re-derived: two spellings of "which protocol is this"
	 *  is how a restore lands on the wrong exercise. */
	protocolKey: ProtocolKey;
	/** Owned by the parent so re-seeding does not close the clock. */
	clockOpen: boolean;
	onClockOpenChange: (open: boolean) => void;
}) {
	// A DRAFT THAT PERSISTS, applied to a clock (#59). The setup and the athlete's
	// place in it survive a reload — which on Android is not a rare event, since
	// pull-to-refresh fires a real one in the installed app (#54).
	//
	// Read **once, in a lazy initialiser**, exactly as the readiness draft is: the
	// stored value is a starting point, not a second source of truth. `run` and
	// `config` are React state from here on, because `run` changes every second
	// and a clock that read its own position back out of storage would be racing
	// its own writes. The write is one effect, below.
	const [storedSetup, persistSetup] = useTimerSetup();
	const [initial] = useState(() =>
		restored(storedSetup, protocolKey, {
			prepare: protocol?.prepare ?? 10,
			work: protocol?.work ?? 10,
			rest: protocol?.rest ?? 0,
			rounds: protocol?.rounds ?? 1,
			sets: protocol?.sets ?? 1,
			setRest: protocol?.setRest ?? 0,
		}),
	);
	const [config, setConfig] = useState<Protocol>(initial.config);
	const [run, setRun] = useState<Run>(initial.run);
	// Always starts paused, whatever was stored — `restored()` guarantees it, and
	// `timerSetup.ts` documents why: nothing here knows how long the reload took.
	const [running, setRunning] = useState<boolean>(initial.running);
	const [setupOpen, setSetupOpen] = useState(false);

	// One effect writes, keyed on the value — the same half of the idiom the
	// readiness draft uses, and for the same reason: a save at each setter is how
	// one gets forgotten at the third call site, and this component has four
	// (`start`, `reset`, the tick, and the setup dialog).
	//
	// `running` is deliberately not in the stored shape, so pausing writes
	// nothing and the write happens once per tick rather than twice.
	useEffect(() => {
		persistSetup(protocolKey, { config, run });
	}, [persistSetup, protocolKey, config, run]);

	// The tick. A pure updater over one state object, so there is no stale
	// closure to hold in a ref — see `protocol.ts`. Re-created when the
	// configuration changes, so a field edited mid-session takes effect on the
	// next tick rather than on the next session.
	useEffect(() => {
		if (!running) return;
		const id = setInterval(() => setRun((r) => step(r, config)), 1000);
		return () => clearInterval(id);
	}, [running, config]);

	useEffect(() => {
		if (run.segment === 'done') setRunning(false);
	}, [run.segment]);

	// Cues, derived from the transition rather than fired from inside the tick —
	// a side effect in a state updater is precisely what `react-doctor` fails the
	// gate on, and it would fire twice under StrictMode besides. The ref is
	// written in an effect, never during render.
	const previous = useRef<Run>(IDLE);
	useEffect(() => {
		const before = previous.current;
		previous.current = run;
		if (before.segment === run.segment && before.round === run.round && before.set === run.set) {
			if (running && run.remaining > 0 && run.remaining <= COUNTDOWN_FROM) cue('countdown');
			return;
		}
		// Prepare handing over to work is the one transition that gets its own
		// two-note cue: it is the moment the athlete has to move, and a single beep
		// identical to every other single beep is not enough to act on blind.
		const name =
			before.segment === 'prepare' && run.segment === 'work' ? 'go' : SEGMENT_CUE[run.segment];
		if (name) cue(name);
	}, [run, running]);

	// Keep the screen on while the clock is counting — not only while the
	// full-screen clock is up. This is the one screen where the athlete is
	// deliberately not touching the phone, and a display that blanks 30 seconds
	// into a hang is worse than no clock at all. The browser drops the lock on
	// visibility change either way, so it is re-requested when the page returns.
	useEffect(() => {
		if (!running) return;
		const nav = navigator as Navigator & {
			wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
		};
		if (!nav.wakeLock) return;
		let sentinel: { release: () => Promise<void> } | null = null;
		let cancelled = false;
		const acquire = () => {
			nav.wakeLock
				?.request('screen')
				.then((s) => {
					if (cancelled) void s.release();
					else sentinel = s;
				})
				// Denied or unsupported. Nothing to do and nothing worth telling the
				// athlete: the clock still runs, the screen just times out as usual.
				.catch(() => {});
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') acquire();
		};
		acquire();
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			cancelled = true;
			document.removeEventListener('visibilitychange', onVisible);
			void sentinel?.release();
		};
	}, [running]);

	// Hand the audio hardware back when the timer goes away — leaving the context
	// open ducks other audio and shows a media indicator for a timer nobody is
	// running. Re-created lazily on the next cue.
	useEffect(() => releaseCues, []);

	const start = () => {
		if (run.segment === 'idle' || run.segment === 'done') setRun(beginning(config));
		setRunning(true);
	};
	const reset = () => {
		setRunning(false);
		setRun(IDLE);
	};
	const toggle = () => (running ? setRunning(false) : start());

	const reading = readingOf(run, config, running);
	const { accent, shown, left, total } = reading;

	return (
		<div className="rounded-lg border border-line bg-panel">
			<FullScreenClock
				open={clockOpen}
				onOpenChange={onClockOpenChange}
				label={label}
				reading={reading}
				onToggle={toggle}
				onReset={reset}
			/>

			<div className="flex items-baseline justify-between gap-2 px-3 pt-2.5">
				<Eyebrow className="min-w-0 truncate">
					{m.timer_title()}
					{label ? <span className="text-ink-dim"> · {label}</span> : null}
				</Eyebrow>
				<span
					className="num shrink-0 text-[10px] tracking-wider uppercase"
					style={{ color: accent }}
				>
					{SEGMENT_LABEL[run.segment]()}
					{run.segment !== 'idle' && run.segment !== 'done'
						? ` · ${m.timer_round({ n: run.round, total: config.rounds })} · ${run.set}/${config.sets}`
						: ''}
				</span>
			</div>

			<div className="flex items-center gap-3 px-3 py-1.5">
				{/* The number stays tappable — it is the biggest target on the strip and
				    costs nothing to keep — but it is no longer the *only* way in. */}
				<button
					type="button"
					onClick={() => onClockOpenChange(true)}
					aria-label={m.timer_fullscreen()}
					style={{ color: accent }}
				>
					<Face seconds={shown} className="num text-[46px] leading-none font-bold" />
				</button>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<div className="num flex justify-between text-[10px] text-ink-faint">
						<span>
							{m.timer_left()} <span className="text-chalk">{clock(left)}</span>
						</span>
						<span>
							{m.timer_total()} {clock(total)}
						</span>
					</div>
					<ProgressBar reading={reading} />
					<div className="flex gap-1.5">
						<button
							type="button"
							onClick={toggle}
							className={button({
								kind: running ? 'quiet' : 'primary',
								size: 'touch',
								class: 'flex-1',
							})}
						>
							{running ? <Pause size={16} /> : <Play size={16} />}
							{running ? m.btn_pause() : m.btn_start()}
						</button>
						<button
							type="button"
							aria-label={m.btn_reset()}
							onClick={reset}
							className={button({ size: 'touch', class: 'w-12 px-0' })}
						>
							<RotateCcw size={16} />
						</button>
						{/* Full screen sits with the other controls, not beside the number.
						    It was a 13px icon next to a 46px digit and the athlete could not
						    find it — which is the answer to "where does it open?": a tap
						    target that small, next to something that large, reads as
						    decoration on the number rather than as a button of its own.
						    Same size and shape as Reset, in the row the thumb is already in,
						    and at 48px since the athlete asked for it. */}
						<button
							type="button"
							aria-label={m.timer_fullscreen()}
							onClick={() => onClockOpenChange(true)}
							className={button({ size: 'touch', class: 'w-12 px-0' })}
						>
							<Maximize2 size={16} />
						</button>
					</div>
				</div>
			</div>

			{/* The six configuration fields are collapsed by default.

			    They were always visible, which put a 3×2 grid of number inputs
			    between the clock and the sets — the thing the athlete is actually
			    touching all session. The protocol comes prescribed, so these are
			    edited once, if at all: "você vai provavelmente tá a maior parte do
			    tempo adicionando métricas". Collapsed, the sticky block loses ~72px
			    and the first exercise card comes up the screen by that much.

			    A summary line replaces them, so the configuration is still *read* at
			    a glance while it is no longer *editable* at a glance. */}
			<div className="flex items-center gap-2 border-t border-line-soft px-3 py-1.5">
				<span className="num min-w-0 flex-1 truncate text-[10.5px] text-ink-faint">
					{config.work}s · {config.rest}s · {config.rounds}×{config.sets} · {clock(total)}
				</span>
				<button
					type="button"
					onClick={() => setSetupOpen((v) => !v)}
					aria-expanded={setupOpen}
					aria-controls="timer-setup"
					className={button({ kind: 'bare', size: 'md', class: 'gap-1 px-1 text-[11px]' })}
				>
					{m.timer_setup()}
					<ChevronDown
						size={13}
						className={cn('transition-transform', setupOpen && 'rotate-180')}
					/>
				</button>
			</div>

			{setupOpen ? (
				<div id="timer-setup" className="grid grid-cols-3 gap-1.5 px-3 pb-2">
					{FIELDS.map((f) => (
						<label key={f.key} className="flex min-w-0 flex-col gap-0.5" htmlFor={`t-${f.key}`}>
							<span className="microlabel truncate">{f.label()}</span>
							<input
								id={`t-${f.key}`}
								className={input({ class: 'h-9 py-0' })}
								type="number"
								inputMode="numeric"
								min={0}
								value={config[f.key]}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										[f.key]: Math.max(0, Number.parseInt(e.currentTarget.value, 10) || 0),
									}))
								}
							/>
						</label>
					))}
				</div>
			) : null}
		</div>
	);
}
