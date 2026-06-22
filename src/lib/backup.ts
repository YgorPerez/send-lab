// Export / import of training data. JSON is a full backup (restorable); CSV is
// a flat per-set dump of logged workouts (canonical kg / mm) for spreadsheets.
import { browser } from '$app/environment';
import { appState, importState } from './state.svelte';

function stamp(): string {
	return new Date().toISOString().slice(0, 10);
}

function download(filename: string, type: string, content: string): void {
	if (!browser) return;
	const url = URL.createObjectURL(new Blob([content], { type }));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/** Download a full JSON backup of the user's data. */
export function exportBackup(): void {
	download(`sendlab-backup-${stamp()}.json`, 'application/json', JSON.stringify(appState, null, 2));
}

function csvField(v: string | number | boolean | null): string {
	if (v == null) return '';
	const s = String(v);
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Download logged workouts as a flat CSV (one row per set). */
export function exportWorkoutsCsv(): void {
	const head = [
		'date',
		'day',
		'exercise',
		'set',
		'weight_kg',
		'edge_mm',
		'time_s',
		'reps',
		'rest_s',
		'rpe',
		'grip',
		'done',
	];
	const rows: (string | number | boolean | null)[][] = [head];
	for (const w of appState.workouts)
		for (const ex of w.exercises)
			ex.sets.forEach((s, i) => {
				rows.push([
					w.date,
					w.day,
					ex.name,
					i + 1,
					s.weight,
					s.edge,
					s.time,
					s.reps,
					s.rest,
					s.rpe,
					s.grip,
					s.done,
				]);
			});
	const csv = rows.map((r) => r.map(csvField).join(',')).join('\n');
	download(`sendlab-workouts-${stamp()}.csv`, 'text/csv', csv);
}

/** Restore a JSON backup file (overwrites current data). */
export async function importBackup(file: File): Promise<void> {
	const data = JSON.parse(await file.text());
	importState(data);
}
