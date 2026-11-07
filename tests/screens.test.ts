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
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { ProtocolEditor } from '../src/components/ProtocolEditor.tsx';
import { ProtocolRows } from '../src/components/ProtocolRows.tsx';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { formOf } from '../src/lib/screens/timer.ts';
import { recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { createSavedProtocol, deleteSavedProtocol } from '../src/lib/store/savedProtocols.ts';
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
			// The shell is around it: the navigation renders on sign-in too.
			expect(login).toContain('view-transition-name:navigation');
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
			// The flash switch (#107), on every device alike.
			expect(settings).toContain(
				locale === 'en-US'
					? 'Flash the clock at each segment change'
					: 'Piscar o relógio a cada troca de segmento',
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

		// The voice (#106) is one more switch in the same component, on by
		// default, and read before the buzz: it is the cue that carries the most.
		test('renders the voice switch in the cue settings, on, above the buzz', async () => {
			const settings = await render('/settings');
			const voice =
				locale === 'en-US'
					? 'Say each segment and the countdown aloud'
					: 'Falar cada segmento e a contagem em voz alta';
			const buzz =
				locale === 'en-US'
					? 'Vibrate when work or rest begins'
					: 'Vibrar quando começa esforço ou descanso';
			expect(settings).toContain(voice);
			expect(settings.indexOf(voice)).toBeLessThan(settings.indexOf(buzz));
			const row = settings.slice(settings.indexOf(voice), settings.indexOf(buzz));
			expect(row).toMatch(
				/role="switch"[^>]*aria-checked="true"|aria-checked="true"[^>]*role="switch"/,
			);
			// Whether this device has a voice is the client's to say, as for the buzz.
			expect(settings).not.toContain(locale === 'en-US' ? 'no voice' : 'não tem voz');
		});

		// Timer (#111). The screen is only the list: no clock strip above it and no
		// Protocols | Stopwatch tabs. Top to bottom, the stopwatch's own row, the
		// athlete's saved protocols, what they ran recently, then the presets,
		// grouped by exercise and closed. A clock opens from a row and is a dialog,
		// which a string render leaves out.
		test('renders the Timer screen as the list: Stopwatch, Saved, Recent, Presets', async () => {
			const timer = await render('/timer');
			const screen = timer.slice(timer.indexOf('<main'), timer.indexOf('</main>'));
			expect(screen.length).toBeGreaterThan(2000);

			// No tabs and no sticky strip.
			expect(screen).not.toContain(locale === 'en-US' ? '>Protocols<' : '>Protocolos<');
			expect(screen).not.toContain('aria-pressed');
			expect(screen).not.toContain('sticky');
			// Nothing on the list starts a clock: Start is the clock's.
			expect(screen).not.toContain(locale === 'en-US' ? '>Start<' : '>Iniciar<');

			const at = (text: string) => {
				const i = screen.indexOf(text);
				expect(i, text).toBeGreaterThan(-1);
				return i;
			};
			const stopwatch = at(locale === 'en-US' ? '>Stopwatch<' : '>Cronômetro<');
			const saved = at(locale === 'en-US' ? '>Saved<' : '>Salvos<');
			const recent = at(locale === 'en-US' ? '>Recent<' : '>Recentes<');
			const presets = at(locale === 'en-US' ? '>Presets<' : '>Predefinidos<');
			// Stopwatch is the first row, above everything the screen lists.
			expect(stopwatch).toBeLessThan(saved);
			expect(saved).toBeLessThan(recent);
			expect(recent).toBeLessThan(presets);
			// Nothing has been run in a fresh render, and Recent says so.
			expect(screen.slice(recent, presets)).toContain(
				locale === 'en-US' ? 'The last three protocols you run' : 'Os três últimos protocolos',
			);
		});

		// Each row: the name, the shape, the length — and beside it, not inside it,
		// its own ⋯, named for the protocol it acts on (#111).
		test('lists each saved protocol with its shape, its length and its own ⋯', async () => {
			const timer = await render('/timer');
			const screen = timer.slice(timer.indexOf('<main'), timer.indexOf('</main>'));
			// The athlete's own words, as they wrote them: the suite seeds once, in
			// en-US, and a saved protocol's name is not translated after the fact.
			const name = 'Warm-up hangs';
			expect(screen).toContain(name);
			expect(screen).toContain(
				locale === 'en-US' ? '5 × 10s/20s · 2 sets' : '5 × 10s/20s · 2 séries',
			);
			expect(screen).toContain('5:30');
			// The second one has a cooldown, and its shape says so (#104).
			expect(screen).toContain(
				locale === 'en-US' ? '8 × 20s/10s · 2:00 cooldown' : '8 × 20s/10s · 2:00 de desaquecimento',
			);
			// A tap on the row opens its clock; the row says so to a screen reader.
			const row = screen.slice(screen.lastIndexOf('<button', screen.indexOf(name)));
			expect(row.slice(0, row.indexOf('>'))).toContain('aria-haspopup="dialog"');
			// Its ⋯: a 44px square with a border, labelled with the protocol's name.
			const more = locale === 'en-US' ? `Actions for ${name}` : `Ações de ${name}`;
			const trigger = screen.slice(screen.lastIndexOf('<button', screen.indexOf(more)));
			const tag = trigger.slice(0, trigger.indexOf('>'));
			expect(tag).toContain('w-11');
			expect(tag).toContain('min-h-11');
			expect(tag).toContain('border');
			expect(tag).toContain('aria-haspopup="menu"');
			// The actions are in its menu, not right-floating under a row.
			expect(screen).not.toContain(locale === 'en-US' ? '>Duplicate<' : '>Duplicar<');
			expect(screen).not.toContain(locale === 'en-US' ? '>Delete<' : '>Excluir<');
			expect(screen).not.toContain('justify-end');
			// And a new one is made from under the list.
			expect(screen).toContain(locale === 'en-US' ? '>New protocol<' : '>Novo protocolo<');
			expect(screen).not.toContain(
				locale === 'en-US' ? 'No saved protocols yet' : 'Nenhum protocolo salvo ainda',
			);
		});

		// An unnamed saved protocol is listed under its shape (#112), and the line
		// under it says it has no name, as the approved mockup draws it — not the
		// same shape twice.
		test('lists an unnamed saved protocol under its shape once, marked unnamed', async () => {
			const row = await createSavedProtocol(
				{
					name: '',
					protocol: { prepare: 5, work: 6, rest: 4, rounds: 3, sets: 1, setRest: 0, cooldown: 0 },
				},
				THURSDAY.getTime(),
			);
			try {
				const timer = await render('/timer');
				const screen = timer.slice(timer.indexOf('<main'), timer.indexOf('</main>'));
				// Once as text; the ⋯'s label names it too, which is not a second row line.
				expect(screen.split('>3 × 6s/4s')).toHaveLength(2);
				const name = screen.indexOf('3 × 6s/4s');
				const after = screen.slice(name, screen.indexOf('</button>', name));
				expect(after).toContain(locale === 'en-US' ? 'unnamed' : 'sem nome');
			} finally {
				await deleteSavedProtocol(row.id);
			}
		});

		// The presets: grouped by exercise, every group closed until it is opened,
		// and no study links — those moved to the clock's ready state (#110).
		test('closes every preset group, and links no study from the list', async () => {
			const timer = await render('/timer');
			const screen = timer.slice(timer.indexOf('<main'), timer.indexOf('</main>'));
			const presets = screen.slice(
				screen.indexOf(locale === 'en-US' ? '>Presets<' : '>Predefinidos<'),
			);
			// The exercise heads are there, as closed disclosures with a count.
			expect(presets).toContain('>Max Hangs<');
			const groups = presets.match(/aria-expanded="(true|false)"/g) ?? [];
			expect(groups.length).toBeGreaterThan(5);
			expect(groups.every((g) => g === 'aria-expanded="false"')).toBe(true);
			expect(presets).toContain(locale === 'en-US' ? '2 presets' : '2 predefinidos');
			// Their rows wait behind the tap.
			expect(presets).not.toContain(
				locale === 'en-US'
					? '7/3 · 20mm half-crimp + open hand'
					: '7/3 · 20mm half-crimp + mão aberta',
			);
			expect(screen).not.toContain('pubmed.ncbi.nlm.nih.gov');
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

		// The editor's rows (#112), which `/train`'s Adjust uses too: in the order a
		// run goes — prepare, the block, the sets, the cooldown — each a label, a
		// value to tap and type into, and 48px − / + either side of it. A time from
		// a minute up reads m:ss; under it, seconds.
		test('renders the protocol rows in run order, with − / + and a value to type', () => {
			const html = renderToString(
				createElement(ProtocolRows, {
					id: 'p',
					fields: formOf('', {
						prepare: 10,
						work: 4,
						rest: 5,
						rounds: 4,
						sets: 3,
						setRest: 180,
						cooldown: 0,
					}).fields,
					refused: new Set<never>(),
					onChange: () => {},
				}),
			);
			const labels =
				locale === 'en-US'
					? [
							'Prepare',
							// Not "Block": that is the glossary's run of weeks. The work,
							// the rest and how many times is a round, counted in rounds.
							'Rounds',
							'Work',
							'Rest',
							'Rounds',
							'Sets',
							'Sets',
							'Rest between',
							'Cooldown',
						]
					: [
							'Preparar',
							'Rodadas',
							'Esforço',
							'Descanso',
							'Rodadas',
							'Séries',
							'Séries',
							'Descanso entre',
							// A soft hyphen, so it breaks as "Desaque-cimento" at 360px.
							'Desaque\u00adcimento',
						];
			const shown = [...html.matchAll(/<(?:label|h3)[^>]*>([^<]+)</g)].map((match) => match[1]);
			expect(shown).toEqual(labels);
			// Each value is a field the numeric keyboard opens on, labelled by its row.
			const values = [...html.matchAll(/<input[^>]*>/g)].map((match) => match[0]);
			expect(values).toHaveLength(7);
			for (const input of values) expect(input).toContain('inputMode="numeric"');
			expect(values.map((input) => /value="([^"]*)"/.exec(input)?.[1])).toEqual([
				'10s',
				'4s',
				'5s',
				'4',
				'3',
				'3:00',
				'0s',
			]);
			// A number to a screen reader, not the text "10s" or "3:00": a spin
			// button with its value, its least, and the value in words.
			expect(values[5]).toContain('role="spinbutton"');
			expect(values[5]).toContain('aria-valuenow="180"');
			expect(values[5]).toContain(
				locale === 'en-US'
					? 'aria-valuetext="3 minutes 0 seconds"'
					: 'aria-valuetext="3 minutos e 0 segundos"',
			);
			expect(values[1]).toContain('aria-valuemin="1"');
			expect(values[3]).toContain('aria-valuetext="4"');
			// − and + on every row, 48px, each named for what it changes.
			const [less, more] = locale === 'en-US' ? ['Decrease', 'Increase'] : ['Diminuir', 'Aumentar'];
			const work = locale === 'en-US' ? 'Work' : 'Esforço';
			expect(html).toMatch(new RegExp(`aria-label="${less} ${work}"[^>]*class="[^"]*size-12`));
			expect(html).toMatch(new RegExp(`aria-label="${more} ${work}"[^>]*class="[^"]*size-12`));
			expect(html.match(new RegExp(`aria-label="${less} `, 'g'))).toHaveLength(7);
			expect(html.match(new RegExp(`aria-label="${more} `, 'g'))).toHaveLength(7);
		});

		test('puts the chrome on every screen', async () => {
			for (const path of ['/', '/train', '/timer', '/log', '/login', '/settings']) {
				const html = await render(path);
				// The navigation, and the view-transition names the `app.css` rules
				// pair with. A renamed name silently re-animates the chrome, which is
				// invisible in review and obvious on the device. What the bar holds
				// is `tests/navigation.test.ts`'s.
				expect(html.match(/<nav[\s>]/g) ?? [], path).toHaveLength(1);
				expect(html).toContain('view-transition-name:topbar');
				expect(html).toContain('view-transition-name:navigation');
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
			// Before the start it is the ready state (#110): one Start, and nothing
			// to jump within, so no skip or back at all.
			expect(labelled(clock, 'Skip to the next segment')).toBeNull();
			expect(labelled(clock, 'Back a segment')).toBeNull();

			press(worded(clock, 'Start'));
			press(worded(clock, 'Pause'));
			// Paused, Reset stands where skip was (#110): it only exists while
			// nothing counts, so a slip mid-hang cannot throw the run away.
			expect(labelled(clock, 'Skip to the next segment')).toBeNull();
			const back = labelled(clock, 'Back a segment');
			// Named for a screen reader, and big enough for a chalky finger: 64px.
			for (const control of [back, labelled(clock, 'Reset')]) {
				expect(control).toBeTruthy();
				expect(control?.className).toContain('size-16');
			}
			const first = clock.getAttribute('aria-label');
			// The reading says what a skip has to land on.
			const spoken = [...clock.querySelectorAll('.sr-only')]
				.map((el) => el.textContent ?? '')
				.find((text) => text.includes('Next up: '));
			const next = spoken?.split('Next up: ')[1];
			expect(next).toBeTruthy();
			expect(next).not.toBe(first);

			// Skip lives in the running row; run, skip, and pause again.
			press(worded(clock, 'Resume'));
			press(labelled(clock, 'Skip to the next segment'));
			press(worded(clock, 'Pause'));
			expect(clock.getAttribute('aria-label')).toBe(next);
			// Paused after the jump, and it offers to resume, never to start over.
			expect(worded(clock, 'Resume')).toBeTruthy();
			press(labelled(clock, 'Back a segment'));
			expect(clock.getAttribute('aria-label')).toBe(first);
		} finally {
			act(() => root.unmount());
		}
	});

	// #110: the strip is one line. Before the start and after the end it is the
	// protocol's name and Start — no shape line and no total, which live on the
	// ready state. And a finished run's way back in lands on that ready state,
	// not on the Done face (#111).
	test('the strip carries no shape or total, and a finished run reopens ready', async () => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/train'] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		const shapeOrTotal = /\d+s\/|\d+ sets|\d+:\d\d/;
		try {
			press(labelled(document, 'Full-screen clock'));
			const clock = document.querySelector<HTMLElement>('[role="dialog"]');
			if (!clock) throw new Error('the full-screen clock did not open');
			const reset = labelled(clock, 'Reset');
			if (reset) press(reset);
			const name = clock.getAttribute('aria-label');
			press(labelled(clock, 'Close'));
			expect(labelled(document, 'Full-screen clock')?.textContent).not.toMatch(shapeOrTotal);

			// Run it to the end. A closed clock's dialog is gone from the document,
			// so the reopened one is looked up again.
			press(labelled(document, 'Full-screen clock'));
			const run = document.querySelector<HTMLElement>('[role="dialog"]');
			if (!run) throw new Error('the full-screen clock did not reopen');
			press(worded(run, 'Start'));
			for (let i = 0; i < 200 && run.getAttribute('aria-label') !== 'Done'; i++)
				press(labelled(run, 'Skip to the next segment'));
			expect(run.getAttribute('aria-label')).toBe('Done');
			press(labelled(run, 'Close'));
			expect(labelled(document, 'Full-screen clock')?.textContent).not.toMatch(shapeOrTotal);

			press(labelled(document, 'Full-screen clock'));
			const again = document.querySelector<HTMLElement>('[role="dialog"]');
			expect(again?.getAttribute('aria-label')).toBe(name);
			expect(again?.textContent).toContain('in total');
			expect(worded(again ?? document, 'Start')).toBeTruthy();
		} finally {
			act(() => root.unmount());
		}
	});
});

