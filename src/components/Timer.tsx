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
	ChevronRight,
	ExternalLink,
	Pause,
	Play,
	RotateCcw,
	SkipBack,
	SkipForward,
} from 'lucide-react';
import {
	type ReactNode,
	type Ref,
	useEffect,
	useEffectEvent,
	useId,
	useImperativeHandle,
	useRef,
	useState,
} from 'react';
import { deliver, releaseCues } from '$lib/cues';
import { clock, shortTime } from '$lib/format';
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
	type Protocol,
	type ProtocolField,
	planCues,
	type Run,
	remainingOf,
	type Segment,
	segmentLengthOf,
	skip,
	step,
	totalOf,
} from '$lib/protocol';
import { formOf, runs, typedValue } from '$lib/screens/timer';
import { usePrefs } from '$lib/store/record';
import { type ClockHome, restored, useTimerSetup } from '$lib/timerSetup';
import { cn } from '$lib/utils';
import { useWakeLock } from '$lib/wakeLock';
import { clockControl, Face, FullScreenClock, SEGMENT_COLOR } from './FullScreenClock';
import { ProtocolRows } from './ProtocolRows';
import { BottomBar } from './ui/primitives';
import { button } from './ui/variants';

const SEGMENT_LABEL: Record<Segment, () => string> = {
	idle: m.timer_ready,
	prepare: m.timer_prepare,
	work: m.timer_work,
	rest: m.timer_rest,
	setRest: m.timer_setrest,
	cooldown: m.timer_cooldown,
	done: m.timer_done,
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

/** How long the whole session has left, `12:34 left` (#129): the one line of
 *  the run's arithmetic the athlete asked back onto the running clock. Always
 *  `m:ss`, so it never reads as the segment's own seconds. */
function timeLeftOf({ left }: Reading): string {
	return m.timer_time_left({ time: clock(left) });
}

/** Whether the time left is worth saying: while underway, but not in the last
 *  segment, where it is the face's own number a second time (#129's critique). */
function leftShown({ run, next }: Reading): boolean {
	return underway(run) && next?.segment !== 'done';
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
	if (leftShown(reading)) parts.push(timeLeftOf(reading));
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

/**
 * The ready state (#110): what the clock is about to run, in the order it runs,
 * and one Start. Tapping a protocol lands here rather than on a number nobody
 * is counting yet, so the shape is read once, on purpose, and then gets out of
 * the way for the whole run.
 */
function Summary({
	config,
	study,
	setup,
}: {
	config: Protocol;
	study: Study | null;
	setup: ReactNode;
}) {
	const grouped = config.rounds > 1 || config.sets > 1;
	const between =
		config.setRest > 0
			? `${m.timer_setrest()} ${shortTime(config.setRest)}`
			: config.sets > 1
				? m.timer_seq_no_setrest()
				: '';
	return (
		<div className="flex flex-col pb-2">
			<p className="mt-4 flex items-baseline gap-2">
				<span className="display text-[64px] leading-[0.9] font-semibold">
					{clock(totalOf(config))}
				</span>
				<span className="text-[14px] font-medium text-ink-dim">{m.timer_in_total()}</span>
			</p>
			<ol className="mt-5 border-t border-line-soft">
				{config.prepare > 0 ? <SummaryRow segment="prepare" seconds={config.prepare} /> : null}
				{grouped ? (
					<li className="flex justify-between gap-3 pt-3.5 pb-1 text-[13px] font-semibold text-ink-dim">
						<span>
							{m.timer_rounds()} {config.rounds} · {m.timer_sets()} {config.sets}
						</span>
						<span>{between}</span>
					</li>
				) : null}
				<SummaryRow segment="work" seconds={config.work} indent={grouped} />
				{config.rest > 0 && config.rounds > 1 ? (
					<SummaryRow segment="rest" seconds={config.rest} indent={grouped} />
				) : null}
				{config.cooldown > 0 ? <SummaryRow segment="cooldown" seconds={config.cooldown} /> : null}
			</ol>
			{study ? <StudyLink study={study} className="mt-4" /> : null}
			{setup}
		</div>
	);
}

/** One segment of the summary: its colour as a mark (a dot carries a colour a
 *  label cannot — `component-vocabulary.md`), its name, its length. */
function SummaryRow({
	segment,
	seconds,
	indent = false,
}: {
	segment: Segment;
	seconds: number;
	indent?: boolean;
}) {
	return (
		<li
			className={cn(
				'flex min-h-[46px] items-center gap-3 border-b border-line-soft text-[15px] font-medium',
				indent && 'pl-3.5',
			)}
		>
			<span
				aria-hidden="true"
				className="size-2.5 shrink-0 rounded-full"
				style={{ background: SEGMENT_COLOR[segment] }}
			/>
			{SEGMENT_LABEL[segment]()}
			<span className="display ml-auto text-[24px] font-semibold">{shortTime(seconds)}</span>
		</li>
	);
}

/**
 * A study a protocol cites: "Study: <title>" and the external-link mark, one way
 * wherever it is linked — the clock's ready state, and the end of each preset
 * group on the Timer list (#119), so the citations read as one system. The
 * mark is the in-text icon (DESIGN.md › Icons: 12px, stroke 2), beside its
 * words, never alone.
 */
export function StudyLink({ study, className }: { study: Study; className?: string }) {
	return (
		<a
			href={study.url}
			target="_blank"
			rel="noopener noreferrer"
			className={cn(
				'flex min-h-11 w-fit items-center self-start py-2 text-[14px] font-medium text-ink-dim hover:text-ink',
				className,
			)}
		>
			<span className="underline decoration-line underline-offset-[3px]">
				{m.timer_study({ title: study.title })}
				<ExternalLink
					size={12}
					strokeWidth={2}
					aria-hidden="true"
					className="ml-1.5 inline align-[-1px]"
				/>
			</span>
		</a>
	);
}

/** A study the protocol cites, as the ready state links it. */
export interface Study {
	title: string;
	url: string;
}

/**
 * The protocol's run in the full-screen clock (`FullScreenClock.tsx`).
 *
 * Asked for directly by the athlete, against Timer Plus: while a hang is running
 * the phone is on the floor or clipped to the board, and the only thing that
 * matters is the number. Everything else on Train — the sets, the targets, the
 * note — goes away entirely rather than shrinking.
 *
 * #110 took the rest of what was left away too. Running, the screen is the
 * segment's colour and says three things: the segment, the seconds, the round
 * and set. Up next, elapsed, left and total all went — the athlete's own
 * answer, in the grill, to "has any of them changed a decision mid-hang?" — and
 * so did the ring, whose job the field now does from further away. Paused, the
 * colour drains: "no colour" is "not running", from across the room.
 *
 * #129 brought one of them back: the session's time left, asked for by the
 * athlete once the clock had been used for real. It sits in the header, left of
 * Close, where the athlete asked for it: out of the face's way and the detail's,
 * a quiet answer to "how long is this", never a second face — so it goes in the
 * last segment, where it would be the face's number twice.
 */
function ProtocolFullScreen({
	open,
	onOpenChange,
	label,
	subtitle,
	reading,
	study,
	setup,
	onToggle,
	onReset,
	onResetAndClose,
	onSkip,
	onBack,
	flash,
	onFlashEnd,
	actions,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	label: string | null;
	subtitle: string | null;
	reading: Reading;
	study: Study | null;
	setup: ReactNode;
	onToggle: () => void;
	onReset: () => void;
	/** The header's Close: the control row's Reset, then closed. */
	onResetAndClose: () => void;
	onSkip: () => void;
	onBack: () => void;
	flash: Flash | null;
	onFlashEnd: () => void;
	actions?: ReactNode;
}) {
	const { run, config, shown, accent, running } = reading;
	const segmentLabel = SEGMENT_LABEL[run.segment]();
	const ready = run.segment === 'idle';
	const field = running ? accent : null;
	const onField = field != null;
	// Resume, not Start, once a run is underway: "Start" mid-protocol read as
	// starting over (#110's critique).
	const toggleLabel = running ? m.btn_pause() : underway(run) ? m.btn_resume() : m.btn_start();

	return (
		<FullScreenClock
			open={open}
			onOpenChange={onOpenChange}
			// Nothing to reset before the start, so the ready state has Back alone.
			onResetAndClose={ready ? undefined : onResetAndClose}
			label={ready ? (label ?? m.timer_title()) : segmentLabel}
			name={ready ? subtitle : null}
			status={{ label: segmentLabel, color: accent }}
			field={field}
			spoken={spokenReading(reading)}
			toggleLabel={toggleLabel}
			onToggle={onToggle}
			announcer={<SegmentAnnouncer reading={reading} />}
			summary={ready ? <Summary config={config} study={study} setup={setup} /> : undefined}
			actions={actions}
			// The flash (#107): a wash over the screen, fading out, so the change is
			// caught from the corner of the eye. On a field the colour change is
			// itself the news, so the wash is the ink — a blink of light over the
			// new colour rather than the new colour over itself. Behind everything
			// else — the popup is its own stacking context, so a negative z-index
			// paints over its background and under the clock — and never in the way
			// of a tap. Decorative: the announcer already says the change.
			layer={
				flash ? (
					<div
						key={flash.n}
						aria-hidden="true"
						data-flash={flash.segment}
						onAnimationEnd={onFlashEnd}
						className="a-flash pointer-events-none fixed inset-0 -z-10"
						style={{
							background: onField ? 'var(--ink)' : SEGMENT_COLOR[flash.segment],
							animationDuration: `${flash.ms}ms`,
						}}
					/>
				) : null
			}
			detail={
				!running && underway(run) ? (
					<>
						<span className="display text-[34px] leading-none font-bold tracking-[0.12em] uppercase">
							{m.timer_paused()}
						</span>
						{counted(run) ? (
							<span className="display text-[28px] leading-none font-semibold tracking-[0.03em] text-ink-dim uppercase">
								{positionOf(reading)}
							</span>
						) : null}
					</>
				) : counted(run) ? (
					<span className="display text-[28px] leading-none font-semibold tracking-[0.03em] uppercase">
						{positionOf(reading)}
					</span>
				) : null
			}
			aside={
				leftShown(reading) ? (
					// Stacked, the word over the number, so it takes the number's width
					// and not the sentence's. Beside it, the widest title it can share
					// the header with is `ENTRE SÉRIES` (131px at 30px), in 170px on a
					// 320px phone or a 640px one on its side; `DESAQUECIMENTO` is the
					// last segment's, where this is gone.
					<span
						className={cn(
							'display flex h-12 shrink-0 flex-col items-end justify-center gap-1 self-start leading-none uppercase',
							!running && 'text-ink-dim',
						)}
					>
						<span className="text-[13px] font-semibold tracking-[0.08em]">{m.timer_left()}</span>
						<span className="text-[24px] font-bold">{clock(reading.left)}</span>
					</span>
				) : null
			}
			// Before the start: one Start. Running: back and skip flank Pause, the
			// order every media control uses, so the one the athlete reaches for is
			// found by direction rather than by reading an icon. Paused: Reset takes
			// skip's place — it only exists while nothing is counting, so a slip
			// from skip mid-hang can no longer throw the run away.
			controls={
				ready ? (
					<button
						type="button"
						onClick={onToggle}
						className={button({
							kind: 'clock',
							size: 'touch',
							class: 'min-h-[60px] w-full rounded-2xl text-[18px] font-semibold',
						})}
					>
						<Play size={20} fill="currentColor" strokeWidth={0} />
						{m.btn_start()}
					</button>
				) : (
					<>
						<button
							type="button"
							aria-label={m.timer_back()}
							onClick={onBack}
							className={clockControl('side', onField)}
						>
							<SkipBack size={24} fill="currentColor" />
						</button>
						<button
							type="button"
							onClick={onToggle}
							className={clockControl('main', onField)}
							style={onField ? { color: field } : undefined}
						>
							{running ? (
								<>
									<Pause size={34} fill="currentColor" strokeWidth={0} aria-hidden="true" />
									<span className="sr-only">{m.btn_pause()}</span>
								</>
							) : (
								<>
									<Play size={22} fill="currentColor" strokeWidth={0} />
									{toggleLabel}
								</>
							)}
						</button>
						{running ? (
							<button
								type="button"
								aria-label={m.timer_skip()}
								onClick={onSkip}
								className={clockControl('side', onField)}
							>
								<SkipForward size={24} fill="currentColor" />
							</button>
						) : (
							<button
								type="button"
								aria-label={m.btn_reset()}
								onClick={onReset}
								className={clockControl('side', onField)}
							>
								<RotateCcw size={24} />
							</button>
						)}
					</>
				)
			}
		>
			<span
				style={onField ? undefined : { color: run.segment === 'done' ? 'var(--ink-dim)' : accent }}
			>
				<Face whole={faceOf(shown).whole} fill className="display leading-[0.8] font-bold" />
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
	strip = 'inline',
	titleSpoken = true,
	study = null,
	title,
	subtitle = null,
	actions,
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
	/** Where the strip goes. Train keeps it in the page, under the app bar
	 *  (`inline`). The Timer screen is only its list (#111), so there it is the
	 *  mini bar at the bottom of the screen, shown only while a run is underway
	 *  (`bar`), or nothing while the stopwatch holds that bar (`none`). */
	strip?: 'inline' | 'bar' | 'none';
	/** Whether the strip, before the start, says "Interval timer" before the
	 *  label — to a screen reader only, since in sight the title cost the label
	 *  the width it truncates in. On a screen that is only the timer it would
	 *  repeat the page's title. */
	titleSpoken?: boolean;
	/** The study the protocol cites, linked from the clock's ready state. */
	study?: Study | null;
	/** What the ready state is titled by, when it is not the label — a preset's
	 *  own name, with its exercise as the subtitle under it rather than welded
	 *  into one three-line heading (#110's finish review). */
	title?: string;
	subtitle?: string | null;
	/** The ready state's header actions: on the Timer screen, the row's ⋯. */
	actions?: ReactNode;
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

	// A finished run is no place to come back to (#111): opening the clock on one
	// lands on its ready state, as opening a protocol never run does. The Done
	// face is only for a clock that is open as the run ends. Set during render, on
	// the change of `clockOpen` itself — React's idiom for state that follows a
	// prop — so the dialog never draws the Done face first.
	const [openSeen, setOpenSeen] = useState(clockOpen);
	if (clockOpen !== openSeen) {
		setOpenSeen(clockOpen);
		if (clockOpen && run.segment === 'done') setRun(IDLE);
	}

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
	};
	const reset = () => {
		setRunning(false);
		setRun(IDLE);
	};
	// The full-screen clock's Close (#131): the run thrown away, then the clock
	// shut. Back, Escape and the system back gesture shut it and keep the run.
	const resetAndClose = () => {
		reset();
		showClock(false);
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
	const { accent, shown } = reading;
	const readingId = useId();
	const nameId = useId();
	// Before the start or after the end: nothing is counting, so the strip says
	// what it will run rather than a number.
	const resting = run.segment === 'idle' || run.segment === 'done';
	// Named by what it runs. On Train the strip also says what it is — "Interval
	// timer" — but to a screen reader only: in sight, the title cost the
	// exercise name the width it truncated in.
	const name = label ?? m.timer_title();

	// The seven numbers, for a protocol the athlete may change — Train's
	// prescription, never a preset. They used to open under the strip, between
	// the clock and the sets the athlete is touching all session; #110 moved them
	// to the clock's ready state, where the shape is already being read, and #112
	// gave them the editor's rows: run order, − / + of 48px, a value to type into.
	//
	// The rows hold text, as the editor's do, so a field being cleared is not a
	// `0` under the cursor; each number reaches the clock the moment it reads as
	// one it can run, and a field that does not says so under its row.
	const [typed, setTyped] = useState(() => formOf('', initial.config).fields);
	const adjust = (f: ProtocolField, text: string) => {
		setTyped((prev) => ({ ...prev, [f]: text }));
		if (runs(f, text)) setConfig((prev) => ({ ...prev, [f]: typedValue(f, text) }));
	};
	// Left unreadable, a value goes back to the number the clock is running, so
	// the row never shows one that Start will not run.
	const settle = (f: ProtocolField) =>
		setTyped((prev) => (runs(f, prev[f]) ? prev : { ...prev, [f]: String(config[f]) }));
	const unreadable = new Set(PROTOCOL_FIELDS.filter((f) => !runs(f, typed[f])));
	// A section of the ready state headed Adjust (#110), open, as the rest of the
	// ready state is: the rows are read with the sequence above them, and a
	// disclosure in front of them was one more thing to find between two hangs.
	// No rule above it: the sequence over it already ends on one.
	const adjustId = useId();
	const setup = editable ? (
		<section aria-labelledby={`${adjustId}-heading`} className="mt-6 flex flex-col gap-1 pb-2">
			<h2 id={`${adjustId}-heading`} className="h-section">
				{m.timer_setup()}
			</h2>
			<ProtocolRows
				id={adjustId}
				fields={typed}
				refused={unreadable}
				onChange={adjust}
				onSettle={settle}
			/>
		</section>
	) : null;

	// Where the run is, in two condensed lines: the segment, and the round and set.
	const position = (
		<span className="flex min-w-0 flex-1 flex-col gap-1.5">
			<span
				className="display truncate text-[17px] leading-none font-bold tracking-[0.05em] uppercase"
				style={running ? undefined : { color: accent }}
			>
				{SEGMENT_LABEL[run.segment]()}
			</span>
			<span
				className={cn(
					'display truncate text-[15px] leading-none font-semibold tracking-[0.03em] uppercase',
					!running && 'text-ink-dim',
				)}
			>
				{counted(run) ? positionOf(reading) : ''}
			</span>
		</span>
	);
	// A fixed slot, right-aligned: `3` and `2:30` end at the same edge, so
	// neither the labels nor the button beside it move as the count crosses ten
	// or a minute (#110's critique: Start jumped 28px).
	const slot = 'display min-w-[5.75rem] shrink-0 text-right text-[56px] leading-[0.9] font-bold';

	// THE STRIP (#110): one line. Running, it is the segment's colour, as the
	// full-screen clock is, so a glance at the top of Train reads the same way a
	// glance at the wall does. Stopped, it is a panel. The number is the way into
	// the full-screen clock — underlined, because a number that opens something
	// has to say so — and before the start the whole name is, landing on the
	// ready state; after the end too, with "Done" under the name and nothing
	// else. Left and total, the shape line and Reset are gone from here in every
	// state (#110): Reset lives on the paused clock, the shape and the total on
	// its ready state.
	//
	// As the Timer screen's mini bar (#111) it is the same line, and the segment,
	// the round and the number are one target back to the clock: there is no
	// list above it to read, and the bar is what a thumb coming back finds.
	const stripBody = (
		<div
			className={cn(
				'flex min-h-[72px] items-center gap-2.5 rounded-2xl py-2 pr-2 pl-4',
				!running && 'border border-line bg-panel',
			)}
			style={running ? { background: accent, color: 'var(--bg)' } : undefined}
		>
			{resting ? (
				// Named for what it does, like the number it stands in for while
				// nothing counts; what it shows — the name and the shape — is in its
				// description, so the label takes nothing away (`component-
				// vocabulary.md`: a label replaces content, it does not add to it).
				<button
					type="button"
					onClick={() => showClock(true)}
					aria-label={m.timer_fullscreen()}
					aria-describedby={`${nameId} ${readingId}`}
					className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left"
				>
					<span id={nameId} className="flex min-w-0 flex-1 flex-col gap-1">
						<span className="truncate text-[15px] font-semibold text-ink">
							{titleSpoken && label ? <span className="sr-only">{m.timer_title()} · </span> : null}
							{name}
						</span>
						{run.segment === 'done' ? (
							<span className="truncate text-[13px] text-ink-dim">{m.timer_done()}</span>
						) : null}
					</span>
					<ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-faint" />
				</button>
			) : strip === 'bar' ? (
				<button
					type="button"
					onClick={() => showClock(true)}
					aria-label={m.timer_fullscreen()}
					aria-describedby={readingId}
					className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch text-left"
				>
					{position}
					<span className={slot} style={running ? undefined : { color: 'var(--ink)' }}>
						{faceOf(shown).whole}
					</span>
				</button>
			) : (
				<>
					{position}
					<button
						type="button"
						onClick={() => showClock(true)}
						aria-label={m.timer_fullscreen()}
						aria-describedby={readingId}
						className={cn(slot, 'underline decoration-2 underline-offset-[6px]')}
						style={running ? undefined : { color: 'var(--ink)' }}
					>
						{faceOf(shown).whole}
					</button>
				</>
			)}
			<button
				type="button"
				onClick={toggle}
				// Underway, the toggle is a 52px square either way — Pause on the
				// field, Resume as the outlined clock control (#118), never filled:
				// on Train the one primary is finish-and-log — so pausing never moves
				// the number beside it. Only before the start, when there is no number, does it
				// carry its word.
				className={
					running
						? 'flex size-[52px] shrink-0 items-center justify-center rounded-[14px] bg-bg'
						: button({
								kind: 'clock',
								size: 'touch',
								class: cn(
									'min-h-[52px] shrink-0 rounded-[14px]',
									resting ? 'px-4' : 'w-[52px] px-0',
								),
							})
				}
				style={running ? { color: accent } : undefined}
			>
				{running ? (
					<>
						<Pause size={22} fill="currentColor" strokeWidth={0} aria-hidden="true" />
						<span className="sr-only">{m.btn_pause()}</span>
					</>
				) : (
					<>
						<Play size={resting ? 16 : 22} fill="currentColor" strokeWidth={0} aria-hidden="true" />
						<span className={resting ? undefined : 'sr-only'}>
							{underway(run) ? m.btn_resume() : m.btn_start()}
						</span>
					</>
				)}
			</button>
		</div>
	);

	return (
		<div>
			<ProtocolFullScreen
				open={clockOpen}
				onOpenChange={showClock}
				label={title ?? label}
				subtitle={subtitle}
				reading={reading}
				study={study}
				setup={setup}
				onToggle={toggle}
				onReset={reset}
				onResetAndClose={resetAndClose}
				onSkip={() => jump(skip)}
				onBack={() => jump(back)}
				flash={flash}
				onFlashEnd={() => setFlash(null)}
				actions={actions}
			/>
			{/* One announcer at a time: while the full-screen clock is up it carries
			    its own, and the strip behind a modal dialog is not read out. */}
			{clockOpen ? null : <SegmentAnnouncer reading={reading} />}
			<p id={readingId} className="sr-only">
				{spokenReading(reading)}
			</p>

			{strip === 'inline' ? stripBody : null}
			{strip === 'bar' && underway(run) ? <BottomBar>{stripBody}</BottomBar> : null}
		</div>
	);
}
