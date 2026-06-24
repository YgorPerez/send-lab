import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	applyEditDay,
	applySetPhases,
	applySetTarget,
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
	applyEditDay(p, 'Mon', 'Tue', [id]);
	assert.equal(p.template.Mon.dayKey, 'Tue');
	assert.deepEqual(p.template.Mon.ex, [id]);

	assert.throws(() => applyEditDay(p, 'Funday'));
	assert.throws(() => applyEditDay(p, 'Mon', undefined, ['nope_not_real']));

	// a custom id is accepted when passed via extraIds
	applyEditDay(p, 'Wed', undefined, ['my_custom'], ['my_custom']);
	assert.deepEqual(p.template.Wed.ex, ['my_custom']);
	assert.equal(p.template.Wed.dayKey, 'Wed'); // defaults to the weekday
});

test('applySetTarget sets, clears a field, and removes empty targets', () => {
	const p = defaultProgram();
	const id = EXERCISE_IDS[0];
	const key = `Mon:${id}`;
	applySetTarget(p, 'Mon', id, { loadKg: 30, sets: 4 });
	assert.equal(p.targets[key].loadKg, 30);
	assert.equal(p.targets[key].sets, 4);

	applySetTarget(p, 'Mon', id, { loadKg: null }); // null clears just that field
	assert.equal(p.targets[key].loadKg, undefined);
	assert.equal(p.targets[key].sets, 4);

	applySetTarget(p, 'Mon', id, { sets: null }); // clearing the last field drops the key
	assert.equal(p.targets[key], undefined);

	assert.throws(() => applySetTarget(p, 'Mon', 'badid', { sets: 1 }));
});
