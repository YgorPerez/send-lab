// The scope rule the three ephemeral stores share — #59.
//
// The timer, the readiness draft and the session draft all persist something the
// athlete is in the middle of, and all three are only meaningful *while the thing
// they belong to is still the thing on screen*: yesterday's half-answered
// readiness check, the session draft for a slot the athlete has left, a clock
// configured for a different exercise. Restoring any of those looks like the app
// remembering, and is the app lying.
//
// It was one hand-written day comparison in `readinessDraft.ts` before this. Three
// copies of it would be three chances to compare the wrong field — and one of them
// already had that bug: a legacy branch matched a stored *localized* date against a
// freshly formatted one, which cannot match across a language switch (#55).
import { describe, expect, it } from 'vitest';
import { inScope, scoped } from '../src/lib/ephemeral.ts';

describe('what a stored value is still good for', () => {
	it('hands back the value when the scope is unchanged', () => {
		expect(inScope(scoped('2026-09-01', { answers: { sleep: 3 } }), '2026-09-01')).toEqual({
			answers: { sleep: 3 },
		});
	});

	it('hands back nothing when the scope has moved on', () => {
		// The readiness draft's whole reason for existing: it resets on a new day
		// rather than offering yesterday's answers as today's.
		expect(inScope(scoped('2026-08-31', { answers: { sleep: 3 } }), '2026-09-01')).toBeUndefined();
	});

	it('hands back nothing when there is nothing stored', () => {
		expect(inScope(undefined, '2026-09-01')).toBeUndefined();
	});

	it('refuses a value stored without a scope', () => {
		// An older build's shape, or a hand-edited key. Without this it would be
		// read as in-scope for whatever is being asked, which is the one answer
		// that is never safe.
		expect(inScope({ value: { answers: {} } } as never, '2026-09-01')).toBeUndefined();
		expect(inScope({ scope: 7, value: {} } as never, '2026-09-01')).toBeUndefined();
	});

	it('compares scopes exactly, not loosely', () => {
		// `'1'` and `1` are the same day to `==`. Slot keys and protocol keys are
		// strings that can look numeric, and a loose comparison here would restore
		// one exercise's clock onto another.
		expect(inScope(scoped('1', { a: 1 }), '01')).toBeUndefined();
	});

	it('survives a value that is legitimately falsy', () => {
		// `0`, `''` and `false` are all real stored values. An implementation that
		// tested the value for truthiness rather than the scope for equality would
		// silently discard them.
		expect(inScope(scoped('s', 0), 's')).toBe(0);
		expect(inScope(scoped('s', ''), 's')).toBe('');
		expect(inScope(scoped('s', false), 's')).toBe(false);
	});
});
