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
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import { routeTree } from '../src/routeTree.gen.ts';

/**
 * A Thursday in week 5 of the seeded block — a training day with a full slot,
 * and the day the carry-forward and the timer both have something to show.
 *
 * Imported rather than written out here, because #73 gave the three browser
 * gates the same seeded record resolved against the same instant. One
 * declaration is what lets a contrast failure in a seeded `/log` row and an
 * assertion in this file be talked about as the same account on the same day;
 * two copies would drift, and the drift would stay invisible until the suites
 * disagreed about which slot was on screen.
 */
const THURSDAY = new Date(PINNED_NOW);

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
			// *Target* is the first word on **Prescription**'s `_Avoid_` list, so the
			// copy says what the glossary says (ADR 0014).
			const word = locale === 'en-US' ? 'prescribed' : 'prescrito';
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

		// Cue preferences (#105): one shared component, here and behind the Timer
		// screen's header control. Settings shows it in full; it reads the store,
		// so the countdown pressed is the stored one — three, the default.
		test('renders the cue settings in Settings', async () => {
			const settings = await render('/settings');
			expect(settings).toContain(locale === 'en-US' ? 'Timer cues' : 'Sinais do timer');
			expect(settings).toContain(locale === 'en-US' ? 'Count down the last' : 'Contar os últimos');
			expect(settings).toContain(
				locale === 'en-US'
					? 'Vibrate when work or rest begins'
					: 'Vibrar quando começa esforço ou descanso',
			);
			// Whether this device can vibrate is the client's to say. The string
			// render is the server's, which cannot know, so it says nothing.
			expect(settings).not.toContain(locale === 'en-US' ? 'This device' : 'Este aparelho');
			// The three lengths, with the default the one pressed, labelled as a
			// group by the row that names them.
			expect(settings).toMatch(/<fieldset[^>]*aria-labelledby="[^"]+"/);
			expect(settings).toMatch(/aria-pressed="true"[^>]*>3s</);
			expect(settings).toMatch(/aria-pressed="false"[^>]*>5s</);
			expect(settings).toMatch(/aria-pressed="false"[^>]*>10s</);
			// The buzz is on by default: a checked switch.
			expect(settings).toMatch(
				/role="switch"[^>]*aria-checked="true"|aria-checked="true"[^>]*role="switch"/,
			);
		});

		// Timer (#101). The presets come from the library, read in the locale, each
		// with its shape and its length, each exercise linked to the study the
		// library cites; and the clock is there to run the one selected.
		test('renders the Timer screen: the presets and the clock', async () => {
			const timer = await render('/timer');
			expect(timer.length).toBeGreaterThan(2000);

			expect(timer).toContain(locale === 'en-US' ? 'Presets' : 'Predefinidos');
			// An exercise and one of its variants, in the locale.
			expect(timer).toContain(locale === 'en-US' ? 'Max Hangs' : 'Max Hangs');
			expect(timer).toContain(
				locale === 'en-US'
					? '7/3 · 20mm half-crimp + open hand'
					: '7/3 · 20mm half-crimp + mão aberta',
			);
			// Its shape and its total, 12:58 for four sets of 7/3 repeaters.
			expect(timer).toContain(locale === 'en-US' ? '6 × 7s/3s · 4 sets' : '6 × 7s/3s · 4 séries');
			expect(timer).toContain('12:58');
			// The study, linked out.
			expect(timer).toContain('href="https://pubmed.ncbi.nlm.nih.gov/33647876/"');
			expect(timer).toContain(
				locale === 'en-US' ? 'Critical force &amp; endurance' : 'Força crítica e resistência',
			);
			// The clock: its strip, its Start, and the way into the full-screen face.
			// The strip is named by the preset it runs, not by "Interval timer",
			// which would repeat the page's own title.
			expect(timer).not.toContain(locale === 'en-US' ? 'Interval timer' : 'Timer de intervalos');
			// What the clock reads, said for a screen reader rather than hidden
			// behind the button's label (#99's review): the idle number is the
			// prepare length, and it says so.
			expect(timer).toContain(
				locale === 'en-US'
					? 'Ready, 10 seconds. Next up: Prepare'
					: 'Pronto, 10 segundos. A seguir: Preparar',
			);
			expect(timer).toContain(locale === 'en-US' ? '>Start<' : '>Iniciar<');
			expect(timer).toContain(
				locale === 'en-US'
					? 'aria-label="Full-screen clock"'
					: 'aria-label="Relógio em tela cheia"',
			);
			// A preset is the library's: there is no setup to edit it from here.
			expect(timer).not.toContain('aria-controls="timer-setup"');
		});

		// The Stopwatch tab (#108). The screen opens on Protocols, with the switch
		// above the clock; the stopwatch is rendered behind it, hidden, so a
		// protocol and the stopwatch can both hold their place at once.
		test('renders the Protocols | Stopwatch switch and the Stopwatch tab', async () => {
			const timer = await render('/timer');
			const [protocols, stopwatch] =
				locale === 'en-US' ? ['Protocols', 'Stopwatch'] : ['Protocolos', 'Cronômetro'];
			expect(timer).toMatch(new RegExp(`aria-pressed="true"[^>]*>${protocols}<`));
			expect(timer).toMatch(new RegExp(`aria-pressed="false"[^>]*>${stopwatch}<`));
			// The switch comes before the clock, and the protocols before the stopwatch.
			expect(timer.indexOf(`>${stopwatch}<`)).toBeLessThan(timer.indexOf('>Max Hangs<'));

			// The stopwatch tab, hidden until chosen: zero, in the locale's decimal
			// mark, its controls, and the laps it has not recorded yet.
			const tab = timer.slice(timer.lastIndexOf('<div hidden'));
			expect(tab).toContain(locale === 'en-US' ? '>Ready<' : '>Pronto<');
			expect(tab).toContain(
				`0:00<span class="text-[0.5em] text-ink-dim">${locale === 'en-US' ? '.0' : ',0'}</span>`,
			);
			expect(tab).toContain(locale === 'en-US' ? '>Start<' : '>Iniciar<');
			expect(tab).toContain(locale === 'en-US' ? '>Lap<' : '>Volta<');
			expect(tab).toContain(
				locale === 'en-US'
					? 'aria-label="Full-screen stopwatch"'
					: 'aria-label="Cronômetro em tela cheia"',
			);
			expect(tab).toContain(locale === 'en-US' ? 'Laps' : 'Voltas');
			expect(tab).toContain(locale === 'en-US' ? 'No laps yet.' : 'Nenhuma volta ainda.');
			// What the number reads out: the count and the lap being timed.
			expect(tab).toContain(
				locale === 'en-US' ? '0:00.0 elapsed. Lap 1: 0:00.0' : '0:00,0 decorridos. Volta 1: 0:00,0',
			);
			// Lap is offered only once the watch runs.
			expect(tab).toMatch(
				new RegExp(
					`disabled=""[^>]*><svg[^]*?</svg>${locale === 'en-US' ? 'Lap' : 'Volta'}</button>`,
				),
			);
		});

		// The cue settings' shortcut (#105): one discreet control in the header,
		// beside the title, opening the same component Settings shows. A closed
		// popover renders nothing in a string render, so what is asserted is the
		// control and what it says it opens.
		test('puts the cue settings behind a control in the Timer header', async () => {
			const timer = await render('/timer');
			const header = timer.slice(
				timer.indexOf('<h1'),
				timer.indexOf('</header>', timer.indexOf('<h1')),
			);
			expect(header).toContain(
				locale === 'en-US' ? 'aria-label="Timer cues"' : 'aria-label="Sinais do timer"',
			);
			expect(header).toContain('aria-haspopup="dialog"');
			expect(header).toContain('min-h-11');
		});

		// Saved protocols (#103). The seeded one is listed above the presets, with
		// its shape and length, and the clock opens on it: the athlete's own come
		// first. Selected, it offers its two actions — duplicate and delete.
		test('lists the saved protocol and opens the clock on it', async () => {
			const timer = await render('/timer');
			const screen = timer.slice(timer.indexOf('<main'), timer.indexOf('</main>'));

			expect(screen).toContain(locale === 'en-US' ? 'Saved protocols' : 'Protocolos salvos');
			// The athlete's own words, as they wrote them: the suite seeds once, in
			// en-US, and a saved protocol's name is not translated after the fact.
			const name = 'Warm-up hangs';
			expect(screen).toContain(name);
			expect(screen).toContain(
				locale === 'en-US' ? '5 × 10s/20s · 2 sets' : '5 × 10s/20s · 2 séries',
			);
			expect(screen).toContain('5:30');
			// Above the presets, not after twenty-four of them.
			expect(screen.indexOf(name)).toBeLessThan(
				screen.indexOf(locale === 'en-US' ? 'Presets' : 'Predefinidos'),
			);
			// Selected, so it carries its actions; no empty copy beside a real row.
			expect(screen).toContain(locale === 'en-US' ? '>Duplicate<' : '>Duplicar<');
			expect(screen).toContain(locale === 'en-US' ? '>Delete<' : '>Excluir<');
			expect(screen).not.toContain(
				locale === 'en-US' ? 'No saved protocols yet' : 'Nenhum protocolo salvo ainda',
			);
		});

		test('puts the chrome on every screen', async () => {
			for (const path of ['/', '/train', '/timer', '/log', '/login', '/settings']) {
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
			for (const path of ['/', '/train', '/timer', '/log']) {
				const html = await render(path);
				expect(html).not.toContain('&lt;b&gt;');
				expect(html).not.toContain('&lt;/b&gt;');
			}
			const today = await render('/');
			expect(today).toContain(locale === 'en-US' ? '>7/3 repeaters</b>' : '>repeaters 7/3</b>');
		});
	});
}

