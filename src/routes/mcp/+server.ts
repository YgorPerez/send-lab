// Personal MCP endpoint: a user's own AI/MCP client connects here with their
// API token (Authorization: Bearer …) and edits *their* program via tools.
// Minimal JSON-RPC 2.0 over HTTP (initialize / tools/list / tools/call).
import { json } from '@sveltejs/kit';
import { exerciseParams } from '$lib/content/exercises';
import { type Answers, computeVerdictId, dailyFlags, scoreDeep } from '$lib/content/logic';
import type { CustomExercise } from '$lib/content/types';
import { isValidExerciseId, sanitizeCustomExercise } from '$lib/customExercise';
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
import { deepMerge, isPlainObject } from '$lib/server/stateOps';
import { defaultMm, SIZED_METRICS } from '$lib/strength';
import type { RequestHandler } from './$types';

const isObj = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** Local YYYY-MM-DD for dating new entries (matches the client's `today()`). */
const today = () => new Date().toISOString().slice(0, 10);

type MetricEntry = { date: string; v: number; mm?: number; bw?: number };

const ASSESS_GOALS = ['boulder', 'sport', 'all'];
const ASSESS_FOCI = ['fingers', 'power', 'endurance', 'tissue'];
const ASSESS_LEVELS = ['intermediate', 'advanced', 'elite'];
const ASSESS_EQUIPMENT = ['hangboard', 'board', 'rings', 'weights'];
const INJURY_AREAS = ['fingers', 'elbow', 'shoulder', 'wrist'];
const READINESS_KEYS = ['recovery', 'fingers', 'elbow', 'shoulder', 'slot', 'skin', 'cns'];

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
newest last); log ([{date,type,label,color,note}]); workouts ([{date,at,day,exercises,note}], newest first); \
assessment (object or null); prefs ({weight:'kg'|'lb',length:'mm'|'in',notify:bool}); program; \
savedPrograms ([{name,program}]); rehab (object or null); customExercises (id → user-authored exercise). \
Use list_exercises for valid exercise ids and weekday keys. To add your own exercises/categories/variants, \
use create_exercise (then reference the id from edit_day/set_target like any built-in). The structured tools \
(set_periodization, edit_day, set_target, set_auto_progress, create/update/delete_exercise) validate their \
input — prefer them; use update_state/replace_state for everything else. Assessments: assess_baseline sets goals/level/equipment \
and seeds starting markers; daily_readiness returns today's session recommendation from quick scores (nothing stored); assess_injury \
logs a body-area pain self-check (0–10 per item) and returns a 0–100 score, band, and recommended rehab stage.`;

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
				age: { type: ['number', 'null'] },
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
			"Today's readiness check — ephemeral (not stored): returns the recommended session type and any targeted warnings from the day's answers. Provide each as a score. recovery: fresh 2 / normal 1 / flat 0 / wrecked -2. fingers: fine 2 / stiff 1 / tender -2 / sharp pain -5. elbow & shoulder: good 1 / niggle -1 / painful -3. slot (time): big 2 / standard 1 / short 0 / none -1. skin: solid 1 / ok 0 / thin -1 / split -2. cns (drive): sharp 1 / normal 0 / flat -1 / drained -2.",
		inputSchema: {
			type: 'object',
			properties: {
				recovery: { type: 'number' },
				fingers: { type: 'number' },
				elbow: { type: 'number' },
				shoulder: { type: 'number' },
				slot: { type: 'number' },
				skin: { type: 'number' },
				cns: { type: 'number' },
				fatigue: {
					type: 'number',
					description: 'Optional objective load adjustment (≤0 = tired).',
				},
			},
		},
		outputSchema: {
			type: 'object',
			required: ['verdict', 'flags'],
			properties: {
				verdict: { type: 'string', enum: ['rest', 'tissue', 'moderate', 'short', 'green'] },
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
		const answers: Answers = {};
		for (const k of READINESS_KEYS) if (typeof args[k] === 'number') answers[k] = args[k] as number;
		const fatigue = typeof args.fatigue === 'number' ? args.fatigue : 0;
		return { verdict: computeVerdictId(answers, fatigue), flags: dailyFlags(answers, fatigue) };
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
			age: num(args.age),
			sessionMinutes: num(args.sessionMinutes),
			completedAt: today(),
		};
		const metrics = (state.metrics ?? {}) as Record<string, MetricEntry[]>;
		// Seed a marker only when it has no history yet — never clobber logged data.
		const seed = (key: string, v: number | null, extra: Partial<MetricEntry> = {}) => {
			if (v == null) return;
			if (!metrics[key]) metrics[key] = [];
			if (metrics[key].length === 0) metrics[key].push({ date: today(), v, ...extra });
		};
		seed('bodyweight', bodyweight);
		const baseline = isObj(args.baseline) ? args.baseline : {};
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
	const id = isObj(body) ? body.id : null;

	if (!userId)
		return json(rpcError(id, -32001, 'Unauthorized — provide a valid Bearer API token'), {
			status: 401,
		});
	if (!isObj(body) || body.jsonrpc !== '2.0') return json(rpcError(id, -32600, 'Invalid Request'));

	// Notifications (no id) get an empty ack.
	if (!('id' in body)) return new Response(null, { status: 202 });

	const method = body.method;
	if (method === 'initialize') {
		// Echo the client's protocol version when we support it, else our latest.
		const requested = isObj(body.params) ? String(body.params.protocolVersion ?? '') : '';
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
		const params = isObj(body.params) ? body.params : {};
		const name = String(params.name);
		const args = isObj(params.arguments) ? params.arguments : {};
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
