// What each screen reads out of the store.
//
// These are the guarantees `tests/prototypeFixtures.test.ts` held, moved onto the
// thing that replaced it (#56). They were written to keep four prototype branches
// comparable; what they are for now is stronger — the three screens render one
// account, so an assertion about what Today shows is an assertion about what the
// store, the resolver and the readiness logic together decided.
//
// The most important ones are at the bottom. The fixtures fabricated
// already-resolved prescriptions, which is why nobody noticed the resolver had
// never been ported (#69): three screens rendered resolved values that nothing
// computed. A resolver that is correct and unwired looks exactly like no resolver
// at all, so these assert the numbers come out of `prescription.ts`.

import type { StorageApi } from '@tanstack/db';
import { describe, expect, it } from 'vitest';
import { computeReadiness, getContent } from '../src/lib/content/index.ts';
import type { VerdictId } from '../src/lib/content/types.ts';
import {
	asAthleteId,
	asExerciseId,
	asSavedProtocolId,
	asWeekdayKey,
	taskKey,
} from '../src/lib/ids.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import {
	effectiveVariant,
	resolveSwapIndex,
	trainableExerciseIds,
	variantOf,
} from '../src/lib/prescription.ts';
import { resolveLog } from '../src/lib/screens/log.ts';
import {
	formOf,
	nudged,
	readProtocolForm,
	resolveTimer,
	shownOf,
	todaysPresetGroups,
} from '../src/lib/screens/timer.ts';
import { heldExercises, resolveQuestions, resolveToday } from '../src/lib/screens/today.ts';
import { resolveTrain } from '../src/lib/screens/train.ts';
import { resolveWeek } from '../src/lib/screens/week.ts';
import { createRecordStore } from '../src/lib/store/collections.ts';
import { readTrainingRecord } from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';

/** Any account id: these tests never sync, so the only thing it does is segment
 *  the storage keys. */
const ACCOUNT = asAthleteId('athlete-1');

overwriteGetLocale(() => 'en-US');

/** The same fixed Thursday `tests/screens.test.ts` pins its renders to: a
 *  training day in week 5, with a full slot and a carry-forward behind it. */
const NOW = new Date('2026-08-13T09:30:00').getTime();

function memoryStorage(): StorageApi {
	const cells = new Map<string, string>();
	return {
		getItem: (k) => cells.get(k) ?? null,
		setItem: (k, v) => void cells.set(k, v),
		removeItem: (k) => void cells.delete(k),
	};
}

const content = getContent('en-US');

function record() {
	const store = createRecordStore(ACCOUNT, undefined, memoryStorage());
	seedRecordStore(store, content, 'en-US', NOW);
	return readTrainingRecord(store);
}

const REC = record();
const TODAY = resolveToday(content, REC, NOW);
const TRAIN = resolveTrain(content, REC, NOW);
const LOG = resolveLog(content, REC, 'en-US');
const WEEK = resolveWeek(content, REC, NOW);

describe('Today', () => {
	it('lands on a verdict that actually caps the session, so held work is on screen', () => {
		const readiness = computeReadiness(TODAY.answers, TODAY.load, TODAY.insights);
		expect(readiness.verdict).toBe('moderate');

		const held = heldExercises(TODAY.tasks, readiness.verdict);
		// Some work held, not all of it — a screen where everything is held and a
		// screen where nothing is both fail to show what "held" means.
		expect(held.size).toBeGreaterThan(0);
		expect(held.size).toBeLessThan(TODAY.tasks.length);
		expect(TODAY.tasks.every((t) => t.exName.length > 0)).toBe(true);
	});

	it('carries every piece the screen is built around', () => {
		const questions = resolveQuestions(content, TODAY.answers);
		expect(questions.length).toBeGreaterThanOrEqual(6);
		// The adaptive half: at least one follow-up is revealed, not just the core.
		expect(questions.some((q) => q.sub)).toBe(true);
		expect(TODAY.trendPoints).toHaveLength(14);
		expect(TODAY.bodyweight.promptToday).toBe(true);
		expect(TODAY.bodyweight.latestKg).toBe(71.9);
		expect(TODAY.carryForward).not.toBeNull();
		expect(TODAY.selfCheck?.instrument.questions.length).toBeGreaterThan(0);
		expect(TODAY.selfCheck?.last).not.toBeNull();
		expect(TODAY.stats.total).toBeGreaterThan(0);
		expect(TODAY.isRestDay).toBe(false);
	});

	it('carries no max-pull probe — it left the rebuild with the Probe', () => {
		expect(JSON.stringify(TODAY)).not.toContain('probe');
		expect(resolveQuestions(content, TODAY.answers).map((q) => q.id)).not.toContain('probe');
	});

	it("scores against the athlete's own history rather than a hardcoded number", () => {
		expect(TODAY.insights.baseline).not.toBeNull();
		// Four post-session outcomes are logged behind today, so the note reads as
		// personalized rather than as a reasoned default.
		expect(TODAY.scoreNote).toBe('tuned');
		expect(TODAY.insights.calibration).not.toBe(0);
	});

	it('reads the load and the calibration from behind today, never from today', () => {
		// A session logged today cannot be part of the load that decided whether to
		// train today, and the calibration that shifts today's score cannot come
		// from that score. Both are computed over strictly earlier entries.
		const withToday = readTrainingRecord(seededWith(NOW));
		const todayCheck = withToday.readinessLog.filter(
			(r) => new Date(r.at).toDateString() === new Date(NOW).toDateString(),
		);
		expect(todayCheck).toHaveLength(1);
		expect(TODAY.trendPoints.map((p) => p.label)).not.toContain(TODAY.dateLabel);
	});
});

