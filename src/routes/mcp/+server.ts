// Personal MCP endpoint: a user's own AI/MCP client connects here with their
// API token (Authorization: Bearer …) and edits *their* program via tools.
// Minimal JSON-RPC 2.0 over HTTP (initialize / tools/list / tools/call).
import { json } from '@sveltejs/kit';
import { getContent } from '$lib/content';
import { exerciseParams } from '$lib/content/exercises';
import { type Answers, computeReadiness, scoreDeep } from '$lib/content/logic';
import type { CustomExercise } from '$lib/content/types';
import { isValidExerciseId, sanitizeCustomExercise } from '$lib/customExercise';
import { deepMerge, isPlainObject } from '$lib/objects';
import {
	generateRehabProgram,
	REHAB_AREAS,
	REHAB_STAGES,
	type RehabArea,
	type RehabStage,
	rehabExercises,
} from '$lib/rehab';
import { userIdFromBearer } from '$lib/server/apiToken';
import {
	applyEditDay,
	applySetAutoProgress,
	applySetPhases,
	applySetTarget,
	EXERCISE_IDS,
	WEEKDAYS,
} from '$lib/server/programOps';
import { loadUserState, saveUserState } from '$lib/server/restApi';
import { acwr, probeReadiness, readinessInsights, weekLoad } from '$lib/stats';
import { defaultMm, SIZED_METRICS } from '$lib/strength';
import type { RequestHandler } from './$types';

/** Local YYYY-MM-DD for dating new entries (matches the client's `today()`). */
const today = () => new Date().toISOString().slice(0, 10);

type MetricEntry = { date: string; at?: number; v: number; mm?: number; bw?: number };

const ASSESS_GOALS = ['boulder', 'sport', 'all'];
const ASSESS_FOCI = ['fingers', 'power', 'endurance', 'tissue'];
const ASSESS_LEVELS = ['intermediate', 'advanced', 'elite'];
const ASSESS_EQUIPMENT = ['hangboard', 'board', 'rings', 'weights'];
const INJURY_AREAS = ['fingers', 'elbow', 'shoulder', 'wrist'];
// Weekday key for a JS getDay() index — for defaulting rehab_today to today.
const WEEKDAY_BY_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LATEST_PROTOCOL = '2025-11-25';
// Wire revisions we're compatible with (tools + structured content are unchanged
// across these); on initialize we echo the client's version if it's one of them.
const SUPPORTED_PROTOCOLS = ['2025-11-25', '2025-06-18', '2024-11-05'];

type ToolDef = { name: string; description: string; inputSchema: object; outputSchema?: object };

// Briefing handed to the connecting AI so it understands what it's editing.
const INSTRUCTIONS = `Edit a single climber's Send Lab account. The whole account is one JSON document; \
get_state returns it, update_state deep-merges a partial patch, replace_state overwrites it whole. \
Canonical units everywhere: weights in kg, edge/block sizes in mm, durations in seconds. Grades are \
stored as scale indices, not strings. Top-level fields: currentWeek (number); completed/taskDone (maps \
keyed like "w1-Mon" / "w1-Tue:pinch" → bool); swaps/daySwaps (exercise → variant index); dayPlan \
("w1-Tue" → weekday key); dayExercises ("w1-Tue" → exercise id[]); metrics (MetricId → [{date,v,mm?,bw?}], \
newest last); log ([{date,type,label,color,note}]); workouts ([{date,at,day,exercises,note,durationMin?}], newest first; \
durationMin is the session length used for sRPE load tracking); \
assessment (object or null); prefs ({weight:'kg'|'lb',length:'mm'|'in',notify:bool}); program; \
savedPrograms ([{name,program}]); rehab (object or null); customExercises (id → user-authored exercise); \
probeLog ([{date,at,value}] — objective max finger-pull readings (kg) for the readiness baseline). \
Use list_exercises for valid exercise ids and weekday keys. To add your own exercises/categories/variants, \
use create_exercise (then reference the id from edit_day/set_target like any built-in). The structured tools \
(set_periodization, edit_day, set_target, set_auto_progress, create/update/delete_exercise) validate their \
input — prefer them; use update_state/replace_state for everything else. Assessments: assess_baseline sets goals/level/equipment \
and seeds starting markers; daily_readiness returns today's session recommendation + a 0–100 readiness score from wellness answers, an illness check, objective load (ACWR + monotony) and an optional max-pull probe vs baseline (nothing stored); assess_injury \
logs a body-area pain self-check (0–10 per item) and returns a 0–100 score, band, and recommended rehab stage. \
Rehab: start_rehab replaces the program with a stage-capped rehab block (saving the previous program to rehab.previous); \
rehab_today swaps just one day to low-load rehab work.`;

