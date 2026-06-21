// Resolution helpers for the per-week training plan: which protocol a calendar
// slot runs, and which swap applies to each exercise on that specific day.
// Read inside a reactive context (e.g. $derived) so they track appState.
import type { Content, Day, Prescription } from './content/types';
import { appState } from './state.svelte';

export function slotKey(week: number, weekday: string): string {
	return `w${week}-${weekday}`;
}

export function taskKey(week: number, weekday: string, exId: string): string {
	return `w${week}-${weekday}:${exId}`;
}

/** Template weekday key planned for a slot (defaults to the slot's own weekday). */
function resolveDayKey(week: number, weekday: string): string {
	return appState.dayPlan[slotKey(week, weekday)] ?? weekday;
}

/** The Day template a slot will actually run, after any per-day protocol override. */
export function resolveDay(content: Content, week: number, weekday: string): Day {
	const tk = resolveDayKey(week, weekday);
	return content.days.find((d) => d.k === tk) ?? content.days[0];
}

/** The exercise ids for a slot: a per-day custom list if set, else the protocol's. */
export function resolveExerciseIds(content: Content, week: number, weekday: string): string[] {
	return appState.dayExercises[slotKey(week, weekday)] ?? resolveDay(content, week, weekday).ex;
}

/** Replace a slot's exercise list (materializes the per-day override). */
function setDayExercises(content: Content, week: number, weekday: string, exIds: string[]): void {
	const k = slotKey(week, weekday);
	const base = resolveDay(content, week, weekday).ex;
	// Clear the override when it matches the protocol's default list exactly.
	if (exIds.length === base.length && exIds.every((id, i) => id === base[i])) {
		delete appState.dayExercises[k];
	} else {
		appState.dayExercises[k] = exIds;
	}
}

export function addDayExercise(
	content: Content,
	week: number,
	weekday: string,
	exId: string,
): void {
	const current = resolveExerciseIds(content, week, weekday);
	if (!current.includes(exId)) setDayExercises(content, week, weekday, [...current, exId]);
}

export function removeDayExercise(
	content: Content,
	week: number,
	weekday: string,
	exId: string,
): void {
	const current = resolveExerciseIds(content, week, weekday);
	setDayExercises(
		content,
		week,
		weekday,
		current.filter((id) => id !== exId),
	);
}

/** Swap index for an exercise on a given day: per-day override → global → default. */
export function resolveSwapIndex(week: number, weekday: string, exId: string): number {
	const perDay = appState.daySwaps[taskKey(week, weekday, exId)];
	if (perDay != null) return perDay;
	return appState.swaps[exId] ?? 0;
}

interface VariantLike {
	name: string;
	what: string;
	spec: Prescription;
	why: string[];
}

/** The exercise variant at a swap index, falling back to the default (index 0). */
export function variantOf<T extends { variants: VariantLike[] }>(ex: T, idx: number): VariantLike {
	return ex.variants[idx] ?? ex.variants[0];
}

/** Display label for an exercise at a swap index (index 0 = its default name). */
export function exerciseLabel(ex: { variants: VariantLike[] }, idx: number): string {
	return variantOf(ex, idx).name;
}

/** Set/clear a per-day protocol override for a slot. */
export function setDayPlan(week: number, weekday: string, templateKey: string): void {
	const k = slotKey(week, weekday);
	if (templateKey === weekday) delete appState.dayPlan[k];
	else appState.dayPlan[k] = templateKey;
}

/** Set/clear a per-day swap override for an exercise (clears when it matches the global default). */
export function setDaySwap(week: number, weekday: string, exId: string, idx: number): void {
	const k = taskKey(week, weekday, exId);
	const globalDefault = appState.swaps[exId] ?? 0;
	if (idx === globalDefault) delete appState.daySwaps[k];
	else appState.daySwaps[k] = idx;
}

/** Whether a slot has any per-day customization (category, exercise list, or swaps). */
export function isDayCustomized(week: number, weekday: string): boolean {
	const k = slotKey(week, weekday);
	if (appState.dayPlan[k] != null || appState.dayExercises[k] != null) return true;
	return Object.keys(appState.daySwaps).some((key) => key.startsWith(`${k}:`));
}

/** Format a duration given in seconds (the standard unit) for display. */
export function formatSeconds(s: number): string {
	if (s < 60) return `${s}s`;
	const min = s / 60;
	if (Number.isInteger(min)) return `${min} min`;
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Timer intervals seeded from an exercise, ready to drive the interval timer. */
export interface TimerSeed {
	key: string;
	name: string;
	work: number;
	rest: number;
	rounds: number;
}

/** Interval-timer settings for an exercise, or null when it isn't a timed protocol. */
export function timerSeedFor(spec: Prescription, key: string, name: string): TimerSeed | null {
	if (spec.workSec == null) return null;
	const rest = spec.restSec ?? spec.setRestSec ?? 0;
	const setsInt = spec.sets ? Number.parseInt(spec.sets.match(/\d+/)?.[0] ?? '', 10) : Number.NaN;
	const rounds = spec.rounds ?? (Number.isNaN(setsInt) ? 1 : setsInt);
	return { key, name, work: spec.workSec, rest, rounds };
}

/** Clear all per-day customizations for a slot, reverting it to the recommendation. */
export function resetDay(week: number, weekday: string): void {
	const k = slotKey(week, weekday);
	delete appState.dayPlan[k];
	delete appState.dayExercises[k];
	for (const key of Object.keys(appState.daySwaps)) {
		if (key.startsWith(`${k}:`)) delete appState.daySwaps[key];
	}
}
