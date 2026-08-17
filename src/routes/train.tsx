// TRAIN — the working end of the instrument.
//
// This is the screen used mid-set, one-handed, with chalk on your fingers, and
// it is where the direction has to earn its keep rather than look good. Three
// decisions carry it:
//
// 1. THE SET TABLE. Every logged set is one ruled line in a fixed column grid,
//    with the column legend printed once at the top of the exercise — a spec
//    sheet, not a card per set. Dropping the input's box (a baseline rule under
//    the value instead) recovers roughly 14px per column, which is what makes
//    six numeric columns fit across 360px at a 16px value size.
// 2. THE TIMER IS THE PANEL'S BIG READOUT. One number, as large as the screen
//    can carry, on graph paper, coloured by phase. It is the only element in the
//    app allowed to be that size, because it is the only one read from two
//    metres away while hanging off something.
// 3. NOTHING FLOATS. The variant picker is the one popup in the direction, and
//    only because a list of four options has nowhere else to go on a phone.
import { Select } from '@base-ui/react/select';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getContent } from '$lib/content';
import type { Variant } from '$lib/content/types';
import {
	clock,
	costLabel,
	formatEdge,
	formatLoad,
	formatRange,
	formatSecondsRange,
	GRIPS,
	gripLabel,
	SET_FIELD_LABEL,
} from '$lib/formatSpec';
import * as m from '$lib/paraglide/messages';
import { usePrototype } from '$lib/prototypeSnapshot';
import type { WorkoutSet } from '$lib/types';
import { cn } from '$lib/utils';
import { Band, Note, Prose, Row, SubBand, Tag, Tick } from '../components/instrument';
import { Panel, ScreenHead } from '../components/Panel';
import type { SetField, TimerFixture } from '../prototype-fixtures';

export const Route = createFileRoute('/train')({ component: TrainScreen });

/** A logged set plus a stable key. The fixture's sets are positional; once the
 *  athlete can add and remove rows, a positional key morphs the wrong row. */
interface SetRow extends WorkoutSet {
	key: string;
}

/** Which per-set fields the logger shows. Mirrors the fixture's own `fieldsFor`,
 *  so an exercise the athlete adds mid-session gets the same columns as one that
 *  was already on the slot. */
function fieldsFor(spec: Variant | undefined): SetField[] {
	const f: SetField[] = ['weight', 'edge', 'time', 'reps'];
	if (spec?.grip) f.push('grip');
	f.push('rest', 'rpe');
	return f;
}

const mid = (r?: { min: number; max: number }): number | null =>
	r ? Math.round((r.min + r.max) / 2) : null;

function prefilled(spec: Variant): WorkoutSet {
	return {
		weight: mid(spec.loadKg),
		edge: mid(spec.edgeMm),
		time: mid(spec.workSec),
		reps: mid(spec.reps),
		rest: mid(spec.restSec ?? spec.setRestSec),
		rpe: mid(spec.rpe),
		grip: spec.grip ?? null,
		done: false,
	};
}

