// What the measuring gates put in front of the browser, asserted without one.
//
// The three browser checks are observable through exactly two things: an exit
// code and a printed report. Reaching past those into CDP calls or the shape of
// an injected script is testing the implementation, and it breaks on the next
// Chrome or router release for no reason. So what is asserted here is the part
// that is a pure function — the record the harness builds, the instant it
// resolves it against, and the floors it holds each route to — plus the one rule
// about `src/` that this feature must not break.
//
// THE CONTROLS ARE THE POINT
// --------------------------
// This whole feature exists because a green run can be meaningless: three gates
// ran for weeks over an app with no training record in it and reported "ok". So
// every assertion below that could pass by measuring nothing carries its own
// proof that it would have gone red — the pattern `tests/motion.test.ts` and
// `tests/desktop.test.ts` already use, and the one `check:motion` uses in the
// browser.
//
// WHAT CANNOT BE ASSERTED HERE
// ----------------------------
// The *arrival*. Whether the record the harness installed is the record the app
// read is a question about a running page, which is why that control is a
// runtime assertion inside each gate (`session.boot()`, plus the per-route
// floors) rather than a test.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { floorFor, readsRecord, SEEDED_FLOORS } from '../scripts/floors.ts';
import { routeSourceFiles } from '../scripts/routes.ts';
import {
	BOOT_MARKER,
	bootScript,
	type Cells,
	EMPTY_BOOT,
	PINNED_NOW,
	PINNED_NOW_LOCAL,
	type StoreModules,
	seededCells,
} from '../scripts/seeded-record.ts';
import { getContent } from '../src/lib/content/index.ts';
import { isoDayOf } from '../src/lib/dates.ts';
import { weekdayKeyOf } from '../src/lib/ids.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { createRecordStore } from '../src/lib/store/collections.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import type { Session } from '../src/lib/types.ts';

// Paraglide's real strategy is `localStorage` first (ADR 0006) and jsdom under
// Vitest has none, so an un-overridden `getLocale()` throws where content is
// resolved. Pinned before anything reads content, as in `tests/recordStore.test.ts`.
overwriteGetLocale(() => 'en-US');

/**
 * The three functions the harness borrows, imported directly.
 *
 * This is the point of `seededCells` taking them rather than importing them: in
 * a gate they arrive through a Vite server, because these modules import each
 * other by the `$lib` alias with no file extensions and a bare Node loader
 * cannot follow that. Here Vitest resolves them, so the seeding path is
 * assertable with no server and no browser — and it is *the same* path, not a
 * re-implementation of it.
 */
const MODULES: StoreModules = {
	createRecordStore: createRecordStore as StoreModules['createRecordStore'],
	seedRecordStore,
	getContent,
};

const en = seededCells(MODULES, 'en-US');
const pt = seededCells(MODULES, 'pt-BR');

/**
 * The rows a collection's cell holds.
 *
 * The gates never parse these — they hand the bytes straight to the browser — so
 * this is the test's own reading of them, and it exists because the bytes are
 * not comparable: `localStorageCollectionOptions` wraps every row in an entry
 * carrying a freshly generated `versionKey`, so two seedings of one scenario
 * serialize to different strings while describing the same account. What is
 * assertable is what they decode to.
 */
function rows<T>(cells: Cells, collection: string): T[] {
	const cell = cells[`sendlab:signed-out:${collection}`];
	expect(cell, `no cell for ${collection}`).toBeTruthy();
	const parsed = JSON.parse(cell) as Record<string, { data?: T } | T>;
	return Object.values(parsed).map((entry) =>
		entry && typeof entry === 'object' && 'data' in entry ? (entry.data as T) : (entry as T),
	);
}

/** Every collection the seed writes, by name. */
const collections = Object.keys(en).map((key) => key.replace('sendlab:signed-out:', ''));

