// One exercise, mid-session: what to do, what was chosen, what was done.
//
// The card is three bands with no gaps between them — header, prescription,
// sets — because a stack of separated boxes at this density reads as clutter
// while a stack of ruled bands reads as a table. The category accent is a 2px
// left edge and nothing else: it is the only place an exercise's colour
// appears, and it groups four cards at a glance without tinting anything.
import { Plus, Timer as TimerIcon } from 'lucide-react';
import type { Variant } from '$lib/content/types';
import * as m from '$lib/paraglide/messages';
import type { WorkoutSet } from '$lib/types';
import { cn } from '$lib/utils';
import type { SetField } from '../prototype-fixtures';
import {
	costLabel,
	formatEdge,
	formatLoad,
	formatRange,
	formatSecondsRange,
	gripLabel,
} from './format';
import { Picker } from './Picker';
import { SetEditor } from './sets';
import { button, chip, Eyebrow, Prose } from './ui';

/** The prescription, as a wrapping row of label/value pairs. Mono values,
 *  uppercase micro-labels: it has to be scannable without being read. */
function Prescription({ spec }: { spec: Variant }) {
	const pairs: [string, string][] = [];
	if (spec.sets) pairs.push([m.presc_sets(), formatRange(spec.sets)]);
	if (spec.reps) pairs.push([m.presc_reps(), formatRange(spec.reps)]);
	if (spec.workSec) pairs.push([m.presc_work(), formatSecondsRange(spec.workSec)]);
	if (spec.restSec) pairs.push([m.presc_rest(), formatSecondsRange(spec.restSec)]);
	if (spec.rounds) pairs.push([m.presc_rounds(), `×${formatRange(spec.rounds)}`]);
	if (spec.setRestSec) pairs.push([m.presc_setrest(), formatSecondsRange(spec.setRestSec)]);
	if (spec.loadKg) pairs.push([m.presc_load(), formatLoad(spec.loadKg)]);
	if (spec.edgeMm) pairs.push([m.presc_edge(), formatEdge(spec.edgeMm)]);
	if (spec.intensityPct) pairs.push([m.presc_intensity(), `${formatRange(spec.intensityPct)}%`]);
	if (spec.rpe) pairs.push([m.presc_rpe(), formatRange(spec.rpe)]);

	return (
		<div>
			<div className="flex flex-wrap gap-x-3 gap-y-1">
				{pairs.map(([label, value]) => (
					<span key={label} className="whitespace-nowrap">
						<span className="eyebrow">{label}</span>{' '}
						<span className="num text-[12.5px] text-chalk">{value}</span>
					</span>
				))}
			</div>
			{spec.grip || spec.toFailure || spec.cnsCost ? (
				<div className="mt-1.5 flex flex-wrap gap-1">
					{spec.grip ? (
						<span className={chip({ tone: 'ghost' })}>{gripLabel(spec.grip)}</span>
					) : null}
					{spec.toFailure ? (
						<span className={chip({ tone: 'stop' })}>{m.presc_failure()}</span>
					) : null}
					{spec.cnsCost ? (
						<span className={chip({ tone: 'ghost' })}>
							{m.presc_cns()} {costLabel(spec.cnsCost)}
						</span>
					) : null}
				</div>
			) : null}
			{spec.note ? (
				<p className="prose-inline mt-1.5 text-[11.5px] leading-snug text-ink-faint">
					<Prose value={spec.note} />
				</p>
			) : null}
		</div>
	);
}

export interface TrainItemState {
	exId: string;
	exName: string;
	cat: string;
	catVar: string;
	variantIndex: number;
	variants: { name: string; tool?: string; speed?: string }[];
	spec: Variant;
	fields: SetField[];
	sets: WorkoutSet[];
	timed: boolean;
}

