import assert from 'node:assert/strict';
import { test } from 'vitest';
import { asExerciseId, asWeekdayKey } from '../src/lib/ids';
import { acwr, readinessInsights, weekLoad } from '../src/lib/stats';
import type { LoggedReadinessCheck, Session } from '../src/lib/types';

const DAY = 86_400_000;
const NOW = Date.parse('2026-06-24T12:00:00Z');
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString().slice(0, 10);

/** A workout `daysAgo` days back with `sets` sets each at the given `rpe`. */
const w = (daysAgo: number, sets: number, rpe: number): Session => ({
	at: iso(daysAgo),
	weekday: asWeekdayKey('Mon'),
	exercises: [
		{
			exercise: asExerciseId('x'),
			variant: 0,
			sets: Array.from({ length: sets }, () => ({
				loadKg: null,
				edgeMm: null,
				workSec: null,
				reps: null,
				restSec: null,
				rpe,
				grip: null,
				done: true,
			})),
		},
	],
	note: '',
	// Irrelevant to workload arithmetic, which reads effort and duration only —
	// but a session cannot omit what it trained (ADR 0017).
	dayType: 'pull',
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

test('weekLoad: even daily load is monotonous, spiky load with rest days is varied', () => {
	// same session every day for 7 days → no day-to-day variation → monotonous
	const even = [];
	for (let d = 0; d < 7; d += 1) even.push(w(d, 5, 7));
	const e = weekLoad(even, NOW);
	assert.equal(e?.status, 'monotonous');
	assert.ok((e?.monotony ?? 0) >= 2);

	// the same weekly volume in two sessions with rest days between → varied
	const spiky = weekLoad([w(0, 10, 8), w(3, 10, 8)], NOW);
	assert.equal(spiky?.status, 'varied');

	// nothing in the last 7 days → null
	assert.equal(weekLoad([w(10, 5, 7)], NOW), null);
});

const entry = (score: number, outcome?: number): LoggedReadinessCheck => ({
	at: 0,
	verdict: 'green',
	score,
	...(outcome != null ? { outcome } : {}),
});

test('readinessInsights: baseline, trend and outcome calibration', () => {
	// too little history → no personalization yet
	assert.deepEqual(readinessInsights([entry(70), entry(70)]), {
		baseline: null,
		trend: null,
		calibration: 0,
	});
	// baseline = rolling mean of recent scores
	assert.equal(
		readinessInsights([entry(60), entry(70), entry(80), entry(60), entry(70)]).baseline,
		68,
	);
	// a multi-day slide → 'down'
	const declining = [80, 80, 80, 80, 80, 50, 50, 50].map((s) => entry(s));
	assert.equal(readinessInsights(declining).trend, 'down');
	// consistently strong sessions on modest scores nudge calibration up (clamped to +12)
	const cal = [entry(50, 3), entry(50, 3), entry(50, 3), entry(50, 3)];
	assert.equal(readinessInsights(cal).calibration, 12);
});
