// The intake, mounted and walked step by step (#123, spec #113 stories 72–75).
//
// `tests/welcome.test.ts` holds the intake's rules on the first step's markup
// and on the pure conversion. This file walks the whole flow the way the
// athlete does, answering each step and pressing its advance, because the
// claims here are about *every* step: the way out is on each of them, each has
// one primary, and the advance on each says what it waits for.
//
// Mounted rather than `renderToString`, so a press moves the flow. Signed out
// and unseeded: an account with no baseline is what an intake is for, and
// signed out the record is settled at once. Each test mounts over a fresh
// `localStorage`, so each starts from a blank draft.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { resetRecordStore } from '../src/lib/store/record.ts';
import { routeTree } from '../src/routeTree.gen.ts';

beforeAll(() => {
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(PINNED_NOW));
});

afterAll(() => {
	vi.useRealTimers();
	resetRecordStore();
});

const COPY = {
	'en-US': {
		exit: 'Not now: back to Today',
		next: 'Next',
		back: 'Back',
		generate: 'Propose my program',
		start: 'Start training',
		// The walk answers one day a week, so the count is singular.
		trainingWeek: 'Your training week (1 day)',
		levelHelp: 'How hard each phase pushes.',
		goalsHelp: 'What you train for.',
		bodyHelp: 'Both finger questions change the program',
		proposalTitle: 'Your starting program',
		edit: 'Change your answers',
		equipment: 'Equipment on hand (all you have)',
		session: 'Typical session length (min) (optional)',
		// `CONTEXT.md`: Intake avoids onboarding, setup, wizard, first run,
		// assessment; Equipment avoids gear and kit; Baseline avoids profile, survey.
		avoided: /onboarding|set-?up|wizard|first run|assessment|\bgear\b|\bkit\b|profile|survey/i,
		waiting: [
			'Pick a goal and a limiter.',
			'Pick where you are.',
			'Pick your days, and at least one piece of equipment — the program is built from what you have.',
			'Answer both finger questions. The program reads them, and a blank is not a no.',
		],
	},
	'pt-BR': {
		exit: 'Agora não: voltar para Hoje',
		next: 'Próximo',
		back: 'Voltar',
		generate: 'Montar meu programa',
		start: 'Começar a treinar',
		trainingWeek: 'Sua semana de treino (1 dia)',
		levelHelp: 'O quanto cada fase puxa.',
		goalsHelp: 'Pra que você treina.',
		bodyHelp: 'As duas perguntas sobre dedo mudam o programa',
		proposalTitle: 'Seu programa inicial',
		edit: 'Mudar suas respostas',
		equipment: 'Equipamento disponível (tudo o que tiver)',
		session: 'Duração típica da sessão (min) (opcional)',
		avoided: /onboarding|configuração inicial|assistente|avaliação|\bkit\b|perfil|questionário/i,
		waiting: [
			'Escolha um objetivo e um limitante.',
			'Escolha onde você está.',
			'Escolha seus dias e ao menos um equipamento — o programa é montado com o que você tem.',
			'Responda as duas perguntas sobre dedo. O programa lê as duas, e em branco não é um não.',
		],
	},
} as const;

let root: Root | null = null;
let router: ReturnType<typeof createRouter> | null = null;

/** A working `localStorage` per mount: jsdom's here is not callable (see
 *  `tests/prefs.test.ts`), and a fresh one is a fresh draft. */
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

async function mount(locale: 'en-US' | 'pt-BR') {
	freshStorage();
	resetRecordStore();
	overwriteGetLocale(() => locale);
	router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ['/welcome'] }),
	});
	await router.load();
	root = createRoot(document);
	act(() => root?.render(createElement(RouterProvider, { router } as never)));
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
/** The top strip: the one `<header>` outside `main`. */
const strip = () => {
	const found = [...document.querySelectorAll('header')].find((h) => !h.closest('main'));
	if (!found) throw new Error('no strip');
	return found;
};
const buttons = (scope: ParentNode) => [...scope.querySelectorAll<HTMLButtonElement>('button')];
const worded = (scope: ParentNode, text: string) =>
	buttons(scope).find((b) => b.textContent?.trim() === text);
const press = (el: HTMLElement | null | undefined) => {
	expect(el, 'control to press').toBeTruthy();
	act(() => el?.click());
};
/** Vermilion-filled things on the screen: the `primary` recipe's `bg-flag`, and
 *  anything else painted with it. */
const vermilionFills = () =>
	[...main().querySelectorAll('*')].filter((el) => el.classList.contains('bg-flag'));

/** Answer the step on screen: the first option of each question, "No" to a
 *  yes/no, a session length typed in. */
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

/** Every word on the screen, text node by text node, and every `aria-label`
 *  (`tests/week.test.ts`'s `copyOf`: `textContent` runs adjacent words together). */
