// Which per-set fields the Train logger shows for an exercise. Weight (kg) and
// edge (mm) are always loggable — you can add load or change the edge on any
// exercise even when its target doesn't specify them; grip shows when the
// exercise loads a grip.
import type { Variant } from './content/types';
import * as m from './paraglide/messages';

type ColKey = 'weight' | 'edge' | 'time' | 'reps' | 'rest' | 'rpe' | 'grip';

export interface Col {
	key: ColKey;
	label: () => string;
}

export function colsFor(spec: Variant): Col[] {
	const c: Col[] = [
		{ key: 'weight', label: m.field_weight },
		{ key: 'edge', label: m.field_edge },
		{ key: 'time', label: m.field_time },
		{ key: 'reps', label: m.field_reps },
	];
	if (spec.grip) c.push({ key: 'grip', label: m.field_grip });
	c.push({ key: 'rest', label: m.field_rest });
	c.push({ key: 'rpe', label: m.field_rpe });
	return c;
}