function TrainScreen() {
	const { train } = usePrototype();
	const content = getContent();

	const [variant, setVariant] = useState<Record<string, number>>({});
	const [added, setAdded] = useState<string[]>([]);
	const [note, setNote] = useState(train.note);
	const [duration, setDuration] = useState<number | null>(train.durationMin);
	const [repeated, setRepeated] = useState(false);
	const seq = useRef(0);
	const [sets, setSets] = useState<Record<string, SetRow[]>>(() =>
		Object.fromEntries(
			train.items.map((it) => [
				it.exId,
				it.sets.map((s, i) => ({ ...s, key: `${it.exId}:seed${i}` })),
			]),
		),
	);

	// The slot's exercises, plus anything added off-script. An added exercise
	// counts toward training rather than against it (CONTEXT.md, "Trained"), so
	// it is rendered identically — not in a lesser tier.
	const items = useMemo(() => {
		const extra = added.flatMap((exId) => {
			const ex = content.exercises[exId];
			if (!ex) return [];
			return [
				{
					exId,
					exName: ex.name,
					cat: ex.cat,
					catVar: ex.catVar,
					variants: ex.variants,
					added: true,
				},
			];
		});
		return [
			...train.items.map((it) => ({
				exId: it.exId,
				exName: it.exName,
				cat: it.cat,
				catVar: it.catVar,
				variants: content.exercises[it.exId]?.variants ?? [],
				added: false,
			})),
			...extra,
		];
	}, [train.items, added, content.exercises]);

	const available = train.available.filter((a) => !added.includes(a.exId));
	const loggedSets = Object.values(sets).reduce((n, rows) => n + rows.length, 0);
	const doneSets = Object.values(sets).reduce(
		(n, rows) => n + rows.filter((r) => r.done).length,
		0,
	);

	const addSet = useCallback((exId: string, spec: Variant) => {
		seq.current += 1;
		const key = `${exId}:new${seq.current}`;
		setSets((prev) => {
			const rows = prev[exId] ?? [];
			// A later set carries the previous one forward: what the athlete just
			// corrected becomes the default for what they add next.
			const last = rows[rows.length - 1];
			const seed: SetRow = last ? { ...last, key, done: false } : { ...prefilled(spec), key };
			return { ...prev, [exId]: [...rows, seed] };
		});
	}, []);

	const patchSet = useCallback((exId: string, key: string, patch: Partial<WorkoutSet>) => {
		setSets((prev) => ({
			...prev,
			[exId]: (prev[exId] ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)),
		}));
	}, []);

	const removeSet = useCallback((exId: string, key: string) => {
		setSets((prev) => ({ ...prev, [exId]: (prev[exId] ?? []).filter((r) => r.key !== key) }));
	}, []);

	return (
		<Panel>
			<ScreenHead
				title={m.nav_train()}
				context={`${train.weekdayLabel} · ${doneSets}/${loggedSets}`}
			/>

			{train.timer ? <IntervalTimer seed={train.timer} /> : null}

			{items.length === 0 ? (
				<Note className="py-8 text-center">{m.train_empty()}</Note>
			) : (
				items.map((it, i) => {
					const idx = variant[it.exId] ?? 0;
					const spec = it.variants[idx] ?? it.variants[0];
					if (!spec) return null;
					const rows = sets[it.exId] ?? [];
					return (
						<ExerciseBand
							key={it.exId}
							index={i + 1}
							exId={it.exId}
							exName={it.exName}
							cat={it.cat}
							catVar={it.catVar}
							added={it.added}
							variants={it.variants}
							variantIndex={idx}
							onVariant={(next) => setVariant((v) => ({ ...v, [it.exId]: next }))}
							spec={spec}
							rows={rows}
							onAdd={() => addSet(it.exId, spec)}
							onPatch={(key, patch) => patchSet(it.exId, key, patch)}
							onRemove={(key) => removeSet(it.exId, key)}
						/>
					);
				})
			)}

			{/* ── ADD EXERCISE ────────────────────────────────────────────────── */}
			<Band label={m.wk_add_ex()} reading={String(available.length)}>
				<div className="border-b border-line px-4 py-2.5">
					<PanelSelect
						value=""
						placeholder={`+ ${m.wk_add_ex()}`}
						items={available.map((a) => ({ value: a.exId, label: a.name, hint: a.cat }))}
						onValueChange={(v) => v && setAdded((prev) => [...prev, v])}
					/>
				</div>
				{/* Repeat-last is spent: something is already logged for today. Shown
				    disabled rather than removed — a control that vanishes is a control
				    the athlete has to rediscover. */}
				<Row size="sm">
					<span className="inst-label-xs min-w-0 flex-1">{m.train_repeat()}</span>
					<span className="inst-label-xs shrink-0 text-right">
						{train.canRepeatLast && !repeated ? (
							<button type="button" onClick={() => setRepeated(true)} className="text-flag">
								↻
							</button>
						) : (
							m.train_no_prev()
						)}
					</span>
				</Row>
			</Band>

			{/* ── SESSION ─────────────────────────────────────────────────────── */}
			<Band label={m.sec_train()} reading={`${loggedSets} ${m.stats_sets()}`}>
				<div className="border-b border-line px-4 py-3">
					<div className="inst-label-xs mb-1">{m.train_note()}</div>
					<input
						type="text"
						aria-label={m.train_note()}
						value={note}
						onChange={(e) => setNote(e.currentTarget.value)}
						className="w-full border-b border-line-2 bg-transparent py-1.5 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-flag"
					/>
				</div>
				<Row size="sm">
					<span className="inst-label-xs w-[84px] shrink-0">{m.train_duration()}</span>
					<input
						type="number"
						inputMode="numeric"
						min="1"
						aria-label={m.train_duration()}
						value={duration ?? ''}
						onChange={(e) => {
							const n = Number.parseInt(e.currentTarget.value, 10);
							setDuration(Number.isNaN(n) ? null : n);
						}}
						className="w-14 shrink-0 border-b border-line-2 bg-transparent py-1 text-center font-mono text-[16px] text-ink outline-none focus:border-flag"
					/>
					<span className="min-w-0 flex-1 text-[12px] leading-snug text-ink-faint">
						{m.train_duration_hint()}
					</span>
				</Row>
				<div className="inst-label-xs px-4 py-3">{m.train_autosave()}</div>
			</Band>

			<div className="h-8" />
		</Panel>
	);
}

