// TRAIN — Direction D.
//
// The screen the direction was designed for: used mid-set, one-handed, breathing
// hard. Two consequences run through it.
//
// 1. The timer is the biggest object on the screen and never moves. It is a
//    machine face — sunk, mono, one number the size of a fist — because it is
//    read from the floor, at arm's length, upside down.
// 2. The set row is where the direction's sizes stop being free. Seven loggable
//    fields at a 16px minimum font (the iOS zoom guard) will not sit on one line
//    at 360px, so a set becomes a *block* of three-across field wells rather than
//    a row. It costs vertical space and it is the honest trade: see the ticket.
//
// The per-set tick is a square slab, not a Latch. A latch needs ~230px of track
// to be worth dragging and a set row cannot spare it — the gesture survives at
// task granularity (Today) and does not survive at set granularity. Also on the
// ticket.
import { createFileRoute } from '@tanstack/react-router';
import { Check, Pause, Play, Plus, Repeat, RotateCcw, Shuffle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Range } from '$lib/content/types';
import * as m from '$lib/paraglide/messages';
import type { WorkoutSet } from '$lib/types';
import { bigButton, Head, Panel, pill, Rich } from '../components/physical';
import { Sheet } from '../components/Sheet';
import {
	getPrototypeFixtures,
	type SetField,
	type TimerFixture,
	type TrainItemFixture,
} from '../prototype-fixtures';

export const Route = createFileRoute('/train')({ component: Train });

const FIELD_LABEL: Record<SetField, () => string> = {
	weight: () => m.field_weight(),
	edge: () => m.field_edge(),
	time: () => m.field_time(),
	reps: () => m.field_reps(),
	grip: () => m.field_grip(),
	rest: () => m.field_rest(),
	rpe: () => m.field_rpe(),
};

const GRIP_LABEL: Record<string, () => string> = {
	'half-crimp': () => m.grip_half_crimp(),
	'open-hand': () => m.grip_open_hand(),
	'full-crimp': () => m.grip_full_crimp(),
	pinch: () => m.grip_pinch(),
	sloper: () => m.grip_sloper(),
	wrist: () => m.grip_wrist(),
	jug: () => m.grip_jug(),
};

const COST_LABEL: Record<string, () => string> = {
	low: () => m.cost_low(),
	mod: () => m.cost_mod(),
	high: () => m.cost_high(),
};

