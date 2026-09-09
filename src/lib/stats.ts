// Analytics over logged workouts. Pure functions; the Stats page renders the
// results. Region/quality/CNS come from an exercise's default-variant params
// (these are stable across an exercise's variants); progression/volume come
// from the logged sets. Workouts are stored newest-first.
import { getLocale } from '$lib/paraglide/runtime';
import { exerciseParams } from './content/exercises';
import { RPE_SCALE } from './content/types';
import { isoDay } from './dates';
import type { LoggedReadinessCheck, Session } from './types';

export type NumField = 'loadKg' | 'edgeMm' | 'workSec' | 'reps' | 'restSec' | 'rpe';

export interface Point {
	label: string;
	value: number;
}

const params = (exId: string) => exerciseParams[exId]?.variants[0];
const CNS_WEIGHT: Record<string, number> = { low: 1, mod: 2, high: 3 };

/** Chronological (oldest→newest) workouts. */
function chronological(workouts: readonly Session[]): Session[] {
	return [...workouts].reverse();
}

/** Exercise ids that appear in any logged workout, most-used first. */
export function loggedExerciseIds(workouts: Session[]): string[] {
	const counts = new Map<string, number>();
	for (const w of workouts)
		for (const ex of w.exercises)
			counts.set(ex.exercise, (counts.get(ex.exercise) ?? 0) + ex.sets.length);
	return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Best (max) value of a field for an exercise, per session, oldest→newest. */
export function progression(workouts: readonly Session[], exId: string, field: NumField): Point[] {
	const pts: Point[] = [];
	for (const w of chronological(workouts)) {
		const ex = w.exercises.find((e) => e.exercise === exId);
		if (!ex) continue;
		const vals = ex.sets.map((s) => s[field]).filter((v): v is number => v != null);
		if (vals.length) pts.push({ label: w.at, value: Math.max(...vals) });
	}
	return pts;
}

/** Which numeric field an exercise has logged most (for a sensible default). */
export function dominantField(workouts: Session[], exId: string): NumField {
	const fields: NumField[] = ['loadKg', 'edgeMm', 'workSec', 'reps'];
	const counts = new Map<NumField, number>();
	for (const w of workouts)
		for (const ex of w.exercises)
			if (ex.exercise === exId)
				for (const s of ex.sets)
					for (const f of fields) if (s[f] != null) counts.set(f, (counts.get(f) ?? 0) + 1);
	let best: NumField = 'loadKg';
	let max = -1;
	for (const f of fields) {
		const c = counts.get(f) ?? 0;
		if (c > max) {
			max = c;
			best = f;
		}
	}
	return best;
}

export interface VolumeBar {
	key: string;
	value: number;
}

/** Logged sets grouped by a variant tag (region or quality), sorted desc. */
function volumeBy(workouts: Session[], tag: 'region' | 'qualities'): VolumeBar[] {
	const m = new Map<string, number>();
	for (const w of workouts)
		for (const ex of w.exercises) {
			const tags = params(ex.exercise)?.[tag] ?? [];
			for (const t of tags) m.set(t, (m.get(t) ?? 0) + ex.sets.length);
		}
	return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, value }));
}

export const regionVolume = (w: Session[]): VolumeBar[] => volumeBy(w, 'region');
export const qualityVolume = (w: Session[]): VolumeBar[] => volumeBy(w, 'qualities');

export interface LoadStat {
	label: string;
	sets: number;
	tonnage: number;
	tut: number;
	cns: number;
}

/** The Monday (local) that starts the ISO week containing an ISO date. */
function mondayOf(iso: string): Date {
	const d = new Date(`${iso}T00:00:00`);
	d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
	return d;
}

/** Training load bucketed by calendar week (oldest→newest): set count, tonnage,
 *  time-under-tension, CNS load. */