describe('the record the gates install', () => {
	// The control. Everything below is a claim about these cells, and an empty set
	// of cells satisfies most of them vacuously — which is the exact failure this
	// feature exists to remove: a gate measuring nothing and reporting fine.
	it('holds the scenario, not an empty store', () => {
		const sessions = rows<Session>(en, 'sessions');
		expect(
			sessions.length,
			'the seeded record should carry five weeks of sessions. An empty harvest here ' +
				'means the gates would install nothing and measure the app #73 was written about.',
		).toBeGreaterThan(20);
		expect(rows(en, 'readinessLog').length).toBeGreaterThan(10);
		expect(rows(en, 'baseline')).toHaveLength(1);
	});

	// Story 14. The gates do not authenticate, and `store/record.ts` opens the
	// namespace it last remembered — so rows written under any other segment are
	// rows nothing looks for, and the run looks exactly like the empty one it was
	// meant to replace. Nothing in the harness spells this prefix out; it comes
	// back from the store's own construction path, and this is where that is
	// pinned.
	it('keys every cell under the segment a signed-out boot reads', () => {
		expect(Object.keys(en).length).toBeGreaterThan(5);
		for (const key of Object.keys(en)) expect(key).toMatch(/^sendlab:signed-out:[a-zA-Z]+$/);
	});

	// Story 15. Both locales out of one scenario, so a pt-BR contrast failure is
	// the same row as its en-US counterpart rather than a different one. What
	// legitimately differs is athlete-typed free text — `store/seed.ts` is explicit
	// that a session note is frozen in the language it was typed in, and that this
	// is what ADR 0012 distinguishes a stored *label* from.
	it('writes the same rows in both locales, apart from the athlete-typed notes', () => {
		expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());

		// Every collection but `sessions` decodes identically — everything stored is
		// an id, a number or an ISO date.
		for (const collection of collections.filter((c) => c !== 'sessions')) {
			expect(rows(pt, collection), collection).toEqual(rows(en, collection));
		}

		// And in `sessions` the difference really is only the note. Strip them and
		// the two locales agree row for row.
		const withoutNotes = (cells: Cells) =>
			rows<Session>(cells, 'sessions').map(({ note, ...rest }) => {
				void note;
				return rest;
			});
		expect(withoutNotes(pt)).toEqual(withoutNotes(en));

		// The control for the assertion above: some note is non-empty in each
		// locale, and they are not the same string. Otherwise "only the notes
		// differ" would also be true of a scenario with no notes at all.
		const notes = (cells: Cells) =>
			rows<Session>(cells, 'sessions')
				.map((s) => s.note)
				.filter(Boolean);
		expect(notes(en).length).toBeGreaterThan(0);
		expect(notes(pt).length).toBe(notes(en).length);
		expect(notes(pt)).not.toEqual(notes(en));
	});

	it('refuses to report a seed it did not write', () => {
		// `seededCells` builds its own store, so the only way to reach the refusal
		// is to hand it a seed that always refuses. The message has to name what
		// happened, because a harness that silently harvested nothing is the failure
		// mode this feature is about.
		const refusing: StoreModules = { ...MODULES, seedRecordStore: () => false };
		expect(() => seededCells(refusing, 'en-US')).toThrow(/refused/);
	});
});

describe('the instant the gates pin', () => {
	// Story 11. The scenario resolves today's slot from the weekday, and half the
	// weekdays in it schedule nothing — so an instant chosen carelessly spends
	// every run measuring a rest day, which is the correct answer in the app and
	// useless in a gate. This is what makes the choice a measurement rather than a
	// preference: it fails in `pnpm verify` if the pinned day stops being a
	// training day.
	it('lands on a day the seeded scenario trains', () => {
		const today = isoDayOf(PINNED_NOW);
		const trained = rows<Session>(en, 'sessions').map((s) => s.at);
		expect(
			trained,
			`${today} (${weekdayKeyOf(today)}) has no session in the seeded scenario, so every ` +
				'gate run would measure a rest day: an empty Train screen and no carry-forward. ' +
				'Re-pick PINNED_NOW_LOCAL on a weekday the block schedules work.',
		).toContain(today);
	});

	it('is the same instant the screen suite renders against', () => {
		// Named once, in `scripts/seeded-record.ts`, and imported by
		// `tests/screens.test.ts` — so a browser finding and a unit test can be
		// talked about as the same account on the same day. This asserts the two
		// halves of that one declaration agree.
		expect(new Date(PINNED_NOW_LOCAL).getTime()).toBe(PINNED_NOW);
		expect(weekdayKeyOf(isoDayOf(PINNED_NOW))).toBe('Thu');
	});
});

