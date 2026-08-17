// The single source of screen content for the four direction prototypes
// (#47–#50, under the redesign map #42).
//
// WHY THIS EXISTS
// ---------------
// The four directions are judged as *designs*, so they must render the same
// three screens with the same content. If each branch invents its own sample
// data they stop being comparable, which is the one thing the prototype brief
// forbids. This module lands on `development` before the branches so all four
// inherit it.
//
// A direction that wants to show *less* than what is here has found something
// worth writing on its ticket. It is not licence to render a different app.
//
// WHAT IT IS AND IS NOT
// ---------------------
// It is fixed **account state** — sessions, readiness checks, a bodyweight
// series — plus the derived numbers, computed by the *real* domain modules
// (`computeReadiness`, `capByVerdict`, `stats.ts`). Nothing here hardcodes a
// verdict, a held exercise or a streak: change an answer and the screens change
// the way the app would. That keeps the four prototypes honest about what the
// product actually decides, which the redesign is explicitly not allowed to
// touch (#42, "Out of scope").
//
// It is not a store. There is no writing back: ADR 0007 owns what holds
// interactive state, and pre-empting it here would bake a guess into all four
// branches. Directions hold their own `useState` over this snapshot.
//
// LOCALE
// ------
// Everything localized resolves through `getContent()` and the active Paraglide
// locale at call time, so `getPrototypeFixtures()` returns pt-BR content under
// pt-BR. **Every direction is judged in both locales** — Portuguese runs longer
// and is where a dense layout breaks first. The handful of strings that are
// athlete-typed rather than app copy (session notes) live in
// `src/prototype-prose.ts`, which `check:i18n` now guards for parity alongside
// `messages/` and the training content.
//
// DOMAIN NOTES THAT BIT A PRIOR SESSION
// -------------------------------------
// - **No max-pull probe.** `CONTEXT.md` marks Probe `_Leaving_` and it is gone
//   from the rebuild: a readiness check rests on wellness answers and load
//   alone. The `/` screen on `main` still renders a probe input. Do not port it.
// - **The bodyweight nudge stays** (ADR 0009) and writes to a `bodyweight`
//   series, not to the dropped marker set.
// - **Identity is never a display string** (ADR 0003). Weekdays are the stable
//   `Mon`..`Sun` keys and dates are ISO; the localized label is produced at the
//   last moment, for display only.
import {
	type Answers,
	computeReadiness,
	type FlagArea,
	getContent,
	phaseId,
	visibleQuestionsOrdered,
} from '$lib/content';
import type { Content, Variant, VerdictId } from '$lib/content/types';
import { isoDayOf } from '$lib/dates';
import { displayDate } from '$lib/displayDate';
import {
	asExerciseId,
	asWeekdayKey,
	asWeekId,
	type ExerciseId,
	type TaskKey,
	taskKey,
	type WeekdayKey,
	type WeekId,
	weekdayKeyOf,
} from '$lib/ids';
import { getLocale } from '$lib/paraglide/runtime';
import { capByVerdict } from '$lib/readinessPlan';
import {
	acwr,
	completedSessions,
	readinessInsights,
	sessionsLast7,
	trainStreak,
	weekLoad,
} from '$lib/stats';
import type {
	DeepEntry,
	LogEntry,
	MetricEntry,
	ReadinessEntry,
	WorkoutEntry,
	WorkoutSet,
} from '$lib/types';
import { FIXTURE_PROSE } from './prototype-prose';

// ---------------------------------------------------------------- the scenario

/** The slot the prototypes present as "today": week 5 of an 8-week block, on the
 *  Pull day. Chosen deliberately — it carries four tasks, two of which the
 *  verdict holds back, so `/` shows the plan *and* the held work rather than a
 *  thin best case. The weekday is fixed rather than read from the clock: a
 *  prototype opened on a Sunday would otherwise render a rest day with nothing
 *  on it, and four directions judged on different days would not compare. */
const TODAY_WEEKDAY = asWeekdayKey('Thu');
const CURRENT_WEEK = 5;
const CURRENT_WEEK_ID = asWeekId(CURRENT_WEEK);
const BLOCK_WEEKS = 8;

/** Today's readiness answers. Values are the option values from `content.quiz`,
 *  picked so the check exercises its adaptive half: `body` reveals `severity`,
 *  and a flat `fatigue` reveals `stress` + `mood`, so all five wellness
 *  dimensions appear in the breakdown. The resulting verdict is `moderate` —
 *  the tender-finger gate caps it there whatever the score does. */
