// ---------------- STATE ----------------
// Reactive app state (Svelte 5 runes), persisted per signed-in user via the
// authenticated /api/state endpoint (SQLite). Replaces the old localStorage doc.
import { browser } from '$app/environment';
import { getLocale } from '$lib/paraglide/runtime';
import type { MetricId } from './content/types';

export interface MetricEntry {
	date: string;
	v: number;
}

interface LogEntry {
	date: string;
	type: 'rec' | 'day' | 'test';
	label: string;
	color: string;
	note: string;
}

/** One logged set within a workout (all fields optional — log what applies). */
export interface WorkoutSet {
	weight: number | null;
	edge: number | null;
	time: number | null;
	reps: number | null;
	rest: number | null;
	/** Rated effort, RPE 0–10. */
	rpe: number | null;
	/** Grip used (a Grip id, or null). */
	grip: string | null;
	/** Whether the set has been completed. */
	done: boolean;
}

interface WorkoutLogExercise {
	exId: string;
	name: string;
	sets: WorkoutSet[];
}

export interface WorkoutEntry {
	/** Localized display date (e.g. "Jun 21"). */
	date: string;
	/** ISO calendar date (YYYY-MM-DD) for ordering/streaks; absent on old entries. */
	at?: string;
	day: string;
	exercises: WorkoutLogExercise[];
	note: string;
}

export type Goal = 'boulder' | 'sport' | 'all';
export type Focus = 'fingers' | 'power' | 'endurance' | 'tissue';
export type Level = 'intermediate' | 'advanced' | 'elite';

/** Baseline assessment captured at onboarding (goals + context). */
interface Assessment {
	goal: Goal;
	focus: Focus;
	level: Level;
	daysPerWeek: number;
	bodyweight: number | null;
	completedAt: string;
}

interface AppState {
	currentWeek: number;
	/** Completed days, keyed "w1-Mon". */
	completed: Record<string, boolean>;
	/** Global exercise id → chosen swap index (library-wide default). */
	swaps: Record<string, number>;
	/** Per-day protocol override: "w1-Tue" → template weekday key (e.g. "Fri"). */
	dayPlan: Record<string, string>;
	/** Per-day exercise swap override: "w1-Tue:pinch" → swap index. */
	daySwaps: Record<string, number>;
	/** Per-day exercise-list override: "w1-Tue" → exercise ids (add/remove freely). */
	dayExercises: Record<string, string[]>;
	/** Per-task completion: "w1-Tue:pinch" → done. */
	taskDone: Record<string, boolean>;
	metrics: Record<MetricId, MetricEntry[]>;
	log: LogEntry[];
	/** Logged workouts (full sets: weight / edge / time / reps / rest), newest first. */
	workouts: WorkoutEntry[];
	/** Baseline assessment, or null until onboarding is completed. */
	assessment: Assessment | null;
	/** Display-unit preferences (values are stored canonically as kg / mm) + notifications. */
	prefs: { weight: 'kg' | 'lb'; length: 'mm' | 'in'; notify: boolean };
	/** The active custom program. Empty template/phases = the built-in 8-week week. */
	program: Program;
	/** Named programs the user has saved, switchable from the editor. */
	savedPrograms: SavedProgram[];
}

/** A per-weekday slot in the program template. */
interface ProgramDayCfg {
	/** Which built-in day-type (category / load / color / default exercises) it uses. */
	dayKey: string;
	/** Ordered exercise ids (primary first); absent = the day-type's defaults. */
	ex?: string[];
	/** Custom focus name shown instead of the day-type label. */
	name?: string;
}

/** Per-exercise prescription override in the program (canonical kg / mm / seconds).
 *  Any field left undefined falls back to the variant's built-in target. */
export interface ProgramTarget {
	/** Chosen variant index for this exercise in the program. */
	variant?: number;
	sets?: number;
	reps?: number;
	loadKg?: number;
	edgeMm?: number;
	workSec?: number;
	restSec?: number;
	rpe?: number;
}

