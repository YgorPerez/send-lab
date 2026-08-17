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
import { useMemo, useState } from 'react';
import { getContent } from '$lib/content';
import type { Content, Range, Variant } from '$lib/content/types';
import { asExerciseId, type ExerciseId, type TaskKey, taskKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import type { WorkoutSet } from '$lib/types';
import { TaskCard, type TaskState } from '../components/TaskCard';
import { Timer, type TimerProtocol } from '../components/Timer';
import { Picker } from '../components/ui/Picker';
import { Eyebrow, Section } from '../components/ui/primitives';
import { button, input } from '../components/ui/variants';
import { getPrototypeFixtures, type SetField } from '../prototype-fixtures';

export const Route = createFileRoute('/train')({ component: Train });

const mid = (r?: Range): number | null => (r ? Math.round((r.min + r.max) / 2) : null);

function fieldsFor(spec: Variant | undefined): SetField[] {
	const f: SetField[] = ['weight', 'edge', 'time', 'reps'];
	if (spec?.grip) f.push('grip');
	f.push('rest', 'rpe');
	return f;
}

function prefilledSet(spec: Variant): WorkoutSet {
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

/** The protocol the timer runs for a task, or `null` if it has no timings. */
function protocolOf(task: TaskState): TimerProtocol | null {
	if (!task.timed) return null;
	const s = task.prescription;
	return {
		label: task.exName,
		prepare: s.prepareSec ?? 10,
		work: mid(s.workSec) ?? 10,
		rest: mid(s.restSec) ?? 0,
		rounds: mid(s.rounds) ?? 1,
		sets: mid(s.sets) ?? 1,
		setRest: mid(s.setRestSec) ?? 0,
	};
}

/**
 * A task built for an exercise the athlete adds mid-session. The library is the
 * same one the fixture read, so an added exercise arrives with its real
 * prescription rather than as an empty row.
 */
function taskFromLibrary(content: Content, exerciseId: ExerciseId, key: TaskKey): TaskState | null {
	const ex = content.exercises[exerciseId];
	if (!ex) return null;
	const spec = ex.variants[0];
	return {
		key,
		exerciseId,
		exName: ex.name,
		cat: ex.cat,
		catVar: ex.catVar,
		variantIndex: 0,
		variants: ex.variants.map((v) => ({
			name: v.name,
			...(v.tool ? { tool: v.tool } : {}),
			...(v.speed ? { speed: v.speed } : {}),
		})),
		prescription: spec,
		fields: fieldsFor(spec),
		sets: [prefilledSet(spec)],
		timed: spec.workSec != null,
	};
}

function Train() {
	const fx = useMemo(() => getPrototypeFixtures(), []);
	const content = useMemo(() => getContent(), []);

	const [tasks, setTasks] = useState<TaskState[]>(() =>
		fx.train.items.map((it) => ({
			key: it.key,
			exerciseId: it.exerciseId,
			exName: it.exName,
			cat: it.cat,
			catVar: it.catVar,
			variantIndex: it.variantIndex,
			variants: [...it.variants],
			prescription: it.prescription,
			fields: it.fields,
			sets: it.sets.map((s) => ({ ...s })),
			timed: it.timed,
		})),
	);

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
		() => fx.train.items.find((it) => it.timed)?.key ?? null,
	);
	// Owned here, not by the Timer: re-seeding remounts the Timer, and an open
	// dialog owned inside it would close on that remount. The clock stays up and
	// picks up the new protocol.
	const [clockOpen, setClockOpen] = useState(false);

	const [note, setNote] = useState(fx.train.note);
	const [duration, setDuration] = useState(
		fx.train.durationMin == null ? '' : String(fx.train.durationMin),
	);

	const update = (key: TaskKey, fn: (t: TaskState) => TaskState) =>
		setTasks((prev) => prev.map((t) => (t.key === key ? fn(t) : t)));

	const selectVariant = (key: TaskKey, index: number) =>
		update(key, (t) => {
			const ex = content.exercises[t.exerciseId];
			const next = ex?.variants[index] ?? t.prescription;
			return { ...t, variantIndex: index, prescription: next, fields: fieldsFor(next) };
		});

	const addExercise = (raw: string) => {
		const exerciseId = asExerciseId(raw);
		const next = taskFromLibrary(
			content,
			exerciseId,
			taskKey(fx.train.weekId, fx.train.weekdayKey, exerciseId),
		);
		if (next) setTasks((prev) => [...prev, next]);
	};

	const available = useMemo(
		() =>
			fx.train.available
				.filter((a) => !tasks.some((t) => t.exerciseId === a.exerciseId))
				.map((a) => ({ value: a.exerciseId, label: `${a.name} · ${a.cat}` })),
		[fx.train.available, tasks],
	);

	const timerTask = tasks.find((t) => t.key === pinnedKey && t.timed) ?? null;
	const protocol = timerTask ? protocolOf(timerTask) : null;
	// The remount boundary. Changing the pinned task, or the variant of the
	// pinned task, is a different protocol and reseeds; nothing else here does.
	const protocolKey = timerTask ? `${timerTask.key}:${timerTask.variantIndex}` : 'none';

	const totalSets = tasks.reduce((n, t) => n + t.sets.length, 0);
	const doneSets = tasks.reduce((n, t) => n + t.sets.filter((s) => s.done).length, 0);

	return (
		<div className="flex flex-col gap-6">
			<header className="flex items-baseline justify-between gap-2 pt-1.5">
				<h1 className="h-screen-title min-w-0">
					{m.sec_train()} · {fx.train.weekdayLabel}
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
					disabled={!fx.train.canRepeatLast}
					title={fx.train.canRepeatLast ? undefined : m.train_no_prev()}
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