const TODAY_ANSWERS: Answers = {
	sleep: 7,
	fatigue: 4,
	stress: 6,
	mood: 10,
	soreness: 7,
	body: 1,
	severity: 1,
	illness: 0,
	time: 7,
};

/** Readiness scores for the fourteen days behind today, oldest first. Averages
 *  ~71, so today reads as "about usual" rather than as a collapse, and the trend
 *  comes out flat. */
const HISTORY_SCORES = [68, 74, 66, 78, 72, 58, 70, 76, 69, 73, 71, 67, 75, 70];

/** Post-session outcomes, by index into `HISTORY_SCORES`. Four are enough to
 *  push the score note from "heuristic" to "tuned" — the honest framing of a
 *  weighting that starts as a reasoned default and only becomes personal once
 *  the athlete has reported back. */
const HISTORY_OUTCOMES: Record<number, number> = { 4: 2, 6: 2, 8: 2, 9: 2 };

/** How far back the session history runs. Past three weeks on purpose: the
 *  acute:chronic workload ratio returns null below that, and a `/` screen with
 *  no load signal hides a flag the design has to place. */
const HISTORY_DAYS = 35;

/** Days in that window with no session, counted back from today. Sundays are
 *  rest and never count against adherence, so they are not listed — and neither
 *  is the carry-forward day, which `resolveMissed` picks from the calendar. */
const SKIPPED_DAYS_AGO = new Set([9, 17]);

const BODYWEIGHT_KG = [72.4, 72.1, 71.8, 72.0, 71.6, 71.5, 71.9];

// ------------------------------------------------------------ athlete-typed text

/** Athlete-typed free text lives in `src/prototype-prose.ts` — no imports, so
 *  `check:i18n` can read it under plain `tsx` and hold both locales in parity
 *  the way it already does for `messages/` and the training content. */
function prose(key: string): string {
	const locale = getLocale();
	return FIXTURE_PROSE[locale]?.[key] ?? FIXTURE_PROSE['en-US'][key] ?? key;
}

// ------------------------------------------------------------------ the shapes

export type SetField = 'weight' | 'edge' | 'time' | 'reps' | 'grip' | 'rest' | 'rpe';

/** One exercise as it appears in today's slot — the unit the athlete ticks off. */
export interface TaskFixture {
	/** What completion is recorded against (ADR-0001). Unique across slots, which
	 *  an exercise id alone is not: the same exercise appears in several weekdays
	 *  of a block, and keying a tick by exercise would tick all of them. */
	key: TaskKey;
	exerciseId: ExerciseId;
	label: string;
	done: boolean;
	/** Held back because the verdict caps intensity below what it demands. Held,
	 *  not cancelled: it resurfaces as carry-forward on the next training day. */
	held: boolean;
}

/** One readiness question as the quiz renders it, in display order. Follow-ups
 *  carry `sub` and sit directly under the core question that revealed them. */
export interface QuizFixture {
	id: string;
	sub: boolean;
	question: string;
	/** One-line "why we ask", shown under the question. */
	why?: string;
	/** Study id backing the question, into `content.studies`. */
	study?: string;
	options: { label: string; value: number }[];
	answer: number | null;
}

export interface FlagFixture {
	id: string;
	severity: string;
	area?: FlagArea;
	title: string;
	text: string;
	focus: string[];
}

export interface TrendPoint {
	value: number;
	label: string;
}

