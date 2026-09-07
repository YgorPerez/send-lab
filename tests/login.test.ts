// Sign in: the one page that needs the network, and the three things it has to
// say when it cannot have it.
//
// The claim this suite exists to hold is the one the offline ticket (#24) made
// and this page can quietly break: **a lapsed sign-in never clears the local
// store or the queue.** An athlete whose sign-in lapsed still has every set they
// logged on the device, including the writes that have not been sent yet — so a
// page that reads like a fresh install is telling them their training is gone.
// The page cannot know that from the sign-in, which is absent either way; it
// knows it from the records this device is still holding. `heldAccounts()` is
// that read and `resolveLogin` is the decision, so both are asserted here rather
// than left to the copy.
//
// *Sign-in*, not *session*, throughout: a session in this app is training
// (`CONTEXT.md`), which the suite next door is about.
//
// The other half is the two failures the athlete can act on, which are opposite
// instructions: wrong credentials means *type something else*, and an
// unreachable server means *change nothing and try again*. They arrive through
// two different channels — a returned `error` for anything the server answered,
// a thrown `TypeError` for a fetch that never landed — and `classifyAuthFailure`
// is where that distinction is made once.
//
// Rendering is `renderToString` over the real route tree, as in
// `tests/screens.test.ts`, `tests/emptyStates.test.ts` and
// `tests/welcome.test.ts`. Both locales, because error copy is exactly where a
// pt-BR key gets forgotten and a missing one falls back to English silently.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { classifyAuthFailure, resolveLogin } from '../src/lib/screens/login.ts';
import { heldAccounts } from '../src/lib/store/collections.ts';
import { resetRecordStore } from '../src/lib/store/record.ts';
import { routeTree } from '../src/routeTree.gen.ts';

/** An account id, only ever compared for presence here. */
const ACCOUNT = 'acct_1';

describe('what the page says, and to whom', () => {
	test('a device holding nothing is told what an account is for', () => {
		expect(resolveLogin({ account: null, online: true, held: [] })).toEqual({
			signedIn: false,
			notices: ['no-record'],
		});
	});

	// The one this suite exists for. The sign-in is absent in both cases — that is
	// what makes the records on the device the only thing that tells them apart.
	//
	// Named for the device and not for the reader, deliberately: a record here
	// says *someone* signed in on this device, which is not the same claim as the
	// athlete now reading being that someone.
	test('a device still holding a record is told nothing of it was deleted', () => {
		expect(resolveLogin({ account: null, online: true, held: [ACCOUNT] })).toEqual({
			signedIn: false,
			notices: ['has-record'],
		});
	});

	// Offline is a fact about the form; what is held is a fact about the device.
	// Letting the first replace the second dropped the reassurance in the one
	// state that most needs it — a lapsed sign-in in a gym basement.
	test('offline is said as well as, not instead of, what the device holds', () => {
		expect(resolveLogin({ account: null, online: false, held: [ACCOUNT] })).toEqual({
			signedIn: false,
			notices: ['offline', 'has-record'],
		});
		expect(resolveLogin({ account: null, online: false, held: [] })).toEqual({
			signedIn: false,
			notices: ['offline', 'no-record'],
		});
	});

	// Keyed on the store's active account rather than on the sign-in, for the
	// reason Settings is: offline the sign-in cannot be checked and reports
	// nobody, and telling a signed-in athlete in a gym basement that they are
	// signed out is the bug that costs the most trust on the page that can least
	// afford it.
	test('an account in the store is signed in, offline or not', () => {
		for (const online of [true, false]) {
			expect(resolveLogin({ account: ACCOUNT, online, held: [ACCOUNT] })).toEqual({
				signedIn: true,
				notices: [],
			});
		}
	});
});

