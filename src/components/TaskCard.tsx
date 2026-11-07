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
//
// OPEN OR FOLDED (#118, spec stories 46–48)
// -----------------------------------------
// One task is open at a time: the one being worked on. Every other task is its
// header alone, one line of name and one of the short prescription, with the
// sets done and the clock's button where they always are, so the screen shows
// what the athlete is doing now and the rest of the session in four lines.
// Before #118 every task opened everything at once and Train ran to 3,900px.
// Which task is open is the page's decision (`train.tsx`); the card only draws
// the state it is handed and says when its header is tapped.
import { ChevronDown, Plus, Timer as TimerIcon } from 'lucide-react';
import { type Ref, useId } from 'react';
import type { Variant } from '$lib/content/types';
import {
	costLabel,
	formatEdge,
	formatLoad,
	formatRange,
	formatSecondsRange,
	gripLabel,
	shortPrescription,
	workingLoadSourceLabel,
} from '$lib/format';
import * as m from '$lib/paraglide/messages';
import { type PrescribedTask, setsDone, setTarget } from '$lib/screens/train';
import type { LoggedSet, WorkingLoadSource } from '$lib/types';
import { cn } from '$lib/utils';
import { SetEditor } from './SetRows';
import { Picker } from './ui/Picker';
import { Eyebrow, Prose } from './ui/primitives';
import { button, chip } from './ui/variants';
import { WorkingLoadAsk } from './WorkingLoadAsk';

