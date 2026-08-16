// Server-side guards for the whole per-user app_state document. The MCP endpoint
// lets a user's own AI read and rewrite any part of their account, so every write
// is run through sanitizeState() — mirroring the client's sanitize()/normalizeProgram()
// — to guarantee the persisted blob always has the right shape and can't crash the app.
import { isPlainObject } from '$lib/objects';
import { defaultProgram } from '$lib/server/programOps';

// Markers — the athlete's tested performance numbers — are dropped by the
// rebuild's keep/drop audit (#12), so the ten series that used to live under
// `metrics` are gone. **Bodyweight is the exception**: it is not a test, nothing
// is expended taking it, and it is read as the divisor other numbers are
// expressed against. It survives as its own series (see CONTEXT.md).

/** A complete, valid skeleton — every field the client expects to exist. */
function defaultState(): Record<string, unknown> {
	return {
		currentWeek: 1,
		swaps: {},
		dayPlan: {},
		daySwaps: {},
		dayExercises: {},
		taskDone: {},
		bodyweight: [],
		log: [],
		workouts: [],
		assessment: null,
		// `locale` is account data, not a cookie (ADR 0006): /mcp authenticates by
		// bearer token and never reads cookies, so localized MCP output cannot come
		// from anything the browser sets. It is also what carries the athlete's
		// choice to a second device. Null = follow the device.
		prefs: { weight: 'kg', length: 'mm', notify: false, locale: null },
		program: defaultProgram(),
		savedPrograms: [],
		rehab: null,
		deepLog: [],
		readinessLog: [],
	};
}

function normalizeProgram(raw: unknown): Record<string, unknown> {
	const base = defaultProgram();
	const p = isPlainObject(raw) ? raw : {};
	return {
		weeks: typeof p.weeks === 'number' ? p.weeks : base.weeks,
		template: isPlainObject(p.template) ? p.template : base.template,
		targets: isPlainObject(p.targets) ? p.targets : base.targets,
		phases: Array.isArray(p.phases) ? p.phases : base.phases,
		autoProgress: typeof p.autoProgress === 'boolean' ? p.autoProgress : base.autoProgress,
	};
}

/** Coerce arbitrary input into a complete, well-typed state document. Anything
 *  missing or of the wrong type falls back to its default — never throws. */
export function sanitizeState(raw: unknown): Record<string, unknown> {
	const base = defaultState();
	if (!isPlainObject(raw)) return base;
	const out = { ...base };
	if (typeof raw.currentWeek === 'number') out.currentWeek = raw.currentWeek;
	for (const k of ['swaps', 'dayPlan', 'daySwaps', 'dayExercises', 'taskDone']) {
		if (isPlainObject(raw[k])) out[k] = raw[k];
	}
	if (Array.isArray(raw.bodyweight)) out.bodyweight = raw.bodyweight;
	if (Array.isArray(raw.log)) out.log = raw.log;
	if (Array.isArray(raw.workouts)) out.workouts = raw.workouts;
	if (raw.assessment === null || isPlainObject(raw.assessment)) out.assessment = raw.assessment;
	out.prefs = { ...(base.prefs as object), ...(isPlainObject(raw.prefs) ? raw.prefs : {}) };
	out.program = normalizeProgram(raw.program);
	if (Array.isArray(raw.savedPrograms)) out.savedPrograms = raw.savedPrograms;
	if (raw.rehab === null || isPlainObject(raw.rehab)) out.rehab = raw.rehab;
	if (Array.isArray(raw.deepLog)) out.deepLog = raw.deepLog;
	if (Array.isArray(raw.readinessLog)) out.readinessLog = raw.readinessLog;
	return out;
}
