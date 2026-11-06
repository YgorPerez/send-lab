// Making a saved protocol on the Timer screen (#104), the way the athlete does
// it: open the editor, type, be told what cannot run, save, find it in the list.
//
// The screens suite's seam — the real route, mounted over the seeded store — in a
// file of its own for one reason, found the hard way: in this jsdom setup a
// worker can open **one** Base UI dialog. Close it, or unmount the tree it was
// in, and the next dialog's open never returns: the click spins synchronously,
// past any test timeout. A clean document does not reset it, so the state is in
// Base UI's module scope. `screens.test.ts` spends its one on Train's clock, so
// the editor gets a fresh worker here, and this file must not open a second.
//
// What the editor accepts is pinned in `screenReads.test.ts`; editing an
// existing row is pinned in `savedProtocols.test.ts`. This is the wiring
// between them and the screen.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { readTrainingRecord, recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import { routeTree } from '../src/routeTree.gen.ts';

beforeAll(() => {
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	// jsdom lays nothing out, so it has no `scrollIntoView`; the screen scrolls a
	// new protocol into view, and here there is nowhere to scroll.
	Element.prototype.scrollIntoView ??= () => {};
	// The account the screens suite renders, on the day it renders it. en-US
	// only: a mounted app applies the seeded account's locale, which is en-US.
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
const press = async (el: HTMLButtonElement | null | undefined) => {
	expect(el, 'button to press').toBeTruthy();
	await act(async () => el?.click());
	await settle();
};
const worded = (scope: ParentNode, text: string) =>
	[...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
/** Type into a field the way a person does: React listens for the native setter. */
const type = (field: HTMLInputElement | null, value: string) => {
	expect(field, 'field to type in').toBeTruthy();
	const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
	act(() => {
		field?.focus();
		set?.call(field, value);
		field?.dispatchEvent(new Event('input', { bubbles: true }));
	});
};
/** The input a visible label names. */
const fieldOf = (scope: ParentNode, label: string) => {
	const found = [...scope.querySelectorAll('label')].find((l) => l.textContent?.trim() === label);
	const field = found ? document.getElementById(found.htmlFor) : null;
	return field instanceof HTMLInputElement ? field : null;
};
const saved = () => readTrainingRecord(recordStore()).savedProtocols;

describe('making a saved protocol on the Timer screen', () => {
	test('from scratch, refusing what cannot run, and pointing the clock at it', async () => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/timer'] }),
		});
		await router.load();
		// The root route renders the whole document, so React warns about an
		// `<html>` inside this `<div>` — the price of mounting the real route.
		const host = document.createElement('div');
		document.body.append(host);
		const root = createRoot(host);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		await settle();
		try {
			const before = saved().length;
			await press(worded(host, 'New protocol'));
			const editor = document.querySelector<HTMLElement>('[role="dialog"]');
			if (!editor) throw new Error('the editor did not open');
			expect(editor.textContent).toContain('New protocol');
			// It opens on a protocol that runs, with no name — which is allowed
			// (#112): the empty name shows the shape the protocol will be listed
			// under, and the total is said under the rows.
			expect(fieldOf(editor, 'Work')?.value).toBe('10s');
			expect(fieldOf(editor, 'Name (optional)')?.placeholder).toBe('10s');
			expect(editor.querySelector('footer')?.textContent).toContain('0:20');

			// No work: refused under its row as soon as it is typed.
			type(fieldOf(editor, 'Work'), '0');
			expect(fieldOf(editor, 'Work')?.getAttribute('aria-invalid')).toBe('true');
			expect(editor.textContent).toContain('Whole seconds, 1 or more');

			// Save with no work: nothing is written, and the athlete is put where
			// the fix is.
			fieldOf(editor, 'Name (optional)')?.focus();
			await press(worded(editor, 'Save'));
			expect(saved()).toHaveLength(before);
			expect(document.activeElement).toBe(fieldOf(editor, 'Work'));

			type(fieldOf(editor, 'Name (optional)'), 'Hangboard finisher');
			type(fieldOf(editor, 'Work'), '20');
			type(fieldOf(editor, 'Rest'), '10');
			type(fieldOf(editor, 'Rounds'), '8');
			// A cooldown typed in seconds is read back in minutes while it is typed.
			type(fieldOf(editor, 'Cooldown'), '120');
			expect(editor.textContent).toContain('= 2:00');
			// 10 + 8 × 20 + 7 × 10 + 120 = 6:00.
			expect(editor.querySelector('footer')?.textContent).toContain('6:00');
			await press(worded(editor, 'Save'));

			expect(saved()).toHaveLength(before + 1);
			expect(saved().at(-1)).toMatchObject({
				name: 'Hangboard finisher',
				protocol: {
					prepare: 10,
					work: 20,
					rest: 10,
					rounds: 8,
					sets: 1,
					setRest: 0,
					cooldown: 120,
				},
			});
			expect(host.textContent).toContain('8 × 20s/10s · 2:00 cooldown');
			// Made, so it is the one selected, with its own actions under it.
			const selected = [...host.querySelectorAll('main [aria-pressed="true"]')].map(
				(el) => el.textContent,
			);
			expect(selected.some((text) => text?.includes('Hangboard finisher'))).toBe(true);
			expect(worded(host, 'Edit')).toBeTruthy();
		} finally {
			act(() => root.unmount());
			host.remove();
		}
	});
});
