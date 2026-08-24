import assert from 'node:assert/strict';
import { test } from 'vitest';
import { asExerciseId, asWeekdayKey, overrideKey } from '../src/lib/ids';
import {
	applyEditDay,
	applySetOverride,
	applySetPhases,
	DAY_TYPE_IDS,
	defaultProgram,
	EXERCISE_IDS,
} from '../src/lib/server/programOps';

test('defaultProgram is a valid empty 8-week block', () => {
	const p = defaultProgram();
	assert.equal(p.weeks, 8);
	assert.equal(p.autoProgress, true);
	assert.deepEqual(p.phases, []);
	assert.deepEqual(p.template, {});
});

test('applySetPhases normalizes, clamps, and validates', () => {
	const p = defaultProgram();
	applySetPhases(p, [{ name: 'Base', weeks: 4, intensity: 100, volume: 100, deload: false }]);
	assert.equal(p.phases.length, 1);
	assert.equal(p.phases[0].name, 'Base');

	// out-of-range values clamp; missing ones fall back to defaults
	applySetPhases(p, [{ weeks: 999, intensity: 5 }]);
	assert.equal(p.phases[0].weeks, 52); // clamped to max
	assert.equal(p.phases[0].intensity, 10); // clamped to min
	assert.equal(p.phases[0].volume, 100); // default
	assert.match(p.phases[0].name, /Phase 1/);

	assert.throws(() => applySetPhases(p, 'nope'));
	assert.throws(() => applySetPhases(p, [42]));
});

test('applyEditDay validates weekday + exercise ids and accepts custom ids', () => {
	const p = defaultProgram();
	const id = EXERCISE_IDS[0];
	const Mon = asWeekdayKey('Mon');
	const Wed = asWeekdayKey('Wed');
	applyEditDay(p, 'Mon', 'pinch-wrist', [id]);
	const mon = p.template[Mon];
	assert.ok(mon, 'editing a weekday materializes its template entry');
	assert.equal(mon.dayType, 'pinch-wrist');
	assert.deepEqual(mon.exercises, [id]);

	assert.throws(() => applyEditDay(p, 'Funday'));
	assert.throws(() => applyEditDay(p, 'Mon', undefined, ['nope_not_real']));
	// a weekday key is no longer a valid protocol reference (ADR-0002)
	assert.throws(() => applyEditDay(p, 'Mon', 'Tue'));

	// a custom id is accepted when passed via extraIds
	applyEditDay(p, 'Wed', undefined, ['my_custom'], ['my_custom']);
	const wed = p.template[Wed];
	assert.ok(wed, 'editing a weekday materializes its template entry');
	assert.deepEqual(wed.exercises, ['my_custom']);
	// defaults to the day type that weekday runs in the built-in week
	assert.equal(wed.dayType, 'endurance');
});

test('DAY_TYPE_IDS are day types, not weekdays', () => {
	assert.ok(DAY_TYPE_IDS.includes('limit-power'));
	assert.ok(DAY_TYPE_IDS.includes('rest'));
	assert.equal(DAY_TYPE_IDS.length, 7);
	for (const wd of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
		assert.ok(!DAY_TYPE_IDS.includes(wd), `${wd} must not be a day-type id`);
	}
});

test('applySetOverride sets, clears a field, and removes empty overrides', () => {
	const p = defaultProgram();
	const id = EXERCISE_IDS[0];
	const key = overrideKey(asWeekdayKey('Mon'), asExerciseId(id));
	applySetOverride(p, 'Mon', id, { loadKg: 30, sets: 4 });
	assert.equal(p.overrides[key]?.loadKg, 30);
	assert.equal(p.overrides[key]?.sets, 4);

	applySetOverride(p, 'Mon', id, { loadKg: null }); // null clears just that field
	// The `sets` assertion below is what proves the key survived — clearing one
	// field must not drop the override, and both reads would be `undefined` if it
	// had.
	assert.equal(p.overrides[key]?.loadKg, undefined);
	assert.equal(p.overrides[key]?.sets, 4);

	applySetOverride(p, 'Mon', id, { sets: null }); // clearing the last field drops the key
	assert.equal(p.overrides[key], undefined);

	assert.throws(() => applySetOverride(p, 'Mon', 'badid', { sets: 1 }));
});
