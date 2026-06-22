// Study-backed auto-progression: how fast a working load should climb each week.
// Tissue/collagen work (Baar) tolerates faster early progression than maximal
// strength; pairing isometric finger work with near-max hangs roughly doubles
// the tissue effect (Baar's ~3% → ~6%). Stronger climbers sit nearer their
// ceiling, so gains compound more slowly. Citations map to ids on the Studies tab.
import type { Level } from './state.svelte';

/** Base weekly load gain (%) per exercise, with the study that informs it. */
const PROGRESSION: Record<string, { weeklyPct: number; study: string }> = {
	abra: { weeklyPct: 3, study: 'baar' },
	density: { weeklyPct: 2.5, study: 'baar' },
	slopdens: { weeklyPct: 2.5, study: 'ferrer' },
	maxhang: { weeklyPct: 2, study: 'lopez' },
	recruit: { weeklyPct: 2, study: 'nelson' },
	pinch: { weeklyPct: 2, study: 'nelson' },
	pull: { weeklyPct: 2, study: 'horst' },
	repeaters: { weeklyPct: 1.5, study: 'lattice' },
};

/** Exercises whose adaptation is amplified when a partner is also programmed. */
export const SYNERGY: Record<string, string> = { abra: 'maxhang' };
const SYNERGY_MULT = 2;

/** Diminishing returns near the ceiling. */
const LEVEL_FACTOR: Record<Level, number> = { intermediate: 1, advanced: 0.7, elite: 0.5 };

/** Compounding weekly load rate (a fraction) for an exercise. */
export function weeklyRate(exId: string, level: Level, synergy: boolean): number {
	const base = PROGRESSION[exId]?.weeklyPct ?? 0;
	return (base * LEVEL_FACTOR[level] * (synergy ? SYNERGY_MULT : 1)) / 100;
}

/** Load multiplier after `buildWeeks` of progression (1 = first week, no gain yet). */
export function progressionFactor(rate: number, buildWeeks: number): number {
	return (1 + rate) ** Math.max(0, buildWeeks - 1);
}
