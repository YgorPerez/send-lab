// Deriving a metric value from logged sets, when an exercise was opened from the
// Metrics tab as an assessment. Each metric reads one set field; the best
// (max) value across the sets becomes the recorded data point.
import { toast } from 'svelte-sonner';
import type { Content, MetricId } from './content/types';
import * as m from './paraglide/messages';
import { appState, round, today, type WorkoutSet } from './state.svelte';

const FIELD: Partial<Record<MetricId, 'weight' | 'time'>> = {
	contact: 'weight',
	pinch: 'weight',
	pull: 'weight',
	maxhang: 'weight',
	density: 'time',
};

/** Best value for a metric across logged sets, or null if it can't be derived. */
function metricValueFromSets(metricId: string, sets: WorkoutSet[]): number | null {
	const field = FIELD[metricId as MetricId];
	if (!field) return null;
	const vals = sets.map((s) => s[field]).filter((v): v is number => v != null);
	return vals.length ? Math.max(...vals) : null;
}

/** Record a metric data point from an assessed exercise's sets (no-op if unmeasurable). */
export function recordAssessment(metricId: string, sets: WorkoutSet[], content: Content): void {
	const v = metricValueFromSets(metricId, sets);
	if (v == null) return;
	appState.metrics[metricId as MetricId].push({ date: today(), v });
	const metric = content.metrics.find((mm) => mm.id === metricId);
	appState.log.unshift({
		date: today(),
		type: 'test',
		label: `${metric?.name ?? metricId}: ${round(v)} ${metric?.unit ?? ''}`,
		color: `var(${metric?.cat ?? '--ink-faint'})`,
		note: m.metric_test_note(),
	});
	if (metric) toast.success(m.toast_metric_saved({ name: metric.name }));
}
