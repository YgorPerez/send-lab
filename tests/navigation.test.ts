// The navigation at the thumb (#115, spec #113 stories 1–20).
//
// On a phone the four places a training day moves between sit in a bar on the
// bottom edge, with More opening a sheet for the rest; from `lg` the same element
// is a rail listing everything. These assert what the athlete can see and reach,
// over the real route tree in both locales: which destinations the bar holds,
// which one it marks, what More holds, that the strip lost its locale switch, and
// that the intake has the screen to itself.
//
// Layout is not provable here (jsdom has no layout engine). Which items show at
// which width is a `lg:` utility on one element (ADR 0018), so that half is
// asserted as the classes that decide it, and measured in a browser by the four
// gates with and without `--desktop`.
import {
	createMemoryHistory,
	createRouter,
	RouterContextProvider,
	RouterProvider,
} from '@tanstack/react-router';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { Navigation } from '../src/components/Navigation.tsx';
import { chromeFor } from '../src/lib/chrome.ts';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import { routeTree } from '../src/routeTree.gen.ts';

beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(PINNED_NOW));
	resetRecordStore();
	seedRecordStore(recordStore(), getContent('en-US'), 'en-US', new Date(PINNED_NOW).getTime());
});

afterAll(() => {
	vi.useRealTimers();
	resetRecordStore();
});

async function render(path: string): Promise<string> {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	await router.load();
	return renderToString(createElement(RouterProvider, { router } as never));
}

/** The one `<nav>` in the page, or `''` when there is none. */
function navOf(html: string): string {
	const from = html.indexOf('<nav');
	if (from === -1) return '';
	return html.slice(from, html.indexOf('</nav>', from) + '</nav>'.length);
}

/** The opening tag of the link to `href` inside `scope`. */
function linkTo(scope: string, href: string): string {
	const tag = new RegExp(`<a[^>]*href="${href.replace('/', '\\/')}"[^>]*>`).exec(scope)?.[0];
	expect(tag, `no link to ${href}`).toBeTruthy();
	return tag ?? '';
}

