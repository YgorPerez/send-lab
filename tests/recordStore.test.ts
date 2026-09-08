// The store's read half: collections in, one training record out.
//
// These are the guarantees #56 owes #57. The resolver was given an interface it
// could be tested against (#69) and nothing implemented it; `readTrainingRecord`
// is the first thing that does, so what is asserted here is that the shape the
// resolver was promised is the shape a live store actually hands over.

import type { StorageApi } from '@tanstack/db';
import { describe, expect, it } from 'vitest';
import { getContent } from '../src/lib/content/index.ts';
import { isoDayOf } from '../src/lib/dates.ts';
import { asAthleteId, asWeekId, parseTaskKey, weekdayKeyOf } from '../src/lib/ids.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { trainableExerciseIds } from '../src/lib/prescription.ts';
import { createRecordStore } from '../src/lib/store/collections.ts';
import { readTrainingRecord } from '../src/lib/store/record.ts';
import { scenarioRows, seedRecordStore } from '../src/lib/store/seed.ts';

/** Any account id: these tests never sync, so the only thing it does is segment
 *  the storage keys. */
const ACCOUNT = asAthleteId('athlete-1');

// Pin the locale before anything reads content: Paraglide's real strategy is
// `localStorage` first (ADR 0006) and jsdom under Vitest has none, so an
// un-overridden `getLocale()` throws where content is resolved.
overwriteGetLocale(() => 'en-US');

/** A fixed Thursday, so the scenario's "today" is a training day and the
 *  assertions do not move with the wall clock. */
const NOW = new Date('2026-08-13T09:30:00').getTime();

/** A `StorageApi` that persists nowhere. The collections take one so a test
 *  never touches the browser's `localStorage` — and so two stores can be pointed
 *  at the same bytes to prove a reload reads back what was written. */
function memoryStorage(): StorageApi {
	const cells = new Map<string, string>();
	return {
		getItem: (k) => cells.get(k) ?? null,
		setItem: (k, v) => void cells.set(k, v),
		removeItem: (k) => void cells.delete(k),
	};
}

function seeded(now = NOW) {
	const store = createRecordStore(ACCOUNT, undefined, memoryStorage());
	seedRecordStore(store, getContent('en-US'), 'en-US', now);
	return store;
}

describe('seeding', () => {
	it('fills an empty store, and refuses to do it twice', () => {
		const store = createRecordStore(ACCOUNT, undefined, memoryStorage());

		expect(seedRecordStore(store, getContent('en-US'), 'en-US', NOW)).toBe(true);
		const sessions = store.sessions.size;
		expect(sessions).toBeGreaterThan(20);

		// The store already holds an account. Seeding on top of it would be the
		// worst bug this file could have, so it is a hard "no" rather than a merge.
		expect(seedRecordStore(store, getContent('en-US'), 'en-US', NOW + 86_400_000)).toBe(false);
		expect(store.sessions.size).toBe(sessions);
	});

	it('survives a reload of the same storage, without re-seeding', () => {
		const storage = memoryStorage();
		const first = createRecordStore(ACCOUNT, undefined, storage);
		seedRecordStore(first, getContent('en-US'), 'en-US', NOW);
		const written = first.sessions.size;

		// A second store over the same bytes is what the next page load is.
		const second = createRecordStore(ACCOUNT, undefined, storage);
		expect(second.sessions.size).toBe(written);
		expect(seedRecordStore(second, getContent('en-US'), 'en-US', NOW)).toBe(false);
		expect(readTrainingRecord(second).baseline?.level).toBe('advanced');
	});

	it('splits the document — one storage key per collection', () => {
		const storage = memoryStorage();
		const keys: string[] = [];
		const spy: StorageApi = {
			getItem: (k) => storage.getItem(k),
			setItem: (k, v) => {
				if (!keys.includes(k)) keys.push(k);
				storage.setItem(k, v);
			},
			removeItem: (k) => storage.removeItem(k),
		};
		seedRecordStore(createRecordStore(ACCOUNT, undefined, spy), getContent('en-US'), 'en-US', NOW);

		// ADR 0007's whole point: the account is not one blob any more.
		expect(keys).toContain(`sendlab:${ACCOUNT}:sessions`);
		expect(keys).toContain(`sendlab:${ACCOUNT}:taskDone`);
		expect(keys.length).toBeGreaterThan(5);
	});

	it('keeps two accounts on one device apart', () => {
		// #57's account boundary. The keys were namespaced rather than bare from
		// #56 precisely so this segment could be added without moving anyone's rows.
		const storage = memoryStorage();
		const mine = createRecordStore(asAthleteId('athlete-1'), undefined, storage);
		const yours = createRecordStore(asAthleteId('athlete-2'), undefined, storage);

		seedRecordStore(mine, getContent('en-US'), 'en-US', NOW);

		expect(mine.sessions.toArray.length).toBeGreaterThan(0);
		expect(yours.sessions.toArray).toEqual([]);
		// And the second store is empty enough that it would seed for itself.
		expect(seedRecordStore(yours, getContent('en-US'), 'en-US', NOW)).toBe(true);
	});
});