const TOOLS: ToolDef[] = [
	{
		name: 'get_state',
		description:
			'Return the entire account document (program, metrics, logs, workouts, assessment, preferences, saved programs, rehab, day overrides). This is everything the user has.',
		inputSchema: { type: 'object', properties: {} },
		outputSchema: { type: 'object', description: 'The full account document.' },
	},
	{
		name: 'update_state',
		description:
			'Deep-merge a partial patch into the account. Plain objects merge recursively; arrays and primitives REPLACE. To edit an array (log, workouts, a metric series), read it with get_state, change it, and send the whole new array. Canonical units (kg / mm / seconds).',
		inputSchema: {
			type: 'object',
			required: ['patch'],
			properties: {
				patch: { type: 'object', description: 'Partial account document to merge in.' },
			},
		},
	},
	{
		name: 'replace_state',
		description:
			'Overwrite the ENTIRE account document with the provided object (missing/invalid fields fall back to defaults). Use to delete things or do a wholesale rewrite; otherwise prefer update_state.',
		inputSchema: {
			type: 'object',
			required: ['state'],
			properties: { state: { type: 'object', description: 'The full account document.' } },
		},
	},
	{
		name: 'get_program',
		description:
			'Return the current training program (block length, periodization phases, per-weekday template, per-exercise target overrides, auto-progression).',
		inputSchema: { type: 'object', properties: {} },
		outputSchema: {
			type: 'object',
			description: 'The program: weeks, template, targets, phases, autoProgress.',
		},
	},
	{
		name: 'list_exercises',
		description:
			'List the valid weekday keys and exercise ids (with region, qualities, variant count) to use in other tools.',
		inputSchema: { type: 'object', properties: {} },
		outputSchema: {
			type: 'object',
			required: ['weekdays', 'exercises'],
			properties: {
				weekdays: { type: 'array', items: { type: 'string' } },
				exercises: { type: 'array', items: { type: 'object' } },
			},
		},
	},
	{
		name: 'set_periodization',
		description:
			'Replace the periodization phases. Each phase: name, weeks, intensity (% of baseline load), volume (% of baseline sets/rounds), deload (bool).',
		inputSchema: {
			type: 'object',
			required: ['phases'],
			properties: {
				phases: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							name: { type: 'string' },
							weeks: { type: 'number' },
							intensity: { type: 'number' },
							volume: { type: 'number' },
							deload: { type: 'boolean' },
						},
					},
				},
			},
		},
	},
	{
		name: 'set_auto_progress',
		description: 'Enable or disable study-backed weekly load auto-progression.',
		inputSchema: {
			type: 'object',
			required: ['enabled'],
			properties: { enabled: { type: 'boolean' } },
		},
	},
	{
		name: 'edit_day',
		description:
			"Set a weekday's day-type (dayKey) and/or its ordered exercise list. Omit a field to leave it. Use list_exercises for valid ids; dayKey is also a weekday key (its built-in category).",
		inputSchema: {
			type: 'object',
			required: ['weekday'],
			properties: {
				weekday: { type: 'string', enum: WEEKDAYS },
				dayKey: { type: 'string', enum: WEEKDAYS },
				exercises: { type: 'array', items: { type: 'string' } },
			},
		},
	},
	{
		name: 'set_target',
		description:
			'Override an exercise prescription on a weekday (canonical units: loadKg kg, edgeMm mm, workSec/restSec seconds, rpe 0–10, variant index). Pass null to clear a field.',
		inputSchema: {
			type: 'object',
			required: ['weekday', 'exercise'],
			properties: {
				weekday: { type: 'string', enum: WEEKDAYS },
				exercise: { type: 'string' },
				sets: { type: ['number', 'null'] },
				reps: { type: ['number', 'null'] },
				loadKg: { type: ['number', 'null'] },
				edgeMm: { type: ['number', 'null'] },
				workSec: { type: ['number', 'null'] },
				restSec: { type: ['number', 'null'] },
				rpe: { type: ['number', 'null'] },
				variant: { type: ['number', 'null'] },
			},
		},
	},
	{
		name: 'create_exercise',
		description:
			'Create or replace a custom exercise (a custom id overrides a built-in of the same id). It becomes usable in days/targets and shows in the library, Train, Program, and stats. Variant numeric fields accept a number or {min,max}; canonical units (sets/reps/rounds counts, workSec/restSec/setRestSec seconds, loadKg kg, edgeMm mm, rpe 0–10).',
		inputSchema: {
			type: 'object',
			required: ['id', 'exercise'],
			properties: {
				id: { type: 'string', description: 'Slug id ([A-Za-z0-9_-], ≤40 chars).' },
				exercise: {
					type: 'object',
					description:
						'{ name, cat (category label), catVar (one of --flag/--gold/--teal/--violet/--ink-faint), track? ({field:"weight"|"time"} to also expose it as a baseline metric), variants: [{ name, what, why[], note?, grip?, qualities[]?, region[]?, cnsCost?, sets?, reps?, rounds?, workSec?, restSec?, setRestSec?, loadKg?, edgeMm?, rpe?, metricIds[]? }] }.',
				},
			},
		},
	},
	{
		name: 'update_exercise',
		description: 'Alias of create_exercise — upsert a custom exercise by id.',
		inputSchema: {
			type: 'object',
			required: ['id', 'exercise'],
			properties: {
				id: { type: 'string' },
				exercise: { type: 'object' },
			},
		},
	},
	{
		name: 'delete_exercise',
		description: 'Delete a custom exercise by id (built-in exercises cannot be deleted).',
		inputSchema: {
			type: 'object',
			required: ['id'],
			properties: { id: { type: 'string' } },
		},
	},
	{
		name: 'assess_baseline',
		description:
			"Record (or replace) the climber's baseline assessment — the same data the onboarding flow collects: goals, context, and optional starting strength markers. Canonical units (kg). Each baseline marker seeds the metric history only when that marker has no entries yet (it won't overwrite logged data).",
		inputSchema: {
			type: 'object',
			required: ['goal', 'focus', 'level', 'daysPerWeek'],
			properties: {
				goal: { type: 'string', enum: ASSESS_GOALS },
				focus: { type: 'string', enum: ASSESS_FOCI },
				level: { type: 'string', enum: ASSESS_LEVELS },
				daysPerWeek: { type: 'number', description: 'Training days per week, 1–7.' },
				bodyweight: { type: ['number', 'null'], description: 'Bodyweight in kg.' },
				equipment: {
					type: 'array',
					items: { type: 'string', enum: ASSESS_EQUIPMENT },
					description: 'Gear on hand; filters the generated program.',
				},
				boulderGrade: { type: ['string', 'null'], description: 'Hardest boulder, e.g. "V8".' },
				routeGrade: { type: ['string', 'null'], description: 'Hardest route, e.g. "7c".' },
				niggle: {
					type: 'boolean',
					description: 'Current finger/tendon niggle (caps finger load).',
				},
				synovitis: { type: 'boolean', description: 'Finger-joint pain/swelling.' },
				birthDate: { type: ['string', 'null'], description: 'Birth date, ISO YYYY-MM-DD.' },
				sessionMinutes: {
					type: ['number', 'null'],
					description: 'Typical session length, minutes.',
				},
				baseline: {
					type: 'object',
					description:
						'Optional starting marker values in canonical units (kg), e.g. { "maxhang": 30, "pinch": 25, "pull": 40 }. Valid ids: maxhang, pinch, pull, contact, cf, rfd, density.',
				},
			},
		},
		outputSchema: {
			type: 'object',
			required: ['ok'],
			properties: { ok: { type: 'boolean' }, assessment: { type: 'object' } },
		},
	},
	{
		name: 'daily_readiness',
		description:
			"Today's readiness check — ephemeral (not stored). Returns a 0–100 readiness score, the recommended session tier, the injured area (if any) and targeted warnings, from wellness answers + objective signals (ACWR & training monotony from logged sessions, and an optional max-pull probe vs the user's baseline). Wellness answers are 0–10 (10 = best): sleep, fatigue (recovery), soreness, plus stress & mood when under-recovered. body = the worst-affected area (0 none, 1 fingers, 2 elbow, 3 shoulder, 4 wrist); severity (when body>0) = 0 stiff, 1 tender, 2 painful, 3 sharp. illness = 0 fine / 1 mild above-the-neck / 2 systemic (fever, below the neck — a hard stop). time = 10 full / 7 standard / 3 short / 0 tight. skin = 0–10 (only relevant on a hard day). probe = today's max finger-pull in kg (compared to the personal baseline from probeLog; a meaningful drop signals neuromuscular fatigue).",
		inputSchema: {
			type: 'object',
			properties: {
				sleep: { type: 'number', description: '0–10 (10 = great).' },
				fatigue: { type: 'number', description: '0–10 perceived recovery (10 = fresh).' },
				soreness: { type: 'number', description: '0–10 (10 = none).' },
				body: {
					type: 'number',
					description: '0 none · 1 fingers · 2 elbow · 3 shoulder · 4 wrist.',
				},
				severity: { type: 'number', description: '0 stiff · 1 tender · 2 painful · 3 sharp.' },
				illness: {
					type: 'number',
					description: '0 fine · 1 mild (above the neck) · 2 systemic (fever / below the neck).',
				},
				time: { type: 'number', description: '10 full · 7 standard · 3 short · 0 tight.' },
				stress: { type: 'number', description: '0–10 (10 = calm).' },
				mood: { type: 'number', description: '0–10 drive (10 = keen).' },
				skin: { type: 'number', description: '0–10 (10 = solid).' },
				probe: { type: 'number', description: "Today's max finger-pull, kg (objective probe)." },
			},
		},
		outputSchema: {
			type: 'object',
			required: ['score', 'verdict', 'flags'],
			properties: {
				score: { type: 'number', description: '0–100 readiness.' },
				verdict: { type: 'string', enum: ['rest', 'tissue', 'moderate', 'short', 'green'] },
				area: { type: ['string', 'null'], enum: ['fingers', 'elbow', 'shoulder', 'wrist', null] },
				flags: {
					type: 'array',
					items: {
						type: 'object',
						required: ['id', 'severity'],
						properties: {
							id: { type: 'string' },
							severity: { type: 'string', enum: ['stop', 'warn', 'info'] },
							area: { type: 'string' },
						},
					},
				},
				asked: { type: 'array', items: { type: 'string' } },
			},
		},
	},
	{
		name: 'assess_injury',
		description:
			'Deep injury self-check for one body area (VISA-C / PRTEE / SPADI-style). Provide an answer per item as 0–10, where 0 = most symptomatic and 10 = no symptoms. Returns and logs a 0–100 score, a severity band, and the recommended rehab stage.',
		inputSchema: {
			type: 'object',
			required: ['area', 'answers'],
			properties: {
				area: { type: 'string', enum: INJURY_AREAS },
				answers: {
					type: 'array',
					items: { type: 'number' },
					description: 'One 0–10 score per item (0 worst, 10 none); typically 6 items.',
				},
			},
		},
		outputSchema: {
			type: 'object',
			required: ['score', 'band', 'stage'],
			properties: {
				score: { type: 'number', description: '0–100, where 100 = no symptoms.' },
				band: { type: 'string', enum: ['manageable', 'moderate', 'significant'] },
				stage: { type: 'string', enum: ['acute', 'subacute', 'returning'] },
				area: { type: 'string' },
				logged: { type: 'boolean' },
			},
		},
	},
	{
		name: 'start_rehab',
		description:
			"Switch the whole program to a conservative rehab block for an injured area at a stage (acute/subacute/returning): effort is capped, aggravating exercises dropped, training days reduced. Saves the current program as `rehab.previous` so it can be restored later (to end rehab, set rehab=null and restore that program via update_state). Stage usually comes from assess_injury's recommendation.",
		inputSchema: {
			type: 'object',
			required: ['area', 'stage'],
			properties: {
				area: { type: 'string', enum: REHAB_AREAS },
				stage: { type: 'string', enum: REHAB_STAGES },
			},
		},
	},
	{
		name: 'rehab_today',
		description:
			"Apply a low-load rehab session to a single day (defaults to today) for an area, leaving the rest of the program unchanged — overrides that day's exercise list. Use for a one-off flare-up rather than a full rehab block.",
		inputSchema: {
			type: 'object',
			required: ['area'],
			properties: {
				area: { type: 'string', enum: REHAB_AREAS },
				weekday: { type: 'string', enum: WEEKDAYS },
				week: { type: 'number', description: 'Defaults to the current week.' },
			},
		},
	},
];

