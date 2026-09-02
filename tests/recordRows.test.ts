// The per-key guard, which is what `sanitizeState`'s whole-document coercion
// became once ADR 0007 made the unit of the write a row (#57).
//
// The interesting cases are all about the *difference* between the two: a bad row
// is rejected rather than coerced, an unknown exercise id is not a bad row, and
// the key a row arrives under has to be the key the row itself implies.
import { describe, expect, it } from 'vitest';
import { getContent } from '../src/lib/content/index.ts';
import {
	asAthleteId,
	asExerciseId,
	asWeekdayKey,
	asWeekId,
	slotKey,
	taskKey,
} from '../src/lib/ids.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { COLLECTION_NAMES, isCollection, sanitizeRow } from '../src/lib/server/record/rows.ts';
import { createRecordStore, SINGLETON_KEY } from '../src/lib/store/collections.ts';
import { scenarioRows } from '../src/lib/store/seed.ts';

/** Any account id: nothing here syncs, so it only segments the storage keys. */
const ACCOUNT = asAthleteId('athlete-1');

// Paraglide's real strategy is `localStorage` first (ADR 0006) and jsdom under
// Vitest has none, so an un-overridden `getLocale()` throws where content is
// resolved. Same pin as `recordStore.test.ts`.
overwriteGetLocale(() => 'en-US');

/** A fixed Thursday, so the scenario's "today" is a training day. */
const NOW = new Date('2026-08-13T09:30:00').getTime();

/** A `StorageApi` backed by a `Map` — the collections persist nowhere. */
function memory() {
	const cells = new Map<string, string>();
	return {
		getItem: (k: string) => cells.get(k) ?? null,
		setItem: (k: string, v: string) => void cells.set(k, v),
		removeItem: (k: string) => void cells.delete(k),
	};
}

describe('the registry covers the store', () => {
	// The one assertion that keeps the server's copy of `getKey` honest. If a
	// sixteenth collection lands in `store/collections.ts` and not here, its rows
	// would be rejected as an unknown collection and the athlete's writes would
	// vanish with a 200 — so this fails instead.
	it('names exactly the collections createRecordStore builds', () => {
		const built = Object.keys(createRecordStore(ACCOUNT, undefined, memory())).sort();
		expect([...COLLECTION_NAMES].sort()).toEqual(built);
	});

	it('rejects a collection that is not one', () => {
		expect(isCollection('taskDone')).toBe(true);
		expect(isCollection('workouts')).toBe(false);
		expect(isCollection('assessment')).toBe(false);
		expect(isCollection('log')).toBe(false);
	});
});

describe('ADR 0014 — the glossary name is the wire name', () => {
	const session = {
		at: '2026-08-20',
		weekday: 'Thu',
		dayType: 'pull',
		exercises: [],
		note: '',
		durationMin: 60,
	};

	it('accepts `sessions` and refuses `workouts`', () => {
		expect(sanitizeRow('sessions', '2026-08-20', session).ok).toBe(true);
		const refused = sanitizeRow('workouts', '2026-08-20', session);
		expect(refused).toEqual({ ok: false, reason: 'unknown collection "workouts"' });
	});

	it('accepts `baseline` and refuses `assessment`', () => {
		expect(isCollection('baseline')).toBe(true);
		expect(sanitizeRow('assessment', 'only', { id: 'only' }).ok).toBe(false);
	});
});

describe('a bad row is rejected, not coerced', () => {
	it('refuses a taskDone row whose `done` is not a boolean', () => {
		const check = sanitizeRow('taskDone', 'w1-Thu:pinch', { task: 'w1-Thu:pinch', done: 'yes' });
		expect(check.ok).toBe(false);
		// The reason names the field, so the client can log which write it lost.
		expect(check.ok === false && check.reason).toContain('done');
	});

	it('refuses a slotDayType row whose day type is not one of the seven', () => {
		const check = sanitizeRow('slotDayType', 'w1-Thu', { slot: 'w1-Thu', dayType: 'leg-day' });
		expect(check.ok).toBe(false);
	});

	it('refuses a readiness check whose verdict is not a verdict', () => {
		const check = sanitizeRow('readinessLog', '1000', { at: 1000, verdict: 'fine', score: 70 });
		expect(check.ok).toBe(false);
	});

	it('hands back the parsed row rather than the input object', () => {
		const check = sanitizeRow('bodyweight', '1000', { at: 1000, kg: 71.4, stray: 'dropped' });
		expect(check).toEqual({ ok: true, row: { at: 1000, kg: 71.4 } });
	});
});

describe('structural, not referential', () => {
	// The line drawn by #56's review: `resolveLog` threw on an exercise id the
	// library no longer carried, which blanks five weeks of history over one
	// unrenderable row. The library is the app's and it changes; the session is
	// the athlete's and it happened.
	it('stores a session naming an exercise the library no longer has', () => {
		const check = sanitizeRow('sessions', '2026-08-20', {
			at: '2026-08-20',
			weekday: 'Thu',
			dayType: 'pull',
			exercises: [{ exercise: 'retired-in-a-later-release', variant: 0, sets: [] }],
			note: '',
		});
		expect(check.ok).toBe(true);
	});

	it('still refuses an exercise id that is not an id at all', () => {
		const check = sanitizeRow('swaps', '', { exercise: '', variant: 1 });
		expect(check.ok).toBe(false);
	});

	it('refuses a session whose date is not an ISO calendar date', () => {
		const check = sanitizeRow('sessions', '20 Aug 2026', {
			at: '20 Aug 2026',
			weekday: 'Thu',
			dayType: 'pull',
			exercises: [],
			note: '',
		});
		expect(check.ok).toBe(false);
	});
});

