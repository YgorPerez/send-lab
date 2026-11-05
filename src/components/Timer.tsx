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
// The protocol arithmetic is `lib/protocol.ts`, pure and unit-tested, and so is
// the choice of which cue each transition fires (`planCues`, under the athlete's
// cue preferences); playing the sounds, the buzz and the voice is `lib/cues.ts`. What is
// left here — the tick, the wake lock, the shape, and drawing the flash the
// planner asks for — is the part that
// genuinely needs a component. See the header of `protocol.ts` for why the split
// is what it is: it is the vocabulary's answer for anything that advances on a
// clock.
//
// The full-screen clock's open state is the *parent's*, not this component's.
// Re-seeding the timer for a different exercise remounts it (the parent keys on
// the protocol), and an open dialog owned here would close on that remount — the
// athlete's rule is that the clock stays up and picks up the new protocol.
import {
	ChevronDown,
	Maximize2,
	Pause,
	Play,
	RotateCcw,
	SkipBack,
	SkipForward,
} from 'lucide-react';
import {
	type Ref,
	useEffect,
	useEffectEvent,
	useId,
	useImperativeHandle,
	useRef,
	useState,
} from 'react';
import { deliver, releaseCues } from '$lib/cues';
import { clock, FIELD_LABEL, protocolShape } from '$lib/format';
import type { ProtocolKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import {
	BLANK_PROTOCOL,
	back,
	beginning,
	elapsedOf,
	IDLE,
	nextOf,
	PROTOCOL_FIELDS,
	PROTOCOL_MINIMUM,
	type Protocol,
	planCues,
	type Run,
	remainingOf,
	type Segment,
	segmentLengthOf,
	skip,
	step,
	totalOf,
} from '$lib/protocol';
import { usePrefs } from '$lib/store/record';
import { type ClockHome, restored, useTimerSetup } from '$lib/timerSetup';
import { cn } from '$lib/utils';
import { useWakeLock } from '$lib/wakeLock';
import { Face, FullScreenClock } from './FullScreenClock';
import { Eyebrow } from './ui/primitives';
import { button, input } from './ui/variants';

const SEGMENT_LABEL: Record<Segment, () => string> = {
	idle: m.timer_ready,
	prepare: m.timer_prepare,
	work: m.timer_work,
	rest: m.timer_rest,
	setRest: m.timer_setrest,
	cooldown: m.timer_cooldown,
	done: m.timer_done,
};

const SEGMENT_COLOR: Record<Segment, string> = {
	idle: 'var(--ink-dim)',
	prepare: 'var(--warn)',
	work: 'var(--stop)',
	rest: 'var(--ok)',
	setRest: 'var(--ok)',
	cooldown: 'var(--cooldown)',
	done: 'var(--ink-dim)',
};

/** A flash the planner asked for (#107), as the clock draws it. `n` counts
 *  them, so a second flash keyed on it starts over rather than continuing the
 *  first one's fade. */
interface Flash {
	segment: Segment;
	ms: number;
	n: number;
}

/**
 * Whether the device asks for reduced motion, read when the cue is planned so a
 * setting changed mid-session reaches the next one. The planner decides what to
 * do about it (ADR 0011); this only reports it. No `matchMedia` — the server, or
 * jsdom — reads as no.
 */
function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

/**
 * The clock face: seconds under a minute, `m:ss` over it.
 *
 * A hang is 7–10s and a set rest is 180s, and both are read from across the
 * room. Three raw digits of "180" is a worse read at that distance than "3:00",
 * and a leading "0:07" is a worse read than "7".
 */
function faceOf(seconds: number): { whole: string; unit?: string } {
	return seconds >= 60 ? { whole: clock(seconds) } : { whole: String(seconds), unit: 's' };
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
		// Before the start, "next" is what the number on the clock is the length
		// of — otherwise an idle `10s` beside `Ready` says nothing about which ten
		// seconds they are (#99's review).
		next: run.segment === 'idle' ? firstOf(config) : nextOf(run, config),
		running,
	};
}

/** The segment a run starts in, and how long it is. */
function firstOf(config: Protocol): { segment: Segment; seconds: number } {
	const { segment, remaining } = beginning(config);
	return { segment, seconds: remaining };
}

/** Whether the run is inside the protocol, rather than before or after it. */
function underway(run: Run): boolean {
	return run.segment !== 'idle' && run.segment !== 'done';
}

