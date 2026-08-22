// The merge rule, against a real database.
//
// Tested through the statement that actually runs rather than through a
// re-implementation of it in TypeScript: the rule lives in an `ON CONFLICT`
// clause, and a parallel copy of it in a pure function would be the thing that
// drifts. A bug here silently loses training the athlete did.
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { beforeEach, describe, expect, it } from 'vitest';
import { asAthleteId } from '../src/lib/ids.ts';
import type { UnsyncedWrite } from '../src/lib/recordWire.ts';
import * as schema from '../src/lib/server/db/schema';
import { applyWritesIn, readRecordIn } from '../src/lib/server/record/store.ts';

const ATHLETE = asAthleteId('athlete-1');
const OTHER = asAthleteId('athlete-2');
const T1 = 1_755_000_000_000;
const T2 = T1 + 60_000;

/** The `state_row` table alone. No `user` table: the FK is not what is under
 *  test, and creating it without one keeps the fixture to the thing it exercises
 *  — the same choice `oauthCleanup.test.ts` makes. */
async function freshDb() {
	const client = createClient({ url: ':memory:' });
	await client.execute(
		`CREATE TABLE record_row (
			account_id TEXT NOT NULL,
			collection TEXT NOT NULL,
			row_key TEXT NOT NULL,
			row TEXT,
			updated_at INTEGER NOT NULL,
			PRIMARY KEY (account_id, collection, row_key)
		)`,
	);
	return drizzle(client, { schema });
}

type Db = Awaited<ReturnType<typeof freshDb>>;
let db: Db;

beforeEach(async () => {
	db = await freshDb();
});

const tick = (task: string, done: boolean, at: number): UnsyncedWrite => ({
	collection: 'taskDone',
	key: task,
	row: { task, done },
	at,
});

const remove = (collection: string, key: string, at: number): UnsyncedWrite => ({
	collection,
	key,
	row: null,
	at,
});

describe('last-write-wins per row key', () => {
	it('stores a row and reads it back', async () => {
		expect(await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', true, T1)])).toEqual({
			applied: 1,
			stale: 0,
		});
		const record = await readRecordIn(db, ATHLETE);
		expect(record.rows.taskDone).toEqual([{ task: 'w1-Thu:pinch', done: true }]);
	});

	it('a newer write of the same key replaces the older', async () => {
		await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', true, T1)]);
		expect(await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', false, T2)])).toEqual({
			applied: 1,
			stale: 0,
		});
		expect((await readRecordIn(db, ATHLETE)).rows.taskDone).toEqual([
			{ task: 'w1-Thu:pinch', done: false },
		]);
	});

	it('an older write arriving late loses, and says so', async () => {
		// The outbox case: a tick made on a plane at T1, flushed after the phone
		// already untucked it at T2. Arrival order says the plane wins; the
		// athlete's clock says it does not.
		await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', false, T2)]);
		expect(await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', true, T1)])).toEqual({
			applied: 0,
			stale: 1,
		});
		expect((await readRecordIn(db, ATHLETE)).rows.taskDone).toEqual([
			{ task: 'w1-Thu:pinch', done: false },
		]);
	});

	it('a tie goes to the incoming write, so a re-flush is idempotent', async () => {
		await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', true, T1)]);
		expect(await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', true, T1)])).toEqual({
			applied: 1,
			stale: 0,
		});
		expect((await readRecordIn(db, ATHLETE)).rows.taskDone).toHaveLength(1);
	});

	it('two devices ticking two different tasks both land', async () => {
		// ADR 0007's whole argument, as an assertion: under the old whole-document
		// write these two collided and one was lost.
		await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', true, T1)]);
		await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pull', true, T1)]);
		const done = (await readRecordIn(db, ATHLETE)).rows.taskDone;
		expect(done).toHaveLength(2);
	});

	it('applies a mixed batch in one statement, per-key', async () => {
		await applyWritesIn(db, ATHLETE, [tick('a', true, T2), tick('b', true, T2)]);
		const outcome = await applyWritesIn(db, ATHLETE, [
			tick('a', false, T1), // stale
			tick('b', false, T2), // tie, lands
			tick('c', true, T1), // new
		]);
		expect(outcome).toEqual({ applied: 2, stale: 1 });
		const byTask = Object.fromEntries(
			((await readRecordIn(db, ATHLETE)).rows.taskDone as { task: string; done: boolean }[]).map(
				(r) => [r.task, r.done],
			),
		);
		expect(byTask).toEqual({ a: true, b: false, c: true });
	});
});