/**
 * The prescription, as a wrapping row of label/value pairs.
 *
 * Mono values, uppercase micro-labels: it has to be scannable without being
 * read. Not exported — it is only ever the middle band of this card, and a
 * prescription outside a task has nothing to be a prescription *for*.
 *
 * `CONTEXT.md` defines a **prescription** as the targets *after* swaps,
 * overrides, weekly progression and phase scaling are all resolved. This
 * component renders one and does not resolve it — `lib/screens/train.ts` does,
 * out of `prescription.ts` reading the store, and hands the answer down.
 *
 * The seam held. This prop used to be called `spec`, which quietly claimed
 * nothing; renaming it to `prescription` was what made it obvious that the
 * fixture behind it was handing over `ex.variants[0]` and calling it resolved
 * (#69). Nothing in this component changed when a real resolution arrived
 * (#56), which is the whole argument for naming a seam before you can fill it.
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
						<span className="num text-[13px] text-chalk">{value}</span>
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
				<p className="prose-inline mt-1.5 text-[11px] leading-snug text-pretty text-ink-faint">
					<Prose value={prescription.note} />
				</p>
			) : null}
		</div>
	);
}

export function TaskCard({
	task,
	open,
	held,
	active,
	onToggle,
	onSelectVariant,
	onUseTimer,
	onChangeSet,
	onAddSet,
	onAnswerLoad,
	headerRef,
}: {
	task: PrescribedTask;
	/** This is the task being worked on: its prescription and sets are drawn. */
	open: boolean;
	/** Today's verdict holds this task back (Today marks it the same way). */
	held: boolean;
	/** The timer is currently pointed at this task. */
	active: boolean;
	/** The header was tapped: open this task, or fold it if it is open. */
	onToggle: () => void;
	onSelectVariant: (index: number) => void;
	onUseTimer: () => void;
	onChangeSet: (index: number, next: LoggedSet) => void;
	onAddSet: () => void;
	/** What to do when the athlete answers the working-load question. Only ever
	 *  called for a task carrying an `ask`. */
	onAnswerLoad: (addedKg: number, source: WorkingLoadSource) => void;
	/** The header's disclosure, for the page to move focus to when a tick
	 *  opens this task (the tick's own card folds and takes focus with it). */
	headerRef?: Ref<HTMLButtonElement>;
}) {
	const bodyId = useId();
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
	const doneCount = setsDone(task);
	// Counted against the prescription, not the rows: one row ticked of four
	// prescribed sets is not a finished task (`setTarget`).
	const target = setTarget(task);
	const finished = target > 0 && doneCount >= target;

	return (
		<div
			// Which task the clock runs is said by the clock's own button below, in
			// the selection mark, and by the strip, which names the task. The card
			// used to take a vermilion edge for it too, which read as a warning from
			// the wall and put a second vermilion beside the screen's one primary
			// (#118's critique).
			//
			// The card, not its header, is what the page scrolls to when a tick
			// opens it: `overflow-hidden` makes the card a scroll container, and
			// one asked to bring its own header into view does nothing for the
			// window. Clear of what is sticky above it: the 44px strip and the
			// clock's 84px (`StickyStrip`).
			data-task-card
			className="scroll-mt-[128px] overflow-hidden rounded-lg border border-l-2 border-line bg-panel"
			style={{ borderLeftColor: `var(${task.catVar})` }}
		>
			<div className="flex items-center gap-2 py-1 pr-3">
				{/* The whole header is the disclosure, so a folded task opens from
				    anywhere on its line; the clock's button beside it is its own
				    target. What the line shows is the button's content, so a screen
				    reader hears the name, the count and the held mark with it. */}
				<button
					ref={headerRef}
					type="button"
					aria-expanded={open}
					aria-controls={open ? bodyId : undefined}
					onClick={onToggle}
					className="flex min-h-11 min-w-0 flex-1 items-center gap-2 self-stretch py-1 pl-3 text-left"
				>
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span
							data-task-name
							className="truncate text-[16px] leading-[1.25] font-semibold text-ink"
						>
							{task.exName}
						</span>
						{/* Folded, the line under the name is the prescription in short;
						    open, the whole prescription is a band below, so the line goes
						    back to the category. Held work is marked at the line's end,
						    where Today marks it on the same task (#117), and wraps under it
						    rather than squeezing the name. */}
						<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
							{open ? (
								<span className="eyebrow min-w-0 truncate">{task.cat}</span>
							) : (
								<span className="num min-w-0 truncate text-[11px] text-ink-dim">
									{shortPrescription(task.prescription)}
								</span>
							)}
							{held && !finished ? (
								<span className={chip({ tone: 'warn' })}>{m.td_held()}</span>
							) : finished ? (
								// Every set ticked, said the way Today says a task is done:
								// a faint "2/2" was the only mark, and it does not read at 2m.
								<span className={chip({ tone: 'ok' })}>{m.lbl_done()}</span>
							) : null}
						</span>
					</span>
					<span className="num shrink-0 text-[11px] text-ink-faint">
						{doneCount}/{target}
					</span>
					<ChevronDown
						size={18}
						aria-hidden="true"
						className={cn('shrink-0 text-ink-faint', open && 'rotate-180')}
					/>
				</button>
				{task.timed ? (
					<button
						type="button"
						aria-label={m.timer_use()}
						aria-pressed={active}
						onClick={onUseTimer}
						// 44px, and in the app's selection mark (chalk on the raised
						// panel, as the bar marks where the athlete is) when it is the one
						// the clock runs. This is what re-points the clock at a different
						// exercise, which is the one action that re-seeds a running timer —
						// it has to be deliberate. Not vermilion: "the clock points here"
						// is a selection, not a limit (#118).
						className={cn(
							'flex size-11 shrink-0 items-center justify-center rounded-md border transition-colors',
							active
								? 'border-chalk/60 bg-panel-3 text-chalk'
								: 'border-line bg-panel-2 text-ink-faint active:text-ink',
						)}
					>
						<TimerIcon size={20} strokeWidth={1.75} aria-hidden="true" />
					</button>
				) : (
					// The clock's slot is held empty on a task the clock cannot run, so
					// every card's count and chevron sit in one column down the list.
					<span aria-hidden="true" className="size-11 shrink-0" />
				)}
			</div>

			{open ? (
				<div id={bodyId}>
					{task.variants.length > 1 ? (
						<div className="border-t border-line-soft px-3 py-2">
							<Eyebrow className="mb-1">{m.swap_label()}</Eyebrow>
							{twoAxis ? (
								<div className="flex gap-1.5">
									<Picker
										ariaLabel={m.var_tool()}
										wrap
										className="h-auto min-h-11 py-1.5"
										value={current.tool ?? null}
										options={tools.map((x) => ({ value: x, label: x }))}
										onChange={(v) => pick(v, current.speed)}
									/>
									<Picker
										ariaLabel={m.var_speed()}
										wrap
										className="h-auto min-h-11 py-1.5"
										value={current.speed ?? null}
										options={speeds.map((x) => ({ value: x, label: x }))}
										onChange={(v) => pick(current.tool, v)}
									/>
								</div>
							) : (
								<Picker
									ariaLabel={m.swap_label()}
									wrap
									className="h-auto min-h-11 py-1.5"
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
						{/* Where the load in that row came from. The number is already in the
				    prescription — `effectiveVariant` reads the working load as the base
				    the week's progression scales — and a range cannot say whether it
				    was measured or guessed. #29 grades those differently, so the card
				    says which. */}
						{task.workingLoad ? (
							<div className="mt-1.5">
								<span className={chip({ tone: 'ghost', class: 'whitespace-normal' })}>
									{m.wl_title()} · {workingLoadSourceLabel(task.workingLoad.source)}
								</span>
							</div>
						) : null}
					</div>

					{/* First contact with a weighted exercise, and only then: `ask` is
			    non-null exactly when the athlete has never said what to load this
			    variant with (#88). Above the sets, because it is what the first set's
			    load column is waiting on — and skippable, because ADR 0019's rule
			    that a question may not answer itself cuts both ways. */}
					{task.ask ? (
						<div className="border-t border-line-soft px-3 py-2">
							<WorkingLoadAsk
								exercise={task.exercise}
								prescribesLoad={task.prescription.loadKg != null}
								suggestion={task.ask}
								// Folded once a set is ticked: the athlete has trained past the
								// question, and its ~300px would sit over the grid every time
								// the task is opened (#118's critique). It opens again in place.
								folded={doneCount > 0}
								onAnswer={onAnswerLoad}
							/>
						</div>
					) : null}

					<div className="flex flex-col gap-1.5 border-t border-line-soft px-3 py-2">
						{task.sets.map((s, i) => (
							<SetEditor
								// biome-ignore lint/suspicious/noArrayIndexKey: a set's identity is its position in the task
								key={i}
								exerciseId={task.exercise}
								index={i}
								set={s}
								fields={task.fields}
								// The prescribed range travels down to the column the answer is
								// typed into as well as sitting in the band above (#89). The band
								// is for reading the prescription; the column is for judging one
								// number against another, and the row is where that happens.
								prescribedRpe={task.prescription.rpe}
								onChange={(next) => onChangeSet(i, next)}
							/>
						))}
						<button
							type="button"
							onClick={onAddSet}
							className={button({ size: 'md', class: 'min-h-11 self-start' })}
						>
							<Plus size={16} aria-hidden="true" />
							{m.train_add_set()}
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}
