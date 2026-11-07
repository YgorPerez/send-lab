// Train with one primary and one task open (#118, spec #113 stories 44–53).
//
// What the athlete sees and does on Train: the one filled control is "finish and
// log the session", the clock's start is a clock control, the task being worked
// on is open and every other task is one summary line, a tap opens another, and
// ticking a task's last set moves on to the next.
//
// String renders of the route over the seeded store for what is on screen, in
// both locales; a mounted route for what a tap does, en-US only, for the reason
// `screens.test.ts` gives for the clock. The mounted tests share this file's
// in-memory storage, so the session draft they tick carries from one to the
// next: they are one sequence.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import { routeTree } from '../src/routeTree.gen.ts';

/** The seeded Thursday: week 5, a Pull day, opened mid-session. */
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

/** A screen's `<main>`, as a string, with React's text separators dropped. */
async function screen(path: string, locale: Locale): Promise<string> {
	overwriteGetLocale(() => locale);
	const html = renderToString(
		createElement(RouterProvider, { router: await routerAt(path) } as never),
	);
	return html.slice(html.indexOf('<main'), html.indexOf('</main>')).replaceAll('<!-- -->', '');
}

/** `primary` is the only recipe that presses to `--flag-deep`. */
const primaries = (html: string) => html.match(/active:bg-flag-deep/g) ?? [];

/** The opening tag of the button whose text includes `label`. */
function buttonWith(html: string, label: string): string {
	const at = html.indexOf(label);
	expect(at, label).toBeGreaterThan(-1);
	return html.slice(html.lastIndexOf('<button', at), at);
}

/** Each task's disclosure: the button that opens or closes it, by its name.
 *  A picker's trigger is expanded or not too, and names no task. */
function tasksOf(html: string): { name: string; open: boolean; row: string }[] {
	return [...html.matchAll(/<button[^>]*aria-expanded="(true|false)"[^>]*>(.*?)<\/button>/g)]
		.map(([, open, inner]) => ({
			open: open === 'true',
			row: inner
				.replace(/<[^>]+>/g, ' ')
				.replace(/\s+/g, ' ')
				.trim(),
			name: inner.match(/data-task-name[^>]*>([^<]*)</)?.[1] ?? '',
		}))
		.filter((t) => t.name !== '');
}

const COPY = {
	'en-US': {
		start: 'Start',
		finish: 'Finish &amp; log session',
		pull: 'Pull Strength',
		sloper: 'Sloper Density',
		abrahangs: 'Abrahangs',
		antagonists: 'Antagonists',
		held: 'held · readiness',
		tools: 'Session tools',
		add: 'Add exercise',
		repeat: 'Repeat last session',
		note: 'Session note (optional)',
		minutes: 'Minutes',
	},
	'pt-BR': {
		start: 'Iniciar',
		finish: 'Concluir e registrar treino',
		pull: 'Puxada',
		sloper: 'Density em Sloper',
		abrahangs: 'Abrahangs',
		antagonists: 'Antagonistas',
		held: 'retido · prontidão',
		tools: 'Ferramentas da sessão',
		add: 'Adicionar exercício',
		repeat: 'Repetir última sessão',
		note: 'Nota da sessão (opcional)',
		minutes: 'Minutos',
	},
} as const;

for (const locale of ['en-US', 'pt-BR'] as const) {
	const copy = COPY[locale];

	describe(`${locale}, Train`, () => {
		test('has one primary, finish-and-log, and the clock starts from a clock control', async () => {
			const train = await screen('/train', locale);
			expect(primaries(train)).toHaveLength(1);
			expect(buttonWith(train, copy.finish)).toContain('active:bg-flag-deep');
			const start = buttonWith(train, copy.start);
			expect(start).not.toContain('bg-flag');
			expect(start).toContain('border-ink-dim');
			// Which task the clock runs is a selection, marked as the bar marks one,
			// never in the vermilion that means limit.
			const pinned =
				train.match(
					/<button[^>]*aria-pressed="true"[^>]*aria-label="[^"]*"|<button[^>]*aria-label="[^"]*"[^>]*aria-pressed="true"[^>]*>/,
				)?.[0] ?? '';
			expect(pinned).toContain('text-chalk');
			expect(pinned).not.toContain('flag');
		});

		// The seeded check holds Pull Strength and Antagonists, and Sloper Density
		// has one of its two sets done, so it is the first task with a set left
		// that the verdict did not take off the plan. Today's "applies to" line
		// names the same one.
		test('opens the first task with a set left that is not held, and folds the rest', async () => {
			const tasks = tasksOf(await screen('/train', locale));
			expect(tasks.map((t) => t.name)).toEqual([
				copy.pull,
				copy.sloper,
				copy.abrahangs,
				copy.antagonists,
			]);
			expect(tasks.map((t) => t.open)).toEqual([false, true, false, false]);
			// A folded task says what it is, how far it got and what it asks for.
			const [pull, , abrahangs, antagonists] = tasks;
			expect(pull.row).toContain('0/1');
			expect(pull.row).toContain('4–6 × 3–5 · +32–48kg');
			expect(abrahangs.row).toContain('0/1');
			expect(abrahangs.row).toContain('1 × 20 × 10s · 18–22mm');
			expect(antagonists.row).toContain('RPE 5–7');
		});

		test('marks held work on the task, as Today does', async () => {
			const today = await screen('/', locale);
			const tasks = tasksOf(await screen('/train', locale));
			const held = tasks.filter((t) => t.row.includes(copy.held)).map((t) => t.name);
			expect(held).toEqual([copy.pull, copy.antagonists]);
			// Today marks the same two, at the end of each task's row.
			for (const name of held)
				expect(today).toMatch(new RegExp(`${name}</span>.{0,200}${copy.held}`));
		});

		// Story 52: the session's own tools come after the tasks, as one group, and
		// the finish comes last, disabled with its reason while no set is ticked.
		test('groups the session tools after the tasks, then the finish', async () => {
			const train = await screen('/train', locale);
			const at = [
				copy.antagonists,
				`>${copy.tools}<`,
				copy.add,
				copy.repeat,
				copy.note,
				copy.minutes,
				copy.finish,
			].map((marker) => {
				const i = train.indexOf(marker);
				expect(i, marker).toBeGreaterThan(-1);
				return i;
			});
			expect(at).toEqual([...at].sort((a, b) => a - b));
			// The note is labelled by a visible label, not by its placeholder.
			expect(train).toMatch(
				new RegExp(`<label[^>]*for="session-note"[^>]*>${copy.note.replace(/[()]/g, '\\$&')}<`),
			);
		});

		test('shows the set grid of the open task only', async () => {
			const train = await screen('/train', locale);
			// Sloper Density's two set rows; the folded tasks' sets are not drawn.
			expect(train.match(/id="[^"]*-rpe"/g) ?? []).toEqual([
				'id="slopdens-0-rpe"',
				'id="slopdens-1-rpe"',
			]);
		});
	});
}