describe('the training record a seeded store reads as', () => {
	it('satisfies the resolver interface it was written against', () => {
		const record = readTrainingRecord(seeded());

		expect(record.currentWeek).toBe(asWeekId(5));
		expect(record.program.weeks).toBe(8);
		expect(record.program.autoProgress).toBe(true);
		expect(record.baseline?.level).toBe('advanced');
		// Sparse records, all present and all empty — nothing is customized in the
		// scenario, so what the screens show is the built-in program progressed.
		expect(record.swaps).toEqual({});
		expect(record.slotDayType).toEqual({});
		expect(record.slotExercises).toEqual({});
		expect(record.taskSwaps).toEqual({});
	});

	it('keys completion by task, never by exercise (ADR-0001)', () => {
		const record = readTrainingRecord(seeded());
		const keys = Object.keys(record.taskDone);

		expect(keys.length).toBeGreaterThan(0);
		for (const key of keys) {
			const parts = parseTaskKey(key);
			expect(parts, key).not.toBeNull();
			// Today's ticks, so they carry today's week and today's weekday.
			expect(parts?.week).toBe(asWeekId(5));
			expect(parts?.weekday).toBe(weekdayKeyOf(isoDayOf(NOW)));
		}
	});

	it('hands sessions back newest first, and readiness oldest first', () => {
		const record = readTrainingRecord(seeded());

		const dates = record.sessions.map((s) => s.at);
		expect(dates).toEqual([...dates].sort().reverse());
		expect(dates[0]).toBe(isoDayOf(NOW));

		const checks = record.readinessLog.map((r) => r.at);
		expect(checks).toEqual([...checks].sort((a, b) => a - b));
		// Fourteen behind today, plus the one the athlete answered this morning.
		expect(checks).toHaveLength(15);
	});

	it('logs no rest day as a session', () => {
		const record = readTrainingRecord(seeded());
		const content = getContent('en-US');

		for (const session of record.sessions) {
			// The rest placeholder is a real entry in the exercise library, so a
			// session on a rest day is what a filter that trusts the library
			// produces (#69). Every stored session has scheduled work behind it.
			expect(
				trainableExerciseIds(content, record, asWeekId(5), session.weekday).length,
				session.at,
			).toBeGreaterThan(0);
			expect(session.exercises.length, session.at).toBeGreaterThan(0);
		}
	});

	it('stores no display string — only ids, numbers and ISO dates', () => {
		const record = readTrainingRecord(seeded());
		const session = record.sessions[0];

		expect(session.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(session.weekday).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
		for (const logged of session.exercises) {
			// ADR 0012: a logged exercise carries an id and a variant index, and the
			// name is produced at render in whatever language is active.
			expect(typeof logged.exercise).toBe('string');
			expect(typeof logged.variant).toBe('number');
			expect(logged).not.toHaveProperty('name');
		}
	});
});

describe('an account with nothing in it', () => {
	it('reads as a valid record rather than as undefined', () => {
		// What #57 sees before the server answers, and what a signed-out store is.
		const record = readTrainingRecord(createRecordStore(ACCOUNT, undefined, memoryStorage()));

		expect(record.currentWeek).toBe(asWeekId(1));
		expect(record.baseline).toBeNull();
		expect(record.rehab).toBeNull();
		expect(record.sessions).toEqual([]);
		expect(record.taskDone).toEqual({});
		expect(record.prefs).toEqual({
			weight: 'kg',
			length: 'mm',
			cueNotices: false,
			dailyNotice: false,
			timeZone: null,
			locale: null,
		});
	});
});

describe('the scenario is account state, not screen content', () => {
	it('stores the same rows in both locales, apart from what a person typed', () => {
		const en = scenarioRows(getContent('en-US'), 'en-US', NOW);
		const pt = withLocale('pt-BR', () => scenarioRows(getContent('pt-BR'), 'pt-BR', NOW));

		// Ids, numbers and dates are language-neutral, so the two seedings are the
		// same account. Notes are free text and are not.
		expect(strip(en)).toEqual(strip(pt));
		const enNote = en.sessions.find((s) => s.note)?.note;
		const ptNote = pt.sessions.find((s) => s.note)?.note;
		expect(enNote).toBeTruthy();
		expect(ptNote).toBeTruthy();
		expect(ptNote).not.toBe(enNote);
	});
});

function withLocale<T>(locale: 'en-US' | 'pt-BR', fn: () => T): T {
	overwriteGetLocale(() => locale);
	try {
		return fn();
	} finally {
		overwriteGetLocale(() => 'en-US');
	}
}

/** The rows with every athlete-typed string removed. */
function strip(rows: ReturnType<typeof scenarioRows>) {
	return { ...rows, sessions: rows.sessions.map((s) => ({ ...s, note: '' })) };
}