export function ExerciseCard({
	item,
	active,
	onSelectVariant,
	onUseTimer,
	onChangeSet,
	onAddSet,
}: {
	item: TrainItemState;
	active: boolean;
	onSelectVariant: (index: number) => void;
	onUseTimer: () => void;
	onChangeSet: (index: number, next: WorkoutSet) => void;
	onAddSet: () => void;
}) {
	// Two-axis exercises (tool × speed) get two pickers; everything else gets one
	// list. Mirrors the SvelteKit picker, which is the behaviour reference.
	const twoAxis = item.variants.length > 1 && item.variants.every((v) => v.tool && v.speed);
	const current = item.variants[item.variantIndex] ?? item.variants[0];
	const tools = [...new Set(item.variants.map((v) => v.tool))].filter(Boolean) as string[];
	const speeds = [...new Set(item.variants.map((v) => v.speed))].filter(Boolean) as string[];
	const pick = (tool?: string, speed?: string) => {
		const i = item.variants.findIndex((v) => v.tool === tool && v.speed === speed);
		if (i >= 0) onSelectVariant(i);
	};
	const doneCount = item.sets.filter((s) => s.done).length;

	return (
		<div
			className={cn(
				'overflow-hidden rounded-lg border border-l-2 border-line bg-panel',
				active && 'border-t-flag/40 border-r-flag/40 border-b-flag/40',
			)}
			style={{ borderLeftColor: `var(${item.catVar})` }}
		>
			<div className="flex items-center gap-2 px-3 py-2">
				<div className="min-w-0 flex-1">
					<div className="truncate text-[14px] leading-tight font-semibold text-ink">
						{item.exName}
					</div>
					<Eyebrow className="mt-0.5 truncate">{item.cat}</Eyebrow>
				</div>
				<span className="num shrink-0 text-[11px] text-ink-faint">
					{doneCount}/{item.sets.length}
				</span>
				{item.timed ? (
					<button
						type="button"
						aria-label={m.timer_use()}
						onClick={onUseTimer}
						className={button({ kind: 'bare', class: cn('w-8 px-0', active && 'text-flag') })}
					>
						<TimerIcon size={16} />
					</button>
				) : null}
			</div>

			{item.variants.length > 1 ? (
				<div className="border-t border-line-soft px-3 py-2">
					<Eyebrow className="mb-1">{m.swap_label()}</Eyebrow>
					{twoAxis ? (
						<div className="flex gap-1.5">
							<Picker
								ariaLabel={m.var_tool()}
								value={current.tool ?? null}
								options={tools.map((x) => ({ value: x, label: x }))}
								onChange={(v) => pick(v, current.speed)}
							/>
							<Picker
								ariaLabel={m.var_speed()}
								value={current.speed ?? null}
								options={speeds.map((x) => ({ value: x, label: x }))}
								onChange={(v) => pick(current.tool, v)}
							/>
						</div>
					) : (
						<Picker
							ariaLabel={m.swap_label()}
							value={String(item.variantIndex)}
							options={item.variants.map((v, i) => ({ value: String(i), label: v.name }))}
							onChange={(v) => onSelectVariant(Number(v))}
						/>
					)}
				</div>
			) : null}

			<div className="border-t border-line-soft px-3 py-2">
				<Eyebrow className="mb-1">{m.train_target()}</Eyebrow>
				<Prescription spec={item.spec} />
			</div>

			<div className="flex flex-col gap-1.5 border-t border-line-soft px-3 py-2">
				{item.sets.map((s, i) => (
					<SetEditor
						// biome-ignore lint/suspicious/noArrayIndexKey: a set's identity is its position in the exercise
						key={i}
						exId={item.exId}
						index={i}
						set={s}
						fields={item.fields}
						onChange={(next) => onChangeSet(i, next)}
					/>
				))}
				<button type="button" onClick={onAddSet} className={button({ class: 'self-start' })}>
					<Plus size={13} />
					{m.train_add_set()}
				</button>
			</div>
		</div>
	);
}