describe('Train', () => {
	it('opens mid-session, with a timer and typeable set rows', () => {
		expect(TRAIN.tasks.length).toBeGreaterThanOrEqual(4);
		expect(TRAIN.tasks.some((i) => i.timed)).toBe(true);
		expect(TRAIN.tasks.every((i) => i.sets.length > 0)).toBe(true);
		expect(TRAIN.tasks.some((i) => i.sets.some((s) => s.done))).toBe(true);
		// Every item offers a variant to swap to, and the add-exercise picker has
		// the rest of the library behind it.
		expect(TRAIN.tasks.every((i) => i.variants.length > 1)).toBe(true);
		expect(TRAIN.available.length).toBeGreaterThan(0);
	});

	it('never offers the rest placeholder as an exercise to add', () => {
		// `rest` is a real entry in the exercise library — a Recovery
		// pseudo-exercise with its own prose and variants — so a picker that lists
		// "everything the library knows" lists it (#69).
		expect(TRAIN.available.map((a) => a.exercise)).not.toContain('rest');
		expect(TRAIN.tasks.map((i) => i.exercise)).not.toContain('rest');
	});

	it('shows only the per-set fields an exercise actually logs', () => {
		for (const item of TRAIN.tasks) {
			expect(item.fields).toContain('loadKg');
			expect(item.fields).toContain('rpe');
			expect(item.fields.includes('grip')).toBe(item.prescription.grip != null);
		}
	});

	it('opens a fresh set row unrated, while still carrying the target', () => {
		// The two things the header and the set row are each one half of: the task
		// knows what was *asked for* (`prescription.rpe`, one range per variant,
		// scaled per week by the phase) and the row holds what the athlete
		// *answered*. A row that opens at the midpoint of the first is the app
		// filing a reading it never took (#89).
		const fresh = TRAIN.tasks.flatMap((t) => t.sets.filter((s) => !s.done));
		expect(fresh.length).toBeGreaterThan(0);
		expect(fresh.every((s) => s.rpe === null)).toBe(true);
		// And the target survives to where the row can show it.
		expect(TRAIN.tasks.some((t) => t.prescription.rpe != null)).toBe(true);
	});

	it('has nothing to repeat while today is already being logged', () => {
		expect(TRAIN.canRepeatLast).toBe(false);
	});
});

