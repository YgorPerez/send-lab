// Sign-in on the shared rhythm (#124, spec #113 stories 76–77).
//
// What the athlete sees on sign-in: the header every screen opens with, then
// what the page has to say (offline, what this device is holding) as the first
// group under it, the fields labelled the way the intake labels its fields, one
// primary, and every line the page says (the notices and a failure) in one
// family whose colour matches what the line says. What the page *decides* is
// `tests/login.test.ts`'s, unchanged.
//
// String renders of the route for the signed-out page in both locales; a
// mounted route (the auth client mocked: nothing resolves in jsdom) for what
// changes after a tap, offline and signed in.

import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import * as m from '../src/lib/paraglide/messages.js';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { resetRecordStore, setActiveAccount } from '../src/lib/store/record.ts';
import { routeTree } from '../src/routeTree.gen.ts';

const auth = vi.hoisted(() => ({
	session: {
		data: null as null | { user: { id: string; email: string } },
		isPending: false,
		error: null,
	},
	signIn: vi.fn(),
	signUp: vi.fn(),
}));

vi.mock('../src/lib/auth-client', () => ({
	authClient: { useSession: () => auth.session },
	useSession: () => auth.session,
	signIn: { email: auth.signIn },
	signUp: { email: auth.signUp },
	signOut: vi.fn(async () => {}),
}));

type Locale = 'en-US' | 'pt-BR';

const COPY = {
	'en-US': {
		title: 'Sign in',
		noRecord: 'Send Lab works without an account',
		offline: 'Signing in is the one thing here that needs a connection',
		fields: ['Email', 'Password'],
		toSignUp: 'No account? Create one',
		passwordMin: 'at least 8 characters',
		credentials: "That email and password don't match an account.",
		unreachable: "Couldn't reach the server.",
		signedIn: 'Signed in',
		account: 'Account',
		goToday: 'Go to Today',
		signOutNote: 'Signing out is in Settings',
	},
	'pt-BR': {
		title: 'Entrar',
		noRecord: 'O Send Lab funciona sem conta',
		offline: 'Entrar é a única coisa aqui que precisa de conexão',
		fields: ['E-mail', 'Senha'],
		toSignUp: 'Sem conta? Crie uma',
		passwordMin: 'no mínimo 8 caracteres',
		credentials: 'Esse e-mail e essa senha não correspondem a nenhuma conta.',
		unreachable: 'Não consegui alcançar o servidor.',
		signedIn: 'Você entrou',
		account: 'Conta',
		goToday: 'Ir para Hoje',
		signOutNote: 'Sair fica em Ajustes',
	},
} as const;

const text = (el: Element | null | undefined) =>
	(el?.textContent ?? '').replace(/\s+/g, ' ').trim();

async function routerAt(path: string) {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	await router.load();
	return router;
}

/** Sign-in's `<main>`, string-rendered and parsed: the signed-out page. */
async function screen(locale: Locale): Promise<HTMLElement> {
	overwriteGetLocale(() => locale);
	const html = renderToString(
		createElement(RouterProvider, { router: await routerAt('/login') } as never),
	);
	const main = new DOMParser().parseFromString(html, 'text/html').querySelector('main');
	if (!main) throw new Error('no main');
	return main;
}

/** A class list carries a negative top or vertical margin: a line pulled up
 *  into the header, which DESIGN.md › The screen header rules out. */
const pulledUp = (el: Element | null | undefined) => /(^|\s)-m[ty]?-/.test(el?.className ?? '');

for (const locale of ['en-US', 'pt-BR'] as const) {
	const copy = COPY[locale];

	describe(`${locale}, sign-in signed out`, () => {
		// Story 76, and DESIGN.md › The screen header: a notice about the whole
		// screen is the first group after the header, a sections gap below it,
		// never a line pulled up into it. The title says what the page is, so
		// nothing under it repeats it.
		test('says what this device holds first under the header, not pulled into it', async () => {
			const main = await screen(locale);
			const header = main.querySelector('[data-screen-header]');
			expect(text(header)).toBe(copy.title);
			const first = header?.nextElementSibling;
			expect(text(first)).toContain(copy.noRecord);
			expect(pulledUp(first)).toBe(false);
			for (const line of first?.querySelectorAll('*') ?? []) expect(pulledUp(line)).toBe(false);
		});

		// Story 76, the field rhythm: a field is named by its label in words, as
		// the intake names a field under a heading (#123), not by the mono
		// furniture label (`.eyebrow`, DESIGN.md › Typography: a unit, a meta
		// reading). The label is the input's accessible name.
		test('names each field in words, by its own label', async () => {
			const main = await screen(locale);
			const inputs = [...main.querySelectorAll('input')];
			expect(inputs.map((i) => i.type)).toEqual(['email', 'password']);
			const labels = inputs.map((i) => main.querySelector(`label[for="${i.id}"]`));
			expect(labels.map(text)).toEqual(copy.fields);
			for (const label of labels) {
				expect(label?.querySelector('.eyebrow'), text(label)).toBeNull();
				expect(label?.className ?? '', text(label)).not.toContain('eyebrow');
			}
		});
	});
}

