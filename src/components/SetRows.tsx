// Set rows — the densest thing in the app, and the place this direction is most
// likely to break.
//
// Seven loggable fields (weight · edge · time · reps · grip · rest · effort) have
// to be typed one-handed, mid-set, at 360px, with a 16px minimum font size on the
// inputs. 7 × 16px-legible does not fit one row: at four columns each cell is
// ~74px, which is the floor. So a set is a 4-column block that wraps to two rows,
// with the tick as the eighth cell — a shape that stays regular however many
// fields an exercise actually logs.
//
// TOUCH SIZE
// ----------
// Every control here is at least 44px. The prototype used 34px and the athlete's
// answer on the timer — "make it 48px if possible" — is about the same problem
// one screen over: chalky fingers on a phone clipped to a board. 44px rather than
// 48px is the trade this grid can afford; at 48px a two-row set block grows by
// 28px and four exercises' worth pushes the last card off a second screenful.
// 48px (`button`'s `touch` size) is reserved for the timer, which is operated
// without looking at it.
//
// The Log screen renders the *same* data read-only and much tighter: a past set
// is a record, not a form, and 28 sessions of editable inputs is the fastest way
// to make a history screen feel like a spreadsheet that has to be finished.
import { Check } from 'lucide-react';
import type { Range } from '$lib/content/types';
import { formatRange, GRIPS, gripLabel } from '$lib/format';
import type { ExerciseId } from '$lib/ids';
import type { SetField } from '$lib/loggedSet';
import * as m from '$lib/paraglide/messages';
import type { LoggedSet } from '$lib/types';
import { cn } from '$lib/utils';
import { Picker } from './ui/Picker';
import { input } from './ui/variants';

// Units are appended bare rather than parenthesised, and `(s)` is stripped from
// the two messages that carry it. Four characters of punctuation is the
// difference between "DESCANSO (S)" clipping in a 73px column and fitting.
const strip = (s: string) => s.replace(/\s*\(s\)\s*$/i, '');

const FIELD_LABEL: Record<SetField, () => string> = {
	loadKg: () => `${m.field_weight()} kg`,
	edgeMm: () => `${m.field_edge()} mm`,
	workSec: () => `${strip(m.field_time())} s`,
	reps: m.field_reps,
	grip: m.field_grip,
	restSec: () => strip(m.field_rest()),
	rpe: m.field_rpe,
};

/** Compact label for the read-only table: the unit is in the value there. */
const FIELD_ABBR: Record<SetField, () => string> = {
	loadKg: m.field_weight,
	edgeMm: m.field_edge,
	workSec: m.field_time,
	reps: m.field_reps,
	grip: m.field_grip,
	restSec: m.field_rest,
	rpe: m.field_rpe,
};

const NUMERIC: SetField[] = ['loadKg', 'edgeMm', 'workSec', 'reps', 'restSec', 'rpe'];

/** 44px: the touch floor for anything typed into mid-set. */
const CELL = 'h-11';

function parseNum(v: string): number | null {
	if (v.trim() === '') return null;
	const n = Number.parseFloat(v);
	return Number.isNaN(n) ? null : n;
}

