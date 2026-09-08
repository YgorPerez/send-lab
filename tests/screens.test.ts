// The vocabulary's delivery criterion, as a test: every screen renders the whole
// account, in both locales, out of the owned components.
//
// It exists because the alternative was screenshots, and a screenshot proves the
// screen rendered *once*, in the language the machine happened to be in. The
// assertions are content assertions rather than snapshots — they name the things
// that must be on each screen (the verdict, the held work, the watch-outs, the
// readiness check, the bodyweight series, the timer, the past sessions), so a
// refactor that quietly drops one fails here rather than in review.
//
// THE SCENARIO IS SEEDED HERE, AND THAT IS NEW
// --------------------------------------------
// The store used to seed itself on first read. #57 took that out of the boot path
// — it ran synchronously, before any fetch could return, so a real account would
// have hydrated into a store already holding five fabricated weeks — and
// `store/seed.ts` survives as the scenario the tests assert against. So this
// suite seeds the store it is about to render.
//
// That is also more deterministic than what it replaced. The lazy seed fired
// inside the first render, which meant it picked up whichever locale that render
// happened to be in and the second locale reused it. Seeding once, explicitly, in
// `en-US` is the same arrangement said out loud.
//
// THE CLOCK IS FROZEN
// -------------------
// The screens used to read a frozen snapshot that pinned "today" to Thursday's
// Pull day whatever weekday the suite ran on. They read the store now (#56), and
// the store resolves today's slot from the real weekday — so on a Sunday the
// right answer is a rest day and an empty Train screen. That is correct in the
// app and useless in a test, which is why the system clock is pinned to a
// Thursday here: what is asserted below is the content of a known slot, not
// whichever one the calendar offered.
//
// It does not, and cannot, prove layout: jsdom has no layout engine. Contrast and
// horizontal overflow are measured in a real browser by `pnpm check:contrast`,
// and reduced motion by `pnpm check:motion`.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import { routeTree } from '../src/routeTree.gen.ts';

/** A Thursday in week 5 of the seeded block — a training day with a full slot,
 *  and the day the carry-forward and the timer both have something to show. */
const THURSDAY = new Date('2026-08-13T09:30:00');

