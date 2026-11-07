// TRAIN.
//
// Used mid-set, one-handed, with chalk on the fingers. Two things follow from
// that and neither is a style choice:
//
//   1. The timer is sticky. Everything else on the screen can scroll away; the
//      clock cannot, because the athlete is scrolling *while it runs*.
//   2. Every input is 16px and every tap target is at least 44px, 48px on the
//      timer. That is the floor the set grid is designed around, not a value to
//      tune later.
//
// The rest is the same dense-but-ruled treatment as Today: one card per task,
// three ruled bands inside it, no gaps to hunt across.
import { createFileRoute } from '@tanstack/react-router';
import { Check, Repeat } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getContent } from '$lib/content';
import {
	asExerciseId,
	NO_PROTOCOL,
	protocolKey as protocolKeyOf,
	slotKey,
	type TaskKey,
	taskKey,
} from '$lib/ids';
import { nextSet, prefilledSet } from '$lib/loggedSet';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { protocolOf } from '$lib/protocol';
import { useReadinessDraft } from '$lib/readinessDraft';
import { heldToday, resolveToday } from '$lib/screens/today';
import {
	atVariant,
	currentTask,
	libraryTask,
	type PrescribedTask,
	resolveTrain,
	setsDone,
	setTarget,
	withWorkingLoad,
} from '$lib/screens/train';
import { restoredSession, useSessionDraft } from '$lib/sessionDraft';
import { useTrainingRecord } from '$lib/store/record';
import { writeWorkingLoad } from '$lib/store/workingLoad';
import type { LoggedSet, WorkingLoad, WorkingLoadSource } from '$lib/types';
import { TaskCard } from '../components/TaskCard';
import { Timer } from '../components/Timer';
import { Picker } from '../components/ui/Picker';
import { Empty, Pane, ScreenHeader, Section, StickyStrip } from '../components/ui/primitives';
import { button, input } from '../components/ui/variants';

export const Route = createFileRoute('/train')({ component: Train });

