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
	/** Display-unit preferences (values are stored canonically as kg / mm). */
	prefs: { weight: 'kg' | 'lb'; length: 'mm' | 'in' };
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
		prefs: { weight: 'kg', length: 'mm' },
	};
}

/** The single reactive state object. Mutate its fields directly; persistence is automatic. */
export const appState = $state<AppState>(defaultState());

/** Persistence is gated until the signed-in user's state has loaded, so we never
 *  clobber server data with defaults before hydration. */
let hydrated = false;

/** Reactive signal for "the signed-in user's state has loaded" (drives onboarding). */
export const appReady = $state({ hydrated: false });

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
	appState.prefs = data.prefs ?? base.prefs;
}

/** Load the signed-in user's state from the server. Call once per login. */
export async function hydrate(): Promise<void> {
	if (!browser) return;
	try {
		const res = await fetch('/api/state');
		if (res.ok) applyData((await res.json()) as Partial<AppState>);
	} catch {
		// network/parse failure — start from defaults
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
	applyData({});
}

/** Persist to the server (debounced) on any change after hydration. */
export function startPersistence(): void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		// Touch the whole tree so the effect tracks deep mutations.
		const snapshot = JSON.stringify(appState);
		if (!hydrated || !browser) return;
		clearTimeout(timer);
		timer = setTimeout(() => {
			void fetch('/api/state', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: snapshot,
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
