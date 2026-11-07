// Week: the glossary heading, readable slot states, the day under the grid
// (#121, spec #113 stories 65–68).
//
// What the athlete sees and does on Week: the grid is headed "training week",
// never "Microcycle" or a bare "week"; each slot's state is a mark that can be
// told apart by its shape as well as its colour, with a legend; and the selected
// slot's day sits directly under the grid.
//
// String renders of the route over the seeded store for what is on screen, in
// both locales; a mounted route for what a tap does, en-US only. The seeded
// Thursday of week 5 has Mon–Wed missed, Thu today, Fri and Sat to come, Sun rest.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { resolveWeek } from '../src/lib/screens/week.ts';
import { readTrainingRecord, recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import { routeTree } from '../src/routeTree.gen.ts';

const THURSDAY = new Date(PINNED_NOW);

beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(THURSDAY);
	resetRecordStore();
	seedRecordStore(recordStore(), getContent('en-US'), 'en-US', THURSDAY.getTime());
});

afterAll(() => {
	vi.useRealTimers();
	resetRecordStore();
});

type Locale = 'en-US' | 'pt-BR';

async function routerAt(path: string) {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	await router.load();
	return router;
}

/** Week's `<main>`, parsed, in `locale`. */
async function screen(locale: Locale): Promise<HTMLElement> {
	overwriteGetLocale(() => locale);
	const html = renderToString(
		createElement(RouterProvider, { router: await routerAt('/week') } as never),
	);
	const main = new DOMParser().parseFromString(html, 'text/html').querySelector('main');
	if (!main) throw new Error('no main');
	return main;
}

const weekIn = (locale: Locale) =>
	resolveWeek(getContent(locale), readTrainingRecord(recordStore()), THURSDAY.getTime());

