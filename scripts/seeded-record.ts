// The training record the measuring gates put in front of the browser, and the
// instant they resolve it against.
//
// WHY THE GATES NEEDED THIS
// -------------------------
// `check:contrast`, `check:hydration` and `check:motion` drive a real browser
// over the built app and are the only checks that see opacity, compositing,
// layering, hydration and real animation. Until #73 they saw all of that on an
// app with **no training record in it, on whatever day the machine thought it
// was** — and reported "ok". Two separate defects wearing one green tick:
//
//   * Signed out the store is empty, so `/log` rendered two headings and a zero
//     where five weeks of sessions belong, and `/train` rendered an empty slot.
//     #52 could not measure `/log`'s desktop height at all and had to derive it
//     from an older prototype's number.
//   * Today's slot resolves from the real weekday, so the same commit measured
//     548 text elements on 2026-09-01 and 426 on 2026-09-02. A gate whose output
//     moves on its own is not a regression signal.
//
// WHAT IS DELIBERATELY NOT HERE
// -----------------------------
// **No fixture.** `store/seed.ts` already defines this scenario and
// `tests/screens.test.ts` already asserts against it, so the gates and the unit
// suite come to describe one training record: a contrast failure in a seeded `/log` row
// has a unit test next to it that named the same row. Restating the rows here
// would be a second scenario, and it would drift.
//
// **No seam in the app.** No query parameter, no build flag, no exported test
// hook. ADR 0006 makes the prerendered shell user-independent and precached, and
// a boot-time branch on a URL would put an account-shaped decision inside that
// artefact. So the installation happens from the harness side, into the page,
// before the app's own script runs — `bootScript` below, handed to
// `Page.addScriptToEvaluateOnNewDocument`.
//
// **No hand-written storage keys.** The rows are built by
// `createRecordStore(null, undefined, storage)` against a storage this module
// owns, and the cells are harvested back out of it. The keys are therefore
// whatever the app's own construction path chose — including the signed-out
// segment, which is the one an un-authenticated boot reads. Spelling
// `sendlab:signed-out:…` out by hand here is how a harness comes to file a
// record where nothing looks for it, and the run then looks exactly like the
// empty one it was meant to replace.
//
// **The clock is offset, not frozen.** Pinning `Date.now()` to a constant stops
// elapsed-time arithmetic advancing, and the rest timer's protocol *is*
// elapsed-time arithmetic. So the starting instant is fixed and time runs
// forward from it normally: the resolved slot is deterministic and anything
// measuring a duration still works. `check:motion` is unaffected either way —
// animation timing comes from the compositor clock, not from `Date`.
import type { StorageApi } from '@tanstack/db';
import type { Content } from '../src/lib/content/types.ts';
import type { RecordStore } from '../src/lib/store/collections.ts';
import { LOCALE_KEY } from './paraglide-strategy.ts';

// ------------------------------------------------------------------ the clock

/**
 * The instant every gate run starts its clock at, as a local-time string.
 *
 * A **Thursday in week 5** of the seeded block, and deliberately the same one
 * `tests/screens.test.ts` pins: a slot with a full day type, a carry-forward
 * from yesterday and a timer protocol, so the densest version of each screen is
 * what gets measured rather than a rest day. `tests/seededRecord.test.ts`
 * asserts that it really is a training day in this scenario, so a re-pick that
 * lands on a rest day fails in `pnpm verify` rather than quietly halving what
 * the gates see.
 *
 * Local time rather than UTC, because the app resolves a weekday from the
 * device's own calendar (`isoDayOf`) — the same reason the unit suite pins a
 * local instant. Printed by every check, so a run is reproducible from what it
 * reported.
 */
export const PINNED_NOW_LOCAL = '2026-08-13T09:30:00';

/** `PINNED_NOW_LOCAL` as epoch milliseconds. */
export const PINNED_NOW = new Date(PINNED_NOW_LOCAL).getTime();

