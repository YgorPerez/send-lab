import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adherenceRatio, capByVerdict, pendingExercises } from '../src/lib/readinessPlan';

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

test('pendingExercises returns scheduled work not yet trained', () => {
	// fully skipped → everything pending
	assert.deepEqual(pendingExercises(['a', 'b', 'c'], []), ['a', 'b', 'c']);
	// partial → only the undone ones (held / unfinished work)
	assert.deepEqual(pendingExercises(['a', 'b', 'c'], ['b']), ['a', 'c']);
	// all done → nothing pending
	assert.deepEqual(pendingExercises(['a', 'b'], ['a', 'b']), []);
});

test('adherenceRatio eases progression off a deviation, gently', () => {
	// full or untracked weeks earn full credit (no surprise load drop)
	assert.equal(adherenceRatio(5, 5), 1);
	assert.equal(adherenceRatio(0, 5), 1);
	assert.equal(adherenceRatio(0, 0), 1);
	// a partial week scales down, but is floored at half a build-week
	assert.equal(adherenceRatio(3, 5), 0.6);
	assert.equal(adherenceRatio(1, 5), 0.5);
});