export interface TodayFixture {
	/** ISO calendar date. The identity; `dateLabel` is for display only. */
	iso: string;
	dateLabel: string;
	weekdayKey: WeekdayKey;
	weekdayLabel: string;
	weekId: WeekId;
	week: number;
	blockWeeks: number;
	/** The block phase week 5 falls in, localized. */
	phase: Content['phases'][keyof Content['phases']];
	/** Today's day type — category, primary and secondary focus, load label. */
	day: Content['days'][number];
	isRestDay: boolean;
	tasks: TaskFixture[];
	/** Tasks the verdict holds back, in the same order as `tasks`. */
	held: TaskFixture[];
	questions: QuizFixture[];
	answers: Answers;
	score: number;
	verdictId: VerdictId;
	verdict: Content['verdicts'][VerdictId];
	/** Today against the athlete's own rolling mean. Semantic, not copy — each
	 *  direction renders it through `m.rd_vs_*`. */
	vsBaseline: 'below' | 'usual' | 'above';
	baseline: number | null;
	trend: 'up' | 'down' | 'flat' | null;
	/** Whether the score note reads as a reasoned default or as personalized. */
	scoreNote: 'heuristic' | 'tuned';
	/** The five wellness dimensions behind the score, answered ones only. */
	breakdown: { id: string; value: number }[];
	flags: FlagFixture[];
	/** Post-session outcome not yet given, so the capture control is shown. */
	awaitingOutcome: boolean;
	/** Last fourteen readiness scores, for the trend chart. */
	trendPoints: TrendPoint[];
	stats: { streak: number; last7: number; total: number };
	bodyweight: {
		series: MetricEntry[];
		latestKg: number;
		/** Nothing logged today, so the nudge is showing. ADR 0009: this writes to
		 *  the `bodyweight` series, which survived the marker cull. */
		promptToday: boolean;
	};
	/** Yesterday's training day went untrained — offer it again today. */
	missed: {
		weekdayKey: WeekdayKey;
		weekdayLabel: string;
		exerciseIds: ExerciseId[];
		labels: string[];
	} | null;
	/** No rehab block is running; the entry point is still on the screen. */
	rehab: null;
	/** The injury self-check reachable from the finger flag, and its last result. */
	deep: {
		area: FlagArea;
		assessment: Content['deep'][string];
		last: DeepEntry;
	};
}

export interface TrainItemFixture {
	key: TaskKey;
	exerciseId: ExerciseId;
	exName: string;
	cat: string;
	/** CSS custom-property name driving this exercise's accent, e.g. `--violet`.
	 *  A direction that rejects the existing palette (#42 reopened it) still gets
	 *  the *grouping* this encodes — it is which family the exercise belongs to,
	 *  not a hex value. */
	catVar: string;
	variantIndex: number;
	/** The selected variant's own name — what the log records alongside the
	 *  exercise when it is not the default. */
	variantName: string;
	/** Every swappable option, for the variant picker. */
	variants: { name: string; tool?: string; speed?: string }[];
	/** What the athlete is asked to do.
	 *
	 *  A **prescription** is resolved after swaps, overrides, progression and
	 *  phase scaling (`CONTEXT.md`). This fixture applies none of them — it hands
	 *  over the variant's built-in targets, which is the same value while nothing
	 *  overrides them. The store (#18) is what makes it a resolved one. */
	prescription: Variant;
	/** Which per-set fields this exercise logs, in column order. */
	fields: SetField[];
	sets: WorkoutSet[];
	/** Has interval timings the rest timer can run. */
	timed: boolean;
}

export interface TimerFixture {
	/** Exercise + variant, so changing the variant re-seeds the timer. */
	key: string;
	label: string;
	prepareSec: number;
	workSec: number;
	restSec: number;
	rounds: number;
	sets: number;
	setRestSec: number;
	totalSec: number;
}

export interface TrainFixture {
	weekdayKey: WeekdayKey;
	weekdayLabel: string;
	weekId: WeekId;
	timer: TimerFixture | null;
	items: TrainItemFixture[];
	/** Library exercises not in today's slot, for the add-exercise picker. */
	available: { exerciseId: ExerciseId; name: string; cat: string }[];
	note: string;
	durationMin: number | null;
	/** Something is already logged today, so "repeat last session" is spent. */
	canRepeatLast: boolean;
}

export interface LoggedReadinessFixture {
	iso: string;
	dateLabel: string;
	timeLabel: string;
	score: number;
	verdictId: VerdictId;
	verdict: Content['verdicts'][VerdictId];
	/** The check as answered — question text against the chosen answer. */
	responses: { question: string; answer: string }[];
	flagTitles: string[];
	/** 0 bailed · 1 flat · 2 as expected · 3 strong. */
	outcome: number | null;
}

export interface LoggedSessionFixture {
	iso: string;
	dateLabel: string;
	weekdayKey: WeekdayKey;
	weekdayLabel: string;
	dayType: string;
	exercises: { exerciseId: ExerciseId; name: string; fields: SetField[]; sets: WorkoutSet[] }[];
	note: string;
	durationMin: number | null;
	setCount: number;
}

