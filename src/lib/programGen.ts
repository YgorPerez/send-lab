// Turn a baseline into a tailored program: which weekdays train (vs rest),
// periodization scaled to experience, and an RPE cap on finger work when the
// athlete reports a niggle. Built by trimming/recolouring the built-in week
// rather than inventing days from scratch.
//
// It seeds no working load. It used to, from a table of marker readings, and #87
// deleted that table once nothing fed it: the marker itself is still here
// (`MetricId`, and every exercise's `metricIds`), but the rebuild's intake
// stopped collecting a tested max, so the table had no source left to read.
// What prescribes a starting load instead is #88; `store/baseline.ts`'s
// `programFor` records what its absence costs in the meantime.
import { exerciseParams } from './content/exercises';
import { type Content, REST_DAY_TYPE } from './content/types';
import { asExerciseId, asWeekdayKey, overrideKey } from './ids';
import * as m from './paraglide/messages';
import { dayTemplate } from './prescription';
import type {
	Baseline,
	Equipment,
	Focus,
	Goal,
	Level,
	Override,
	Phase,
	Program,
	WeekdayTemplate,
} from './types';

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

// A current finger niggle caps finger-exercise effort at this RPE.
const NIGGLE_RPE_CAP = 8;

/** Infer experience from the hardest boulder grade (e.g. "V8"), if given. */
function gradeLevel(grade: string | null): Level | null {
	if (!grade) return null;
	const v = /v\s*(\d+)/i.exec(grade);
	if (!v) return null;
	const n = Number(v[1]);
	return n >= 10 ? 'elite' : n >= 7 ? 'advanced' : 'intermediate';
}

/** Calibrated level: the boulder grade wins over the self-selected bucket. */
function calibratedLevel(a: Baseline): Level {
	return gradeLevel(a.boulderGrade) ?? a.level;
}

const isFingerExercise = (exId: string): boolean =>
	exerciseParams[exId]?.variants[0]?.region?.includes('fingers') ?? false;

function levelPhases(level: Level): Phase[] {
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
export function trainingDays(content: Content, a: Baseline): string[] {
	const trainCount = Math.min(6, Math.max(1, Math.round(a.daysPerWeek)));
	const order = [...PRIORITY[a.goal]];
	const bump = order.indexOf(FOCUS_DAY[a.focus]);
	if (bump > 0) order.unshift(...order.splice(bump, 1));
	const keep = new Set(order.slice(0, trainCount));
	return content.builtInWeek.filter((d) => keep.has(d.k)).map((d) => d.k);
}

/** Build a program tailored to the baseline. */
export function generateProgram(content: Content, a: Baseline): Program {
	const restKey = REST_DAY_TYPE;
	const keep = new Set(trainingDays(content, a));
	const have = new Set(a.equipment);
	const cap = sessionCap(a.sessionMinutes);

	const template: Record<string, WeekdayTemplate> = {};
	const overrides: Record<string, Override> = {};

	for (const weekday of content.builtInWeek) {
		// Two records, because they are two things (ADR 0016): `weekday` says *when*
		// and which day type that weekday runs by default; `type` is that day type.
		//
		// They used to be one, and the bug that produced was exactly this loop.
		// Both comparisons below were written against `d.k` — calendar position,
		// which per its own declaration "never identifies the protocol" — so
		// `d.k === restKey` could never be true, and the template was generated with
		// a weekday key where a day-type id belongs. #55 found it when naming the
		// field `dayType` made it a type error; the split is what makes it
		// unspellable rather than merely caught.
		if (weekday.dayType === restKey) continue;
		if (!keep.has(weekday.k)) {
			template[weekday.k] = { dayType: restKey }; // rest out days beyond days/week
			continue;
		}
		const type = dayTemplate(content, weekday.dayType);
		// Keep only the exercises this gear supports, trimmed to the session length.
		const ex = type.ex.filter((id) => !REQUIRES[id] || have.has(REQUIRES[id])).slice(0, cap);
		if (ex.length === 0) {
			template[weekday.k] = { dayType: restKey }; // nothing trainable here → rest it
			continue;
		}
		if (ex.length !== type.ex.length)
			template[weekday.k] = { dayType: weekday.dayType, exercises: ex.map(asExerciseId) };
		// Per-exercise overrides: cap finger effort when there's a niggle. It is the
		// only one generation writes. A working load is deliberately not among them —
		// #88 gives it its own collection keyed exercise *and* variant, which
		// `OverrideKey` (`weekday:exercise`) cannot spell.
		if (a.niggle)
			for (const exId of ex) {
				if (!isFingerExercise(exId)) continue;
				overrides[overrideKey(asWeekdayKey(weekday.k), asExerciseId(exId))] = {
					rpe: NIGGLE_RPE_CAP,
				};
			}
	}

	// Periodization scaled to the calibrated level; a niggle softens intensity.
	let phases = levelPhases(calibratedLevel(a));
	if (a.niggle) phases = phases.map((p) => ({ ...p, intensity: Math.round(p.intensity * 0.9) }));

	return { weeks: 8, template, overrides, phases, autoProgress: true };
}