// The full-screen clock is a closed Base UI dialog in a string render, and an
// open one renders nothing either, because its portal mounts in an effect. So
// the clock's controls are asserted the way the athlete reaches them: mount Train
// in the (jsdom) DOM, open the clock, press the buttons, read what the clock says.
//
// en-US only. A mounted app runs the root's effects, and one of them applies the
// seeded account's locale (`useResolvedLocale`), which is en-US: a pt-BR pass
// here would be the app and the test fighting over the language, not a test of
// the clock. The pt-BR labels are held to the en-US keys by `check:i18n`.
describe('the full-screen clock on Train', () => {
	beforeAll(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	});
	beforeEach(() => overwriteGetLocale(() => 'en-US'));

	const press = (el: HTMLButtonElement | null | undefined) => {
		expect(el, 'button to press').toBeTruthy();
		act(() => el?.click());
	};
	const labelled = (scope: ParentNode, label: string) =>
		scope.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
	const worded = (scope: ParentNode, text: string) =>
		[...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

	test('skips and goes back a segment, with labelled 48px+ controls', async () => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/train'] }),
		});
		await router.load();
		// The root route renders the whole document, so it is mounted on the
		// document itself. Under a `<div>` the root would sit inside the `<body>` it
		// renders, and once a dialog's portal has mounted, a click outside it sends
		// React's event dispatch round that loop forever — and a `<div>` root left
		// behind holds the document's `<body>` against the next test's. That is the
		// price of mounting the real route rather than a copy of the clock; nothing
		// here hydrates.
		const host = document;
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		try {
			press(labelled(host, 'Full-screen clock'));
			const clock = document.querySelector<HTMLElement>('[role="dialog"]');
			if (!clock) throw new Error('the full-screen clock did not open');
			const skip = labelled(clock, 'Skip to the next segment');
			const back = labelled(clock, 'Back a segment');
			// Named for a screen reader, and big enough for a chalky finger: 56px.
			for (const control of [skip, back]) {
				expect(control).toBeTruthy();
				expect(control?.className).toContain('h-14');
				expect(control?.className).toContain('w-14');
			}
			// Nothing to jump within before the clock has started.
			expect(skip?.disabled).toBe(true);
			expect(back?.disabled).toBe(true);

			press(worded(clock, 'Start'));
			press(worded(clock, 'Pause'));
			const first = clock.getAttribute('aria-label');
			// The "Next up" line names the segment a skip has to land on.
			const line = [...clock.querySelectorAll('span')].find(
				(el) => !el.closest('.sr-only') && el.textContent?.startsWith('Next up'),
			);
			const next = line?.querySelector('span')?.textContent;
			expect(next).toBeTruthy();
			expect(next).not.toBe(first);

			press(skip);
			expect(clock.getAttribute('aria-label')).toBe(next);
			// Paused before the jump, paused after it.
			expect(worded(clock, 'Start')).toBeTruthy();
			press(back);
			expect(clock.getAttribute('aria-label')).toBe(first);
		} finally {
			act(() => root.unmount());
		}
	});
});

