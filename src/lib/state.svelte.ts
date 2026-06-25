// ---------------- STATE ----------------
// Reactive app state (Svelte 5 runes), persisted per signed-in user via the
// authenticated /api/state endpoint (SQLite). Replaces the old localStorage doc.
import { browser } from '$app/environment';
import { isPlainObject as isObj } from '$lib/objects';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import type { CustomExercise } from './content/types';
import { sanitizeCustomExercises } from './customExercise';
import type { RehabArea, RehabStage } from './rehab';
import { defaultMm, SIZED_METRICS } from './strength';

export interface MetricEntry {
	/** Localized day label for display (e.g. "Jun 24"). */
	date: string;
	v: number;
	/** Epoch ms when logged — the precise timestamp behind the day label. */
	at?: number;
	/** Edge depth / block width (mm) for size-dependent markers (maxhang, pinch). */
	mm?: number;
	/** Bodyweight (kg) at test time, so the %BW strength index stays accurate. */
	bw?: number;
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
	/** ISO calendar date (YYYY-MM-DD) for ordering / streaks / weekly buckets. */
	at: string;
	day: string;
	exercises: WorkoutLogExercise[];
	note: string;
	/** Session length in minutes — the duration term of sRPE internal load
	 *  (sRPE = session-RPE × minutes; Foster). Optional; estimated from logged
	 *  work + rest when absent. */
	durationMin?: number;
}

/** A logged injury self-check result (deep assessment), newest last. */
interface DeepEntry {
	date: string;
	area: string;
	score: number;
	band: string;
}

/** A climbing-specific objective readiness probe: a quick max finger pull (kg)
 *  logged over time so today's value can be compared against the personal norm. */
export interface ProbeEntry {
	date: string;
	at: number;
	/** Max pull / finger-strength reading, kg. */
	value: number;
}

/** A daily readiness check recorded for the trend over time. */
export interface ReadinessEntry {
	date: string;
	/** Epoch ms when the check was first completed (drives the logged time-of-day). */
	at: number;
	/** The recommended session type (VerdictId). */
	verdict: string;
	/** Overall readiness score 0–100 (higher = fresher). */
	score: number;
	/** The full set of answers given (question id → chosen value), so the history
	 *  can show exactly what was reported. */
	answers?: Record<string, number>;
	/** The surfaced flags at the time (the conclusion's warnings). */
	flags?: { id: string; severity: string; area?: string }[];
	/** Post-session outcome, set after training: 0 bailed · 1 flat · 2 as-expected
	 *  · 3 strong. Feeds the personal calibration of future scores. */
	outcome?: number;
}

export type Goal = 'boulder' | 'sport' | 'all';
export type Focus = 'fingers' | 'power' | 'endurance' | 'tissue';
export type Level = 'intermediate' | 'advanced' | 'elite';
export type Equipment = 'hangboard' | 'board' | 'rings' | 'weights';

/** Baseline assessment captured at onboarding (goals + context). */
export interface Assessment {
	goal: Goal;
	focus: Focus;
	level: Level;
	daysPerWeek: number;
	bodyweight: number | null;
	/** Gear on hand — filters which exercises the generated program can use. */
	equipment: Equipment[];
	/** Hardest grades, free text (e.g. "V8", "7c"); informational + calibration. */
	boulderGrade: string | null;
	routeGrade: string | null;
	/** A current finger/tendon niggle → the program caps finger intensity. */
	niggle: boolean;
	/** Finger-joint pain/swelling from the fist-hook synovitis self-check. */
	synovitis: boolean;
	/** Birth date (ISO YYYY-MM-DD), informational. Replaces the old free-text age. */
	birthDate: string | null;
	/** Typical session length (min) → caps exercises per day. */
	sessionMinutes: number | null;
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
	/** Marker series keyed by metric id — built-in MetricIds plus custom exercise ids. */
	metrics: Record<string, MetricEntry[]>;
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
	/** Active injury rehab (null when training normally). */
	rehab: RehabState | null;
	/** User-authored exercises (id → exercise), merged into the library by getContent(). */
	customExercises: Record<string, CustomExercise>;
	/** Injury self-check (deep assessment) results over time. */
	deepLog: DeepEntry[];
	/** Daily readiness checks over time (for the readiness trend). */
	readinessLog: ReadinessEntry[];
	/** Objective readiness-probe readings over time (for the personal baseline). */
	probeLog: ProbeEntry[];
}