// ───────────────────────────────────────────────────────────────── the timer

type Phase = 'idle' | 'prepare' | 'work' | 'rest' | 'setRest' | 'done';

const PHASE_LABEL: Record<Phase, () => string> = {
	idle: () => m.timer_ready(),
	prepare: () => m.timer_prepare(),
	work: () => m.timer_work(),
	rest: () => m.timer_rest(),
	setRest: () => m.timer_setrest(),
	done: () => m.timer_done(),
};

const PHASE_COLOR: Record<Phase, string> = {
	idle: 'var(--ink-dim)',
	prepare: 'var(--gold)',
	work: 'var(--flag)',
	rest: 'var(--teal)',
	setRest: 'var(--teal)',
	done: 'var(--teal)',
};

interface TimerCfg {
	prepare: number;
	work: number;
	rest: number;
	rounds: number;
	sets: number;
	setRest: number;
}

interface ClockState {
	phase: Phase;
	remaining: number;
	round: number;
	set: number;
}

/**
 * One second of the interval machine — a pure transition, so the whole timer is
 * a single `setState(tick)` and nothing schedules anything from inside a state
 * updater. (The first version drove the phases with nested setters and
 * `react-doctor` was right to call it: a state updater with side effects runs
 * twice under StrictMode and the timer skipped a rest.)
 */
function tick(c: ClockState, cfg: TimerCfg): ClockState {
	if (c.remaining > 1) return { ...c, remaining: c.remaining - 1 };
	switch (c.phase) {
		case 'prepare':
			return { ...c, phase: 'work', remaining: cfg.work };
		case 'work':
			if (c.round < cfg.rounds) {
				return cfg.rest > 0
					? { ...c, phase: 'rest', remaining: cfg.rest }
					: { ...c, round: c.round + 1, remaining: cfg.work };
			}
			if (c.set < cfg.sets) {
				return cfg.setRest > 0
					? { ...c, phase: 'setRest', round: 1, remaining: cfg.setRest }
					: { ...c, phase: 'work', set: c.set + 1, round: 1, remaining: cfg.work };
			}
			return { ...c, phase: 'done', remaining: 0 };
		case 'rest':
			return { ...c, phase: 'work', round: c.round + 1, remaining: cfg.work };
		case 'setRest':
			return { ...c, phase: 'work', set: c.set + 1, round: 1, remaining: cfg.work };
		default:
			return c;
	}
}

/**
 * The interval timer, as the panel's primary readout.
 *
 * Seeded from the prescription (the fixture resolves the midpoints), and
 * editable underneath — six ruled numeric blanks in a 3×2 grid, which is the
 * densest honest layout for six labelled fields at 360px.
 *
 * No haptics. `navigator.vibrate` exists on the athlete's Android device and the
 * athlete has declined it (#54), so the phase change is carried by the number,
 * the colour and the segmented progress rule alone.
 */
