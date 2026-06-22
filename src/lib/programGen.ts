// Turn an onboarding assessment into a tailored program: which weekdays train
// (vs rest), periodization scaled to experience, and working loads seeded from
// the baseline tests. Built by trimming/recolouring the built-in week rather
// than inventing days from scratch.
import type { Content, MetricId } from './content/types';
import * as m from './paraglide/messages';
import type {
	Assessment,
	Equipment,
	Focus,
	Goal,
	Level,
	Program,
	ProgramDayCfg,
	ProgramPhase,
	ProgramTarget,
} from './state.svelte';

// Weekday preference per goal — earlier weekdays are kept as training first.
// Sunday is always the rest day.
const PRIORITY: Record<Goal, string[]> = {
	boulder: ['Mon', 'Sat', 'Fri', 'Thu', 'Wed', 'Tue'],
	sport: ['Wed', 'Sat', 'Mon', 'Thu', 'Fri', 'Tue'],
	all: ['Mon', 'Wed', 'Sat', 'Fri', 'Thu', 'Tue'],
};

// The signature day for each focus, bumped to the front of the priority list.
const FOCUS_DAY: Record<Focus, string> = {
	fingers: 'Fri',
	power: 'Mon',
	endurance: 'Wed',
	tissue: 'Fri',
};

// Experience scales phase intensity (volume held; deload always halves).
const LEVEL_SCALE: Record<Level, number> = { intermediate: 0.9, advanced: 1, elite: 1.1 };

// Gear an exercise needs; if it's not available, the exercise is dropped.
const REQUIRES: Record<string, Equipment> = {
	maxhang: 'hangboard',
	density: 'hangboard',
	repeaters: 'hangboard',
	slopdens: 'hangboard',
	abra: 'hangboard',
	recruit: 'board',
	limitboulder: 'board',
	perform: 'board',
	sport: 'board',
	pull: 'weights',
	pinch: 'weights',
};

/** Max exercises per day implied by a typical session length. */
function sessionCap(min: number | null): number {
	if (min == null) return Number.POSITIVE_INFINITY;
	if (min <= 45) return 2;
	if (min <= 75) return 3;
	return Number.POSITIVE_INFINITY;
}

// Baseline test (kg) → working load as a fraction of the tested max, per exercise.
const LOAD_FROM_BASELINE: Record<string, { metric: MetricId; factor: number }> = {
	maxhang: { metric: 'maxhang', factor: 0.9 },
	pull: { metric: 'pull', factor: 0.9 },
	pinch: { metric: 'pinch', factor: 0.9 },
};

function levelPhases(level: Level): ProgramPhase[] {
	const s = LEVEL_SCALE[level];
	return [
		{
			name: m.prog_phase_base(),
			weeks: 4,
			intensity: Math.round(95 * s),
			volume: 110,
			deload: false,
		},
		{
			name: m.prog_phase_peak(),
			weeks: 3,
			intensity: Math.round(110 * s),
			volume: 85,
			deload: false,
		},
		{ name: m.prog_deload(), weeks: 1, intensity: 50, volume: 50, deload: true },
	];
}

/** The weekdays this assessment trains (in calendar order), for display/preview. */
export function trainingDays(content: Content, a: Assessment): string[] {
	const trainCount = Math.min(6, Math.max(1, Math.round(a.daysPerWeek)));
	const order = [...PRIORITY[a.goal]];
	const bump = order.indexOf(FOCUS_DAY[a.focus]);
	if (bump > 0) order.unshift(...order.splice(bump, 1));
	const keep = new Set(order.slice(0, trainCount));
	return content.days.filter((d) => keep.has(d.k)).map((d) => d.k);
}

/** Build a program tailored to the assessment + baseline tests. */
export function generateProgram(
	content: Content,
	a: Assessment,
	baselines: Partial<Record<MetricId, number | null>>,
): Program {
	const restKey = content.days.find((d) => d.load === 'OFF')?.k ?? 'Sun';
	const keep = new Set(trainingDays(content, a));
	const have = new Set(a.equipment);
	const cap = sessionCap(a.sessionMinutes);

	const template: Record<string, ProgramDayCfg> = {};
	const targets: Record<string, ProgramTarget> = {};

	for (const d of content.days) {
		if (d.k === restKey) continue;
		if (!keep.has(d.k)) {
			template[d.k] = { dayKey: restKey }; // rest out the days beyond days/week
			continue;
		}
		// Keep only the exercises this gear supports, trimmed to the session length.
		const ex = d.ex.filter((id) => !REQUIRES[id] || have.has(REQUIRES[id])).slice(0, cap);
		if (ex.length === 0) {
			template[d.k] = { dayKey: restKey }; // nothing trainable here → rest it
			continue;
		}
		if (ex.length !== d.ex.length) template[d.k] = { dayKey: d.k, ex };
		// Seed working loads from baselines for the kept exercises.
		for (const exId of ex) {
			const map = LOAD_FROM_BASELINE[exId];
			const v = map ? baselines[map.metric] : null;
			if (map && v != null) targets[`${d.k}:${exId}`] = { loadKg: Math.round(v * map.factor) };
		}
	}

	return { weeks: 8, template, targets, phases: levelPhases(a.level) };
}
