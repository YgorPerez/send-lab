// Settings as one list (#122, spec #113 stories 69–71).
//
// What the athlete sees on Settings: every group headed at one rank, every
// control on a row of one list, language beside the units with its full names,
// and, offline, one line saying which controls need a connection, as the first
// thing under the header.
//
// String renders of the route for the signed-out page, in both locales; a
// mounted route with a signed-in account (the session and the token are mocked:
// neither can resolve in jsdom) for the account half and for going offline.

import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { resetRecordStore } from '../src/lib/store/record.ts';
import { routeTree } from '../src/routeTree.gen.ts';

const auth = vi.hoisted(() => ({
	session: {
		data: null as null | { user: { id: string; email: string } },
		isPending: false,
		error: null,
	},
}));

vi.mock('../src/lib/auth-client', () => ({
	authClient: { useSession: () => auth.session },
	useSession: () => auth.session,
	signIn: {},
	signUp: {},
	signOut: vi.fn(async () => {}),
}));

vi.mock('../src/lib/apiTokenClient', () => ({
	readToken: vi.fn(async () => 'sl_token'),
	regenerateToken: vi.fn(async () => 'sl_fresh'),
}));

beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(PINNED_NOW));
	resetRecordStore();
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

/** Settings' `<main>`, parsed, in `locale`. */
async function screen(locale: Locale): Promise<HTMLElement> {
	overwriteGetLocale(() => locale);
	const html = renderToString(
		createElement(RouterProvider, { router: await routerAt('/settings') } as never),
	);
	const main = new DOMParser().parseFromString(html, 'text/html').querySelector('main');
	if (!main) throw new Error('no main');
	return main;
}

