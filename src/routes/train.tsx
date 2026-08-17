// Channel 02 — TRAIN.
//
// Used mid-set, one-handed, with chalky hands, and that is what decides the
// layout: the timer readout is the biggest thing in the app, the done tick is a
// 44px target around a 24px square, and every set field is a 16px mono value on
// a single baseline rule. Nothing on this screen is smaller than 13px except
// the field labels, which are 9px and are the direction's known liability —
// see the note in `ExerciseBlock`.

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { getContent } from '$lib/content';
import * as m from '$lib/paraglide/messages';
import { usePrototype } from '$lib/prototype/usePrototype';
import type { WorkoutSet } from '$lib/types';
import { ExerciseBlock, type SetRow } from '../components/ExerciseBlock';
import { Frame } from '../components/Frame';
import { Bench, KV, Lbl, Row, Section } from '../components/kit';
import { Timer } from '../components/Timer';
import type { PrototypeFixtures, SetField } from '../prototype-fixtures';

export const Route = createFileRoute('/train')({ component: TrainScreen });

const str = (v: number | string | null | undefined): string => (v == null ? '' : String(v));

function rowsFromSets(exId: string, sets: WorkoutSet[]): SetRow[] {
	return sets.map((s, i) => ({
		id: `${exId}-${i}`,
		done: s.done,
		values: {
			weight: str(s.weight),
			edge: str(s.edge),
			time: str(s.time),
			reps: str(s.reps),
			grip: str(s.grip),
			rest: str(s.rest),
			rpe: str(s.rpe),
		},
	}));
}

function seedRows(fx: PrototypeFixtures): Record<string, SetRow[]> {
	const out: Record<string, SetRow[]> = {};
	for (const it of fx.train.items) out[it.exId] = rowsFromSets(it.exId, it.sets);
	return out;
}

