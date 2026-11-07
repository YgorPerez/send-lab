// The browser gates' navigation: is the page on screen the one asked for?
//
// `goto` in `scripts/browser.ts` waited for the document to have lived
// `settleMs` and nothing else, so a page on another route than the one asked for
// (the previous one, `about:blank`, a redirect) was measured as that route. The
// document must also be at the URL asked for (#113's review, S2). `browser.ts` itself cannot load under
// Vitest (`scripts/routes.ts` says why), so the comparison is its own module.
import { describe, expect, test } from 'vitest';
import { landedOn } from '../scripts/landed.ts';

const origin = 'http://127.0.0.1:4173';

describe('landedOn', () => {
	test('accepts the page asked for', () => {
		expect(landedOn(`${origin}/log`, `${origin}/log`)).toBe(true);
		expect(landedOn(`${origin}/`, `${origin}/`)).toBe(true);
	});

	test('does not accept a blank page or the previous route', () => {
		expect(landedOn(`${origin}/log`, 'about:blank')).toBe(false);
		expect(landedOn(`${origin}/log`, `${origin}/`)).toBe(false);
		expect(landedOn(`${origin}/settings`, `${origin}/settings-old`)).toBe(false);
		expect(landedOn(`${origin}/log`, 'http://127.0.0.1:9999/log')).toBe(false);
	});

	test('reads a trailing slash and a fragment as the same page', () => {
		expect(landedOn(`${origin}/log`, `${origin}/log/`)).toBe(true);
		expect(landedOn(`${origin}/log/`, `${origin}/log`)).toBe(true);
		expect(landedOn(`${origin}/log`, `${origin}/log#today`)).toBe(true);
	});

	test('does not accept a different query', () => {
		expect(landedOn(`${origin}/log?day=1`, `${origin}/log`)).toBe(false);
	});

	test('does not accept nothing', () => {
		expect(landedOn(`${origin}/log`, undefined)).toBe(false);
		expect(landedOn(`${origin}/log`, '')).toBe(false);
	});
});
