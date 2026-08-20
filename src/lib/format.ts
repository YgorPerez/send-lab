// Display formatting for prescriptions, logged sets and the clock.
//
// In `lib/` and not in `components/` because none of it is a component: these
// are pure functions from domain values to strings, and the same string is
// wanted in a card, in a table cell and in an `aria-label`. Putting them beside
// the components that happen to call them first is how a formatter ends up
// duplicated in the second screen that needs it.
//
// The SvelteKit app kept these in `$lib/plan` + `$lib/units`, neither of which
// survived into the rebuild. They are re-derived rather than ported whole:
// `units.ts` existed to convert kg↔lb and mm↔in against a stored preference, and
// the rebuild has no preferences store yet, so everything below is canonical
// units only. When the real settings screen lands, this is the seam that grows
// the conversion back.
//
// ADR-0003 applies: these produce *display strings*. Nothing here is ever
// matched on, stored, or used as a key.
import type { Content, Cost, Exercise, Grip, Quality, Range, Region } from '$lib/content/types';
import type { WeekdayKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import { variantOf } from '$lib/prescription';

/** "4" for a fixed value, "4–6" for a range. */
export function formatRange(r: Range): string {
	return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}

/** "45s" under a minute, "3 min" at or above it. */
export function formatSeconds(s: number): string {
	return s < 60 ? `${s}s` : `${Math.round((s / 60) * 10) / 10} min`;
}

/** "10s", "20–40s", "3 min–5 min". */
export function formatSecondsRange(r: Range): string {
	if (r.min === r.max) return formatSeconds(r.min);
	if (r.max < 60) return `${r.min}–${r.max}s`;
	return `${formatSeconds(r.min)}–${formatSeconds(r.max)}`;
}

/** Added load, signed: "+30–45kg", "−10kg" for assistance. */
export function formatLoad(r: Range): string {
	const sign = r.min >= 0 ? '+' : '';
	return `${sign}${formatRange(r)}kg`;
}

/** Edge depth: "18–22mm". */
export function formatEdge(r: Range): string {
	return `${formatRange(r)}mm`;
}

/**
 * The localized name of a weekday, from the content library's built-in week.
 *
 * The last label helper still living in `main`'s `plan.ts` (#69). It exists
 * because the resolver deliberately does *not* return one: `missedYesterday`
 * hands back a `WeekdayKey` and the caller labels it here, where `main` returned
 * the label beside the ids and sent a display string travelling as data
 * (ADR-0003). Falls back to the key, which is wrong in pt-BR and visible — better
 * than an empty cell that looks intentional.
 */
export function weekdayLabel(content: Content, weekday: WeekdayKey): string {
	return content.days.find((d) => d.k === weekday)?.label ?? weekday;
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

/** All grips, in display order (for the per-set grip picker). */
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
	return COST_LABEL[c]?.() ?? c;
}

const REGION_LABEL: Record<Region, () => string> = {
	fingers: m.region_fingers,
	wrist: m.region_wrist,
	pull: m.region_pull,
	antagonist: m.region_antagonist,
};

/** Localized label for a body region — which part of the body an exercise loads.
 *  Not a body area, which is the axis *injury* runs along (ADR 0013). */
export function regionLabel(r: string): string {
	return REGION_LABEL[r as Region]?.() ?? r;
}

const QUALITY_LABEL: Record<Quality, () => string> = {
	'max-strength': m.qual_max_strength,
	rfd: m.qual_rfd,
	'strength-endurance': m.qual_strength_endurance,
	hypertrophy: m.qual_hypertrophy,
	tissue: m.qual_tissue,
	power: m.qual_power,
	aerobic: m.qual_aerobic,
	skill: m.qual_skill,
};

/** Localized label for a training quality — the adaptation an exercise trains. */
export function qualityLabel(q: string): string {
	return QUALITY_LABEL[q as Quality]?.() ?? q;
}

/**
 * The display label for an exercise at a swap index.
 *
 * Here rather than in `prescription.ts` because it is a label: the resolver
 * decides *which* variant, this says what to call it. It leans on `variantOf` for
 * the index fallback rather than re-deriving it, so a stored index that outlived
 * its variant reads the same in both places.
 *
 * ADR 0012's replacement for the `LoggedExercise.name` that used to be persisted:
 * a session stores an exercise id and a variant index, and this produces the name
 * in whatever language is active at render.
 */
export function exerciseLabel(exercise: Exercise, index: number): string {
	return variantOf(exercise, index).name;
}

/** mm:ss for a countdown. */
export function clock(totalSec: number): string {
	const s = Math.max(0, Math.round(totalSec));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The five wellness dimensions, in the order the readiness score reads them. */
export const WELLNESS_LABEL: Record<string, () => string> = {
	sleep: m.rd_sleep,
	fatigue: m.rd_fatigue,
	soreness: m.rd_soreness,
	stress: m.rd_stress,
	mood: m.rd_mood,
};

/** Post-session outcome: 0 bailed · 1 flat · 2 as expected · 3 strong. */
export const OUTCOME_LABEL = [
	m.rd_outcome_bailed,
	m.rd_outcome_flat,
	m.rd_outcome_ok,
	m.rd_outcome_strong,
];