/** Whether a round and a set are worth saying. Not during the cooldown (#104):
 *  every round and set is behind the athlete by then, and `Round 8/8 · Set 1/1`
 *  under it reads as still being in the last effort. */
function counted(run: Run): boolean {
	return underway(run) && run.segment !== 'cooldown';
}

/** Where the run is: `Round 3/6 · Set 2/4`. Only while it is underway — before
 *  the start it is a position nobody is in yet (#99's review). */
function positionOf({ run, config }: Reading): string {
	return `${m.timer_round({ n: run.round, total: config.rounds })} · ${m.timer_set({ n: run.set, total: config.sets })}`;
}

/** The seconds on the clock, as words a screen reader says well — `0:07` reads
 *  out as "zero colon zero seven". */
function secondsSpoken(seconds: number): string {
	return seconds >= 60 ? clock(seconds) : m.timer_seconds({ n: seconds });
}

/**
 * The clock, said rather than shown, for whoever cannot see it (spec story 56).
 *
 * The face is a button labelled with what it does, and a label replaces a
 * control's content, so the number inside it was never read out (#99's review).
 * This is the description the face and the strip's number point at instead.
 */
function spokenReading(reading: Reading): string {
	const { run, shown, next } = reading;
	const parts = [`${SEGMENT_LABEL[run.segment]()}, ${secondsSpoken(shown)}`];
	if (counted(run)) parts.push(positionOf(reading));
	if (next) parts.push(`${m.timer_next()}: ${SEGMENT_LABEL[next.segment]()}`);
	return parts.join('. ');
}

/**
 * Announces a segment change, politely, and nothing else.
 *
 * Its text changes only when the segment, round or set does — never with the
 * second — so it speaks at the moments the beep sounds and stays quiet between
 * them. A region that held the countdown would talk over the whole hang.
 */