// #112: the clock's ready state on Train adjusts the prescribed protocol with the
// editor's rows — run order, − / + and a value to type — not the interim grid of
// seven boxes #110 left there. A press changes the protocol the clock is about
// to run, so the total above it moves with it.
describe('Adjust on Train', () => {
	beforeAll(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	});
	beforeEach(() => overwriteGetLocale(() => 'en-US'));

	test('uses the editor’s rows, and a press changes what the clock runs', async () => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/train'] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		try {
			act(() =>
				document
					.querySelector<HTMLButtonElement>('button[aria-label="Full-screen clock"]')
					?.click(),
			);
			const clock = document.querySelector<HTMLElement>('[role="dialog"]');
			if (!clock) throw new Error('the full-screen clock did not open');
			// Back to the ready state, where Adjust lives, if an earlier test left
			// Train's clock paused mid-run.
			const reset = clock.querySelector<HTMLButtonElement>('button[aria-label="Reset"]');
			if (reset) act(() => reset.click());
			// A section headed Adjust (#110), open as the approved ready state is:
			// no disclosure to find first.
			expect(
				[...clock.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Adjust'),
			).toBeUndefined();
			const heading = [...clock.querySelectorAll('h2')].find(
				(h) => h.textContent?.trim() === 'Adjust',
			);
			expect(heading).toBeTruthy();
			expect(heading?.closest('section')?.getAttribute('aria-labelledby')).toBe(heading?.id);
			const values = clock.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]');
			expect(values).toHaveLength(7);
			expect(clock.querySelector('input[type="number"]')).toBeNull();
			const total = () => clock.querySelector('.display')?.textContent;
			const before = total();
			const work = values[1].value;
			act(() =>
				clock.querySelector<HTMLButtonElement>('button[aria-label="Increase Work"]')?.click(),
			);
			expect(values[1].value).not.toBe(work);
			expect(total()).not.toBe(before);
			// Cleared and left, a value goes back to the number the clock will run,
			// rather than showing one it will not.
			const ran = values[1].value;
			act(() => {
				values[1].focus();
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
					values[1],
					'',
				);
				values[1].dispatchEvent(new Event('input', { bubbles: true }));
			});
			act(() => values[1].blur());
			expect(values[1].value).toBe(ran);
			expect(values[1].getAttribute('aria-invalid')).toBe('false');
		} finally {
			act(() => root.unmount());
		}
	});
});

