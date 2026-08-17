// Reading a prescription out loud: ranges, seconds, loads, edges, grips, costs.
//
// The SvelteKit app spread these across `plan.ts` and `units.ts`; both modules
// are tangled with a store the rebuild has not landed yet (ADR 0007 owns what
// holds state), so the pure formatting half is lifted here. Unit preferences do
// not exist in the rebuild, so everything is canonical: kg, mm, seconds.
import type { Cost, Grip, Range } from '$lib/content/types';
import * as m from '$lib/paraglide/messages';

/** "4" for a fixed value, "3–5" for a range. En dash, not a hyphen: at 10–11px
 *  mono a hyphen reads as a minus sign, which matters when loads can be negative
 *  (assisted). */
export function formatRange(r: Range): string {
	return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}

function formatSeconds(s: number): string {
	return s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s}s`;
}

/** "10s", "30–45s", "3 min–5 min". */
export function formatSecondsRange(r: Range): string {
	if (r.min === r.max) return formatSeconds(r.min);
	if (r.max < 60) return `${r.min}–${r.max}s`;
	return `${formatSeconds(r.min)}–${formatSeconds(r.max)}`;
}

/** "+30–45kg". The sign is carried explicitly because a negative load means
 *  *assisted*, and a bare "-20kg" next to "+20kg" is the difference between two
 *  entirely different exercises. */
export function formatLoad(r: Range): string {
	return `${r.min >= 0 ? '+' : ''}${formatRange(r)}kg`;
}

export function formatEdge(r: Range): string {
	return `${formatRange(r)}mm`;
}

const GRIP_LABEL: Record<Grip, () => string> = {
	'half-crimp': m.grip_half_crimp,
	'open-hand': m.grip_open_hand,
	'full-crimp': m.grip_full_crimp,
	pinch: m.grip_pinch,
	sloper: m.grip_sloper,
	wrist: m.grip_wrist,
	jug: m.grip_jug,
};

/** All grips in display order, for the per-set grip picker. */
export const GRIPS: Grip[] = [
	'half-crimp',
	'open-hand',
	'full-crimp',
	'pinch',
	'sloper',
	'wrist',
	'jug',
];

export function gripLabel(grip: string): string {
	return GRIP_LABEL[grip as Grip]?.() ?? grip;
}

const COST_LABEL: Record<Cost, () => string> = {
	low: m.cost_low,
	mod: m.cost_mod,
	high: m.cost_high,
};

export function costLabel(c: Cost): string {
	return COST_LABEL[c]();
}

/** Column head for one logged per-set field. */
export const SET_FIELD_LABEL: Record<string, () => string> = {
	weight: m.field_weight,
	edge: m.field_edge,
	time: m.field_time,
	reps: m.field_reps,
	grip: m.field_grip,
	rest: m.field_rest,
	rpe: m.field_rpe,
};

/** Seconds as mm:ss, for the timer's remaining / total readouts. */
export function clock(total: number): string {
	const s = Math.max(0, Math.round(total));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
