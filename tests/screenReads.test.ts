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
import { asAthleteId, asExerciseId, asWeekdayKey, taskKey } from '../src/lib/ids.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import {
	effectiveVariant,
	resolveSwapIndex,
	trainableExerciseIds,
	variantOf,
} from '../src/lib/prescription.ts';
import { resolveLog } from '../src/lib/screens/log.ts';
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

	it('has nothing to repeat while today is already being logged', () => {
		expect(TRAIN.canRepeatLast).toBe(false);
	});
});

describe('Log', () => {
	it('is the densest screen — many sessions, many rows inside each', () => {
		expect(LOG.sessions.length).toBeGreaterThanOrEqual(20);
		expect(LOG.sessions.reduce((n, s) => n + s.setCount, 0)).toBeGreaterThan(100);
		// Fourteen checks behind today, plus this morning's.
		expect(LOG.checks).toHaveLength(15);
	});

	it('shows a past readiness check as it was answered, not as a bare score', () => {
		const withResponses = LOG.checks.find((r) => r.responses.length > 0);
		expect(withResponses).toBeDefined();
		expect(withResponses?.verdict.title.length).toBeGreaterThan(0);
		expect(LOG.checks.some((r) => r.outcome != null)).toBe(true);
	});

	it('is newest first, in both halves', () => {
		const sessions = LOG.sessions.map((s) => s.iso);
		expect([...sessions].sort().reverse()).toEqual(sessions);
		const checks = LOG.checks.map((r) => r.iso);
		expect([...checks].sort().reverse()).toEqual(checks);
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
		expect(log.sessions).toHaveLength(REC.sessions.length);
		expect(log.sessions[0].exercises).toHaveLength(first.exercises.length);
		// The note, the duration and the day type are all still true of the session.
		expect(log.sessions[0].note).toBe(first.note);
		expect(log.sessions[0].durationMin).toBe(first.durationMin ?? null);
		// And the count on the closed row matches what opens inside it.
		expect(log.sessions[0].setCount).toBe(
			log.sessions[0].exercises.reduce((n, e) => n + e.sets.length, 0),
		);
	});

	it('names a logged exercise in the language it is read in, not the one it was written in', () => {
		// ADR 0012. The session stores an id and a variant index; both the label and
		// the columns come from them at render.
		const en = resolveLog(getContent('en-US'), REC, 'en-US').sessions[0].exercises[0];
		const pt = resolveLog(getContent('pt-BR'), REC, 'pt-BR').sessions[0].exercises[0];
		expect(en.exercise).toBe(pt.exercise);
		expect(en.fields).toEqual(pt.fields);
		expect(en.name).not.toBe(pt.name);
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
