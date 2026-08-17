// One exercise, one chapter.
//
// This is where the direction costs the most, and the cost is worth stating
// plainly rather than designing around. A set row logs up to seven fields —
// weight, edge, time, reps, grip, rest, RPE — and seven labelled inputs at
// editorial size is a screenful for one set. So a set is a *line* until you open
// it: closed it reads back what was logged, open it is the editor.
//
// The compromise inside the compromise: the editor is a two-column grid, not one
// field per line. One per line is what this direction's rules would say, and it
// made a single set four thumb-lengths tall. Two columns still clears 16px on the
// inputs — the iOS zoom floor, and iOS is best-effort (#54), but the number also
// happens to be the smallest thing worth reading with chalk on your hands.
import { useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { WorkoutSet } from '$lib/types';
import type { SetField, TrainItemFixture } from '../../prototype-fixtures';
import { Chapter, Disclose } from '../Editorial';
import { Prose } from '../Prose';

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

const FIELD_LABEL: Record<SetField, () => string> = {
	weight: () => m.field_weight(),
	edge: () => m.field_edge(),
	time: () => m.field_time(),
	reps: () => m.field_reps(),
	grip: () => m.field_grip(),
	rest: () => m.field_rest(),
	rpe: () => m.field_rpe(),
};

const range = (r?: { min: number; max: number }): string =>
	r == null ? '' : r.min === r.max ? String(r.min) : `${r.min}–${r.max}`;

/** The prescription, as label/value pairs, in the order the athlete reads it. */
function prescriptionRows(spec: TrainItemFixture['spec']): { label: string; value: string }[] {
	const rows: { label: string; value: string }[] = [];
	if (spec.sets) rows.push({ label: m.presc_sets(), value: range(spec.sets) });
	if (spec.rounds) rows.push({ label: m.presc_rounds(), value: range(spec.rounds) });
	if (spec.reps) rows.push({ label: m.presc_reps(), value: range(spec.reps) });
	if (spec.workSec) rows.push({ label: m.presc_work(), value: `${range(spec.workSec)} s` });
	if (spec.restSec) rows.push({ label: m.presc_rest(), value: `${range(spec.restSec)} s` });
	if (spec.setRestSec)
		rows.push({ label: m.presc_setrest(), value: `${range(spec.setRestSec)} s` });
	if (spec.loadKg) rows.push({ label: m.presc_load(), value: `${range(spec.loadKg)} kg` });
	if (spec.edgeMm) rows.push({ label: m.presc_edge(), value: `${range(spec.edgeMm)} mm` });
	if (spec.intensityPct)
		rows.push({ label: m.presc_intensity(), value: `${range(spec.intensityPct)} %` });
	if (spec.rpe) rows.push({ label: m.presc_rpe(), value: range(spec.rpe) });
	if (spec.grip)
		rows.push({ label: m.field_grip(), value: GRIP_LABEL[spec.grip]?.() ?? spec.grip });
	if (spec.cnsCost)
		rows.push({ label: m.presc_cns(), value: COST_LABEL[spec.cnsCost]?.() ?? spec.cnsCost });
	if (spec.toFailure) rows.push({ label: m.presc_rpe(), value: m.presc_failure() });
	return rows;
}

const SHOW: Record<Exclude<SetField, 'grip'>, (v: number) => string> = {
	weight: (v) => `${v} kg`,
	edge: (v) => `${v} mm`,
	time: (v) => `${v} s`,
	reps: (v) => `${v}×`,
	rest: (v) => `${v} s`,
	rpe: (v) => `RPE ${v}`,
};

/** A closed set row reads back as one line. Units are carried inline because the
 *  labels only exist in the open editor, and "38 · 4 · 180 · 9" is not a
 *  readback, it is a puzzle. */
function summarize(set: WorkoutSet, fields: SetField[]): string {
	const parts: string[] = [];
	for (const f of fields) {
		if (f === 'grip') {
			if (set.grip) parts.push(GRIP_LABEL[set.grip]?.() ?? set.grip);
			continue;
		}
		const v = set[f];
		if (v == null) continue;
		parts.push(SHOW[f](v));
	}
	return parts.join(' · ');
}

function SetLine({
	n,
	set,
	fields,
	onChange,
}: {
	n: number;
	set: WorkoutSet;
	fields: SetField[];
	onChange: (next: WorkoutSet) => void;
}) {
	const [open, setOpen] = useState(false);
	return (
		<li className="py-3">
			<div className="flex items-center gap-4">
				<button
					type="button"
					aria-label={m.lbl_done()}
					aria-pressed={set.done}
					onClick={() => onChange({ ...set, done: !set.done })}
					className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border ${
						set.done ? 'border-flag bg-flag text-primary-foreground' : 'border-line'
					}`}
				>
					<span aria-hidden="true">{set.done ? '✓' : ''}</span>
				</button>
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
					className="min-w-0 flex-1 text-left"
				>
					<span className="c-eyebrow block">{m.c_set_n({ n })}</span>
					<span className="mt-0.5 block truncate text-[15px] tabular-nums text-ink-dim">
						{summarize(set, fields)}
					</span>
				</button>
			</div>

			{open ? (
				<div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 pl-11">
					{fields.map((f) => {
						if (f === 'grip') {
							return (
								<div key={f}>
									<span className="c-eyebrow block">{FIELD_LABEL[f]()}</span>
									<span className="mt-1 block py-1 text-base text-ink">
										{set.grip ? (GRIP_LABEL[set.grip]?.() ?? set.grip) : '—'}
									</span>
								</div>
							);
						}
						return (
							<label key={f} className="block">
								<span className="c-eyebrow block">{FIELD_LABEL[f]()}</span>
								<input
									type="number"
									inputMode="decimal"
									value={set[f] ?? ''}
									onChange={(e) =>
										onChange({
											...set,
											[f]: e.target.value === '' ? null : Number(e.target.value),
										})
									}
									className="mt-1 w-full border-line border-b bg-transparent pb-1 text-base tabular-nums text-ink outline-none focus:border-flag"
								/>
							</label>
						);
					})}
				</div>
			) : null}
		</li>
	);
}

export function Exercise({ item, index }: { item: TrainItemFixture; index: number }) {
	const [sets, setSets] = useState<WorkoutSet[]>(item.sets);
	const [variant, setVariant] = useState(item.variantIndex);

	const chosen = item.variants[variant] ?? item.variants[item.variantIndex];

	return (
		<Chapter id={`ex-${item.exId}`} index={index} label={item.exName}>
			<p className="c-eyebrow" style={{ color: `var(${item.catVar})` }}>
				{item.cat}
			</p>
			<h2 className="c-display mt-2 text-[clamp(1.75rem,8vw,2.5rem)]">{item.exName}</h2>
			<p className="mt-3 text-[15px] text-ink-dim">
				{chosen?.name}
				{chosen?.name !== item.variantName ? ` ${m.swapped_tag()}` : ''}
			</p>
			{item.spec.what ? (
				<p className="mt-4 max-w-[40ch] text-[15px] text-ink-dim leading-relaxed">
					<Prose>{item.spec.what}</Prose>
				</p>
			) : null}

			<div className="mt-6">
				<Disclose label={m.swap_label()}>
					<ul className="divide-y divide-line border-line border-t border-b">
						{item.variants.map((v, i) => (
							<li key={v.name}>
								<button
									type="button"
									aria-pressed={i === variant}
									onClick={() => setVariant(i)}
									className={`w-full py-3 text-left text-[15px] ${
										i === variant ? 'text-flag' : 'text-ink-dim'
									}`}
								>
									{v.name}
									{v.tool ? ` · ${m.var_tool()}: ${v.tool}` : ''}
									{v.speed ? ` · ${m.var_speed()}: ${v.speed}` : ''}
								</button>
							</li>
						))}
					</ul>
				</Disclose>
			</div>

			<div className="mt-6">
				<Disclose label={m.train_target()} defaultOpen>
					<div className="grid grid-cols-2 gap-x-6">
						{prescriptionRows(item.spec).map((r) => (
							<div
								key={`${r.label}-${r.value}`}
								className="flex items-baseline justify-between gap-3 border-line border-b py-2"
							>
								<span className="text-[13px] text-ink-dim">{r.label}</span>
								<span className="text-[15px] tabular-nums text-ink">{r.value}</span>
							</div>
						))}
					</div>
					{item.spec.note ? (
						<p className="mt-3 text-[13px] text-ink-faint">
							<Prose>{item.spec.note}</Prose>
						</p>
					) : null}
					{item.spec.why?.map((w) => (
						<p key={w} className="mt-3 text-[13px] text-ink-faint leading-relaxed">
							<Prose>{w}</Prose>
						</p>
					))}
				</Disclose>
			</div>

			<ul className="mt-8 divide-y divide-line border-line border-t border-b">
				{sets.map((s, i) => (
					<SetLine
						// Sets have no identity of their own; position is what a set *is*.
						// biome-ignore lint/suspicious/noArrayIndexKey: a set is its position in the exercise
						key={i}
						n={i + 1}
						set={s}
						fields={item.fields}
						onChange={(next) => setSets((all) => all.map((x, j) => (j === i ? next : x)))}
					/>
				))}
			</ul>

			<div className="mt-5 flex flex-wrap items-center gap-6">
				<button
					type="button"
					onClick={() =>
						setSets((all) => [...all, { ...(all[all.length - 1] ?? sets[0]), done: false }])
					}
					className="border-ink border-b font-display text-[17px] text-ink"
				>
					{m.train_add_set()}
				</button>
				{item.timed ? (
					<button
						type="button"
						onClick={() => document.getElementById('timer')?.scrollIntoView({ block: 'start' })}
						className="c-eyebrow text-ink-dim"
					>
						{m.timer_use()}
					</button>
				) : null}
			</div>
		</Chapter>
	);
}