const copyOf = (scope: Element) => {
	const words: string[] = [];
	const nodes = document.createTreeWalker(scope, 4 /* NodeFilter.SHOW_TEXT */);
	for (let node = nodes.nextNode(); node; node = nodes.nextNode())
		words.push(node.textContent ?? '');
	for (const el of scope.querySelectorAll('[aria-label]'))
		words.push(el.getAttribute('aria-label') ?? '');
	return words.join(' ');
};

/** The exit in the strip: a link to Today with its name. */
const exitLink = (name: string) =>
	strip().querySelector<HTMLAnchorElement>(`a[href="/"][aria-label="${name}"]`);

for (const locale of ['en-US', 'pt-BR'] as const) {
	const copy = COPY[locale];

	describe(`the intake, walked in ${locale}`, () => {
		test('every step and the proposal: a way out, one primary, a held advance that says why', async () => {
			await mount(locale);
			for (let step = 0; step < 4; step++) {
				const label = `step ${step + 1}`;
				// The way out is on every step, in the strip, where scrolling the step
				// cannot take it out of view.
				expect(exitLink(copy.exit), label).toBeTruthy();
				// One primary: the advance. The rail is not filled vermilion beside it.
				expect(vermilionFills(), label).toHaveLength(1);
				// Nothing answered yet on this step (ADR 0019), so the advance is held
				// and says what it waits for.
				const advance = worded(main(), step === 3 ? copy.generate : copy.next);
				expect(advance?.disabled, label).toBe(true);
				expect(main().textContent, label).toContain(copy.waiting[step]);
				// Section heads in Inter, like every screen delivered before it
				// (DESIGN.md › Typography): the mono caps head is retiring.
				expect(main().querySelector('.h-section'), label).toBeNull();
				// The glossary's words, in the copy and in what is read aloud.
				expect(copyOf(main()), label).not.toMatch(copy.avoided);
				answerStep();
				expect(advance?.disabled, `${label}, answered`).toBe(false);
				press(advance);
			}
			// The proposal: still a way out, and its one primary is Start training.
			expect(worded(main(), copy.start)).toBeTruthy();
			expect(exitLink(copy.exit)).toBeTruthy();
			expect(vermilionFills()).toHaveLength(1);
			expect(main().querySelector('.h-section')).toBeNull();
			expect(copyOf(main())).not.toMatch(copy.avoided);
			// A count with its noun in the right number.
			expect([...main().querySelectorAll('h2')].map((h) => h.textContent)).toContain(
				copy.trainingWeek,
			);
		});

		// The advance sits at the end of a step that can run past the fold, so a
		// press there would leave the athlete looking at the end of the next step.
		// The step that arrives takes the focus at its first line instead, and the
		// page goes back to its top. Not on arrival: nothing was pressed yet.
		test('a step reached by Next or Back takes the focus at its first line', async () => {
			await mount(locale);
			expect(document.activeElement).toBe(document.body);
			answerStep();
			const focused = () => {
				const at = document.activeElement;
				expect(at === document.body || at?.contains(main().querySelector('fieldset'))).toBe(false);
				return at?.textContent ?? '';
			};
			press(worded(main(), copy.next));
			expect(focused().startsWith(copy.levelHelp)).toBe(true);
			press(worded(main(), copy.back));
			expect(focused().startsWith(copy.goalsHelp)).toBe(true);

			// And on the way to the proposal and back from it: the proposal's title,
			// then the last step's first line.
			press(worded(main(), copy.next));
			for (let step = 1; step < 4; step++) {
				answerStep();
				press(worded(main(), step === 3 ? copy.generate : copy.next));
			}
			expect(document.activeElement?.tagName).toBe('H1');
			expect(document.activeElement?.textContent).toBe(copy.proposalTitle);
			press(worded(main(), copy.edit));
			expect(focused().startsWith(copy.bodyHelp)).toBe(true);
		});

		// The Week step mixes a multiple choice, a required single one and an
		// optional field; the heads say which is which.
		test('the week step says which answer takes several and which can stay blank', async () => {
			await mount(locale);
			for (let step = 0; step < 2; step++) {
				answerStep();
				press(worded(main(), copy.next));
			}
			const heads = [...main().querySelectorAll('legend, label')].map((h) =>
				h.textContent?.replace(/\s+/g, ' ').trim(),
			);
			expect(heads).toContain(copy.equipment);
			expect(heads).toContain(copy.session);
		});

		test('the way out goes to Today, and adds no gate on the way back', async () => {
			await mount(locale);
			answerStep();
			press(worded(main(), copy.next));
			press(exitLink(copy.exit));
			await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
			expect(router?.state.location.pathname).toBe('/');
			// The bar is back on Today: the intake held nothing over it.
			expect(document.querySelector('nav')).toBeTruthy();
		});
	});
}
