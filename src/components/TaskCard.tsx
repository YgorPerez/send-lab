// One task, mid-session: what to do, what was chosen, what was done.
//
// A **task** is one exercise as it appears in one slot (`CONTEXT.md`) — the unit
// the athlete ticks off, and the thing this card is one of. The prototype called
// it an exercise card, which is a level up: the exercise is the library entry,
// the task is today's instance of it, and the difference is the whole reason
// completion keys on a `TaskKey` rather than an `ExerciseId` (ADR-0001).
//
// The card is three bands with no gaps between them — header, prescription,
// sets — because a stack of separated boxes at this density reads as clutter
// while a stack of ruled bands reads as a table. The category accent is a 2px
// left edge and nothing else: it is the only place an exercise's colour appears,
// and it groups four cards at a glance without tinting anything.
import { Plus, Timer as TimerIcon } from 'lucide-react';
import type { Variant } from '$lib/content/types';
import {
	costLabel,
	formatEdge,
	formatLoad,
	formatRange,
	formatSecondsRange,
	gripLabel,
} from '$lib/format';
import type { ExerciseId, TaskKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import type { LoggedSet } from '$lib/types';
import { cn } from '$lib/utils';
import type { SetField } from '../prototype-fixtures';
import { SetEditor } from './SetRows';
import { Picker } from './ui/Picker';
import { Eyebrow, Prose } from './ui/primitives';
import { button, chip } from './ui/variants';

/**
 * The prescription, as a wrapping row of label/value pairs.
 *
 * Mono values, uppercase micro-labels: it has to be scannable without being
 * read. Not exported — it is only ever the middle band of this card, and a
 * prescription outside a task has nothing to be a prescription *for*.
 *
 * `CONTEXT.md` defines a **prescription** as the targets *after* swaps,
 * overrides, weekly progression and phase scaling are all resolved. This
 * component renders one and does not resolve it. Today the fixture hands it
 * `ex.variants[0]` — the variant's built-in targets — because nothing overrides
 * them yet; when the store lands (#18) the resolution happens on the way in and
 * nothing here changes. That is the seam, and it is named rather than implied:
 * the prop used to be called `spec`, which quietly claimed nothing.
 */
function Prescription({ prescription }: { prescription: Variant }) {
	const pairs: [string, string][] = [];
	if (prescription.sets) pairs.push([m.presc_sets(), formatRange(prescription.sets)]);
	if (prescription.reps) pairs.push([m.presc_reps(), formatRange(prescription.reps)]);
	if (prescription.workSec) pairs.push([m.presc_work(), formatSecondsRange(prescription.workSec)]);
	if (prescription.restSec) pairs.push([m.presc_rest(), formatSecondsRange(prescription.restSec)]);
	if (prescription.rounds) pairs.push([m.presc_rounds(), `×${formatRange(prescription.rounds)}`]);
	if (prescription.setRestSec)
		pairs.push([m.presc_setrest(), formatSecondsRange(prescription.setRestSec)]);
	if (prescription.loadKg) pairs.push([m.presc_load(), formatLoad(prescription.loadKg)]);
	if (prescription.edgeMm) pairs.push([m.presc_edge(), formatEdge(prescription.edgeMm)]);
	if (prescription.intensityPct)
		pairs.push([m.presc_intensity(), `${formatRange(prescription.intensityPct)}%`]);
	if (prescription.rpe) pairs.push([m.presc_rpe(), formatRange(prescription.rpe)]);

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
			{prescription.grip || prescription.toFailure || prescription.cnsCost ? (
				<div className="mt-1.5 flex flex-wrap gap-1">
					{prescription.grip ? (
						<span className={chip({ tone: 'ghost' })}>{gripLabel(prescription.grip)}</span>
					) : null}
					{prescription.toFailure ? (
						<span className={chip({ tone: 'stop' })}>{m.presc_failure()}</span>
					) : null}
					{prescription.cnsCost ? (
						<span className={chip({ tone: 'ghost' })}>
							{m.presc_cns()} {costLabel(prescription.cnsCost)}
						</span>
					) : null}
				</div>
			) : null}
			{prescription.note ? (
				<p className="prose-inline mt-1.5 text-[11.5px] leading-snug text-ink-faint">
					<Prose value={prescription.note} />
				</p>
			) : null}
		</div>
	);
}