export function weeklyStats(workouts: Session[]): LoadStat[] {
	const buckets = new Map<string, LoadStat>();
	for (const w of workouts) {
		const monday = mondayOf(w.at);
		const key = isoDay(monday);
		let b = buckets.get(key);
		if (!b) {
			b = {
				label: monday.toLocaleDateString(getLocale(), { month: 'short', day: 'numeric' }),
				sets: 0,
				tonnage: 0,
				tut: 0,
				cns: 0,
			};
			buckets.set(key, b);
		}
		for (const ex of w.exercises) {
			b.sets += ex.sets.length;
			b.cns += (CNS_WEIGHT[params(ex.exercise)?.cnsCost ?? ''] ?? 0) * ex.sets.length;
			for (const s of ex.sets) {
				const reps = s.reps ?? 1;
				if (s.loadKg != null) b.tonnage += s.loadKg * reps;
				if (s.workSec != null) b.tut += s.workSec * reps;
			}
		}
	}
	return [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v);
}

export interface Acwr {
	/** acute / chronic, rounded to 2 dp. */
	ratio: number;
	/** EWMA-smoothed acute (≈7-day) daily load. */
	acute: number;
	/** EWMA-smoothed chronic (≈28-day) daily load. */
	chronic: number;
	status: 'low' | 'optimal' | 'high' | 'spike';
}