/**
 * How a test opens a screen's protocol clock the way the athlete does: on
 * Train, the strip's number; on the Timer screen, a tap on a row (#111), which
 * lands on the clock's ready state. The seeded saved protocol is the row.
 */
function openProtocolClock(path: string) {
	const opener =
		path === '/timer'
			? listRow('Warm-up hangs')
			: document.querySelector<HTMLButtonElement>('button[aria-label="Full-screen clock"]');
	expect(opener, `the way into the clock on ${path}`).toBeTruthy();
	act(() => opener?.click());
}

/** A row on the Timer screen's list: the button that opens a clock, by the text
 *  on it. */
function listRow(text: string): HTMLButtonElement | null {
	return (
		[...document.querySelectorAll<HTMLButtonElement>('main button[aria-haspopup="dialog"]')].find(
			(b) => b.textContent?.includes(text),
		) ?? null
	);
}

/** The Timer screen's mini bar: the way back into a clock, held at the bottom of
 *  the list while it runs (#111). */
function miniBar(): HTMLElement | null {
	return document.querySelector<HTMLElement>('main [data-bottom-bar]');
}

// Only one of the Timer screen's two clocks runs at a time (#108): the press
// that starts one pauses the other. And whichever was started last has the mini
// bar at the bottom of the list (#111), which a tap takes back to its clock.
describe('the Timer screen runs one clock at a time, in the mini bar', () => {
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
	const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
	const close = () =>
		press(document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close"]'));

	test('a run left for the list goes on in the bar, and the bar goes back to its clock', async () => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/timer'] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		try {
			// Nothing runs, so there is no bar.
			expect(miniBar()).toBeNull();

			openProtocolClock('/timer');
			press(worded(dialog() ?? document, 'Start'));
			close();
			// Back on the list, still counting: the bar has the segment, the number
			// and Pause, and the clock's own way back.
			const bar = miniBar();
			expect(bar?.textContent).toContain('Prepare');
			expect(worded(bar ?? document, 'Pause')).toBeTruthy();
			press(bar?.querySelector<HTMLButtonElement>('button[aria-label="Full-screen clock"]'));
			expect(dialog()?.getAttribute('aria-label')).toBe('Prepare');
			close();

			// The stopwatch's row opens the stopwatch; starting it pauses the
			// protocol, and the bar is now the stopwatch's.
			press(listRow('Stopwatch'));
			press(worded(dialog() ?? document, 'Start'));
			close();
			expect(miniBar()?.querySelector('button[aria-label="Full-screen stopwatch"]')).toBeTruthy();
			expect(miniBar()?.querySelector('button[aria-label="Full-screen clock"]')).toBeNull();
			expect(worded(miniBar() ?? document, 'Pause')).toBeTruthy();

			// Back to the protocol: paused by the stopwatch, so it resumes (#110:
			// never "Start" mid-run), and that pauses the stopwatch.
			openProtocolClock('/timer');
			press(worded(dialog() ?? document, 'Resume'));
			close();
			expect(miniBar()?.querySelector('button[aria-label="Full-screen clock"]')).toBeTruthy();
			expect(worded(miniBar() ?? document, 'Pause')).toBeTruthy();
			// A look at another protocol while this one runs leaves it running: the
			// other row opens its own ready state, and the bar is still this run's.
			press(listRow('Tabata finisher'));
			expect(dialog()?.getAttribute('aria-label')).toBe('Tabata finisher');
			close();
			expect(worded(miniBar() ?? document, 'Pause')).toBeTruthy();
			press(miniBar()?.querySelector<HTMLButtonElement>('button[aria-label="Full-screen clock"]'));
			expect(dialog()?.getAttribute('aria-label')).not.toBe('Tabata finisher');
			expect(worded(dialog() ?? document, 'Pause')).toBeTruthy();
			close();
			// Paused from the bar, it stays on the list, as a paused bar.
			press(worded(miniBar() ?? document, 'Pause'));
			expect(dialog()).toBeNull();
			expect(worded(miniBar() ?? document, 'Resume')).toBeTruthy();
		} finally {
			act(() => root.unmount());
		}
	});
});