function IntervalTimer({ seed }: { seed: TimerFixture }) {
	const [cfg, setCfg] = useState({
		prepare: seed.prepareSec,
		work: seed.workSec,
		rest: seed.restSec,
		rounds: seed.rounds,
		sets: seed.sets,
		setRest: seed.setRestSec,
	});
	const [clockState, setClockState] = useState<ClockState>(() => ({
		phase: 'idle',
		remaining: seed.prepareSec || seed.workSec,
		round: 1,
		set: 1,
	}));
	const [running, setRunning] = useState(false);
	const { phase, remaining, round, set } = clockState;
	// The machine stops itself at 'done'; `running` is only what the athlete asked
	// for. Deriving the live flag instead of writing it back keeps the tick a pure
	// state transition.
	const ticking = running && phase !== 'idle' && phase !== 'done';

	useEffect(() => {
		if (!ticking) return;
		const id = window.setInterval(() => setClockState((c) => tick(c, cfg)), 1000);
		return () => window.clearInterval(id);
	}, [ticking, cfg]);

	const total =
		cfg.prepare +
		cfg.sets * cfg.rounds * (cfg.work + cfg.rest) +
		Math.max(0, cfg.sets - 1) * cfg.setRest;
	// Everything still ahead of the athlete, including the phase now running.
	const spentSets = (set - 1) * (cfg.rounds * (cfg.work + cfg.rest) + cfg.setRest);
	const spentRounds = (round - 1) * (cfg.work + cfg.rest);
	const left =
		phase === 'idle'
			? total
			: phase === 'done'
				? 0
				: Math.max(0, total - cfg.prepare - spentSets - spentRounds - (cfg.work - remaining));
	const color = PHASE_COLOR[phase];
	const progress = total > 0 ? 1 - left / total : 0;

	const field = (key: keyof typeof cfg, label: string): React.ReactElement => (
		<label className="min-w-0">
			<span className="inst-label-xs block min-h-[2.4em] leading-[1.2]">{label}</span>
			<input
				type="number"
				inputMode="numeric"
				min="0"
				value={cfg[key]}
				onChange={(e) => {
					const n = Number.parseInt(e.currentTarget.value, 10);
					setCfg((c) => ({ ...c, [key]: Number.isNaN(n) ? 0 : n }));
				}}
				className="w-full border-b border-line-2 bg-transparent py-1 text-center font-mono text-[16px] text-ink outline-none focus:border-flag"
			/>
		</label>
	);

	return (
		<Band
			label={m.timer_title()}
			reading={
				<span className="truncate" style={{ color }}>
					{PHASE_LABEL[phase]()}
				</span>
			}
		>
			<div className="relative overflow-hidden border-b border-line bg-panel px-4 pt-4 pb-3">
				<span aria-hidden className="inst-grid pointer-events-none absolute inset-0" />
				<div className="relative">
					<div className="flex items-baseline justify-between gap-3">
						<div className="inst-label-xs min-w-0 truncate">{seed.label}</div>
						<div className="inst-label-xs shrink-0">
							{m.timer_sets()} {set}/{cfg.sets} · {m.timer_rounds()} {round}/{cfg.rounds}
						</div>
					</div>
					<div className="mt-1 flex items-baseline justify-center">
						<span
							className="font-mono text-[76px] leading-[0.82] font-bold tracking-[-0.05em]"
							style={{ color }}
						>
							{remaining}
						</span>
						<span className="ml-1 font-mono text-[22px] text-ink-faint">s</span>
					</div>
					{/* A segmented progress rule — twenty cells, not a smooth bar. */}
					<div aria-hidden className="mt-3 flex gap-[2px]">
						{Array.from({ length: 20 }, (_, i) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: the cells *are* the index
								key={i}
								className="h-1.5 flex-1 border border-line"
								style={i / 20 < progress ? { background: color, borderColor: color } : undefined}
							/>
						))}
					</div>
					<div className="mt-2 flex items-baseline justify-between font-mono text-[11px] text-ink-faint">
						<span>
							{m.timer_left()} <span className="text-chalk">{clock(left)}</span>
						</span>
						<span>
							{m.timer_total()} {clock(total)}
						</span>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-2 border-b border-line">
				<button
					type="button"
					onClick={() => {
						if (phase === 'idle' || phase === 'done') {
							setClockState({
								phase: cfg.prepare > 0 ? 'prepare' : 'work',
								remaining: cfg.prepare > 0 ? cfg.prepare : cfg.work,
								round: 1,
								set: 1,
							});
							setRunning(true);
							return;
						}
						setRunning((r) => !r);
					}}
					className="border-r border-line py-3.5 font-mono text-[12px] tracking-[0.14em] uppercase active:bg-panel-2"
					style={{ color: ticking ? 'var(--teal)' : 'var(--flag)' }}
				>
					{ticking ? m.btn_pause() : m.btn_start()}
				</button>
				<button
					type="button"
					onClick={() => {
						setRunning(false);
						setClockState({
							phase: 'idle',
							remaining: cfg.prepare || cfg.work,
							round: 1,
							set: 1,
						});
					}}
					className="py-3.5 font-mono text-[12px] tracking-[0.14em] text-ink-dim uppercase active:bg-panel-2"
				>
					{m.btn_reset()}
				</button>
			</div>

			<div className="grid grid-cols-3 gap-x-3 gap-y-3 border-b border-line px-4 py-3">
				{field('prepare', m.timer_prepare_s())}
				{field('work', m.timer_work_s())}
				{field('rest', m.timer_rest_s())}
				{field('rounds', m.timer_rounds())}
				{field('sets', m.timer_sets())}
				{field('setRest', m.timer_setrest_s())}
			</div>
		</Band>
	);
}