export interface LogFixture {
	readiness: LoggedReadinessFixture[];
	sessions: LoggedSessionFixture[];
	activity: LogEntry[];
}

export interface PrototypeFixtures {
	today: TodayFixture;
	train: TrainFixture;
	log: LogFixture;
	/** The raw account state behind all three screens, for anything a direction
	 *  wants to present differently. Read-only. */
	state: {
		workouts: WorkoutEntry[];
		readinessLog: ReadinessEntry[];
		bodyweight: MetricEntry[];
		activity: LogEntry[];
		deepLog: DeepEntry[];
	};
}

// ----------------------------------------------------------------- date helpers

const DAY_MS = 86_400_000;

const isoDaysAgo = (now: number, n: number): string => isoDayOf(now - n * DAY_MS);

const timeLabel = (at: number): string =>
	new Date(at).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });

// -------------------------------------------------------------- prescription

const mid = (r?: { min: number; max: number }): number | null =>
	r ? Math.round((r.min + r.max) / 2) : null;

/** Which per-set fields the logger shows. Weight and edge are always loggable —
 *  load or a different edge can be added to anything — grip appears when the
 *  exercise loads one. Mirrors `trainColumns.colsFor` on `main`. */
function fieldsFor(spec: Variant | undefined): SetField[] {
	const f: SetField[] = ['weight', 'edge', 'time', 'reps'];
	if (spec?.grip) f.push('grip');
	f.push('rest', 'rpe');
	return f;
}

/** A set pre-filled from the prescription's range midpoints. */
function prefilledSet(spec: Variant): WorkoutSet {
	return {
		weight: mid(spec.loadKg),
		edge: mid(spec.edgeMm),
		time: mid(spec.workSec),
		reps: mid(spec.reps),
		rest: mid(spec.restSec ?? spec.setRestSec),
		rpe: mid(spec.rpe),
		grip: spec.grip ?? null,
		done: false,
	};
}

/** Deterministic variation, so a logged history reads like a person trained it
 *  rather than like a loop wrote it — and reads the same in all four branches.
 *  No `Math.random()`: a fixture that shifts between renders cannot be compared. */
const jitter = (seed: number, spread: number): number => ((seed * 37) % (spread * 2 + 1)) - spread;

function loggedSet(spec: Variant, seed: number): WorkoutSet {
	const s = prefilledSet(spec);
	if (s.weight != null) s.weight = Math.max(0, s.weight + jitter(seed, 2));
	if (s.reps != null) s.reps = Math.max(1, s.reps + jitter(seed, 1));
	if (s.rpe != null) s.rpe = Math.min(10, Math.max(4, s.rpe + jitter(seed + 1, 1)));
	s.done = true;
	return s;
}

/** The day type a weekday runs. Throws rather than falling back: a fixture that
 *  silently rendered an empty day would look like a design decision. */
function dayOf(content: Content, weekdayKey: WeekdayKey): Content['days'][number] {
	const day = content.days.find((d) => d.k === weekdayKey);
	if (!day) throw new Error(`prototype-fixtures: no day type for weekday ${weekdayKey}`);
	return day;
}

/** The exercise ids a day type prescribes, minus the rest placeholder.
 *
 *  One of the two places an `ExerciseId` is minted: the day type's `ex` list is
 *  the exercise library talking about itself, and `content.exercises[id]` is the
 *  check — an id with no entry never leaves this function. */
function exerciseIdsFor(content: Content, weekdayKey: WeekdayKey): ExerciseId[] {
	const day = content.days.find((d) => d.k === weekdayKey);
	return (day?.ex ?? [])
		.filter((id) => id !== 'rest' && content.exercises[id])
		.map((id) => asExerciseId(id));
}

// ------------------------------------------------------------- account state

/** The training day that went untrained and is offered again today. Yesterday,
 *  unless yesterday was the rest day, in which case the day before it — the
 *  control has to be on the screen whatever weekday the prototype is opened on. */
function resolveMissed(
	content: Content,
	now: number,
): { daysAgo: number; weekdayKey: WeekdayKey; exerciseIds: ExerciseId[] } {
	for (const daysAgo of [1, 2]) {
		const weekdayKey = weekdayKeyOf(isoDaysAgo(now, daysAgo));
		const exerciseIds = exerciseIdsFor(content, weekdayKey);
		if (exerciseIds.length > 0) return { daysAgo, weekdayKey, exerciseIds };
	}
	throw new Error('prototype-fixtures: no untrained day to carry forward');
}

