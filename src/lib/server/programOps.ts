// Server-side, framework-free mutations on a Program object, used by the MCP
// endpoint. Each validates its input and throws on bad data (the caller turns
// that into a tool error). Mirrors the client editor's semantics.
import { exerciseParams } from '$lib/content/exercises';
import type { Program, ProgramTarget } from '$lib/state.svelte';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const EXERCISE_IDS = Object.keys(exerciseParams);
const TARGET_FIELDS = ['variant', 'sets', 'reps', 'loadKg', 'edgeMm', 'workSec', 'restSec', 'rpe'];

export function defaultProgram(): Program {
	return { weeks: 8, template: {}, targets: {}, phases: [], autoProgress: true };
}

function isObj(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function num(v: unknown, lo: number, hi: number, fallback: number): number {
	const n = Math.round(Number(v));
	return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

/** Replace the periodization phases. */
export function applySetPhases(program: Program, phases: unknown): void {
	if (!Array.isArray(phases)) throw new Error('`phases` must be an array');
	program.phases = phases.map((p, i) => {
		if (!isObj(p)) throw new Error(`phase ${i} must be an object`);
		return {
			name: String(p.name ?? `Phase ${i + 1}`),
			weeks: num(p.weeks, 1, 52, 4),
			intensity: num(p.intensity, 10, 200, 100),
			volume: num(p.volume, 10, 200, 100),
			deload: Boolean(p.deload),
		};
	});
}

export function applySetAutoProgress(program: Program, enabled: unknown): void {
	program.autoProgress = Boolean(enabled);
}

const isKnown = (id: string, extraIds: string[]) =>
	EXERCISE_IDS.includes(id) || extraIds.includes(id);

/** Set a weekday's day-type and/or its ordered exercise list. `extraIds` are the
 *  user's custom exercise ids, also accepted alongside the built-in library. */
export function applyEditDay(
	program: Program,
	weekday: unknown,
	dayKey?: unknown,
	ex?: unknown,
	extraIds: string[] = [],
): void {
	if (typeof weekday !== 'string' || !WEEKDAYS.includes(weekday))
		throw new Error(`weekday must be one of ${WEEKDAYS.join(', ')}`);
	const entry = { ...program.template[weekday] };
	if (dayKey !== undefined) {
		if (typeof dayKey !== 'string' || !WEEKDAYS.includes(dayKey))
			throw new Error(`dayKey must be one of ${WEEKDAYS.join(', ')}`);
		entry.dayKey = dayKey;
	} else {
		entry.dayKey ??= weekday;
	}
	if (ex !== undefined) {
		if (!Array.isArray(ex) || ex.some((id) => !isKnown(id, extraIds)))
			throw new Error('exercises must be an array of known exercise ids (see list_exercises)');
		entry.ex = ex as string[];
	}
	program.template[weekday] = entry;
}

/** Set/clear a per-exercise target override for a weekday. */
export function applySetTarget(
	program: Program,
	weekday: unknown,
	exercise: unknown,
	patch: unknown,
	extraIds: string[] = [],
): void {
	if (typeof weekday !== 'string' || !WEEKDAYS.includes(weekday))
		throw new Error(`weekday must be one of ${WEEKDAYS.join(', ')}`);
	if (typeof exercise !== 'string' || !isKnown(exercise, extraIds))
		throw new Error('exercise must be a known exercise id (see list_exercises)');
	if (!isObj(patch)) throw new Error('target fields must be an object');
	const key = `${weekday}:${exercise}`;
	const next: ProgramTarget = { ...program.targets[key] };
	for (const f of TARGET_FIELDS) {
		if (!(f in patch)) continue;
		const v = patch[f];
		if (v === null) delete next[f as keyof ProgramTarget];
		else next[f as keyof ProgramTarget] = Math.round(Number(v));
	}
	if (Object.keys(next).length) program.targets[key] = next;
	else delete program.targets[key];
}
