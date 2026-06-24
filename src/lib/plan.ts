// Resolution helpers for the per-week training plan: which protocol a calendar
// slot runs, and which swap applies to each exercise on that specific day.
// Read inside a reactive context (e.g. $derived) so they track appState.
import * as m from '$lib/paraglide/messages';
import type {
	Content,
	Cost,
	Day,
	Grip,
	MetricId,
	Quality,
	Range,
	Region,
	Variant,
	VariantParams,
} from './content/types';
import { progressionFactor, SYNERGY, weeklyRate } from './progression';
import { generateRehabProgram, type RehabArea, type RehabStage, rehabExercises } from './rehab';
import {
	appState,
	defaultProgram,
	type Level,
	normalizeProgram,
	type ProgramPhase,
	type ProgramTarget,
	today,
} from './state.svelte';

export function slotKey(week: number, weekday: string): string {
	return `w${week}-${weekday}`;
}

export function taskKey(week: number, weekday: string, exId: string): string {
	return `w${week}-${weekday}:${exId}`;
}

/** Template weekday key for a slot: per-week override → program template → built-in. */
function resolveDayKey(week: number, weekday: string): string {
	return (
		appState.dayPlan[slotKey(week, weekday)] ??
		appState.program.template[weekday]?.dayKey ??
		weekday
	);
}

/** Look up a built-in Day template by its weekday key. */
export function dayTemplate(content: Content, dayKey: string): Day {
	return content.days.find((d) => d.k === dayKey) ?? content.days[0];
}

/** The Day template a slot will actually run, after overrides (incl. the
 *  program's custom focus name, which replaces the built-in category label). */
export function resolveDay(content: Content, week: number, weekday: string): Day {
	const base = dayTemplate(content, resolveDayKey(week, weekday));
	const name = appState.program.template[weekday]?.name;
	return name ? { ...base, type: name } : base;
}

