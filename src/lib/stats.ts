// Analytics over logged workouts. Pure functions; the Stats page renders the
// results. Region/quality/CNS come from an exercise's default-variant params
// (these are stable across an exercise's variants); progression/volume come
// from the logged sets. Workouts are stored newest-first.
import { getLocale } from '$lib/paraglide/runtime';
import { exerciseParams } from './content/exercises';
import type { WorkoutEntry } from './state.svelte';

export type NumField = 'weight' | 'edge' | 'time' | 'reps' | 'rest' | 'rpe';

export interface Point {
	label: string;
	value: number;
}

const params = (exId: string) => exerciseParams[exId]?.variants[0];
const CNS_WEIGHT: Record<string, number> = { low: 1, mod: 2, high: 3 };
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

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

export interface LoadStat {
	label: string;
	sets: number;
	tonnage: number;
	tut: number;
	cns: number;
}

/** The Monday (local) that starts the ISO week containing an ISO date. */
function mondayOf(iso: string): Date {
	const d = new Date(`${iso}T00:00:00`);
	d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
	return d;
}

/** Training load bucketed by calendar week (oldest→newest): set count, tonnage,
 *  time-under-tension, CNS load. */
export function weeklyStats(workouts: WorkoutEntry[]): LoadStat[] {
	const buckets = new Map<string, LoadStat>();
	for (const w of workouts) {
		const monday = mondayOf(w.at);
		const key = isoDay(monday);
		let b = buckets.get(key);
		if (!b) {
			b = {
				label: monday.toLocaleDateString(getLocale(), { month: 'short', day: 'numeric' }),
				sets: 0,
				tonnage: 0,
				tut: 0,
				cns: 0,
			};
			buckets.set(key, b);
		}
		for (const ex of w.exercises) {
			b.sets += ex.sets.length;
			b.cns += (CNS_WEIGHT[params(ex.exId)?.cnsCost ?? ''] ?? 0) * ex.sets.length;
			for (const s of ex.sets) {
				const reps = s.reps ?? 1;
				if (s.weight != null) b.tonnage += s.weight * reps;
				if (s.time != null) b.tut += s.time * reps;
			}
		}
	}
	return [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v);
}

/** Average RPE across the most recent sessions (null if none logged). */
export function recentRpe(workouts: WorkoutEntry[], sessions = 2): number | null {
	const rpes: number[] = [];
	for (const w of workouts.slice(0, sessions))
		for (const ex of w.exercises) for (const s of ex.sets) if (s.rpe != null) rpes.push(s.rpe);
	return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
}

/** A session counts as trained once at least one set is marked done (prefilled
 *  but-untouched sets don't count). */
const hasDoneSet = (w: WorkoutEntry): boolean =>
	w.exercises.some((ex) => ex.sets.some((s) => s.done));

/** Number of sessions actually trained (≥1 completed set). */
export function completedSessions(workouts: WorkoutEntry[]): number {
	return workouts.filter(hasDoneSet).length;
}

const loggedDays = (workouts: WorkoutEntry[]) =>
	new Set(workouts.filter(hasDoneSet).map((w) => w.at));

/** Consecutive calendar days with a logged workout, ending today (or yesterday). */
export function trainStreak(workouts: WorkoutEntry[]): number {
	const days = loggedDays(workouts);
	if (days.size === 0) return 0;
	const cur = new Date();
	if (!days.has(isoDay(cur))) cur.setDate(cur.getDate() - 1); // grace: today not done yet
	let streak = 0;
	while (days.has(isoDay(cur))) {
		streak += 1;
		cur.setDate(cur.getDate() - 1);
	}
	return streak;
}

/** Distinct days trained in the last 7 calendar days. */
export function sessionsLast7(workouts: WorkoutEntry[]): number {
	const days = loggedDays(workouts);
	const cur = new Date();
	let n = 0;
	for (let i = 0; i < 7; i++) {
		if (days.has(isoDay(cur))) n += 1;
		cur.setDate(cur.getDate() - 1);
	}
	return n;
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