/** A periodization phase spanning a run of weeks. */
export interface ProgramPhase {
	name: string;
	weeks: number;
	/** Load multiplier, percent of baseline (100 = unchanged). */
	intensity: number;
	/** Volume multiplier (sets / rounds), percent of baseline. */
	volume: number;
	deload: boolean;
}

interface Program {
	weeks: number;
	template: Record<string, ProgramDayCfg>;
	/** Prescription overrides keyed `${weekday}:${exId}`. */
	targets: Record<string, ProgramTarget>;
	/** Ordered phases; their weeks need not sum to `weeks` (the tail repeats). */
	phases: ProgramPhase[];
}

interface SavedProgram {
	name: string;
	program: Program;
}

function defaultState(): AppState {
	return {
		currentWeek: 1,
		completed: {},
		swaps: {},
		dayPlan: {},
		daySwaps: {},
		dayExercises: {},
		taskDone: {},
		metrics: { rfd: [], contact: [], cf: [], pinch: [], pull: [], maxhang: [], density: [] },
		log: [],
		workouts: [],
		assessment: null,
		prefs: { weight: 'kg', length: 'mm', notify: false },
		program: { weeks: 8, template: {}, targets: {}, phases: [] },
		savedPrograms: [],
	};
}

/** Coerce a possibly-old or partial program into the current shape (back-fills
 *  targets / phases that older saved states won't have). */
function normalizeProgram(p: Partial<Program> | undefined): Program {
	const base = defaultState().program;
	return {
		weeks: typeof p?.weeks === 'number' ? p.weeks : base.weeks,
		template: p?.template ?? base.template,
		targets: p?.targets ?? base.targets,
		phases: Array.isArray(p?.phases) ? p.phases : base.phases,
	};
}

/** The single reactive state object. Mutate its fields directly; persistence is automatic. */
export const appState = $state<AppState>(defaultState());

/** Persistence is gated until the signed-in user's state has loaded, so we never
 *  clobber server data with defaults before hydration. */
let hydrated = false;

/** Reactive signal for "the signed-in user's state has loaded" (drives onboarding). */
export const appReady = $state({ hydrated: false });

/** Reactive sync indicator. `at` is the epoch ms of the last successful save —
 *  a "last synced" cue so edits on two devices clobbering each other are visible. */
export const syncStatus = $state<{
	status: 'idle' | 'saving' | 'saved' | 'error';
	at: number | null;
}>({ status: 'idle', at: null });

function applyData(data: Partial<AppState>): void {
	const base = defaultState();
	appState.currentWeek = data.currentWeek ?? base.currentWeek;
	appState.completed = data.completed ?? base.completed;
	appState.swaps = data.swaps ?? base.swaps;
	appState.dayPlan = data.dayPlan ?? base.dayPlan;
	appState.daySwaps = data.daySwaps ?? base.daySwaps;
	appState.dayExercises = data.dayExercises ?? base.dayExercises;
	appState.taskDone = data.taskDone ?? base.taskDone;
	appState.metrics = { ...base.metrics, ...data.metrics };
	appState.log = data.log ?? base.log;
	appState.workouts = data.workouts ?? base.workouts;
	appState.assessment = data.assessment ?? base.assessment;
	appState.prefs = { ...base.prefs, ...data.prefs };
	appState.program = normalizeProgram(data.program);
	appState.savedPrograms = data.savedPrograms ?? base.savedPrograms;
}

// Offline mirror: the per-user state is cached in localStorage so the app works
// without a connection (the server stays canonical and syncs when back online).
const LAST_USER = 'sendlab:lastUser';
let cacheKey: string | null = null;