/** The sessions behind today. Dates are real: the stat cards and the workload
 *  ratio read the wall clock, so a history shifted off it would report a broken
 *  streak and an empty week. Each past day runs whatever day type its own
 *  weekday prescribes — only *today* is pinned to the scenario's Pull day. */
function buildHistory(content: Content, now: number, missedDaysAgo: number): WorkoutEntry[] {
	const out: WorkoutEntry[] = [];
	const noteKeys = ['note_strong', 'note_skin', 'note_short', 'note_elbow'];
	let logged = 0;

	for (let ago = HISTORY_DAYS; ago >= 1; ago--) {
		if (ago === missedDaysAgo || SKIPPED_DAYS_AGO.has(ago)) continue;
		const iso = isoDaysAgo(now, ago);
		const weekdayKey = weekdayKeyOf(iso);
		const exIds = exerciseIdsFor(content, weekdayKey);
		if (exIds.length === 0) continue; // a rest day is never a session

		const exercises = exIds.map((exId, i) => {
			const ex = content.exercises[exId];
			const spec = ex.variants[0];
			const planned = Math.min(4, Math.max(1, spec.sets?.min ?? 3));
			return {
				exId,
				name: ex.name,
				sets: Array.from({ length: planned }, (_, k) => loggedSet(spec, ago + i + k)),
			};
		});

		out.push({
			date: displayDate(iso),
			at: iso,
			day: weekdayKey,
			exercises,
			// Roughly one session in four carries a note the athlete typed.
			note: logged % 4 === 1 ? prose(noteKeys[logged % noteKeys.length]) : '',
			durationMin: 45 + ((ago * 7) % 30),
		});
		logged += 1;
	}
	// Newest first, the order the log screen reads in.
	return out.reverse();
}

/** Today, opened mid-session: one exercise has a set done and the next staged,
 *  the rest sit prefilled and untouched. `focusExId` is the first exercise the
 *  verdict *kept* — training the work it held back would contradict the plan the
 *  same screen is showing. */
function buildTodaySession(
	content: Content,
	iso: string,
	exerciseIds: ExerciseId[],
	focusExId: ExerciseId | undefined,
): WorkoutEntry {
	const exercises = exerciseIds.map((exId) => {
		const ex = content.exercises[exId];
		const spec = ex.variants[0];
		const sets =
			exId === focusExId ? [prefilledSet(spec), prefilledSet(spec)] : [prefilledSet(spec)];
		if (exId === focusExId) {
			sets[0].done = true;
			sets[0].rpe = sets[0].rpe ?? 7;
		}
		return { exId, name: ex.name, sets };
	});
	return {
		date: displayDate(iso),
		at: iso,
		day: TODAY_WEEKDAY,
		exercises,
		note: '',
		durationMin: 22,
	};
}

function buildReadinessLog(now: number): ReadinessEntry[] {
	const answersFor = (score: number): Answers => {
		// Reconstruct a plausible set of answers for a recorded score, so the log
		// can show what was actually reported rather than a bare number.
		const band = score >= 75 ? 10 : score >= 68 ? 7 : score >= 60 ? 4 : 3;
		return {
			sleep: band,
			fatigue: band === 10 ? 10 : band === 7 ? 7 : 4,
			soreness: band >= 7 ? 10 : 7,
			body: score < 62 ? 1 : 0,
			...(score < 62 ? { severity: 1 } : {}),
			illness: 0,
			time: score >= 68 ? 10 : 7,
		};
	};

	return HISTORY_SCORES.map((score, i) => {
		const iso = isoDaysAgo(now, HISTORY_SCORES.length - i);
		const answers = answersFor(score);
		const readiness = computeReadiness(answers);
		const outcome = HISTORY_OUTCOMES[i];
		return {
			date: displayDate(iso),
			// 07:40-ish, before training. Epoch ms, never a formatted string.
			at: new Date(`${iso}T07:40:00`).getTime() + (i % 5) * 6 * 60_000,
			verdict: readiness.verdict,
			score,
			answers,
			flags: readiness.flags.map((f) => ({
				id: f.id,
				severity: f.severity,
				...(f.area ? { area: f.area } : {}),
			})),
			...(outcome != null ? { outcome } : {}),
		} satisfies ReadinessEntry;
	});
}

