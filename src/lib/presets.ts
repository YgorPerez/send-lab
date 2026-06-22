// Ready-made protocol templates. Each builds a full program (via the same
// generator the assessment uses) from a representative goal/focus/level so it
// can be applied in one click. Names/descriptions are localized by id.
import type { Content } from './content/types';
import { generateProgram } from './programGen';
import type { Assessment, Focus, Goal, Level, Program } from './state.svelte';

interface Preset {
	id: string;
	goal: Goal;
	focus: Focus;
	level: Level;
	days: number;
}

export const PRESETS: Preset[] = [
	{ id: 'boulder-power', goal: 'boulder', focus: 'power', level: 'advanced', days: 4 },
	{ id: 'sport-endurance', goal: 'sport', focus: 'endurance', level: 'advanced', days: 4 },
	{ id: 'finger-base', goal: 'all', focus: 'fingers', level: 'advanced', days: 4 },
	{ id: 'tissue-base', goal: 'all', focus: 'tissue', level: 'intermediate', days: 3 },
	{ id: 'all-round', goal: 'all', focus: 'power', level: 'advanced', days: 5 },
];

function assessmentFor(p: Preset): Assessment {
	return {
		goal: p.goal,
		focus: p.focus,
		level: p.level,
		daysPerWeek: p.days,
		bodyweight: null,
		equipment: ['hangboard', 'board', 'rings', 'weights'],
		boulderGrade: null,
		routeGrade: null,
		niggle: false,
		synovitis: false,
		age: null,
		sessionMinutes: null,
		completedAt: '',
	};
}

/** Build the full program for a preset id (null if unknown). */
export function buildPreset(content: Content, id: string): Program | null {
	const p = PRESETS.find((x) => x.id === id);
	return p ? generateProgram(content, assessmentFor(p), {}) : null;
}