// The stopwatch in the clock's screen language (#110): a neutral field, never a
// segment's colour, and Reset only while it is paused. And a count left for
// another screen is back in the bar on return, as a protocol's is (#111).
describe('the stopwatch on the Timer screen', () => {
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
	const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
	const resetButton = () =>
		dialog()?.querySelector<HTMLButtonElement>('button[aria-label="Reset"]') ?? null;
	/** Let the stopwatch's 100ms tick run a couple of times, on the real clock. */
	const count = () => act(() => new Promise((resolve) => setTimeout(resolve, 250)));
	const SEGMENT_COLOURS = /var\(--(ok|warn|stop|cooldown)\)/;
	async function mount() {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/timer'] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		return root;
	}
	/** Open the stopwatch from its row, at zero. */
	function openAtZero() {
		press(listRow('Stopwatch'));
		const pause = worded(dialog() ?? document, 'Pause');
		if (pause) press(pause);
		const reset = resetButton();
		if (reset) press(reset);
	}

	test('has no segment colour, and Reset only while paused', async () => {
		const root = await mount();
		try {
			openAtZero();
			expect(resetButton()).toBeNull();
			press(worded(dialog() ?? document, 'Start'));
			await count();
			expect(resetButton()).toBeNull();
			expect(dialog()?.innerHTML).not.toMatch(SEGMENT_COLOURS);
			press(worded(dialog() ?? document, 'Pause'));
			expect(resetButton()).toBeTruthy();
			expect(dialog()?.innerHTML).not.toMatch(SEGMENT_COLOURS);
			press(dialog()?.querySelector<HTMLButtonElement>('button[aria-label="Close"]'));
		} finally {
			act(() => root.unmount());
		}
	});

	test('a count left for another screen is back in the bar on return', async () => {
		const first = await mount();
		try {
			openAtZero();
			press(worded(dialog() ?? document, 'Start'));
			await count();
			press(dialog()?.querySelector<HTMLButtonElement>('button[aria-label="Close"]'));
			expect(miniBar()?.querySelector('button[aria-label="Full-screen stopwatch"]')).toBeTruthy();
		} finally {
			act(() => first.unmount());
		}
		const second = await mount();
		try {
			expect(miniBar()?.querySelector('button[aria-label="Full-screen stopwatch"]')).toBeTruthy();
			expect(worded(miniBar() ?? document, 'Resume')).toBeTruthy();
		} finally {
			act(() => second.unmount());
		}
	});
});

