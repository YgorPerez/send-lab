// The vocabulary's delivery criterion, as a test: every screen renders the whole
// fixture, in both locales, out of the owned components.
//
// It exists because the alternative was screenshots, and a screenshot proves the
// screen rendered *once*, in the language the machine happened to be in. The
// assertions are content assertions rather than snapshots — they name the things
// the prototype brief says must be on each screen (the verdict, the held work,
// the watch-outs, the readiness check, the bodyweight series, the timer, the past
// sessions), so a refactor that quietly drops one fails here rather than in
// review.
//
// It does not, and cannot, prove layout: jsdom has no layout engine. Contrast and
// horizontal overflow are measured in a real browser by `pnpm check:contrast`,
// and reduced motion by `pnpm check:motion`.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, test } from 'vitest';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { routeTree } from '../src/routeTree.gen.ts';

async function render(path: string): Promise<string> {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	await router.load();
	return renderToString(createElement(RouterProvider, { router } as never));
}

// Note on determinism: Today reads a persisted readiness draft before it falls
// back to the fixture's answers, so a leftover draft would move the score and
// the verdict this suite asserts. Nothing needs clearing here — jsdom under
// Vitest has no usable `localStorage`, `loadReadinessDraft` catches that and
// returns an empty draft, and the fixture's answers are what render. If a
// browser-mode suite ever runs these, it has to clear storage first.

for (const locale of ['en-US', 'pt-BR'] as const) {
	describe(locale, () => {
		beforeEach(() => overwriteGetLocale(() => locale));

		test('renders the three training screens with the whole fixture', async () => {
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
			expect(login).toContain(locale === 'en-US' ? 'Today' : 'Hoje');
		});

		test('puts the chrome on every screen', async () => {
			for (const path of ['/', '/train', '/log', '/login']) {
				const html = await render(path);
				// The three tabs, and the view-transition names the `app.css` rules
				// pair with. A renamed name silently re-animates the chrome, which is
				// invisible in review and obvious on the device.
				expect(html).toContain(locale === 'en-US' ? 'Today' : 'Hoje');
				expect(html).toContain('view-transition-name:topbar');
				expect(html).toContain('view-transition-name:tabbar');
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
		for (const path of ['/', '/train', '/log']) {
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