// Only one of the Timer screen's two clocks runs at a time (#108): the press
// that starts one pauses the other. Mounted on the document, as Train's is and
// for the same reason, and pressed on the strips, where both tabs stay mounted
// and the hidden one keeps its place.
describe('the Timer screen runs one clock at a time', () => {
	beforeAll(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	});
	beforeEach(() => overwriteGetLocale(() => 'en-US'));

	const press = (el: HTMLButtonElement | null | undefined) => {
		expect(el, 'button to press').toBeTruthy();
		act(() => el?.click());
	};
	const worded = (scope: ParentNode, text: string) =>
		[...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
	/** The strip a full-screen control sits in: the protocol clock's or the stopwatch's. */
	const strip = (host: ParentNode, fullScreen: string) => {
		const el = host
			.querySelector(`button[aria-label="${fullScreen}"]`)
			?.closest<HTMLElement>('.rounded-lg');
		if (!el) throw new Error(`no strip holds "${fullScreen}"`);
		return el;
	};
	const runs = (scope: ParentNode) => worded(scope, 'Pause') !== undefined;

	test('starting the stopwatch pauses the protocol, and starting the protocol pauses the stopwatch', async () => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/timer'] }),
		});
		await router.load();
		const host = document;
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		try {
			const protocol = strip(host, 'Full-screen clock');
			const stopwatch = strip(host, 'Full-screen stopwatch');

			const close = () =>
				press(
					document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close"]'),
				);

			// Start opens the full-screen clock; the athlete closes it to reach the tab.
			press(worded(protocol, 'Start'));
			expect(runs(protocol)).toBe(true);
			close();

			press(worded(host, 'Stopwatch'));
			// Looking at the other tab pauses nothing: the protocol keeps counting.
			expect(runs(protocol)).toBe(true);

			press(worded(stopwatch, 'Start'));
			expect(runs(stopwatch)).toBe(true);
			expect(runs(protocol)).toBe(false);
			close();

			press(worded(host, 'Protocols'));
			press(worded(protocol, 'Start'));
			expect(runs(protocol)).toBe(true);
			expect(runs(stopwatch)).toBe(false);
			// Paused, not reset: it offers to resume what it counted, never Start.
			expect(worded(stopwatch, 'Lap')?.disabled).toBe(true);
		} finally {
			act(() => root.unmount());
		}
	});
});

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
		for (const path of ['/', '/train', '/timer', '/log', '/settings']) {
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
		// The Timer screen runs the same clock, and its preset rows are picked
		// between sets: neither goes under the floor.
		const timer = await render('/timer');
		// The screen only: the shell's own locale switch is not this rule's.
		const screen = timer.slice(timer.indexOf('<main'), timer.indexOf('</main>'));
		expect(screen).toContain('min-h-12');
		expect(screen).not.toMatch(/min-h-(8|9|10)\b/);
	});
});