const text = (el: Element | null | undefined) =>
	(el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The section a group heading heads. */
const sectionNamed = (main: ParentNode, name: string) =>
	[...main.querySelectorAll('section')].find((s) => text(s.querySelector('h2')) === name);

/** Every control the athlete sets something with: the switches and the choices. */
const controlsIn = (root: ParentNode) => [...root.querySelectorAll('[role="switch"], fieldset')];

const COPY = {
	'en-US': {
		groups: ['Units & display', 'Timer cues', 'Notifications', 'Account'],
		units: 'Units & display',
		rows: ['Weight', 'Length', 'Language'],
		languages: ['English', 'Português'],
	},
	'pt-BR': {
		groups: ['Unidades e exibição', 'Sinais do timer', 'Notificações', 'Conta'],
		units: 'Unidades e exibição',
		rows: ['Peso', 'Comprimento', 'Idioma'],
		languages: ['English', 'Português'],
	},
} as const;

for (const locale of ['en-US', 'pt-BR'] as const) {
	const copy = COPY[locale];

	describe(`${locale}, Settings`, () => {
		// Story 69: one heading rank. Every group is a section headed by an h2 in
		// the same face, and nothing else on the page heads a group.
		test('heads every group at one rank, in the order the page reads', async () => {
			const main = await screen(locale);
			const heads = [...main.querySelectorAll('h2')];
			expect(heads.map(text)).toEqual(copy.groups);
			for (const head of heads) expect(head.className, text(head)).toContain('h-section-sans');
			expect(main.querySelectorAll('h3, h4')).toHaveLength(0);
		});

		// Story 70: the language with full names, beside the units, so the display
		// choices live together.
		test('puts the language beside the units, by its full names', async () => {
			const main = await screen(locale);
			const units = sectionNamed(main, copy.units);
			const rows = [...(units?.querySelectorAll('[data-control-row]') ?? [])];
			expect(rows.map((row) => text(row.querySelector('[id], span')))).toEqual(copy.rows);
			const language = rows[2]?.querySelector('fieldset');
			expect([...(language?.querySelectorAll('button') ?? [])].map(text)).toEqual(copy.languages);
			// The fieldset is named by its row, as every other choice on the page.
			const named = language?.getAttribute('aria-labelledby');
			expect(named && text(main.querySelector(`[id="${named}"]`))).toBe(copy.rows[2]);
			const pressed = language?.querySelector('[aria-pressed="true"]');
			expect(text(pressed)).toBe(locale === 'en-US' ? 'English' : 'Português');
		});

		// Story 69: one surface rule, one row height. Every control is on a
		// `ControlRow`, and each group's rows are one list: a group with one row
		// gets the same surface as a group with four.
		test('puts every control on a row of one list per group', async () => {
			const main = await screen(locale);
			const controls = controlsIn(main);
			expect(controls.length).toBeGreaterThanOrEqual(8);
			for (const control of controls) {
				expect(control.closest('[data-control-row]'), control.outerHTML).not.toBeNull();
				expect(control.closest('[data-control-list]'), control.outerHTML).not.toBeNull();
			}
			for (const section of main.querySelectorAll('section')) {
				if (controlsIn(section).length === 0) continue;
				expect(
					section.querySelectorAll('[data-control-list]'),
					text(section.querySelector('h2')),
				).toHaveLength(1);
			}
		});

		// Signed out, the account group is the one thing that fills it.
		test('says the account is signed out, with the way to sign in', async () => {
			const main = await screen(locale);
			const account = sectionNamed(main, copy.groups[3]);
			expect(text(account)).toContain(
				locale === 'en-US' ? 'Not signed in' : 'Você não está conectado',
			);
			expect(account?.querySelector('a[href="/login"]')).not.toBeNull();
		});
	});
}

describe('en-US, Settings signed in', () => {
	let root: Root | null = null;

	afterEach(() => {
		act(() => root?.unmount());
		root = null;
		setOnline(true, false);
		auth.session.data = null;
	});

	/** `announce` fires the event the page listens for. The teardown resets the
	 *  property without it: the account's sync answers `online` by re-reading
	 *  `/api/state`, which jsdom cannot fetch. */
	function setOnline(online: boolean, announce = true) {
		Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
		if (announce) window.dispatchEvent(new Event(online ? 'online' : 'offline'));
	}

	async function mount(): Promise<HTMLElement> {
		overwriteGetLocale(() => 'en-US');
		auth.session.data = { user: { id: 'acct_settings', email: 'athlete@example.com' } };
		const router = await routerAt('/settings');
		root = createRoot(document);
		await act(async () => root?.render(createElement(RouterProvider, { router } as never)));
		return document.querySelector('main') as HTMLElement;
	}

	const button = (root: ParentNode, name: string) =>
		[...root.querySelectorAll('button')].find((b) => text(b) === name);

	test('shows the account as a row: who is signed in, and Sign out', async () => {
		const main = await mount();
		const account = sectionNamed(main, 'Account');
		const row = account?.querySelector('[data-control-list] [data-control-row]');
		expect(text(row)).toContain('athlete@example.com');
		const signOut = button(row as Element, 'Sign out');
		expect(signOut?.disabled).toBe(false);
	});

	// Story 71, kept from #62: offline, one line says which controls need a
	// connection, and those controls drop their fill. #122 moves the line out of
	// the header: it is the first group under it, not a meta line pulled up into it.
	test('offline, says which controls need a connection, first under the header', async () => {
		const main = await mount();
		const note = /signing out and the API token need a connection/;
		expect(text(main)).not.toMatch(note);

		act(() => setOnline(false));
		const header = main.querySelector('[data-screen-header]');
		expect(text(header)).not.toMatch(note);
		const first = header?.nextElementSibling;
		expect(text(first)).toMatch(note);
		expect(first?.className ?? '').not.toMatch(/(^|\s)-m[ty]?-/);

		const account = sectionNamed(main, 'Account');
		expect(button(account as Element, 'Sign out')?.disabled).toBe(true);
		for (const name of ['Copy', 'Reveal token', 'Regenerate']) {
			expect(button(main, name)?.disabled, name).toBe(true);
		}
	});
});
