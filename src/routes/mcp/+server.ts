// Personal MCP endpoint: a user's own AI/MCP client connects here with their
// API token (Authorization: Bearer …) and edits *their* program via tools.
// Minimal JSON-RPC 2.0 over HTTP (initialize / tools/list / tools/call).
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { exerciseParams } from '$lib/content/exercises';
import { userIdFromBearer } from '$lib/server/apiToken';
import { db } from '$lib/server/db';
import { appStateTable } from '$lib/server/db/schema';
import {
	applyEditDay,
	applySetAutoProgress,
	applySetPhases,
	applySetTarget,
	defaultProgram,
	EXERCISE_IDS,
	WEEKDAYS,
} from '$lib/server/programOps';
import type { RequestHandler } from './$types';

const isObj = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

const TOOLS = [
	{
		name: 'get_program',
		description:
			'Return the current training program (block length, periodization phases, per-weekday template, per-exercise target overrides, auto-progression).',
		inputSchema: { type: 'object', properties: {} },
	},
	{
		name: 'list_exercises',
		description:
			'List the valid weekday keys and exercise ids (with region, qualities, variant count) to use in other tools.',
		inputSchema: { type: 'object', properties: {} },
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
];

async function loadState(userId: string): Promise<Record<string, unknown>> {
	const row = await db.select().from(appStateTable).where(eq(appStateTable.userId, userId)).get();
	return row ? JSON.parse(row.data) : {};
}

async function saveState(userId: string, state: unknown): Promise<void> {
	const data = JSON.stringify(state);
	const now = new Date();
	await db
		.insert(appStateTable)
		.values({ userId, data, updatedAt: now })
		.onConflictDoUpdate({ target: appStateTable.userId, set: { data, updatedAt: now } })
		.run();
}

async function callTool(
	name: string,
	args: Record<string, unknown>,
	userId: string,
): Promise<string> {
	const state = await loadState(userId);
	const program = (state.program as ReturnType<typeof defaultProgram>) ?? defaultProgram();
	state.program = program;

	if (name === 'get_program') return JSON.stringify(program, null, 2);
	if (name === 'list_exercises')
		return JSON.stringify(
			{
				weekdays: WEEKDAYS,
				exercises: EXERCISE_IDS.map((id) => ({
					id,
					region: exerciseParams[id].variants[0].region,
					qualities: exerciseParams[id].variants[0].qualities,
					variants: exerciseParams[id].variants.length,
				})),
			},
			null,
			2,
		);

	if (name === 'set_periodization') applySetPhases(program, args.phases);
	else if (name === 'set_auto_progress') applySetAutoProgress(program, args.enabled);
	else if (name === 'edit_day') applyEditDay(program, args.weekday, args.dayKey, args.exercises);
	else if (name === 'set_target') applySetTarget(program, args.weekday, args.exercise, args);
	else throw new Error(`unknown tool: ${name}`);

	await saveState(userId, state);
	return `OK. Updated program:\n${JSON.stringify(program, null, 2)}`;
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
	if (method === 'initialize')
		return json(
			rpcResult(id, {
				protocolVersion: '2024-11-05',
				capabilities: { tools: {} },
				serverInfo: { name: 'send-lab', version: '1' },
			}),
		);
	if (method === 'tools/list') return json(rpcResult(id, { tools: TOOLS }));
	if (method === 'tools/call') {
		const params = isObj(body.params) ? body.params : {};
		const name = String(params.name);
		const args = isObj(params.arguments) ? params.arguments : {};
		try {
			const text = await callTool(name, args, userId);
			return json(rpcResult(id, { content: [{ type: 'text', text }] }));
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
