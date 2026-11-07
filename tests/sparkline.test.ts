// The one chart (#125's sweep, found on #117).
//
// Two things the athlete saw on Today: the bodyweight axis read "72 / 72" for a
// series from 71.6 to 72.4, two equal numbers for a top and a bottom, and the
// trend's current reading was a dot cut in half at the chart's right edge and
// stretched into an ellipse by the chart's `preserveAspectRatio="none"`.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { Sparkline } from '../src/components/ui/Sparkline.tsx';

const doc = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const pts = (values: number[]) => values.map((value, i) => ({ value, label: `d${i}` }));

describe('Sparkline', () => {
	test('labels a narrow series with a top and a bottom that differ', () => {
		const page = doc(
			renderToString(
				createElement(Sparkline, { points: pts([71.6, 72.1, 72.4]), locale: 'en-US' }),
			),
		);
		const axis = [...page.querySelectorAll('[data-axis] span')].map((s) => s.textContent);
		expect(axis).toHaveLength(2);
		expect(axis[0]).not.toBe(axis[1]);
		expect(axis).toEqual(['72.4', '71.6']);
	});

	test('keeps whole numbers for a series that spans them', () => {
		const page = doc(
			renderToString(createElement(Sparkline, { points: pts([58, 71, 79]), locale: 'en-US' })),
		);
		const axis = [...page.querySelectorAll('[data-axis] span')].map((s) => s.textContent);
		expect(axis).toEqual(['79', '58']);
	});

	test('draws the current reading as a round mark outside the stretched drawing', () => {
		const page = doc(
			renderToString(
				createElement(Sparkline, { points: pts([60, 70, 65]), current: 72, locale: 'en-US' }),
			),
		);
		// Not an SVG circle: under preserveAspectRatio="none" it is an ellipse,
		// and centred on the edge it is half clipped.
		expect(page.querySelector('svg circle')).toBeNull();
		const mark = page.querySelector('[data-current]');
		expect(mark).not.toBeNull();
		expect(mark?.getAttribute('style')).toMatch(/top:\s*\d/);
	});
});

// "The decimal mark is the locale's" (`lib/format.ts`). The axis printed
// `toFixed`, so a Brazilian athlete read 72.4 where every other number says 72,4
// (#113's review, S4).
describe('Sparkline in pt-BR', () => {
	test('writes the axis and the spoken series with a decimal comma', () => {
		const page = doc(
			renderToString(
				createElement(Sparkline, { points: pts([71.6, 72.1, 72.4]), locale: 'pt-BR' }),
			),
		);
		const axis = [...page.querySelectorAll('[data-axis] span')].map((s) => s.textContent);
		expect(axis).toEqual(['72,4', '71,6']);
		expect(page.querySelector('svg')?.getAttribute('aria-label')).toBe('d0 71,6, d1 72,1, d2 72,4');
	});

	test('keeps whole numbers whole', () => {
		const page = doc(
			renderToString(createElement(Sparkline, { points: pts([58, 71, 79]), locale: 'pt-BR' })),
		);
		const axis = [...page.querySelectorAll('[data-axis] span')].map((s) => s.textContent);
		expect(axis).toEqual(['79', '58']);
	});
});