describe('the failures the athlete can act on', () => {
	// A fetch that never landed throws rather than returning an error, so the
	// route has nothing to hand over — and "nothing" must not read as "the server
	// said no", which would tell the athlete to retype a correct password.
	test('nothing answered at all is unreachable', () => {
		expect(classifyAuthFailure(null)).toBe('unreachable');
		expect(classifyAuthFailure(undefined)).toBe('unreachable');
		// A status of zero is the same thing with a number on it.
		expect(classifyAuthFailure({ status: 0 })).toBe('unreachable');
	});

	test('a wrong password is credentials, whichever way better-auth spells it', () => {
		expect(classifyAuthFailure({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
			'credentials',
		);
		// No code at all — an older build, or a proxy that rewrote the body.
		expect(classifyAuthFailure({ status: 401 })).toBe('credentials');
	});

	test('an email that already has an account is its own answer', () => {
		expect(
			classifyAuthFailure({ status: 422, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' }),
		).toBe('taken');
		expect(classifyAuthFailure({ status: 422, code: 'USER_ALREADY_EXISTS' })).toBe('taken');
	});

	// Not the athlete's mistake, so not "check your details" — and **not**
	// `unreachable` either, whose copy promises nothing was sent. A sign-up that
	// 500s after the row is written is exactly the case that makes that false.
	test('a server that failed is its own case, between the athlete and the network', () => {
		expect(classifyAuthFailure({ status: 500 })).toBe('server');
		expect(classifyAuthFailure({ status: 502, code: 'FAILED_TO_CREATE_SESSION' })).toBe('server');
	});

	test('anything else is refused, and says so generically rather than guessing', () => {
		expect(classifyAuthFailure({ status: 400, code: 'PASSWORD_TOO_LONG' })).toBe('refused');
	});
});

/** A `Storage` whose keys are its own enumerable properties, which is what
 *  `Object.keys` on the real one gives back. */
function storageOf(entries: Record<string, string>): Storage {
	const cells = new Map(Object.entries(entries));
	const api = {
		getItem: (k: string) => cells.get(k) ?? null,
		setItem: (k: string, v: string) => void cells.set(k, v),
		removeItem: (k: string) => void cells.delete(k),
		clear: () => cells.clear(),
		key: (i: number) => [...cells.keys()][i] ?? null,
		get length() {
			return cells.size;
		},
	};
	return Object.assign(Object.create(api) as Storage, entries);
}

describe('the accounts this device is holding', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test('a collection key is an account; a draft, a pointer and signed-out are not', () => {
		vi.stubGlobal(
			'localStorage',
			storageOf({
				'sendlab:acct_1:taskDone': '[]',
				'sendlab:acct_1:sessions': '[]',
				'sendlab:acct_2:unsynced': '[]',
				// The ephemeral stores share the namespace and are not accounts
				// (`lib/ephemeral.ts`: `sendlab:<name>:v<n>`).
				'sendlab:readinessDraft:v1': '{}',
				'sendlab:baselineDraft:v1': '{}',
				// Which account was last active — two segments, not three.
				'sendlab:account': 'acct_1',
				// Training logged with nobody signed in. Real, and not an account:
				// signing in opens the account's own record, not this one.
				'sendlab:signed-out:sessions': '[]',
				'unrelated:key': 'x',
			}),
		);
		expect([...heldAccounts()].sort()).toEqual(['acct_1', 'acct_2']);
	});

	test('a device holding nothing holds no accounts', () => {
		vi.stubGlobal('localStorage', storageOf({}));
		expect(heldAccounts()).toEqual([]);
	});

	// Storage denied, or a `localStorage` whose methods are not functions — the
	// shape `store/collections.ts` already guards its own reads against.
	test('storage that cannot be read is not a claim that the device is empty', () => {
		vi.stubGlobal('localStorage', { getItem: null });
		expect(heldAccounts()).toEqual([]);
	});
});

describe('the page itself', () => {
	afterEach(() => {
		resetRecordStore();
		vi.unstubAllGlobals();
	});

	async function render(locale: 'en-US' | 'pt-BR'): Promise<string> {
		overwriteGetLocale(() => locale);
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/login'] }),
		});
		await router.load();
		return renderToString(createElement(RouterProvider, { router } as never));
	}

	/** The page, without the chrome around it: `AppShell` puts it in the one
	 *  `<main>`, and the strip has a locale switch of its own. */
	function mainOf(html: string): string {
		const from = html.indexOf('<main');
		const to = html.indexOf('</main>');
		expect(from, 'the shell rendered no <main>').toBeGreaterThan(-1);
		return html.slice(from, to);
	}

	/** The two lines this ticket is about, in the locale that renders them. Held
	 *  as literals rather than read back out of `messages/`, the way
	 *  `tests/welcome.test.ts` holds its copy: a test that calls the same message
	 *  function the page calls agrees with a missing translation. */
	const COPY = {
		'en-US': {
			noRecord: 'Send Lab works without an account',
			hasRecord: 'Nothing on it was deleted',
			signIn: 'Sign in',
		},
		'pt-BR': {
			noRecord: 'O Send Lab funciona sem conta',
			hasRecord: 'Nada foi apagado',
			signIn: 'Entrar',
		},
	} as const;

	/** A `localStorage` holding one account's collections, so the page reads the
	 *  device as one a record has been kept on. */
	function holdingARecord(): void {
		vi.stubGlobal('localStorage', storageOf({ [`sendlab:${ACCOUNT}:sessions`]: '[]' }));
	}

	test.each(['en-US', 'pt-BR'] as const)('%s renders the form, signed out', async (locale) => {
		const page = mainOf(await render(locale));
		expect(page).toContain('type="email"');
		expect(page).toContain('type="password"');
		expect(page).toContain('type="submit"');
		expect(page).toContain(COPY[locale].signIn);
	});

	// The ration (#53): one `primary` per screen, and here it is the submit —
	// signing in is the thing the page exists for. Asserted on the markup rather
	// than by counting buttons in review, as `tests/welcome.test.ts` does it:
	// `active:bg-flag-deep` belongs to the `primary` variant alone.
	test.each(['en-US', 'pt-BR'] as const)('%s spends its one primary', async (locale) => {
		const page = mainOf(await render(locale));
		expect(page.match(/active:bg-flag-deep/g) ?? []).toHaveLength(1);
	});

	test.each([
		'en-US',
		'pt-BR',
	] as const)('%s tells a device holding nothing what an account is for', async (locale) => {
		const page = mainOf(await render(locale));
		expect(page).toContain(COPY[locale].noRecord);
		expect(page).not.toContain(COPY[locale].hasRecord);
	});

	// The ticket's own sentence, in both locales: the records of an athlete whose
	// sign-in lapsed are still on the device, and this page must not imply
	// otherwise.
	test.each([
		'en-US',
		'pt-BR',
	] as const)('%s tells a device holding a record that nothing was deleted', async (locale) => {
		holdingARecord();
		const page = mainOf(await render(locale));
		expect(page).toContain(COPY[locale].hasRecord);
		expect(page).not.toContain(COPY[locale].noRecord);
	});

	// The signed-in half of the page is deliberately **not** asserted through
	// `renderToString`. `useActiveAccount` is a `useSyncExternalStore` whose
	// server snapshot is `null` by construction (`store/record.ts`: the
	// prerendered shell must not reach for an account), so a string render always
	// draws the signed-out page whatever the store holds. `setActiveAccount` is
	// exercised on `resolveLogin` above instead, which is where the decision is.
});
