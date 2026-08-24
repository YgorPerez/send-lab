// Build a rehab protocol from an injury report. The whole program is replaced
// with a conservative, tissue-biased plan: aggravating exercises removed, effort
// capped by stage, fewer training days, low-load isometrics + antagonists kept.
// Deliberately cautious — not medical advice; the user tunes it in the editor.
import { type Content, REST_DAY_TYPE } from './content/types';
import { asExerciseId, asWeekdayKey, overrideKey } from './ids';
import * as m from './paraglide/messages';
import type { BodyArea, Override, Program, RehabStage, WeekdayTemplate } from './types';

// Typed against the closed sets rather than as `string[]`, so a member that is
// not a body area or a rehab stage is a compile error here rather than a picker
// offering an option nothing routes (ADR 0013).
export const REHAB_AREAS: BodyArea[] = ['fingers', 'elbow', 'shoulder', 'wrist'];
export const REHAB_STAGES: RehabStage[] = ['acute', 'subacute', 'returning'];

// Rehab-friendly base pool (low-load tissue / prehab work).
const POOL = ['antag', 'density', 'slopdens', 'abra', 'wrist', 'repeaters'];

// Exercises to drop per injured area (load that would aggravate it).
const AVOID: Record<BodyArea, string[]> = {
	fingers: ['recruit', 'limitboulder', 'maxhang', 'perform', 'pinch', 'repeaters'],
	elbow: ['pull', 'recruit', 'limitboulder', 'perform'],
	shoulder: ['pull', 'perform', 'limitboulder', 'recruit'],
	wrist: ['wrist', 'pinch', 'abra'],
};

const STAGE: Record<
	RehabStage,
	{ rpe: number; intensity: number; volume: number; days: number; progress: boolean }
> = {
	acute: { rpe: 4, intensity: 45, volume: 60, days: 2, progress: false },
	subacute: { rpe: 6, intensity: 65, volume: 70, days: 3, progress: false },
	returning: { rpe: 7, intensity: 80, volume: 80, days: 4, progress: true },
};

// Low-CNS weekdays first — rehab leans on easy days with rest between.
const PRIORITY = ['Tue', 'Thu', 'Mon', 'Fri', 'Wed', 'Sat'];

/** The low-load rehab exercise pool for an area (≤3, present in the content). */
export function rehabExercises(content: Content, area: BodyArea): string[] {
	const allowed = POOL.filter((id) => !AVOID[area].includes(id) && content.exercises[id]);
	return (allowed.length ? allowed : ['antag']).slice(0, 3);
}

export function generateRehabProgram(content: Content, area: BodyArea, stage: RehabStage): Program {
	const s = STAGE[stage];
	const dayEx = rehabExercises(content, area);
	const keep = new Set(PRIORITY.slice(0, s.days));

	const template: Record<string, WeekdayTemplate> = {};
	const overrides: Record<string, Override> = {};
	for (const d of content.days) {
		if (d.id === REST_DAY_TYPE) continue;
		if (!keep.has(d.k)) {
			template[d.k] = { dayType: REST_DAY_TYPE };
			continue;
		}
		template[d.k] = {
			dayType: d.id,
			exercises: dayEx.map(asExerciseId),
			name: m.rehab_label(),
		};
		for (const exId of dayEx)
			overrides[overrideKey(asWeekdayKey(d.k), asExerciseId(exId))] = { rpe: s.rpe };
	}

	return {
		weeks: 6,
		template,
		overrides,
		phases: [
			{ name: m.rehab_label(), weeks: 6, intensity: s.intensity, volume: s.volume, deload: false },
		],
		autoProgress: s.progress,
	};
}
