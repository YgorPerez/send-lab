// A verdict's state, the one map Today's read and Log's score dot both read
// (#120 built it for Log; #125 moved it out so Today could stop painting a good
// day in the library's vermilion).
import { describe, expect, test } from 'vitest';
import { getContent } from '../src/lib/content/index.ts';
import { verdictTone } from '../src/lib/format.ts';

describe('verdictTone', () => {
	test('says ok for a session trained as planned, warn for a capped one, stop for rest', () => {
		expect(verdictTone('green')).toBe('ok');
		expect(verdictTone('short')).toBe('ok');
		expect(verdictTone('moderate')).toBe('warn');
		expect(verdictTone('tissue')).toBe('warn');
		expect(verdictTone('rest')).toBe('stop');
	});

	test('covers every verdict the library has', () => {
		for (const id of Object.keys(getContent('en-US').verdicts)) {
			expect(['ok', 'warn', 'stop'], id).toContain(verdictTone(id as never));
		}
	});
});
