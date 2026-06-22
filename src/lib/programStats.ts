// Read-only analytics over the program template (the standard week, before
// per-week phase scaling): weekly volume, CNS load, region/quality balance, and
// safety warnings. Pure functions; the Program editor renders the result.
import { exerciseParams } from './content/exercises';
import type { Content } from './content/types';
import * as m from './paraglide/messages';
import {
	dayTemplate,
	programDayKey,
	programExercises,
	programTarget,
	programVariantIndex,
	regionLabel,
} from './plan';

const CNS_WEIGHT: Record<string, number> = { low: 1, mod: 2, high: 3 };

interface Bar {
	key: string;
	value: number;
}

interface DayLoad {
	k: string;
	label: string;
	type: string;
	load: string;
	color: string;
	sets: number;
	cns: number;
	rest: boolean;
}

export interface ProgramSummary {
	days: DayLoad[];
	regions: Bar[];
	qualities: Bar[];
	totalSets: number;
	totalCns: number;
	warnings: string[];
}

/** Planned set count for a weekday's exercise: override → variant midpoint → 1. */
function setsOf(weekday: string, exId: string): number {
	const t = programTarget(weekday, exId);
	if (t?.sets != null) return t.sets;
	const params = exerciseParams[exId];
	const v = params?.variants[programVariantIndex(weekday, exId)] ?? params?.variants[0];
	return v?.sets ? Math.round((v.sets.min + v.sets.max) / 2) : 1;
}

export function programSummary(content: Content): ProgramSummary {
	const days: DayLoad[] = [];
	const region = new Map<string, number>();
	const quality = new Map<string, number>();
	let totalSets = 0;
	let totalCns = 0;

	for (const slot of content.days) {
		const resolved = dayTemplate(content, programDayKey(slot.k));
		const exIds = programExercises(content, slot.k).filter((id) => id !== 'rest');
		const rest = resolved.load === 'OFF' || exIds.length === 0;
		let sets = 0;
		let cns = 0;
		for (const exId of exIds) {
			const params = exerciseParams[exId];
			const v = params?.variants[programVariantIndex(slot.k, exId)] ?? params?.variants[0];
			if (!v) continue;
			const s = setsOf(slot.k, exId);
			sets += s;
			cns += (CNS_WEIGHT[v.cnsCost ?? ''] ?? 0) * s;
			for (const r of v.region ?? []) region.set(r, (region.get(r) ?? 0) + s);
			for (const q of v.qualities ?? []) quality.set(q, (quality.get(q) ?? 0) + s);
		}
		totalSets += sets;
		totalCns += cns;
		days.push({
			k: slot.k,
			label: slot.label,
			type: resolved.type,
			load: resolved.load,
			color: resolved.color,
			sets,
			cns,
			rest,
		});
	}

	const sortDesc = (mp: Map<string, number>): Bar[] =>
		[...mp.entries()].sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, value }));
	const regions = sortDesc(region);
	const qualities = sortDesc(quality);

	const warnings: string[] = [];
	const n = days.length;
	for (let i = 0; i < n; i++) {
		const a = days[i];
		const b = days[(i + 1) % n];
		if (a.load === 'HIGH' && b.load === 'HIGH')
			warnings.push(m.prog_warn_b2b({ a: a.label, b: b.label }));
	}
	if (!days.some((d) => d.rest)) warnings.push(m.prog_warn_norest());
	if (totalSets > 0 && regions.length && regions[0].value / totalSets > 0.5)
		warnings.push(
			m.prog_warn_region({
				region: regionLabel(regions[0].key),
				pct: Math.round((regions[0].value / totalSets) * 100),
			}),
		);
	for (const d of days)
		if (!d.rest && d.sets === 0) warnings.push(m.prog_warn_empty({ day: d.label }));

	return { days, regions, qualities, totalSets, totalCns, warnings };
}