// The flash (#107), on both screens that run the clock, mounted as above and for
// the same reason. Which transitions flash, and for how long, is the planner's
// and pinned in `protocol.test.ts`; this is the clock drawing what it is handed.
describe('the flash on the full-screen clock', () => {
	beforeAll(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	});
	beforeEach(() => overwriteGetLocale(() => 'en-US'));
	afterEach(() => vi.unstubAllGlobals());

	const press = (el: HTMLButtonElement | null | undefined) => {
		expect(el, 'button to press').toBeTruthy();
		act(() => el?.click());
	};

	/** Mount `path`, open its full-screen clock, run `body` against it. */
	async function withClock(path: string, body: (clock: HTMLElement) => void) {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: [path] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		try {
			openProtocolClock(path);
			const clock = document.querySelector<HTMLElement>('[role="dialog"]');
			if (!clock) throw new Error(`the full-screen clock on ${path} did not open`);
			// From the top: an earlier test may have left this screen's draft paused
			// mid-protocol, and resuming there is no segment change.
			const reset = clock.querySelector<HTMLButtonElement>('button[aria-label="Reset"]');
			if (reset && !reset.disabled) press(reset);
			body(clock);
		} finally {
			act(() => root.unmount());
		}
	}
	const worded = (clock: HTMLElement, text: string) =>
		[...clock.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
	const flashed = (clock: HTMLElement) =>
		clock.querySelector<HTMLElement>('[data-flash]')?.dataset.flash ?? null;

	test.each(['/timer', '/train'])('%s flashes the segment each change lands on', async (path) => {
		await withClock(path, (clock) => {
			expect(flashed(clock)).toBeNull();
			press(worded(clock, 'Start'));
			const first = flashed(clock);
			expect(first).toBeTruthy();
			const flash = clock.querySelector<HTMLElement>('[data-flash]');
			// Out of the way of every tap, and silent: the announcer says the change.
			expect(flash?.getAttribute('aria-hidden')).toBe('true');
			expect(flash?.className).toContain('pointer-events-none');
			expect(flash?.style.animationDuration).toMatch(/^[1-9]\d*ms$/);

			press(
				clock.querySelector<HTMLButtonElement>('button[aria-label="Skip to the next segment"]'),
			);
			expect(flashed(clock)).toBe(
				{ Work: 'work', Rest: 'rest', 'Set rest': 'setRest', Done: 'done' }[
					clock.getAttribute('aria-label') ?? ''
				],
			);
		});
	});

	// ADR 0011, through the real media query: the planner is told, plans a flash
	// of no length, and the clock draws nothing.
	test('draws nothing when the device asks for reduced motion', async () => {
		vi.stubGlobal(
			'matchMedia',
			(query: string) =>
				({
					matches: query === '(prefers-reduced-motion: reduce)',
					media: query,
					addEventListener: () => {},
					removeEventListener: () => {},
				}) as unknown as MediaQueryList,
		);
		await withClock('/train', (clock) => {
			press(worded(clock, 'Start'));
			expect(worded(clock, 'Pause')).toBeTruthy();
			expect(flashed(clock)).toBeNull();
		});
	});
});