/** A per-weekday slot in the program template. */
export interface ProgramDayCfg {
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

export interface Program {
	weeks: number;
	template: Record<string, ProgramDayCfg>;
	/** Prescription overrides keyed `${weekday}:${exId}`. */
	targets: Record<string, ProgramTarget>;
	/** Ordered phases; their weeks need not sum to `weeks` (the tail repeats). */
	phases: ProgramPhase[];
	/** Auto-progress working loads each week at study-backed, level-scaled rates. */
	autoProgress: boolean;
}

interface SavedProgram {
	name: string;
	program: Program;
}

/** Active injury rehab. Stashes the program that was active before rehab so it
 *  can be restored when rehab ends. */
interface RehabState {
	area: RehabArea;
	stage: RehabStage;
	startedAt: string;
	previous: Program;
}

/** The default periodization: an 8-week block of base → peaking → deload,
 *  mirroring the built-in program's phases. */
function defaultPhases(): ProgramPhase[] {
	return [
		{ name: m.prog_phase_base(), weeks: 4, intensity: 95, volume: 110, deload: false },
		{ name: m.prog_phase_peak(), weeks: 3, intensity: 110, volume: 85, deload: false },
		{ name: m.prog_deload(), weeks: 1, intensity: 50, volume: 50, deload: true },
	];
}

/** The starting program: built-in week template with the default 3 phases. */
export function defaultProgram(): Program {
	return { weeks: 8, template: {}, targets: {}, phases: defaultPhases(), autoProgress: true };
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
		metrics: {
			rfd: [],
			contact: [],
			cf: [],
			pinch: [],
			pull: [],
			maxhang: [],
			density: [],
			boulder: [],
			route: [],
			bodyweight: [],
		},
		log: [],
		workouts: [],
		assessment: null,
		prefs: { weight: 'kg', length: 'mm', notify: false },
		program: defaultProgram(),
		savedPrograms: [],
		rehab: null,
		customExercises: {},
		deepLog: [],
		readinessLog: [],
		probeLog: [],
	};
}

/** Coerce a possibly-old, partial, or untrusted program into the current shape
 *  (back-fills targets / phases that older or imported programs won't have). */
export function normalizeProgram(raw: unknown): Program {
	const base = defaultState().program;
	const p = (typeof raw === 'object' && raw ? raw : {}) as Partial<Program>;
	return {
		weeks: typeof p.weeks === 'number' ? p.weeks : base.weeks,
		template: isObj(p.template) ? p.template : base.template,
		targets: isObj(p.targets) ? p.targets : base.targets,
		phases: Array.isArray(p.phases) ? p.phases : base.phases,
		autoProgress: typeof p.autoProgress === 'boolean' ? p.autoProgress : base.autoProgress,
	};
}

/** The single reactive state object. Mutate its fields directly; persistence is automatic. */
export const appState = $state<AppState>(defaultState());

/** Persistence is gated until state has loaded, so we never clobber data with
 *  defaults before hydration. */
let hydrated = false;
/** Whether changes sync to the server (true for a signed-in user, false in guest
 *  mode, where state is local-only). */
let serverSync = false;

/** Reactive signal for "state has loaded" (drives onboarding). */
export const appReady = $state({ hydrated: false });

/** Reactive app mode. `guest` = using the app locally with no account. */
export const appMode = $state({ guest: false });

const GUEST_KEY = 'sendlab:guest';
const GUEST_CACHE = 'sendlab:state:guest';