// ─────────────────────────────────────────────────────────── one exercise

function ExerciseBand({
	index,
	exId,
	exName,
	cat,
	catVar,
	added,
	variants,
	variantIndex,
	onVariant,
	spec,
	rows,
	onAdd,
	onPatch,
	onRemove,
}: {
	index: number;
	exId: string;
	exName: string;
	cat: string;
	catVar: string;
	added: boolean;
	variants: Variant[];
	variantIndex: number;
	onVariant: (i: number) => void;
	spec: Variant;
	rows: SetRow[];
	onAdd: () => void;
	onPatch: (key: string, patch: Partial<WorkoutSet>) => void;
	onRemove: (key: string) => void;
}) {
	const fields = fieldsFor(spec);
	const numeric = fields.filter((f) => f !== 'grip');
	const doneCount = rows.filter((r) => r.done).length;

	const specs: [string, string | null][] = [
		[m.presc_sets(), spec.sets ? formatRange(spec.sets) : null],
		[m.presc_reps(), spec.reps ? formatRange(spec.reps) : null],
		[m.presc_work(), spec.workSec ? formatSecondsRange(spec.workSec) : null],
		[m.presc_rest(), spec.restSec ? formatSecondsRange(spec.restSec) : null],
		[m.presc_rounds(), spec.rounds ? `×${formatRange(spec.rounds)}` : null],
		[m.presc_setrest(), spec.setRestSec ? formatSecondsRange(spec.setRestSec) : null],
		[m.presc_load(), spec.loadKg ? formatLoad(spec.loadKg) : null],
		[m.presc_edge(), spec.edgeMm ? formatEdge(spec.edgeMm) : null],
		[m.presc_intensity(), spec.intensityPct ? `${formatRange(spec.intensityPct)}%` : null],
		[m.presc_rpe(), spec.rpe ? formatRange(spec.rpe) : null],
	];

	return (
		<Band
			label={`${String(index).padStart(2, '0')} · ${exName}`}
			reading={`${doneCount}/${rows.length}`}
		>
			<div
				className="relative flex items-center gap-3 border-b border-line px-4 py-2"
				style={{ boxShadow: `inset 3px 0 0 0 var(${catVar})` }}
			>
				<span className="inst-label-xs min-w-0 flex-1 truncate">{cat}</span>
				{added ? <Tag tone="gold">+</Tag> : null}
				{spec.cnsCost ? (
					<Tag tone={spec.cnsCost === 'high' ? 'flag' : 'quiet'}>
						{m.presc_cns()} {costLabel(spec.cnsCost)}
					</Tag>
				) : null}
				{spec.toFailure ? <Tag tone="flag">{m.presc_failure()}</Tag> : null}
			</div>

			{variants.length > 1 ? (
				<div className="border-b border-line px-4 py-2.5">
					<div className="inst-label-xs mb-1">{m.swap_label()}</div>
					<PanelSelect
						value={String(variantIndex)}
						items={variants.map((v, i) => ({
							value: String(i),
							label: v.name,
							hint: [v.tool, v.speed].filter(Boolean).join(' · ') || undefined,
						}))}
						onValueChange={(v) => v && onVariant(Number(v))}
					/>
				</div>
			) : null}

			{/* The prescription — what the athlete is asked to do, as a spec sheet. */}
			<div className="grid grid-cols-4 gap-x-3 gap-y-2.5 border-b border-line bg-panel px-4 py-3">
				{specs
					.filter(([, v]) => v)
					.map(([label, value]) => (
						<div key={label} className="min-w-0">
							<div className="inst-label-xs min-h-[2.4em] leading-[1.2]">{label}</div>
							<div className="mt-0.5 font-mono text-[13px] whitespace-nowrap text-chalk">
								{value}
							</div>
						</div>
					))}
			</div>
			{spec.note ? (
				<Note className="border-b border-line py-2.5 text-[12.5px]">
					<Prose value={spec.note} />
				</Note>
			) : null}

			{/* The set table. Column legend once, then one ruled line per set. */}
			<div className="border-b border-line px-4 pt-2 pb-1">
				<SetGrid fields={numeric}>
					<span className="inst-label-xs">#</span>
					{numeric.map((f) => (
						<span
							key={f}
							className="inst-label-xs min-h-[2.3em] text-center leading-[1.15] [overflow-wrap:anywhere]"
						>
							{SET_FIELD_LABEL[f]?.() ?? f}
						</span>
					))}
					<span className="inst-label-xs text-right">✓</span>
				</SetGrid>
			</div>

			{rows.map((r, i) => (
				<div key={r.key} className={cn('border-b border-line px-4 py-1.5', r.done && 'bg-panel')}>
					<SetGrid fields={numeric}>
						<button
							type="button"
							aria-label={m.btn_delete()}
							onClick={() => onRemove(r.key)}
							className="text-left font-mono text-[12px] text-ink-faint active:text-flag"
						>
							{i + 1}
						</button>
						{numeric.map((f) => (
							<input
								key={f}
								type="number"
								inputMode="decimal"
								step="any"
								aria-label={`${SET_FIELD_LABEL[f]?.() ?? f} · ${exName} · ${i + 1}`}
								placeholder="–"
								value={r[f as keyof WorkoutSet] == null ? '' : String(r[f as 'weight'])}
								onChange={(e) => {
									const n = Number.parseFloat(e.currentTarget.value);
									onPatch(r.key, {
										[f]: e.currentTarget.value === '' || Number.isNaN(n) ? null : n,
									});
								}}
								className={cn(
									'min-w-0 border-b bg-transparent px-0 py-1 text-center font-mono text-[16px] outline-none focus:border-flag',
									r[f as 'weight'] == null
										? 'border-line text-ink-faint'
										: 'border-line-2 text-ink',
								)}
							/>
						))}
						<span className="flex justify-end">
							<Tick
								checked={r.done}
								label={`${m.lbl_done()} · ${i + 1}`}
								onChange={(next) => onPatch(r.key, { done: next })}
							/>
						</span>
					</SetGrid>
					{fields.includes('grip') ? (
						<div className="mt-1 flex items-center gap-2">
							<span className="inst-label-xs shrink-0">{m.field_grip()}</span>
							<div className="min-w-0 flex-1">
								<PanelSelect
									value={r.grip ?? ''}
									compact
									items={GRIPS.map((g) => ({ value: g, label: gripLabel(g) }))}
									onValueChange={(v) => onPatch(r.key, { grip: v || null })}
								/>
							</div>
						</div>
					) : null}
				</div>
			))}

			<button
				type="button"
				onClick={onAdd}
				className="inst-label-xs w-full border-b border-line px-4 py-3 text-left text-flag active:bg-panel-2"
			>
				+ {m.train_add_set()}
			</button>

			<SubBand label={m.train_target()} reading={spec.grip ? gripLabel(spec.grip) : exId}>
				<Note className="border-b border-line pb-2.5 text-[12.5px]">{spec.what}</Note>
			</SubBand>
		</Band>
	);
}

