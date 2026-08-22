// What Today reads.
//
// The screen decides whether to train and what to train, so this resolves the
// two halves it decides from — the plan (which tasks, in which slot, held back by
// what) and the evidence (the load behind today, the athlete's own calibration,
// the counters and the trend). It does **not** decide: `computeReadiness` is
// re-run live in the route against whatever the check currently says, so changing
// an answer moves the score, the verdict and which work is held.
//
// The inputs it hands over rather than the answers it could have computed are the
// point. `load` and `insights` are here because the route needs *the same* two
// signals the store's own history produced — and because both read the history
// **behind** today: a session logged today cannot be part of the load that
// decided whether to train today, and the calibration that shifts today's score
// cannot come from that score.
//
// This was `buildToday` in `prototype-fixtures.ts`, which built it out of a
// hand-written snapshot. The shape it hands over is much smaller now: the fixture
// served four prototype branches that each rendered a different subset, and this
// serves one screen.
import { type Answers, phaseId, visibleQuestionsOrdered } from '$lib/content';
import type { LoadSignals } from '$lib/content/logic';
import type {
	BodyArea,
	Content,
	Day,
	PhaseId,
	SelfCheckInstrument,
	VerdictId,
} from '$lib/content/types';
import { isoDayOf } from '$lib/dates';
import { displayDate } from '$lib/displayDate';
import { weekdayLabel } from '$lib/format';
import type { ExerciseId, TaskKey, WeekdayKey, WeekId } from '$lib/ids';
import { taskKey, weekdayKeyOf, weekNumberOf } from '$lib/ids';
import { missedYesterday, resolveDay, trainableExerciseIds } from '$lib/prescription';
import { capByVerdict } from '$lib/readinessPlan';
import {
	acwr,
	completedSessions,
	type ReadinessInsights,
	readinessInsights,
	sessionsLast7,
	trainStreak,
	weekLoad,
} from '$lib/stats';
import type { TrainingRecord } from '$lib/store/account';
import type { BodyweightReading, SelfCheck } from '$lib/types';

/** One exercise as it appears in today's slot — the unit the athlete ticks off. */
export interface Task {
	/** What completion is recorded against (ADR-0001). Unique across slots, which
	 *  an exercise id alone is not: the same exercise appears in several weekdays
	 *  of a block, and keying a tick by exercise would tick all of them. */
	key: TaskKey;
	exercise: ExerciseId;
	label: string;
	done: boolean;
}

/** One readiness question as the check renders it, in display order. Follow-ups
 *  carry `sub` and sit directly under the core question that revealed them. */
