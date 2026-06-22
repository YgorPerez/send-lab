// Build a rehab protocol from an injury report. The whole program is replaced
// with a conservative, tissue-biased plan: aggravating exercises removed, effort
// capped by stage, fewer training days, low-load isometrics + antagonists kept.
// Deliberately cautious — not medical advice; the user tunes it in the editor.
import type { Content } from './content/types';
import * as m from './paraglide/messages';
import type { Program, ProgramDayCfg, ProgramTarget } from './state.svelte';

export type RehabArea = 'fingers' | 'elbow' | 'shoulder' | 'wrist';
export type RehabStage = 'acute' | 'subacute' | 'returning';

// Rehab-friendly base pool (low-load tissue / prehab work).
const POOL = ['antag', 'density', 'slopdens', 'abra', 'wrist', 'repeaters'];

// Exercises to drop per injured area (load that would aggravate it).
const AVOID: Record<RehabArea, string[]> = {
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

export function generateRehabProgram(
	content: Content,
	area: RehabArea,
	stage: RehabStage,
): Program {
	const s = STAGE[stage];
	const allowed = POOL.filter((id) => !AVOID[area].includes(id) && content.exercises[id]);
	const dayEx = (allowed.length ? allowed : ['antag']).slice(0, 3);
	const restKey = content.days.find((d) => d.load === 'OFF')?.k ?? 'Sun';
	const keep = new Set(PRIORITY.slice(0, s.days));

	const template: Record<string, ProgramDayCfg> = {};
	const targets: Record<string, ProgramTarget> = {};
	for (const d of content.days) {
		if (d.k === restKey) continue;
		if (!keep.has(d.k)) {
			template[d.k] = { dayKey: restKey };
			continue;
		}
		template[d.k] = { dayKey: d.k, ex: [...dayEx], name: m.rehab_label() };
		for (const exId of dayEx) targets[`${d.k}:${exId}`] = { rpe: s.rpe };
	}

	return {
		weeks: 6,
		template,
		targets,
		phases: [
			{ name: m.rehab_label(), weeks: 6, intensity: s.intensity, volume: s.volume, deload: false },
		],
		autoProgress: s.progress,
	};
}