export function SetEditor({
	exerciseId,
	index,
	set,
	fields,
	prescribedRpe,
	onChange,
}: {
	exerciseId: ExerciseId;
	index: number;
	set: LoggedSet;
	fields: SetField[];
	/**
	 * The prescribed effort range, shown in the RPE column beside the input.
	 *
	 * A display, not data: `prescription.rpe` is one range per *variant*, moved
	 * only by an override, so every set of a task carries the same one and none
	 * of them stores it. Unlike the load, nothing scales it — `effectiveVariant`
	 * puts the phase's intensity into `loadKg` and its volume into
	 * `sets`/`rounds`, and never touches `rpe`.
	 *
	 * It is here rather than only in `TaskCard`'s prescription band because
	 * judging one number against another is not something anyone does across a
	 * card boundary mid-set — and since `rpe` is the one column that no longer
	 * opens prefilled (#89), it is the column with nothing at all in it to go on.
	 *
	 * Named for the glossary: *target* is the first word on **Prescription**'s
	 * `_Avoid_` list (`CONTEXT.md`), and ADR 0014 binds that on names.
	 */
	prescribedRpe?: Range;
	onChange: (next: LoggedSet) => void;
}) {
	return (
		<div
			className={cn(
				// A finished set is marked by colour, not by fading it out.
				//
				// It used to be `opacity-55`, which looked fine on the 16px values and
				// destroyed everything small around them: the 9px column labels went
				// 5.13:1 → 2.57:1, the grip value 7.45 → 3.33, the "done" tick 7.60 →
				// 3.31. Twenty of the twenty-four contrast failures measured on the
				// prototype were this one line. Opacity dims the *text*, and at 9–11px
				// there is no room between "de-emphasised" and "unreadable".
				//
				// Direction B hit the same wall independently, which is why the rule is
				// in the vocabulary (`ui/variants.ts`, `chip`) rather than only here.
				'rounded-md border p-2 transition-colors',
				set.done ? 'border-teal/30 bg-teal/[0.06]' : 'border-line-soft bg-panel-2/50',
			)}
		>
			<div className="grid grid-cols-4 gap-1.5">
				{fields.map((f) => {
					const id = `${exerciseId}-${index}-${f}`;
					// Only the effort column carries what was asked for, and only when
					// the variant prescribes it. `shrink-0` on the range and `truncate`
					// on the label is the priority order said out loud: at 74px the
					// column gives up its own name before it gives up the number.
					// Colour and not `opacity` separates the two — at 9px there is no
					// room between de-emphasised and unreadable — and `--chalk` is
					// already what a prescribed value is drawn in one band above.
					const presc = f === 'rpe' && prescribedRpe ? formatRange(prescribedRpe) : null;
					return (
						<label key={f} className="flex min-w-0 flex-col gap-0.5" htmlFor={id}>
							<span className="flex min-w-0 items-baseline gap-1">
								<span className="microlabel truncate">{FIELD_LABEL[f]()}</span>
								{presc ? <span className="microlabel num shrink-0 text-chalk">{presc}</span> : null}
							</span>
							{f === 'grip' ? (
								<Picker
									value={set.grip}
									ariaLabel={m.field_grip()}
									placeholder="—"
									options={GRIPS.map((g) => ({ value: g, label: gripLabel(g) }))}
									onChange={(v) => onChange({ ...set, grip: GRIPS.find((g) => g === v) ?? null })}
									className={cn(CELL, 'px-1.5 text-[12px]')}
								/>
							) : (
								<input
									id={id}
									// The wrapping `<label>` now reads "RPE 8–9", and that text is
									// what a screen reader would announce as this field's name —
									// two numbers with nothing to say which is the ask. So the
									// name is given in words instead. It still carries everything
									// the column shows, which is the vocabulary's `aria-label`
									// rule: the attribute replaces a control's content rather than
									// adding to it.
									aria-label={presc ? m.field_rpe_presc({ range: presc }) : undefined}
									className={input({ class: cn(CELL, 'py-0') })}
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

				{/* The tick takes the last cell of the grid rather than a row of its own.
				    #54 measured that a switch inside a long scrolling list does not block
				    the scroll on this device, so it is safe here. */}
				<div className="flex min-w-0 flex-col gap-0.5">
					<span className="microlabel truncate">#{index + 1}</span>
					<button
						type="button"
						aria-pressed={set.done}
						onClick={() => onChange({ ...set, done: !set.done })}
						className={cn(
							CELL,
							'flex items-center justify-center gap-1 rounded-md border text-[11px] transition-colors',
							set.done
								? 'border-teal/50 bg-teal/10 text-teal'
								: 'border-line bg-panel-2 text-ink-faint',
						)}
					>
						<Check size={14} strokeWidth={set.done ? 2.6 : 1.8} />
						<span className="truncate">{m.lbl_done()}</span>
					</button>
				</div>
			</div>
		</div>
	);
}

/** Past sets: one header row per exercise, then one line per set. */
export function SetTable({ fields, sets }: { fields: SetField[]; sets: LoggedSet[] }) {
	// Only the columns this exercise actually recorded something in. A past
	// session is fixed data, so an all-null column is pure noise.
	const cols = fields.filter((f) =>
		sets.some((s) => (f === 'grip' ? s.grip != null : s[f as keyof LoggedSet] != null)),
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
										: (s[f as keyof LoggedSet] ?? '—')}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
