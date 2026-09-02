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
import { Plus, Repeat } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getContent } from '$lib/content';
import {
	asExerciseId,
	NO_PROTOCOL,
	protocolKey as protocolKeyOf,
	slotKey,
	type TaskKey,
	taskKey,
} from '$lib/ids';
import { fieldsFor, midOf, prefilledSet } from '$lib/loggedSet';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { libraryTask, type PrescribedTask, resolveTrain } from '$lib/screens/train';
import { restoredSession, useSessionDraft } from '$lib/sessionDraft';
import { useTrainingRecord } from '$lib/store/record';
import { TaskCard } from '../components/TaskCard';
import { Timer, type TimerProtocol } from '../components/Timer';
import { Picker } from '../components/ui/Picker';
import { Eyebrow, Section } from '../components/ui/primitives';
import { button, input } from '../components/ui/variants';

export const Route = createFileRoute('/train')({ component: Train });

/** The protocol the timer runs for a task, or `null` if it has no timings. */
function protocolOf(task: PrescribedTask): TimerProtocol | null {
	if (!task.timed) return null;
	const s = task.prescription;
	return {
		label: task.exName,
		prepare: s.prepareSec ?? 10,
		work: midOf(s.workSec) ?? 10,
		rest: midOf(s.restSec) ?? 0,
		rounds: midOf(s.rounds) ?? 1,
		sets: midOf(s.sets) ?? 1,
		setRest: midOf(s.setRestSec) ?? 0,
	};
}

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

	const [note, setNote] = useState(initial.note);
	const [duration, setDuration] = useState(initial.duration);

	useEffect(() => {
		persistDraft(slot, { tasks, note, duration });
	}, [persistDraft, slot, tasks, note, duration]);

	const update = (key: TaskKey, fn: (t: PrescribedTask) => PrescribedTask) =>
		setTasks((prev) => prev.map((t) => (t.key === key ? fn(t) : t)));

	const selectVariant = (key: TaskKey, index: number) =>
		update(key, (t) => {
			const ex = content.exercises[t.exercise];
			const next = ex?.variants[index] ?? t.prescription;
			return { ...t, variantIndex: index, prescription: next, fields: fieldsFor(next) };
		});

	const addExercise = (raw: string) => {
		const exercise = asExerciseId(raw);
		const next = libraryTask(content, exercise, taskKey(screen.week, screen.weekday, exercise));
		if (next) setTasks((prev) => [...prev, next]);
	};

	const available = useMemo(
		() =>
			screen.available
				.filter((a) => !tasks.some((t) => t.exercise === a.exercise))
				.map((a) => ({ value: a.exercise, label: `${a.name} · ${a.cat}` })),
		[screen.available, tasks],
	);

	const timerTask = tasks.find((t) => t.key === pinnedKey && t.timed) ?? null;
	const protocol = timerTask ? protocolOf(timerTask) : null;
	// The remount boundary, and — since #59 — the scope the timer's stored setup is
	// filed under. Changing the pinned task, or the variant of the pinned task, is
	// a different protocol and reseeds; nothing else here does. Minted through
	// `ids.ts` rather than concatenated here, for the reason that applies to every
	// key in this app: a shape spelled in the component and again in storage is a
	// shape that can be spelled two ways.
	const protocolKey = timerTask
		? protocolKeyOf(timerTask.key, timerTask.variantIndex)
		: NO_PROTOCOL;

	const totalSets = tasks.reduce((n, t) => n + t.sets.length, 0);
	const doneSets = tasks.reduce((n, t) => n + t.sets.filter((s) => s.done).length, 0);

	return (
		<div className="flex flex-col gap-6">
			<header className="flex items-baseline justify-between gap-2 pt-1.5">
				<h1 className="h-screen-title min-w-0">
					{m.sec_train()} · {screen.weekdayLabel}
				</h1>
				<span className="num shrink-0 text-[11px] text-ink-faint">
					{doneSets}/{totalSets} {m.timer_sets().toLowerCase()}
				</span>
			</header>

			{/* Sticky under the 44px app bar. The clock is the one element that has to
			    survive scrolling to a set row three cards down. */}
			<div className="sticky top-[44px] z-10 -mx-3 bg-bg/95 px-3 pt-1 pb-2 backdrop-blur">
				<Timer
					key={protocolKey}
					protocol={protocol}
					protocolKey={protocolKey}
					clockOpen={clockOpen}
					onClockOpenChange={setClockOpen}
				/>
			</div>

			<div className="flex flex-col gap-2.5">
				{tasks.map((t) => (
					<TaskCard
						key={t.key}
						task={t}
						active={timerTask?.key === t.key}
						onSelectVariant={(i) => selectVariant(t.key, i)}
						onUseTimer={() => setPinnedKey(t.key)}
						onChangeSet={(i, next) =>
							update(t.key, (x) => ({
								...x,
								sets: x.sets.map((s, j) => (j === i ? next : s)),
							}))
						}
						onAddSet={() =>
							update(t.key, (x) => ({
								...x,
								// A later set carries the previous one forward: the athlete's own
								// edits become the default for what comes next.
								sets: [
									...x.sets,
									x.sets.length
										? { ...x.sets[x.sets.length - 1], done: false }
										: prefilledSet(x.prescription),
								],
							}))
						}
					/>
				))}
			</div>

			<div className="flex flex-col gap-2">
				<Picker
					ariaLabel={m.wk_add_ex()}
					value={null}
					placeholder={m.wk_add_ex()}
					options={available}
					onChange={addExercise}
					className="min-h-11 border-dashed"
				/>
				<button
					type="button"
					disabled={!screen.canRepeatLast}
					title={screen.canRepeatLast ? undefined : m.train_no_prev()}
					className={button({ size: 'md', class: 'min-h-11 self-start' })}
				>
					<Repeat size={14} />
					{m.train_repeat()}
				</button>
			</div>

			{/* The autosave line lives here rather than under the timer. It reports
			    that the *session* is saved as it is typed, so it belongs with the
			    session's own fields — under the timer it read as though it described
			    the interval configuration, and it was one of the things making the
			    sticky block taller than the thing it sits above. */}
			<Section label={m.train_note()}>
				<div className="flex flex-col gap-2">
					<input
						id="session-note"
						className={input({ align: 'left', class: 'min-h-11 text-[14px]' })}
						value={note}
						placeholder={m.train_note()}
						onChange={(e) => setNote(e.currentTarget.value)}
					/>
					<div className="flex items-center gap-2">
						<label className="shrink-0" htmlFor="session-min">
							<span className="eyebrow">{m.train_duration()}</span>
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
					<Eyebrow>{m.train_autosave()}</Eyebrow>
				</div>
			</Section>

			<button type="button" className={button({ kind: 'primary', size: 'touch' })}>
				<Plus size={16} />
				{m.train_finish()}
			</button>
		</div>
	);
}