describe('sign-in after a tap', () => {
	let root: Root | null = null;

	afterEach(() => {
		act(() => root?.unmount());
		root = null;
		auth.session.data = null;
		auth.signIn.mockReset();
		auth.signUp.mockReset();
		setOnline(true, false);
		resetRecordStore();
	});

	/** `announce` fires the event the page listens for; the teardown resets the
	 *  property without it (see `tests/settings.test.ts`). */
	function setOnline(online: boolean, announce = true) {
		Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
		if (announce) window.dispatchEvent(new Event(online ? 'online' : 'offline'));
	}

	/** A working `localStorage` per mount: jsdom's here is not callable. */
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

	async function mount(locale: Locale): Promise<HTMLElement> {
		freshStorage();
		overwriteGetLocale(() => locale);
		const router = await routerAt('/login');
		root = createRoot(document);
		await act(async () => root?.render(createElement(RouterProvider, { router } as never)));
		return document.querySelector('main') as HTMLElement;
	}

	const buttonNamed = (root: ParentNode, name: string) =>
		[...root.querySelectorAll('button')].find((b) => text(b) === name);

	/** Types into a controlled input the way a keyboard does. */
	function type(field: HTMLInputElement, value: string) {
		const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
		set?.call(field, value);
		field.dispatchEvent(new Event('input', { bubbles: true }));
	}

	async function submit(main: HTMLElement) {
		const [email, password] = [...main.querySelectorAll('input')];
		act(() => {
			type(email as HTMLInputElement, 'athlete@example.com');
			type(password as HTMLInputElement, 'correct horse');
		});
		await act(async () => main.querySelector('form')?.requestSubmit());
	}

	for (const locale of ['en-US', 'pt-BR'] as const) {
		const copy = COPY[locale];

		// Story 77: a refused password is the athlete's to fix, so it is said as a
		// stop (vermilion, as a refused value's rule is). A server that could not
		// be reached is a warning about the network, gold as the offline line is:
		// "change nothing and try again" painted as a stop would contradict itself.
		test(`${locale}: a failure is a notice whose colour says whose problem it is`, async () => {
			auth.signIn.mockResolvedValueOnce({
				data: null,
				error: { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' },
			});
			const main = await mount(locale);
			await submit(main);
			const refused = main.querySelector('[role="alert"]');
			expect(text(refused)).toBe(copy.credentials);
			expect(refused?.getAttribute('data-notice')).toBe('stop');

			auth.signIn.mockRejectedValueOnce(new TypeError('Failed to fetch'));
			await submit(main);
			const unreachable = main.querySelector('[role="alert"]');
			expect(text(unreachable)).toContain(copy.unreachable);
			expect(unreachable?.getAttribute('data-notice')).toBe('warn');
		});

		// Offline is said as well as what the device holds (`resolveLogin`), and
		// the two are one group first under the header: the warning in gold, the
		// information in dim ink. The submit is held, with the line above saying why.
		test(`${locale}: offline, says it first, as a warning, beside what the device holds`, async () => {
			const main = await mount(locale);
			act(() => setOnline(false));
			const first = main.querySelector('[data-screen-header]')?.nextElementSibling;
			const lines = [...(first?.querySelectorAll('[data-notice]') ?? [])];
			expect(lines.map((l) => l.getAttribute('data-notice'))).toEqual(['warn', 'info']);
			expect(text(lines[0])).toContain(copy.offline);
			expect(text(lines[1])).toContain(copy.noRecord);
			const submit = main.querySelector('button[type="submit"]') as HTMLButtonElement;
			expect(submit.disabled).toBe(true);
		});

		// Signed in, the page has nothing to ask: who is signed in, said in words
		// as Settings says it, the way back to Today as its one primary, and where
		// signing out lives, as information.
		test(`${locale}: signed in, says who in words, with the way back to Today`, async () => {
			auth.session.data = { user: { id: 'acct_signin', email: 'athlete@example.com' } };
			setActiveAccount('acct_signin');
			const main = await mount(locale);
			expect(text(main.querySelector('[data-screen-header]'))).toBe(copy.account);
			expect(main.querySelector('form')).toBeNull();
			expect(main.querySelector('.eyebrow')).toBeNull();
			expect(text(main)).toContain(copy.signedIn);
			expect(text(main)).toContain('athlete@example.com');
			expect(main.querySelectorAll('[class*="active:bg-flag-deep"]')).toHaveLength(1);
			expect(text(main.querySelector('a[href="/"]'))).toBe(copy.goToday);
			const note = main.querySelector('[data-notice]');
			expect(note?.getAttribute('data-notice')).toBe('info');
			expect(text(note)).toContain(copy.signOutNote);
		});

		// Sign-up asks for better-auth's minimum, said with the field it applies
		// to rather than as a loose line under it.
		test(`${locale}: signing up says the password's minimum in its label`, async () => {
			const main = await mount(locale);
			act(() => buttonNamed(main, copy.toSignUp)?.click());
			const password = main.querySelector('input[type="password"]');
			const label = main.querySelector(`label[for="${password?.id}"]`);
			expect(text(label)).toBe(`${copy.fields[1]} (${copy.passwordMin})`);
		});
	}
});

// The glossary's **Sign-in** (`CONTEXT.md`): never *login*, *authentication* or
// *session*, and in pt-BR never *conectado*, which reads as online beside the
// offline line (Settings moved to "Você entrou" in #122). Every line the page
// can show, in both locales, including the ones only a failure or a mode shows.
describe("sign-in copy, in the glossary's words", () => {
	const LINES = [
		m.login_title,
		m.signup_title,
		m.login_offline,
		m.login_has_record,
		m.login_no_record,
		m.login_signout_note,
		m.auth_to_signup,
		m.auth_to_login,
		m.auth_error,
		m.auth_bad_credentials,
		m.auth_unreachable,
		m.auth_server_error,
		m.auth_email_taken,
		m.auth_password_min,
		m.btn_sign_in,
		m.btn_sign_up,
		m.btn_go_today,
		m.set_signed_in,
	];
	const AVOID = /\b(log ?in|sess(ion|ão)|authenticat\w*|autentica\w*)\b|conectad[oa]/i;

	test.each(['en-US', 'pt-BR'] as const)('%s', (locale) => {
		for (const line of LINES) expect(line({}, { locale })).not.toMatch(AVOID);
	});
});
