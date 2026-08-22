// The per-key guard, which is what `sanitizeState`'s whole-document coercion
// became once ADR 0007 made the unit of the write a row (#57).
//
// The interesting cases are all about the *difference* between the two: a bad row
// is rejected rather than coerced, an unknown exercise id is not a bad row, and
// the key a row arrives under has to be the key the row itself implies.
import { describe, expect, it } from 'vitest';
import { asAthleteId } from '../src/lib/ids.ts';
import { COLLECTION_NAMES, isCollection, sanitizeRow } from '../src/lib/server/record/rows.ts';
import { createRecordStore } from '../src/lib/store/collections.ts';

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
		const built = Object.keys(
			createRecordStore(asAthleteId('athlete-1'), undefined, memory()),
		).sort();
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
	const session = { at: '2026-08-20', weekday: 'Thu', exercises: [], note: '', durationMin: 60 };

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

	it('refuses a dayPlan row whose day type is not one of the seven', () => {
		const check = sanitizeRow('dayPlan', 'w1-Thu', { slot: 'w1-Thu', dayType: 'leg-day' });
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