describe('en-US, Train, tapped', () => {
	beforeAll(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		overwriteGetLocale(() => 'en-US');
	});

	/** Mount `/train` on the document (`screens.test.ts` says why) and hand the
	 *  test the screen; unmounted after, whatever happens. */
	async function mounted(run: (main: HTMLElement) => void | Promise<void>) {
		const router = await routerAt('/train');
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		try {
			const main = document.querySelector('main');
			if (!main) throw new Error('Train did not render');
			await run(main);
		} finally {
			act(() => root.unmount());
		}
	}

	const headerOf = (main: HTMLElement, name: string) => {
		const header = [...main.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find(
			(b) => b.querySelector('[data-task-name]')?.textContent === name,
		);
		if (!header) throw new Error(`no task named ${name}`);
		return header;
	};
	const openTasks = (main: HTMLElement) =>
		[...main.querySelectorAll('button[aria-expanded="true"] [data-task-name]')].map(
			(n) => n.textContent,
		);
	/** The open task's set ticks, in order. */
	const ticks = (main: HTMLElement) =>
		[...main.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter((b) =>
			b.textContent?.includes('done'),
		);

	test('a tap on a folded task opens it and folds the open one', async () => {
		await mounted((main) => {
			expect(openTasks(main)).toEqual(['Sloper Density']);
			act(() => headerOf(main, 'Abrahangs').click());
			expect(openTasks(main)).toEqual(['Abrahangs']);
			// A tap on the open one folds it, and nothing is open.
			act(() => headerOf(main, 'Abrahangs').click());
			expect(openTasks(main)).toEqual([]);
		});
	});

	test('ticking the open task’s last set opens the next task with a set left', async () => {
		await mounted((main) => {
			const left = () => {
				const tick = ticks(main).find((b) => b.getAttribute('aria-pressed') === 'false');
				if (!tick) throw new Error(`${openTasks(main)} has no set left`);
				return tick;
			};
			expect(openTasks(main)).toEqual(['Sloper Density']);
			act(() => left().click());
			expect(openTasks(main)).toEqual(['Abrahangs']);
			// The finished task folds with Today's done mark on it.
			expect(headerOf(main, 'Sloper Density').textContent).toContain('done');
			act(() => left().click());
			// Only held work has sets left now, so the first of it opens: held is a
			// mark, not a lock, and the athlete may still train it.
			expect(openTasks(main)).toEqual(['Pull Strength']);
		});
	});

	// The working-load ask is one step: a rung, then what it needs, then Set load.
	// Pull Strength is open now (the last test ticked everything else) and has
	// never been loaded.
	test('the working-load ask takes a rung, then one Set load', async () => {
		await mounted((main) => {
			expect(openTasks(main)).toEqual(['Pull Strength']);
			const worded = (text: string) =>
				[...main.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
					b.textContent?.startsWith(text),
				);
			const set = () => worded('Set load');
			expect(set()?.disabled).toBe(true);
			// A typed rung asks for its number before Set load will take it.
			act(() => worded('A load I measured')?.click());
			expect(main.querySelector('label[for^="wl-"]')?.textContent).toBe('Added kg');
			expect(set()?.disabled).toBe(true);
			// A suggestion carries its number, so choosing it is enough.
			act(() => worded('Start here')?.click());
			expect(worded('Start here')?.getAttribute('aria-pressed')).toBe('true');
			expect(set()?.disabled).toBe(false);
			act(() => set()?.click());
			expect(main.textContent).not.toContain('First time on this one');
			expect(main.textContent).toContain('Working load · the safe starting load');
		});
	});
});
