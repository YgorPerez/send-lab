// The `/api/state` request envelope.
//
// The distinction this file exists to pin is *which failures fail the batch*. A
// malformed request is one 400; a malformed row is one entry in `rejected` and
// the other writes still land. Getting that backwards means either an athlete
// loses a whole session's worth of writes to one bad row, or a garbage request is
// answered 200.
import { describe, expect, it } from 'vitest';
import { parseWriteBatch } from '../src/lib/server/record/wire.ts';

const T1 = 1_755_000_000_000;

/** A real `TaskKey` — `w<week>-<weekday>:<exercise>`. Anything else is refused
 *  by the row guard, which is the point of `ids.ts` branding them. */
const taskKey = (exercise: string) => `w1-Thu:${exercise}`;

const tick = (exercise: string, done = true, at = T1) => {
	const task = taskKey(exercise);
	return { collection: 'taskDone', key: task, row: { task, done }, at };
};

/** The batch, or a thrown assertion — narrows the union so tests read plainly. */
function parsed(body: unknown) {
	const batch = parseWriteBatch(body);
	if (!batch.ok) throw new Error(`expected a batch, got: ${batch.reason}`);
	return batch;
}

describe('a request that is not a request', () => {
	it('refuses a body that is not an object', () => {
		for (const body of [null, undefined, 42, 'writes', []]) {
			expect(parseWriteBatch(body).ok).toBe(false);
		}
	});

	it('refuses a missing or non-array `writes`', () => {
		expect(parseWriteBatch({}).ok).toBe(false);
		expect(parseWriteBatch({ writes: 'all of them' }).ok).toBe(false);
	});

	it('refuses an entry that is not an object', () => {
		expect(parseWriteBatch({ writes: [tick('a'), 'nope'] }).ok).toBe(false);
	});

	it('refuses a write missing its envelope fields', () => {
		expect(parseWriteBatch({ writes: [{ key: 'a', row: {}, at: T1 }] }).ok).toBe(false);
		expect(parseWriteBatch({ writes: [{ collection: 'taskDone', row: {}, at: T1 }] }).ok).toBe(
			false,
		);
	});

	it('refuses an `at` that is not epoch ms', () => {
		for (const at of [undefined, null, 'now', Number.NaN, Number.POSITIVE_INFINITY, -1]) {
			expect(parseWriteBatch({ writes: [{ ...tick('a'), at }] }).ok).toBe(false);
		}
	});

	it('refuses a batch past the ceiling rather than truncating it', () => {
		// Silently dropping the tail would be the worst of both: a 200, and an
		// athlete's oldest offline writes gone.
		const writes = Array.from({ length: 501 }, (_, i) => tick(`ex-${i}`));
		const batch = parseWriteBatch({ writes });
		expect(batch.ok).toBe(false);
		expect(batch.ok === false && batch.reason).toContain('501');
	});

	it('accepts a batch exactly at the ceiling', () => {
		const writes = Array.from({ length: 500 }, (_, i) => tick(`ex-${i}`));
		expect(parsed({ writes }).writes).toHaveLength(500);
	});
});

describe('a bad row does not fail the batch', () => {
	it('rejects the row by name and keeps the others', () => {
		// The middle one has no `done`, which a tick is.
		const bad = { collection: 'taskDone', key: taskKey('b'), row: { task: taskKey('b') }, at: T1 };
		const batch = parsed({ writes: [tick('a'), bad, tick('c')] });

		expect(batch.writes.map((w) => w.key)).toEqual([taskKey('a'), taskKey('c')]);
		expect(batch.rejected).toHaveLength(1);
		expect(batch.rejected[0]).toMatchObject({ collection: 'taskDone', key: taskKey('b') });
	});

	it('rejects a collection that is not one', () => {
		const batch = parsed({
			writes: [{ collection: 'workouts', key: '2026-08-20', row: { at: '2026-08-20' }, at: T1 }],
		});
		expect(batch.writes).toEqual([]);
		expect(batch.rejected[0]?.reason).toContain('unknown collection');
	});

	it('hands on the parsed row rather than the caller’s object', () => {
		const batch = parsed({
			writes: [{ collection: 'bodyweight', key: '1000', row: { at: 1000, kg: 71, x: 1 }, at: T1 }],
		});
		expect(batch.writes[0]?.row).toEqual({ at: 1000, kg: 71 });
	});
});

describe('a delete is a write of null', () => {
	it('carries no row to check', () => {
		const batch = parsed({
			writes: [{ collection: 'sessions', key: '2026-08-20', row: null, at: T1 }],
		});
		expect(batch.writes[0]).toEqual({
			collection: 'sessions',
			key: '2026-08-20',
			row: null,
			at: T1,
		});
		expect(batch.rejected).toEqual([]);
	});

	it('still has to name a collection', () => {
		const batch = parsed({ writes: [{ collection: 'log', key: 'a', row: null, at: T1 }] });
		expect(batch.writes).toEqual([]);
		expect(batch.rejected[0]?.reason).toContain('unknown collection');
	});

	it('accepts a key that names no row', () => {
		// A delete replayed twice, or one for a row this server never saw. It
		// tombstones something that was not there, which is harmless and is what
		// makes the outbox safe to re-flush.
		const batch = parsed({
			writes: [{ collection: 'sessions', key: 'never-existed', row: null, at: T1 }],
		});
		expect(batch.writes).toHaveLength(1);
	});
});

describe('an empty batch', () => {
	it('is a valid request that does nothing', () => {
		expect(parsed({ writes: [] })).toEqual({ ok: true, writes: [], rejected: [] });
	});
});
