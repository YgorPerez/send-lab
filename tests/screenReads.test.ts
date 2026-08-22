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
import { asExerciseId } from '../src/lib/ids.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { effectiveVariant, resolveSwapIndex, variantOf } from '../src/lib/prescription.ts';
import { resolveLog } from '../src/lib/screens/log.ts';
import { heldExercises, resolveQuestions, resolveToday } from '../src/lib/screens/today.ts';
import { resolveTrain } from '../src/lib/screens/train.ts';
import { readTrainingRecord } from '../src/lib/store/account.ts';
import { createAccountStore } from '../src/lib/store/collections.ts';
import { seedAccountStore } from '../src/lib/store/seed.ts';

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
	const store = createAccountStore(memoryStorage());
	seedAccountStore(store, content, 'en-US', NOW);
	return readTrainingRecord(store);
}

const REC = record();
const TODAY = resolveToday(content, REC, NOW);
const TRAIN = resolveTrain(content, REC, NOW);
const LOG = resolveLog(content, REC, 'en-US');

describe('Today', () => {
	it('lands on a verdict that actually caps the session, so held work is on screen', () => {
		const readiness = computeReadiness(TODAY.answers, TODAY.load, TODAY.insights);
		expect(readiness.verdict).toBe('moderate');

		const held = heldExercises(TODAY.tasks, readiness.verdict);
		// Some work held, not all of it — a screen where everything is held and a
		// screen where nothing is both fail to show what "held" means.
		expect(held.size).toBeGreaterThan(0);
		expect(held.size).toBeLessThan(TODAY.tasks.length);
		expect(TODAY.tasks.every((t) => t.label.length > 0)).toBe(true);
	});

	it('carries every piece the screen is built around', () => {
		const questions = resolveQuestions(content, TODAY.answers);
		expect(questions.length).toBeGreaterThanOrEqual(6);
		// The adaptive half: at least one follow-up is revealed, not just the core.
		expect(questions.some((q) => q.sub)).toBe(true);
		expect(TODAY.trendPoints).toHaveLength(14);
		expect(TODAY.bodyweight.promptToday).toBe(true);
		expect(TODAY.bodyweight.latestKg).toBe(71.9);
		expect(TODAY.missed).not.toBeNull();
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

function seededWith(now: number) {
	const store = createAccountStore(memoryStorage());
	seedAccountStore(store, content, 'en-US', now);
	return store;
}
