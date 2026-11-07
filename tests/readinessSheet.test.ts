// The readiness check as a sheet, one question at a time (#116, spec #113
// stories 21–32).
//
// Which question comes next is `lib/readinessFlow.ts`'s, asserted in
// `tests/readinessFlow.test.ts`. This is what the athlete sees and does with it on
// Today: an invitation while the check is unanswered, a one-line summary once it
// is, and the sheet between them. Today's inline question lists are gone.
//
// The sheet is a closed Base UI dialog in a string render, so it is opened the
// way the athlete opens it: mount Today, press the invitation. en-US only for the
// mounted half, for the reason `screens.test.ts` gives for the clock; the string
// renders run in both locales.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import { routeTree } from '../src/routeTree.gen.ts';

const THURSDAY = new Date(PINNED_NOW);

beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(THURSDAY);
});

afterAll(() => {
	vi.useRealTimers();
	resetRecordStore();
});

async function routerAt(path: string) {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	await router.load();
	return router;
}

/** Everything inside `<main>`: the screen without the shell. */
function screenOf(html: string): string {
	return html.slice(html.indexOf('<main'), html.indexOf('</main>'));
}

const COPY = {
	'en-US': {
		invite: 'Answer the check',
		summary: '6 of 7 answered',
		resume: 'Continue',
		question: 'How did you sleep?',
	},
	'pt-BR': {
		invite: 'Responder o check',
		summary: '6 de 7 respondidas',
		resume: 'Continuar',
		question: 'Como foi seu sono?',
	},
} as const;

for (const locale of ['en-US', 'pt-BR'] as const) {
	const copy = COPY[locale];

	describe(`${locale}, Today`, () => {
		test('with no check, leads with the invitation as the one primary', async () => {
			resetRecordStore();
			overwriteGetLocale(() => locale);
			const today = screenOf(
				renderToString(createElement(RouterProvider, { router: await routerAt('/') } as never)),
			);
			// The invitation is the first thing after the header.
			const header = today.indexOf('</header>');
			const invite = today.indexOf(`>${copy.invite}<`);
			expect(invite).toBeGreaterThan(header);
			const tag = today.slice(today.lastIndexOf('<button', invite), invite);
			expect(tag).toContain('bg-flag');
			// One primary on the screen: the invitation, not the bodyweight nudge.
			expect(today.match(/bg-flag text-bg/g) ?? []).toHaveLength(1);
			// No question is asked on the page itself.
			expect(today).not.toContain(copy.question);
		});

		test('with a check, shows a one-line summary instead of the questions', async () => {
			resetRecordStore();
			seedRecordStore(recordStore(), getContent('en-US'), 'en-US', THURSDAY.getTime());
			overwriteGetLocale(() => locale);
			const today = screenOf(
				renderToString(createElement(RouterProvider, { router: await routerAt('/') } as never)),
			).replaceAll('<!-- -->', '');
			// The seeded check left the finger's severity follow-up unanswered.
			expect(today).toContain(copy.summary);
			expect(today).toContain(`>${copy.resume}<`);
			expect(today).not.toContain(copy.question);
			expect(today).not.toContain(`>${copy.invite}<`);
		});
	});
}