describe('the boot script', () => {
	const seeded = bootScript({ pass: 'seeded', now: PINNED_NOW, cells: { 'en-US': en } });

	// The control, and it is not theatre: this string is evaluated by Chrome
	// before the page's own script and a syntax error in it does nothing
	// observable — no exception the harness sees, no marker, and a gate that then
	// measures the empty app. `new Function` compiles without running.
	it('compiles', () => {
		expect(() => new Function(seeded)).not.toThrow();
		expect(() => new Function(bootScript(EMPTY_BOOT))).not.toThrow();
	});

	/**
	 * Run the script against a substitute `window` and `localStorage`.
	 *
	 * The script only ever touches those two globals, so this is the whole of its
	 * environment — and running it here rather than only compiling it is what
	 * makes the clock assertions below real. Sandboxed rather than applied to
	 * jsdom's own globals, because patching `Date` for the worker would move every
	 * other suite's clock.
	 */
	function run(
		script: string,
		held: Record<string, string> = {},
	): { Date: DateConstructor; cells: Map<string, string>; marker: unknown } {
		const cells = new Map<string, string>(Object.entries(held));
		// `Object.keys(localStorage)` is how the script enumerates what to clear,
		// so the substitute has to answer that the way the real one does: the cells
		// are own enumerable properties, not only entries behind the three methods.
		const storage = Object.assign(Object.fromEntries(cells), {
			getItem: (k: string) => cells.get(k) ?? null,
			setItem: (k: string, v: string) => {
				cells.set(k, v);
				storage[k] = v;
			},
			removeItem: (k: string) => {
				cells.delete(k);
				delete storage[k];
			},
		}) as Record<string, string> & Storage;
		const window: { Date?: DateConstructor } & Record<string, unknown> = {};
		new Function('window', 'localStorage', script)(window, storage);
		expect(window.Date, 'the script installed no clock').toBeTruthy();
		return { Date: window.Date as DateConstructor, cells, marker: window[BOOT_MARKER] };
	}

	// The clock is the half of this script that touches everything the app does,
	// and three of the ways it can go wrong are crashes rather than wrong numbers.
	// So it is exercised, not inspected.
	it('offsets the clock without breaking Date', () => {
		const { Date: pinned } = run(seeded);

		// Fixed starting instant, and time still running forward from it — the
		// decision the rest timer's elapsed-time arithmetic depends on.
		expect(pinned.now()).toBeGreaterThanOrEqual(PINNED_NOW);
		expect(pinned.now()).toBeLessThan(PINNED_NOW + 60_000);
		expect(new pinned().getTime()).toBeGreaterThanOrEqual(PINNED_NOW);

		// An explicit argument is untouched, and every other way of spelling a date
		// still resolves. A subclass would have lost the last two.
		expect(new pinned(0).getTime()).toBe(0);
		expect(new pinned('2026-08-13T00:00:00Z').toISOString()).toBe('2026-08-13T00:00:00.000Z');
		expect(pinned.parse('2026-08-13T00:00:00Z')).toBe(Date.parse('2026-08-13T00:00:00Z'));
		expect(pinned.UTC(2026, 7, 13)).toBe(Date.UTC(2026, 7, 13));

		// `instanceof` still answers, and `Date()` without `new` is still legal —
		// it is a string, and a class would have thrown on it.
		expect(new pinned() instanceof Date).toBe(true);
		expect(typeof (pinned as unknown as () => string)()).toBe('string');
	});

	it('installs the record under the keys the app reads', () => {
		const { cells } = run(seeded);
		expect([...cells.keys()].sort()).toEqual(Object.keys(en).sort());
		// And clears the pointer that would send the store to another namespace.
		const { cells: after } = run(seeded);
		expect(after.has('sendlab:account')).toBe(false);
	});

	it('leaves the arrival control a marker to read back', () => {
		const { marker } = run(seeded);
		expect(marker, 'the arrival control has nothing to check').toBeTruthy();
		expect((marker as { installed?: string[] }).installed?.length).toBeGreaterThan(5);
	});

	// The empty pass is the coverage the gates had before #73 and it has to stay
	// exactly that: the same pinned clock, and no rows.
	it('installs nothing on the empty pass, on the same clock', () => {
		expect(EMPTY_BOOT.now).toBe(PINNED_NOW);
		expect(EMPTY_BOOT.cells).toBeUndefined();
		const { Date: pinned, cells } = run(bootScript(EMPTY_BOOT));
		expect(cells.size).toBe(0);
		expect(pinned.now()).toBeGreaterThanOrEqual(PINNED_NOW);
	});

	// The app writes rows of its own on boot — `useDeviceTimeZone` files a `prefs`
	// row on first read — so a page that kept them would make route order part of
	// what the next page measures.
	it('clears what the page before it left behind', () => {
		const stale = { 'sendlab:signed-out:prefs': '{"stale":true}', 'sendlab:account': 'someone' };
		const { cells } = run(seeded, stale);
		expect(cells.has('sendlab:account')).toBe(false);
		expect(cells.get('sendlab:signed-out:prefs')).toBeUndefined();
		// And the locale it read itself by is left alone.
		expect(run(seeded, { PARAGLIDE_LOCALE: 'pt-BR' }).cells.get('PARAGLIDE_LOCALE')).toBe('pt-BR');
	});
});

