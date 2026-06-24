// Server-side, framework-free rehab program construction for the MCP endpoint.
// Mirrors src/lib/rehab.ts (the client source of truth) but without the Content
// object or localized labels, which aren't available on the server.
import { exerciseParams } from '$lib/content/exercises';
import type { Program, ProgramDayCfg, ProgramTarget } from '$lib/state.svelte';

export type RehabArea = 'fingers' | 'elbow' | 'shoulder' | 'wrist';
export type RehabStage = 'acute' | 'subacute' | 'returning';
export const REHAB_AREAS = ['fingers', 'elbow', 'shoulder', 'wrist'];
export const REHAB_STAGES = ['acute', 'subacute', 'returning'];

const POOL = ['antag', 'density', 'slopdens', 'abra', 'wrist', 'repeaters'];
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
const PRIORITY = ['Tue', 'Thu', 'Mon', 'Fri', 'Wed', 'Sat'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const REST = 'Sun';

/** The low-load rehab exercise pool for an area (≤3, present in the library). */
export function rehabExercises(area: RehabArea): string[] {
	const allowed = POOL.filter((id) => !AVOID[area].includes(id) && exerciseParams[id]);
	return (allowed.length ? allowed : ['antag']).slice(0, 3);
}

/** A conservative, stage-capped rehab program that replaces the whole block. */
export function generateRehabProgram(area: RehabArea, stage: RehabStage): Program {
	const s = STAGE[stage];
	const dayEx = rehabExercises(area);
	const keep = new Set(PRIORITY.slice(0, s.days));
	const template: Record<string, ProgramDayCfg> = {};
	const targets: Record<string, ProgramTarget> = {};
	for (const k of DAYS) {
		if (k === REST) continue;
		if (!keep.has(k)) {
			template[k] = { dayKey: REST };
			continue;
		}
		template[k] = { dayKey: k, ex: [...dayEx], name: 'Rehab' };
		for (const exId of dayEx) targets[`${k}:${exId}`] = { rpe: s.rpe };
	}
	return {
		weeks: 6,
		template,
		targets,
		phases: [{ name: 'Rehab', weeks: 6, intensity: s.intensity, volume: s.volume, deload: false }],
		autoProgress: s.progress,
	};
}