// ----------------------------------------------------------------- the record

/**
 * The three pieces of the app the harness borrows to build a record.
 *
 * An interface typed against the real modules' own types, so `tsgo` checks it
 * against `store/seed.ts` rather than against a hand-copy of its signature.
 * `loadStoreModules` supplies them through Vite; the unit suite imports them
 * directly and passes them in, which is what makes the seeding path assertable
 * without a browser.
 */
export interface StoreModules {
	createRecordStore: (
		account: null,
		push: undefined,
		storage: StorageApi | undefined,
	) => RecordStore;
	seedRecordStore: (store: RecordStore, content: Content, locale: string, now: number) => boolean;
	getContent: (locale: string) => Content;
}

/** One locale's worth of `localStorage`, as the app itself would have written
 *  it: the storage key of each collection against its serialized rows. */
export type Cells = Record<string, string>;

/**
 * Build the seeded training record and harvest the cells it persisted.
 *
 * The **rows** are pure over `(locale, now)` given the modules — the same
 * arguments produce the same record, which is the whole property the gates are
 * buying. The **bytes** are not, and that is worth knowing before anyone tries
 * to cache or diff them: the collection stamps every row with a fresh
 * `versionKey` UUID, so two seedings of one scenario serialize differently while
 * describing the same training record. Compare what the cells decode to, never the
 * strings.
 *
 * The storage is a `Map`: the collections persist synchronously on insert, so by
 * the time `seedRecordStore` returns there is nothing left to wait for.
 *
 * Both failure branches are the same failure said twice, and they are checked
 * rather than assumed: the one outcome this must never return is an empty set of
 * cells that reads to its caller as a successful seed.
 */
export function seededCells(
	modules: StoreModules,
	locale: string,
	now: number = PINNED_NOW,
): Cells {
	const cells = new Map<string, string>();
	const storage: StorageApi = {
		getItem: (key) => cells.get(key) ?? null,
		setItem: (key, value) => void cells.set(key, value),
		removeItem: (key) => void cells.delete(key),
	};

	const store = modules.createRecordStore(null, undefined, storage);
	if (!modules.seedRecordStore(store, modules.getContent(locale), locale, now)) {
		throw new Error(
			'seedRecordStore refused a store built one line earlier — it only refuses a store that already holds rows',
		);
	}
	if (cells.size === 0) {
		throw new Error(
			'the seed wrote no storage cells — the collections persist on insert, so `createRecordStore` was handed storage it did not use',
		);
	}
	return Object.fromEntries(cells);
}

/**
 * Load the app's store and content modules in Node.
 *
 * Through Vite rather than `tsx`, because these modules import each other by the
 * `$lib` alias and without file extensions — resolution the app's own bundler
 * does and a bare Node loader does not. A Vite server with `configFile: false`
 * is the smallest thing that resolves them the way the app does; loading
 * `vite.config.ts` instead would drag the TanStack Start plugin and Nitro into a
 * script that wants three functions.
 *
 * `vite` and `./lib-alias.ts` are imported here rather than at module scope on
 * purpose: the alias resolves `import.meta.url`, which Vitest's transform does
 * not hand over as a `file:` URL, and everything above this line has to stay
 * importable from the unit suite.
 */
export async function loadStoreModules(): Promise<StoreModules> {
	const [{ createServer }, { libAlias }] = await Promise.all([
		import('vite'),
		import('./lib-alias.ts'),
	]);
	const server = await createServer({
		configFile: false,
		logLevel: 'warn',
		server: { middlewareMode: true, hmr: false, watch: null },
		resolve: { alias: libAlias() },
	});
	try {
		const [collections, seed, content] = await Promise.all([
			server.ssrLoadModule('/src/lib/store/collections.ts'),
			server.ssrLoadModule('/src/lib/store/seed.ts'),
			server.ssrLoadModule('/src/lib/content/index.ts'),
		]);
		return {
			createRecordStore: collections.createRecordStore as StoreModules['createRecordStore'],
			seedRecordStore: seed.seedRecordStore as StoreModules['seedRecordStore'],
			getContent: content.getContent as StoreModules['getContent'],
		};
	} finally {
		await server.close();
	}
}