describe('deletes are tombstones', () => {
	it('a delete takes the row out of the rows and names it as deleted', async () => {
		// Both halves matter. Hiding it is what keeps the row off the screen;
		// *reporting* it is the only way the deletion ever reaches a second device,
		// because absence alone has to mean "keep what you have" (a row missing from
		// a response is far more often an unsynced write than a deletion).
		await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', true, T1)]);
		await applyWritesIn(db, ATHLETE, [remove('taskDone', 'w1-Thu:pinch', T2)]);

		const record = await readRecordIn(db, ATHLETE);
		expect(record.rows.taskDone).toEqual([]);
		expect(record.deleted.taskDone).toEqual(['w1-Thu:pinch']);
	});

	it('a stale update does not resurrect a deleted row', async () => {
		// The reason a delete is a tombstone rather than a `DELETE`. With the row
		// gone there is nothing to compare the late write against, and it comes
		// back from the dead.
		await applyWritesIn(db, ATHLETE, [remove('taskDone', 'w1-Thu:pinch', T2)]);
		expect(await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', true, T1)])).toEqual({
			applied: 0,
			stale: 1,
		});
		expect((await readRecordIn(db, ATHLETE)).rows.taskDone).toEqual([]);
	});

	it('a row brought back is no longer reported as deleted', async () => {
		await applyWritesIn(db, ATHLETE, [remove('taskDone', 'w1-Thu:pinch', T1)]);
		await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', true, T2)]);
		expect((await readRecordIn(db, ATHLETE)).deleted.taskDone).toEqual([]);
	});

	it('a newer write after a delete brings the row back', async () => {
		await applyWritesIn(db, ATHLETE, [remove('taskDone', 'w1-Thu:pinch', T1)]);
		await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', true, T2)]);
		expect((await readRecordIn(db, ATHLETE)).rows.taskDone).toEqual([
			{ task: 'w1-Thu:pinch', done: true },
		]);
	});
});

describe('one account cannot read or overwrite another', () => {
	it('keeps two accounts holding the same key apart', async () => {
		await applyWritesIn(db, ATHLETE, [tick('w1-Thu:pinch', true, T1)]);
		await applyWritesIn(db, OTHER, [tick('w1-Thu:pinch', false, T2)]);
		expect((await readRecordIn(db, ATHLETE)).rows.taskDone).toEqual([
			{ task: 'w1-Thu:pinch', done: true },
		]);
		expect((await readRecordIn(db, OTHER)).rows.taskDone).toEqual([
			{ task: 'w1-Thu:pinch', done: false },
		]);
	});
});

describe('a hydrate is shaped like the store', () => {
	it('names every collection, empty ones included', async () => {
		const record = await readRecordIn(db, ATHLETE);
		expect(Object.keys(record.rows)).toHaveLength(15);
		expect(Object.keys(record.deleted)).toHaveLength(15);
		expect(record.rows.sessions).toEqual([]);
		expect(record.rows.prefs).toEqual([]);
		expect(Object.values(record.rows).every((rows) => rows.length === 0)).toBe(true);
	});

	it('an empty batch does nothing and touches no statement', async () => {
		expect(await applyWritesIn(db, ATHLETE, [])).toEqual({ applied: 0, stale: 0 });
	});
});