/** A task as the Train screen holds it while the session is in progress. */
export interface TaskState {
	key: TaskKey;
	exerciseId: ExerciseId;
	exName: string;
	cat: string;
	/** CSS custom-property name driving this exercise's accent, e.g. `--violet`. */
	catVar: string;
	variantIndex: number;
	variants: { name: string; tool?: string; speed?: string }[];
	prescription: Variant;
	fields: SetField[];
	sets: LoggedSet[];
	/** Has interval timings the rest timer can run. */
	timed: boolean;
}

export function TaskCard({
	task,
	active,
	onSelectVariant,
	onUseTimer,
	onChangeSet,
	onAddSet,
}: {
	task: TaskState;
	/** The timer is currently pointed at this task. */
	active: boolean;
	onSelectVariant: (index: number) => void;
	onUseTimer: () => void;
	onChangeSet: (index: number, next: LoggedSet) => void;
	onAddSet: () => void;
}) {
	// Two-axis exercises (tool × speed) get two pickers; everything else gets one
	// list. Mirrors the SvelteKit picker, which is the behaviour reference.
	const twoAxis = task.variants.length > 1 && task.variants.every((v) => v.tool && v.speed);
	const current = task.variants[task.variantIndex] ?? task.variants[0];
	const tools = [...new Set(task.variants.map((v) => v.tool))].filter(Boolean) as string[];
	const speeds = [...new Set(task.variants.map((v) => v.speed))].filter(Boolean) as string[];
	const pick = (tool?: string, speed?: string) => {
		const i = task.variants.findIndex((v) => v.tool === tool && v.speed === speed);
		if (i >= 0) onSelectVariant(i);
	};
	const doneCount = task.sets.filter((s) => s.done).length;

	return (
		<div
			className={cn(
				'overflow-hidden rounded-lg border border-l-2 border-line bg-panel',
				active && 'border-t-flag/40 border-r-flag/40 border-b-flag/40',
			)}
			style={{ borderLeftColor: `var(${task.catVar})` }}
		>
			<div className="flex items-center gap-2 px-3 py-2">
				<div className="min-w-0 flex-1">
					<div className="truncate text-[14px] leading-tight font-semibold text-ink">
						{task.exName}
					</div>
					<Eyebrow className="mt-0.5 truncate">{task.cat}</Eyebrow>
				</div>
				<span className="num shrink-0 text-[11px] text-ink-faint">
					{doneCount}/{task.sets.length}
				</span>
				{task.timed ? (
					<button
						type="button"
						aria-label={m.timer_use()}
						aria-pressed={active}
						onClick={onUseTimer}
						// 44px, and bordered when it is the active one. This is what
						// re-points the clock at a different exercise, which is the one
						// action that re-seeds a running timer — it has to be deliberate.
						className={cn(
							'flex size-11 shrink-0 items-center justify-center rounded-md border transition-colors',
							active
								? 'border-flag/50 bg-flag/10 text-flag'
								: 'border-line bg-panel-2 text-ink-faint active:text-ink',
						)}
					>
						<TimerIcon size={17} />
					</button>
				) : null}
			</div>

			{task.variants.length > 1 ? (
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
							value={String(task.variantIndex)}
							options={task.variants.map((v, i) => ({ value: String(i), label: v.name }))}
							onChange={(v) => onSelectVariant(Number(v))}
						/>
					)}
				</div>
			) : null}

			<div className="border-t border-line-soft px-3 py-2">
				<Eyebrow className="mb-1">{m.train_target()}</Eyebrow>
				<Prescription prescription={task.prescription} />
			</div>

			<div className="flex flex-col gap-1.5 border-t border-line-soft px-3 py-2">
				{task.sets.map((s, i) => (
					<SetEditor
						// biome-ignore lint/suspicious/noArrayIndexKey: a set's identity is its position in the task
						key={i}
						exerciseId={task.exerciseId}
						index={i}
						set={s}
						fields={task.fields}
						onChange={(next) => onChangeSet(i, next)}
					/>
				))}
				<button
					type="button"
					onClick={onAddSet}
					className={button({ size: 'md', class: 'min-h-11 self-start' })}
				>
					<Plus size={14} />
					{m.train_add_set()}
				</button>
			</div>
		</div>
	);
}
