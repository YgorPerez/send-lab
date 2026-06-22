// The Train tab logs directly into today's workout entry in appState.workouts —
// per day, auto-saved (server-persisted), never reset. Today's entry is matched
// by date + day label; it's created lazily when the first set is added.
import { appState, today, type WorkoutSet } from './state.svelte';

function todayEntry(day: string) {
	return appState.workouts.find((w) => w.date === today() && w.day === day);
}

function ensureEntry(day: string) {
	let e = todayEntry(day);
	if (!e) {
		e = { date: today(), at: new Date().toISOString().slice(0, 10), day, exercises: [], note: '' };
		appState.workouts.unshift(e);
	}
	return e;
}

/** Logged sets for an exercise today (a live reference into appState). */
export function setsFor(day: string, exId: string): WorkoutSet[] {
	return todayEntry(day)?.exercises.find((x) => x.exId === exId)?.sets ?? [];
}

export function addSetTo(day: string, exId: string, name: string, set: WorkoutSet): void {
	const e = ensureEntry(day);
	let ex = e.exercises.find((x) => x.exId === exId);
	if (!ex) {
		ex = { exId, name, sets: [] };
		e.exercises.push(ex);
	}
	ex.name = name; // keep the label current with the selected variant
	ex.sets.push(set);
}

export function removeSetFrom(day: string, exId: string, i: number): void {
	const ex = todayEntry(day)?.exercises.find((x) => x.exId === exId);
	if (ex) ex.sets.splice(i, 1);
}

/** Remove an exercise's logged sets for today (when it's removed from the day). */
export function clearExercise(day: string, exId: string): void {
	const e = todayEntry(day);
	if (e) e.exercises = e.exercises.filter((x) => x.exId !== exId);
}

export function getNote(day: string): string {
	return todayEntry(day)?.note ?? '';
}

export function setNote(day: string, note: string): void {
	const e = todayEntry(day);
	if (e) e.note = note;
}