describe('the per-route floors', () => {
	const routes = routeSourceFiles('src/routes');

	// Story 7, and the rule `ROUTE_PARAMS` already follows in `scripts/routes.ts`:
	// a page that quietly inherits "no floor" is a page whose emptiness nothing
	// reports, which is the whole defect. Read off the filesystem rather than from
	// a list here, so a new route file fails this without anyone remembering to
	// add it.
	it('covers every route file the app has', () => {
		const floored = Object.keys(SEEDED_FLOORS);
		const unfloored = routes
			.map((file) => (file === 'index' ? '/' : `/${file}`))
			.filter((route) => !floored.includes(route));
		expect(
			unfloored,
			'each of these renders on the seeded account and has no floor in ' +
				'scripts/floors.ts, so a build in which it renders nothing would pass the ' +
				'measuring gates. Measure it (`pnpm check:contrast` prints per-route counts) ' +
				'and write the number down.',
		).toEqual([]);
	});

	it('refuses a route it has never measured', () => {
		expect(() => floorFor('/not-a-route', 'seeded', 3, 2)).toThrow(/no floor/);
		// And the message carries the number the caller just measured, which is the
		// number to write into the table.
		expect(() => floorFor('/not-a-route', 'seeded', 3, 41)).toThrow(/41/);
	});

	// The floors have to actually raise the bar, or this is the old global minimum
	// with more files. `/log` is the case #73 was written about: 13 text elements
	// signed out against 170 seeded, under a global floor of three.
	it('holds a dense screen to more than the global backstop', () => {
		expect(floorFor('/log', 'seeded', 3)).toBeGreaterThan(100);
		expect(floorFor('/', 'seeded', 3)).toBeGreaterThan(100);
		// The empty pass keeps the backstop: with no record a low count is correct,
		// and #61 owns what an empty screen should show.
		expect(floorFor('/log', 'empty', 3)).toBe(3);
		// And a backstop raised past a floor still wins, so `--min-elements` cannot
		// quietly lower one.
		expect(floorFor('/week', 'seeded', 5000)).toBe(5000);
	});

	// The control for `readsRecord`: it gates the gates' cross-pass assertion, so
	// a table that answered `false` everywhere would disable that control while
	// looking fully populated.
	it('names the screens the record is visible on', () => {
		const reading = Object.keys(SEEDED_FLOORS).filter(readsRecord);
		expect(reading).toContain('/');
		expect(reading).toContain('/log');
		expect(reading).toContain('/train');
		// `/login`'s body gates on a session, so it renders the same either way.
		expect(readsRecord('/login')).toBe(false);
	});
});

describe('none of this ships', () => {
	const read = (path: string) => readFileSync(path, 'utf8');
	const appFiles = [
		'src/routes/__root.tsx',
		'src/routes/index.tsx',
		'src/lib/store/record.ts',
		'src/lib/store/collections.ts',
	];

	// Story 16. ADR 0006 makes the prerendered shell user-independent and
	// precached, so a boot-time branch on a query parameter or a build flag would
	// put an account-shaped decision inside the artefact the service worker caches
	// — and would ship the affordance to the athlete. The installation is
	// therefore entirely on the harness side, and the app must not know it exists.
	it('leaves no trace of the harness in the app', () => {
		for (const file of appFiles) {
			const text = read(file);
			expect(text, `${file} reaches for the gates' harness`).not.toMatch(/seeded-record|scripts\//);
			expect(text, `${file} carries the harness's boot marker`).not.toContain(BOOT_MARKER);
		}
		// `store/seed.ts` is the scenario, and the app imports it nowhere: it was
		// taken out of the boot path by #57 precisely so a real account could not
		// hydrate into a store already holding five fabricated weeks.
		expect(read('src/lib/store/record.ts')).not.toMatch(/from '\.\/seed'/);
	});

	// The control. Four `not.toMatch`es are also what a scan of the wrong files
	// reports, so the same patterns have to hit where they are supposed to.
	it('finds the harness where it does live', () => {
		expect(read('scripts/browser.ts')).toContain('seeded-record');
		expect(read('scripts/browser.ts')).toContain('assertBooted');
		expect(read('scripts/seeded-record.ts')).toContain(BOOT_MARKER);
		expect(read('scripts/check-contrast.ts')).toContain('seeded-record');
	});
});
