// How today's readiness verdict caps the prescribed session: each exercise is
// kept or held back by its qualities + CNS cost. Pure (params passed in or read
// from the language-neutral exercise table), so it's unit-testable.
import { exerciseParams } from './content/exercises';
import type { Cost, Quality, VerdictId } from './content/types';

const HARD: Quality[] = ['max-strength', 'rfd', 'power', 'hypertrophy'];
const RECOVERY: Quality[] = ['tissue', 'aerobic', 'skill'];

/** Whether an exercise (by its default-variant qualities + CNS cost) still fits
 *  the readiness verdict — i.e. survives the intensity cap. */
function paramsFitVerdict(
	params: { qualities?: Quality[]; cnsCost?: Cost } | undefined,
	verdict: VerdictId,
): boolean {
	if (verdict === 'rest') return false;
	if (verdict === 'green' || verdict === 'short') return true;
	if (!params) return true; // custom / unknown exercise — don't second-guess it
	const q = params.qualities ?? [];
	const cns = params.cnsCost ?? 'mod';
	// moderate: drop high-CNS and max-strength/power work, keep the rest.
	if (verdict === 'moderate') return cns !== 'high' && !q.some((x) => HARD.includes(x));
	// tissue: recovery-quality work only.
	return cns !== 'high' && q.some((x) => RECOVERY.includes(x));
}

const fitsVerdict = (exId: string, verdict: VerdictId): boolean =>
	paramsFitVerdict(exerciseParams[exId]?.variants[0], verdict);

/** Split a day's exercise ids into those that fit the verdict and those it holds
 *  back (deferred — they resurface as a catch-up the next training day). */
export function capByVerdict(
	exIds: string[],
	verdict: VerdictId,
): { keep: string[]; held: string[] } {
	const keep: string[] = [];
	const held: string[] = [];
	for (const id of exIds) (fitsVerdict(id, verdict) ? keep : held).push(id);
	return { keep, held };
}

/** Scheduled exercises that weren't trained — to carry forward as a catch-up.
 *  Covers a fully-skipped day (nothing done) and a partial one (held / unfinished
 *  work within a session that was otherwise trained). */
export function pendingExercises(scheduled: string[], done: Iterable<string>): string[] {
	const set = new Set(done);
	return scheduled.filter((id) => !set.has(id));
}

/** A training week's completion → a build-week credit for auto-progression.
 *  Untracked or zero-logged weeks get full credit (no surprise load drop for
 *  users who don't tick tasks); a partially-completed week counts for at least
 *  half, so progression eases off a deviation without collapsing. */
export function adherenceRatio(done: number, total: number): number {
	if (total === 0 || done === 0) return 1;
	return Math.max(0.5, done / total);
}