// A clock left paused comes back paused, and silent (spec stories 32 and 33).
// The planner's half is pinned in `timerSetup.test.ts`; this is the clock asking
// it the right question at mount. jsdom has no audio and no speech, so the buzz
// is what is listened for: `navigator.vibrate` is called by every arrival cue.
describe('a clock restored paused', () => {
	beforeAll(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	});
	const vibrate = vi.fn();
	beforeEach(() => {
		overwriteGetLocale(() => 'en-US');
		vibrate.mockClear();
		Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
	});
	afterEach(() => {
		Reflect.deleteProperty(navigator, 'vibrate');
	});

	const press = (el: HTMLButtonElement | null | undefined) => {
		expect(el, 'button to press').toBeTruthy();
		act(() => el?.click());
	};
	const worded = (scope: ParentNode, text: string) =>
		[...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

	async function mount(path: string) {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: [path] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		return root;
	}

	test.each(['/timer', '/train'])('%s plays no cue when it comes back', async (path) => {
		const first = await mount(path);
		try {
			openProtocolClock(path);
			const clock = document.querySelector<HTMLElement>('[role="dialog"]');
			if (!clock) throw new Error(`the full-screen clock on ${path} did not open`);
			const reset = clock.querySelector<HTMLButtonElement>('button[aria-label="Reset"]');
			if (reset && !reset.disabled) press(reset);
			press(worded(clock, 'Start'));
			press(worded(clock, 'Pause'));
			// Started, so it buzzed: the listener hears what it is listening for.
			expect(vibrate).toHaveBeenCalled();
		} finally {
			act(() => first.unmount());
		}

		vibrate.mockClear();
		const second = await mount(path);
		try {
			// Back where it was left, paused, rather than idle: the test is about a
			// restored place, not a fresh clock.
			expect(document.body.textContent).toContain('Prepare');
			// Paused mid-run, so it offers to resume, never to start over (#110).
			expect(worded(document, 'Resume')).toBeTruthy();
			expect(vibrate).not.toHaveBeenCalled();
		} finally {
			act(() => second.unmount());
		}
	});
});

// A tap on another row is the commonest thing done on the Timer screen, and it
// used to throw away the place the clock was left in. Each protocol keeps its
// own (spec: the draft is "scoped to the protocol"); and a tap on a row opens
// its clock's ready state (#111), or its place if it has one.
describe('the Timer screen keeps each protocol’s place', () => {
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
	const clock = () => document.querySelector<HTMLElement>('[role="dialog"]');
	const close = () =>
		press(clock()?.querySelector<HTMLButtonElement>('button[aria-label="Close"]'));

	test('a protocol left paused is still paused there after opening another', async () => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/timer'] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		try {
			press(listRow('Warm-up hangs'));
			const reset = clock()?.querySelector<HTMLButtonElement>('button[aria-label="Reset"]');
			if (reset && !reset.disabled) press(reset);
			press(worded(clock() ?? document, 'Start'));
			press(
				clock()?.querySelector<HTMLButtonElement>('button[aria-label="Skip to the next segment"]'),
			);
			press(worded(clock() ?? document, 'Pause'));
			expect(clock()?.getAttribute('aria-label')).toBe('Work');
			close();

			// The other saved protocol has no place: its row lands on the ready
			// state, named for it, with one Start.
			press(listRow('Tabata finisher'));
			expect(clock()?.getAttribute('aria-label')).toBe('Tabata finisher');
			expect(worded(clock() ?? document, 'Start')).toBeTruthy();
			close();

			// And the first is where it was left, paused, as every restored clock is.
			press(listRow('Warm-up hangs'));
			expect(clock()?.getAttribute('aria-label')).toBe('Work');
			expect(worded(clock() ?? document, 'Resume')).toBeTruthy();
			close();
		} finally {
			act(() => root.unmount());
		}
	});

	// A run that finished is no place to come back to: the row opens the ready
	// state (#111), not the Done face.
	test('a finished protocol’s row opens its ready state', async () => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/timer'] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		try {
			press(listRow('Tabata finisher'));
			const reset = clock()?.querySelector<HTMLButtonElement>('button[aria-label="Reset"]');
			if (reset && !reset.disabled) press(reset);
			press(worded(clock() ?? document, 'Start'));
			for (let i = 0; i < 200 && clock()?.getAttribute('aria-label') !== 'Done'; i++)
				press(
					clock()?.querySelector<HTMLButtonElement>(
						'button[aria-label="Skip to the next segment"]',
					),
				);
			expect(clock()?.getAttribute('aria-label')).toBe('Done');
			close();

			press(listRow('Tabata finisher'));
			expect(clock()?.getAttribute('aria-label')).toBe('Tabata finisher');
			expect(clock()?.textContent).toContain('in total');
			expect(worded(clock() ?? document, 'Start')).toBeTruthy();
			close();
		} finally {
			act(() => root.unmount());
		}
	});

	// A preset's row, once its group is open: the clock's ready state, with the
	// study the library cites for its exercise, which left the list (#111).
	test('a tap on a preset row opens its ready state, with its study', async () => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/timer'] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		try {
			const name = '7/3 · 20mm half-crimp + open hand';
			expect(listRow(name)).toBeNull();
			const head = [
				...document.querySelectorAll<HTMLButtonElement>('main button[aria-expanded]'),
			].find((b) => b.textContent?.includes('Repeaters'));
			press(head);
			expect(head?.getAttribute('aria-expanded')).toBe('true');
			press(listRow(name));
			const ready = clock();
			expect(ready?.getAttribute('aria-label')).toBe(name);
			expect(ready?.textContent).toContain('Repeaters');
			expect(ready?.textContent).toContain('in total');
			expect(
				ready?.querySelector('a[href="https://pubmed.ncbi.nlm.nih.gov/33647876/"]'),
			).toBeTruthy();
			// Opened, not started: the row starts nothing, and nothing is in the bar.
			expect(worded(ready ?? document, 'Start')).toBeTruthy();
			close();
			expect(miniBar()).toBeNull();
		} finally {
			act(() => root.unmount());
		}
	});
});

