// One primary per screen, counted on all eight (spec #113, Testing Decisions:
// "exactly one primary on every screen", extending `tests/welcome.test.ts`'s
// count to all eight).
//
// Each screen ticket counted its own (`today.test.ts`, `train.test.ts`,
// `intake.test.ts`, `signin.test.ts`). This counts them side by side, seeded and
// empty, in both locales, so a screen that gains a second vermilion fill, or one
// that gains a first where it should have none, fails here (#113's review, P1).
//
// Four screens have one: Today, Train, the intake (each step and the proposal)
// and sign-in. Four have none outside a dialog: Timer, Log, Week and Settings.
// Why those have none is `docs/component-vocabulary.md`'s, under "The one
// primary". A dialog's confirm is the primary of its own surface (Settings'
// AlertDialog), so a dialog is not counted; none is open here anyway.
//
// String renders for the eight screens, signed out (the auth client is mocked so
// sign-in's body renders rather than waiting on a session). The intake is also
// mounted and walked, because a string render only ever shows its first step.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import { routeTree } from '../src/routeTree.gen.ts';

const auth = vi.hoisted(() => ({
	session: { data: null, isPending: false, error: null },
}));

vi.mock('../src/lib/auth-client', () => ({
	authClient: { useSession: () => auth.session },
	useSession: () => auth.session,
	signIn: { email: vi.fn() },
	signUp: { email: vi.fn() },
	signOut: vi.fn(async () => {}),
}));

const NOW = new Date(PINNED_NOW);

beforeAll(() => {
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOW);
});

afterAll(() => {
	vi.useRealTimers();
	resetRecordStore();
});

type Locale = 'en-US' | 'pt-BR';
type Pass = 'seeded' | 'empty';

/** How many primaries each screen has. */
const RATION = {
	'/': 1,
	'/train': 1,
	'/welcome': 1,
	'/login': 1,
	'/timer': 0,
	'/log': 0,
	'/week': 0,
	'/settings': 0,
} as const;

/** The record a pass reads: the seeded weeks, or nothing. */
function arrange(pass: Pass, locale: Locale) {
	resetRecordStore();
	overwriteGetLocale(() => locale);
	if (pass === 'seeded') {
		seedRecordStore(recordStore(), getContent('en-US'), 'en-US', NOW.getTime());
	}
}

async function routerAt(path: string) {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	await router.load();
	return router;
}

/**
 * The `primary` recipe's fills in a page, outside any dialog. `active:bg-flag-deep`
 * belongs to that variant alone (`ui/variants.ts`), so it counts primaries and
 * nothing else that happens to be vermilion.
 */
function primaries(scope: ParentNode): Element[] {
	return [...scope.querySelectorAll('[class~="active:bg-flag-deep"]')].filter(
		(el) => !el.closest('[role="dialog"], [role="alertdialog"]'),
	);
}

const named = (els: Element[]) => els.map((el) => el.textContent?.trim());

for (const locale of ['en-US', 'pt-BR'] as const) {
	for (const pass of ['seeded', 'empty'] as const) {
		describe(`${locale}, ${pass}`, () => {
			test.each(Object.entries(RATION))('%s: primaries = %i', async (path, count) => {
				arrange(pass, locale);
				const html = renderToString(
					createElement(RouterProvider, { router: await routerAt(path) } as never),
				);
				const page = new DOMParser().parseFromString(html, 'text/html');
				// A screen that did not render would have none, and pass the zeros.
				expect(page.querySelector('main h1'), `${path} rendered`).not.toBeNull();
				expect(named(primaries(page.body)), path).toHaveLength(count);
			});
		});
	}
}

// ---------------------------------------------------------------- the intake

let root: Root | null = null;

/** A working `localStorage` per mount, so each walk starts from a blank draft
 *  (`tests/intake.test.ts` says why jsdom's will not do). */
function freshStorage() {
	const cells = new Map<string, string>();
	const shim: Storage = {
		getItem: (k) => cells.get(k) ?? null,
		setItem: (k, v) => void cells.set(k, String(v)),
		removeItem: (k) => void cells.delete(k),
		clear: () => cells.clear(),
		key: (i) => [...cells.keys()][i] ?? null,
		get length() {
			return cells.size;
		},
	};
	Object.defineProperty(window, 'localStorage', { value: shim, configurable: true });
}

afterEach(() => {
	act(() => root?.unmount());
	root = null;
});

const main = () => {
	const found = document.querySelector('main');
	if (!found) throw new Error('no <main>');
	return found;
};

const press = (el: HTMLElement | null | undefined) => {
	expect(el, 'control to press').toBeTruthy();
	act(() => el?.click());
};

/** Answer the step on screen: the first option of each question, a number typed
 *  into each number field. */
function answerStep() {
	for (const set of main().querySelectorAll('fieldset')) {
		if (set.querySelector('button[aria-pressed="true"]')) continue;
		press(set.querySelector<HTMLButtonElement>('button[aria-pressed]'));
	}
	for (const field of main().querySelectorAll<HTMLInputElement>('input[type="number"]')) {
		act(() => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, '90');
			field.dispatchEvent(new Event('input', { bubbles: true }));
		});
	}
}

for (const locale of ['en-US', 'pt-BR'] as const) {
	for (const pass of ['seeded', 'empty'] as const) {
		test(`${locale}, ${pass}: every intake step and the proposal have one primary`, async () => {
			freshStorage();
			arrange(pass, locale);
			const router = await routerAt('/welcome');
			root = createRoot(document);
			act(() => root?.render(createElement(RouterProvider, { router } as never)));

			for (let step = 1; step <= 4; step++) {
				const [advance, ...more] = primaries(document.body);
				expect(named([advance, ...more]), `step ${step}`).toHaveLength(1);
				answerStep();
				press(advance as HTMLElement);
			}
			// The proposal (reached only if every advance moved on): its one primary
			// is the way into training.
			expect(named(primaries(document.body)), 'proposal').toEqual([
				locale === 'en-US' ? 'Start training' : 'Começar a treinar',
			]);
		});
	}
}
