// Analytics over logged workouts. Pure functions; the Stats page renders the
// results. Region/quality/CNS come from an exercise's default-variant params
// (these are stable across an exercise's variants); progression/volume come
// from the logged sets. Workouts are stored newest-first.
import { exerciseParams } from './content/exercises';
import type { WorkoutEntry } from './state.svelte';

export type NumField = 'weight' | 'edge' | 'time' | 'reps' | 'rest' | 'rpe';

export interface Point {
	label: string;
	value: number;
}

const params = (exId: string) => exerciseParams[exId]?.variants[0];
const CNS_WEIGHT: Record<string, number> = { low: 1, mod: 2, high: 3 };

/** Chronological (oldest→newest) workouts. */
function chronological(workouts: WorkoutEntry[]): WorkoutEntry[] {
	return [...workouts].reverse();
}

/** Exercise ids that appear in any logged workout, most-used first. */
export function loggedExerciseIds(workouts: WorkoutEntry[]): string[] {
	const counts = new Map<string, number>();
	for (const w of workouts)
		for (const ex of w.exercises) counts.set(ex.exId, (counts.get(ex.exId) ?? 0) + ex.sets.length);
	return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Best (max) value of a field for an exercise, per session, oldest→newest. */
export function progression(workouts: WorkoutEntry[], exId: string, field: NumField): Point[] {
	const pts: Point[] = [];
	for (const w of chronological(workouts)) {
		const ex = w.exercises.find((e) => e.exId === exId);
		if (!ex) continue;
		const vals = ex.sets.map((s) => s[field]).filter((v): v is number => v != null);
		if (vals.length) pts.push({ label: w.date, value: Math.max(...vals) });
	}
	return pts;
}

/** Which numeric field an exercise has logged most (for a sensible default). */
export function dominantField(workouts: WorkoutEntry[], exId: string): NumField {
	const fields: NumField[] = ['weight', 'edge', 'time', 'reps'];
	const counts = new Map<NumField, number>();
	for (const w of workouts)
		for (const ex of w.exercises)
			if (ex.exId === exId)
				for (const s of ex.sets)
					for (const f of fields) if (s[f] != null) counts.set(f, (counts.get(f) ?? 0) + 1);
	let best: NumField = 'weight';
	let max = -1;
	for (const f of fields) {
		const c = counts.get(f) ?? 0;
		if (c > max) {
			max = c;
			best = f;
		}
	}
	return best;
}

export interface VolumeBar {
	key: string;
	value: number;
}

/** Logged sets grouped by a variant tag (region or quality), sorted desc. */
function volumeBy(workouts: WorkoutEntry[], tag: 'region' | 'qualities'): VolumeBar[] {
	const m = new Map<string, number>();
	for (const w of workouts)
		for (const ex of w.exercises) {
			const tags = params(ex.exId)?.[tag] ?? [];
			for (const t of tags) m.set(t, (m.get(t) ?? 0) + ex.sets.length);
		}
	return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, value }));
}

export const regionVolume = (w: WorkoutEntry[]): VolumeBar[] => volumeBy(w, 'region');
export const qualityVolume = (w: WorkoutEntry[]): VolumeBar[] => volumeBy(w, 'qualities');

export interface SessionStat {
	label: string;
	sets: number;
	tonnage: number;
	tut: number;
	cns: number;
}

/** Per-session totals (oldest→newest): set count, tonnage, time-under-tension, CNS load. */
export function sessionStats(workouts: WorkoutEntry[]): SessionStat[] {
	return chronological(workouts).map((w) => {
		let sets = 0;
		let tonnage = 0;
		let tut = 0;
		let cns = 0;
		for (const ex of w.exercises) {
			sets += ex.sets.length;
			cns += (CNS_WEIGHT[params(ex.exId)?.cnsCost ?? ''] ?? 0) * ex.sets.length;
			for (const s of ex.sets) {
				const reps = s.reps ?? 1;
				if (s.weight != null) tonnage += s.weight * reps;
				if (s.time != null) tut += s.time * reps;
			}
		}
		return { label: w.date, sets, tonnage, tut, cns };
	});
}

/** Counts of logged RPE values, bucketed 1–10. */
export function rpeHistogram(workouts: WorkoutEntry[]): Point[] {
	const counts = new Array(11).fill(0) as number[];
	for (const w of workouts)
		for (const ex of w.exercises)
			for (const s of ex.sets)
				if (s.rpe != null) {
					const r = Math.min(10, Math.max(1, Math.round(s.rpe)));
					counts[r] += 1;
				}
	const out: Point[] = [];
	for (let r = 1; r <= 10; r++) if (counts[r] > 0) out.push({ label: String(r), value: counts[r] });
	return out;
}
