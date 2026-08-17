// Set rows — the densest thing in the app, and the place this direction is
// most likely to break.
//
// Seven loggable fields (weight · edge · time · reps · grip · rest · RPE) have
// to be typed one-handed, mid-set, at 360px, with a 16px minimum font size on
// the inputs. 7 × 16px-legible does not fit one row: at four columns each cell
// is ~74px, which is the floor. So a set is a 4-column block that wraps to two
// rows, with the tick as the eighth cell — a shape that stays regular however
// many fields an exercise actually logs.
//
// The Log screen renders the *same* data read-only and much tighter: a past set
// is a record, not a form, and 28 sessions of editable inputs is the fastest
// way to make a history screen feel like a spreadsheet.
import { Check } from 'lucide-react';
import * as m from '$lib/paraglide/messages';
import type { WorkoutSet } from '$lib/types';
import { cn } from '$lib/utils';
import type { SetField } from '../prototype-fixtures';
import { GRIPS, gripLabel } from './format';
import { Picker } from './Picker';
import { input } from './ui';

// Units are appended bare rather than parenthesised, and `(s)` is stripped from
// the two messages that carry it. Four characters of punctuation is the
// difference between "DESCANSO (S)" clipping in a 73px column and fitting.
const strip = (s: string) => s.replace(/\s*\(s\)\s*$/i, '');

const FIELD_LABEL: Record<SetField, () => string> = {
	weight: () => `${m.field_weight()} kg`,
	edge: () => `${m.field_edge()} mm`,
	time: () => `${strip(m.field_time())} s`,
	reps: m.field_reps,
	grip: m.field_grip,
	rest: () => strip(m.field_rest()),
	rpe: m.field_rpe,
};

/** Compact label for the read-only table: the unit is in the value there. */
const FIELD_ABBR: Record<SetField, () => string> = {
	weight: m.field_weight,
	edge: m.field_edge,
	time: m.field_time,
	reps: m.field_reps,
	grip: m.field_grip,
	rest: m.field_rest,
	rpe: m.field_rpe,
};

const NUMERIC: SetField[] = ['weight', 'edge', 'time', 'reps', 'rest', 'rpe'];

function parseNum(v: string): number | null {
	if (v.trim() === '') return null;
	const n = Number.parseFloat(v);
	return Number.isNaN(n) ? null : n;
}

export function SetEditor({
	exId,
	index,
	set,
	fields,
	onChange,
}: {
	exId: string;
	index: number;
	set: WorkoutSet;
	fields: SetField[];
	onChange: (next: WorkoutSet) => void;
}) {
	return (
		<div
			className={cn(
				// A finished set is marked by colour, not by fading it out.
				//
				// It used to be `opacity-55`, which looked fine on the 16px values and
				// destroyed everything small around them: the 9px column labels went
				// 5.13:1 → 2.57:1, the grip value 7.45 → 3.33, the "done" tick 7.60 →
				// 3.31. Twenty of the twenty-four contrast failures measured on this
				// branch were this one line. Opacity dims the *text*, and at 9–11px
				// there is no room between "de-emphasised" and "unreadable".
				//
				// Direction B hit the same wall independently and wrote it down, which
				// is a good sign the rule belongs in the vocabulary (#53), not here.
				'rounded-md border p-2 transition-colors',
				set.done ? 'border-teal/30 bg-teal/[0.06]' : 'border-line-soft bg-panel-2/50',
			)}
		>
			<div className="grid grid-cols-4 gap-1.5">
				{fields.map((f) => {
					const id = `${exId}-${index}-${f}`;
					return (
						<label key={f} className="flex min-w-0 flex-col gap-0.5" htmlFor={id}>
							<span className="microlabel truncate">{FIELD_LABEL[f]()}</span>
							{f === 'grip' ? (
								<Picker
									value={set.grip}
									ariaLabel={m.field_grip()}
									placeholder="—"
									options={GRIPS.map((g) => ({ value: g, label: gripLabel(g) }))}
									onChange={(v) => onChange({ ...set, grip: v })}
									className="h-[34px] px-1.5 text-[12px]"
								/>
							) : (
								<input
									id={id}
									className={input({ class: 'h-[34px] py-0' })}
									type="number"
									inputMode="decimal"
									step="any"
									value={NUMERIC.includes(f) ? (set[f] ?? '') : ''}
									onChange={(e) => onChange({ ...set, [f]: parseNum(e.currentTarget.value) })}
								/>
							)}
						</label>
					);
				})}

				{/* The tick takes the last cell of the grid rather than a row of its
				    own. #54 measured that a switch inside a long scrolling list does
				    not block the scroll on this device, so it is safe here. */}
				<div className="flex min-w-0 flex-col gap-0.5">
					<span className="microlabel truncate">#{index + 1}</span>
					<button
						type="button"
						aria-pressed={set.done}
						onClick={() => onChange({ ...set, done: !set.done })}
						className={cn(
							'flex h-[34px] items-center justify-center gap-1 rounded-md border text-[11px] transition-colors',
							set.done
								? 'border-teal/50 bg-teal/10 text-teal'
								: 'border-line bg-panel-2 text-ink-faint',
						)}
					>
						<Check size={13} strokeWidth={set.done ? 2.6 : 1.8} />
						<span className="truncate">{m.lbl_done()}</span>
					</button>
				</div>
			</div>
		</div>
	);
}

/** Past sets: one header row per exercise, then one line per set. */
export function SetTable({ fields, sets }: { fields: SetField[]; sets: WorkoutSet[] }) {
	// Only the columns this exercise actually recorded something in. A past
	// session is fixed data, so an all-null column is pure noise.
	const cols = fields.filter((f) =>
		sets.some((s) => (f === 'grip' ? s.grip != null : s[f as keyof WorkoutSet] != null)),
	);
	if (cols.length === 0) return null;

	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-full border-collapse text-left">
				<thead>
					<tr>
						<th className="eyebrow w-6 pb-1 font-normal">#</th>
						{cols.map((f) => (
							<th key={f} className="eyebrow pb-1 pl-2 text-right font-normal">
								{FIELD_ABBR[f]()}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{sets.map((s, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: a set's identity is its position in the session
						<tr key={i} className="border-t border-line-soft">
							<td className="num py-1 text-[11px] text-ink-faint">{i + 1}</td>
							{cols.map((f) => (
								<td key={f} className="num py-1 pl-2 text-right text-[12px] text-ink-dim">
									{f === 'grip'
										? s.grip
											? gripLabel(s.grip)
											: '—'
										: (s[f as keyof WorkoutSet] ?? '—')}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
