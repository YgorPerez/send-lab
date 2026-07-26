import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrateState } from '../src/lib/migrate';

/** A state document as it arrives from storage: untyped by nature. */
type Doc = Record<string, unknown>;
const migrate = (doc: Doc): Doc => migrateState(doc);

test('dayPlan weekday keys become day-type ids (ADR-0002)', () => {
	const s = migrate({ dayPlan: { 'w1-Tue': 'Fri', 'w2-Mon': 'Sun' } }) as {
		dayPlan: Record<string, string>;
	};
	assert.equal(s.dayPlan['w1-Tue'], 'max-tissue');
	assert.equal(s.dayPlan['w2-Mon'], 'rest');
});

test('program template dayKeys become day-type ids, incl. saved + rehab programs', () => {
	type Tmpl = { template: Record<string, { dayKey: string }> };
	const s = migrate({
		program: { template: { Mon: { dayKey: 'Wed' } } },
		savedPrograms: [{ name: 'a', program: { template: { Tue: { dayKey: 'Sat' } } } }],
		rehab: { previous: { template: { Thu: { dayKey: 'Sun' } } } },
	}) as {
		program: Tmpl;
		savedPrograms: { program: Tmpl }[];
		rehab: { previous: Tmpl };
	};
	assert.equal(s.program.template.Mon.dayKey, 'endurance');
	assert.equal(s.savedPrograms[0].program.template.Tue.dayKey, 'performance');
	assert.equal(s.rehab.previous.template.Thu.dayKey, 'rest');
});

test('a pt-BR session label becomes the stable weekday key (ADR-0003)', () => {
	// The bug this fixes is invisible in en-US, where the labels happen to equal
	// the weekday keys — only a pt-BR document proves the backfill works.
	const s = migrate({
		workouts: [
			{ date: '26 de jul.', at: '2026-07-26', day: 'Dom', exercises: [], note: '' },
			{ date: '24 de jul.', at: '2026-07-24', day: 'Sex', exercises: [], note: '' },
		],
	}) as { workouts: { day: string }[] };
	assert.equal(s.workouts[0].day, 'Sun');
	assert.equal(s.workouts[1].day, 'Fri');
});

test('en-US session days survive the backfill unchanged', () => {
	const s = migrate({
		workouts: [{ date: 'Jul 26', at: '2026-07-26', day: 'Sun', exercises: [], note: '' }],
	}) as { workouts: { day: string }[] };
	assert.equal(s.workouts[0].day, 'Sun');
});

test('a slot-level completed tick becomes per-task completion (ADR-0001)', () => {
	const s = migrate({ completed: { 'w1-Mon': true } }) as {
		completed?: unknown;
		taskDone: Record<string, boolean>;
	};
	// Monday's built-in day type is limit-power → recruit + limitboulder
	assert.equal(s.taskDone['w1-Mon:recruit'], true);
	assert.equal(s.taskDone['w1-Mon:limitboulder'], true);
	assert.equal(s.completed, undefined, 'the write-only map is gone');
});

test('completed respects a per-slot exercise override', () => {
	const s = migrate({
		completed: { 'w2-Tue': true },
		dayExercises: { 'w2-Tue': ['pinch', 'antag'] },
	}) as { taskDone: Record<string, boolean> };
	assert.deepEqual(Object.keys(s.taskDone).sort(), ['w2-Tue:antag', 'w2-Tue:pinch']);
});

test('completed follows a migrated dayPlan override, not the weekday default', () => {
	// The slot was overridden to run Thursday's protocol (pull → the `pull` exercise),
	// so the tick must credit that, not Monday's built-in exercises.
	const s = migrate({
		completed: { 'w1-Mon': true },
		dayPlan: { 'w1-Mon': 'Thu' },
	}) as { taskDone: Record<string, boolean>; dayPlan: Record<string, string> };
	assert.equal(s.dayPlan['w1-Mon'], 'pull');
	assert.ok(!('w1-Mon:recruit' in s.taskDone), 'must not credit the weekday default');
	assert.ok(Object.keys(s.taskDone).every((k) => k.startsWith('w1-Mon:')));
	assert.ok(Object.keys(s.taskDone).length > 0);
});

test('a falsy completed tick credits nothing', () => {
	const s = migrate({ completed: { 'w1-Mon': false } }) as {
		taskDone: Record<string, boolean>;
	};
	assert.deepEqual(s.taskDone, {});
});

test('existing taskDone entries are preserved', () => {
	const s = migrate({
		completed: { 'w1-Mon': true },
		taskDone: { 'w3-Fri:maxhang': true },
	}) as { taskDone: Record<string, boolean> };
	assert.equal(s.taskDone['w3-Fri:maxhang'], true);
	assert.equal(s.taskDone['w1-Mon:recruit'], true);
});

test('migration is idempotent', () => {
	const doc = {
		dayPlan: { 'w1-Tue': 'Fri' },
		program: { template: { Mon: { dayKey: 'Wed' } } },
		workouts: [{ date: '26 de jul.', at: '2026-07-26', day: 'Dom', exercises: [], note: '' }],
		completed: { 'w1-Mon': true },
	};
	const once = JSON.parse(JSON.stringify(migrateState(doc)));
	const twice = JSON.parse(JSON.stringify(migrateState(JSON.parse(JSON.stringify(once)))));
	assert.deepEqual(twice, once);
});

test('empty and non-object documents pass through safely', () => {
	assert.deepEqual(migrate({}), {});
	assert.equal(migrateState(null), null);
	assert.equal(migrateState(undefined), undefined);
});
