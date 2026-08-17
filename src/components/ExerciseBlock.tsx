// One exercise on `/train`: the prescription, the variant switch, and the set
// rows the athlete types into.
//
// THE SET ROW IS THE DENSEST THING IN THE APP, and it is where this direction
// nearly broke. Seven loggable fields (weight · edge · time · reps · grip ·
// rest · RPE) at 360px, with an index and a done tick, is 9 columns across
// ~310px of usable width — 34px each. A 16px input cannot live in 34px, and the
// field labels certainly cannot: `field_rest` is "Rest (s)" in English and
// "Descanso (s)" in pt-BR.
//
// So the row is not a row. It is a **4-column keypad block**: index+tick, then
// the fields, wrapping to a second line. Each cell is ~77px, which fits a
// 16px mono value and a 9px label, and the cell grid is drawn with 1px gaps
// over a `--line` ground so the separators cost no space at all. Two lines of
// keypad per set is more vertical space than a table row, and it is the only
// layout at this width that does not either shrink the type below thumb-legible
// or introduce horizontal scrolling.
//
// The label heights are fixed at two lines because pt-BR needs two and en-US
// needs one; letting them differ makes the grid jump when the locale switches.
import type { Variant } from '$lib/content/types';
import * as m from '$lib/paraglide/messages';
import { rich } from '$lib/prototype/rich';
import { cn } from '$lib/utils';
import type { SetField } from '../prototype-fixtures';
import { Bench, KV, Lbl, Prose, Row, Section, Swatch, Tick } from './kit';

export interface SetRow {
	id: string;
	values: Partial<Record<SetField, string>>;
	done: boolean;
}

const FIELD_LABEL: Record<SetField, () => string> = {
	weight: m.field_weight,
	edge: m.field_edge,
	time: m.field_time,
	reps: m.field_reps,
	grip: m.field_grip,
	rest: m.field_rest,
	rpe: m.field_rpe,
};

const GRIP_LABEL: Record<string, () => string> = {
	'half-crimp': m.grip_half_crimp,
	'open-hand': m.grip_open_hand,
	'full-crimp': m.grip_full_crimp,
	pinch: m.grip_pinch,
	sloper: m.grip_sloper,
	wrist: m.grip_wrist,
	jug: m.grip_jug,
};

/** Which per-set fields the logger shows. Mirrors `fieldsFor` in
 *  `prototype-fixtures.ts`, which is module-private there — repeated rather
 *  than exported because a variant swap changes the answer (grip comes and
 *  goes) and the fixture only ever computes it for variant 0. */
export function fieldsFor(spec: Variant): SetField[] {
	const f: SetField[] = ['weight', 'edge', 'time', 'reps'];
	if (spec.grip) f.push('grip');
	f.push('rest', 'rpe');
	return f;
}

const rng = (r?: { min: number; max: number }): string | null =>
	r ? (r.min === r.max ? String(r.min) : `${r.min}–${r.max}`) : null;

/** The prescription, as printed parameters. Only the fields this variant sets. */
function prescription(spec: Variant): { k: string; v: string }[] {
	const out: { k: string; v: string }[] = [];
	const push = (k: string, v: string | null) => {
		if (v != null) out.push({ k, v });
	};
	push(m.presc_sets(), rng(spec.sets));
	push(m.presc_reps(), rng(spec.reps));
	push(m.presc_rounds(), rng(spec.rounds));
	push(m.presc_work(), rng(spec.workSec));
	push(m.presc_rest(), rng(spec.restSec));
	push(m.presc_setrest(), rng(spec.setRestSec));
	push(m.presc_load(), rng(spec.loadKg));
	push(m.presc_edge(), rng(spec.edgeMm));
	push(m.presc_intensity(), rng(spec.intensityPct));
	push(m.presc_rpe(), rng(spec.rpe));
	if (spec.toFailure) push(m.presc_failure(), '✓');
	if (spec.cnsCost) {
		const cost =
			spec.cnsCost === 'low' ? m.cost_low() : spec.cnsCost === 'mod' ? m.cost_mod() : m.cost_high();
		push(m.presc_cns(), cost);
	}
	return out;
}

/** Cell keys for the padding that squares the keypad off. Named, not indexed. */
const PAD_KEYS = ['pad-a', 'pad-b', 'pad-c'];

