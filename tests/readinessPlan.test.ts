import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capByVerdict } from '../src/lib/readinessPlan';

// Real exercises with known params: maxhang = max-strength (hard), slopdens =
// tissue (recovery). The cap should keep recovery work and hold hard work.
test('capByVerdict caps the session by the readiness verdict', () => {
	const ex = ['maxhang', 'slopdens'];

	// green / short keep everything; rest holds everything
	assert.deepEqual(capByVerdict(ex, 'green'), { keep: ['maxhang', 'slopdens'], held: [] });
	assert.deepEqual(capByVerdict(ex, 'rest'), { keep: [], held: ['maxhang', 'slopdens'] });

	// moderate drops max-strength work, keeps the lighter tissue work
	assert.deepEqual(capByVerdict(ex, 'moderate'), { keep: ['slopdens'], held: ['maxhang'] });

	// tissue keeps only recovery-quality work
	assert.deepEqual(capByVerdict(ex, 'tissue'), { keep: ['slopdens'], held: ['maxhang'] });

	// unknown/custom ids survive any non-rest verdict
	assert.deepEqual(capByVerdict(['custom-x'], 'moderate'), { keep: ['custom-x'], held: [] });
});