function SegmentAnnouncer({ reading }: { reading: Reading }) {
	const { run } = reading;
	return (
		<p aria-live="polite" className="sr-only">
			{SEGMENT_LABEL[run.segment]()}
			{counted(run) ? ` · ${positionOf(reading)}` : ''}
		</p>
	);
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
 * The protocol's run in the full-screen clock (`FullScreenClock.tsx`).
 *
 * Asked for directly by the athlete, against Timer Plus: while a hang is running
 * the phone is on the floor or clipped to the board, and the only thing that
 * matters is the number. Everything else on Train — the sets, the targets, the
 * note — goes away entirely rather than shrinking.
 */
function ProtocolFullScreen({
	open,
	onOpenChange,
	label,
	reading,
	onToggle,
	onReset,
	onSkip,
	onBack,
	flash,
	onFlashEnd,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	label: string | null;
	reading: Reading;
	onToggle: () => void;
	onReset: () => void;
	onSkip: () => void;
	onBack: () => void;
	flash: Flash | null;
	onFlashEnd: () => void;
}) {
	const { run, config, shown, segmentLength, accent, left, elapsed, running, next } = reading;
	const segmentLabel = SEGMENT_LABEL[run.segment]();
	const face = faceOf(shown);
	// The ring reports the segment you are in, not the whole session: mid-hang the
	// useful question is "how much of *this* is left", and the session total is
	// already on the lines underneath.
	const R = 46;
	const CIRC = 2 * Math.PI * R;

	return (
		<FullScreenClock
			open={open}
			onOpenChange={onOpenChange}
			label={segmentLabel}
			status={{ label: segmentLabel, color: accent }}
			name={label}
			spoken={spokenReading(reading)}
			toggleLabel={running ? m.btn_pause() : m.btn_start()}
			onToggle={onToggle}
			announcer={<SegmentAnnouncer reading={reading} />}
			// The flash (#107): the whole screen washed in the colour of the segment
			// just arrived in, fading out, so the change is caught from the corner of
			// the eye. Behind everything else — the popup is its own stacking
			// context, so a negative z-index paints over its background and under the
			// clock — and never in the way of a tap. Decorative: the announcer
			// already says the change.
			layer={
				flash ? (
					<div
						key={flash.n}
						aria-hidden="true"
						data-flash={flash.segment}
						onAnimationEnd={onFlashEnd}
						className="a-flash pointer-events-none fixed inset-0 -z-10"
						style={{
							background: SEGMENT_COLOR[flash.segment],
							animationDuration: `${flash.ms}ms`,
						}}
					/>
				) : null
			}
			detail={
				counted(run) || next ? (
					<>
						{/* The indicators, in the order they are asked for mid-session: where am
						    I in the protocol, what comes next, how far through the whole thing am
						    I. The athlete asked for Timer Plus's full set — the prototype had the
						    first line and nothing else. */}
						{counted(run) ? (
							<span className="num flex items-center gap-3 text-[15px] text-ink-dim">
								<span>{m.timer_round({ n: run.round, total: config.rounds })}</span>
								<span className="text-ink-faint">·</span>
								<span>{m.timer_set({ n: run.set, total: config.sets })}</span>
							</span>
						) : null}
						{next ? (
							<span className="num text-[14px] text-ink-faint">
								{m.timer_next()}{' '}
								<span style={{ color: SEGMENT_COLOR[next.segment] }}>
									{SEGMENT_LABEL[next.segment]()}
								</span>
								{next.seconds > 0 ? ` · ${clock(next.seconds)}` : ''}
							</span>
						) : null}
					</>
				) : null
			}
			readout={
				<>
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
				</>
			}
			// Back and skip flank Start, the order every media control uses, so the
			// one the athlete reaches for is found by direction rather than by
			// reading an icon. Reset is kept at the far end, away from skip: a slip
			// from skip onto reset loses the whole session. Before the start there is
			// nothing to jump within, and after the end nothing to skip to, so those
			// are disabled rather than hidden: the row keeps its shape.
			controls={
				<>
					<button
						type="button"
						aria-label={m.timer_back()}
						onClick={onBack}
						disabled={run.segment === 'idle'}
						className={button({ size: 'touch', class: 'h-14 w-14 shrink-0 px-0' })}
					>
						<SkipBack size={20} />
					</button>
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
						aria-label={m.timer_skip()}
						onClick={onSkip}
						disabled={run.segment === 'idle' || run.segment === 'done'}
						className={button({ size: 'touch', class: 'h-14 w-14 shrink-0 px-0' })}
					>
						<SkipForward size={20} />
					</button>
					<button
						type="button"
						aria-label={m.btn_reset()}
						onClick={onReset}
						className={button({ size: 'touch', class: 'ml-2 h-14 w-14 shrink-0 px-0' })}
					>
						<RotateCcw size={20} />
					</button>
				</>
			}
		>
			{/* The ring sets the face's size: `--face` is the share of its inner width
			    a two-glyph reading fills. On its side the screen's height is what
			    runs out, and the ring takes all of it: the lines that sat under it
			    upright are in the right-hand column. */}
			<span className="relative flex items-center justify-center [--face:calc(var(--ring)*0.385)] [--ring:min(78vw,52dvh)] sideways:[--ring:min(44vw,calc(100dvh-2rem))]">
				<svg viewBox="0 0 100 100" aria-hidden="true" className="size-(--ring) -rotate-90">
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
				<Face {...face} fill className="num absolute leading-none font-bold tabular-nums" />
			</span>
		</FullScreenClock>
	);
}

/**
 * What a screen holding two clocks can do to the one it is not looking at: pause
 * it. The Timer screen's rule is that only one of the protocol clock and the
 * stopwatch runs at a time (#108), and the one being started is the one that
 * knows — so it tells the other, through this, from the press itself.
 */
export interface ClockHandle {
	pause: () => void;
}

export function Timer({
	ref,
	onStart,
	home,
	protocol,
	label,
	protocolKey,
	clockOpen,
	onClockOpenChange,
	editable = true,
	openOnStart = false,
	titled = true,
}: {
	ref?: Ref<ClockHandle>;
	/** Called on Start, so the screen can pause whatever else it was running. */
	onStart?: () => void;
	/** Which screen's clock this is. Each screen keeps its own place, so leaving
	 *  one clock for the other never costs either its position (#101). */
	home: ClockHome;
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
	/** Whether the athlete may change the protocol here. A preset may not — it
	 *  is the library's (#101) — so its setup is not offered, and a stored copy
	 *  that disagrees with the library is not restored. */
	editable?: boolean;
	/** Start opens the full-screen clock too. On the Timer screen there is
	 *  nothing else to look at once it runs; on Train the sets are. */
	openOnStart?: boolean;
	/** Whether the strip names itself "Interval timer" before the label. On a
	 *  screen that is only the timer, the title repeats the page's and costs the
	 *  label the width it truncates in. */
	titled?: boolean;
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
	const [storedSetup, persistSetup] = useTimerSetup(home, protocolKey);
	const [initial] = useState(() =>
		restored(storedSetup, protocolKey, protocol ?? BLANK_PROTOCOL, { fixed: !editable }),
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
		persistSetup({ config, run });
	}, [persistSetup, config, run]);

	// The tick. A pure updater over one state object, so there is no stale
	// closure to hold in a ref — see `protocol.ts`. Re-created when the
	// configuration changes, so a field edited mid-session takes effect on the
	// next tick rather than on the next session.
	//
	// A skip or a back starts the second over as well. The interval would
	// otherwise fire on its old schedule, anywhere from a few milliseconds to a
	// second after the jump, and the segment just landed on would lose up to a
	// second of its first count. `jumps` exists only to re-create the interval.
	const [jumps, setJumps] = useState(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `jumps` is read by no line of the effect on purpose; a jump changing it is what re-creates the interval.
	useEffect(() => {
		if (!running) return;
		const id = setInterval(() => setRun((r) => step(r, config)), 1000);
		return () => clearInterval(id);
	}, [running, config, jumps]);

	useEffect(() => {
		if (run.segment === 'done') setRunning(false);
	}, [run.segment]);

	// Cues, derived from the transition rather than fired from inside the tick —
	// a side effect in a state updater is precisely what `react-doctor` fails the
	// gate on, and it would fire twice under StrictMode besides. The ref is
	// written in an effect, never during render.
	//
	// Which cue a transition gets is `planCues`'s decision, not this effect's:
	// it only remembers the run it last saw and plays what the planner returns.
	//
	// The athlete's cue preferences (#105) are read at the moment of the cue, not
	// when the clock mounted, so a change made mid-run is heard on the next beat.
	// They are an effect event and not a dependency on purpose: a dependency
	// would re-run this effect on the change itself, replan the second the clock
	// is already in, and play its countdown beat twice.
	//
	// The flash is the one delivery drawn rather than played, so it comes back
	// here as state for the full-screen clock. A closed clock draws nothing, and
	// opening or closing it drops whatever flash is held (`showClock`), so one
	// planned while the strip was all there was never replays, stale, the moment
	// the clock opens. A flash of no length is over before a frame is drawn,
	// which is what the planner asks for under reduced motion.
	const prefs = usePrefs();
	const [flash, setFlash] = useState<Flash | null>(null);
	const cue = useEffectEvent((from: Run, to: Run, isRunning: boolean) => {
		const planned = planCues(
			{ from, to, running: isRunning, reducedMotion: prefersReducedMotion() },
			prefs,
		);
		deliver(planned, {
			flash: (segment, ms) => {
				if (ms > 0) setFlash((f) => ({ segment, ms, n: (f?.n ?? 0) + 1 }));
			},
		});
	});
	// The run last seen starts as the one the clock opened on, not idle. A clock
	// restored paused mid-protocol has not moved at mount, so the planner hears
	// "no move" and plans nothing; counted from idle it was an arrival, and every
	// return to a screen with a paused draft beeped, buzzed and said the segment
	// (spec stories 32 and 33).
	const previous = useRef<Run>(initial.run);
	useEffect(() => {
		const from = previous.current;
		previous.current = run;
		cue(from, run, running);
	}, [run, running]);

	// Keep the screen on while the clock is counting — not only while the
	// full-screen clock is up. This is the one screen where the athlete is
	// deliberately not touching the phone.
	useWakeLock(running);

	// Hand the audio hardware back when the timer goes away — leaving the context
	// open ducks other audio and shows a media indicator for a timer nobody is
	// running. Re-created lazily on the next cue.
	useEffect(() => releaseCues, []);

	// Every way the full-screen clock opens or closes goes through here.
	const showClock = (open: boolean) => {
		setFlash(null);
		onClockOpenChange(open);
	};

	const start = () => {
		if (run.segment === 'idle' || run.segment === 'done') setRun(beginning(config));
		setRunning(true);
		onStart?.();
		if (openOnStart) showClock(true);
	};
	const reset = () => {
		setRunning(false);
		setRun(IDLE);
	};
	const toggle = () => (running ? setRunning(false) : start());
	useImperativeHandle(ref, () => ({ pause: () => setRunning(false) }), []);
	// Paused stays paused and running stays running: a jump moves the clock and
	// leaves its state alone, so a skip made while paused lands paused.
	const jump = (to: (r: Run, c: Protocol) => Run) => {
		setRun((r) => to(r, config));
		setJumps((n) => n + 1);
	};

	const reading = readingOf(run, config, running);
	const { accent, shown, left, total } = reading;
	const readingId = useId();

	return (
		<div className="rounded-lg border border-line bg-panel">
			<ProtocolFullScreen
				open={clockOpen}
				onOpenChange={showClock}
				label={label}
				reading={reading}
				onToggle={toggle}
				onReset={reset}
				onSkip={() => jump(skip)}
				onBack={() => jump(back)}
				flash={flash}
				onFlashEnd={() => setFlash(null)}
			/>
			{/* One announcer at a time: while the full-screen clock is up it carries
			    its own, and the strip behind a modal dialog is not read out. */}
			{clockOpen ? null : <SegmentAnnouncer reading={reading} />}
			<p id={readingId} className="sr-only">
				{spokenReading(reading)}
			</p>

			<div className="flex items-baseline justify-between gap-2 px-3 pt-2.5">
				<Eyebrow className="min-w-0 truncate">
					{titled || !label ? m.timer_title() : null}
					{label ? (
						<span className="text-ink-dim">
							{titled ? ' · ' : ''}
							{label}
						</span>
					) : null}
				</Eyebrow>
				<span
					className="num shrink-0 text-[10px] tracking-wider uppercase"
					style={{ color: accent }}
				>
					{SEGMENT_LABEL[run.segment]()}
					{counted(run)
						? ` · ${m.timer_round({ n: run.round, total: config.rounds })} · ${run.set}/${config.sets}`
						: ''}
				</span>
			</div>

			<div className="flex items-center gap-3 px-3 py-1.5">
				{/* The number stays tappable — it is the biggest target on the strip and
				    costs nothing to keep — but it is no longer the *only* way in. */}
				<button
					type="button"
					onClick={() => showClock(true)}
					aria-label={m.timer_fullscreen()}
					aria-describedby={readingId}
					style={{ color: accent }}
				>
					<Face {...faceOf(shown)} className="num text-[46px] leading-none font-bold" />
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
							onClick={() => showClock(true)}
							className={button({ size: 'touch', class: 'w-12 px-0' })}
						>
							<Maximize2 size={16} />
						</button>
					</div>
				</div>
			</div>

			{/* The seven configuration fields are collapsed by default.

			    They were always visible, which put a grid of number inputs
			    between the clock and the sets — the thing the athlete is actually
			    touching all session. The protocol comes prescribed, so these are
			    edited once, if at all: "você vai provavelmente tá a maior parte do
			    tempo adicionando métricas". Collapsed, the sticky block loses ~72px
			    and the first exercise card comes up the screen by that much.

			    A summary line replaces them, so the configuration is still *read* at
			    a glance while it is no longer *editable* at a glance. */}
			<div className="flex items-center gap-2 border-t border-line-soft px-3 py-1.5">
				{/* The shape, as the Timer screen's list writes it, rather than four bare
				    numbers nobody could tell apart (#99's review: was `38s · 0s · 1×3`). */}
				<span className="num min-w-0 flex-1 truncate text-[11px] text-ink-faint">
					{protocolShape(config)} · {clock(total)}
				</span>
				{editable ? (
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
				) : null}
			</div>

			{editable && setupOpen ? (
				<div id="timer-setup" className="grid grid-cols-3 gap-1.5 px-3 pb-2">
					{PROTOCOL_FIELDS.map((f) => (
						// The label wraps rather than truncating — pt-BR's
						// "Desaquecimento (s)" is wider than a third of 360px — and sits
						// on the input, so a row's inputs line up under labels of one
						// line and two.
						<label key={f} className="flex min-w-0 flex-col justify-end gap-0.5" htmlFor={`t-${f}`}>
							<span className="microlabel break-words">{FIELD_LABEL[f]()}</span>
							<input
								id={`t-${f}`}
								className={input({ class: 'h-9 py-0' })}
								type="number"
								inputMode="numeric"
								min={PROTOCOL_MINIMUM[f]}
								value={config[f]}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										[f]: Math.max(0, Number.parseInt(e.currentTarget.value, 10) || 0),
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