if (browser && localStorage.getItem(GUEST_KEY) === '1') appMode.guest = true;

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
	appState.rehab = data.rehab ?? base.rehab;
	appState.customExercises = sanitizeCustomExercises(data.customExercises);
	appState.deepLog = data.deepLog ?? base.deepLog;
	appState.readinessLog = data.readinessLog ?? base.readinessLog;
	appState.probeLog = data.probeLog ?? base.probeLog;
}

// Offline mirror: the per-user state is cached in localStorage so the app works
// without a connection (the server stays canonical and syncs when back online).
const LAST_USER = 'sendlab:lastUser';
let cacheKey: string | null = null;

/** The last signed-in user id (for offline cold-start). */
export function lastUserId(): string | null {
	return browser ? localStorage.getItem(LAST_USER) : null;
}

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
	if (raw.rehab === null || isObj(raw.rehab)) out.rehab = raw.rehab as RehabState | null;
	out.customExercises = sanitizeCustomExercises(raw.customExercises);
	if (Array.isArray(raw.deepLog)) out.deepLog = raw.deepLog as DeepEntry[];
	if (Array.isArray(raw.readinessLog)) out.readinessLog = raw.readinessLog as ReadinessEntry[];
	if (Array.isArray(raw.probeLog)) out.probeLog = raw.probeLog as ProbeEntry[];
	return out;
}

/** Apply imported/restored data (validated) and let persistence sync it. */
export function importState(data: unknown): void {
	applyData(sanitize(data));
}

/** Load a signed-in user's state: cached copy instantly, then refresh from the server. */
export async function hydrate(uid?: string): Promise<void> {
	if (!browser) return;
	serverSync = true;
	appMode.guest = false;
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

/** Start (or resume) guest mode: state lives only in localStorage, no account. */
export function hydrateGuest(): void {
	if (!browser) return;
	localStorage.setItem(GUEST_KEY, '1');
	appMode.guest = true;
	serverSync = false;
	cacheKey = GUEST_CACHE;
	try {
		const cached = localStorage.getItem(GUEST_CACHE);
		applyData(cached ? (JSON.parse(cached) as Partial<AppState>) : {});
	} catch {
		applyData({});
	}
	hydrated = true;
	appReady.hydrated = true;
}

/** Flag the app for guest mode (the layout then hydrates it). */
export function enterGuest(): void {
	if (browser) localStorage.setItem(GUEST_KEY, '1');
	appMode.guest = true;
}

/** Leave guest mode on sign-in/up, discarding the local-only guest cache. */
export function leaveGuest(): void {
	if (browser) {
		localStorage.removeItem(GUEST_KEY);
		localStorage.removeItem(GUEST_CACHE);
	}
	appMode.guest = false;
}

/** Push the current in-memory state to the server (used to seed a new account
 *  with guest data when a guest signs up). */
export async function uploadCurrentToServer(): Promise<void> {
	if (!browser) return;
	await fetch('/api/state', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(appState),
	});
}

/** Save the baseline assessment and seed any baseline metrics (first-time only). */
export function saveAssessment(
	assessment: Assessment,
	baselines: Record<string, number | null>,
): void {
	appState.assessment = assessment;
	const seed = (key: string, v: number | null | undefined, extra: Partial<MetricEntry> = {}) => {
		if (v == null || Number.isNaN(v)) return;
		if (!appState.metrics[key]) appState.metrics[key] = [];
		const series = appState.metrics[key];
		if (series.length === 0) series.push({ date: today(), at: Date.now(), v, ...extra });
	};
	seed('bodyweight', assessment.bodyweight);
	for (const key of Object.keys(baselines)) {
		const extra: Partial<MetricEntry> = SIZED_METRICS.has(key)
			? {
					mm: defaultMm(key),
					...(key === 'maxhang' ? { bw: assessment.bodyweight ?? undefined } : {}),
				}
			: {};
		seed(key, baselines[key], extra);
	}
}

/** Reset in-memory state to defaults and pause persistence (used on sign-out). */
export function clearLocal(): void {
	hydrated = false;
	serverSync = false;
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
		if (cacheKey) localStorage.setItem(cacheKey, snapshot); // local mirror (instant)
		if (!serverSync) return; // guest mode: local-only, never hits the server
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