/** The seeded record for every locale a gate is about to measure. Both locales
 *  come out of the one scenario, so a pt-BR contrast failure is the same row as
 *  its en-US counterpart rather than a different one. */
export async function seededRecord(
	locales: readonly string[],
	now: number = PINNED_NOW,
): Promise<Record<string, Cells>> {
	const modules = await loadStoreModules();
	return Object.fromEntries(locales.map((locale) => [locale, seededCells(modules, locale, now)]));
}

// ----------------------------------------------------------- what a page boots

/**
 * What state a page boots with — one value, passed to `open()` and read back by
 * the check when it reports, so that every line of output names the pass it came
 * from.
 */
export interface BootState {
	/** The pass's name, as the gate prints it: `seeded` or `empty`. */
	pass: string;
	/** The instant the page's clock starts at. Set on both passes: a comparable
	 *  empty run matters as much as a comparable seeded one. */
	now: number;
	/** The cells to install before the app's script runs, by locale. Absent on
	 *  the empty pass, which is what a new athlete's first launch reads. */
	cells?: Record<string, Cells>;
}

/** No training record at all, on the pinned clock — the coverage the gates had before
 *  #73, minus the moving calendar. */
export const EMPTY_BOOT: BootState = { pass: 'empty', now: PINNED_NOW };

/** Where the boot script records what it installed, for the arrival control to
 *  read back out of the page. */
export const BOOT_MARKER = '__sendLabBoot';

/** What the arrival control found when it asked the page. */
export interface BootReport {
	/** Whether the page is in the state the harness asked for. */
	ok: boolean;
	/** Why not, when it is not. */
	why?: string;
	pass?: string;
	/** The clock the page started on, as the page itself read it. */
	now?: number;
	/** The locale the page resolved its cells for, or `null` before one is set. */
	locale?: string | null;
	/** How many storage keys the script wrote. Zero on the empty pass. */
	installed?: number;
	/** Installed keys that are no longer readable — the app cleared storage, or
	 *  the origin changed under the measurement. */
	missing?: string[];
}

/**
 * The arrival control, as it runs in the page (#73, story 18).
 *
 * The record is not assumed to have landed. Three things are asked of the page
 * after it has loaded, and each of them can actually go red:
 *
 *   1. **the marker is there.** Absent means the script never ran, so the page
 *      is on the machine's clock and holding whatever the last one left — and a
 *      contrast or hydration run over that is not comparable to anything.
 *   2. **every key it wrote is still readable.** Reachable, and the only one of
 *      the three that catches storage disappearing under the measurement: a
 *      cleared origin, a quota refusal mid-run, or an app that wipes what it
 *      does not recognise.
 *   3. **`sendlab:account` is absent.** That key names the namespace
 *      `store/record.ts` opens, and the gates never authenticate — so anything
 *      in it means the store is reading rows these cells are not under, which is
 *      precisely the "seeded somewhere nothing looks" failure, and the only one
 *      of the three observable from outside the app.
 *
 * What none of this can prove is that the app *read* the rows. That question is
 * answered by the per-route floors and, in `check:contrast`, by the cross-pass
 * comparison — a screen holding a training record renders more than the same
 * screen without one, or the record went somewhere the app never looked.
 */