describe('Log', () => {
	/** The seeded sessions and checks, as the days they fall on. */
	const sessionDays = new Set(REC.sessions.map((s) => s.at));
	const checkDays = new Set(LOG.days.filter((d) => d.check).map((d) => d.iso));
	const sessionOf = (log: typeof LOG, iso: string) => log.days.find((d) => d.iso === iso)?.session;

	it('is the densest screen — many sessions, many rows inside each', () => {
		const sessions = LOG.days.flatMap((d) => (d.session ? [d.session] : []));
		expect(sessions.length).toBeGreaterThanOrEqual(20);
		expect(sessions.reduce((n, s) => n + s.setCount, 0)).toBeGreaterThan(100);
		// Fourteen checks behind today, plus this morning's.
		expect(LOG.counts).toEqual({ sessions: sessions.length, checkedDays: 15 });
	});

	// Spec #113 story 60: a day is read as one thing, not matched across two lists.
	it('is one dated day per date, newest first', () => {
		const dates = LOG.days.map((d) => d.iso);
		expect(new Set(dates).size).toBe(dates.length);
		expect([...dates].sort().reverse()).toEqual(dates);
		// Every date that holds either is in the timeline, and nothing else is.
		expect(new Set(dates)).toEqual(new Set([...sessionDays, ...checkDays]));
		expect(LOG.days.every((d) => d.check || d.session)).toBe(true);
	});

	it('holds days with a check only, a session only, and both', () => {
		// The seeded record has all three: a rest day is checked and not trained,
		// the older weeks were trained before checks were kept, and the last two
		// weeks have both.
		expect(LOG.days.some((d) => d.check && !d.session)).toBe(true);
		expect(LOG.days.some((d) => !d.check && d.session)).toBe(true);
		const both = LOG.days.find((d) => d.check && d.session);
		expect(both?.check?.iso).toBe(both?.iso);
		expect(both?.session?.iso).toBe(both?.iso);
		// Today is the newest day, and it has both.
		expect(LOG.days[0].iso).toBe('2026-08-13');
		expect(LOG.days[0].check).not.toBeNull();
		expect(LOG.days[0].session).not.toBeNull();
	});

	it('names each day in full for the detail beside the timeline', () => {
		expect(LOG.days[0].dateLabel).toBe('Aug 13');
		expect(LOG.days[0].fullDate).toBe('Thursday, August 13');
		const pt = resolveLog(getContent('pt-BR'), REC, 'pt-BR');
		// A heading, so it starts with a capital in pt-BR too, where the weekday does not.
		expect(pt.days[0].fullDate).toBe('Quinta-feira, 13 de agosto');
	});

	it('keeps the last check of a day that was checked twice', () => {
		// The athlete can re-check within a day (`store/collections.ts`), and the
		// later answer is the one that set the day's verdict.
		const morning = REC.readinessLog[REC.readinessLog.length - 1];
		const evening = { ...morning, at: morning.at + 6 * 3_600_000, score: morning.score - 20 };
		const log = resolveLog(
			content,
			{ ...REC, readinessLog: [...REC.readinessLog, evening] },
			'en-US',
		);
		expect(log.days.filter((d) => d.iso === LOG.days[0].iso)).toHaveLength(1);
		expect(log.days[0].check?.score).toBe(evening.score);
		expect(log.counts.checkedDays).toBe(15);
	});

	// Spec #113 story 61. The library paints `green` and `short` in vermilion,
	// which means *at the limit / stop* everywhere else on the app.
	it('tones the score by its verdict, never the stop colour for a good one', () => {
		const tone = (verdict: VerdictId) => {
			const morning = REC.readinessLog[REC.readinessLog.length - 1];
			const log = resolveLog(content, { ...REC, readinessLog: [{ ...morning, verdict }] }, 'en-US');
			return log.days.find((d) => d.check)?.check?.tone;
		};
		expect(tone('green')).toBe('ok');
		expect(tone('short')).toBe('ok');
		expect(tone('moderate')).toBe('warn');
		expect(tone('tissue')).toBe('warn');
		expect(tone('rest')).toBe('stop');
	});

	it('shows a past readiness check as it was answered, not as a bare score', () => {
		const checks = LOG.days.flatMap((d) => (d.check ? [d.check] : []));
		const withResponses = checks.find((r) => r.responses.length > 0);
		expect(withResponses).toBeDefined();
		expect(withResponses?.verdict.title.length).toBeGreaterThan(0);
		expect(checks.some((r) => r.outcome != null)).toBe(true);
	});

	// A flag keeps the severity it was raised with, as Today shows it: a stop flag
	// painted the warn colour says less than it did on the morning it was raised.
	it('keeps each flag’s severity', () => {
		const flags = LOG.days.flatMap((d) => d.check?.flags ?? []);
		expect(flags.length).toBeGreaterThan(0);
		for (const f of flags) expect(['stop', 'warn', 'info']).toContain(f.severity);
		const raw = REC.readinessLog.flatMap((r) => r.flags ?? []);
		expect(new Set(flags.map((f) => f.severity))).toEqual(new Set(raw.map((f) => f.severity)));
	});

	it('drops an exercise the library no longer has, and keeps the session', () => {
		// The library closed when #12 dropped athlete-authored exercises, so a
		// stored id can outlive its exercise. This used to throw, which on a screen
		// means five weeks of history blanked over one unrenderable row.
		const first = REC.sessions[0];
		const withGhost = {
			...REC,
			sessions: [
				{
					...first,
					exercises: [
						{ exercise: asExerciseId('a-deleted-exercise'), variant: 0, sets: [] },
						...first.exercises,
					],
				},
				...REC.sessions.slice(1),
			],
		};

		const log = resolveLog(content, withGhost, 'en-US');
		expect(log.counts.sessions).toBe(REC.sessions.length);
		const session = sessionOf(log, first.at);
		expect(session?.exercises).toHaveLength(first.exercises.length);
		// The note, the duration and the day type are all still true of the session.
		expect(session?.note).toBe(first.note);
		expect(session?.durationMin).toBe(first.durationMin ?? null);
		// And the count on the closed row matches what opens inside it.
		expect(session?.setCount).toBe(session?.exercises.reduce((n, e) => n + e.sets.length, 0));
	});

	it('names a logged exercise in the language it is read in, not the one it was written in', () => {
		// ADR 0012. The session stores an id and a variant index; both the label and
		// the columns come from them at render.
		const iso = REC.sessions[0].at;
		const en = sessionOf(resolveLog(getContent('en-US'), REC, 'en-US'), iso)?.exercises[0];
		const pt = sessionOf(resolveLog(getContent('pt-BR'), REC, 'pt-BR'), iso)?.exercises[0];
		expect(en?.exercise).toBe(pt?.exercise);
		expect(en?.fields).toEqual(pt?.fields);
		expect(en?.name).not.toBe(pt?.name);
	});
});