function buildBodyweight(now: number): MetricEntry[] {
	return BODYWEIGHT_KG.map((v, i) => {
		// Roughly weekly, and deliberately not today — the nudge only shows when
		// today has no reading.
		const ago = (BODYWEIGHT_KG.length - i) * 5;
		const iso = isoDaysAgo(now, ago);
		return { date: displayDate(iso), v, at: new Date(`${iso}T08:00:00`).getTime() };
	});
}

function buildActivity(content: Content, now: number): LogEntry[] {
	const rows: { ago: number; type: LogEntry['type']; note: string }[] = [
		{ ago: 0, type: 'day', note: '' },
		{ ago: 2, type: 'day', note: '' },
		{ ago: 3, type: 'rec', note: prose('activity_note_check') },
		{ ago: 5, type: 'day', note: '' },
		{ ago: 6, type: 'day', note: '' },
		{ ago: 8, type: 'test', note: '' },
		{ ago: 12, type: 'day', note: '' },
		{ ago: 16, type: 'rec', note: prose('activity_note_deload') },
	];
	return rows.map((r) => {
		const iso = isoDaysAgo(now, r.ago);
		// Today's row is the scenario's Pull day; older rows name the day type
		// their own date actually ran.
		const key = r.ago === 0 ? TODAY_WEEKDAY : weekdayKeyOf(iso);
		const d = dayOf(content, key);
		return { date: displayDate(iso), type: r.type, label: d.type, color: d.color, note: r.note };
	});
}

function buildDeepLog(now: number): DeepEntry[] {
	const iso = isoDaysAgo(now, 11);
	// Banded by `scoreDeep`: 74 falls in the middle band, which routes rehab to
	// the subacute stage rather than to a full stop.
	return [{ date: displayDate(iso), area: 'fingers', score: 74, band: 'moderate' }];
}

// ---------------------------------------------------------------- the screens

/** Everything today's screen needs that was resolved once, up front, because the
 *  order matters: the verdict is computed from the history, and it is the verdict
 *  that decides which work today's session is allowed to contain. */
interface TodayContext {
	iso: string;
	exerciseIds: ExerciseId[];
	readiness: ReturnType<typeof computeReadiness>;
	insights: ReturnType<typeof readinessInsights>;
	missed: { daysAgo: number; weekdayKey: WeekdayKey; exerciseIds: ExerciseId[] };
}

