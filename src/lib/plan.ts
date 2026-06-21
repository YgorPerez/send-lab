// Resolution helpers for the per-week training plan: which protocol a calendar
// slot runs, and which swap applies to each exercise on that specific day.
// Read inside a reactive context (e.g. $derived) so they track appState.
import type { Content, Day } from './content/types';
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

/** Swap index for an exercise on a given day: per-day override → global → default. */
export function resolveSwapIndex(week: number, weekday: string, exId: string): number {
	const perDay = appState.daySwaps[taskKey(week, weekday, exId)];
	if (perDay != null) return perDay;
	return appState.swaps[exId] ?? 0;
}

/** Display label for an exercise at a swap index (index 0 = its default name). */
export function exerciseLabel(ex: { name: string; swaps: string[] }, idx: number): string {
	return idx > 0 && ex.swaps[idx] ? ex.swaps[idx] : ex.name;
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