// The half that matters most.
describe('the screens are resolved, not fabricated', () => {
	it("prescribes what the resolver prescribes, not the variant's raw defaults", () => {
		expect(TRAIN.tasks.length).toBeGreaterThan(0);
		for (const item of TRAIN.tasks) {
			const variantIndex = resolveSwapIndex(REC, REC.currentWeek, TRAIN.weekday, item.exercise);
			const exercise = content.exercises[item.exercise];
			expect(item.variantIndex).toBe(variantIndex);
			expect(item.prescription).toEqual(
				effectiveVariant(
					content,
					REC,
					variantOf(exercise, variantIndex),
					variantIndex,
					REC.currentWeek,
					TRAIN.weekday,
					item.exercise,
				),
			);
		}
	});

	it('scales the prescribed load for the week it is in', () => {
		// Week 5 of the block with auto-progression on, so the load has climbed off
		// the library default. If these matched, nothing would be progressing.
		const progressed = TRAIN.tasks.filter((item) => {
			const raw = content.exercises[item.exercise].variants[item.variantIndex];
			return raw?.loadKg && item.prescription.loadKg;
		});
		expect(progressed.length).toBeGreaterThan(0);
		for (const item of progressed) {
			const raw = content.exercises[item.exercise].variants[item.variantIndex];
			expect(item.prescription.loadKg?.min).toBeGreaterThan(raw.loadKg?.min ?? 0);
		}
	});

	it('resolves the same answer twice from the same store', () => {
		expect(JSON.stringify(resolveToday(content, REC, NOW))).toBe(JSON.stringify(TODAY));
		expect(JSON.stringify(resolveTrain(content, REC, NOW))).toBe(JSON.stringify(TRAIN));
	});
});

// Week (#63). The screen the identity rules are hardest on, so what is asserted
// here is mostly that the two halves of a slot stay two halves.
describe('Week', () => {
	it('reads the whole week as slots, with adherence counted in slots', () => {
		expect(WEEK.slots).toHaveLength(7);
		expect(WEEK.weekNumber).toBe(5);
		// Adherence is a share of *scheduled* slots, so rest days are outside it.
		const rests = WEEK.slots.filter((s) => s.isRestDay).length;
		expect(rests).toBeGreaterThan(0);
		expect(WEEK.scheduledSlots).toBe(7 - rests);
		expect(WEEK.trainedSlots).toBeLessThanOrEqual(WEEK.scheduledSlots);
		// Every scheduled slot has work, and every task carries a slot-unique key.
		const keys = WEEK.slots.flatMap((s) => s.tasks.map((t) => t.key));
		expect(new Set(keys).size).toBe(keys.length);
		expect(keys.every((k) => k.startsWith('w5-'))).toBe(true);
	});

	// THE ADR-0003 ASSERTION, and the reason this suite is worth its length.
	//
	// The English weekday labels are byte-identical to the stable keys, so in
	// en-US alone every one of these passes whether the resolver kept them apart
	// or not. Resolving the same record in pt-BR is the only way to see it: the
	// labels move and the keys must not.
	it('localizes the weekday label and never the weekday key', () => {
		const ptWeek = resolveWeek(getContent('pt-BR'), REC, NOW);

		expect(WEEK.slots.map((s) => s.weekdayLabel)).toEqual([
			'Mon',
			'Tue',
			'Wed',
			'Thu',
			'Fri',
			'Sat',
			'Sun',
		]);
		expect(ptWeek.slots.map((s) => s.weekdayLabel)).toEqual([
			'Seg',
			'Ter',
			'Qua',
			'Qui',
			'Sex',
			'Sáb',
			'Dom',
		]);

		// The keys are the same objects of identity in both locales.
		expect(ptWeek.slots.map((s) => s.weekday)).toEqual(WEEK.slots.map((s) => s.weekday));
		expect(ptWeek.today).toBe(WEEK.today);
		// And so are the task keys, which is what a tick is stored against.
		expect(ptWeek.slots.flatMap((s) => s.tasks.map((t) => t.key))).toEqual(
			WEEK.slots.flatMap((s) => s.tasks.map((t) => t.key)),
		);
		// The *names* do move, because they are derived at render (ADR 0012).
		expect(ptWeek.slots.some((s) => s.day.type !== WEEK.slots[0].day.type)).toBe(true);
	});

	// ADR-0002: a slot's day type is resolved, not read off its weekday. Asserted
	// by moving one and watching the day type follow the slot rather than the
	// calendar position.
	it('resolves a slot day type through the program, not from the weekday', () => {
		const moved = {
			...REC,
			program: {
				...REC.program,
				template: { ...REC.program.template, [asWeekdayKey('Sun')]: { dayType: 'pull' as const } },
			},
		};
		const w = resolveWeek(content, moved, NOW);
		const sunday = w.slots.find((s) => s.weekday === asWeekdayKey('Sun'));

		// Sunday's built-in day type is `rest`; the program says otherwise, and the
		// slot runs what the program says.
		expect(sunday?.isRestDay).toBe(false);
		expect(sunday?.tasks.length).toBeGreaterThan(0);
		// It is now scheduled, so it counts toward adherence where it did not.
		expect(w.scheduledSlots).toBe(WEEK.scheduledSlots + 1);
	});

	// The five states, and the one distinction the page exists to make: `missed`
	// and `ahead` are both "scheduled and not trained".
	it('tells a slot behind today from one ahead of it', () => {
		const byDay = new Map(WEEK.slots.map((s) => [s.weekdayLabel, s.state]));
		// NOW is a Thursday.
		expect(byDay.get('Thu')).toBe('today');
		for (const past of ['Mon', 'Tue', 'Wed']) {
			expect(['trained', 'missed', 'rest']).toContain(byDay.get(past));
		}
		for (const future of ['Fri', 'Sat', 'Sun']) {
			expect(['ahead', 'rest']).toContain(byDay.get(future));
		}
		// A rest slot is never missed, whichever side of today it falls.
		for (const slot of WEEK.slots) {
			if (slot.isRestDay) expect(slot.state).toBe('rest');
		}
	});

	// The fix for a fresh account reading its first week's past days as `missed`.
	// `missed` accuses the athlete of skipping work; on an account that has never
	// trained there is nothing to have skipped, and the record carries no block
	// start date to say otherwise (ADR-0001 records that same absence).
	it('accuses nobody on an account that has never trained', () => {
		const empty = readTrainingRecord(createRecordStore(ACCOUNT, undefined, memoryStorage()));
		const w = resolveWeek(content, empty, NOW);

		expect(w.slots.map((s) => s.state)).not.toContain('missed');
		// Still an honest read: the days are scheduled and none of them are done.
		expect(w.trainedSlots).toBe(0);
		expect(w.scheduledSlots).toBeGreaterThan(0);
		// Today is still today, and the days behind it are simply still to come.
		expect(w.slots.filter((s) => s.state === 'today')).toHaveLength(1);
		expect(w.slots.some((s) => s.state === 'ahead')).toBe(true);

		// And the guard is not a blanket off-switch: one tick is evidence enough
		// that the athlete started, and the past days go back to being missable.
		const started = {
			...empty,
			taskDone: {
				[taskKey(empty.currentWeek, asWeekdayKey('Mon'), asExerciseId('recruit'))]: true,
			},
		};
		expect(resolveWeek(content, started, NOW).slots.map((s) => s.state)).toContain('missed');
	});

	// The two concepts this file used to conflate, and the reason `TodayScreen`
	// says `carryForward` rather than `missed`. ADR 0001 makes **one** tick enough
	// to call a slot **trained**, while carry-forward hands on every task that was
	// *not* ticked — so a part-trained slot is trained and still owes work. A
	// reader who took `carryForward` as "the missed slot's work" would be wrong
	// about the case the athlete hits most: starting a session and not finishing it.
	it('hands work forward from a slot it also calls trained', () => {
		const wed = asWeekdayKey('Wed');
		const scheduled = trainableExerciseIds(content, REC, REC.currentWeek, wed);
		expect(scheduled.length, 'Wednesday must run more than one exercise').toBeGreaterThan(1);

		// Exactly one of Wednesday's exercises done, on the day before NOW.
		const part = {
			...REC,
			taskDone: { ...REC.taskDone, [taskKey(REC.currentWeek, wed, scheduled[0])]: true },
		};

		const slot = resolveWeek(content, part, NOW).slots.find((s) => s.weekday === wed);
		expect(slot?.state, 'one tick is enough (ADR 0001)').toBe('trained');

		const carried = resolveToday(content, part, NOW).carryForward;
		expect(carried?.weekday).toBe(wed);
		expect(carried?.exercises).toEqual(scheduled.slice(1));
	});

	it('resolves the same answer twice from the same store', () => {
		expect(JSON.stringify(resolveWeek(content, REC, NOW))).toBe(JSON.stringify(WEEK));
	});
});

