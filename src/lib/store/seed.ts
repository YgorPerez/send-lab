// The scenario the collections start out holding.
//
// WHY THERE IS A SEED AT ALL
// --------------------------
// `/api/state` is #57's, so nothing fetches an account yet. A store that starts
// empty would put three empty screens in front of the desktop work (#52) and the
// six page tickets, and would leave `tests/screens.test.ts` — the component
// vocabulary's delivery criterion — asserting nothing. So the collections are
// written once, when every one of them is empty, with the scenario the redesign
// prototypes were judged against: week 5 of an eight-week block, five weeks of
// history behind it, and a readiness check already answered.
//
// This is the last of `prototype-fixtures.ts`. What that module *derived* is now
// the read path (`store/record.ts`, `lib/screens/*`); what it **held** is here,
// and it is held as rows rather than rebuilt on every render. #57 replaces this
// file with the server's answer, and the read path above it does not change —
// which is the point of putting the seam at the collections.
//
// IT IS ACCOUNT STATE, NOT SCREEN CONTENT
// ---------------------------------------
// Nothing below hardcodes a verdict, a held exercise, a streak or a prescription.
// Those are computed by the real domain modules from these rows, so changing an
// answer moves the score, the verdict and which work is held exactly the way the
// app would. That was the prototypes' honesty requirement and it is a stronger
// requirement now: these rows are what the resolver reads.
//
// WHAT IS AND IS NOT LOCALE-DEPENDENT
// -----------------------------------
// Everything stored is an id, a number or an ISO date, so seeding under pt-BR and
// seeding under en-US produce byte-identical rows — with one deliberate
// exception. A session's `note` is athlete-typed free text, and free text is
// frozen in whatever language it was typed in; that is not ADR 0012's violation,
// it is what ADR 0012 distinguishes a stored label *from*. `store/prose.ts` holds
// both languages of it and `check:i18n` guards the parity.
//
// TODAY IS WHATEVER DAY IT IS
// ---------------------------
// The fixtures pinned "today" to Thursday's Pull day whatever weekday they were
// opened on, because four prototypes had to render the same screen to be
// comparable. A store cannot do that: showing Thursday's plan on a Saturday is a
// wrong answer, not a fixed one. Today's slot resolves from the real weekday, so
// on the scenario's rest day the screens correctly show a rest day.
import { type Answers, computeReadiness } from '$lib/content';
import type { Readiness } from '$lib/content/logic';
import type { Content, Variant } from '$lib/content/types';
import { isoDayOf } from '$lib/dates';
import {
	asWeekId,
	type ExerciseId,
	taskKey,
	type WeekdayKey,
	type WeekId,
	weekdayKeyOf,
} from '$lib/ids';
import { prefilledSet } from '$lib/loggedSet';
import { type ResolverState, resolveDayType, trainableExerciseIds } from '$lib/prescription';
import { capByVerdict } from '$lib/readinessPlan';
import { acwr, readinessInsights, weekLoad } from '$lib/stats';
import type {
	Baseline,
	BodyweightReading,
	LoggedReadinessCheck,
	LoggedSet,
	Program,
	SelfCheck,
	Session,
} from '$lib/types';
import type { RecordStore, TaskDoneRow } from './collections';
import { SINGLETON_KEY } from './collections';
import { SEED_PROSE } from './prose';

// ---------------------------------------------------------------- the scenario

/** Week 5 of an eight-week block: far enough in that progression has moved the
 *  prescribed numbers, with a deload still ahead. */
const CURRENT_WEEK = 5;
const CURRENT_WEEK_ID = asWeekId(CURRENT_WEEK);
const BLOCK_WEEKS = 8;

/** Today's readiness answers. Values are the option values from `content.quiz`,
 *  and the verdict they produce is computed rather than chosen. */
const TODAY_ANSWERS: Answers = {
	sleep: 7,
	fatigue: 7,
	soreness: 7,
	body: 1,
	severity: 1,
	area: 0,
	illness: 0,
	time: 10,
};

/** Readiness scores for the fourteen days behind today, oldest first. */
const HISTORY_SCORES = [68, 74, 66, 78, 72, 58, 70, 76, 69, 73, 71, 67, 75, 70];

/** Post-session outcomes, by index into `HISTORY_SCORES`. Four is the threshold
 *  at which calibration stops being a heuristic, so four are recorded. */
const HISTORY_OUTCOMES: Record<number, number> = { 4: 2, 6: 2, 8: 2, 9: 2 };

/** How far back the session history runs — three weeks plus, so the workload
 *  ratio has both a recent and a longer-run window to read. */
const HISTORY_DAYS = 35;

/** Days in that window with no session, counted back from today. Rest days are
 *  skipped on their own, by having no scheduled work. */
const SKIPPED_DAYS_AGO = new Set([9, 17]);