// Write tools all return a confirmation plus the updated document — attach that
// output schema in one place so they stay structured and consistent.
const WRITE_OUTPUT = {
	type: 'object',
	required: ['ok'],
	properties: { ok: { type: 'boolean' }, state: { type: 'object' } },
};
const WRITE_TOOL_NAMES = new Set([
	'update_state',
	'replace_state',
	'set_periodization',
	'set_auto_progress',
	'edit_day',
	'set_target',
	'create_exercise',
	'update_exercise',
	'delete_exercise',
	'start_rehab',
	'rehab_today',
]);
for (const t of TOOLS) if (WRITE_TOOL_NAMES.has(t.name)) t.outputSchema = WRITE_OUTPUT;

type Program = Parameters<typeof applySetPhases>[0];

async function callTool(
	name: string,
	args: Record<string, unknown>,
	userId: string,
): Promise<string | object> {
	const state = await loadUserState(userId);
	const program = state.program as Program;

	// ---- reads (return objects → emitted as structuredContent) ----
	if (name === 'get_state') return state;
	if (name === 'get_program') return program;
	const custom = (state.customExercises as Record<string, CustomExercise>) ?? {};
	if (name === 'list_exercises')
		return {
			weekdays: WEEKDAYS,
			exercises: [
				...EXERCISE_IDS.map((id) => ({
					id,
					custom: false,
					region: exerciseParams[id].variants[0].region,
					qualities: exerciseParams[id].variants[0].qualities,
					variants: exerciseParams[id].variants.length,
				})),
				...Object.entries(custom).map(([id, ex]) => ({
					id,
					custom: true,
					name: ex.name,
					cat: ex.cat,
					region: ex.variants[0]?.region,
					qualities: ex.variants[0]?.qualities,
					variants: ex.variants.length,
				})),
			],
		};

	// Today's readiness is ephemeral (like the app): compute and return, no write.
	if (name === 'daily_readiness') {
		const keys = [
			'sleep',
			'fatigue',
			'soreness',
			'body',
			'illness',
			'time',
			'severity',
			'stress',
			'mood',
			'skin',
		];
		const answers: Answers = {};
		for (const k of keys) if (typeof args[k] === 'number') answers[k] = args[k] as number;
		const workouts = (state.workouts ?? []) as Parameters<typeof acwr>[0];
		const log = (state.readinessLog ?? []) as Parameters<typeof readinessInsights>[0];
		const probeLog = (state.probeLog ?? []) as Parameters<typeof probeReadiness>[0];
		const probe = typeof args.probe === 'number' ? (args.probe as number) : null;
		const now = Date.now();
		return computeReadiness(
			answers,
			{
				acwr: acwr(workouts, now)?.status ?? null,
				monotony: weekLoad(workouts, now)?.status === 'monotonous' ? 'high' : null,
				probe: probeReadiness(probeLog, probe).status,
			},
			readinessInsights(log),
		);
	}

	// ---- writes ----
	if (name === 'replace_state') {
		const next = await saveUserState(userId, args.state);
		return { ok: true, state: next };
	}

	if (name === 'assess_baseline') {
		if (!ASSESS_GOALS.includes(String(args.goal)))
			throw new Error(`goal must be one of ${ASSESS_GOALS.join(', ')}`);
		if (!ASSESS_FOCI.includes(String(args.focus)))
			throw new Error(`focus must be one of ${ASSESS_FOCI.join(', ')}`);
		if (!ASSESS_LEVELS.includes(String(args.level)))
			throw new Error(`level must be one of ${ASSESS_LEVELS.join(', ')}`);
		const num = (v: unknown): number | null =>
			v == null || Number.isNaN(Number(v)) ? null : Number(v);
		const bodyweight = num(args.bodyweight);
		state.assessment = {
			goal: args.goal,
			focus: args.focus,
			level: args.level,
			daysPerWeek: num(args.daysPerWeek) ?? 3,
			bodyweight,
			equipment: Array.isArray(args.equipment)
				? args.equipment.filter((e) => ASSESS_EQUIPMENT.includes(String(e)))
				: [],
			boulderGrade: typeof args.boulderGrade === 'string' ? args.boulderGrade : null,
			routeGrade: typeof args.routeGrade === 'string' ? args.routeGrade : null,
			niggle: Boolean(args.niggle),
			synovitis: Boolean(args.synovitis),
			birthDate: typeof args.birthDate === 'string' ? args.birthDate : null,
			sessionMinutes: num(args.sessionMinutes),
			completedAt: today(),
		};
		const metrics = (state.metrics ?? {}) as Record<string, MetricEntry[]>;
		// Seed a marker only when it has no history yet — never clobber logged data.
		const seed = (key: string, v: number | null, extra: Partial<MetricEntry> = {}) => {
			if (v == null) return;
			if (!metrics[key]) metrics[key] = [];
			if (metrics[key].length === 0)
				metrics[key].push({ date: today(), at: Date.now(), v, ...extra });
		};
		seed('bodyweight', bodyweight);
		const baseline = isPlainObject(args.baseline) ? args.baseline : {};
		for (const [key, raw] of Object.entries(baseline)) {
			const extra: Partial<MetricEntry> = SIZED_METRICS.has(key)
				? { mm: defaultMm(key), ...(key === 'maxhang' ? { bw: bodyweight ?? undefined } : {}) }
				: {};
			seed(key, num(raw), extra);
		}
		state.metrics = metrics;
		const next = await saveUserState(userId, state);
		return { ok: true, assessment: next.assessment };
	}

	if (name === 'assess_injury') {
		const area = String(args.area);
		if (!INJURY_AREAS.includes(area))
			throw new Error(`area must be one of ${INJURY_AREAS.join(', ')}`);
		if (!Array.isArray(args.answers) || args.answers.length === 0)
			throw new Error('`answers` must be a non-empty array of 0–10 numbers');
		const values = args.answers.map((n) => Math.max(0, Math.min(10, Number(n) || 0)));
		const result = scoreDeep(values);
		const deepLog = Array.isArray(state.deepLog) ? state.deepLog : [];
		deepLog.push({ date: today(), area, score: result.score, band: result.band });
		state.deepLog = deepLog;
		await saveUserState(userId, state);
		return { ...result, area, logged: true };
	}

	if (name === 'start_rehab') {
		const area = String(args.area);
		const stage = String(args.stage);
		if (!REHAB_AREAS.includes(area))
			throw new Error(`area must be one of ${REHAB_AREAS.join(', ')}`);
		if (!REHAB_STAGES.includes(stage))
			throw new Error(`stage must be one of ${REHAB_STAGES.join(', ')}`);
		// Stash the current program so the user can return to it after rehab.
		const previous = structuredClone(state.program);
		state.program = generateRehabProgram(getContent(), area as RehabArea, stage as RehabStage);
		state.rehab = { area, stage, startedAt: today(), previous };
		const next = await saveUserState(userId, state);
		return { ok: true, state: next };
	}

	if (name === 'rehab_today') {
		const area = String(args.area);
		if (!REHAB_AREAS.includes(area))
			throw new Error(`area must be one of ${REHAB_AREAS.join(', ')}`);
		const weekday =
			typeof args.weekday === 'string' && WEEKDAYS.includes(args.weekday)
				? args.weekday
				: WEEKDAY_BY_DAY[new Date().getDay()];
		const week =
			typeof args.week === 'number'
				? args.week
				: typeof state.currentWeek === 'number'
					? state.currentWeek
					: 1;
		const dayExercises = (state.dayExercises ?? {}) as Record<string, string[]>;
		dayExercises[`w${week}-${weekday}`] = rehabExercises(getContent(), area as RehabArea);
		state.dayExercises = dayExercises;
		const next = await saveUserState(userId, state);
		return { ok: true, state: next };
	}
	const customIds = Object.keys(custom);
	if (name === 'create_exercise' || name === 'update_exercise') {
		if (!isValidExerciseId(args.id))
			throw new Error('id must match [A-Za-z0-9_-] and be ≤40 chars');
		const ex = sanitizeCustomExercise(args.exercise);
		if (!ex) throw new Error('`exercise` must be an object');
		custom[args.id] = ex;
		state.customExercises = custom;
	} else if (name === 'delete_exercise') {
		if (typeof args.id !== 'string' || !(args.id in custom))
			throw new Error('no such custom exercise (built-in exercises cannot be deleted)');
		delete custom[args.id];
		state.customExercises = custom;
	} else if (name === 'update_state') {
		if (!isPlainObject(args.patch)) throw new Error('`patch` must be an object');
		deepMerge(state, args.patch);
	} else if (name === 'set_periodization') applySetPhases(program, args.phases);
	else if (name === 'set_auto_progress') applySetAutoProgress(program, args.enabled);
	else if (name === 'edit_day')
		applyEditDay(program, args.weekday, args.dayKey, args.exercises, customIds);
	else if (name === 'set_target')
		applySetTarget(program, args.weekday, args.exercise, args, customIds);
	else throw new Error(`unknown tool: ${name}`);

	const next = await saveUserState(userId, state);
	return { ok: true, state: next };
}