function Train() {
	const record = useTrainingRecord();
	const locale = getLocale();
	const content = useMemo(() => getContent(locale), [locale]);
	// Resolved once, at mount. The prescription for today's slot is what the
	// athlete opened the screen to work against, and re-resolving it under them
	// while they are logging sets would move the targets mid-session.
	const [screen] = useState(() => resolveTrain(content, record, Date.now()));

	// THEIR WORKING COPY, WHICH NOW SURVIVES A RELOAD (#59).
	//
	// `sets` is cloned rather than shared: the rows are edited in place as the
	// session goes, and the resolved item is what they started from.
	//
	// The same two halves as the readiness draft, one screen up in complexity. A
	// **lazy initialiser reads once at mount** — `restoredSession` hands back the
	// stored draft when it belongs to this slot and the freshly resolved copy
	// otherwise — and **one effect writes**, keyed on the three values, rather
	// than a save at each of the seven places that mutate them. `sessionDraft.ts`
	// owns the key, the slot scoping and the shape check.
	const [storedDraft, persistDraft] = useSessionDraft();
	const slot = slotKey(screen.week, screen.weekday);
	const [initial] = useState(() =>
		restoredSession(storedDraft, slot, {
			tasks: screen.tasks.map((t) => ({ ...t, sets: t.sets.map((s) => ({ ...s })) })),
			note: screen.note,
			duration: screen.durationMin == null ? '' : String(screen.durationMin),
		}),
	);
	const [tasks, setTasks] = useState<PrescribedTask[]>(initial.tasks);

	// WHICH TASK THE CLOCK IS RUNNING.
	//
	// Set once at mount and thereafter *only* by the athlete tapping a card's
	// timer button. The prototype re-derived it every render ("the first timed
	// exercise with work left in it"), which meant ticking a set silently
	// re-pointed the clock and remounted it mid-count. The athlete's rule: "if I
	// changed the currently running clock exercise, reseed it, else just keep
	// going." An implicit derivation cannot honour that, because nothing in it is
	// the athlete changing anything.
	const [pinnedKey, setPinnedKey] = useState<TaskKey | null>(
		() => screen.tasks.find((t) => t.timed)?.key ?? null,
	);
	// Owned here, not by the Timer: re-seeding remounts the Timer, and an open
	// dialog owned inside it would close on that remount. The clock stays up and
	// picks up the new protocol.
	const [clockOpen, setClockOpen] = useState(false);

	// HELD WORK, MARKED WHERE TODAY MARKS IT (#118, story 35). This morning's
	// check is read from the same draft Today writes, and resolved against the
	// same day, at mount, as the prescription is: a task does not become held
	// under the athlete mid-session. Nothing is held until the check has a
	// wellness answer (#61).
	const [today] = useState(() => resolveToday(content, record, Date.now()));
	const [answers] = useReadinessDraft(today.answers);
	const held = useMemo(() => heldToday(today, answers), [today, answers]);

	// WHICH TASK IS OPEN (#118, spec stories 46–48). Page state, and mostly not
	// stored at all: `null` means "the task being worked on", which is
	// `currentTask` — the first with a set left, held work last — re-derived
	// every render, so
	// ticking the open task's last set moves the screen on to the next without
	// anything here having to notice. A tap on another task's header pins that
	// one instead, and a tap on the open one folds it (`'none'`). Ticking the last
	// set of a pinned task hands the choice back to the default, which is "moves
	// the default on" for a task opened out of order too.
	const [chosen, setChosen] = useState<TaskKey | 'none' | null>(null);
	const openKey = chosen === 'none' ? null : (chosen ?? currentTask(tasks, held));

	// WHERE THE SESSION MOVED ON TO. A tick that finishes the open task folds its
	// card, which unmounts the tick and drops focus to the page, and the task
	// that opens can land under the sticky clock. So a tick that moves the
	// session on leaves a note here (in the handler, never in render), and once
	// the next task is open its header is scrolled clear of the clock and takes
	// focus, which also reads its name, count and state out. A tap that opens a
	// task leaves no note: the athlete is already looking where they tapped.
	const opened = useRef<HTMLButtonElement>(null);
	const movedOn = useRef(false);
	useEffect(() => {
		if (!movedOn.current || openKey === null) return;
		movedOn.current = false;
		const header = opened.current;
		header?.closest('[data-task-card]')?.scrollIntoView?.({ block: 'start' });
		header?.focus({ preventScroll: true });
	}, [openKey]);

	const [note, setNote] = useState(initial.note);
	const [duration, setDuration] = useState(initial.duration);

	useEffect(() => {
		persistDraft(slot, { tasks, note, duration });
	}, [persistDraft, slot, tasks, note, duration]);

	const update = (key: TaskKey, fn: (t: PrescribedTask) => PrescribedTask) =>
		setTasks((prev) => prev.map((t) => (t.key === key ? fn(t) : t)));

	// The swap and the answer both go through `atVariant`, which is where "what
	// this task is at this variant" is decided once. The inline version here got
	// three of its four fields right and left `workingLoad` and the question
	// pointing at the variant the athlete had just swapped away from.
	const selectVariant = (key: TaskKey, index: number) =>
		update(key, (t) => atVariant(content, record, t, index));

	/**
	 * The athlete answered the working-load question.
	 *
	 * The card takes the answer at the tap and the row is written behind it —
	 * **the same row**, `at` included, so the two cannot disagree. Waiting for the
	 * write would leave the question on screen across a hydrate the athlete has no
	 * reason to know about, mid-set, with chalk on their fingers.
	 *
	 * It deliberately does not re-resolve the whole screen. `screen` is frozen at
	 * mount so the targets cannot move under a session in progress, and this is
	 * one task's answer rather than a new prescription for the day.
	 */
	const answerLoad = (task: PrescribedTask, addedKg: number, source: WorkingLoadSource) => {
		const load: WorkingLoad = {
			exercise: task.exercise,
			variant: task.variantIndex,
			addedKg,
			source,
			at: Date.now(),
		};
		update(task.key, (t) => withWorkingLoad(t, load));
		void writeWorkingLoad(load);
	};

	const addExercise = (raw: string) => {
		const exercise = asExerciseId(raw);
		const next = libraryTask(
			content,
			record,
			exercise,
			taskKey(screen.week, screen.weekday, exercise),
		);
		if (next) {
			setTasks((prev) => [...prev, next]);
			// An exercise added mid-session is the one the athlete is about to do.
			setChosen(next.key);
		}
	};

	/** A set changed. Ticking the open task's last prescribed set hands the
	 *  choice back to the default, which is the next task with a set left. */
	const changeSet = (task: PrescribedTask, index: number, next: LoggedSet) => {
		const sets = task.sets.map((s, j) => (j === index ? next : s));
		update(task.key, (x) => ({ ...x, sets }));
		const finishes =
			task.key === openKey &&
			setsDone(task) < setTarget(task) &&
			setsDone({ sets }) >= setTarget({ ...task, sets });
		if (finishes) {
			movedOn.current = true;
			setChosen(null);
		}
	};

	const available = useMemo(
		() =>
			screen.available
				.filter((a) => !tasks.some((t) => t.exercise === a.exercise))
				.map((a) => ({ value: a.exercise, label: `${a.name} · ${a.cat}` })),
		[screen.available, tasks],
	);

	const timerTask = tasks.find((t) => t.key === pinnedKey && t.timed) ?? null;
	const protocol = timerTask ? protocolOf(timerTask.prescription) : null;
	// The remount boundary, and — since #59 — the scope the timer's stored setup is
	// filed under. Changing the pinned task, or the variant of the pinned task, is
	// a different protocol and reseeds; nothing else here does. Minted through
	// `ids.ts` rather than concatenated here, for the reason that applies to every
	// key in this app: a shape spelled in the component and again in storage is a
	// shape that can be spelled two ways.
	const protocolKey = timerTask
		? protocolKeyOf(timerTask.key, timerTask.variantIndex)
		: NO_PROTOCOL;

	// The prescribed sets, as each folded task counts them (`setTarget`).
	const totalSets = tasks.reduce((n, t) => n + setTarget(t), 0);
	const doneSets = tasks.reduce((n, t) => n + setsDone(t), 0);

	return (
		// NO SECOND COLUMN, DELIBERATELY (#52). Train is the one screen defined by
		// the posture it is used in — one hand, mid-set, chalk on the fingers — and
		// a wide screen does not change that. What it would change is the set grid:
		// seven loggable fields laid out against a 360px measure, stretched across a
		// column twice that, put the number the athlete is typing an inch from its
		// own label. So the page keeps the phone layout and caps itself, and the
		// desktop width is spent on nothing.
		<Pane className="gap-sections">
			<ScreenHeader
				title={
					<>
						{m.sec_train()} · {screen.weekdayLabel}
					</>
				}
				reading={
					<>
						{doneSets}/{totalSets} {m.timer_sets().toLowerCase()}
					</>
				}
			/>

			{/* Sticky under the 44px app bar. The clock is the one element that has to
			    survive scrolling to a set row three cards down. */}
			<StickyStrip>
				<Timer
					home="train"
					key={protocolKey}
					protocol={protocol}
					label={timerTask?.exName ?? null}
					protocolKey={protocolKey}
					clockOpen={clockOpen}
					onClockOpenChange={setClockOpen}
				/>
			</StickyStrip>

			{/* Nothing scheduled — a rest day, or a slot the program left empty. It
			    says so where the cards would be, and the add-exercise picker below is
			    the affordance: off-script work still counts as training (#61). Not
			    "rest day", because this screen cannot tell a rest day from a slot the
			    athlete emptied, and Today already names the day type. */}
			{tasks.length === 0 ? (
				<Empty value={m.train_no_work()} />
			) : (
				<div className="flex flex-col gap-row">
					{tasks.map((t) => (
						<TaskCard
							key={t.key}
							task={t}
							open={t.key === openKey}
							headerRef={t.key === openKey ? opened : undefined}
							held={held.has(t.exercise)}
							active={timerTask?.key === t.key}
							onToggle={() => setChosen(t.key === openKey ? 'none' : t.key)}
							onSelectVariant={(i) => selectVariant(t.key, i)}
							onUseTimer={() => setPinnedKey(t.key)}
							onChangeSet={(i, next) => changeSet(t, i, next)}
							onAnswerLoad={(kg, source) => answerLoad(t, kg, source)}
							onAddSet={() =>
								update(t.key, (x) => ({
									...x,
									// A later set carries the previous one forward: the athlete's own
									// edits become the default for what comes next. Which of them do
									// not travel is `nextSet`'s decision, not the route's.
									sets: [
										...x.sets,
										x.sets.length
											? nextSet(x.sets[x.sets.length - 1])
											: prefilledSet(x.prescription),
									],
								}))
							}
						/>
					))}
				</div>
			)}

			{/* SESSION TOOLS, AFTER THE TASKS (#118, spec story 52). What belongs to
			    the session rather than to one task — another exercise, last session
			    repeated, the note, the minutes — is one group under one heading, so
			    none of it competes with the tasks above it. The autosave line ends
			    it: it reports that the *session* is saved as it is typed, so it
			    belongs with the session's own fields — under the timer it read as
			    though it described the interval configuration. */}
			<Section label={m.train_tools()}>
				<div className="flex flex-col gap-group">
					<Picker
						ariaLabel={m.wk_add_ex()}
						value={null}
						placeholder={m.wk_add_ex()}
						options={available}
						onChange={addExercise}
						className="min-h-11 border-dashed"
					/>
					{/* Disabled with its reason on the line, not in a `title` a phone
					    never shows (#118's critique). */}
					<div className="flex flex-col gap-1">
						<button
							type="button"
							disabled={!screen.canRepeatLast}
							className={button({ size: 'md', class: 'min-h-11 self-start' })}
						>
							<Repeat size={16} aria-hidden="true" />
							{m.train_repeat()}
						</button>
						{screen.canRepeatLast ? null : (
							<p className="text-[11px] leading-snug text-ink-faint">{m.train_no_prev()}</p>
						)}
					</div>
					<div className="flex flex-col gap-1">
						<label className="eyebrow" htmlFor="session-note">
							{m.train_note()}
						</label>
						<input
							id="session-note"
							className={input({ align: 'left', class: 'min-h-11' })}
							value={note}
							onChange={(e) => setNote(e.currentTarget.value)}
						/>
					</div>
					<div className="flex items-center gap-2">
						<label className="eyebrow shrink-0" htmlFor="session-min">
							{m.train_duration()}
						</label>
						<input
							id="session-min"
							className={input({ class: 'h-11 w-16 shrink-0' })}
							type="number"
							inputMode="numeric"
							min={1}
							value={duration}
							onChange={(e) => setDuration(e.currentTarget.value)}
						/>
						<span className="min-w-0 flex-1 text-[11px] leading-snug text-ink-faint">
							{m.train_duration_hint()}
						</span>
					</div>
					<p className="text-[11px] leading-snug text-ink-faint">{m.train_autosave()}</p>
				</div>
			</Section>

			{/* The second empty state, and the easier one to forget (#61): a slot with
			    tasks and no set ticked off. A session is trained once one set is
			    (`CONTEXT.md`, **Trained**), so with none there is nothing to record and
			    the primary says what it is waiting for. Disabled rather than hidden —
			    a hidden button leaves the athlete looking for it. */}
			<div className="flex flex-col gap-2">
				<button
					type="button"
					disabled={doneSets === 0}
					className={button({ kind: 'primary', size: 'touch' })}
				>
					<Check size={16} aria-hidden="true" />
					{m.train_finish()}
				</button>
				{doneSets === 0 ? (
					<p className="text-center text-[11px] leading-snug text-ink-faint">
						{m.train_no_set_done()}
					</p>
				) : null}
			</div>
		</Pane>
	);
}