function buildToday(
	content: Content,
	state: PrototypeFixtures['state'],
	ctx: TodayContext,
): TodayFixture {
	const { iso, exerciseIds, readiness, insights } = ctx;
	const day = dayOf(content, TODAY_WEEKDAY);
	const heldSet = new Set(capByVerdict(exerciseIds, readiness.verdict).held);

	const todaySession = state.workouts.find((w) => w.at === iso);
	const doneIds = new Set(
		(todaySession?.exercises ?? []).filter((e) => e.sets.some((s) => s.done)).map((e) => e.exId),
	);

	const tasks: TaskFixture[] = exerciseIds.map((exerciseId) => ({
		key: taskKey(CURRENT_WEEK_ID, TODAY_WEEKDAY, exerciseId),
		exerciseId,
		label: content.exercises[exerciseId].name,
		done: doneIds.has(exerciseId),
		held: heldSet.has(exerciseId),
	}));

	const questions: QuizFixture[] = visibleQuestionsOrdered(TODAY_ANSWERS).map(({ id, sub }) => {
		const q = content.quiz.find((x) => x.id === id);
		return {
			id,
			sub,
			question: q?.q ?? id,
			...(q?.why ? { why: q.why } : {}),
			...(q?.study ? { study: q.study } : {}),
			options: (q?.a ?? []).map((o) => ({ label: o.t, value: o.v })),
			answer: TODAY_ANSWERS[id] ?? null,
		};
	});

	const delta = insights.baseline == null ? 0 : readiness.score - insights.baseline;

	return {
		iso,
		dateLabel: displayDate(iso),
		weekdayKey: TODAY_WEEKDAY,
		weekdayLabel: day.label,
		weekId: CURRENT_WEEK_ID,
		week: CURRENT_WEEK,
		blockWeeks: BLOCK_WEEKS,
		phase: content.phases[phaseId(CURRENT_WEEK, BLOCK_WEEKS)],
		day,
		isRestDay: tasks.length === 0,
		tasks,
		held: tasks.filter((t) => t.held),
		questions,
		answers: TODAY_ANSWERS,
		score: readiness.score,
		verdictId: readiness.verdict,
		verdict: content.verdicts[readiness.verdict],
		vsBaseline: delta <= -10 ? 'below' : delta >= 10 ? 'above' : 'usual',
		baseline: insights.baseline,
		trend: insights.trend,
		scoreNote:
			state.readinessLog.filter((e) => e.outcome != null).length >= 4 ? 'tuned' : 'heuristic',
		breakdown: ['sleep', 'fatigue', 'soreness', 'stress', 'mood']
			.filter((id) => TODAY_ANSWERS[id] != null)
			.map((id) => ({ id, value: TODAY_ANSWERS[id] })),
		flags: readiness.flags.map((f) => {
			const c = content.flags[f.id];
			return {
				id: f.id,
				severity: f.severity,
				...(f.area ? { area: f.area } : {}),
				title: c?.title ?? f.id,
				text: c?.text ?? '',
				focus: c?.focus ?? [],
			};
		}),
		awaitingOutcome: true,
		trendPoints: state.readinessLog
			.slice(-14)
			.map((e) => ({ value: e.score, label: displayDate(isoDayOf(e.at)) })),
		stats: {
			streak: trainStreak(state.workouts),
			last7: sessionsLast7(state.workouts),
			total: completedSessions(state.workouts),
		},
		bodyweight: {
			series: state.bodyweight,
			latestKg: BODYWEIGHT_KG[BODYWEIGHT_KG.length - 1],
			promptToday: true,
		},
		missed: {
			weekdayKey: ctx.missed.weekdayKey,
			weekdayLabel: dayOf(content, ctx.missed.weekdayKey).label,
			exerciseIds: ctx.missed.exerciseIds,
			labels: ctx.missed.exerciseIds.map((id) => content.exercises[id].name),
		},
		rehab: null,
		deep: {
			area: 'fingers',
			assessment: content.deep.fingers,
			last: state.deepLog[0],
		},
	};
}

function buildTrain(
	content: Content,
	state: PrototypeFixtures['state'],
	iso: string,
	exerciseIds: ExerciseId[],
): TrainFixture {
	const session = state.workouts.find((w) => w.at === iso);

	const items: TrainItemFixture[] = exerciseIds.map((exerciseId) => {
		const ex = content.exercises[exerciseId];
		const spec = ex.variants[0];
		return {
			key: taskKey(CURRENT_WEEK_ID, TODAY_WEEKDAY, exerciseId),
			exerciseId,
			exName: ex.name,
			cat: ex.cat,
			catVar: ex.catVar,
			variantIndex: 0,
			variantName: spec.name,
			variants: ex.variants.map((v) => ({
				name: v.name,
				...(v.tool ? { tool: v.tool } : {}),
				...(v.speed ? { speed: v.speed } : {}),
			})),
			prescription: spec,
			fields: fieldsFor(spec),
			sets: session?.exercises.find((e) => e.exId === exerciseId)?.sets ?? [prefilledSet(spec)],
			timed: spec.workSec != null,
		};
	});

	const timed = items.find((it) => it.timed);
	const timer: TimerFixture | null = timed
		? (() => {
				const s = timed.prescription;
				const workSec = mid(s.workSec) ?? 10;
				const restSec = mid(s.restSec) ?? 0;
				const rounds = mid(s.rounds) ?? 1;
				const sets = mid(s.sets) ?? 1;
				const setRestSec = mid(s.setRestSec) ?? 0;
				const prepareSec = s.prepareSec ?? 10;
				return {
					key: `${timed.exerciseId}:0`,
					label: timed.exName,
					prepareSec,
					workSec,
					restSec,
					rounds,
					sets,
					setRestSec,
					totalSec:
						prepareSec + sets * (rounds * (workSec + restSec)) + Math.max(0, sets - 1) * setRestSec,
				};
			})()
		: null;

	return {
		weekdayKey: TODAY_WEEKDAY,
		weekdayLabel: dayOf(content, TODAY_WEEKDAY).label,
		weekId: CURRENT_WEEK_ID,
		timer,
		items,
		// The second mint point, and the same warrant as `exerciseIdsFor`: these
		// keys come out of the library itself.
		available: Object.entries(content.exercises)
			.filter(([id]) => id !== 'rest' && !exerciseIds.includes(asExerciseId(id)))
			.map(([id, ex]) => ({ exerciseId: asExerciseId(id), name: ex.name, cat: ex.cat })),
		note: session?.note ?? '',
		durationMin: session?.durationMin ?? null,
		canRepeatLast: false,
	};
}

