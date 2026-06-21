// ---------------- STATE ----------------
// Reactive, localStorage-backed app state using Svelte 5 runes.
// Replaces the original prototype's hand-rolled load()/save() + manual re-render.
import { browser } from '$app/environment';
import { getLocale } from '$lib/paraglide/runtime';
import type { MetricId } from './content/types';

const KEY = 'sendlab_v1';

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

interface AppState {
	currentWeek: number;
	/** Completed days, keyed "w1-Mon". */
	completed: Record<string, boolean>;
	/** Exercise id → chosen swap index. */
	swaps: Record<string, number>;
	metrics: Record<MetricId, MetricEntry[]>;
	log: LogEntry[];
}

function defaultState(): AppState {
	return {
		currentWeek: 1,
		completed: {},
		swaps: {},
		metrics: { rfd: [], contact: [], cf: [], pinch: [], pull: [], maxhang: [], density: [] },
		log: [],
	};
}

function load(): AppState {
	if (!browser) return defaultState();
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return defaultState();
		const parsed = JSON.parse(raw) as Partial<AppState>;
		const base = defaultState();
		return {
			...base,
			...parsed,
			// Guard against a stored shape that predates a metric being added.
			metrics: { ...base.metrics, ...parsed.metrics },
		};
	} catch {
		return defaultState();
	}
}

/** The single reactive state object. Mutate its fields directly; persistence is automatic. */
export const appState = $state<AppState>(load());

/** Persist on any deep change to `appState`. Call once from the root layout. */
export function startPersistence(): void {
	$effect(() => {
		// Touch the whole tree so the effect tracks deep mutations.
		const snapshot = JSON.stringify(appState);
		try {
			localStorage.setItem(KEY, snapshot);
		} catch {
			// Storage full or unavailable — ignore, same as the original.
		}
	});
}

export function resetAll(): void {
	const fresh = defaultState();
	appState.currentWeek = fresh.currentWeek;
	appState.completed = fresh.completed;
	appState.swaps = fresh.swaps;
	appState.metrics = fresh.metrics;
	appState.log = fresh.log;
}

// ---------------- UTIL ----------------
export function today(): string {
	return new Date().toLocaleDateString(getLocale(), { month: 'short', day: 'numeric' });
}

export function round(n: number): number {
	return Math.round(n * 10) / 10;
}