// Recent (#111): the last protocols run, kept on the device, so they survive the
// screen going away and coming back — and never a row Saved already shows.
describe('Recent on the Timer screen', () => {
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
	const clock = () => document.querySelector<HTMLElement>('[role="dialog"]');
	const run = (row: HTMLButtonElement | null) => {
		press(row);
		const reset = clock()?.querySelector<HTMLButtonElement>('button[aria-label="Reset"]');
		if (reset && !reset.disabled) press(reset);
		press(worded(clock() ?? document, 'Start'));
		press(worded(clock() ?? document, 'Pause'));
		press(clock()?.querySelector<HTMLButtonElement>('button[aria-label="Close"]'));
	};
	const recent = () =>
		[...document.querySelectorAll('main section')].find(
			(s) => s.querySelector('h2')?.textContent === 'Recent',
		);
	async function mount() {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/timer'] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		return root;
	}

	test('lists what was run after the screen comes back, leaving saved ones to Saved', async () => {
		const preset = '7/3 · 20mm half-crimp + open hand';
		const first = await mount();
		try {
			press(
				[...document.querySelectorAll<HTMLButtonElement>('main button[aria-expanded]')].find((b) =>
					b.textContent?.includes('Repeaters'),
				),
			);
			run(listRow(preset));
			run(listRow('Warm-up hangs'));
		} finally {
			act(() => first.unmount());
		}

		const second = await mount();
		try {
			const listed = recent();
			expect(listed?.textContent).toContain(preset);
			// Run, and saved: Saved shows it, so Recent does not.
			expect(listed?.textContent).not.toContain('Warm-up hangs');
			// Its rows are rows like any other: a tap opens the clock.
			expect(listed?.querySelector('button[aria-haspopup="dialog"]')).toBeTruthy();
		} finally {
			act(() => second.unmount());
		}
	});
});

// The tapped group head stays under the finger as its group opens or closes
// (#111). jsdom lays nothing out, so where the head is is told to it: the page
// is expected to scroll by exactly what the head moved.
describe('opening a preset group on the Timer screen', () => {
	beforeAll(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	});
	beforeEach(() => overwriteGetLocale(() => 'en-US'));
	afterEach(() => vi.restoreAllMocks());

	test('scrolls the page by what the tapped head moved', async () => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ['/timer'] }),
		});
		await router.load();
		const root = createRoot(document);
		act(() => root.render(createElement(RouterProvider, { router } as never)));
		try {
			const heads = [
				...document.querySelectorAll<HTMLButtonElement>('main h3 > button[aria-expanded]'),
			];
			const head = heads[1];
			if (!head) throw new Error('no second preset group');
			// Read once at the tap, and once after the group above it changed.
			const tops = [400, 340];
			vi.spyOn(head, 'getBoundingClientRect').mockImplementation(
				() => ({ top: tops.shift() ?? 340 }) as DOMRect,
			);
			const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
			act(() => head.click());
			expect(head.getAttribute('aria-expanded')).toBe('true');
			expect(scrollBy).toHaveBeenCalledWith(0, -60);
		} finally {
			act(() => root.unmount());
		}
	});
});