describe('the sheet', () => {
	let root: Root;

	beforeAll(async () => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		resetRecordStore();
		overwriteGetLocale(() => 'en-US');
		const router = await routerAt('/');
		root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
	});

	afterAll(() => act(() => root.unmount()));

	const sheet = () => document.querySelector<HTMLElement>('[role="dialog"]');
	const buttons = (scope: ParentNode) => [...scope.querySelectorAll<HTMLButtonElement>('button')];
	const worded = (scope: ParentNode, text: string) =>
		buttons(scope).find((b) => b.textContent?.trim() === text);
	const press = (el: HTMLElement | null | undefined) => {
		expect(el, 'control to press').toBeTruthy();
		act(() => el?.click());
	};
	const question = () => sheet()?.querySelector('h3')?.textContent;
	const rail = () => sheet()?.querySelector('ol')?.getAttribute('aria-label');

	test('opens from the invitation on the first question, with nothing preselected', () => {
		press(worded(document, 'Answer the check'));
		const open = sheet();
		if (!open) throw new Error('the invitation opened nothing');
		expect(question()).toBe('How did you sleep?');
		// One question per step: the next one is not on screen.
		expect(open.textContent).not.toContain('How recovered do you feel?');
		const options = open.querySelectorAll('button[aria-pressed]');
		expect(options).toHaveLength(4);
		expect(open.querySelector('button[aria-pressed="true"]')).toBeNull();
		expect(rail()).toBe('Question 1 of 6');
		// The rationale is there, collapsed under the question.
		const why = open.querySelector('details');
		expect(why?.open).toBe(false);
		expect(why?.querySelector('summary')?.textContent).toContain('Why we ask');
		expect(why?.textContent).toContain('Sleep is the single strongest driver');
		// No way back from the first step; the advance waits for an answer.
		expect(worded(open, 'Back')).toBeUndefined();
		expect(worded(open, 'Next')?.disabled).toBe(true);
	});

	test('a pick advances, and back returns with the pick kept', () => {
		press(worded(sheet() ?? document, 'OK'));
		expect(question()).toBe('How recovered do you feel?');
		expect(rail()).toBe('Question 2 of 6');
		press(worded(sheet() ?? document, 'Back'));
		expect(question()).toBe('How did you sleep?');
		expect(worded(sheet() ?? document, 'OK')?.getAttribute('aria-pressed')).toBe('true');
		press(worded(sheet() ?? document, 'Next'));
		expect(question()).toBe('How recovered do you feel?');
	});

	test('a follow-up joins the check only when an answer calls for it', () => {
		press(worded(sheet() ?? document, 'Normal'));
		expect(question()).toBe('Muscle soreness?');
		press(worded(sheet() ?? document, 'Mild'));
		expect(question()).toBe('Anything hurting today?');
		press(worded(sheet() ?? document, 'Elbow'));
		expect(question()).toBe('How does it feel?');
		expect(rail()).toBe('Question 5 of 7');
	});

	test('closing halfway keeps the answers, shows the verdict, and reopens where it stopped', () => {
		press(sheet()?.querySelector<HTMLButtonElement>('button[aria-label="Close"]'));
		expect(sheet()).toBeNull();
		const main = document.querySelector('main');
		// The verdict is on Today as soon as the sheet is gone.
		const verdicts = Object.values(getContent('en-US').verdicts).map((v) => v.title);
		expect(verdicts.some((title) => main?.textContent?.includes(title))).toBe(true);
		expect(main?.textContent).toContain('4 of 7 answered');
		expect(worded(document, 'Answer the check')).toBeUndefined();

		press(worded(main ?? document, 'Continue'));
		expect(question()).toBe('How does it feel?');
	});

	test('the last step does not close on a pick; its advance does', () => {
		press(worded(sheet() ?? document, 'Tender'));
		press(worded(sheet() ?? document, 'Feel fine'));
		expect(question()).toBe('Time for today?');
		press(worded(sheet() ?? document, 'Standard'));
		// Still open, on the last question, with the pick shown.
		expect(question()).toBe('Time for today?');
		expect(worded(sheet() ?? document, 'Standard')?.getAttribute('aria-pressed')).toBe('true');
		press(worded(sheet() ?? document, 'Done'));
		expect(sheet()).toBeNull();
		const main = document.querySelector('main');
		expect(main?.textContent).toContain('7 of 7 answered');
	});

	test('a finished check reopens on its first question, to be edited', () => {
		press(worded(document.querySelector('main') ?? document, 'Edit'));
		expect(question()).toBe('How did you sleep?');
		expect(worded(sheet() ?? document, 'OK')?.getAttribute('aria-pressed')).toBe('true');
		press(sheet()?.querySelector<HTMLButtonElement>('button[aria-label="Close"]'));
	});
});
