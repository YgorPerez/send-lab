import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acwr } from '../src/lib/stats';

const DAY = 86_400_000;
const NOW = Date.parse('2026-06-24T12:00:00Z');
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString().slice(0, 10);

/** A workout `daysAgo` days back with `sets` sets each at the given `rpe`. */
const w = (daysAgo: number, sets: number, rpe: number) => ({
	date: iso(daysAgo),
	at: iso(daysAgo),
	day: 'Mon',
	exercises: [
		{
			exId: 'x',
			name: 'x',
			sets: Array.from({ length: sets }, () => ({
				weight: null,
				edge: null,
				time: null,
				reps: null,
				rest: null,
				rpe,
				grip: null,
				done: true,
			})),
		},
	],
	note: '',
});

test('acwr returns null without ~3 weeks of history', () => {
	assert.equal(acwr([w(1, 5, 7), w(3, 5, 7)], NOW), null);
});

test('acwr is optimal for steady load', () => {
	const ws = [];
	for (let d = 0; d < 28; d += 2) ws.push(w(d, 5, 7)); // ~35 load every 2 days
	const r = acwr(ws, NOW);
	assert.equal(r?.status, 'optimal');
});

test('acwr flags a recent spike', () => {
	const ws = [];
	for (let d = 8; d < 28; d += 3) ws.push(w(d, 2, 6)); // light chronic base
	for (let d = 0; d < 7; d += 1) ws.push(w(d, 10, 9)); // heavy last 7 days
	const r = acwr(ws, NOW);
	assert.equal(r?.status, 'spike');
});
