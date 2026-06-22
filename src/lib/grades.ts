// Climbing grade scales for the grade markers (Boulder = V-scale, Route =
// French). Grades are ordinal: the stored metric value is the index into the
// scale, displayed back as the label — so they trend and log like any marker.
export const BOULDER_SCALE = [
	'V0',
	'V1',
	'V2',
	'V3',
	'V4',
	'V5',
	'V6',
	'V7',
	'V8',
	'V9',
	'V10',
	'V11',
	'V12',
	'V13',
	'V14',
	'V15',
	'V16',
	'V17',
];

export const ROUTE_SCALE = [
	'5a',
	'5b',
	'5c',
	'6a',
	'6a+',
	'6b',
	'6b+',
	'6c',
	'6c+',
	'7a',
	'7a+',
	'7b',
	'7b+',
	'7c',
	'7c+',
	'8a',
	'8a+',
	'8b',
	'8b+',
	'8c',
	'8c+',
	'9a',
	'9a+',
	'9b',
	'9b+',
	'9c',
];

const SCALES: Record<string, string[]> = { boulder: BOULDER_SCALE, route: ROUTE_SCALE };

/** Whether a marker id is an ordinal climbing grade (vs a numeric measurement). */
export function isGradeMetric(id: string): boolean {
	return id in SCALES;
}

/** The scale for a grade marker (empty for non-grade ids). */
export function gradeScale(id: string): string[] {
	return SCALES[id] ?? [];
}

/** Label for a stored ordinal value (e.g. 8 → "V8"); clamps to the scale. */
export function gradeLabel(id: string, v: number): string {
	const scale = SCALES[id];
	if (!scale) return String(v);
	return scale[Math.max(0, Math.min(scale.length - 1, Math.round(v)))] ?? String(v);
}

/** The ordinal index of a grade label (−1 if not in the scale). */
export function gradeIndex(id: string, label: string): number {
	return SCALES[id]?.indexOf(label) ?? -1;
}
