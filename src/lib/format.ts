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
// `units.ts` existed to convert kg↔lb and mm↔in against a stored preference.
// The preference exists again — `prefs.weight` / `prefs.length`, set on Settings
// (#62) — but nothing reads it yet, so everything below is canonical units only.
// This is the seam that grows the conversion back, and it should take the
// preference as an argument rather than read it, for the reason `getContent`
// takes its locale.
//
// ADR-0003 applies: these produce *display strings*. Nothing here is ever
// matched on, stored, or used as a key.
import type {
	Content,
	Cost,
	Exercise,
	Grip,
	Quality,
	Range,
	Region,
	Variant,
	VerdictId,
} from '$lib/content/types';
import type { WeekdayKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import { variantOf } from '$lib/prescription';
import type { ExerciseStudy } from '$lib/progression';
import type { Protocol } from '$lib/protocol';
import type { AppLocale } from '$lib/store/locale';
import type { Confidence } from '$lib/strength';
import type { WorkingLoadSource } from '$lib/types';

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
 * A prescription in one line, for a task folded on Train (#118): how much, then
 * how hard. "4–6 × 3–5 · +32–48kg", "3 × 30–45s", "1 × 20 × 10s · 18–22mm".
 *
 * The volume is sets, then rounds, then reps or the work interval; the
 * intensity is the load, or the edge, or the share of max. Rests are left out:
 * they are what the clock runs, not what tells one task from another. A
 * prescription with none of that says its effort, and one with nothing at all
 * says nothing rather than a dash that looks like a value.
 */
export function shortPrescription(p: Variant): string {
	const volume = [
		p.sets ? formatRange(p.sets) : null,
		p.rounds ? formatRange(p.rounds) : null,
		p.reps ? formatRange(p.reps) : p.workSec ? formatSecondsRange(p.workSec) : null,
	].filter((x): x is string => x != null);
	const intensity = p.loadKg
		? formatLoad(p.loadKg)
		: p.edgeMm
			? formatEdge(p.edgeMm)
			: p.intensityPct
				? `${formatRange(p.intensityPct)}%`
				: null;
	const parts = [volume.join(' × '), intensity].filter((x): x is string => !!x);
	if (parts.length > 0) return parts.join(' · ');
	return p.rpe ? `${m.presc_rpe()} ${formatRange(p.rpe)}` : '';
}

/**
 * The localized name of a weekday, from the content library's built-in week.
 *
 * The last label helper still living in `main`'s `plan.ts` (#69). It exists
 * because the resolver deliberately does *not* return one: `carryForwardFromYesterday`
 * hands back a `WeekdayKey` and the caller labels it here, where `main` returned
 * the label beside the ids and sent a display string travelling as data
 * (ADR-0003). Falls back to the key, which is wrong in pt-BR and visible — better
 * than an empty cell that looks intentional.
 */
export function weekdayLabel(content: Content, weekday: WeekdayKey): string {
	return content.builtInWeek.find((d) => d.k === weekday)?.label ?? weekday;
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

const CONFIDENCE_LABEL: Record<Confidence, () => string> = {
	high: m.conf_high,
	med: m.conf_med,
	low: m.conf_low,
};

/** How far to trust an estimate, said out loud.
 *
 *  The three messages predate the rebuild and had no caller — the SvelteKit app
 *  showed a marker's confidence beside a tracked number, and markers left. They
 *  are read again for the opposite direction: the confidence of the *estimate*
 *  behind a suggested load (#90). It is shown rather than swallowed, because a
 *  prediction from a 6mm edge is not the same claim as one from 20mm. */
export function confidenceLabel(c: Confidence): string {
	return CONFIDENCE_LABEL[c]?.() ?? c;
}

const WORKING_LOAD_SOURCE_LABEL: Record<WorkingLoadSource, () => string> = {
	tested: m.wl_from_tested,
	usual: m.wl_from_usual,
	predicted: m.wl_from_predicted,
	floor: m.wl_from_floor,
};

/** Where a stored working load's number came from — the rung of the ladder the
 *  athlete answered on, as a phrase that completes "from …". */
export function workingLoadSourceLabel(source: WorkingLoadSource): string {
	return WORKING_LOAD_SOURCE_LABEL[source]?.() ?? source;
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

/**
 * A protocol at a glance: `6 × 7s/3s · 4 sets`, `10s · 3 sets`, `20 × 10s/20s`,
 * `8 × 20s/10s · 2:00 cooldown`.
 *
 * What a row in a list of protocols says instead of six labelled numbers. A
 * count of one is left out rather than spelled — one round is a single effort,
 * one set is the whole thing — and so is the rest of a protocol with one round,
 * which never runs. The locale is an argument because a screen resolver calls it
 * (#101), and a resolver is a function of what it was handed.
 */
export function protocolShape(p: Protocol, locale?: AppLocale): string {
	const effort =
		p.rounds > 1 ? `${p.rounds} × ${p.work}s${p.rest > 0 ? `/${p.rest}s` : ''}` : `${p.work}s`;
	const parts = [effort];
	if (p.sets > 1) parts.push(m.timer_preset_sets({ sets: p.sets }, { locale }));
	// A cooldown (#104) is usually minutes, so it reads as a clock past one; and
	// it is named, because a bare `2:00` at the end reads as the total.
	if (p.cooldown > 0) {
		parts.push(m.timer_shape_cooldown({ time: shortTime(p.cooldown) }, { locale }));
	}
	return parts.join(' · ');
}

/** The title of each study the library cites for an exercise. */
export const STUDY_TITLE: Record<ExerciseStudy, typeof m.study_baar_title> = {
	baar: m.study_baar_title,
	ferrer: m.study_ferrer_title,
	lopez: m.study_lopez_title,
	nelson: m.study_nelson_title,
	horst: m.study_horst_title,
	lattice: m.study_lattice_title,
};

/**
 * A segment's length as the Timer screens write it: `10s` under a minute, `3:00`
 * from one. A hang is 7–10s and a set rest 180s, and three raw digits of "180"
 * read worse than "3:00" from across the room, where "0:07" reads worse than
 * "7s". The full-screen face draws the same rule with its unit set apart.
 */
export function shortTime(seconds: number): string {
	return seconds >= 60 ? clock(seconds) : `${seconds}s`;
}

/** mm:ss for a countdown. */
export function clock(totalSec: number): string {
	const s = Math.max(0, Math.round(totalSec));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * A stopwatch reading, in two parts so the face can set the tenths smaller:
 * `{ whole: '1:04', fraction: '.3' }`, and `1:02:03` once an hour has passed.
 *
 * Tenths are floored, never rounded: a stopwatch that read 21.5 at 21.46 would
 * be showing time that has not run yet. The decimal mark is the locale's — a
 * Brazilian stopwatch reads `0:21,4` — so the locale is an argument, for the
 * reason `protocolShape` takes one.
 */
export function stopwatchClock(ms: number, locale: AppLocale): { whole: string; fraction: string } {
	const tenths = Math.floor(Math.max(0, ms) / 100);
	const s = Math.floor(tenths / 10);
	const h = Math.floor(s / 3600);
	const mm = Math.floor(s / 60) % 60;
	const ss = String(s % 60).padStart(2, '0');
	const whole = h > 0 ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
	return { whole, fraction: `${DECIMAL_MARK[locale]}${tenths % 10}` };
}

const DECIMAL_MARK: Record<AppLocale, string> = { 'en-US': '.', 'pt-BR': ',' };

/**
 * A number with the locale's decimal mark: `72,4` in pt-BR, `72.4` in en-US.
 * `digits` fixes the places; without it the number keeps the ones it has.
 * Every decimal the athlete reads goes through here or `stopwatchClock`, so the
 * mark is decided in one table.
 */
export function decimal(value: number, locale: AppLocale, digits?: number): string {
	const text = digits == null ? String(value) : value.toFixed(digits);
	return text.replace('.', DECIMAL_MARK[locale]);
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

/** How a verdict reads at a glance: its state, in the three state tones. */
export type StateTone = 'ok' | 'warn' | 'stop';

/**
 * The verdict's state, not the library's colour for it (#120, shared since #125).
 *
 * The library paints `green` and `short` vermilion (`var(--flag)`), the colour
 * that means at the limit or stop everywhere else, so Log showed a good day's
 * score in the stop colour (spec #113 story 61), and Today its verdict. Both are
 * a session trained as planned, one of them shorter; `moderate` and `tissue` cap
 * it; `rest` stops it. Today's read and Log's score dot both draw this.
 */
const VERDICT_TONE: Record<VerdictId, StateTone> = {
	green: 'ok',
	short: 'ok',
	moderate: 'warn',
	tissue: 'warn',
	rest: 'stop',
};

export function verdictTone(verdict: VerdictId): StateTone {
	return VERDICT_TONE[verdict];
}
