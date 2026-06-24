// The Train tab logs directly into today's workout entry in appState.workouts —
// per day, auto-saved (server-persisted), never reset. Today's entry is matched
// by date + day label; it's created lazily when the first set is added.
import type { Range, Variant } from './content/types';
import { appState, today, type WorkoutSet } from './state.svelte';

const mid = (r?: Range): number | null => (r ? Math.round((r.min + r.max) / 2) : null);

/** A set pre-filled from an exercise's target prescription (range midpoints). */
export function defaultSet(spec: Variant): WorkoutSet {
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

/** Copy the most recent prior session for this day into today; returns its exercise ids. */
export function repeatLastInto(day: string): string[] | null {
	const prev = appState.workouts.find((w) => w.day === day && w.date !== today());
	if (!prev) return null;
	const e = ensureEntry(day);
	e.exercises = prev.exercises.map((x) => ({
		exId: x.exId,
		name: x.name,
		sets: x.sets.map((s) => ({ ...s, done: false })),
	}));
	return e.exercises.map((x) => x.exId);
}

export function getNote(day: string): string {
	return todayEntry(day)?.note ?? '';
}

export function setNote(day: string, note: string): void {
	const e = todayEntry(day);
	if (e) e.note = note;
}

/** Logged session length in minutes today (the sRPE duration term), or '' if unset. */
export function getDuration(day: string): number | '' {
	return todayEntry(day)?.durationMin ?? '';
}

/** Record (or clear) today's session length in minutes. Creates the entry so the
 *  duration can be set before any set is logged. */
export function setDuration(day: string, min: number | null): void {
	const e = ensureEntry(day);
	if (min == null || Number.isNaN(min) || min <= 0) e.durationMin = undefined;
	else e.durationMin = Math.round(min);
}