const range = (r: Range | undefined): string | null =>
	r ? (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`) : null;

function Train() {
	const fx = useMemo(() => getPrototypeFixtures(), []);
	const train = fx.train;

	const [sets, setSets] = useState<Record<string, WorkoutSet[]>>(() =>
		Object.fromEntries(train.items.map((item) => [item.exId, item.sets.map((s) => ({ ...s }))])),
	);
	const [variant, setVariant] = useState<Record<string, number>>(() =>
		Object.fromEntries(train.items.map((item) => [item.exId, item.variantIndex])),
	);
	const [added, setAdded] = useState<string[]>([]);
	const [note, setNote] = useState(train.note);
	const [duration, setDuration] = useState(
		train.durationMin == null ? '' : String(train.durationMin),
	);
	const [swapFor, setSwapFor] = useState<TrainItemFixture | null>(null);
	const [addOpen, setAddOpen] = useState(false);

	return (
		<>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<span className={pill({ tone: 'chalk' })}>{train.weekdayLabel}</span>
				<span className={pill()}>{m.train_autosave()}</span>
			</div>

			{train.timer ? <RestTimer timer={train.timer} /> : null}

			<Head right={<span>{train.items.length}</span>}>{m.sec_train()}</Head>
			<div className="flex flex-col gap-3">
				{train.items.map((item) => (
					<ExerciseCard
						key={item.exId}
						item={item}
						variantIndex={variant[item.exId] ?? 0}
						sets={sets[item.exId] ?? []}
						onSwap={() => setSwapFor(item)}
						onSetChange={(index, patch) =>
							setSets((prev) => ({
								...prev,
								[item.exId]: (prev[item.exId] ?? []).map((s, i) =>
									i === index ? { ...s, ...patch } : s,
								),
							}))
						}
						onAddSet={() =>
							setSets((prev) => {
								const current = prev[item.exId] ?? [];
								const last = current[current.length - 1];
								return {
									...prev,
									[item.exId]: [...current, { ...(last ?? { done: false }), done: false }],
								};
							})
						}
					/>
				))}

				{added.map((exId) => {
					const ex = train.available.find((a) => a.exId === exId);
					if (!ex) return null;
					return (
						<Panel key={exId} accent="var(--teal)" className="py-3 pr-3 pl-5">
							<p className="text-[17px] font-bold tracking-tight text-ink">{ex.name}</p>
							<p className="mt-0.5 text-[12px] text-ink-faint">{ex.cat}</p>
						</Panel>
					);
				})}
			</div>

			<div className="mt-3 grid grid-cols-1 gap-2">
				<button type="button" className={bigButton()} onClick={() => setAddOpen(true)}>
					<Plus className="size-5 shrink-0" strokeWidth={3} />
					{m.wk_add_ex()}
				</button>
				<button type="button" disabled={!train.canRepeatLast} className={bigButton()}>
					<Repeat className="size-5 shrink-0" strokeWidth={2.5} />
					{train.canRepeatLast ? m.train_repeat() : m.train_no_prev()}
				</button>
			</div>

			{/* ── session note + duration ─────────────────────────────────────── */}
			<Head>{m.train_note()}</Head>
			<Panel className="p-3">
				<textarea
					value={note}
					onChange={(e) => setNote(e.target.value)}
					rows={3}
					placeholder={m.train_note()}
					className="well w-full rounded-md p-3 text-base leading-snug text-ink outline-none placeholder:text-ink-faint"
				/>
				<label className="mt-2 flex items-center gap-3">
					<span className="w-24 shrink-0 font-mono text-[11px] tracking-wider text-ink-faint uppercase">
						{m.train_duration()}
					</span>
					<input
						type="number"
						inputMode="numeric"
						value={duration}
						onChange={(e) => setDuration(e.target.value)}
						className="well min-h-[56px] min-w-0 flex-1 rounded-md px-3 font-mono text-base font-bold text-ink outline-none"
					/>
				</label>
				<p className="mt-2 text-[12px] leading-snug text-ink-faint">{m.train_duration_hint()}</p>
				<p className="mt-1 text-[12px] text-teal">{m.train_autosave()}</p>
				<button type="button" className={bigButton({ tone: 'hot', class: 'mt-3' })}>
					<Check className="size-5 shrink-0" strokeWidth={3} />
					{m.train_finish()}
				</button>
			</Panel>

			{/* ── sheets ──────────────────────────────────────────────────────── */}
			<Sheet
				open={swapFor != null}
				onOpenChange={(next) => {
					if (!next) setSwapFor(null);
				}}
				title={swapFor?.exName ?? ''}
				description={m.swap_label()}
			>
				<div className="flex flex-col gap-2">
					{(swapFor?.variants ?? []).map((option, index) => {
						const on = swapFor != null && (variant[swapFor.exId] ?? 0) === index;
						return (
							<button
								key={option.name}
								type="button"
								aria-pressed={on}
								className={bigButton({
									tone: on ? 'hot' : 'plain',
									class: 'flex-col items-start justify-center gap-1',
								})}
								onClick={() => {
									if (swapFor) setVariant((prev) => ({ ...prev, [swapFor.exId]: index }));
									setSwapFor(null);
								}}
							>
								<span className="text-left">{option.name}</span>
								{option.tool || option.speed ? (
									<span className="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
										{[
											option.tool ? `${m.var_tool()} ${option.tool}` : null,
											option.speed ? `${m.var_speed()} ${option.speed}` : null,
										]
											.filter(Boolean)
											.join(' · ')}
									</span>
								) : null}
							</button>
						);
					})}
				</div>
			</Sheet>

			<Sheet
				open={addOpen}
				onOpenChange={setAddOpen}
				title={m.wk_add_ex()}
				description={m.filter_all()}
			>
				<div className="flex flex-col gap-2">
					{train.available.map((option) => (
						<button
							key={option.exId}
							type="button"
							className={bigButton({
								tone: added.includes(option.exId) ? 'hot' : 'plain',
								class: 'flex-col items-start justify-center gap-1',
							})}
							onClick={() => {
								setAdded((prev) => (prev.includes(option.exId) ? prev : [...prev, option.exId]));
								setAddOpen(false);
							}}
						>
							<span className="text-left">{option.name}</span>
							<span className="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
								{option.cat}
							</span>
						</button>
					))}
				</div>
			</Sheet>
		</>
	);
}

/** The machine face. Sunk, mono, and the only thing on the screen sized to be
 *  read from the floor. */
function RestTimer({ timer }: { timer: TimerFixture }) {
	const schedule = useMemo(() => {
		const out: { phase: 'prepare' | 'work' | 'rest' | 'setrest'; sec: number; round: number }[] =
			[];
		if (timer.prepareSec > 0) out.push({ phase: 'prepare', sec: timer.prepareSec, round: 0 });
		for (let set = 0; set < timer.sets; set++) {
			for (let round = 0; round < timer.rounds; round++) {
				out.push({ phase: 'work', sec: timer.workSec, round: round + 1 });
				if (timer.restSec > 0) out.push({ phase: 'rest', sec: timer.restSec, round: round + 1 });
			}
			if (set < timer.sets - 1 && timer.setRestSec > 0) {
				out.push({ phase: 'setrest', sec: timer.setRestSec, round: 0 });
			}
		}
		return out;
	}, [timer]);

	// One counter, and the step derived from it. The obvious shape — a `left`
	// countdown that advances an `index` when it hits zero — needs a state updater
	// that fires another setState, which react-doctor rejects as impure
	// (`no-impure-state-updater`) and which double-advances under a replayed
	// render. Elapsed seconds are the only state; everything else is a pure read.
	const [elapsed, setElapsed] = useState(0);
	const [running, setRunning] = useState(false);

	useEffect(() => {
		if (!running) return;
		const id = window.setInterval(() => setElapsed((prev) => prev + 1), 1000);
		return () => window.clearInterval(id);
	}, [running]);

	const { index, left, finished } = useMemo(() => {
		let start = 0;
		for (let i = 0; i < schedule.length; i++) {
			const sec = schedule[i].sec;
			if (elapsed < start + sec)
				return { index: i, left: sec - (elapsed - start), finished: false };
			start += sec;
		}
		return { index: Math.max(0, schedule.length - 1), left: 0, finished: true };
	}, [elapsed, schedule]);

	useEffect(() => {
		if (finished) setRunning(false);
	}, [finished]);

	const step = schedule[index];
	const phaseLabel =
		step?.phase === 'work'
			? m.timer_work()
			: step?.phase === 'rest'
				? m.timer_rest()
				: step?.phase === 'setrest'
					? m.timer_setrest()
					: m.timer_prepare();
	const phaseColour =
		step?.phase === 'work'
			? 'var(--flag)'
			: step?.phase === 'prepare'
				? 'var(--gold)'
				: 'var(--teal)';
	const progress = step && step.sec > 0 ? 1 - left / step.sec : 0;

	return (
		<section>
			<Head right={<span>{timer.label}</span>}>{m.timer_title()}</Head>
			<Panel className="p-3">
				<div className="well relative overflow-hidden rounded-lg px-4 py-5 text-center">
					<span
						aria-hidden="true"
						className="absolute inset-x-0 bottom-0 h-1.5 origin-left"
						style={{ background: phaseColour, transform: `scaleX(${progress})` }}
					/>
					<p
						className="font-mono text-[13px] tracking-[0.2em] uppercase"
						style={{ color: phaseColour }}
					>
						{running ? phaseLabel : m.timer_ready()}
					</p>
					<p className="mt-1 font-mono text-[68px] leading-none font-bold tracking-tighter text-ink tabular-nums">
						{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}
					</p>
					<p className="mt-2 font-mono text-[11px] tracking-wider text-ink-faint uppercase">
						{m.timer_round({ n: Math.max(1, step?.round ?? 1), total: timer.rounds })} ·{' '}
						{m.timer_left()} {schedule.length - index}
					</p>
				</div>

				<div className="mt-3 grid grid-cols-3 gap-2">
					<button
						type="button"
						className={bigButton({ tone: running ? 'plain' : 'hot' })}
						onClick={() => setRunning((v) => !v)}
					>
						{running ? (
							<Pause className="size-6" strokeWidth={3} />
						) : (
							<Play className="size-6" strokeWidth={3} />
						)}
						<span className="sr-only">{running ? m.btn_pause() : m.btn_start()}</span>
					</button>
					<button
						type="button"
						className={bigButton()}
						onClick={() => {
							setRunning(false);
							setElapsed(0);
						}}
					>
						<RotateCcw className="size-6" strokeWidth={3} />
						<span className="sr-only">{m.btn_reset()}</span>
					</button>
					<div className="well flex flex-col items-center justify-center rounded-lg px-2">
						<span className="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
							{m.timer_total()}
						</span>
						<span className="font-mono text-[18px] font-bold text-ink">
							{Math.round(timer.totalSec / 60)}′
						</span>
					</div>
				</div>

				<dl className="mt-3 grid grid-cols-3 gap-2">
					{[
						[m.timer_prepare_s(), timer.prepareSec],
						[m.timer_work_s(), timer.workSec],
						[m.timer_rest_s(), timer.restSec],
						[m.timer_rounds(), timer.rounds],
						[m.timer_sets(), timer.sets],
						[m.timer_setrest_s(), timer.setRestSec],
					].map(([label, value]) => (
						<div key={String(label)} className="well min-w-0 rounded-md px-2 py-2 text-center">
							<dt className="font-mono text-[9px] leading-tight tracking-wider text-ink-faint uppercase">
								{label}
							</dt>
							<dd className="mt-0.5 font-mono text-[17px] font-bold text-ink">{value}</dd>
						</div>
					))}
				</dl>
			</Panel>
		</section>
	);
}

function ExerciseCard({
	item,
	variantIndex,
	sets,
	onSwap,
	onSetChange,
	onAddSet,
}: {
	item: TrainItemFixture;
	variantIndex: number;
	sets: WorkoutSet[];
	onSwap: () => void;
	onSetChange: (index: number, patch: Partial<WorkoutSet>) => void;
	onAddSet: () => void;
}) {
	const accent = `var(${item.catVar})`;
	const chosen = item.variants[variantIndex] ?? item.variants[0];
	const spec = item.spec;

	const targets: [string, string | null][] = [
		[m.presc_sets(), range(spec.sets)],
		[m.presc_reps(), range(spec.reps)],
		[m.presc_work(), range(spec.workSec)],
		[m.presc_rest(), range(spec.restSec)],
		[m.presc_rounds(), range(spec.rounds)],
		[m.presc_setrest(), range(spec.setRestSec)],
		[m.presc_load(), range(spec.loadKg)],
		[m.presc_edge(), range(spec.edgeMm)],
		[m.presc_rpe(), range(spec.rpe)],
	];

	return (
		<Panel accent={accent} className="py-3 pr-3 pl-5">
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<p className="text-[19px] leading-tight font-bold tracking-tight text-ink">
						{item.exName}
					</p>
					<p className="mt-0.5 text-[12px] text-ink-faint">{item.cat}</p>
					<p className="mt-1 text-[13px] leading-snug text-ink-dim">
						{chosen?.name}
						{variantIndex === item.variantIndex ? '' : ` ${m.swapped_tag()}`}
					</p>
				</div>
				<button
					type="button"
					onClick={onSwap}
					aria-label={m.swap_label()}
					className="slab flex size-14 shrink-0 items-center justify-center rounded-md text-ink transition-transform duration-75 active:slab-press"
				>
					<Shuffle className="size-5" strokeWidth={2.75} />
				</button>
			</div>

			<div className="mt-2 flex flex-wrap gap-1.5">
				{targets
					.filter(([, value]) => value != null)
					.map(([label, value]) => (
						<span key={label} className={pill()}>
							{label} {value}
						</span>
					))}
				{spec.cnsCost ? (
					<span className={pill({ tone: 'hot' })}>
						{m.presc_cns()} {COST_LABEL[spec.cnsCost]?.() ?? spec.cnsCost}
					</span>
				) : null}
				{spec.grip ? (
					<span className={pill({ tone: 'violet' })}>{GRIP_LABEL[spec.grip]?.() ?? spec.grip}</span>
				) : null}
			</div>

			{/* Exercise prose carries inline <b>, and it is where the cue lives. */}
			<Rich className="mt-2 text-[13px] leading-snug text-ink-dim" html={spec.what} />
			{spec.note ? (
				<Rich className="mt-1 text-[12px] leading-snug text-ink-faint" html={spec.note} />
			) : null}

			<div className="mt-3 flex flex-col gap-2">
				{sets.map((set, index) => (
					<SetBlock
						// Set rows have no id in the fixture and are reordered only by
						// appending, so the index is the stable identity here.
						// biome-ignore lint/suspicious/noArrayIndexKey: append-only list, no stable id in the fixture
						key={index}
						n={index + 1}
						fields={item.fields}
						set={set}
						accent={accent}
						onChange={(patch) => onSetChange(index, patch)}
					/>
				))}
			</div>

			<button type="button" className={bigButton({ class: 'mt-2' })} onClick={onAddSet}>
				<Plus className="size-5 shrink-0" strokeWidth={3} />
				{m.train_add_set()}
			</button>
		</Panel>
	);
}

/** One logged set. A block, not a row — see the note at the top of the file. */
function SetBlock({
	n,
	fields,
	set,
	accent,
	onChange,
}: {
	n: number;
	fields: SetField[];
	set: WorkoutSet;
	accent: string;
	onChange: (patch: Partial<WorkoutSet>) => void;
}) {
	return (
		<div className="slab rounded-md p-2">
			<div className="flex items-center gap-2">
				<span className="flex-1 font-mono text-[11px] tracking-wider text-ink-faint uppercase">
					{m.set_n({ n })}
				</span>
				<button
					type="button"
					role="switch"
					aria-checked={set.done}
					aria-label={m.lbl_done()}
					onClick={() => onChange({ done: !set.done })}
					className="flex size-14 items-center justify-center rounded-md transition-transform duration-75 active:translate-y-[2px]"
					style={{
						background: set.done ? accent : 'var(--panel-3)',
						boxShadow: set.done
							? 'inset 0 2px 6px rgba(0,0,0,.5)'
							: 'inset 0 1px 0 var(--lip), 0 2px 0 var(--shade)',
					}}
				>
					<Check
						className="size-7"
						strokeWidth={3.5}
						style={{ color: set.done ? 'var(--bg)' : 'var(--ink-faint)' }}
					/>
				</button>
			</div>

			<div className="mt-2 grid grid-cols-3 gap-1.5">
				{fields.map((field) =>
					field === 'grip' ? (
						<div key={field} className="well min-w-0 rounded-md px-2 py-1.5">
							<span className="block font-mono text-[9px] tracking-wider text-ink-faint uppercase">
								{FIELD_LABEL[field]()}
							</span>
							<span className="mt-0.5 block truncate text-[13px] font-semibold text-ink">
								{set.grip ? (GRIP_LABEL[set.grip]?.() ?? set.grip) : '—'}
							</span>
						</div>
					) : (
						<label key={field} className="well block min-w-0 rounded-md px-2 py-1.5">
							<span className="block font-mono text-[9px] tracking-wider text-ink-faint uppercase">
								{FIELD_LABEL[field]()}
							</span>
							<input
								type="number"
								inputMode="numeric"
								value={set[field] == null ? '' : String(set[field])}
								onChange={(e) => {
									const value = e.target.value === '' ? null : Number(e.target.value);
									onChange({ [field]: value } as Partial<WorkoutSet>);
								}}
								className="w-full min-w-0 bg-transparent font-mono text-base font-bold text-ink outline-none"
							/>
						</label>
					),
				)}
			</div>
		</div>
	);
}
