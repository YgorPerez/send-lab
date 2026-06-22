// Unit preferences. Values are stored canonically (kg, mm); these convert for
// display/entry per the user's `appState.prefs`. Call inside reactive contexts
// to stay live when the preference changes.
import type { Range } from './content/types';
import * as m from './paraglide/messages';
import { appState } from './state.svelte';

const LB_PER_KG = 2.20462;
const MM_PER_IN = 25.4;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

const weightUnit = (): string => appState.prefs.weight;
const lengthUnit = (): string => appState.prefs.length;

/** Canonical kg → displayed value in the chosen weight unit. */
export function showKg(kg: number | null): number | null {
	if (kg == null) return null;
	return appState.prefs.weight === 'lb' ? round1(kg * LB_PER_KG) : round1(kg);
}
/** Entered value (chosen unit) → canonical kg. */
export function toKg(v: number): number {
	return appState.prefs.weight === 'lb' ? v / LB_PER_KG : v;
}
/** Canonical mm → displayed value in the chosen length unit. */
export function showMm(mm: number | null): number | null {
	if (mm == null) return null;
	return appState.prefs.length === 'in' ? round2(mm / MM_PER_IN) : Math.round(mm);
}
/** Entered value (chosen unit) → canonical mm. */
export function toMm(v: number): number {
	return appState.prefs.length === 'in' ? v * MM_PER_IN : v;
}

/** Column/field labels including the active unit. */
export const weightLabel = (): string => `${m.field_weight()} (${weightUnit()})`;
export const edgeLabel = (): string => `${m.field_edge()} (${lengthUnit()})`;

function fmtRange(min: number | null, max: number | null): string {
	if (min == null) return '';
	return min === max ? `${min}` : `${min}–${max}`;
}

/** Format a kg range for display ("+30–45kg", "+66–99lb"). */
export function formatLoad(r: Range): string {
	const sign = r.min >= 0 ? '+' : '';
	return `${sign}${fmtRange(showKg(r.min), showKg(r.max))}${weightUnit()}`;
}
/** Format an mm range for display ("18–20mm", "0.71–0.79in"). */
export function formatEdge(r: Range): string {
	return `${fmtRange(showMm(r.min), showMm(r.max))}${lengthUnit()}`;
}