// The protocol editor (#112): its own screen rather than a sheet over a blacked-
// out list, with ✕ and Save at the top, the name optional, and the rows in run
// order. Mounted on its own rather than through the route, so both locales run:
// the app's root would put the seeded account's en-US back.
for (const locale of ['en-US', 'pt-BR'] as const) {
	describe(`the protocol editor, ${locale}`, () => {
		beforeAll(() => {
			(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		});
		beforeEach(() => overwriteGetLocale(() => locale));

		const T = {
			'en-US': {
				title: 'Edit protocol',
				name: 'Name (optional)',
				shape: '4 × 4s/5s · 3 sets',
				save: 'Save',
				close: 'Close',
				more: 'Increase Work',
				refused: 'Whole seconds, 1 or more',
				said: 'Work: 5 seconds',
			},
			'pt-BR': {
				title: 'Editar protocolo',
				name: 'Nome (opcional)',
				shape: '4 × 4s/5s · 3 séries',
				save: 'Salvar',
				close: 'Fechar',
				more: 'Aumentar Esforço',
				refused: 'Segundos inteiros, 1 ou mais',
				said: 'Esforço: 5 segundos',
			},
		}[locale];
		const PROTOCOL = {
			prepare: 10,
			work: 4,
			rest: 5,
			rounds: 4,
			sets: 3,
			setRest: 180,
			cooldown: 0,
		};

		function mount(onSave: (named: unknown) => Promise<void>) {
			const host = document.createElement('div');
			document.body.append(host);
			const root = createRoot(host);
			act(() =>
				root.render(
					createElement(ProtocolEditor, {
						open: true,
						onOpenChange: () => {},
						target: { kind: 'edit', name: '', protocol: PROTOCOL },
						onSave,
					}),
				),
			);
			const screen = document.querySelector<HTMLElement>('[role="dialog"]');
			if (!screen) throw new Error('the editor did not open');
			return {
				screen,
				done: () => {
					act(() => root.unmount());
					host.remove();
				},
			};
		}
		const type = (input: HTMLInputElement, value: string) =>
			act(() => {
				input.focus();
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
					input,
					value,
				);
				input.dispatchEvent(new Event('input', { bubbles: true }));
			});
		const inputFor = (screen: HTMLElement, label: string) => {
			const id = [...screen.querySelectorAll('label')].find(
				(l) => l.textContent === label,
			)?.htmlFor;
			return screen.querySelector<HTMLInputElement>(`[id="${id}"]`);
		};

		test('is a screen of its own, ✕ and Save at the top, the name optional', () => {
			const { screen, done } = mount(async () => {});
			try {
				// The whole viewport, not a sheet over a blacked-out list.
				expect(screen.className).toContain('inset-0');
				expect(document.querySelector('.bg-black\\/70')).toBeNull();
				const header = screen.querySelector('header');
				expect(header?.textContent).toContain(T.title);
				expect(header?.querySelector(`[aria-label="${T.close}"]`)).toBeTruthy();
				expect(
					[...(header?.querySelectorAll('button') ?? [])].some((b) => b.textContent === T.save),
				).toBe(true);
				// No name yet: the placeholder is the shape it will be listed under.
				const name = inputFor(screen, T.name);
				expect(name?.value).toBe('');
				expect(name?.placeholder).toBe(T.shape);
				// The rows, in run order, the set rest in m:ss.
				expect(screen.querySelectorAll('input[inputmode="numeric"]')).toHaveLength(7);
				expect(screen.textContent).not.toContain('(s)');
				expect(screen.textContent).toContain('7:43');
			} finally {
				done();
			}
		});

		test('saves an unnamed protocol, a + press included', async () => {
			const saved: unknown[] = [];
			const { screen, done } = mount(async (named) => {
				saved.push(named);
			});
			try {
				act(() => screen.querySelector<HTMLButtonElement>(`[aria-label="${T.more}"]`)?.click());
				const save = [...screen.querySelectorAll('button')].find((b) => b.textContent === T.save);
				await act(async () => save?.click());
				expect(saved).toEqual([{ name: '', protocol: { ...PROTOCOL, work: 5 } }]);
			} finally {
				done();
			}
		});

		// A keyboard steps the value with the arrows, and Enter goes to the next
		// value rather than saving: on a phone's numeric keypad it is the key next
		// to the digits. Each press is said, since the focus is not on the value.
		test('steps with the arrows, moves on with Enter, and says each press', async () => {
			const saved: unknown[] = [];
			const { screen, done } = mount(async (named) => {
				saved.push(named);
			});
			try {
				const values = screen.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]');
				const key = (el: HTMLElement, k: string) =>
					act(() => {
						el.dispatchEvent(
							new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
						);
					});
				act(() => values[5].focus());
				key(values[5], 'ArrowUp');
				expect(values[5].value).toBe('195');
				key(values[5], 'ArrowDown');
				key(values[5], 'ArrowDown');
				expect(values[5].value).toBe('165');
				key(values[5], 'Enter');
				expect(document.activeElement).toBe(values[6]);
				expect(saved).toEqual([]);
				act(() => screen.querySelector<HTMLButtonElement>(`[aria-label="${T.more}"]`)?.click());
				expect(screen.querySelector('[aria-live="polite"]')?.textContent).toBe(T.said);
			} finally {
				done();
			}
		});

		test('refuses a field that cannot run, under its own row, and saves nothing', async () => {
			const saved: unknown[] = [];
			const { screen, done } = mount(async (named) => {
				saved.push(named);
			});
			try {
				// The dialog puts its first focus on ✕ a frame after it opens; let it, so
				// what is asserted below is the refusal moving it, not that frame.
				await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
				const work = screen.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]')[1];
				type(work, '0');
				const save = [...screen.querySelectorAll('button')].find((b) => b.textContent === T.save);
				await act(async () => save?.click());
				expect(saved).toEqual([]);
				expect(work.getAttribute('aria-invalid')).toBe('true');
				// The line that says so is the work row's own.
				const note = document.getElementById(work.getAttribute('aria-describedby') ?? '');
				expect(note?.textContent).toBe(T.refused);
				expect(document.activeElement).toBe(work);
			} finally {
				done();
			}
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
		for (const path of ['/', '/train', '/timer', '/log', '/settings', '/week', '/welcome']) {
			const html = await render(path);
			expect(html.match(/h-screen-title/g) ?? [], path).toHaveLength(1);
		}
	});

	// Spec #113, story 78: every screen opens the same way. The title is the
	// first thing in the page, inside the screen header (`ScreenHeader`), and
	// nothing the page draws comes before it. `/login` is left out for the reason
	// above; it goes through the same primitive.
	test('every screen opens with the screen header, holding its one title', async () => {
		for (const path of ['/', '/train', '/timer', '/log', '/settings', '/week', '/welcome']) {
			const doc = new DOMParser().parseFromString(await render(path), 'text/html');
			const main = doc.querySelector('main');
			const titles = main?.querySelectorAll('h1') ?? [];
			expect(titles, path).toHaveLength(1);
			const header = titles[0]?.closest('header');
			expect(header?.dataset.screenHeader, path).toBe('');
			// The first element in the page that is not one of its frames is the
			// header itself: nothing sits above the title.
			const first = [...(main?.querySelectorAll('*') ?? [])].find(
				(el) => el === header || !el.contains(header ?? null),
			);
			expect(first, path).toBe(header);
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