/** The set table's column grid: index · n numeric columns · tick. Kept in one
 *  place so the legend row and every set line are guaranteed to align — a
 *  spec sheet whose columns drift is worse than no columns at all. */
function SetGrid({ fields, children }: { fields: SetField[]; children: React.ReactNode }) {
	return (
		<div
			className="grid items-center gap-x-1.5"
			style={{ gridTemplateColumns: `14px repeat(${fields.length}, minmax(0, 1fr)) 26px` }}
		>
			{children}
		</div>
	);
}

// ────────────────────────────────────────────────────────────── the one popup

/**
 * The variant / grip / add-exercise picker — the only floating surface in the
 * direction, and square, unshadowed and hairlined so it reads as a panel that
 * slid out rather than a card that appeared.
 *
 * Base UI rather than a native `<select>`: on Android a native select opens a
 * Material dialog with rounded corners and a ripple, which is precisely the
 * consumer surface this direction is arguing against — and it cannot be styled
 * away.
 */
function PanelSelect({
	value,
	items,
	onValueChange,
	placeholder,
	compact,
}: {
	value: string;
	items: { value: string; label: string; hint?: string }[];
	onValueChange: (value: string) => void;
	placeholder?: string;
	compact?: boolean;
}) {
	return (
		<Select.Root
			value={value}
			onValueChange={(v) => onValueChange((v as string | null) ?? '')}
			items={items}
		>
			<Select.Trigger
				className={cn(
					'flex w-full items-center gap-2 border-b border-line-2 bg-transparent text-left text-ink outline-none focus-visible:border-flag',
					compact ? 'py-1 font-mono text-[13px]' : 'py-1.5 text-[14px]',
				)}
			>
				<Select.Value className="min-w-0 flex-1 truncate">
					{(v: string | null) => {
						const found = items.find((i) => i.value === v);
						return found ? found.label : (placeholder ?? '—');
					}}
				</Select.Value>
				<Select.Icon className="shrink-0 font-mono text-[11px] text-ink-faint">▾</Select.Icon>
			</Select.Trigger>
			<Select.Portal>
				<Select.Positioner
					sideOffset={0}
					alignItemWithTrigger={false}
					className="z-40 w-[var(--anchor-width)]"
				>
					<Select.Popup className="max-h-[60dvh] w-full overflow-y-auto border border-line-2 bg-panel-2 py-0 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.9)]">
						{items.map((item) => (
							<Select.Item
								key={item.value}
								value={item.value}
								className="flex cursor-default items-baseline gap-2 border-b border-line px-3 py-2.5 text-[14px] text-ink-dim outline-none last:border-b-0 data-[highlighted]:bg-panel data-[selected]:text-ink"
							>
								<Select.ItemIndicator className="w-2 shrink-0 font-mono text-[11px] text-flag">
									›
								</Select.ItemIndicator>
								<span className="min-w-0 flex-1">
									<Select.ItemText>{item.label}</Select.ItemText>
									{item.hint ? <span className="inst-label-xs block">{item.hint}</span> : null}
								</span>
							</Select.Item>
						))}
					</Select.Popup>
				</Select.Positioner>
			</Select.Portal>
		</Select.Root>
	);
}