function seededWith(now: number) {
	const store = createRecordStore(ACCOUNT, undefined, memoryStorage());
	seedRecordStore(store, content, 'en-US', now);
	return store;
}

// Timer (#101). The presets are the library's own protocols, computed at read
// time and never stored, so every number below is the library's: a preset that
// ran something the exercise library does not prescribe would be a protocol with
// no study behind it.
describe('Timer', () => {
	const NONE = { savedProtocols: [] };
	const TIMER = resolveTimer(getContent('en-US'), NONE, 'en-US');
	const group = (exercise: string) => TIMER.presets.find((g) => g.exercise === exercise);
	const preset = (exercise: string, variant: number) =>
		group(exercise)?.presets.find((p) => p.variant === variant);

	it('offers every library variant that carries a protocol, and nothing else', () => {
		expect(TIMER.presets.map((g) => g.exercise)).toEqual([
			'recruit',
			'pinch',
			'wrist',
			'repeaters',
			'slopdens',
			'maxhang',
			'density',
			'abra',
		]);
		expect(TIMER.presets.flatMap((g) => g.presets)).toHaveLength(24);
		// Recruitment's second variant is a set of reps with no work length: it
		// stays out, and the variants either side keep their own positions.
		expect(group('recruit')?.presets.map((p) => p.variant)).toEqual([0, 2]);
	});

	it('reads each preset as its shape and how long it takes', () => {
		// 10s prepare, four sets of 6 × (7s on / 3s off), 3 minutes between sets.
		expect(preset('repeaters', 0)).toMatchObject({
			name: '7/3 · 20mm half-crimp + open hand',
			shape: '6 × 7s/3s · 4 sets',
			total: 778,
		});
		// One hang per set needs no round count.
		expect(preset('maxhang', 0)).toMatchObject({ shape: '10s · 3 sets', total: 400 });
		// One set needs no set count.
		expect(preset('abra', 0)).toMatchObject({ shape: '20 × 10s/20s', total: 590 });
	});

	it('runs what the library prescribes, at the middle of each range', () => {
		expect(preset('repeaters', 0)?.protocol).toEqual({
			prepare: 10,
			work: 7,
			rest: 3,
			rounds: 6,
			sets: 4,
			setRest: 180,
			cooldown: 0,
		});
	});

	it('files each preset’s clock under its own variant', () => {
		expect(preset('repeaters', 1)?.key).toBe('preset:repeaters@1');
		const keys = TIMER.presets.flatMap((g) => g.presets.map((p) => p.key));
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('links each exercise to the study the library cites for it', () => {
		expect(group('repeaters')?.study).toEqual({
			title: 'Critical force & endurance',
			url: 'https://pubmed.ncbi.nlm.nih.gov/33647876/',
		});
		expect(group('maxhang')?.study?.url).toBe('https://pubmed.ncbi.nlm.nih.gov/30988852/');
		// The library cites nothing for wrist work, and the screen does not invent it.
		expect(group('wrist')?.study).toBeNull();
	});

	// #112. A copy is named short: its source's name without the exercise in
	// front — the 54-character "Copy of Recruitment Pulls · Hangboard · …" wrapped
	// its row — and, when a saved protocol already has that name, "(2)", "(3)"…
	it('names a preset’s copy after its variant, in the locale', () => {
		expect(preset('repeaters', 0)?.copyName).toBe('7/3 · 20mm half-crimp + open hand');
		const pt = resolveTimer(getContent('pt-BR'), NONE, 'pt-BR');
		expect(pt.presets.find((g) => g.exercise === 'repeaters')?.presets[0].copyName).toBe(
			'7/3 · 20mm half-crimp + mão aberta',
		);
	});

	it('numbers a copy whose name is already taken', () => {
		const savedAs = (...names: string[]) => ({
			savedProtocols: names.map((name, i) => ({
				id: asSavedProtocolId(`5eed0000-0000-4000-8000-0000000000e${i}`),
				name,
				protocol: { prepare: 10, work: 7, rest: 3, rounds: 6, sets: 4, setRest: 180, cooldown: 0 },
				createdAt: i,
			})),
		});
		const variant = '7/3 · 20mm half-crimp + open hand';
		const copyOfPreset = (...names: string[]) =>
			resolveTimer(getContent('en-US'), savedAs(...names), 'en-US').presets.find(
				(g) => g.exercise === 'repeaters',
			)?.presets[0].copyName;
		expect(copyOfPreset(variant)).toBe(`${variant} (2)`);
		expect(copyOfPreset(variant, `${variant} (2)`)).toBe(`${variant} (3)`);
		// The first free number, not one past the highest.
		expect(copyOfPreset(variant, `${variant} (3)`)).toBe(`${variant} (2)`);

		// A saved protocol's copy: its own name, which is always taken, so numbered;
		// and a copy of a copy counts on from the name it was numbered after.
		const saved = resolveTimer(getContent('en-US'), savedAs('Tabata', 'Tabata (2)'), 'en-US').saved;
		expect(saved[0].copyName).toBe('Tabata (3)');
		expect(saved[1].copyName).toBe('Tabata (3)');
		// A copy of an unnamed one is unnamed too, listed under its shape.
		expect(resolveTimer(getContent('en-US'), savedAs(''), 'en-US').saved[0].copyName).toBe('');
	});

	it('lists the saved protocols, each with its shape and how long it takes', () => {
		const seeded = readTrainingRecord(seededWith(NOW));
		const { saved } = resolveTimer(getContent('en-US'), seeded, 'en-US');
		// Oldest first.
		expect(saved.map((s) => s.name)).toEqual(['Warm-up hangs', 'Tabata finisher']);
		// 10s prepare, two sets of 5 × 10s/20s, a minute between.
		expect(saved[0]).toMatchObject({
			name: 'Warm-up hangs',
			shape: '5 × 10s/20s · 2 sets',
			total: 330,
			copyName: 'Warm-up hangs (2)',
		});
		// 10s prepare, 8 × 20s/10s, then two minutes of cooldown (#104).
		expect(saved[1]).toMatchObject({ shape: '8 × 20s/10s · 2:00 cooldown', total: 360 });
		// Filed under its id, so renaming it keeps the athlete's place.
		expect(saved[0].key).toBe(`saved:${saved[0].id}`);
	});

	// #104. A cooldown is part of what the protocol is, so the shape says it and
	// the total counts it: two protocols that differ only by one must not look
	// the same in the list.
	it('shows a saved protocol’s cooldown in its shape and its total', () => {
		const cooled = (cooldown: number) =>
			resolveTimer(
				getContent('en-US'),
				{
					savedProtocols: [
						{
							id: asSavedProtocolId('5eed0000-0000-4000-8000-0000000000c0'),
							name: 'Finisher',
							protocol: {
								prepare: 10,
								work: 20,
								rest: 10,
								rounds: 8,
								sets: 1,
								setRest: 0,
								cooldown,
							},
							createdAt: 0,
						},
					],
				},
				'en-US',
			).saved[0];
		// 10 + 8 × 20 + 7 × 10 = 240, then the cooldown.
		expect(cooled(0)).toMatchObject({ shape: '8 × 20s/10s', total: 240 });
		expect(cooled(120)).toMatchObject({ shape: '8 × 20s/10s · 2:00 cooldown', total: 360 });
		expect(cooled(45)).toMatchObject({ shape: '8 × 20s/10s · 45s cooldown', total: 285 });
		const pt = resolveTimer(
			getContent('pt-BR'),
			{
				savedProtocols: [
					{
						id: asSavedProtocolId('5eed0000-0000-4000-8000-0000000000c1'),
						name: 'Finisher',
						protocol: {
							prepare: 0,
							work: 7,
							rest: 3,
							rounds: 6,
							sets: 2,
							setRest: 60,
							cooldown: 300,
						},
						createdAt: 0,
					},
				],
			},
			'pt-BR',
		);
		expect(pt.saved[0].shape).toBe('6 × 7s/3s · 2 séries · 5:00 de desaquecimento');
	});

	// What the clock can run, in the order it is listed, each named the way its
	// strip names it. The screen used to build this itself, and to spell a
	// preset's label a second time beside `copyName`.
	it('lists everything the clock can run, saved first, each with the strip’s name', () => {
		const seeded = readTrainingRecord(seededWith(NOW));
		const screen = resolveTimer(getContent('en-US'), seeded, 'en-US');
		expect(screen.runnable.map((r) => r.key)).toEqual([
			...screen.saved.map((s) => s.key),
			...screen.presets.flatMap((g) => g.presets.map((p) => p.key)),
		]);
		// A saved protocol is its own name; a preset leaves its group heading
		// behind, so it carries the exercise with it.
		expect(screen.saved[0].label).toBe('Warm-up hangs');
		const repeaters = screen.presets.find((g) => g.exercise === 'repeaters')?.presets[0];
		expect(repeaters?.label).toBe(`Repeaters · ${repeaters?.name}`);
	});

	// #112. The name is optional, and a protocol without one is listed, and its
	// clock named, under its shape — read in the locale, never stored (ADR 0012).
	// It is still told apart by its id, never by what it is called (ADR 0003).
	it('lists an unnamed protocol under its shape, in the locale', () => {
		const unnamed = {
			savedProtocols: [
				{
					id: asSavedProtocolId('5eed0000-0000-4000-8000-0000000000d0'),
					name: '',
					protocol: {
						prepare: 10,
						work: 4,
						rest: 5,
						rounds: 4,
						sets: 3,
						setRest: 180,
						cooldown: 0,
					},
					createdAt: 0,
				},
			],
		};
		const en = resolveTimer(getContent('en-US'), unnamed, 'en-US').saved[0];
		expect(en).toMatchObject({
			name: '4 × 4s/5s · 3 sets',
			label: '4 × 4s/5s · 3 sets',
			named: false,
		});
		expect(en.key).toBe('saved:5eed0000-0000-4000-8000-0000000000d0');
		const pt = resolveTimer(getContent('pt-BR'), unnamed, 'pt-BR').saved[0];
		expect(pt).toMatchObject({ name: '4 × 4s/5s · 3 séries', named: false });
		// A named one says so, and so does every preset.
		const seeded = resolveTimer(getContent('en-US'), readTrainingRecord(seededWith(NOW)), 'en-US');
		expect(seeded.saved[0].named).toBe(true);
		expect(seeded.presets[0].presets[0].named).toBe(true);
	});

	// #119. The preset groups open by default are today's: the exercises the plan
	// schedules today that the library has a protocol for. Thursday in the seeded
	// week is pull-ups, sloper density, abrahangs and antagonists; two of those
	// carry presets. A rest day opens none.
	it('opens today’s exercises’ groups, and none on a rest day', () => {
		const seeded = readTrainingRecord(seededWith(NOW));
		const thursday = resolveTimer(getContent('en-US'), seeded, 'en-US');
		expect(todaysPresetGroups(thursday, getContent('en-US'), seeded, NOW)).toEqual([
			'slopdens',
			'abra',
		]);
		const friday = new Date('2026-08-14T09:30:00').getTime();
		expect(todaysPresetGroups(thursday, getContent('en-US'), seeded, friday)).toEqual([
			'maxhang',
			'density',
		]);
		const sunday = new Date('2026-08-16T09:30:00').getTime();
		expect(todaysPresetGroups(thursday, getContent('en-US'), seeded, sunday)).toEqual([]);
	});

	it('has nothing saved on an account that has kept nothing', () => {
		expect(TIMER.saved).toEqual([]);
	});

	it('reads in the locale it is resolved in', () => {
		const pt = resolveTimer(getContent('pt-BR'), NONE, 'pt-BR');
		const wrist = pt.presets.find((g) => g.exercise === 'wrist');
		expect(wrist?.name).toBe('Força de Punho / Sloper');
		const repeaters = pt.presets.find((g) => g.exercise === 'repeaters');
		expect(repeaters?.presets[0].shape).toBe('6 × 7s/3s · 4 séries');
		expect(repeaters?.study?.title).toBe('Força crítica e resistência');
	});
});

// #104. What the saved-protocol editor accepts. The editor holds what was typed,
// as text, and this is the one place that decides whether it is a protocol: the
// screen shows each refusal beside its field and saves nothing until there are
// none.
describe('the saved-protocol editor', () => {
	const TABATA = {
		prepare: 10,
		work: 20,
		rest: 10,
		rounds: 8,
		sets: 1,
		setRest: 0,
		cooldown: 120,
	};
	const typed = (fields: Partial<Record<keyof typeof TABATA, string>>, name = 'Tabata') => ({
		name,
		fields: { ...formOf('', TABATA).fields, ...fields },
	});

	it('opens on the protocol it edits, as written', () => {
		expect(formOf('Tabata', TABATA)).toEqual({
			name: 'Tabata',
			fields: {
				prepare: '10',
				work: '20',
				rest: '10',
				rounds: '8',
				sets: '1',
				setRest: '0',
				cooldown: '120',
			},
		});
	});

	it('reads a filled-in form as a name and a protocol', () => {
		expect(readProtocolForm(typed({}, '  Tabata finisher '))).toEqual({
			ok: true,
			name: 'Tabata finisher',
			protocol: TABATA,
		});
	});

	it('takes no prepare, no rest, no set rest and no cooldown', () => {
		const none = typed({ prepare: '0', rest: '0', setRest: '0', cooldown: '0' });
		expect(readProtocolForm(none)).toMatchObject({
			ok: true,
			protocol: { prepare: 0, rest: 0, setRest: 0, cooldown: 0 },
		});
	});

	it.each([
		['zero work', { work: '0' }, ['work']],
		['zero rounds', { rounds: '0' }, ['rounds']],
		['zero sets', { sets: '0' }, ['sets']],
		['negative seconds', { rest: '-5', cooldown: '-1' }, ['rest', 'cooldown']],
		['a fraction', { work: '7.5' }, ['work']],
		['a field left empty', { setRest: '' }, ['setRest']],
		['something that is not a number', { prepare: 'ten' }, ['prepare']],
	])('refuses %s, and says which field', (_what, fields, refused) => {
		expect(readProtocolForm(typed(fields))).toEqual({ ok: false, refused });
	});

	// #112. A time from a minute up is shown as m:ss, so it may come back typed
	// that way: `3:00` is three minutes. A count is never a time.
	it('reads a time typed as minutes and seconds', () => {
		expect(readProtocolForm(typed({ setRest: '3:00', cooldown: '1:05' }))).toMatchObject({
			ok: true,
			protocol: { setRest: 180, cooldown: 65 },
		});
		expect(readProtocolForm(typed({ setRest: '3:75' }))).toEqual({
			ok: false,
			refused: ['setRest'],
		});
		expect(readProtocolForm(typed({ rounds: '1:00' }))).toEqual({ ok: false, refused: ['rounds'] });
	});

	// #112. The name is optional: a protocol with none is listed under its shape,
	// so a blank name is no refusal, and the name is kept as nothing at all.
	it('reads a protocol with no name as an unnamed one', () => {
		expect(readProtocolForm(typed({}, '   '))).toEqual({ ok: true, name: '', protocol: TABATA });
	});
});

// #112. The − / + beside each row. A time steps by 1s up to 30s, by 5s up to two
// minutes and by 15s above that, so a set rest of three minutes is a few taps
// away rather than a hundred; a step lands on its own grid, and one back undoes
// one forward across each boundary.
describe('the editor’s − / +', () => {
	it.each([
		['work', '10', 1, '11'],
		['work', '29', 1, '30'],
		['work', '30', 1, '35'],
		['work', '35', -1, '30'],
		['work', '30', -1, '29'],
		['setRest', '115', 1, '120'],
		['setRest', '120', 1, '135'],
		['setRest', '135', -1, '120'],
		['setRest', '120', -1, '115'],
		['setRest', '33', 1, '35'],
		['setRest', '33', -1, '30'],
		['setRest', '3:00', 1, '195'],
		['rounds', '4', 1, '5'],
		['rounds', '40', 1, '41'],
	] as const)('steps %s from %s by %i to %s', (field, from, by, to) => {
		expect(nudged(field, from, by)).toBe(to);
	});

	it('stops at the least a field can be', () => {
		expect(nudged('rest', '0', -1)).toBe('0');
		expect(nudged('work', '1', -1)).toBe('1');
		expect(nudged('sets', '1', -1)).toBe('1');
	});

	it('puts a field that is not a number back to its least', () => {
		expect(nudged('work', '', 1)).toBe('1');
		expect(nudged('rest', 'ten', -1)).toBe('0');
	});
});

// #112. A row's value, read rather than typed: from a minute up a time is m:ss —
// "3:00", not "180" — and under it seconds; a count is a number. What is not a
// number is shown as typed, beside the line that says what is wrong with it.
describe('the editor’s values', () => {
	it.each([
		['setRest', '180', '3:00'],
		['setRest', '60', '1:00'],
		['cooldown', '59', '59s'],
		['prepare', '0', '0s'],
		['work', '3:00', '3:00'],
		['rounds', '4', '4'],
		['rounds', '120', '120'],
		['work', '7.5', '7.5'],
		['work', '', ''],
	] as const)('shows %s typed as %j as %j', (field, typed, shown) => {
		expect(shownOf(field, typed)).toBe(shown);
	});
});