function buildLog(content: Content, state: PrototypeFixtures['state']): LogFixture {
	const verdictOf = (id: string) => content.verdicts[id as VerdictId];

	const readiness: LoggedReadinessFixture[] = [...state.readinessLog].reverse().map((r) => ({
		iso: isoDayOf(r.at),
		dateLabel: r.date,
		timeLabel: timeLabel(r.at),
		score: r.score,
		verdictId: r.verdict as VerdictId,
		verdict: verdictOf(r.verdict),
		responses: content.quiz.flatMap((q) => {
			const v = r.answers?.[q.id];
			if (v == null) return [];
			return [{ question: q.q, answer: q.a.find((o) => o.v === v)?.t ?? String(v) }];
		}),
		flagTitles: (r.flags ?? []).map((f) => content.flags[f.id]?.title ?? f.id),
		outcome: r.outcome ?? null,
	}));

	const sessions: LoggedSessionFixture[] = state.workouts.map((w) => {
		// `WorkoutEntry` is still the unbranded entity type from the SvelteKit app
		// (`lib/types.ts`), so the identities are re-minted on the way out. That
		// gap closes when #18 rebuilds the store on TanStack DB collections and the
		// entities can carry branded ids of their own.
		const weekdayKey = asWeekdayKey(w.day);
		const day = content.days.find((d) => d.k === weekdayKey);
		return {
			iso: w.at,
			dateLabel: displayDate(w.at),
			weekdayKey,
			weekdayLabel: day?.label ?? weekdayKey,
			dayType: day?.type ?? '',
			exercises: w.exercises.map((ex) => ({
				exerciseId: asExerciseId(ex.exId),
				name: ex.name,
				fields: fieldsFor(content.exercises[ex.exId]?.variants[0] ?? {}),
				sets: ex.sets,
			})),
			note: w.note,
			durationMin: w.durationMin ?? null,
			setCount: w.exercises.reduce((n, ex) => n + ex.sets.length, 0),
		};
	});

	return { readiness, sessions, activity: state.activity };
}

// ------------------------------------------------------------------ the module

/**
 * The whole prototype dataset, resolved against the active locale.
 *
 * `now` defaults to the wall clock so the history stays adjacent to whatever day
 * the prototype is opened on — a streak of zero and an empty "this week" card
 * would misrepresent the screens. Pass a fixed timestamp to freeze it.
 *
 * Call it once per render and read from the result. It is a snapshot, not a
 * store: hold your own state over it.
 */
export function getPrototypeFixtures(now: number = Date.now()): PrototypeFixtures {
	const content = getContent();
	const iso = isoDayOf(now);
	const exerciseIds = exerciseIdsFor(content, TODAY_WEEKDAY);
	const missed = resolveMissed(content, now);

	// Order matters. The history produces the load signals and the personal
	// baseline; those produce the verdict; the verdict decides which of today's
	// work is held back; and only then can today's own session be built, because
	// the athlete cannot have already trained something the plan withheld.
	const history = buildHistory(content, now, missed.daysAgo);
	const readinessLog = buildReadinessLog(now);
	// Insights read the history *behind* today, never today's own entry: the
	// calibration that shifts today's score cannot be derived from that score.
	const insights = readinessInsights(readinessLog);
	const load = {
		acwr: acwr(history, now)?.status ?? null,
		monotony: weekLoad(history, now)?.status === 'monotonous' ? ('high' as const) : null,
	};
	const readiness = computeReadiness(TODAY_ANSWERS, load, insights);
	const { keep } = capByVerdict(exerciseIds, readiness.verdict);

	const state: PrototypeFixtures['state'] = {
		workouts: [buildTodaySession(content, iso, exerciseIds, keep[0]), ...history],
		readinessLog,
		bodyweight: buildBodyweight(now),
		activity: buildActivity(content, now),
		deepLog: buildDeepLog(now),
	};

	return {
		today: buildToday(content, state, { iso, exerciseIds, readiness, insights, missed }),
		train: buildTrain(content, state, iso, exerciseIds),
		log: buildLog(content, state),
		state,
	};
}
