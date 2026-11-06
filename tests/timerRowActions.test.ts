// A row's ⋯ on the Timer screen (#111), the way the athlete uses it: open the
// menu beside a row, pick what it offers, find the list changed.
//
// The screens suite's seam — the real route, mounted over the seeded store, on
// the document itself, as the screens suite mounts it. Mounted in a `<div>` (as
// `timerScreen.test.ts` is), the focus Base UI hands back when a menu closes
// sends React's event dispatch walking the tree without end, and the click
// never returns.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { readTrainingRecord, recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import { routeTree } from '../src/routeTree.gen.ts';

beforeAll(() => {
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	// jsdom lays nothing out, so it has no `scrollIntoView`; a copy is scrolled to.
	Element.prototype.scrollIntoView ??= () => {};
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(PINNED_NOW));
	resetRecordStore();
	seedRecordStore(recordStore(), getContent('en-US'), 'en-US', PINNED_NOW);
	overwriteGetLocale(() => 'en-US');
});

afterAll(() => {
	vi.useRealTimers();
	resetRecordStore();
});

/** Let the writes a click started — the store's, the router's — land. */
const settle = () =>
	act(async () => {
		for (let i = 0; i < 5; i++) await Promise.resolve();
	});
const press = async (el: Element | null | undefined) => {
	expect(el, 'control to press').toBeTruthy();
	await act(async () => (el as HTMLElement | null)?.click());
	await settle();
};
const saved = () => readTrainingRecord(recordStore()).savedProtocols;
/** The ⋯ for a protocol, by the name its label carries. */
const more = (name: string) =>
	document.querySelector<HTMLButtonElement>(`main button[aria-label="Actions for ${name}"]`);
/** What the open menu offers, in order. */
const offered = () =>
	[...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent?.trim());
const item = (text: string) =>
	[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
		(el) => el.textContent?.trim() === text,
	);

let root: Root;
beforeEach(async () => {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ['/timer'] }),
	});
	await router.load();
	root = createRoot(document);
	act(() => root.render(createElement(RouterProvider, { router } as never)));
	await settle();
});
afterEach(() => {
	act(() => root.unmount());
});

describe('a row’s ⋯ on the Timer screen', () => {
	test('a preset offers a copy, and the copy is the athlete’s, at the end of Saved', async () => {
		const before = saved().length;
		await press(
			[...document.querySelectorAll('main h3 > button')].find((b) =>
				b.textContent?.includes('Repeaters'),
			),
		);
		const preset = '7/3 · 20mm half-crimp + open hand';
		await press(more(preset));
		// The library's: nothing to edit and nothing to delete.
		expect(offered()).toEqual(['Duplicate']);
		await press(item('Duplicate'));

		expect(saved()).toHaveLength(before + 1);
		const copy = saved().at(-1);
		expect(copy?.protocol).toMatchObject({ work: 7, rest: 3, rounds: 6, sets: 4 });
		expect(more(copy?.name ?? '')).toBeTruthy();
		// The menu closed on the pick.
		expect(offered()).toEqual([]);
	});

	test('a saved protocol offers duplicate, edit and delete, and delete asks first', async () => {
		const name = 'Warm-up hangs';
		await press(more(name));
		expect(offered()).toEqual(['Duplicate', 'Edit', 'Delete']);
		await press(item('Delete'));

		const question = document.querySelector<HTMLElement>('[role="alertdialog"]');
		expect(question?.textContent).toContain(`Delete “${name}”?`);
		// Asked, not done.
		expect(saved().some((p) => p.name === name)).toBe(true);
		await press(
			[...(question?.querySelectorAll('button') ?? [])].find(
				(b) => b.textContent?.trim() === 'Delete',
			),
		);
		expect(saved().some((p) => p.name === name)).toBe(false);
		expect(more(name)).toBeNull();
	});

	test('Edit opens the editor on the saved protocol it was picked from', async () => {
		await press(more('Tabata finisher'));
		await press(item('Edit'));
		const editor = document.querySelector<HTMLElement>('[role="dialog"]');
		expect(editor?.textContent).toContain('Edit saved protocol');
		expect(
			[...(editor?.querySelectorAll('input') ?? [])].some((i) => i.value === 'Tabata finisher'),
		).toBe(true);
	});

	// The ready state carries the row's ⋯ in its header (#110), so a protocol
	// opened to read can be copied or edited without going back for it.
	test('the ready state offers the row’s actions, and Edit leaves the clock for the editor', async () => {
		await press(
			[...document.querySelectorAll('main button[aria-haspopup="dialog"]')].find((b) =>
				b.textContent?.includes('Tabata finisher'),
			),
		);
		const clock = document.querySelector<HTMLElement>('[role="dialog"]');
		expect(clock?.getAttribute('aria-label')).toBe('Tabata finisher');
		await press(clock?.querySelector('button[aria-label="Actions for Tabata finisher"]'));
		expect(offered()).toEqual(['Duplicate', 'Edit', 'Delete']);
		await press(item('Edit'));
		const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
		expect(
			dialogs.map((d) => d.textContent ?? '').some((t) => t.includes('Edit saved protocol')),
		).toBe(true);
		expect(dialogs.some((d) => d.getAttribute('aria-label') === 'Tabata finisher')).toBe(false);
	});
});
