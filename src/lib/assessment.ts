// Deriving a metric value from logged sets, when an exercise was opened from the
// Metrics tab as an assessment. Each metric reads one set field; the best
// (max) value across the sets becomes the recorded data point.
import { toast } from 'svelte-sonner';
import type { Content, MetricId } from './content/types';
import * as m from './paraglide/messages';
import { appState, type MetricEntry, round, today, type WorkoutSet } from './state.svelte';
import { defaultMm, SIZED_METRICS } from './strength';
import { metricUnit, showMetric } from './units';

const FIELD: Partial<Record<MetricId, 'weight' | 'time'>> = {
	contact: 'weight',
	pinch: 'weight',
	pull: 'weight',
	maxhang: 'weight',
	density: 'time',
};

/** The exercise that produces each marker — opened in Train (with `assess`) to
 *  run the test and auto-record the result. Shared by Metrics and onboarding. */
export const METRIC_EXERCISE: Partial<Record<MetricId, string>> = {
	rfd: 'recruit',
	contact: 'recruit',
	cf: 'repeaters',
	pinch: 'pinch',
	pull: 'pull',
	maxhang: 'maxhang',
	density: 'density',
};

/** A baseline marker shown in Metrics / the assessment: a built-in metric or a
 *  custom exercise flagged to track a logged-set field. */
export interface Marker {
	id: string;
	name: string;
	abbr: string;
	cat: string;
	unit: string;
	desc: string;
	custom?: boolean;
}

/** Markers derived from the user's custom exercises that opted into tracking. */
export function customMarkers(): Marker[] {
	return Object.entries(appState.customExercises)
		.filter(([, ex]) => ex.track)
		.map(([id, ex]) => ({
			id,
			name: ex.name,
			abbr: ex.name.slice(0, 8),
			cat: ex.catVar,
			unit: ex.track?.field === 'time' ? 's' : 'kg',
			desc: ex.variants[0]?.what ?? '',
			custom: true,
		}));
}

/** Which logged-set field a marker reads: built-in map, then custom track config. */
function markerField(metricId: string): 'weight' | 'time' | undefined {
	return FIELD[metricId as MetricId] ?? appState.customExercises[metricId]?.track?.field;
}

/** Best value for a metric across logged sets, or null if it can't be derived. */
function metricValueFromSets(metricId: string, sets: WorkoutSet[]): number | null {
	const field = markerField(metricId);
	if (!field) return null;
	const vals = sets.map((s) => s[field]).filter((v): v is number => v != null);
	return vals.length ? Math.max(...vals) : null;
}

/** Record a metric data point from an assessed exercise's sets (no-op if unmeasurable). */
export function recordAssessment(metricId: string, sets: WorkoutSet[], content: Content): void {
	const v = metricValueFromSets(metricId, sets);
	if (v == null) return;
	const entry: MetricEntry = { date: today(), v };
	if (SIZED_METRICS.has(metricId)) {
		entry.mm = sets.find((s) => s.weight === v)?.edge ?? defaultMm(metricId);
		if (metricId === 'maxhang') {
			const bw = appState.metrics.bodyweight;
			entry.bw = bw.length ? bw[bw.length - 1].v : (appState.assessment?.bodyweight ?? undefined);
		}
	}
	if (!appState.metrics[metricId]) appState.metrics[metricId] = [];
	appState.metrics[metricId].push(entry);
	const metric = content.metrics.find((mm) => mm.id === metricId);
	const custom = appState.customExercises[metricId];
	const name = metric?.name ?? custom?.name ?? metricId;
	const unit = metric
		? metricUnit(metricId, metric.unit)
		: custom?.track?.field === 'time'
			? 's'
			: 'kg';
	appState.log.unshift({
		date: today(),
		type: 'test',
		label: `${name}: ${round(showMetric(metricId, v))} ${unit}`,
		color: `var(${metric?.cat ?? custom?.catVar ?? '--ink-faint'})`,
		note: m.metric_test_note(),
	});
	toast.success(m.toast_metric_saved({ name }));
}