function TrainScreen() {
	const fx = usePrototype();
	const content = getContent();

	// Everything mutable is keyed by the stable exercise id, never by a label
	// (ADR 0003) — which is also what lets the locale switch mid-session without
	// losing a single typed number.
	const [rows, setRows] = useState<Record<string, SetRow[]>>(() => seedRows(fx));
	const [variant, setVariant] = useState<Record<string, number>>({});
	const [extra, setExtra] = useState<string[]>([]);
	const [note, setNote] = useState(fx.train.note);
	const [duration, setDuration] = useState(str(fx.train.durationMin));
	const [finished, setFinished] = useState(false);

	const items = [
		...fx.train.items.map((it) => ({
			exId: it.exId,
			name: it.exName,
			cat: it.cat,
			catVar: it.catVar,
		})),
		...extra.map((id) => ({
			exId: id,
			name: content.exercises[id]?.name ?? id,
			cat: content.exercises[id]?.cat ?? '',
			catVar: content.exercises[id]?.catVar ?? '--ink-faint',
		})),
	];

	const setValue = (exId: string) => (rowId: string, field: SetField, value: string) => {
		setRows((all) => ({
			...all,
			[exId]: (all[exId] ?? []).map((r) =>
				r.id === rowId ? { ...r, values: { ...r.values, [field]: value } } : r,
			),
		}));
	};

	const toggle = (exId: string) => (rowId: string) => {
		setRows((all) => ({
			...all,
			[exId]: (all[exId] ?? []).map((r) => (r.id === rowId ? { ...r, done: !r.done } : r)),
		}));
	};

	const addSet = (exId: string) => () => {
		setRows((all) => {
			const current = all[exId] ?? [];
			const last = current[current.length - 1];
			return {
				...all,
				[exId]: [
					...current,
					{
						id: `${exId}-${current.length}-${Date.now()}`,
						done: false,
						values: { ...last?.values },
					},
				],
			};
		});
	};

	const addExercise = (exId: string) => {
		if (!exId || extra.includes(exId)) return;
		const spec = content.exercises[exId]?.variants[0];
		setExtra((e) => [...e, exId]);
		setRows((all) => ({
			...all,
			[exId]: [{ id: `${exId}-0`, done: false, values: { grip: spec?.grip ?? '' } }],
		}));
	};

	const totalSets = items.reduce((n, it) => n + (rows[it.exId]?.length ?? 0), 0);
	const doneSets = items.reduce(
		(n, it) => n + (rows[it.exId] ?? []).filter((r) => r.done).length,
		0,
	);

	return (
		<Frame>
			{fx.train.timer ? (
				<Section
					index="00"
					meta={`${fx.train.weekdayLabel} · ${fx.train.timer.label}`}
					title={m.timer_title()}
				>
					<Row pad="none">
						<Timer timer={fx.train.timer} />
					</Row>
				</Section>
			) : null}

			{items.map((it, i) => {
				const variants = content.exercises[it.exId]?.variants ?? [];
				if (variants.length === 0) return null;
				return (
					<ExerciseBlock
						cat={it.cat}
						catVar={it.catVar}
						exId={it.exId}
						index={String(i + 1).padStart(2, '0')}
						key={it.exId}
						name={it.name}
						onAdd={addSet(it.exId)}
						onToggle={toggle(it.exId)}
						onValue={setValue(it.exId)}
						onVariant={(v) => setVariant((s) => ({ ...s, [it.exId]: v }))}
						rows={rows[it.exId] ?? []}
						variantIndex={variant[it.exId] ?? 0}
						variants={variants}
					/>
				);
			})}

			<Section
				index={String(items.length + 1).padStart(2, '0')}
				meta={`${doneSets}/${totalSets}`}
				title={m.sec_session()}
			>
				<Row>
					<Lbl className="block">{m.wk_add_ex()}</Lbl>
					<select
						aria-label={m.wk_add_ex()}
						className="bench-input mt-1 appearance-none"
						onChange={(e) => addExercise(e.target.value)}
						value=""
					>
						<option value="">—</option>
						{fx.train.available
							.filter((a) => !extra.includes(a.exId))
							.map((a) => (
								<option key={a.exId} value={a.exId}>
									{a.name} · {a.cat}
								</option>
							))}
					</select>
				</Row>

				{/* Spent, and shown spent rather than hidden: an instrument prints the
				    control it cannot offer, ruled out, so the athlete learns where it
				    lives for the day it works. */}
				<Row tone={fx.train.canRepeatLast ? 'live' : 'held'}>
					<Bench
						disabled={!fx.train.canRepeatLast}
						kind={fx.train.canRepeatLast ? 'plain' : 'spent'}
						wide
					>
						{fx.train.canRepeatLast ? m.train_repeat() : m.train_no_prev()}
					</Bench>
				</Row>

				<Row>
					<label className="block" htmlFor="note">
						<Lbl className="block">{m.train_note()}</Lbl>
						<textarea
							className="bench-input mt-1 resize-none"
							id="note"
							onChange={(e) => setNote(e.target.value)}
							rows={2}
							value={note}
						/>
					</label>
				</Row>

				<Row>
					<label className="block" htmlFor="dur">
						<Lbl className="block">{m.train_duration()}</Lbl>
						<input
							className="bench-input mt-1"
							id="dur"
							inputMode="numeric"
							onChange={(e) => setDuration(e.target.value)}
							value={duration}
						/>
					</label>
					<Lbl className="mt-1 block text-ink-faint">{m.train_duration_hint()}</Lbl>
				</Row>

				<Row>
					<div className="space-y-1">
						<KV k={m.train_autosave()} v={m.sync_saved()} />
						<KV k={m.stats_sets()} v={`${doneSets}/${totalSets}`} />
					</div>
					<Bench
						className="mt-2"
						disabled={doneSets === 0}
						kind={finished ? 'spent' : doneSets === 0 ? 'spent' : 'solid'}
						onClick={() => setFinished(true)}
						wide
					>
						{finished ? m.train_logged() : doneSets === 0 ? m.train_nothing() : m.train_finish()}
					</Bench>
				</Row>
			</Section>
		</Frame>
	);
}