const DAY = 86_400_000;
/** Midnight (UTC) of the day an ISO date or epoch-ms falls on. */
const dayStart = (t: number) => Math.floor(t / DAY) * DAY;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Session internal load — sRPE (Foster): session-RPE × session minutes. Session-
 *  RPE is the mean of the logged set RPEs; duration is the logged `durationMin`,
 *  falling back to the session's work + rest time, then to ~2.5 min/set when
 *  nothing timed was recorded. Returns 0 for a session with no sets.
 *
 *  **A session nobody rated has no load, and this does not guess one**
 *  (ADR 0021). sRPE
 *  *is* the rating — without it there is no measurement to scale by duration,
 *  only a duration. This used to assume a moderate 5, which was unreachable
 *  while every fresh row opened at the prescription's midpoint and became the
 *  common case the moment that stopped (#89): every band and flag downstream
 *  would have been a statement about the fallback rather than about the athlete,
 *  which is exactly what #61 found in `computeReadiness`. A session with a
 *  *partial* rating is still rated — the mean is taken over the sets that carry
 *  one.
 *
 *  **An unrated session therefore reads as a rest day**, which is where the
 *  honesty runs out and the limit is worth stating: a history nobody rated at
 *  all reports nothing (`acwr` and `weekLoad` both return null once no day
 *  carries load, which is the case they already had), and a history rated only
 *  here and there understates its own load and its own monotony. Understating a
 *  real number is a different thing from reporting an invented one, and it is a
 *  weighting question for the load search (#91) rather than for this ticket. */
function sessionLoad(w: Session): number {
	let rpeSum = 0;
	let rpeN = 0;
	let workSec = 0;
	let setCount = 0;
	for (const ex of w.exercises)
		for (const s of ex.sets) {
			setCount += 1;
			if (s.rpe != null) {
				rpeSum += s.rpe;
				rpeN += 1;
			}
			workSec += (s.workSec ?? 0) * (s.reps ?? 1) + (s.restSec ?? 0);
		}
	// No rating, no sRPE — and a session with no sets at all has no rating either,
	// so this is the same test the `setCount === 0` case used to need.
	if (rpeN === 0) return 0;
	const sessionRpe = rpeSum / rpeN;
	const durationMin =
		w.durationMin && w.durationMin > 0
			? w.durationMin
			: workSec > 0
				? workSec / 60
				: setCount * 2.5;
	return sessionRpe * durationMin;
}

/** sRPE internal load per calendar day (UTC midnight epoch → load), summed across
 *  any sessions that day; plus the earliest logged day. Future-dated entries are
 *  ignored. */
function dailyLoads(
	workouts: Session[],
	nowMs: number,
): { byDay: Map<number, number>; earliest: number } {
	const byDay = new Map<number, number>();
	let earliest = Number.POSITIVE_INFINITY;
	const today = dayStart(nowMs);
	for (const w of workouts) {
		const t = Date.parse(`${w.at}T00:00:00Z`);
		if (Number.isNaN(t)) continue;
		const d = dayStart(t);
		if (d > today) continue;
		earliest = Math.min(earliest, d);
		byDay.set(d, (byDay.get(d) ?? 0) + sessionLoad(w));
	}
	return { byDay, earliest };
}

// EWMA smoothing constant for an N-day window (Williams et al. 2017): λ = 2/(N+1).
const ewmaLambda = (n: number) => 2 / (n + 1);

/** Acute:chronic workload ratio via exponentially-weighted moving averages
 *  (Williams et al. 2017) over daily sRPE load — better-validated and less prone
 *  to the rolling-average "washout" than the original Gabbett coupled averages.
 *  Acute window ≈7 days, chronic ≈28 days. Needs ~3 weeks of history to be
 *  meaningful — returns null otherwise (the UI shows "building baseline").
 *  `nowMs` is passed in so the function stays pure/testable.
 *  Bands: <0.8 under-loaded, 0.8–1.3 optimal, 1.3–1.5 high, >1.5 spike. */
export function acwr(workouts: Session[], nowMs: number): Acwr | null {
	const { byDay, earliest } = dailyLoads(workouts, nowMs);
	// Without ~3 weeks of history the chronic baseline isn't trustworthy.
	if (!Number.isFinite(earliest) || (nowMs - earliest) / DAY < 21) return null;
	const lambdaA = ewmaLambda(7);
	const lambdaC = ewmaLambda(28);
	let acute = 0;
	let chronic = 0;
	// Walk every calendar day from first log to today; rest days contribute 0 load.
	for (let d = earliest; d <= dayStart(nowMs); d += DAY) {
		const load = byDay.get(d) ?? 0;
		acute = load * lambdaA + acute * (1 - lambdaA);
		chronic = load * lambdaC + chronic * (1 - lambdaC);
	}
	if (chronic <= 0) return null;
	const ratio = Math.round((acute / chronic) * 100) / 100;
	const status = ratio > 1.5 ? 'spike' : ratio < 0.8 ? 'low' : ratio <= 1.3 ? 'optimal' : 'high';
	return { ratio, acute: Math.round(acute), chronic: Math.round(chronic), status };
}

export interface WeekLoad {
	/** Total sRPE internal load over the last 7 days. */
	load: number;
	/** Training monotony (Foster): mean daily load ÷ its SD. High = samey, no easy
	 *  days; the variability that protects against overload is missing. */
	monotony: number;
	/** Training strain (Foster): weekly load × monotony. */
	strain: number;
	/** 'monotonous' once monotony ≥ 2 (Foster's risk threshold), else 'varied'. */
	status: 'varied' | 'monotonous';
}

/** Weekly training monotony & strain (Foster 1998) over the last 7 calendar days,
 *  rest days included as zero load. Same weekly volume done evenly every day
 *  (high monotony) carries more overload risk than the same volume done in spikes
 *  with easy days between. Returns null when nothing was trained in the window. */
export function weekLoad(workouts: Session[], nowMs: number): WeekLoad | null {
	const { byDay } = dailyLoads(workouts, nowMs);
	const today = dayStart(nowMs);
	const days: number[] = [];
	for (let i = 0; i < 7; i++) days.push(byDay.get(today - i * DAY) ?? 0);
	const load = days.reduce((a, b) => a + b, 0);
	if (load <= 0) return null;
	const m = load / 7;
	const sd = Math.sqrt(days.reduce((s, d) => s + (d - m) ** 2, 0) / 7);
	// SD 0 means every day was identical & non-zero — maximally monotonous.
	const monotony = sd > 0 ? m / sd : 7;
	const strain = load * monotony;
	return {
		load: Math.round(load),
		monotony: Math.round(monotony * 100) / 100,
		strain: Math.round(strain),
		status: monotony >= 2 ? 'monotonous' : 'varied',
	};
}

/** A session counts as trained once at least one set is marked done (prefilled
 *  but-untouched sets don't count). */
const hasDoneSet = (w: Session): boolean => w.exercises.some((ex) => ex.sets.some((s) => s.done));

/** Number of sessions actually trained (≥1 completed set). */
export function completedSessions(workouts: Session[]): number {
	return workouts.filter(hasDoneSet).length;
}

const loggedDays = (workouts: Session[]) => new Set(workouts.filter(hasDoneSet).map((w) => w.at));

/** Consecutive calendar days with a logged workout, ending today (or yesterday). */
export function trainStreak(workouts: Session[]): number {
	const days = loggedDays(workouts);
	if (days.size === 0) return 0;
	const cur = new Date();
	if (!days.has(isoDay(cur))) cur.setDate(cur.getDate() - 1); // grace: today not done yet
	let streak = 0;
	while (days.has(isoDay(cur))) {
		streak += 1;
		cur.setDate(cur.getDate() - 1);
	}
	return streak;
}

/** Distinct days trained in the last 7 calendar days. */
export function sessionsLast7(workouts: Session[]): number {
	const days = loggedDays(workouts);
	const cur = new Date();
	let n = 0;
	for (let i = 0; i < 7; i++) {
		if (days.has(isoDay(cur))) n += 1;
		cur.setDate(cur.getDate() - 1);
	}
	return n;
}

/** Counts of logged RPE values, one bucket per whole point of `RPE_SCALE`.
 *  Only the buckets something landed in; a set with no rating is not a bucket. */
export function rpeHistogram(workouts: Session[]): Point[] {
	const counts = new Array(RPE_SCALE.max - RPE_SCALE.min + 1).fill(0) as number[];
	for (const w of workouts)
		for (const ex of w.exercises)
			for (const s of ex.sets)
				if (s.rpe != null) {
					// Clamped to the scale rather than into it: the floor is 0, and the
					// `Math.max(1, …)` this replaces counted a logged 0 as a 1 — the app
					// editing a rating it had been given (#89).
					const r = Math.min(RPE_SCALE.max, Math.max(RPE_SCALE.min, Math.round(s.rpe)));
					counts[r - RPE_SCALE.min] += 1;
				}
	const out: Point[] = [];
	for (let r = RPE_SCALE.min; r <= RPE_SCALE.max; r++) {
		const n = counts[r - RPE_SCALE.min];
		if (n > 0) out.push({ label: String(r), value: n });
	}
	return out;
}

export interface ReadinessInsights {
	/** Personal rolling-mean readiness score, or null until enough history. */
	baseline: number | null;
	/** Direction of the recent readiness trend, or null until enough history. */
	trend: 'up' | 'down' | 'flat' | null;
	/** A clamped score offset learned from how sessions actually went (0 if too few). */
	calibration: number;
}

// Post-session outcome (0 bailed · 1 flat · 2 as-expected · 3 strong) → a rough
// 0–100 equivalent, compared against the predicted readiness to learn a bias.
const OUTCOME_SCORE = [20, 45, 70, 95];

/** Personalize readiness from the logged history: a rolling baseline, the recent
 *  trend, and a calibration offset that leans future scores toward how the user
 *  actually trains. Pure; needs a handful of entries before it does anything. */
export function readinessInsights(log: LoggedReadinessCheck[]): ReadinessInsights {
	const scores = log.map((e) => e.score);
	const recent = scores.slice(-14);
	const baseline = recent.length >= 5 ? Math.round(mean(recent)) : null;

	let trend: ReadinessInsights['trend'] = null;
	if (scores.length >= 5) {
		const prior = scores.slice(-8, -3);
		const d = mean(scores.slice(-3)) - mean(prior);
		trend = d <= -8 ? 'down' : d >= 8 ? 'up' : 'flat';
	}

	let calibration = 0;
	const withOutcome = log.filter((e) => e.outcome != null).slice(-10);
	if (withOutcome.length >= 4) {
		const resid = withOutcome.map((e) => (OUTCOME_SCORE[e.outcome as number] ?? 50) - e.score);
		calibration = Math.max(-12, Math.min(12, Math.round(mean(resid))));
	}
	return { baseline, trend, calibration };
}