export function ExerciseBlock({
	index,
	exId,
	name,
	cat,
	catVar,
	variants,
	variantIndex,
	onVariant,
	rows,
	onValue,
	onToggle,
	onAdd,
}: {
	index: string;
	exId: string;
	name: string;
	cat: string;
	catVar: string;
	variants: Variant[];
	variantIndex: number;
	onVariant: (i: number) => void;
	rows: SetRow[];
	onValue: (rowId: string, field: SetField, value: string) => void;
	onToggle: (rowId: string) => void;
	onAdd: () => void;
}) {
	const spec = variants[variantIndex] ?? variants[0];
	const fields = fieldsFor(spec);
	const presc = prescription(spec);
	const doneCount = rows.filter((r) => r.done).length;
	// Cells per set: index+tick, then the fields. Squared off to a multiple of 4.
	const padding = (4 - ((fields.length + 1) % 4)) % 4;

	return (
		<Section accent={catVar} index={index} meta={`${doneCount}/${rows.length}`} title={name}>
			<Row>
				<div className="flex items-center gap-2">
					<Swatch varName={catVar} />
					<Lbl className="min-w-0 flex-1 truncate">{cat}</Lbl>
					<Lbl className="shrink-0 text-ink-faint">{exId}</Lbl>
				</div>
				<div className="mt-2 text-[13px] text-ink leading-snug">{spec.what}</div>
				{spec.note ? <Prose className="mt-1 text-[13px]">{rich(spec.note)}</Prose> : null}
			</Row>

			{/* The variant switch. A native select: on Android it opens the system
			    picker, which is one-handed, thumb-sized and needs no chrome of its
			    own — which is exactly what this direction wants. */}
			<Row>
				<Lbl className="block">{m.swap_label()}</Lbl>
				<select
					aria-label={m.swap_label()}
					className="bench-input mt-1 appearance-none pr-4"
					onChange={(e) => onVariant(Number(e.target.value))}
					value={variantIndex}
				>
					{variants.map((v, i) => (
						<option key={v.name} value={i}>
							{v.name}
							{v.tool ? ` · ${v.tool}` : ''}
							{v.speed ? ` · ${v.speed}` : ''}
						</option>
					))}
				</select>
			</Row>

			{/* The prescription. */}
			<Row>
				<Lbl className="block">{m.train_target()}</Lbl>
				<div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
					{presc.map((p) => (
						<KV k={p.k} key={p.k} v={p.v} />
					))}
				</div>
				{spec.why.length > 0 ? (
					<details className="mt-2">
						<summary className="lbl cursor-pointer list-none text-ink-faint">
							{m.study_applies()}
						</summary>
						{spec.why.map((w) => (
							<Prose className="mt-1.5 text-[13px]" key={w.slice(0, 24)}>
								{rich(w)}
							</Prose>
						))}
					</details>
				) : null}
			</Row>

			{/* The keypad. */}
			{rows.map((r, i) => (
				<div className="border-line border-b" key={r.id}>
					<div className="grid grid-cols-4 gap-px bg-line">
						<div className="flex items-center gap-1.5 bg-bg px-2 py-1.5">
							<Lbl className="text-ink-faint">{String(i + 1).padStart(2, '0')}</Lbl>
							<Tick label={`${name} ${i + 1}`} on={r.done} onToggle={() => onToggle(r.id)} />
						</div>
						{fields.map((f) => (
							<div className="min-w-0 bg-bg px-2 py-1.5" key={f}>
								<span className="lbl block h-[24px] text-[9px] text-ink-faint leading-[1.2]">
									{FIELD_LABEL[f]()}
								</span>
								{f === 'grip' ? (
									<span className="num block truncate text-[13px] text-ink-dim">
										{r.values.grip ? (GRIP_LABEL[r.values.grip]?.() ?? r.values.grip) : '—'}
									</span>
								) : (
									<input
										aria-label={`${name} ${i + 1} ${FIELD_LABEL[f]()}`}
										className={cn('bench-input', r.done && 'text-ink-dim')}
										inputMode="decimal"
										onChange={(e) => onValue(r.id, f, e.target.value)}
										placeholder="—"
										value={r.values[f] ?? ''}
									/>
								)}
							</div>
						))}
						{PAD_KEYS.slice(0, padding).map((k) => (
							<div className="bg-bg" key={k} />
						))}
					</div>
				</div>
			))}

			<Row>
				<Bench onClick={onAdd} wide>
					{m.train_add_set()}
				</Bench>
			</Row>
		</Section>
	);
}