beforeAll(() => {
	// `Date` only. Faking timers wholesale would stop React and the collections
	// from scheduling anything, and nothing here needs a tick to advance.
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(THURSDAY);
	// Discarded *after* the clock moves, or the collections would be built against
	// the real one.
	resetRecordStore();
	// Signed out, which is what a render with no session reads. The scenario is
	// account state either way; what an account would add is somewhere to sync it.
	seedRecordStore(recordStore(), getContent('en-US'), 'en-US', THURSDAY.getTime());
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

// Note on determinism: Today reads a persisted readiness draft before it falls
// back to this morning's logged answers, so a leftover draft would move the score
// and the verdict this suite asserts. Nothing needs clearing here — jsdom under
// Vitest has no usable `localStorage`, so `use-local-storage-state` falls back to
// its own in-memory map, that map is empty in a fresh worker, and the store's own
// check is what renders. (The same jsdom quirk is why the collections run in
// memory here; see `storageOverride` in `store/collections.ts`.) If a
// browser-mode suite ever runs these, it has to clear storage first.

for (const locale of ['en-US', 'pt-BR'] as const) {
	describe(locale, () => {
		beforeEach(() => overwriteGetLocale(() => locale));

		test('renders the three training screens out of the store', async () => {
			const today = await render('/');
			const train = await render('/train');
			const log = await render('/log');

			for (const html of [today, train, log]) {
				expect(html.length).toBeGreaterThan(2000);
			}

			// Today: verdict, plan, held work, watch-outs, check, bodyweight.
			expect(today).toContain(locale === 'en-US' ? 'Moderate' : 'Moderado');
			expect(today).toContain(locale === 'en-US' ? 'Pull Strength' : 'Puxada');
			expect(today).toContain(locale === 'en-US' ? 'Antagonists' : 'Antagonistas');
			expect(today).toContain(locale === 'en-US' ? 'Tender finger' : 'Dedo sensível');
			expect(today).toContain(locale === 'en-US' ? 'How did you sleep?' : 'Como foi seu sono?');
			expect(today).toContain('71.9');

			// Train: the timer, the exercises, the prescriptions.
			expect(train).toContain(locale === 'en-US' ? 'Sloper Density' : 'Density em Sloper');
			expect(train).toContain('Abrahangs');
			expect(train).toContain(locale === 'en-US' ? 'Interval timer' : 'Timer de intervalos');

			// Log: the checks, the sessions, the activity.
			expect(log).toContain(locale === 'en-US' ? 'Green light' : 'Sinal verde');
			expect(log).toContain(locale === 'en-US' ? 'Max / Tissue' : 'Máx / Tecido');
		});

		// #89. The prescribed range is displayed twice on purpose: once in the
		// task header, as one line of the prescription, and once in the set row's
		// own RPE column, because judging one number against another across a card
		// boundary is not something a person does mid-set. What is asserted here
		// is the second one — that every RPE input carries its target, in the
		// locale, and says it is a target rather than a value.
		test('puts the prescribed RPE beside the RPE input, not only in the header', async () => {
			const train = await render('/train');
			const inputs = [...train.matchAll(/<input[^>]*id="[^"]*-rpe"[^>]*>/g)].map((m) => m[0]);
			expect(inputs.length).toBeGreaterThan(0);
			const word = locale === 'en-US' ? 'target' : 'alvo';
			for (const tag of inputs) {
				expect(tag.toLowerCase()).toContain(word);
				// The range itself, not just the word: "8" or "8–9".
				expect(tag).toMatch(new RegExp(`${word}[^"]*\\d`, 'i'));
			}
			// And it is legible, not only announced — the range is in the column
			// label the athlete is looking at.
			expect(train).toMatch(/RPE<\/span>\s*<span[^>]*>\d/);
		});

		// Week (#63). The one screen whose whole point is the separation ADR-0003
		// protects, so this is the assertion that matters most in the pt-BR pass:
		// the seven weekday *labels* localize, and the seven weekday *keys* they are
		// selected by do not. A page that stored the label would render identically
		// in en-US and fail here.
		test('renders the week as seven slots, labelled in the locale', async () => {
			const week = await render('/week');
			expect(week.length).toBeGreaterThan(2000);

			// The labels, localized. `Seg`..`Dom` against `Mon`..`Sun`.
			const labels =
				locale === 'en-US'
					? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
					: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
			for (const label of labels) expect(week).toContain(label);

			// The selected slot is Thursday's, and its day type is resolved rather
			// than named by the weekday (ADR-0002).
			expect(week).toContain(locale === 'en-US' ? 'Pull' : 'Puxada');
			// The heading rank, and the week's own reading.
			expect(week).toContain(locale === 'en-US' ? 'Microcycle' : 'Microciclo');
			expect(week).toContain(locale === 'en-US' ? 'Week 5' : 'Semana 5');
		});

		// `/` is Today now, so sign-in has its own route.
		//
		// Only the chrome is asserted. `/login` gates its body on
		// `authClient.useSession()`, which cannot resolve in a string render — there
		// is no fetch and no effect — so it renders its pending placeholder here
		// however the session would have gone. What this proves is the route
		// resolves and the shell wraps it; the form itself is measured in a browser
		// by `pnpm check:contrast`, which runs the real client.
		test('resolves the sign-in route inside the shell', async () => {
			const login = await render('/login');
			expect(login).toContain('view-transition-name:screen');
			// The shell is around it. Proved by the menu rather than by a tab label:
			// the tab bar is gone, and the menu's rows live in a closed popover that
			// renders nothing until it is opened, so the trigger is the part of the
			// navigation a string render can see.
			expect(login).toContain('aria-label="Menu"');
		});

		// Settings (#62). Only the half that works offline is asserted here: the
		// account and API-token panels gate on `authClient.useSession()`, which
		// cannot resolve in a string render (see `/login` above). The preferences
		// read the store, so they render signed out — which is also the point of
		// the page's own split: prefs work offline, account actions do not.
		test('renders the preferences out of the store', async () => {
			const settings = await render('/settings');
			expect(settings).toContain(locale === 'en-US' ? 'Units &amp; display' : 'Unidades e exibi');
			expect(settings).toContain(locale === 'en-US' ? 'Language' : 'Idioma');
			expect(settings).toContain(locale === 'en-US' ? 'Notifications' : 'Notifica');
			// The units are identifiers shown as-is in both locales, and the switch
			// is a real switch rather than a styled button.
			expect(settings).toContain('>kg<');
			expect(settings).toContain('>mm<');
			expect(settings).toContain('role="switch"');
		});

		test('puts the chrome on every screen', async () => {
			for (const path of ['/', '/train', '/log', '/login', '/settings']) {
				const html = await render(path);
				// The navigation, and the view-transition names the `app.css` rules
				// pair with. A renamed name silently re-animates the chrome, which is
				// invisible in review and obvious on the device.
				//
				// The three tab labels used to stand in for the navigation here. They
				// are gone with the bar: the menu's rows are inside a closed popover
				// that renders nothing until opened, so what a string render can see
				// is the trigger. `nav_menu` is "Menu" in both locales, which is why
				// this assertion does not branch.
				expect(html).toContain('aria-label="Menu"');
				expect(html).toContain('view-transition-name:topbar');
				expect(html).not.toContain('view-transition-name:tabbar');
				expect(html).toContain('view-transition-name:screen');
			}
		});

		// The exercise library writes emphasis as literal `<b>` — 37 occurrences,
		// across verdict text, flag advice, prescription cues and exercise
		// rationale. React escapes them, so a screen that interpolates one of those
		// strings directly shows the athlete a literal `<b>` and looks broken for a
		// reason that has nothing to do with design. `Prose` tokenises instead of
		// injecting (never `dangerouslySetInnerHTML` on localized strings).
		test('renders inline emphasis rather than escaping it', async () => {
			for (const path of ['/', '/train', '/log']) {
				const html = await render(path);
				expect(html).not.toContain('&lt;b&gt;');
				expect(html).not.toContain('&lt;/b&gt;');
			}
			const today = await render('/');
			expect(today).toContain(locale === 'en-US' ? '>7/3 repeaters</b>' : '>repeaters 7/3</b>');
		});
	});
}

// The three ranks of the type scale, and the 44px touch floor, are properties of
// the vocabulary rather than of any one screen — so they are asserted against
// what the screens actually emit, not against the stylesheet.
describe('the vocabulary holds across the screens', () => {
	beforeEach(() => overwriteGetLocale(() => 'pt-BR'));

	// One `h1` per screen, in the top rank — the fix for "a hierarquia ficou
	// confusa" was three ranks that each mean one thing, and a second screen title
	// on one page is how that unravels. `/login` is excluded: its body does not
	// render without a session (see above).
	test('every screen sets exactly one screen title, in the top rank', async () => {
		for (const path of ['/', '/train', '/log', '/settings']) {
			const html = await render(path);
			expect(html.match(/h-screen-title/g) ?? [], path).toHaveLength(1);
		}
	});

	// pt-BR is the harder locale and the one that breaks first, so the floor is
	// checked there. `min-h-11` is 44px; `min-h-12` is the timer's 48px.
	test('the screens the athlete touches mid-set carry 44px controls', async () => {
		const train = await render('/train');
		expect(train).toMatch(/min-h-1[12]/);
		expect(train).toContain('min-h-12');
	});
});
