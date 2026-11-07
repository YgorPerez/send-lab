// Log as one timeline, a row per date (#120, spec #113 stories 60–64).
//
// What the athlete sees and does on Log: the title is the bar's word, the counts
// under it say what they count, every date is one row holding that day's score
// and session, the newest day is open, its score is coloured by its verdict, and
// from `lg` the open day's detail sits beside the timeline.
//
// String renders of the route over the seeded store for what is on screen, in
// both locales; a mounted route for what a tap does, en-US only. The mounted
// tests share this file's in-memory storage; nothing they do is stored.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { resolveLog } from '../src/lib/screens/log.ts';
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

/** Log's `<main>`, parsed, in `locale`. */
async function screen(locale: Locale): Promise<HTMLElement> {
	overwriteGetLocale(() => locale);
	const html = renderToString(
		createElement(RouterProvider, { router: await routerAt('/log') } as never),
	);
	const main = new DOMParser().parseFromString(html, 'text/html').querySelector('main');
	if (!main) throw new Error('no main');
	return main;
}

/** What the resolver says the timeline holds, in `locale`. */
const logIn = (locale: Locale) =>
	resolveLog(getContent(locale), readTrainingRecord(recordStore()), locale);

/** The timeline's rows: every disclosure in the page. */
const rowsOf = (main: ParentNode) => [
	...main.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'),
];

const text = (el: Element | null | undefined) =>
	(el?.textContent ?? '').replace(/\s+/g, ' ').trim();

const COPY = {
	'en-US': {
		title: 'Log',
		counts: (s: number, c: number) => `${s} sessions · ${c} readiness checks`,
		sets: 'sets',
		check: 'Readiness check',
		session: 'Session',
		noSession: 'No session',
		noNumbers: '1 set, no numbers recorded',
		sleep: 'How did you sleep?',
	},
	'pt-BR': {
		title: 'Registro',
		counts: (s: number, c: number) => `${s} sessões · ${c} checks de prontidão`,
		sets: 'séries',
		check: 'Check de prontidão',
		session: 'Sessão',
		noSession: 'Sem sessão',
		noNumbers: '1 série, sem números registrados',
		sleep: 'Como foi seu sono?',
	},
} as const;

for (const locale of ['en-US', 'pt-BR'] as const) {
	const copy = COPY[locale];

	describe(`${locale}, Log`, () => {
		test('is titled with the bar’s word, and its counts say what they count', async () => {
			const main = await screen(locale);
			const log = logIn(locale);
			expect(text(main.querySelector('h1'))).toBe(copy.title);
			// "28 · 15" said nothing about what was counted (spec #113 story 62).
			expect(text(main.querySelector('[data-screen-header]'))).toContain(
				copy.counts(log.counts.sessions, log.counts.checks),
			);
		});

		test('is one row per date, newest first, each with its score and its session', async () => {
			const main = await screen(locale);
			const log = logIn(locale);
			const rows = rowsOf(main);
			expect(rows).toHaveLength(log.days.length);
			rows.forEach((row, i) => {
				const day = log.days[i];
				const line = text(row);
				expect(line.startsWith(day.dateLabel), line).toBe(true);
				if (day.check) expect(line).toContain(String(day.check.score));
				if (day.session) {
					expect(line).toContain(day.session.dayType);
					expect(line).toContain(`${day.session.setCount} ${copy.sets}`);
				} else {
					expect(line).toContain(copy.noSession);
				}
			});
		});

		test('colours each score by its verdict, never vermilion for a good one', async () => {
			const main = await screen(locale);
			const log = logIn(locale);
			const TONE = { ok: 'bg-teal', warn: 'bg-gold', stop: 'bg-flag' } as const;
			const rows = rowsOf(main);
			let scored = 0;
			rows.forEach((row, i) => {
				const check = log.days[i].check;
				const mark = row.querySelector('[data-score-tone]');
				if (!check) {
					expect(mark).toBeNull();
					return;
				}
				scored++;
				expect(mark?.getAttribute('class')).toContain(TONE[check.tone]);
				if (check.verdictId === 'green' || check.verdictId === 'short') {
					expect(mark?.getAttribute('class')).not.toContain('flag');
				}
			});
			expect(scored).toBe(log.counts.checks);
		});

		// The closed row already says what the day was; a phone opens on the
		// timeline, not on 650px of one day (#120 critique).
		test('opens on the timeline: no day is open on arrival', async () => {
			const main = await screen(locale);
			expect(rowsOf(main).every((r) => r.getAttribute('aria-expanded') === 'false')).toBe(true);
		});

		test('heads the timeline, so the page’s headings descend one rank at a time', async () => {
			const main = await screen(locale);
			const ranks = [...main.querySelectorAll('h1, h2, h3, h4')].map((h) => Number(h.tagName[1]));
			ranks.forEach((rank, i) => {
				if (i > 0) expect(rank, `heading ${i}`).toBeLessThanOrEqual(ranks[i - 1] + 1);
			});
		});

		// The closed row says "5 sets"; what it opens to accounts for all five, so
		// an exercise logged without numbers says so instead of a bare name.
		test('accounts for every set it counts, numbers or not', async () => {
			const main = await screen(locale);
			const exercises = [...main.querySelectorAll('[data-day-detail] [data-exercise]')];
			expect(exercises.length).toBeGreaterThan(0);
			for (const ex of exercises) {
				const told = ex.querySelector('table') ?? ex.querySelector('[data-no-numbers]');
				expect(told, text(ex)).not.toBeNull();
			}
			expect(text(main.querySelector('[data-day-detail] [data-no-numbers]'))).toBe(copy.noNumbers);
		});

		test('puts the open day beside the timeline from lg, headed by its date', async () => {
			const main = await screen(locale);
			const log = logIn(locale);
			const beside = main.querySelector('[data-day-detail]');
			expect(beside).not.toBeNull();
			// A desktop pane only: below `lg` the detail is the open row's own.
			expect(beside?.getAttribute('class')).toMatch(/(^|\s)hidden(\s|$)/);
			expect(text(beside?.querySelector('h2'))).toBe(log.days[0].fullDate);
			expect(beside?.querySelector('table')).not.toBeNull();
			// A section named by its date (a region), reachable by keyboard: it scrolls inside
			// itself when the day is taller than the window.
			expect(beside?.tagName).toBe('SECTION');
			const named = main.querySelector(`[id="${beside?.getAttribute('aria-labelledby')}"]`);
			expect(text(named)).toBe(log.days[0].fullDate);
			expect(beside?.getAttribute('tabindex')).toBe('0');
		});
	});
}