const text = (el: Element | null | undefined) =>
	(el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The grid's cells: one toggle per slot. */
const cellsOf = (main: ParentNode) => [
	...main.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'),
];

/** Everything Week says, to the eye and to a screen reader. */
const copyOf = (main: Element) =>
	[
		text(main),
		...[...main.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label')),
	].join(' ');

const COPY = {
	'en-US': {
		title: 'Week',
		heading: 'Training week 5 of 8',
		// `CONTEXT.md` › Training week: _Avoid_: microcycle, week. "Week" alone is
		// the page's name in the bar (spec #113 story 3), so only the title says it.
		avoided: /microcycle|(?<!training )\bweek\b/i,
		states: ['Trained', 'Missed', 'Today', 'To come', 'Rest'],
	},
	'pt-BR': {
		title: 'Semana',
		heading: 'Semana de treino 5 de 8',
		avoided: /microciclo|\bsemana\b(?! de treino)/i,
		states: ['Treinado', 'Perdido', 'Hoje', 'A fazer', 'Descanso'],
	},
} as const;

for (const locale of ['en-US', 'pt-BR'] as const) {
	const copy = COPY[locale];

	describe(`${locale}, Week`, () => {
		test('heads the grid "training week" and says no avoided term anywhere else', async () => {
			const main = await screen(locale);
			const h1 = main.querySelector('h1');
			expect(text(h1)).toBe(copy.title);
			// The grid's own head names the week it shows, so the header does not
			// say "Week" a second time beside the title.
			expect(text(main.querySelector('[data-screen-header]'))).not.toMatch(/\d\s*\/\s*8/);
			const grid = main.querySelector('[data-week-grid]');
			expect(text(grid?.closest('section')?.querySelector('h2'))).toBe(copy.heading);

			h1?.remove();
			expect(copyOf(main)).not.toMatch(copy.avoided);
		});

		test('marks each slot’s state with a mark the legend names, and says it all aloud', async () => {
			const main = await screen(locale);
			const week = weekIn(locale);
			const legend = [...main.querySelectorAll('[data-slot-legend] li')];
			expect(legend.map(text)).toEqual(copy.states);
			const markFor = new Map(
				legend.map((entry) => {
					const mark = entry.querySelector('[data-slot-mark]');
					return [mark?.getAttribute('data-state'), mark?.outerHTML] as const;
				}),
			);
			expect(markFor.size).toBe(5);

			const cells = cellsOf(main);
			expect(cells).toHaveLength(7);
			cells.forEach((cell, i) => {
				const slot = week.slots[i];
				// The cell draws the legend's own mark for its state, so one shape
				// means one thing on the whole page.
				const marks = cell.querySelectorAll('[data-slot-mark]');
				expect(marks).toHaveLength(1);
				expect(marks[0].outerHTML).toBe(markFor.get(slot.state));
				// `aria-label` replaces the content, so it carries all of it.
				const label = cell.getAttribute('aria-label') ?? '';
				const done = slot.tasks.filter((t) => t.done).length;
				for (const part of [
					slot.weekdayLabel,
					slot.day.type,
					copy.states[STATES.indexOf(slot.state)],
				])
					expect(label).toContain(part);
				if (!slot.isRestDay) expect(label).toContain(`${done}/${slot.tasks.length}`);
			});
			// A rest slot says rest once, not once per field that holds the word.
			const sunday = cells[6].getAttribute('aria-label') ?? '';
			expect(sunday.split(' · ')).toEqual([...new Set(sunday.split(' · '))]);
			// The seeded week shows four of the five states.
			expect(new Set(week.slots.map((s) => s.state))).toEqual(
				new Set(['missed', 'today', 'ahead', 'rest']),
			);
		});

		test('draws five marks told apart by shape, each 3:1 on every cell surface', async () => {
			const main = await screen(locale);
			const marks = [...main.querySelectorAll('[data-slot-legend] [data-slot-mark]')];
			// Shape alone separates them: the drawing inside the mark, colour aside.
			expect(new Set(marks.map((m) => m.innerHTML)).size).toBe(5);
			for (const mark of marks)
				expect(Number(mark.getAttribute('width'))).toBeGreaterThanOrEqual(10);

			const surfaces = new Set(cellsOf(main).map((c) => tokenOf(c, 'bg')));
			// An unselected cell and the selected one.
			expect(surfaces.size).toBe(2);
			for (const mark of marks) {
				for (const surface of surfaces) {
					const ratio = contrast(hexOf(tokenOf(mark, 'text')), hexOf(surface));
					expect(ratio, `${mark.getAttribute('data-state')} on ${surface}`).toBeGreaterThanOrEqual(
						3,
					);
				}
			}
		});
	});
}

describe('Week, the selected day', () => {
	for (const locale of ['en-US', 'pt-BR'] as const) {
		test(`${locale}: sits directly under the grid, with its day type, headline and tasks`, async () => {
			const main = await screen(locale);
			const week = weekIn(locale);
			const grid = main.querySelector('[data-week-grid]');
			const day = main.querySelector('[data-slot-day]');
			if (!grid || !day) throw new Error('no grid or no day');
			// Nothing between them in the phone's reading order (Panes keeps the
			// DOM order on a phone): not the legend, not a heading, not a line.
			const between = main.ownerDocument.createRange();
			between.setStartAfter(grid);
			between.setEndBefore(day);
			expect(between.toString().trim()).toBe('');

			const thursday = week.slots.find((s) => s.weekday === 'Thu');
			if (!thursday) throw new Error('no Thursday');
			const shown = text(day);
			expect(shown).toContain(thursday.weekdayLabel);
			expect(shown).toContain(thursday.day.type);
			expect(shown).toContain(thursday.day.headline);
			for (const task of thursday.tasks) expect(shown).toContain(task.exName);
			// Each cell says which region it changes.
			for (const cell of cellsOf(main)) expect(cell.getAttribute('aria-controls')).toBe(day.id);
		});
	}
});

describe('Week, mounted', () => {
	let root: Root | null = null;

	beforeAll(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		overwriteGetLocale(() => 'en-US');
	});
	afterEach(() => {
		if (root) act(() => root?.unmount());
		root = null;
	});

	test('a tap on a slot shows that slot under the grid', async () => {
		const router = await routerAt('/week');
		root = createRoot(document);
		act(() => root?.render(createElement(RouterProvider, { router } as never)));
		const main = document.querySelector('main') as HTMLElement;
		const week = weekIn('en-US');
		const friday = week.slots.find((s) => s.weekday === 'Fri');
		if (!friday) throw new Error('no Friday');

		const cells = cellsOf(main);
		const fri = cells.find((c) => c.getAttribute('aria-label')?.startsWith('Fri'));
		expect(cells.filter((c) => c.getAttribute('aria-pressed') === 'true').map(text)).toEqual([
			expect.stringContaining('Thu'),
		]);
		act(() => fri?.click());
		expect(fri?.getAttribute('aria-pressed')).toBe('true');
		expect(cells.filter((c) => c.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
		const shown = text(main.querySelector('[data-slot-day]'));
		expect(shown).toContain(friday.day.type);
		for (const task of friday.tasks) expect(shown).toContain(task.exName);
	});
});

const STATES = ['trained', 'missed', 'today', 'ahead', 'rest'] as const;

/** The colour token a class list paints with, for one Tailwind prefix. */
function tokenOf(el: Element, prefix: 'bg' | 'text'): string {
	const classes = (el.getAttribute('class') ?? '').split(/\s+/);
	const token = classes
		.filter((c) => !c.includes(':'))
		.map((c) => c.match(new RegExp(`^${prefix}-([a-z]+(?:-[a-z0-9]+)*)$`))?.[1])
		.find((t) => t && hexOf(t, false));
	if (!token) throw new Error(`no ${prefix} colour on ${el.outerHTML.slice(0, 120)}`);
	return token;
}

const CSS = readFileSync(join(process.cwd(), 'src', 'app.css'), 'utf8');

/** A colour token's hex, following `var()` through `app.css`. */
function hexOf(token: string, strict = true): string {
	const value = CSS.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1].trim();
	if (!value) {
		if (strict) throw new Error(`no --${token} in app.css`);
		return '';
	}
	const alias = value.match(/^var\(--([a-z0-9-]+)\)$/);
	return alias ? hexOf(alias[1], strict) : value;
}

function contrast(a: string, b: string): number {
	const lum = (hex: string) => {
		const [r, g, b] = [1, 3, 5].map((i) => {
			const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
			return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}