/** The opening tag of the More control inside `scope`. */
function moreOf(scope: string, label: string): string {
	const tag = new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`).exec(scope)?.[0];
	expect(tag, 'no More control in the bar').toBeTruthy();
	return tag ?? '';
}

const COPY = {
	'en-US': {
		bar: ['Today', 'Train', 'Timer', 'Log'],
		more: 'More',
		rest: ['Week', 'Settings'],
		languages: ['English', 'Português (BR)'],
	},
	'pt-BR': {
		bar: ['Hoje', 'Treinar', 'Timer', 'Registro'],
		more: 'Mais',
		rest: ['Semana', 'Ajustes'],
		languages: ['English', 'Português (BR)'],
	},
} as const;

const BAR = ['/', '/train', '/timer', '/log'] as const;
const IN_MORE = ['/week', '/settings'] as const;

for (const locale of ['en-US', 'pt-BR'] as const) {
	describe(`the navigation, in ${locale}`, () => {
		const copy = COPY[locale];
		beforeEach(() => overwriteGetLocale(() => locale));

		test('the bar holds the four places a training day moves between, and More', async () => {
			const nav = navOf(await render('/'));
			expect(nav, 'the shell rendered no <nav>').not.toBe('');
			for (const href of BAR) linkTo(nav, href);
			for (const label of copy.bar) expect(nav, label).toContain(`>${label}<`);
			expect(moreOf(nav, copy.more)).toBeTruthy();
			// One landmark, named.
			expect(nav).toMatch(/^<nav[^>]*aria-label="[^"]+"/);
		});

		test('it marks the destination it is on, and only that one', async () => {
			for (const here of BAR) {
				const nav = navOf(await render(here));
				for (const href of [...BAR, ...IN_MORE]) {
					const tag = linkTo(nav, href);
					if (href === here) expect(tag, href).toContain('aria-current="page"');
					else expect(tag, `${href} on ${here}`).not.toContain('aria-current');
				}
				expect(moreOf(nav, copy.more)).not.toContain('aria-current');
			}
		});

		// Story 6: the bar never shows the athlete as nowhere.
		test('More is marked current on the destinations it holds', async () => {
			for (const here of IN_MORE) {
				const nav = navOf(await render(here));
				expect(moreOf(nav, copy.more), here).toContain('aria-current="true"');
				for (const href of BAR) expect(linkTo(nav, href)).not.toContain('aria-current');
			}
		});

		// Sign-in is reached from Settings, so it is Settings' place: the bar never
		// shows the athlete as nowhere (story 6), not even on a page it has no row for.
		test('sign-in is marked as Settings, under More', async () => {
			const nav = navOf(await render('/login'));
			expect(moreOf(nav, copy.more)).toContain('aria-current="true"');
			expect(linkTo(nav, '/settings')).toContain('aria-current="page"');
		});

		// Story 15: the rail lists everything, so More is hidden there and its
		// rows are in the same element, hidden below `lg`. One DOM, two stylesheets.
		test('the rail lists every destination, and More is the bar’s alone', async () => {
			const nav = navOf(await render('/'));
			for (const [i, href] of IN_MORE.entries()) {
				const tag = linkTo(nav, href);
				expect(tag, href).toMatch(/\bhidden\b/);
				expect(tag, href).toMatch(/\blg:flex\b/);
				expect(nav).toContain(`>${copy.rest[i]}<`);
			}
			expect(moreOf(nav, copy.more)).toMatch(/\blg:hidden\b/);
		});

		// Story 8: every bar target is at least 48px.
		test('every bar target is at least 48px tall', async () => {
			const nav = navOf(await render('/'));
			for (const href of BAR) expect(linkTo(nav, href), href).toMatch(/\bmin-h-12\b/);
			expect(moreOf(nav, copy.more)).toMatch(/\bmin-h-12\b/);
		});

		// Story 12: a control touched once does not take the strip on every screen.
		test('the strip carries no locale switch', async () => {
			const html = await render('/');
			const strip = /<header[^>]*view-transition-name:topbar[\s\S]*?<\/header>/.exec(html)?.[0];
			expect(strip, 'the strip was not found').toBeTruthy();
			for (const name of copy.languages) {
				expect(strip, name).not.toContain(`aria-label="${name}"`);
			}
			expect(strip).not.toContain('aria-pressed');
		});

		// Story 72: the stepper has the whole screen.
		test('the intake renders no bar, and every other screen does', async () => {
			expect(navOf(await render('/welcome'))).toBe('');
			for (const path of [...BAR, ...IN_MORE, '/login']) {
				expect(navOf(await render(path)), path).not.toBe('');
			}
		});
	});
}

// Found on the built app, not in this file: the shell is baked once at `/`, so
// a navigation that marked its current item from the router baked Today as
// current, and a cold start on `/timer` hydrated over that markup. React does not
// patch an attribute that differs on hydration, so Today stayed marked on every
// screen until something re-rendered it. The baked render marks nothing; the
// mark arrives with `here`, which the root hands down only once it has hydrated.
describe('the baked shell', () => {
	test('marks no destination, whatever URL the router is on', async () => {
		for (const path of ['/', '/timer', '/week']) {
			const router = createRouter({
				routeTree,
				history: createMemoryHistory({ initialEntries: [path] }),
			});
			await router.load();
			const html = renderToString(
				createElement(RouterContextProvider, {
					router,
					children: createElement(Navigation, { locale: 'en-US', here: null }),
				} as never),
			);
			expect(html, path).toContain('<nav');
			expect(html, path).not.toContain('aria-current');
			expect(html, path).not.toContain('data-status');
		}
	});
});

// The sheet is a closed Base UI dialog in a string render, so it is opened the
// way the athlete opens it: mount the route, press More. en-US only, for the
// reason the full-screen clock's mounted tests give in `screens.test.ts`.
describe('More', () => {
	beforeAll(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	});
	beforeEach(() => overwriteGetLocale(() => 'en-US'));

	test('opens a sheet holding Week and Settings as 48px rows', async () => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/'] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		try {
			const more = document.querySelector<HTMLButtonElement>('nav button[aria-label="More"]');
			expect(more, 'no More control').toBeTruthy();
			act(() => more?.click());
			const sheet = document.querySelector<HTMLElement>('[role="dialog"]');
			if (!sheet) throw new Error('More opened nothing');
			const rows = [...sheet.querySelectorAll<HTMLAnchorElement>('a[href]')];
			expect(rows.map((a) => a.getAttribute('href'))).toEqual(['/week', '/settings']);
			expect(rows.map((a) => a.textContent?.trim())).toEqual(['Week', 'Settings']);
			for (const row of rows) expect(row.className).toMatch(/\bmin-h-12\b/);
			// It can be closed without choosing anything.
			expect(sheet.querySelector('button[aria-label="Close"]')).toBeTruthy();
		} finally {
			act(() => root.unmount());
		}
	});
});

// What the shell takes from the matched route. A pure function, so the two
// decisions the route makes about the chrome are tested without a render.
describe('chromeFor', () => {
	const Action = () => null;

	test('the navigation shows unless the matched route opts out', () => {
		expect(chromeFor([{ staticData: {} }, { staticData: {} }]).navigation).toBe(true);
		expect(chromeFor([{ staticData: {} }, { staticData: { navigation: false } }]).navigation).toBe(
			false,
		);
	});

	test('the strip takes the screen action of the deepest route that names one', () => {
		expect(chromeFor([{ staticData: {} }]).ScreenAction).toBeNull();
		expect(
			chromeFor([{ staticData: {} }, { staticData: { screenAction: Action } }]).ScreenAction,
		).toBe(Action);
	});

	test('with no match yet, it is the baked shell: navigation, no action', () => {
		expect(chromeFor([])).toEqual({ navigation: true, ScreenAction: null });
	});
});