const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id: unknown, code: number, message: string) => ({
	jsonrpc: '2.0',
	id,
	error: { code, message },
});

export const POST: RequestHandler = async ({ request }) => {
	const userId = await userIdFromBearer(request);
	const body: unknown = await request.json().catch(() => null);
	const id = isPlainObject(body) ? body.id : null;

	if (!userId)
		return json(rpcError(id, -32001, 'Unauthorized — provide a valid Bearer API token'), {
			status: 401,
		});
	if (!isPlainObject(body) || body.jsonrpc !== '2.0')
		return json(rpcError(id, -32600, 'Invalid Request'));

	// Notifications (no id) get an empty ack.
	if (!('id' in body)) return new Response(null, { status: 202 });

	const method = body.method;
	if (method === 'initialize') {
		// Echo the client's protocol version when we support it, else our latest.
		const requested = isPlainObject(body.params) ? String(body.params.protocolVersion ?? '') : '';
		const protocolVersion = SUPPORTED_PROTOCOLS.includes(requested) ? requested : LATEST_PROTOCOL;
		return json(
			rpcResult(id, {
				protocolVersion,
				capabilities: { tools: {} },
				serverInfo: { name: 'send-lab', version: '1' },
				instructions: INSTRUCTIONS,
			}),
		);
	}
	if (method === 'tools/list') return json(rpcResult(id, { tools: TOOLS }));
	if (method === 'tools/call') {
		const params = isPlainObject(body.params) ? body.params : {};
		const name = String(params.name);
		const args = isPlainObject(params.arguments) ? params.arguments : {};
		try {
			const result = await callTool(name, args, userId);
			// Structured tools return an object → emit it as `structuredContent`, with
			// the JSON also serialized into a text block. Text tools return a string.
			const structured = typeof result === 'object' && result !== null;
			return json(
				rpcResult(id, {
					content: [
						{
							type: 'text',
							text: structured ? JSON.stringify(result, null, 2) : (result as string),
						},
					],
					...(structured ? { structuredContent: result } : {}),
				}),
			);
		} catch (e) {
			return json(
				rpcResult(id, {
					content: [{ type: 'text', text: `Error: ${(e as Error).message}` }],
					isError: true,
				}),
			);
		}
	}
	return json(rpcError(id, -32601, `Method not found: ${String(method)}`));
};