describe('the key is cross-checked against the row', () => {
	// Without this, a client bug files one session under two keys — and
	// last-write-wins per row key cannot merge two rows that never collide.
	it('refuses a row filed under a key that is not its own', () => {
		const check = sanitizeRow('sessions', '2026-08-21', {
			at: '2026-08-20',
			weekday: 'Thu',
			dayType: 'pull',
			exercises: [],
			note: '',
		});
		expect(check.ok).toBe(false);
		expect(check.ok === false && check.reason).toContain('does not match');
	});

	it('refuses a singleton filed under anything but its fixed key', () => {
		const row = { id: 'only', weight: 'kg', length: 'mm', notify: false, locale: null };
		expect(sanitizeRow('prefs', 'only', row).ok).toBe(true);
		expect(sanitizeRow('prefs', 'mine', row).ok).toBe(false);
	});

	it('refuses a singleton whose `id` is not the fixed key', () => {
		const row = { id: 'mine', weight: 'kg', length: 'mm', notify: false, locale: null };
		expect(sanitizeRow('prefs', 'only', row).ok).toBe(false);
	});

	it('matches a numeric key against its string spelling', () => {
		// The row key is a number in the collection and a string on the wire; the
		// two have to meet somewhere, and this is where.
		expect(sanitizeRow('bodyweight', '1755648000000', { at: 1755648000000, kg: 71 }).ok).toBe(true);
		expect(sanitizeRow('bodyweight', '1755648000001', { at: 1755648000000, kg: 71 }).ok).toBe(
			false,
		);
	});
});

describe('nothing arrives that is not an object', () => {
	it('refuses null, arrays and primitives', () => {
		for (const data of [null, undefined, 42, 'row', [], [{ at: 1, kg: 2 }]]) {
			expect(sanitizeRow('bodyweight', '1', data).ok).toBe(false);
		}
	});
});

describe("the server's keyOf is the collection's getKey", () => {
	// ADR 0015 says the client's `getKey` has a server-side twin "held together by
	// a test". Until this block, that test was the one above, which holds the two
	// *name* lists against each other and never compares a key. So changing a
	// collection's `getKey` without changing its `keyOf` was invisible — and its
	// symptom is the one ADR 0015 says the cross-check exists to stop: the same
	// row filed under two keys, which last-write-wins can never merge. What that
	// actually looks like is worse than a crash. `sanitizeRow` refuses the write,
	// the endpoint answers 200 with the row in `rejected`, `store/sync.ts` logs it
	// and drops it from the pending map, and the athlete's training is gone with
	// every screen still reading normally from the local collection.
	//
	// So this runs both derivations over one real row per collection. It compares
	// them the way the write path does — the client picks the key, the server
	// re-derives it from the row and refuses a disagreement — rather than by
	// reaching into the registry, because that is the comparison that matters.
	const store = createRecordStore(ACCOUNT, undefined, memory());
	const seeded = scenarioRows(getContent('en-US'), 'en-US', NOW);

	const WEEK = asWeekId(1);
	const THU = asWeekdayKey('Thu');
	const PULL = asExerciseId('pull-up');

	/** One valid row per collection. The seeded ones come from `store/seed.ts` so
	 *  they are the rows the app really writes; the seven the scenario does not
	 *  cover are the smallest thing each schema accepts. */
	const SAMPLES: Readonly<Record<string, unknown>> = {
		currentWeek: { id: SINGLETON_KEY, week: asWeekId(seeded.currentWeek) },
		program: { id: SINGLETON_KEY, program: seeded.program },
		baseline: { id: SINGLETON_KEY, baseline: seeded.baseline },
		rehab: {
			id: SINGLETON_KEY,
			rehab: {
				area: 'fingers',
				stage: 'subacute',
				startedAt: '2026-08-01',
				previous: seeded.program,
			},
		},
		prefs: { id: SINGLETON_KEY, weight: 'kg', length: 'mm', notify: false, locale: null },
		swaps: { exercise: PULL, variant: 1 },
		slotDayType: { slot: slotKey(WEEK, THU), dayType: 'pull' },
		slotExercises: { slot: slotKey(WEEK, THU), exercises: [PULL] },
		taskSwaps: { task: taskKey(WEEK, THU, PULL), variant: 2 },
		taskDone: seeded.taskDone[0],
		sessions: seeded.sessions[0],
		readinessLog: seeded.readinessLog[0],
		selfCheckLog: seeded.selfCheckLog[0],
		bodyweight: seeded.bodyweight[0],
		savedPrograms: { name: 'Base 8', program: seeded.program },
	};

	// Without this the table below could silently stop covering a collection, and
	// a sixteenth would be added to the store and the registry with no key ever
	// compared — which is the hole this whole block exists to close.
	it('has a row for every collection', () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...COLLECTION_NAMES].sort());
	});

	it.each([...COLLECTION_NAMES])('%s derives the same key on both sides', (name) => {
		const row = SAMPLES[name];
		expect(row).toBeTruthy();

		// The wire carries keys as strings and four collections key on a number, so
		// the client's own `String(m.key)` (`store/collections.ts`) is part of the
		// derivation rather than a detail of the transport.
		const collection = (
			store as unknown as Record<string, { getKeyFromItem(r: unknown): unknown }>
		)[name];
		const clientKey = String(collection.getKeyFromItem(row));

		// Asserted as the reason rather than as a boolean: a mismatch then names
		// both keys in the failure, and a sample row that has gone stale against
		// its schema says so instead of looking like a key bug.
		const check = sanitizeRow(name, clientKey, row);
		expect(check.ok ? null : check.reason).toBeNull();
	});
});