/** The exercise ids for a slot: per-week override → program template → day default. */
export function resolveExerciseIds(content: Content, week: number, weekday: string): string[] {
	return (
		appState.dayExercises[slotKey(week, weekday)] ??
		appState.program.template[weekday]?.ex ??
		resolveDay(content, week, weekday).ex
	);
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

/** Variant index for an exercise on a given day:
 *  per-day swap → program default variant → global swap → 0. */
export function resolveSwapIndex(week: number, weekday: string, exId: string): number {
	const perDay = appState.daySwaps[taskKey(week, weekday, exId)];
	if (perDay != null) return perDay;
	const prog = appState.program.targets[`${weekday}:${exId}`]?.variant;
	if (prog != null) return prog;
	return appState.swaps[exId] ?? 0;
}

/** The exercise variant at a swap index, falling back to the default (index 0). */
export function variantOf<T extends { variants: Variant[] }>(ex: T, idx: number): Variant {
	return ex.variants[idx] ?? ex.variants[0];
}

/** Display label for an exercise at a swap index (index 0 = its default name). */
export function exerciseLabel(ex: { variants: Variant[] }, idx: number): string {
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
function formatSeconds(s: number): string {
	if (s < 60) return `${s}s`;
	const min = s / 60;
	if (Number.isInteger(min)) return `${min} min`;
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Format a count range ("3" or "2–3"). */
export function formatRange(r: Range): string {
	return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}

/** Format a seconds range ("10s", "20–40s", "3 min–5 min"). */
export function formatSecondsRange(r: Range): string {
	if (r.min === r.max) return formatSeconds(r.min);
	if (r.max < 60) return `${r.min}–${r.max}s`;
	return `${formatSeconds(r.min)}–${formatSeconds(r.max)}`;
}

/** All grips, in display order (for grip pickers). */
export const GRIPS: Grip[] = [
	'half-crimp',
	'open-hand',
	'full-crimp',
	'pinch',
	'sloper',
	'wrist',
	'jug',
];

const GRIP_LABEL: Record<Grip, () => string> = {
	'half-crimp': m.grip_half_crimp,
	'open-hand': m.grip_open_hand,
	'full-crimp': m.grip_full_crimp,
	pinch: m.grip_pinch,
	sloper: m.grip_sloper,
	wrist: m.grip_wrist,
	jug: m.grip_jug,
};

/** Localized label for a grip id (falls back to the raw id). */
export function gripLabel(grip: string): string {
	return GRIP_LABEL[grip as Grip]?.() ?? grip;
}

const COST_LABEL: Record<Cost, () => string> = {
	low: m.cost_low,
	mod: m.cost_mod,
	high: m.cost_high,
};

/** Localized label for a cost level. */
export function costLabel(c: Cost): string {
	return COST_LABEL[c]();
}

const REGION_LABEL: Record<Region, () => string> = {
	fingers: m.region_fingers,
	wrist: m.region_wrist,
	pull: m.region_pull,
	antagonist: m.region_antagonist,
};

/** Localized label for a body region (falls back to the raw id). */
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

/** Localized label for a training quality (falls back to the raw id). */
export function qualityLabel(q: string): string {
	return QUALITY_LABEL[q as Quality]?.() ?? q;
}

const mid = (r: Range): number => Math.round((r.min + r.max) / 2);

/** Timer intervals seeded from an exercise, ready to drive the interval timer.
 *  `rounds`/`rest` are the within-set cycle; `sets`/`setRest` the outer loop. */
export interface TimerSeed {
	key: string;
	name: string;
	prepare: number;
	work: number;
	rest: number;
	rounds: number;
	sets: number;
	setRest: number;
}

/** Interval-timer settings for an exercise, or null when it isn't a timed protocol. */
export function timerSeedFor(spec: VariantParams, key: string, name: string): TimerSeed | null {
	if (!spec.workSec) return null;
	return {
		key,
		name,
		// Default to a 5s get-ready countdown when the exercise doesn't specify one
		// (an explicit prepareSec — including 0 — is respected).
		prepare: spec.prepareSec ?? 5,
		work: mid(spec.workSec),
		rest: spec.restSec ? mid(spec.restSec) : 0,
		rounds: spec.rounds ? mid(spec.rounds) : 1,
		sets: spec.sets ? spec.sets.min : 1,
		setRest: spec.setRestSec ? mid(spec.setRestSec) : 0,
	};
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

// ---------------- PROGRAM TEMPLATE (applies to every week) ----------------

/** The day-type key set for a weekday in the program template (else the weekday). */
export function programDayKey(weekday: string): string {
	return appState.program.template[weekday]?.dayKey ?? weekday;
}

/** The default exercise ids for a weekday in the program template. */
export function programExercises(content: Content, weekday: string): string[] {
	return appState.program.template[weekday]?.ex ?? dayTemplate(content, programDayKey(weekday)).ex;
}

/** Whether a weekday has been customized (day-type, exercises, or prescriptions). */
export function isProgramDayCustom(weekday: string): boolean {
	if (appState.program.template[weekday] != null) return true;
	return Object.keys(appState.program.targets).some((k) => k.startsWith(`${weekday}:`));
}

/** Set the day-type for a weekday across the whole program. */
export function setProgramDay(weekday: string, dayKey: string): void {
	appState.program.template[weekday] = { ...appState.program.template[weekday], dayKey };
}

export function addProgramExercise(content: Content, weekday: string, exId: string): void {
	const ex = programExercises(content, weekday);
	if (ex.includes(exId)) return;
	appState.program.template[weekday] = {
		...appState.program.template[weekday],
		dayKey: programDayKey(weekday),
		ex: [...ex, exId],
	};
}

export function removeProgramExercise(content: Content, weekday: string, exId: string): void {
	const ex = programExercises(content, weekday).filter((id) => id !== exId);
	appState.program.template[weekday] = {
		...appState.program.template[weekday],
		dayKey: programDayKey(weekday),
		ex,
	};
	delete appState.program.targets[`${weekday}:${exId}`];
}

/** Revert a weekday to the built-in default (day-type, exercises, prescriptions). */
export function resetProgramDay(weekday: string): void {
	delete appState.program.template[weekday];
	for (const k of Object.keys(appState.program.targets)) {
		if (k.startsWith(`${weekday}:`)) delete appState.program.targets[k];
	}
}

/** The single source of truth for block length: the sum of the phase weeks when
 *  the program is periodized, otherwise the manually-set length. */
export function programWeeks(): number {
	const phases = appState.program.phases;
	if (phases.length) return phases.reduce((n, p) => n + Math.max(1, p.weeks), 0);
	return appState.program.weeks;
}

/** Set the manual block length, clamped. Only used when there are no phases
 *  (with phases the length is inferred from them — see programWeeks). */
export function setProgramWeeks(n: number): void {
	if (Number.isFinite(n)) appState.program.weeks = Math.min(24, Math.max(1, Math.round(n)));
}

/** Reset the whole program to the built-in 8-week default (3 phases). */
export function resetProgram(): void {
	appState.program = defaultProgram();
}

// ---------------- PERIODIZATION ----------------

/** The phase covering a 1-based week, or null when no phases are defined. Weeks
 *  past the defined span hold the last phase. */
export function phaseForWeek(week: number): ProgramPhase | null {
	const phases = appState.program.phases;
	if (!phases.length) return null;
	let acc = 0;
	for (const p of phases) {
		acc += Math.max(1, p.weeks);
		if (week <= acc) return p;
	}
	return phases[phases.length - 1];
}

function scaleRange(r: Range, pct: number, floor = 0): Range {
	const f = pct / 100;
	return {
		min: Math.max(floor, Math.round(r.min * f)),
		max: Math.max(floor, Math.round(r.max * f)),
	};
}

const fixedRange = (v: number): Range => ({ min: v, max: v });

// Added-weight exercises without a fixed load take a sensible starting weight
// from the athlete's most relevant logged marker (a fraction of their tested max).
const PREFILL_FROM_METRIC: Record<string, { metric: MetricId; factor: number }> = {
	maxhang: { metric: 'maxhang', factor: 0.9 },
	recruit: { metric: 'maxhang', factor: 0.6 },
	density: { metric: 'maxhang', factor: 0.6 },
	abra: { metric: 'maxhang', factor: 0.5 },
	slopdens: { metric: 'maxhang', factor: 0.4 },
	pinch: { metric: 'pinch', factor: 0.9 },
	pull: { metric: 'pull', factor: 0.9 },
};

/** A sensible prefilled load (kg) for a set: the prescription's midpoint if it
 *  has one, else derived from the athlete's latest relevant marker, else null. */
export function prefillLoadKg(exId: string, spec: VariantParams): number | null {
	if (spec.loadKg) return Math.round((spec.loadKg.min + spec.loadKg.max) / 2);
	const map = PREFILL_FROM_METRIC[exId];
	if (!map) return null;
	const hist = appState.metrics[map.metric];
	const v = hist?.length ? hist[hist.length - 1].v : null;
	return v == null ? null : Math.round(v * map.factor);
}

/** The program prescription override for a weekday's exercise, if any. */
export function programTarget(weekday: string, exId: string): ProgramTarget | undefined {
	return appState.program.targets[`${weekday}:${exId}`];
}

/** The variant index chosen for an exercise in the program (target → global → 0). */
export function programVariantIndex(weekday: string, exId: string): number {
	return programTarget(weekday, exId)?.variant ?? appState.swaps[exId] ?? 0;
}

/** Merge a prescription override for a weekday's exercise; clears the key when
 *  every field is empty so it reverts to the built-in target. */
export function setProgramTarget(
	weekday: string,
	exId: string,
	patch: Partial<ProgramTarget>,
): void {
	const key = `${weekday}:${exId}`;
	const next: ProgramTarget = { ...appState.program.targets[key], ...patch };
	for (const k of Object.keys(next) as (keyof ProgramTarget)[]) {
		if (next[k] == null) delete next[k];
	}
	if (Object.keys(next).length === 0) delete appState.program.targets[key];
	else appState.program.targets[key] = next;
}

/** Move an exercise up (-1) or down (+1) within a weekday's ordered list. */
export function moveProgramExercise(
	content: Content,
	weekday: string,
	exId: string,
	dir: -1 | 1,
): void {
	const ex = [...programExercises(content, weekday)];
	const i = ex.indexOf(exId);
	const j = i + dir;
	if (i < 0 || j < 0 || j >= ex.length) return;
	[ex[i], ex[j]] = [ex[j], ex[i]];
	appState.program.template[weekday] = {
		...appState.program.template[weekday],
		dayKey: programDayKey(weekday),
		ex,
	};
}

/** Build weeks elapsed through `week` (non-deload weeks), for compounding loads. */
function buildWeeksThrough(week: number): number {
	let n = 0;
	for (let w = 1; w <= week; w++) if (!phaseForWeek(w)?.deload) n += 1;
	return n;
}

/** Whether an exercise is programmed anywhere in the training week (for synergy). */
function programIncludesExercise(content: Content, week: number, exId: string): boolean {
	return content.days.some((d) => resolveExerciseIds(content, week, d.k).includes(exId));
}

/** Load multiplier (percent) for a week: auto-progression when enabled (deload
 *  weeks still cut to the phase's intensity), otherwise the phase's intensity. */
function loadPct(content: Content, week: number, exId: string, phase: ProgramPhase | null): number {
	if (appState.program.autoProgress) {
		if (phase?.deload) return phase.intensity;
		const level: Level = appState.assessment?.level ?? 'advanced';
		const synergy = SYNERGY[exId] ? programIncludesExercise(content, week, SYNERGY[exId]) : false;
		return progressionFactor(weeklyRate(exId, level, synergy), buildWeeksThrough(week)) * 100;
	}
	return phase ? phase.intensity : 100;
}

/** The variant a slot actually runs: built-in spec with the program's target
 *  overrides applied, then load progressed/scaled for the week and volume scaled
 *  by the phase. Use for Train's prescription + timer seed. */
export function effectiveVariant(
	content: Content,
	base: Variant,
	week: number,
	weekday: string,
	exId: string,
): Variant {
	const t = programTarget(weekday, exId);
	const phase = phaseForWeek(week);
	if (!t && !phase && !appState.program.autoProgress) return base;
	const v: Variant = { ...base };
	if (t) {
		if (t.sets != null) v.sets = fixedRange(t.sets);
		if (t.reps != null) v.reps = fixedRange(t.reps);
		if (t.loadKg != null) v.loadKg = fixedRange(t.loadKg);
		if (t.edgeMm != null) v.edgeMm = fixedRange(t.edgeMm);
		if (t.workSec != null) v.workSec = fixedRange(t.workSec);
		if (t.restSec != null) v.restSec = fixedRange(t.restSec);
		if (t.rpe != null) v.rpe = fixedRange(t.rpe);
	}
	if (v.loadKg) v.loadKg = scaleRange(v.loadKg, loadPct(content, week, exId, phase));
	if (phase) {
		if (v.sets) v.sets = scaleRange(v.sets, phase.volume, 1);
		if (v.rounds) v.rounds = scaleRange(v.rounds, phase.volume, 1);
	}
	return v;
}

/** Add a phase to the end of the program's periodization. */
export function addPhase(name: string): void {
	appState.program.phases.push({ name, weeks: 4, intensity: 100, volume: 100, deload: false });
}

export function updatePhase(i: number, patch: Partial<ProgramPhase>): void {
	const p = appState.program.phases[i];
	if (p) appState.program.phases[i] = { ...p, ...patch };
}

export function removePhase(i: number): void {
	appState.program.phases.splice(i, 1);
}

// ---------------- DAY TOOLS ----------------

/** Custom focus name for a weekday (empty when none). */
export function programDayName(weekday: string): string {
	return appState.program.template[weekday]?.name ?? '';
}

/** Set/clear a weekday's custom focus name (shown wherever the day-type is). */
export function setProgramDayName(weekday: string, name: string): void {
	const n = name.trim();
	const e = { ...appState.program.template[weekday], dayKey: programDayKey(weekday) };
	if (n) e.name = n;
	else delete e.name;
	if (!e.name && e.ex === undefined && e.dayKey === weekday)
		delete appState.program.template[weekday];
	else appState.program.template[weekday] = e;
}

/** The weekday key of the built-in rest day (the OFF-load day). */
export function restDayKey(content: Content): string {
	return content.days.find((d) => d.load === 'OFF')?.k ?? 'Sun';
}

/** Copy a weekday's whole config (day-type, exercises, name, prescriptions) onto another. */
export function duplicateProgramDay(content: Content, from: string, to: string): void {
	if (from === to) return;
	const name = programDayName(from);
	appState.program.template[to] = {
		dayKey: programDayKey(from),
		ex: [...programExercises(content, from)],
		...(name ? { name } : {}),
	};
	for (const k of Object.keys(appState.program.targets)) {
		if (k.startsWith(`${from}:`)) {
			appState.program.targets[`${to}:${k.slice(from.length + 1)}`] = {
				...appState.program.targets[k],
			};
		}
	}
}

// ---------------- SAVED PROGRAMS ----------------

const cloneProgram = () => JSON.parse(JSON.stringify(appState.program));

/** Snapshot the active program under a name. */
export function saveCurrentProgram(name: string): void {
	appState.savedPrograms.push({
		name: name.trim() || `${appState.savedPrograms.length + 1}`,
		program: cloneProgram(),
	});
}

/** Make a saved program the active one (replaces the whole program). */
export function loadSavedProgram(i: number): void {
	const s = appState.savedPrograms[i];
	if (s) appState.program = normalizeProgram(JSON.parse(JSON.stringify(s.program)));
}

export function deleteSavedProgram(i: number): void {
	appState.savedPrograms.splice(i, 1);
}

/** Replace the active program from imported (untrusted) data, validated. */
export function setProgram(raw: unknown): void {
	appState.program = normalizeProgram(raw);
}

// ---------------- REHAB ----------------

/** Switch to a rehab protocol, stashing the current program to restore later. */
export function startRehab(content: Content, area: RehabArea, stage: RehabStage): void {
	const previous = cloneProgram();
	appState.program = generateRehabProgram(content, area, stage);
	appState.rehab = { area, stage, startedAt: today(), previous };
}

/** Make just today a low-load rehab session for an area — a per-day exercise
 *  override that leaves the program intact (clear it from the Week day editor). */
export function rehabToday(content: Content, week: number, weekday: string, area: RehabArea): void {
	appState.dayExercises[slotKey(week, weekday)] = rehabExercises(content, area);
}

/** End rehab and restore the program that was active before it. */
export function endRehab(): void {
	if (appState.rehab)
		appState.program = normalizeProgram(cloneProgramValue(appState.rehab.previous));
	appState.rehab = null;
}

const cloneProgramValue = (p: unknown) => JSON.parse(JSON.stringify(p));