const BODYWEIGHT_KG = [72.4, 72.1, 71.8, 72.0, 71.6, 71.5, 71.9];

/** The athlete behind the scenario. Only `level` is read by the resolver, and it
 *  is what scales how fast the prescribed load climbs (`progression.ts`). */
const SCENARIO_BASELINE: Baseline = {
	goal: 'all',
	focus: 'fingers',
	level: 'advanced',
	daysPerWeek: 6,
	bodyweight: BODYWEIGHT_KG[0],
	equipment: ['hangboard', 'board', 'rings', 'weights'],
	boulderGrade: 'V8',
	routeGrade: '7c',
	niggle: false,
	synovitis: false,
	birthDate: null,
	sessionMinutes: 75,
	completedAt: '2026-07-01',
};

/** An eight-week block with auto-progression on and nothing customized, so what
 *  the screens show is the *built-in* program progressed to week 5 rather than a
 *  set of hand-picked numbers. */
const SCENARIO_PROGRAM: Program = {
	weeks: BLOCK_WEEKS,
	template: {},
	overrides: {},
	phases: [],
	autoProgress: true,
};

// ----------------------------------------------------------------- the rows

/** Every row the scenario writes, one field per collection. */
export interface SeedRows {
	currentWeek: number;
	program: Program;
	baseline: Baseline;
	sessions: Session[];
	taskDone: TaskDoneRow[];
	readinessLog: LoggedReadinessCheck[];
	bodyweight: BodyweightReading[];
	selfCheckLog: SelfCheck[];
}

const DAY_MS = 86_400_000;

const isoDaysAgo = (now: number, n: number): string => isoDayOf(now - n * DAY_MS);

/** Athlete-typed free text, in the locale it is being written in.
 *
 *  The locale is threaded down rather than read from `getLocale()` here, for the
 *  reason #56 made `getContent` take one: a function that reads the ambient
 *  locale is not a pure function of its arguments, whatever its signature says. */
function prose(locale: string, key: string): string {
	return SEED_PROSE[locale]?.[key] ?? SEED_PROSE['en-US'][key] ?? '';
}

/** Deterministic variation, so a logged history reads like a person trained it
 *  rather than like a loop wrote it. No `Math.random()`: a scenario that differs
 *  between two seedings cannot be reasoned about. */
const jitter = (seed: number, spread: number): number => ((seed * 37) % (spread * 2 + 1)) - spread;

/** A set as it was logged: the prescription's midpoints, nudged, and done. */
function loggedSet(prescription: Variant, seed: number): LoggedSet {
	const s = prefilledSet(prescription);
	if (s.loadKg != null) s.loadKg = Math.max(0, s.loadKg + jitter(seed, 2));
	if (s.reps != null) s.reps = Math.max(1, s.reps + jitter(seed, 1));
	if (s.rpe != null) s.rpe = Math.min(10, Math.max(4, s.rpe + jitter(seed + 1, 1)));
	s.done = true;
	return s;
}

/**
 * Enough state to resolve *what* a slot runs, before any history exists.
 *
 * The plan half of the account decides that on its own — no sessions, no ticks —
 * which is what lets the scenario ask the real resolver which exercises a weekday
 * schedules while it is still building the sessions that answer would go into.
 */
function planOnly(week: WeekId): ResolverState {
	return {
		currentWeek: week,
		program: SCENARIO_PROGRAM,
		swaps: {},
		slotDayType: {},
		slotExercises: {},
		taskSwaps: {},
		taskDone: {},
		sessions: [],
		baseline: SCENARIO_BASELINE,
	};
}

/** The scheduled, trainable exercises a weekday runs in this scenario.
 *
 *  Asked of the resolver rather than read off `content.days[].ex`: `rest` is a
 *  real entry in the exercise library, and a filter that keeps everything the
 *  library knows keeps it — which is how five rest days were once logged as
 *  sessions (#69). */
function scheduledFor(content: Content, week: WeekId, weekday: WeekdayKey): ExerciseId[] {
	return trainableExerciseIds(content, planOnly(week), week, weekday);
}

/** The sessions behind today.
 *
 *  Dates are real: the stat cards and the workload ratio read the wall clock, so
 *  a history shifted off it would report a broken streak and an empty week. Each
 *  past day runs whatever day type its own weekday prescribes. */
