import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	computeVerdictId,
	dailyFlags,
	phaseId,
	readinessScore,
	scoreDeep,
} from '../src/lib/content/logic';

test('readinessScore sums the general-readiness answers + fatigue only', () => {
	assert.equal(readinessScore({ recovery: 2, fingers: 2, slot: 2, skin: 1, cns: 1 }), 8);
	assert.equal(readinessScore({ recovery: 2, fingers: 2, slot: 2, skin: 1, cns: 1 }, -3), 5);
	// elbow/shoulder drive flags, not the score
	assert.equal(readinessScore({ elbow: 5, shoulder: 5 }), 0);
	assert.equal(readinessScore({}), 0);
});

test('scoreDeep normalizes 0–10 answers to 0–100 and bands them', () => {
	assert.deepEqual(scoreDeep([10, 10, 10]), { score: 100, band: 'manageable', stage: 'returning' });
	assert.deepEqual(scoreDeep([0, 0, 0]), { score: 0, band: 'significant', stage: 'acute' });
	// band boundaries: >=80 manageable, >=60 moderate, else significant
	assert.deepEqual(scoreDeep([8, 8, 8, 8, 8]), {
		score: 80,
		band: 'manageable',
		stage: 'returning',
	});
	assert.deepEqual(scoreDeep([6, 6, 6, 6, 6]), { score: 60, band: 'moderate', stage: 'subacute' });
	assert.equal(scoreDeep([5, 5, 5, 5, 5]).band, 'significant');
	assert.equal(scoreDeep([]).score, 0); // no division by zero
});

test('computeVerdictId follows the readiness thresholds', () => {
	assert.equal(computeVerdictId({ fingers: -5 }), 'rest'); // sharp finger pain wins
	assert.equal(computeVerdictId({ fingers: -2 }), 'tissue'); // tender fingers
	assert.equal(computeVerdictId({ elbow: -3 }), 'tissue'); // joint pain
	assert.equal(computeVerdictId({ recovery: -2, fingers: 0, slot: 0, skin: 0, cns: 0 }), 'tissue'); // score <= -2
	assert.equal(computeVerdictId({ recovery: 0, fingers: 1, slot: 1, skin: 0, cns: 0 }), 'moderate'); // score = 2
	assert.equal(computeVerdictId({ recovery: 2, fingers: 2, slot: 0, skin: 1, cns: 1 }), 'short'); // good but no time
	assert.equal(computeVerdictId({ recovery: 2, fingers: 2, slot: 2, skin: 1, cns: 1 }), 'green');
	// objective fatigue drags an otherwise-green day down
	assert.equal(
		computeVerdictId({ recovery: 2, fingers: 2, slot: 2, skin: 1, cns: 1 }, -10),
		'tissue',
	);
});

test('dailyFlags surfaces the right targeted problems', () => {
	assert.deepEqual(dailyFlags({ fingers: -5 })[0], {
		id: 'finger_pain',
		severity: 'stop',
		area: 'fingers',
	});
	assert.deepEqual(dailyFlags({ elbow: -2 })[0], {
		id: 'elbow_niggle',
		severity: 'warn',
		area: 'elbow',
	});
	const many = dailyFlags({ skin: -2, recovery: -2, cns: -2 });
	assert.deepEqual(
		many.map((f) => f.id),
		['skin', 'fatigue', 'cns'],
	);
	assert.deepEqual(dailyFlags({}, -3), [{ id: 'load', severity: 'info' }]); // objective fatigue
	assert.deepEqual(dailyFlags({ recovery: 2, fingers: 2 }), []); // nothing wrong
});

test('phaseId scales phases to block length, last week is deload', () => {
	assert.equal(phaseId(1), 'phase1');
	assert.equal(phaseId(4), 'phase1');
	assert.equal(phaseId(5), 'phase2');
	assert.equal(phaseId(8), 'deload');
	assert.equal(phaseId(4, 4), 'deload'); // shorter block
	assert.equal(phaseId(3, 4), 'phase2');
});
