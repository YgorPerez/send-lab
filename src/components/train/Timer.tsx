// Chapter I of Train — the rest timer.
//
// The one screen in the app that is read at arm's length, mid-hang, and the one
// place where "one thing at a time" needs no argument: it is a number. Everything
// that configures it — the prepare/work/rest seeds, the round and set counts, the
// total — is true, comes from the fixture, and sits behind one tap, because none
// of it is legible from a hangboard anyway.
//
// No haptics on completion. `navigator.vibrate` exists on the athlete's Android
// device and the athlete declined it as a product decision (#54).
import { useEffect, useMemo, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { TimerFixture } from '../../prototype-fixtures';
import { Chapter, Disclose } from '../Editorial';

type Phase = 'prepare' | 'work' | 'rest' | 'setrest';

interface Step {
	phase: Phase;
	sec: number;
	set: number;
	round: number;
}

const PHASE_LABEL: Record<Phase, () => string> = {
	prepare: () => m.timer_prepare(),
	work: () => m.timer_work(),
	rest: () => m.timer_rest(),
	setrest: () => m.timer_setrest(),
};

/** The whole session, flattened. Expanding it up front means the display never
 *  has to reason about where it is — it reads one step. */
function buildSchedule(t: TimerFixture): Step[] {
	const steps: Step[] = [];
	if (t.prepareSec > 0) steps.push({ phase: 'prepare', sec: t.prepareSec, set: 1, round: 1 });
	for (let set = 1; set <= t.sets; set++) {
		for (let round = 1; round <= t.rounds; round++) {
			steps.push({ phase: 'work', sec: t.workSec, set, round });
			if (t.restSec > 0) steps.push({ phase: 'rest', sec: t.restSec, set, round });
		}
		if (set < t.sets && t.setRestSec > 0) {
			steps.push({ phase: 'setrest', sec: t.setRestSec, set, round: t.rounds });
		}
	}
	return steps;
}

const clock = (sec: number): string =>
	`${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;

function Seed({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="flex items-baseline justify-between gap-4 py-2">
			<span className="text-[13px] text-ink-dim">{label}</span>
			<span className="text-[15px] tabular-nums text-ink">{value}</span>
		</div>
	);
}

export function Timer({ timer, index }: { timer: TimerFixture | null; index: number }) {
	const schedule = useMemo(() => (timer ? buildSchedule(timer) : []), [timer]);
	// Position and remaining seconds are one value, not two. Split across two
	// `useState`s the tick has to read one to update the other, which is what
	// pushed the first draft into a ref mutated during render and a state updater
	// with side effects — both of which `pnpm doctor` fails the build over, and
	// both of which are real bugs under concurrent rendering rather than style.
	const [pos, setPos] = useState<{ at: number; left: number }>(() => ({
		at: 0,
		left: schedule[0]?.sec ?? 0,
	}));
	const [running, setRunning] = useState(false);

	useEffect(() => {
		if (!running) return;
		const id = window.setInterval(() => {
			setPos((p) => {
				if (p.left > 1) return { at: p.at, left: p.left - 1 };
				const next = p.at + 1;
				if (next >= schedule.length) return { at: schedule.length, left: 0 };
				return { at: next, left: schedule[next].sec };
			});
		}, 1000);
		return () => window.clearInterval(id);
	}, [running, schedule]);

	// Running past the end stops the clock. Kept out of the updater above so the
	// updater stays a pure function of its previous value.
	const done = pos.at >= schedule.length;
	useEffect(() => {
		if (done) setRunning(false);
	}, [done]);

	if (!timer) return null;

	const finished = done;
	const step = finished ? null : schedule[pos.at];
	const left = pos.left;
	const label = finished
		? m.timer_done()
		: running || pos.at > 0
			? PHASE_LABEL[step?.phase ?? 'work']()
			: m.timer_ready();

	function reset() {
		setRunning(false);
		setPos({ at: 0, left: schedule[0]?.sec ?? 0 });
	}

	return (
		<Chapter id="timer" index={index} label={m.timer_title()}>
			<p className="c-eyebrow">{timer.label}</p>

			<p
				className="c-eyebrow mt-6"
				style={{ color: step?.phase === 'work' ? 'var(--flag)' : undefined }}
			>
				{label}
			</p>
			<p className="c-numeral mt-2 text-[clamp(4.5rem,26vw,7rem)] text-ink">{clock(left)}</p>

			{step ? (
				<p className="mt-4 text-[15px] text-ink-dim">
					{m.timer_round({ n: step.round, total: timer.rounds })} · {m.timer_sets()} {step.set}/
					{timer.sets}
				</p>
			) : null}

			<div className="mt-10 flex items-center gap-8">
				<button
					type="button"
					onClick={() => (finished ? reset() : setRunning((r) => !r))}
					// The other half of the shared element: the "Train" call to action on
					// `/` carries the same name, so the vermilion block travels between
					// the two screens rather than dissolving.
					className="c-vt-lede bg-flag px-8 py-4 font-display text-[22px] text-primary-foreground"
				>
					{finished ? m.btn_reset() : running ? m.btn_pause() : m.btn_start()}
				</button>
				<button
					type="button"
					onClick={reset}
					className="border-ink-faint border-b font-display text-[17px] text-ink-dim"
				>
					{m.btn_reset()}
				</button>
			</div>

			<div className="mt-12">
				<Disclose label={m.c_details()}>
					<div className="divide-y divide-line border-line border-t border-b">
						<Seed label={m.timer_prepare_s()} value={timer.prepareSec} />
						<Seed label={m.timer_work_s()} value={timer.workSec} />
						<Seed label={m.timer_rest_s()} value={timer.restSec} />
						<Seed label={m.timer_rounds()} value={timer.rounds} />
						<Seed label={m.timer_sets()} value={timer.sets} />
						<Seed label={m.timer_setrest_s()} value={timer.setRestSec} />
						<Seed label={m.timer_total()} value={clock(timer.totalSec)} />
					</div>
				</Disclose>
			</div>
		</Chapter>
	);
}
