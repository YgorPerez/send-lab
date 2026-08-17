// The rest timer, as the instrument's primary readout.
//
// It is the one thing on `/train` an athlete looks at from two metres away with
// their hands on a hangboard, so it gets the largest numeral in the app (64px
// mono) and the only inverted ground. Everything else on the screen is a
// hairline; this is the needle.
//
// The interval schedule is expanded from the fixture's `TimerFixture` into a
// flat list of segments up front, rather than being tracked as
// phase/round/set counters ticking against each other. One list means the
// display, the total-remaining and the scrub-to-reset all read the same
// structure, and an off-by-one in the last set rest is impossible.

import { useEffect, useMemo, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { TimerFixture } from '../prototype-fixtures';
import { Bench, KV, Lbl } from './kit';

type SegmentKind = 'prepare' | 'work' | 'rest' | 'setrest';

interface Segment {
	id: string;
	kind: SegmentKind;
	sec: number;
	round: number;
	rounds: number;
}

function expand(t: TimerFixture): Segment[] {
	const out: Segment[] = [];
	if (t.prepareSec > 0) {
		out.push({ id: 'prep', kind: 'prepare', sec: t.prepareSec, round: 0, rounds: t.rounds });
	}
	for (let s = 1; s <= t.sets; s++) {
		for (let r = 1; r <= t.rounds; r++) {
			out.push({ id: `w${s}-${r}`, kind: 'work', sec: t.workSec, round: r, rounds: t.rounds });
			if (t.restSec > 0 && r < t.rounds) {
				out.push({ id: `r${s}-${r}`, kind: 'rest', sec: t.restSec, round: r, rounds: t.rounds });
			}
		}
		if (t.setRestSec > 0 && s < t.sets) {
			out.push({
				id: `sr${s}`,
				kind: 'setrest',
				sec: t.setRestSec,
				round: t.rounds,
				rounds: t.rounds,
			});
		}
	}
	return out;
}

const KIND_LABEL: Record<SegmentKind, () => string> = {
	prepare: m.timer_prepare,
	work: m.timer_work,
	rest: m.timer_rest,
	setrest: m.timer_setrest,
};

function clock(sec: number): string {
	const s = Math.max(0, Math.ceil(sec));
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function Timer({ timer }: { timer: TimerFixture }) {
	const segments = useMemo(() => expand(timer), [timer]);
	const [elapsed, setElapsed] = useState(0);
	const [running, setRunning] = useState(false);

	useEffect(() => {
		if (!running) return;
		const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
		return () => window.clearInterval(id);
	}, [running]);

	useEffect(() => {
		if (elapsed >= timer.totalSec) setRunning(false);
	}, [elapsed, timer.totalSec]);

	// Walk the schedule to find where `elapsed` lands.
	let acc = 0;
	let current: Segment | null = null;
	let intoSegment = 0;
	for (const seg of segments) {
		if (elapsed < acc + seg.sec) {
			current = seg;
			intoSegment = elapsed - acc;
			break;
		}
		acc += seg.sec;
	}

	const remaining = current === null ? 0 : current.sec - intoSegment;
	const phase =
		current === null
			? m.timer_done()
			: elapsed === 0 && !running
				? m.timer_ready()
				: KIND_LABEL[current.kind]();

	return (
		<div>
			{/* The readout. Inverted so it survives a phone held at arm's length in
			    a gym, which is the one time this app is not being looked at. */}
			<div className="flex items-end gap-3 bg-ink px-3 py-3 text-bg">
				<span className="num text-[64px] leading-none tracking-[-0.04em]">{clock(remaining)}</span>
				<div className="min-w-0 flex-1 pb-1 text-right">
					<span className="lbl block text-bg opacity-70">{phase}</span>
					{current && current.kind === 'work' ? (
						<span className="num text-[13px]">
							{m.timer_round({ n: current.round, total: current.rounds })}
						</span>
					) : null}
				</div>
			</div>

			<div className="flex items-center gap-2 border-line border-b px-3 py-2">
				<Bench kind={running ? 'plain' : 'solid'} onClick={() => setRunning((r) => !r)}>
					{running ? m.btn_pause() : m.btn_start()}
				</Bench>
				<Bench
					onClick={() => {
						setRunning(false);
						setElapsed(0);
					}}
				>
					{m.btn_reset()}
				</Bench>
				<div className="ml-auto text-right">
					<Lbl className="block text-ink-faint">{m.timer_left()}</Lbl>
					<span className="num text-[15px] text-ink">{clock(timer.totalSec - elapsed)}</span>
				</div>
			</div>

			{/* The schedule as parameters, the way a bench box prints its settings. */}
			<div className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2">
				<KV k={m.timer_prepare_s()} v={timer.prepareSec} />
				<KV k={m.timer_work_s()} v={timer.workSec} />
				<KV k={m.timer_rest_s()} v={timer.restSec} />
				<KV k={m.timer_rounds()} v={timer.rounds} />
				<KV k={m.timer_sets()} v={timer.sets} />
				<KV k={m.timer_setrest_s()} v={timer.setRestSec} />
				<KV k={m.timer_total()} v={clock(timer.totalSec)} />
				<KV k={m.timer_use()} v={timer.label} />
			</div>
		</div>
	);
}