export const BOOT_CHECK = `(() => {
  const m = window[${JSON.stringify(BOOT_MARKER)}];
  if (!m) return { ok: false, why: 'no marker — the boot script never ran' };
  if (m.error) return { ok: false, why: 'storage refused: ' + m.error };
  const missing = (m.installed || []).filter((k) => localStorage.getItem(k) === null);
  const account = localStorage.getItem('sendlab:account');
  const report = {
    pass: m.pass, now: m.now, locale: m.locale,
    installed: (m.installed || []).length, missing,
  };
  if (missing.length) {
    return { ...report, ok: false, why: missing.length + ' installed key(s) are no longer readable' };
  }
  if (account !== null) {
    return { ...report, ok: false, why: 'sendlab:account is set to ' + account + ', so the store opened another namespace' };
  }
  return { ...report, ok: true };
})()`;

/**
 * The script the page runs before its own.
 *
 * Registered once per session through `Page.addScriptToEvaluateOnNewDocument`,
 * so it runs on every navigation — which is why the cells for *both* locales are
 * baked in and the locale is read back out of storage here rather than chosen at
 * registration time. Each measured page therefore boots holding exactly the
 * seeded record, rather than whatever the page before it left behind.
 *
 * `sendlab:account` is removed rather than left alone: it names the account
 * `store/record.ts` opens on a cold start, and a stale one would point the store
 * at a namespace these cells are not under.
 */
export function bootScript(state: BootState): string {
	const marker = JSON.stringify(BOOT_MARKER);
	const pass = JSON.stringify(state.pass);
	return `(() => {
  // The clock: a fixed starting instant, with time still running forward from
  // it, so a resolved slot is deterministic and a rest timer still counts.
  //
  // A Proxy rather than a \`class ... extends Date\`, because a subclass changes
  // three things nobody would think to check and every one of them is a crash
  // rather than a wrong number: \`Date()\` without \`new\` is legal and returns a
  // string, which a class throws on; \`Date.prototype\` stops being the real one,
  // so a value built before this ran fails \`instanceof\`; and \`Date.parse\` /
  // \`Date.UTC\` survive only by static inheritance. The Proxy leaves the object
  // itself in place and intercepts the two operations that need the offset.
  const Real = Date;
  const skew = ${JSON.stringify(state.now)} - Real.now();
  const shifted = () => Real.now() + skew;
  window.Date = new Proxy(Real, {
    // \`newTarget\` is forwarded rather than dropped, so \`class X extends Date\`
    // still gets \`X.prototype\` on its instances.
    construct: (target, args, newTarget) =>
      Reflect.construct(target, args.length === 0 ? [shifted()] : args, newTarget),
    // \`Date()\` with no \`new\` is spelled as the current instant, as a string.
    apply: () => new Real(shifted()).toString(),
    get: (target, prop, receiver) =>
      prop === 'now' ? shifted : Reflect.get(target, prop, receiver),
  });

  const cells = ${JSON.stringify(state.cells ?? {})};
  const installed = [];
  try {
    const locale = localStorage.getItem(${JSON.stringify(LOCALE_KEY)});
    // Before a locale is set, the first entry: the harness's own opening visit
    // to \`/\` happens before \`setLocale\`, and booting it empty would measure
    // one screen of a seeded pass unseeded.
    const forLocale = cells[locale] ?? cells[Object.keys(cells)[0]] ?? {};

    // Everything the app persists goes first, not only the keys about to be
    // written. The app writes rows of its own on boot — \`useDeviceTimeZone\`
    // files a \`prefs\` row on first read — so without this the first route
    // measured in a pass boots without one and every route after it boots with
    // one, which makes route order part of the measurement. \`sendlab:account\`
    // is in here for a second reason: it names the namespace
    // \`store/record.ts\` opens on a cold start, and a stale one would point the
    // store at rows these cells are not under.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sendlab:')) localStorage.removeItem(key);
    }
    for (const key of Object.keys(forLocale)) {
      localStorage.setItem(key, forLocale[key]);
      installed.push(key);
    }
    window[${marker}] = { pass: ${pass}, now: shifted(), locale, installed };
  } catch (e) {
    window[${marker}] = { pass: ${pass}, error: String(e) };
  }
})()`;
}