function history(content: Content, locale: string, now: number, missedDaysAgo: number): Session[] {
	const out: Session[] = [];
	const noteKeys = ['note_strong', 'note_skin', 'note_short', 'note_elbow'];
	let logged = 0;

	for (let ago = HISTORY_DAYS; ago >= 1; ago--) {
		if (ago === missedDaysAgo || SKIPPED_DAYS_AGO.has(ago)) continue;
		const at = isoDaysAgo(now, ago);
		const weekday = weekdayKeyOf(at);
		const scheduled = scheduledFor(content, CURRENT_WEEK_ID, weekday);
		if (scheduled.length === 0) continue; // a rest day is never a session

		const exercises = scheduled.map((exercise, i) => {
			const prescription = content.exercises[exercise].variants[0];
			const planned = Math.min(4, Math.max(1, prescription.sets?.min ?? 3));
			return {
				exercise,
				// The history logs each exercise's default variant. The label is derived
				// from this index at render (ADR 0012) — nothing here stores a name.
				variant: 0,
				sets: Array.from({ length: planned }, (_, k) => loggedSet(prescription, ago + i + k)),
			};
		});

		out.push({
			at,
			weekday,
			// What that weekday actually ran, asked of the resolver rather than of
			// the built-in week — the scenario's program is what the history was
			// trained against.
			dayType: resolveDayType(content, planOnly(CURRENT_WEEK_ID), CURRENT_WEEK_ID, weekday),
			exercises,
			// Roughly one session in four carries a note the athlete typed.
			note: logged % 4 === 1 ? prose(locale, noteKeys[logged % noteKeys.length]) : '',
			durationMin: 45 + ((ago * 7) % 30),
		});
		logged += 1;
	}
	// Newest first, the order the log screen reads in.
	return out.reverse();
}

/**
 * The training day that went untrained and is offered again today.
 *
 * Yesterday, and only yesterday — the same day `missedYesterday` looks at, so the
 * day the scenario leaves untrained is the day Today offers back. Null when
 * yesterday was a rest day, which is the honest answer: a rest day scheduled
 * nothing to miss.
 */
function missedDay(content: Content, now: number): { daysAgo: number } | null {
	const weekday = weekdayKeyOf(isoDaysAgo(now, 1));
	const scheduled = scheduledFor(content, CURRENT_WEEK_ID, weekday);
	return scheduled.length > 0 ? { daysAgo: 1 } : null;
}

/** Today, opened mid-session: one exercise has a set done and the next staged,
 *  the rest sit prefilled and untouched. The focus exercise is the first one the
 *  verdict *kept* — training work the same screen is holding back would
 *  contradict the plan it is showing. */
function todaySession(
	content: Content,
	at: string,
	weekday: WeekdayKey,
	scheduled: ExerciseId[],
	focus: ExerciseId | undefined,
): Session {
	const exercises = scheduled.map((exercise) => {
		const prescription = content.exercises[exercise].variants[0];
		const sets =
			exercise === focus
				? [prefilledSet(prescription), prefilledSet(prescription)]
				: [prefilledSet(prescription)];
		if (exercise === focus) {
			sets[0].done = true;
			sets[0].rpe = sets[0].rpe ?? 7;
		}
		return { exercise, variant: 0, sets };
	});
	return {
		at,
		weekday,
		dayType: resolveDayType(content, planOnly(CURRENT_WEEK_ID), CURRENT_WEEK_ID, weekday),
		exercises,
		note: '',
		durationMin: 22,
	};
}

function readinessHistory(now: number): LoggedReadinessCheck[] {
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
		const at = isoDaysAgo(now, HISTORY_SCORES.length - i);
		const answers = answersFor(score);
		const readiness = computeReadiness(answers);
		const outcome = HISTORY_OUTCOMES[i];
		return {
			// 07:40-ish, before training. Epoch ms, never a formatted string.
			at: new Date(`${at}T07:40:00`).getTime() + (i % 5) * 6 * 60_000,
			verdict: readiness.verdict,
			score,
			answers,
			flags: readiness.flags.map((f) => ({
				id: f.id,
				severity: f.severity,
				...(f.area ? { area: f.area } : {}),
			})),
			...(outcome != null ? { outcome } : {}),
		} satisfies LoggedReadinessCheck;
	});
}

function bodyweightHistory(now: number): BodyweightReading[] {
	return BODYWEIGHT_KG.map((kg, i) => {
		// Roughly every five days, and deliberately not today — the nudge on Today
		// only shows when today has no reading.
		const at = isoDaysAgo(now, (BODYWEIGHT_KG.length - i) * 5);
		return { kg, at: new Date(`${at}T08:00:00`).getTime() };
	});
}

function selfCheckHistory(now: number): SelfCheck[] {
	const at = isoDaysAgo(now, 11);
	// Banded by `scoreSelfCheck`: 74 falls in the middle band, which routes rehab
	// to the subacute stage rather than to a full stop.
	return [
		{ at: new Date(`${at}T09:00:00`).getTime(), area: 'fingers', score: 74, band: 'moderate' },
	];
}

/** This morning's readiness check, as it was logged: answered before training,
 *  with the verdict it actually produced. */
