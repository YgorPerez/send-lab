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
import { ChevronDown, Pause, Play, RotateCcw } from 'lucide-react';
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

	return (
		<div className="rounded-lg border border-line bg-panel">
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
				<div className="num text-[46px] leading-none font-bold" style={{ color: accent }}>
					{shown}
					<span className="text-[18px] text-ink-faint">s</span>
				</div>
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
