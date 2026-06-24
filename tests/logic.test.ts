import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeReadiness, phaseId, scoreDeep, visibleQuestions } from '../src/lib/content/logic';

// readiness score is exercised through computeReadiness().score (the engine's output).
const score = (a: Record<string, number>) => computeReadiness(a).score;

test('readiness score normalizes weighted wellness to 0–100', () => {
	assert.equal(score({ sleep: 10, fatigue: 10, soreness: 10, stress: 10, mood: 10 }), 100);
	assert.equal(score({ sleep: 0, fatigue: 0, soreness: 0, stress: 0, mood: 0 }), 0);
	// unasked stress/mood default to neutral-good (8) so the score stays comparable
	const a = score({ sleep: 10, fatigue: 10, soreness: 10 });
	assert.ok(a >= 90 && a <= 95);
	// sleep & fatigue are weighted heavier than mood
	const lowSleep = score({ sleep: 0, fatigue: 10, soreness: 10, stress: 10, mood: 10 });
	const lowMood = score({ sleep: 10, fatigue: 10, soreness: 10, stress: 10, mood: 0 });
	assert.ok(lowSleep < lowMood);
});

test('computeReadiness: fresh + time + nothing hurting → green', () => {
	const r = computeReadiness({ sleep: 10, fatigue: 10, soreness: 10, body: 0, time: 10 });
	assert.equal(r.verdict, 'green');
	assert.equal(r.area, null);
	assert.deepEqual(r.flags, []);
});

test('computeReadiness: fresh but no time → short', () => {
	assert.equal(
		computeReadiness({ sleep: 10, fatigue: 10, soreness: 10, body: 0, time: 3 }).verdict,
		'short',
	);
});

test('computeReadiness: poor wellness → tissue', () => {
	assert.equal(
		computeReadiness({ sleep: 0, fatigue: 0, soreness: 0, body: 0, time: 10 }).verdict,
		'tissue',
	);
});

test('computeReadiness: injury gates the verdict, area-specific', () => {
	// sharp finger pain is a hard stop regardless of wellness
	const sharp = computeReadiness({ sleep: 10, fatigue: 10, soreness: 10, body: 1, severity: 3 });
	assert.equal(sharp.verdict, 'rest');
	assert.equal(sharp.area, 'fingers');
	assert.equal(sharp.flags[0].id, 'finger_pain');

	// a painful shoulder caps an otherwise-green day to tissue, with shoulder advice
	const shoulder = computeReadiness({
		sleep: 10,
		fatigue: 10,
		soreness: 10,
		body: 3,
		severity: 2,
		time: 10,
	});
	assert.equal(shoulder.verdict, 'tissue');
	assert.equal(shoulder.area, 'shoulder');
	assert.equal(shoulder.flags[0].id, 'shoulder_pain');
	assert.equal(shoulder.flags[0].area, 'shoulder');

	// a tender elbow only downgrades to moderate
	const elbow = computeReadiness({
		sleep: 10,
		fatigue: 10,
		soreness: 10,
		body: 2,
		severity: 1,
		time: 10,
	});
	assert.equal(elbow.verdict, 'moderate');
	assert.equal(elbow.flags[0].id, 'elbow_niggle');
});

test('computeReadiness: an ACWR spike caps intensity to moderate', () => {
	const r = computeReadiness({ sleep: 10, fatigue: 10, soreness: 10, body: 0, time: 10 }, 'spike');
	assert.equal(r.verdict, 'moderate');
	assert.ok(r.flags.some((f) => f.id === 'acwr_spike'));
});

test('computeReadiness: personal history (calibration / trend / baseline) adjusts it', () => {
	const fresh = { sleep: 10, fatigue: 10, soreness: 10, body: 0, time: 10 };
	// a declining trend caps a green day to moderate and flags it
	const declining = computeReadiness(fresh, null, { trend: 'down' });
	assert.equal(declining.verdict, 'moderate');
	assert.ok(declining.flags.some((f) => f.id === 'readiness_declining'));
	// calibration shifts the score directly
	const base = computeReadiness(fresh).score;
	assert.equal(computeReadiness(fresh, null, { calibration: -12 }).score, base - 12);
	// a meaningful drop below the personal baseline is surfaced
	const low = computeReadiness({ sleep: 3, fatigue: 3, soreness: 3, body: 0, time: 10 }, null, {
		baseline: 90,
	});
	assert.ok(low.flags.some((f) => f.id === 'below_baseline'));
});

test('visibleQuestions: follow-ups appear only when they change the outcome', () => {
	// fresh day: core + skin (a hard day is on the table), no severity/stress/mood
	const fresh = visibleQuestions({ sleep: 10, fatigue: 10, soreness: 10, body: 0, time: 10 });
	assert.ok(!fresh.includes('severity'));
	assert.ok(!fresh.includes('stress'));
	assert.ok(fresh.includes('skin'));

	// something hurts → ask severity
	assert.ok(visibleQuestions({ body: 2 }).includes('severity'));

	// poor sleep → ask stress + mood; no hard day → no skin
	const tired = visibleQuestions({ sleep: 0, fatigue: 4, soreness: 5, body: 0, time: 10 });
	assert.ok(tired.includes('stress') && tired.includes('mood'));
	assert.ok(!tired.includes('skin'));
});

test('scoreDeep normalizes 0–10 answers to 0–100 and bands them', () => {
	assert.deepEqual(scoreDeep([10, 10, 10]), { score: 100, band: 'manageable', stage: 'returning' });
	assert.deepEqual(scoreDeep([0, 0, 0]), { score: 0, band: 'significant', stage: 'acute' });
	assert.equal(scoreDeep([6, 6, 6, 6, 6]).band, 'moderate');
	assert.equal(scoreDeep([]).score, 0);
});

test('phaseId scales phases to block length, last week is deload', () => {
	assert.equal(phaseId(1), 'phase1');
	assert.equal(phaseId(5), 'phase2');
	assert.equal(phaseId(8), 'deload');
	assert.equal(phaseId(4, 4), 'deload');
});