function todayCheck(now: number, readiness: Readiness): LoggedReadinessCheck {
	return {
		at: new Date(`${isoDayOf(now)}T07:40:00`).getTime(),
		verdict: readiness.verdict,
		score: readiness.score,
		answers: TODAY_ANSWERS,
		flags: readiness.flags.map((f) => ({
			id: f.id,
			severity: f.severity,
			...(f.area ? { area: f.area } : {}),
		})),
	};
}

/**
 * The whole scenario, as rows.
 *
 * Order matters and is the same order the app itself decides in: the history
 * produces the load signals and the personal baseline; those produce today's
 * verdict; the verdict decides which of today's work is held back; and only then
 * can today's own session be built, because the athlete cannot already have
 * trained something the plan withheld.
 */
export function scenarioRows(content: Content, locale: string, now: number): SeedRows {
	const at = isoDayOf(now);
	const weekday = weekdayKeyOf(at);
	const scheduled = scheduledFor(content, CURRENT_WEEK_ID, weekday);
	const missed = missedDay(content, now);

	const past = history(content, locale, now, missed?.daysAgo ?? -1);
	const behind = readinessHistory(now);
	// Insights read the checks *behind* today, never today's own entry: the
	// calibration that shifts today's score cannot be derived from that score.
	const insights = readinessInsights(behind);
	const readiness = computeReadiness(
		TODAY_ANSWERS,
		{
			acwr: acwr(past, now)?.status ?? null,
			monotony: weekLoad(past, now)?.status === 'monotonous' ? 'high' : null,
		},
		insights,
	);
	const { keep } = capByVerdict(scheduled, readiness.verdict);

	const today = todaySession(content, at, weekday, scheduled, keep[0]);

	// Today's ticks, keyed the way ADR-0001 says completion is keyed, and derived
	// from today's own session so the tasks on Today and the adherence the
	// resolver reads cannot disagree about what was trained. Earlier weeks are
	// left unticked deliberately: `adherenceRatio` scores an untracked week as
	// **1**, so they carry full progression credit rather than reading as four
	// missed weeks.
	const taskDone: TaskDoneRow[] = today.exercises
		.filter((logged) => logged.sets.some((set) => set.done))
		.map((logged) => ({
			task: taskKey(CURRENT_WEEK_ID, weekday, logged.exercise),
			done: true,
		}));

	return {
		currentWeek: CURRENT_WEEK,
		program: SCENARIO_PROGRAM,
		baseline: SCENARIO_BASELINE,
		// Today first: the log screen reads newest first, and the store keys by
		// date rather than by position, so this order is for the reader only.
		sessions: scheduled.length ? [today, ...past] : past,
		taskDone,
		// This morning's check is in the log with the rest of them: the athlete
		// answered it, so it is history like any other, and Today reads it back
		// rather than being handed a set of answers from nowhere. Its verdict is
		// stored as computed — with the load signals and the calibration — so the
		// record agrees with what the screen shows.
		readinessLog: [...behind, todayCheck(now, readiness)],
		bodyweight: bodyweightHistory(now),
		selfCheckLog: selfCheckHistory(now),
	};
}

/** Whether a store holds nothing at all. Every collection, not a representative
 *  one: an athlete who has deleted all their sessions still has a baseline, and
 *  re-seeding on top of them would be the worst bug this file could have. Written
 *  over the store's own values so a sixteenth collection is covered by existing
 *  rather than by remembering. */
function isEmpty(store: RecordStore): boolean {
	return Object.values(store).every((collection) => collection.size === 0);
}

/**
 * Write the scenario into a store that holds nothing, and report whether it did.
 *
 * Idempotent by that check alone — call it on every store creation and it runs
 * once per browser. `rehab`, `prefs` and `savedPrograms` are seeded empty on
 * purpose: no rehab block is running, the preferences default to following the
 * device, and the athlete has saved no programs.
 */
export function seedRecordStore(
	store: RecordStore,
	content: Content,
	locale: string,
	now: number,
): boolean {
	if (!isEmpty(store)) return false;
	const rows = scenarioRows(content, locale, now);

	store.currentWeek.insert({ id: SINGLETON_KEY, week: asWeekId(rows.currentWeek) });
	store.program.insert({ id: SINGLETON_KEY, program: rows.program });
	store.baseline.insert({ id: SINGLETON_KEY, baseline: rows.baseline });
	if (rows.sessions.length) store.sessions.insert(rows.sessions);
	if (rows.taskDone.length) store.taskDone.insert(rows.taskDone);
	if (rows.readinessLog.length) store.readinessLog.insert(rows.readinessLog);
	if (rows.bodyweight.length) store.bodyweight.insert(rows.bodyweight);
	if (rows.selfCheckLog.length) store.selfCheckLog.insert(rows.selfCheckLog);
	return true;
}
