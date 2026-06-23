// Coerce user/AI-authored exercises into a valid, render-safe shape. Custom
// exercises drop into Content.exercises by id, so every numeric prescription
// must be a {min,max} Range and every variant must carry the prose the UI reads.
// Pure (types only) — shared by the client state layer and the server endpoints.
import type { CustomExercise, Range, Variant } from './content/types';

const ACCENT_TOKENS = ['--flag', '--gold', '--teal', '--violet', '--ink-faint'];
const RANGE_FIELDS = [
	'sets',
	'reps',
	'rounds',
	'workSec',
	'restSec',
	'setRestSec',
	'loadKg',
	'edgeMm',
	'intensityPct',
	'rpe',
] as const;
const GRIPS = ['half-crimp', 'open-hand', 'full-crimp', 'pinch', 'sloper', 'wrist', 'jug'];
const QUALITIES = [
	'max-strength',
	'rfd',
	'strength-endurance',
	'hypertrophy',
	'tissue',
	'power',
	'aerobic',
	'skill',
];
const REGIONS = ['fingers', 'wrist', 'pull', 'antagonist'];
const COSTS = ['low', 'mod', 'high'];
const METRIC_IDS = [
	'rfd',
	'contact',
	'cf',
	'pinch',
	'pull',
	'maxhang',
	'density',
	'boulder',
	'route',
	'bodyweight',
];

const isObj = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** A storage-safe exercise id (used as an object key and in program refs). */
export const isValidExerciseId = (id: unknown): id is string =>
	typeof id === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(id);

/** Accept a number (→ fixed range) or a {min,max} object; else undefined. */
function toRange(v: unknown): Range | undefined {
	if (typeof v === 'number' && Number.isFinite(v)) return { min: v, max: v };
	if (isObj(v) && typeof v.min === 'number' && typeof v.max === 'number')
		return { min: v.min, max: v.max };
	return undefined;
}

function strEnum<T extends string>(v: unknown, allowed: readonly string[]): T | undefined {
	return typeof v === 'string' && allowed.includes(v) ? (v as T) : undefined;
}

function strEnumArray<T extends string>(v: unknown, allowed: readonly string[]): T[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const out = v.filter((x): x is T => typeof x === 'string' && allowed.includes(x));
	return out.length ? out : undefined;
}

function sanitizeVariant(raw: unknown): Variant {
	const o = isObj(raw) ? raw : {};
	const v: Record<string, unknown> = {
		name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'Variant',
		what: typeof o.what === 'string' ? o.what : '',
		why: Array.isArray(o.why) ? o.why.filter((x): x is string => typeof x === 'string') : [],
	};
	if (typeof o.note === 'string') v.note = o.note;
	if (typeof o.tool === 'string') v.tool = o.tool;
	if (typeof o.speed === 'string') v.speed = o.speed;
	for (const f of RANGE_FIELDS) {
		const r = toRange(o[f]);
		if (r) v[f] = r;
	}
	if (typeof o.prepareSec === 'number') v.prepareSec = o.prepareSec;
	if (typeof o.toFailure === 'boolean') v.toFailure = o.toFailure;
	const grip = strEnum(o.grip, GRIPS);
	if (grip) v.grip = grip;
	const qualities = strEnumArray(o.qualities, QUALITIES);
	if (qualities) v.qualities = qualities;
	const region = strEnumArray(o.region, REGIONS);
	if (region) v.region = region;
	const cnsCost = strEnum(o.cnsCost, COSTS);
	if (cnsCost) v.cnsCost = cnsCost;
	const metricIds = strEnumArray(o.metricIds, METRIC_IDS);
	if (metricIds) v.metricIds = metricIds;
	return v as unknown as Variant;
}

/** Coerce one exercise; null if it isn't an object. */
export function sanitizeCustomExercise(raw: unknown): CustomExercise | null {
	if (!isObj(raw)) return null;
	const variants =
		Array.isArray(raw.variants) && raw.variants.length
			? raw.variants.map(sanitizeVariant)
			: [sanitizeVariant(raw)];
	return {
		name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Custom exercise',
		cat: typeof raw.cat === 'string' && raw.cat.trim() ? raw.cat.trim() : 'Custom',
		catVar:
			typeof raw.catVar === 'string' && ACCENT_TOKENS.includes(raw.catVar)
				? raw.catVar
				: '--ink-faint',
		variants,
	};
}

/** Coerce a map of custom exercises, dropping any that aren't objects. */
export function sanitizeCustomExercises(raw: unknown): Record<string, CustomExercise> {
	if (!isObj(raw)) return {};
	const out: Record<string, CustomExercise> = {};
	for (const [id, ex] of Object.entries(raw)) {
		const s = sanitizeCustomExercise(ex);
		if (s) out[id] = s;
	}
	return out;
}