export interface Question {
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

export interface TrendPoint {
	value: number;
	label: string;
}

/** Scheduled work that went untrained, offered again today. */
export interface CarryForward {
	weekday: WeekdayKey;
	weekdayLabel: string;
	exercises: ExerciseId[];
	labels: string[];
}

export interface TodayScreen {
	/** ISO calendar date. The identity; `dateLabel` is for display only. */
	iso: string;
	dateLabel: string;
	weekday: WeekdayKey;
	weekdayLabel: string;
	week: WeekId;
	weekNumber: number;
	/** The block phase this week falls in, localized. */
	phase: Content['phases'][PhaseId];
	/** Today's day type — category, primary and secondary focus, load label. */
	day: Day;
	tasks: Task[];
	/** Nothing is scheduled today. A rest day is a real answer, not an empty
	 *  screen: it never counts against adherence and it is what the athlete came
	 *  to find out. */
	isRestDay: boolean;
	/** This morning's answers, as logged. Empty when today has no check yet. */
	answers: Answers;
	/** The objective signals behind the verdict, from the history *behind* today. */
	load: LoadSignals;
	/** The athlete's own calibration, from the checks *behind* today. */
	insights: ReadinessInsights;
	/** Whether the score note reads as a reasoned default or as personalized. */
	scoreNote: 'heuristic' | 'tuned';
	/** The fourteen checks before today, for the trend chart. */
	trendPoints: TrendPoint[];
	stats: { streak: number; last7: number; total: number };
	bodyweight: {
		series: readonly BodyweightReading[];
		latestKg: number | null;
		/** Nothing logged today, so the nudge is showing (ADR 0009). */
		promptToday: boolean;
	};
	missed: CarryForward | null;
	/** The injury self-check reachable from a body-area flag, and its last result.
	 *
	 *  Null when the library has no instrument to offer. `content.selfChecks` is
	 *  `Partial` on purpose — three of the four body areas have a validated
	 *  instrument and the wrist has none (#71) — and ADR 0013 is explicit that the
	 *  gap is to stay visible rather than be asserted away, so this is `| null`
	 *  rather than a cast. */
	selfCheck: { area: BodyArea; instrument: SelfCheckInstrument; last: SelfCheck | null } | null;
}

/** How many outcomes it takes before the score note stops calling itself a
 *  heuristic. Matches the threshold `readinessInsights` calibrates at. */
const TUNED_AFTER = 4;

/** Which body area Today's self-check entry offers, in preference order. Fingers
 *  first — it is the area this app exists around — and the rest behind it so a
 *  library that drops an instrument degrades to the next one rather than to
 *  nothing. The wrist is absent from the library's instruments, not from here
 *  (#71). */
const AREA_PREFERENCE: readonly BodyArea[] = ['fingers', 'elbow', 'shoulder', 'wrist'];

/**
 * Everything Today reads, resolved against the record.
 *
 * `now` is an argument rather than a call to the wall clock so a test can pin the
 * day, and so the whole screen is a pure function of `(content, record, now)`.
 */
export function resolveToday(content: Content, record: TrainingRecord, now: number): TodayScreen {
	const iso = isoDayOf(now);
	const weekday = weekdayKeyOf(iso);
	const week = record.currentWeek;
	const weekNumber = weekNumberOf(week);
	const scheduled = trainableExerciseIds(content, record, week, weekday);

	// The history behind today. Both of these deliberately exclude today's own
	// entry — see the note at the top of the file.
	const behind = record.sessions.filter((s) => s.at !== iso);
	const checksBehind = record.readinessLog.filter((r) => isoDayOf(r.at) !== iso);
	const insights = readinessInsights([...checksBehind]);

	const todayCheck = record.readinessLog.find((r) => isoDayOf(r.at) === iso);
	const todaySession = record.sessions.find((s) => s.at === iso);
	const doneExercises = new Set(
		(todaySession?.exercises ?? [])
			.filter((e) => e.sets.some((set) => set.done))
			.map((e) => e.exercise),
	);

	const tasks: Task[] = scheduled.map((exercise) => ({
		key: taskKey(week, weekday, exercise),
		exercise,
		label: content.exercises[exercise].name,
		done: record.taskDone[taskKey(week, weekday, exercise)] ?? doneExercises.has(exercise),
	}));

	const missed = missedYesterday(content, record, now);
	const latestBodyweight = record.bodyweight[record.bodyweight.length - 1] ?? null;

	return {
		iso,
		dateLabel: displayDate(iso),
		weekday,
		weekdayLabel: weekdayLabel(content, weekday),
		week,
		weekNumber,
		phase: content.phases[phaseId(weekNumber, record.program.weeks)],
		day: resolveDay(content, record, week, weekday),
		tasks,
		isRestDay: tasks.length === 0,
		answers: todayCheck?.answers ?? {},
		load: {
			acwr: acwr([...behind], now)?.status ?? null,
			monotony: weekLoad([...behind], now)?.status === 'monotonous' ? 'high' : null,
		},
		insights,
		scoreNote:
			checksBehind.filter((e) => e.outcome != null).length >= TUNED_AFTER ? 'tuned' : 'heuristic',
		trendPoints: checksBehind
			.slice(-14)
			.map((e) => ({ value: e.score, label: displayDate(isoDayOf(e.at)) })),
		stats: {
			streak: trainStreak([...record.sessions]),
			last7: sessionsLast7([...record.sessions]),
			total: completedSessions([...record.sessions]),
		},
		bodyweight: {
			series: record.bodyweight,
			latestKg: latestBodyweight?.kg ?? null,
			promptToday: !record.bodyweight.some((b) => isoDayOf(b.at) === iso),
		},
		missed: missed
			? {
					weekday: missed.weekday,
					weekdayLabel: weekdayLabel(content, missed.weekday),
					exercises: missed.exerciseIds,
					labels: missed.exerciseIds.map((id) => content.exercises[id]?.name ?? id),
				}
			: null,
		selfCheck: selfCheckEntry(content, record),
	};
}

/** The injury entry point, and the last result behind it.
 *
 *  Walks the preference order and takes the first area the library actually has
 *  an instrument for, so the instrument is *found* rather than asserted — the
 *  narrowing is what makes the `Partial` lookup safe, which is the whole of
 *  ADR 0013's argument. Null when it has none at all. */
function selfCheckEntry(content: Content, record: TrainingRecord): TodayScreen['selfCheck'] {
	for (const area of AREA_PREFERENCE) {
		const instrument = content.selfChecks[area];
		if (!instrument) continue;
		return { area, instrument, last: record.selfCheckLog.find((c) => c.area === area) ?? null };
	}
	return null;
}

/**
 * The readiness check as it renders, in display order.
 *
 * Rebuilt from `visibleQuestionsOrdered` on every call rather than resolved once,
 * because follow-ups appear and disappear as the core answers change — a frozen
 * list would keep asking a question the athlete's last answer withdrew.
 */
export function resolveQuestions(content: Content, answers: Answers): Question[] {
	return visibleQuestionsOrdered(answers).map(({ id, sub }) => {
		const q = content.quiz.find((x) => x.id === id);
		return {
			id,
			sub,
			question: q?.q ?? id,
			...(q?.why ? { why: q.why } : {}),
			...(q?.study ? { study: q.study } : {}),
			options: (q?.a ?? []).map((o) => ({ label: o.t, value: o.v })),
			answer: answers[id] ?? null,
		};
	});
}

/** Which of today's tasks the verdict holds back. Held, not cancelled: they
 *  resurface as carry-forward on the next training day. */
export function heldExercises(tasks: readonly Task[], verdict: VerdictId): ReadonlySet<ExerciseId> {
	return new Set(
		capByVerdict(
			tasks.map((t) => t.exercise),
			verdict,
		).held,
	);
}
