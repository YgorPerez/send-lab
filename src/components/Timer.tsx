// The interval timer.
//
// It is the one place this direction allows a big number: 46px, mono, in the
// phase colour. Not because a hero is wanted — the ticket rules that out — but
// because this is the only reading in the app that is looked at from two metres
// away with both hands on a hangboard. Everything around it stays at 10–13px.
//
// It sticks to the top of the Train screen under the app bar, so it stays
// visible while the athlete scrolls to the set they are logging. That is the
// whole reason Train needs its own persistent element and Today does not.
import { Dialog } from '@base-ui/react/dialog';
import { ChevronDown, Maximize2, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils';
import type { TimerFixture } from '../prototype-fixtures';
import { clock } from './format';
import { button, Eyebrow, input } from './ui';

type Phase = 'idle' | 'prepare' | 'work' | 'rest' | 'setRest' | 'done';

const PHASE_LABEL: Record<Phase, () => string> = {
	idle: m.timer_ready,
	prepare: m.timer_prepare,
	work: m.timer_work,
	rest: m.timer_rest,
	setRest: m.timer_setrest,
	done: m.timer_done,
};

const PHASE_COLOR: Record<Phase, string> = {
	idle: 'var(--ink-dim)',
	prepare: 'var(--warn)',
	work: 'var(--stop)',
	rest: 'var(--ok)',
	setRest: 'var(--ok)',
	done: 'var(--ink-dim)',
};

interface Config {
	prepare: number;
	work: number;
	rest: number;
	rounds: number;
	sets: number;
	setRest: number;
}

const FIELDS: { key: keyof Config; label: () => string }[] = [
	{ key: 'prepare', label: m.timer_prepare_s },
	{ key: 'work', label: m.timer_work_s },
	{ key: 'rest', label: m.timer_rest_s },
	{ key: 'rounds', label: m.timer_rounds },
	{ key: 'sets', label: m.timer_sets },
	{ key: 'setRest', label: m.timer_setrest_s },
];

const totalOf = (c: Config) =>
	c.prepare + c.sets * c.rounds * (c.work + c.rest) + Math.max(0, c.sets - 1) * c.setRest;

/** How long the phase currently running lasts, for the ring. Idle and done have
 *  no phase of their own, so they read as a full ring rather than an empty one. */
const phaseLengthOf = (phase: Phase, c: Config): number => {
	switch (phase) {
		case 'prepare':
			return c.prepare;
		case 'work':
			return c.work;
		case 'rest':
			return c.rest;
		case 'setRest':
			return c.setRest;
		default:
			return 0;
	}
};

/** The clock face itself: seconds under a minute, `m:ss` over it.
 *
 *  A hang is 7–10s and a set rest is 180s, and both are read from across the
 *  room. Three raw digits of "180" is a worse read at that distance than "3:00",
 *  and a leading "0:07" is a worse read than "7". */
function Face({ seconds, className }: { seconds: number; className?: string }) {
	if (seconds >= 60) return <span className={className}>{clock(seconds)}</span>;
	return (
		<span className={className}>
			{seconds}
			<span className="text-[0.38em] text-ink-faint">s</span>
		</span>
	);
}

/**
 * The full-screen clock.
 *
 * Asked for directly by the athlete, against Timer Plus: while a hang is
 * running, the phone is on the floor or clipped to the board and the only thing
 * that matters is the number. Everything else on Train — the sets, the targets,
 * the note — is for before and after, so it goes away entirely rather than
 * shrinking.
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
	phase,
	shown,
	phaseLength,
	accent,
	round,
	rounds,
	set,
	sets,
	left,
	running,
	onToggle,
	onReset,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	label: string | null;
	phase: Phase;
	shown: number;
	phaseLength: number;
	accent: string;
	round: number;
	rounds: number;
	set: number;
	sets: number;
	left: number;
	running: boolean;
	onToggle: () => void;
	onReset: () => void;
}) {
	// Keep the screen on while the clock is up and counting. A giant clock that
	// blanks 30 seconds into a hang is worse than no clock, and this is the one
	// screen in the app where the athlete is deliberately not touching the phone.
	// Released on close, on pause, and whenever the tab goes to the background —
	// the lock is dropped by the browser on visibility change either way, so it
	// is re-requested when the page comes back.
	useEffect(() => {
		if (!open || !running) return;
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
	}, [open, running]);

	const phaseLabel = PHASE_LABEL[phase]();
	// The ring reports the phase you are in, not the whole session: mid-hang the
	// useful question is "how much of *this* is left", and the session total is
	// already on the line underneath.
	const R = 46;
	const CIRC = 2 * Math.PI * R;

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Popup
					aria-label={phaseLabel}
					className="fixed inset-0 z-50 flex h-dvh w-dvw flex-col bg-bg transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
				>
					<div className="flex items-start gap-2 px-4 pt-4">
						<div className="min-w-0 flex-1">
							<Dialog.Title
								className="num text-[13px] tracking-wider uppercase"
								style={{ color: accent }}
							>
								{phaseLabel}
							</Dialog.Title>
							{label ? <p className="eyebrow mt-1 truncate">{label}</p> : null}
						</div>
						<Dialog.Close
							aria-label={m.btn_close()}
							className={button({ kind: 'quiet', size: 'md', class: 'size-11 shrink-0 px-0' })}
						>
							<X size={18} />
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
								className="size-[min(78vw,58dvh)] -rotate-90"
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
										phaseLength > 0 ? CIRC * (1 - Math.max(0, shown) / phaseLength) : 0
									}
									style={{ transition: 'stroke-dashoffset 1s linear' }}
								/>
							</svg>
							<Face
								seconds={shown}
								className="num absolute text-[min(30vw,22dvh)] leading-none font-bold tabular-nums"
							/>
						</span>

						<span className="num flex items-center gap-3 text-[15px] text-ink-dim">
							<span>{m.timer_round({ n: round, total: rounds })}</span>
							<span className="text-ink-faint">·</span>
							<span>
								{m.timer_sets()} {set}/{sets}
							</span>
						</span>
						<span className="num text-[13px] text-ink-faint">
							{m.timer_left()} {clock(left)}
						</span>
					</button>

					<div className="flex gap-2 px-4 pb-6">
						<button
							type="button"
							onClick={onToggle}
							className={button({
								kind: running ? 'quiet' : 'primary',
								size: 'lg',
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
							className={button({ size: 'lg', class: 'h-14 w-14 px-0' })}
						>
							<RotateCcw size={20} />
						</button>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

/** Where the session currently is. One object rather than four `useState`s so
 *  the tick is a single pure transition — see `step`. */
interface Run {
	phase: Phase;
	remaining: number;
	round: number;
	set: number;
}

const IDLE: Run = { phase: 'idle', remaining: 0, round: 1, set: 1 };

/** One second of the interval protocol: prepare → (work → rest) × rounds →
 *  set rest → … → done. Pure and module-scoped, so the ticking interval can be
 *  a plain `setRun(step)` with no ref holding a stale closure — which is also
 *  what keeps this out of the "ref mutated during render" trap. */
function step(r: Run, c: Config): Run {
	if (r.remaining > 1) return { ...r, remaining: r.remaining - 1 };
	switch (r.phase) {
		case 'prepare':
			return { ...r, phase: 'work', remaining: c.work };
		case 'work':
			if (r.round < c.rounds) {
				return c.rest > 0
					? { ...r, phase: 'rest', round: r.round + 1, remaining: c.rest }
					: { ...r, phase: 'work', round: r.round + 1, remaining: c.work };
			}
			if (r.set < c.sets) return { ...r, phase: 'setRest', remaining: c.setRest };
			return { ...r, phase: 'done', remaining: 0 };
		case 'rest':
			return { ...r, phase: 'work', remaining: c.work };
		case 'setRest':
			return { phase: 'work', set: r.set + 1, round: 1, remaining: c.work };
		default:
			return r;
	}
}

export function Timer({ seed }: { seed: TimerFixture | null }) {
	const [cfg, setCfg] = useState<Config>(() => ({
		prepare: seed?.prepareSec ?? 10,
		work: seed?.workSec ?? 10,
		rest: seed?.restSec ?? 0,
		rounds: seed?.rounds ?? 1,
		sets: seed?.sets ?? 1,
		setRest: seed?.setRestSec ?? 0,
	}));
	const [run, setRun] = useState<Run>(IDLE);
	const [running, setRunning] = useState(false);
	const [setupOpen, setSetupOpen] = useState(false);
	const [fullOpen, setFullOpen] = useState(false);
	const { phase, remaining, round, set } = run;

	// Re-created when the configuration changes, so a field edited mid-session
	// takes effect on the next tick rather than on the next session.
	useEffect(() => {
		if (!running) return;
		const id = setInterval(() => setRun((r) => step(r, cfg)), 1000);
		return () => clearInterval(id);
	}, [running, cfg]);

	useEffect(() => {
		if (phase === 'done') setRunning(false);
	}, [phase]);

	const start = () => {
		if (phase === 'idle' || phase === 'done') {
			setRun({
				phase: cfg.prepare > 0 ? 'prepare' : 'work',
				remaining: cfg.prepare > 0 ? cfg.prepare : cfg.work,
				round: 1,
				set: 1,
			});
		}
		setRunning(true);
	};
	const reset = () => {
		setRunning(false);
		setRun(IDLE);
	};

	const total = totalOf(cfg);
	// Elapsed is derived rather than counted, so editing a field mid-session
	// cannot desynchronise the bar from the clock.
	const elapsed =
		phase === 'idle'
			? 0
			: phase === 'done'
				? total
				: cfg.prepare +
					(set - 1) * (cfg.rounds * (cfg.work + cfg.rest) + cfg.setRest) +
					(round - 1) * (cfg.work + cfg.rest) +
					(phase === 'rest' ? cfg.work : 0) +
					((phase === 'prepare' ? cfg.prepare : phase === 'work' ? cfg.work : cfg.rest) -
						remaining);
	const left = Math.max(0, total - elapsed);
	const shown = phase === 'idle' ? (cfg.prepare > 0 ? cfg.prepare : cfg.work) : remaining;
	const accent = PHASE_COLOR[phase];
	const toggle = () => (running ? setRunning(false) : start());

	return (
		<div className="rounded-lg border border-line bg-panel">
			<FullScreenClock
				open={fullOpen}
				onOpenChange={setFullOpen}
				label={seed?.label ?? null}
				phase={phase}
				shown={shown}
				phaseLength={phaseLengthOf(phase, cfg)}
				accent={accent}
				round={round}
				rounds={cfg.rounds}
				set={set}
				sets={cfg.sets}
				left={left}
				running={running}
				onToggle={toggle}
				onReset={reset}
			/>

			<div className="flex items-baseline justify-between gap-2 px-3 pt-2.5">
				<Eyebrow className="min-w-0 truncate">
					{m.timer_title()}
					{seed ? <span className="text-ink-dim"> · {seed.label}</span> : null}
				</Eyebrow>
				<span
					className="num shrink-0 text-[10px] tracking-wider uppercase"
					style={{ color: accent }}
				>
					{PHASE_LABEL[phase]()}
					{phase !== 'idle' && phase !== 'done'
						? ` · ${m.timer_round({ n: round, total: cfg.rounds })} · ${set}/${cfg.sets}`
						: ''}
				</span>
			</div>

			<div className="flex items-center gap-3 px-3 py-1.5">
				{/* The inline number is also the way into the full-screen clock. It is
				    the biggest target on the strip and the thing the athlete is already
				    looking at, so it does not need a separate control — but the icon
				    next to it is what makes the affordance discoverable, since a tap
				    target that looks like text does not read as one. */}
				<button
					type="button"
					onClick={() => setFullOpen(true)}
					aria-label={m.timer_fullscreen()}
					className="flex items-center gap-1.5"
					style={{ color: accent }}
				>
					<Face seconds={shown} className="num text-[46px] leading-none font-bold" />
					<Maximize2 size={13} className="shrink-0 text-ink-faint" />
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
					<div className="h-[3px] overflow-hidden rounded-full bg-panel-3">
						<div
							className="h-full rounded-full transition-[width] duration-500"
							style={{ width: `${total > 0 ? (elapsed / total) * 100 : 0}%`, background: accent }}
						/>
					</div>
					<div className="flex gap-1.5">
						<button
							type="button"
							onClick={running ? () => setRunning(false) : start}
							className={button({ kind: running ? 'quiet' : 'primary', class: 'flex-1' })}
						>
							{running ? <Pause size={14} /> : <Play size={14} />}
							{running ? m.btn_pause() : m.btn_start()}
						</button>
						<button
							type="button"
							aria-label={m.btn_reset()}
							onClick={reset}
							className={button({ class: 'w-9 px-0' })}
						>
							<RotateCcw size={14} />
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

			    A summary line replaces them, so the configuration is still *read*
			    at a glance while it is no longer *editable* at a glance. */}
			<div className="flex items-center gap-2 border-t border-line-soft px-3 py-1.5">
				<span className="num min-w-0 flex-1 truncate text-[10.5px] text-ink-faint">
					{cfg.work}s · {cfg.rest}s · {cfg.rounds}×{cfg.sets} · {clock(total)}
				</span>
				<button
					type="button"
					onClick={() => setSetupOpen((v) => !v)}
					aria-expanded={setupOpen}
					aria-controls="timer-setup"
					className={button({ kind: 'bare', class: 'gap-1 px-1 text-[11px]' })}
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
								className={input({ class: 'h-8 py-0' })}
								type="number"
								inputMode="numeric"
								min={0}
								value={cfg[f.key]}
								onChange={(e) =>
									setCfg((prev) => ({
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
