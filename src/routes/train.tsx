// TRAIN — Direction A.
//
// Used mid-set, one-handed, with chalk on the fingers. Two things follow from
// that and neither is a style choice:
//
//   1. The timer is sticky. Everything else on the screen can scroll away; the
//      clock cannot, because the athlete is scrolling *while it runs*.
//   2. Every input is 16px and every tap target is at least 34px. That is the
//      floor the set grid is designed around, not a value to tune later.
//
// The rest is the same dense-but-ruled treatment as Today: one card per
// exercise, three ruled bands inside it, no gaps to hunt across.
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getContent } from '$lib/content';
import type { Content, Range, Variant } from '$lib/content/types';
import * as m from '$lib/paraglide/messages';
import type { WorkoutSet } from '$lib/types';
import { ExerciseCard, type TrainItemState } from '../components/ExerciseCard';
import { Picker } from '../components/Picker';
import { Timer } from '../components/Timer';
import { button, card, Eyebrow, input, Section } from '../components/ui';
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

/** Build a card's state for an exercise the athlete adds mid-session. The
 *  library is the same one the fixture read, so an added exercise arrives with
 *  its real prescription rather than as an empty row. */
function itemFromLibrary(content: Content, exId: string): TrainItemState | null {
	const ex = content.exercises[exId];
	if (!ex) return null;
	const spec = ex.variants[0];
	return {
		exId,
		exName: ex.name,
		cat: ex.cat,
		catVar: ex.catVar,
		variantIndex: 0,
		variants: ex.variants.map((v) => ({
			name: v.name,
			...(v.tool ? { tool: v.tool } : {}),
			...(v.speed ? { speed: v.speed } : {}),
		})),
		spec,
		fields: fieldsFor(spec),
		sets: [prefilledSet(spec)],
		timed: spec.workSec != null,
	};
}

function Train() {
	const fx = useMemo(() => getPrototypeFixtures(), []);
	const content = useMemo(() => getContent(), []);

	const [items, setItems] = useState<TrainItemState[]>(() =>
		fx.train.items.map((it) => ({
			exId: it.exId,
			exName: it.exName,
			cat: it.cat,
			catVar: it.catVar,
			variantIndex: it.variantIndex,
			variants: [...it.variants],
			spec: it.spec,
			fields: it.fields,
			sets: it.sets.map((s) => ({ ...s })),
			timed: it.timed,
		})),
	);
	const [activeExId, setActiveExId] = useState<string | null>(
		fx.train.timer?.key.split(':')[0] ?? null,
	);
	const [note, setNote] = useState(fx.train.note);
	const [duration, setDuration] = useState(
		fx.train.durationMin == null ? '' : String(fx.train.durationMin),
	);

	const update = (exId: string, fn: (it: TrainItemState) => TrainItemState) =>
		setItems((prev) => prev.map((it) => (it.exId === exId ? fn(it) : it)));

	const selectVariant = (exId: string, index: number) =>
		update(exId, (it) => {
			const ex = content.exercises[exId];
			const spec = ex?.variants[index] ?? it.spec;
			return { ...it, variantIndex: index, spec, fields: fieldsFor(spec) };
		});

	const addExercise = (exId: string) => {
		const next = itemFromLibrary(content, exId);
		if (next) setItems((prev) => [...prev, next]);
	};

	const available = useMemo(
		() =>
			Object.entries(content.exercises)
				.filter(([id]) => id !== 'rest' && !items.some((it) => it.exId === id))
				.map(([id, ex]) => ({ value: id, label: `${ex.name} · ${ex.cat}` })),
		[content, items],
	);

	// The timer follows the exercise the athlete pointed it at, else the first
	// timed exercise with work left in it — the same rule as the SvelteKit app.
	const timerItem =
		items.find((it) => it.exId === activeExId && it.timed) ??
		items.find((it) => it.timed && it.sets.some((s) => !s.done)) ??
		items.find((it) => it.timed) ??
		null;
	const seed = timerItem
		? {
				key: `${timerItem.exId}:${timerItem.variantIndex}`,
				label: timerItem.exName,
				prepareSec: timerItem.spec.prepareSec ?? 10,
				workSec: mid(timerItem.spec.workSec) ?? 10,
				restSec: mid(timerItem.spec.restSec) ?? 0,
				rounds: mid(timerItem.spec.rounds) ?? 1,
				sets: mid(timerItem.spec.sets) ?? 1,
				setRestSec: mid(timerItem.spec.setRestSec) ?? 0,
				totalSec: 0,
			}
		: null;

	const totalSets = items.reduce((n, it) => n + it.sets.length, 0);
	const doneSets = items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);

	return (
		<div className="flex flex-col gap-4">
			<header className="flex items-baseline justify-between gap-2 pt-1">
				<h1 className="text-[17px] leading-tight font-semibold text-ink">
					{m.sec_train()} · {fx.train.weekdayLabel}
				</h1>
				<span className="num shrink-0 text-[11px] text-ink-faint">
					{doneSets}/{totalSets} {m.timer_sets().toLowerCase()}
				</span>
			</header>

			{/* Sticky under the 44px app bar. The clock is the one element that has
			    to survive scrolling to a set row three cards down. */}
			<div className="sticky top-[44px] z-10 -mx-3 bg-bg/95 px-3 pt-1 pb-2 backdrop-blur">
				<Timer key={seed?.key ?? 'none'} seed={seed} />
			</div>

			<div className="flex flex-col gap-2.5">
				{items.map((it) => (
					<ExerciseCard
						key={it.exId}
						item={it}
						active={timerItem?.exId === it.exId}
						onSelectVariant={(i) => selectVariant(it.exId, i)}
						onUseTimer={() => setActiveExId(it.exId)}
						onChangeSet={(i, next) =>
							update(it.exId, (x) => ({
								...x,
								sets: x.sets.map((s, j) => (j === i ? next : s)),
							}))
						}
						onAddSet={() =>
							update(it.exId, (x) => ({
								...x,
								// A later set carries the previous one forward: the athlete's own
								// edits become the default for what comes next.
								sets: [
									...x.sets,
									x.sets.length
										? { ...x.sets[x.sets.length - 1], done: false }
										: prefilledSet(x.spec),
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
					className="border-dashed"
				/>
				<button
					type="button"
					disabled={!fx.train.canRepeatLast}
					title={fx.train.canRepeatLast ? undefined : m.train_no_prev()}
					className={button({ class: 'self-start' })}
				>
					<Repeat size={13} />
					{m.train_repeat()}
				</button>
			</div>

			<Section label={m.train_note()}>
				<div className={card({ pad: 'sm', class: 'flex flex-col gap-2' })}>
					<input
						id="session-note"
						className={input({ align: 'left', class: 'text-[14px]' })}
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
							className={input({ class: 'h-8 w-16 shrink-0' })}
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

			<button type="button" className={button({ kind: 'primary', size: 'lg' })}>
				<Plus size={15} />
				{m.train_finish()}
			</button>
		</div>
	);
}