/** The last signed-in user id (for offline cold-start). */
export function lastUserId(): string | null {
	return browser ? localStorage.getItem(LAST_USER) : null;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** Keep only top-level fields that are the right type, so a malformed or old
 *  backup can't corrupt state — anything missing or wrong falls back to default. */
function sanitize(raw: unknown): Partial<AppState> {
	if (!isObj(raw)) throw new Error('Backup is not a valid object');
	const out: Partial<AppState> = {};
	if (typeof raw.currentWeek === 'number') out.currentWeek = raw.currentWeek;
	if (isObj(raw.completed)) out.completed = raw.completed as AppState['completed'];
	if (isObj(raw.swaps)) out.swaps = raw.swaps as AppState['swaps'];
	if (isObj(raw.dayPlan)) out.dayPlan = raw.dayPlan as AppState['dayPlan'];
	if (isObj(raw.daySwaps)) out.daySwaps = raw.daySwaps as AppState['daySwaps'];
	if (isObj(raw.dayExercises)) out.dayExercises = raw.dayExercises as AppState['dayExercises'];
	if (isObj(raw.taskDone)) out.taskDone = raw.taskDone as AppState['taskDone'];
	if (isObj(raw.metrics)) out.metrics = raw.metrics as AppState['metrics'];
	if (Array.isArray(raw.log)) out.log = raw.log as AppState['log'];
	if (Array.isArray(raw.workouts)) out.workouts = raw.workouts as AppState['workouts'];
	if (raw.assessment === null || isObj(raw.assessment))
		out.assessment = raw.assessment as AppState['assessment'];
	if (isObj(raw.prefs)) out.prefs = raw.prefs as AppState['prefs'];
	if (isObj(raw.program)) out.program = normalizeProgram(raw.program as Partial<Program>);
	if (Array.isArray(raw.savedPrograms)) out.savedPrograms = raw.savedPrograms as SavedProgram[];
	return out;
}

/** Apply imported/restored data (validated) and let persistence sync it. */
export function importState(data: unknown): void {
	applyData(sanitize(data));
}

/** Load the user's state: cached copy instantly, then refresh from the server. */
export async function hydrate(uid?: string): Promise<void> {
	if (!browser) return;
	const id = uid ?? lastUserId();
	cacheKey = id ? `sendlab:state:${id}` : null;
	if (id) localStorage.setItem(LAST_USER, id);
	if (cacheKey) {
		try {
			const cached = localStorage.getItem(cacheKey);
			if (cached) applyData(JSON.parse(cached) as Partial<AppState>);
		} catch {
			// ignore corrupt cache
		}
	}
	try {
		const res = await fetch('/api/state');
		if (res.ok) applyData((await res.json()) as Partial<AppState>);
	} catch {
		// offline — keep the cached copy
	} finally {
		hydrated = true;
		appReady.hydrated = true;
	}
}

/** Save the baseline assessment and seed any baseline metrics (first-time only). */
export function saveAssessment(
	assessment: Assessment,
	baselines: Partial<Record<MetricId, number | null>>,
): void {
	appState.assessment = assessment;
	for (const key of Object.keys(baselines) as MetricId[]) {
		const v = baselines[key];
		if (v == null || Number.isNaN(v)) continue;
		if (appState.metrics[key].length === 0) appState.metrics[key].push({ date: today(), v });
	}
}

/** Reset in-memory state to defaults and pause persistence (used on sign-out). */
export function clearLocal(): void {
	hydrated = false;
	appReady.hydrated = false;
	syncStatus.status = 'idle';
	syncStatus.at = null;
	applyData({});
}

/** Persist to the server (debounced) on any change after hydration. */
export function startPersistence(): void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		// Touch the whole tree so the effect tracks deep mutations.
		const snapshot = JSON.stringify(appState);
		if (!hydrated || !browser) return;
		if (cacheKey) localStorage.setItem(cacheKey, snapshot); // offline mirror (instant)
		clearTimeout(timer);
		timer = setTimeout(() => {
			syncStatus.status = 'saving';
			void fetch('/api/state', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: snapshot,
			})
				.then((res) => {
					syncStatus.status = res.ok ? 'saved' : 'error';
					if (res.ok) syncStatus.at = Date.now();
				})
				.catch(() => {
					syncStatus.status = 'error';
				});
		}, 600);
	});
}

export function resetAll(): void {
	applyData({});
}

// ---------------- UTIL ----------------
export function today(): string {
	return new Date().toLocaleDateString(getLocale(), { month: 'short', day: 'numeric' });
}

export function round(n: number): number {
	return Math.round(n * 10) / 10;
}