describe('Log, mounted', () => {
	let root: Root | null = null;

	beforeAll(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		overwriteGetLocale(() => 'en-US');
	});
	afterEach(() => {
		if (root) act(() => root?.unmount());
		root = null;
		vi.restoreAllMocks();
	});

	async function mount() {
		const router = await routerAt('/log');
		root = createRoot(document);
		act(() => root?.render(createElement(RouterProvider, { router } as never)));
	}
	const main = () => document.querySelector('main') as HTMLElement;
	const besideHeading = () => text(main().querySelector('[data-day-detail] h2'));

	test('a tap opens a day, the next closes it, and the pane beside keeps the last one', async () => {
		await mount();
		const log = logIn('en-US');
		const [first, second] = rowsOf(main());
		expect(besideHeading()).toBe(log.days[0].fullDate);

		act(() => second.click());
		expect(second.getAttribute('aria-expanded')).toBe('true');
		expect(besideHeading()).toBe(log.days[1].fullDate);
		const panel = main().querySelector(`[id="${second.getAttribute('aria-controls')}"]`);
		expect(text(panel)).toContain('Readiness check');

		act(() => first.click());
		expect(first.getAttribute('aria-expanded')).toBe('true');
		expect(second.getAttribute('aria-expanded')).toBe('false');
		expect(besideHeading()).toBe(log.days[0].fullDate);

		// Closing the open day leaves the pane on it: a wide screen never shows
		// an empty second pane.
		act(() => first.click());
		expect(rowsOf(main()).every((r) => r.getAttribute('aria-expanded') === 'false')).toBe(true);
		expect(besideHeading()).toBe(log.days[0].fullDate);
	});

	// The timeline is the end of the page on a phone, so closing a day there
	// would shorten the page under the scroll position and the browser would
	// clamp it (#119's finding on the Timer). jsdom lays nothing out, so the
	// geometry is told to it.
	test('closing a day near the end keeps the page as long as it was', async () => {
		await mount();
		const page = document.documentElement;
		Object.defineProperty(page, 'scrollHeight', { configurable: true, value: 3000 });
		Object.defineProperty(window, 'scrollY', { configurable: true, value: 2100 });
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
		try {
			const [first] = rowsOf(main());
			act(() => first.click());
			const panel = document.getElementById(first.getAttribute('aria-controls') ?? '');
			if (!panel) throw new Error('the newest day is not open');
			vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({ height: 500, top: 0 } as DOMRect);

			// 100px of page below the screen, a 500px day closing: 400px kept.
			act(() => first.click());
			expect(first.getAttribute('aria-expanded')).toBe('false');
			expect(main().querySelector<HTMLElement>('[data-tail]')?.style.height).toBe('400px');
		} finally {
			Reflect.deleteProperty(page, 'scrollHeight');
			Reflect.deleteProperty(window, 'scrollY');
		}
	});

	// A day above the tapped one closing would slide the tapped head up by the
	// closed day's height: the page scrolls with it so the head stays put.
	test('opening a day below the open one keeps the tapped head under the finger', async () => {
		await mount();
		const [first, second] = rowsOf(main());
		act(() => first.click());
		let top = 400;
		vi.spyOn(second, 'getBoundingClientRect').mockImplementation(() => ({ top }) as DOMRect);
		const scrolled = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});

		act(() => second.click());
		// The day above has closed: the head is 300px higher than it was.
		top = 100;
		await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
		expect(scrolled).toHaveBeenCalledWith(0, -300);
	});
});
