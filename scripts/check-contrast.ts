// Gate step: every piece of text the app renders clears the WCAG AA contrast
// floor, on every route, in every locale.
//
// WHY A BROWSER AND NOT A PALETTE TEST
// -----------------------------------
// The obvious version of this check compares token pairs — "is `--ink-faint` on
// `--panel` at least 4.5:1" — and it would have passed the day this was written
// while the app was failing in twenty-four places. What it cannot see:
//
//   * **Opacity.** A completed set row carried `opacity-55`. Every colour in it
//     was compliant; the row was not. The 9px column labels measured 5.13:1 in
//     the palette and 2.57:1 on screen.
//   * **Which surface the text actually landed on.** Half the cards on Today
//     were deleted in one change, and their contents moved from `--panel` onto
//     the near-black ground. Nothing in the palette changed; every ratio did.
//   * **Translucent backdrops.** `bg-panel-2/50` over a card composites to a
//     colour that is in no token file.
//   * **The other locale.** pt-BR wraps differently and reaches for different
//     elements; it has to be measured, not assumed.
//
// So this drives a real browser, walks every element that owns a text node, and
// composites ancestor backgrounds and inherited opacity down to the opaque
// ground before computing a single ratio.
//
// WHY IT IS NOT IN `pnpm verify`
// ------------------------------
// `verify` is jsdom-only and needs no browser, and it stays that way: a gate
// that requires Chrome and a completed build is a gate that gets skipped on the
// machine that most needs it. This runs against a *built* app — `pnpm build`
// first — and is meant for CI and for any change that touches colour, opacity or
// layering. When the browser suite that ADR 0005 anticipates finally exists
// (issue #24 / #27), this belongs in it.
//
// USAGE
//   pnpm build && pnpm check:contrast
//   pnpm check:contrast --url=https://send-lab-git-<branch>-….vercel.app
//   pnpm check:contrast --routes=/,/train --locales=pt-BR --width=320
//   pnpm check:contrast --desktop         # the wide layout, 1280px
//   pnpm check:contrast --passes=seeded   # skip the empty account
//
// Set `CHROME_PATH` if Chrome is somewhere unusual. Chrome, the static server
// and the CDP client are `scripts/browser.ts`, shared with `check:motion`.
//
// WHAT IT MEASURES IT ON
// ----------------------
// Twice: once on the seeded training record (`store/seed.ts`, the scenario
// `tests/screens.test.ts` asserts against) and once on the empty account a new
// athlete sees — both on one pinned instant, so a changed number means changed
// code and not a changed weekday. Before #73 this ran the empty account only, on
// the machine's own clock, and reported "ok" over an app in which half the routes
// rendered almost nothing.
import {
	discoverLocales,
	discoverRoutes,
	fail,
	open,
	parseArgs,
	type Session,
	viewport,
} from './browser.ts';
import { floorFor, readsRecord } from './floors.ts';
import {
	type BootState,
	EMPTY_BOOT,
	PINNED_NOW,
	PINNED_NOW_LOCAL,
	seededRecord,
} from './seeded-record.ts';

// ---------------------------------------------------------------- arguments

const args = parseArgs();
/** `--desktop` measures the wide layout (#52): a 1280px viewport *and* emulated
 *  `hover`/`pointer`, without which every `hover:` rule is inert. `--width` and
 *  `--height` still override. */
const { width: WIDTH, height: HEIGHT, desktop: DESKTOP } = viewport(args);
/** Below this, a screen did not render rather than rendered well.
 *
 *  A backstop, not the main guard — the uncaught-exception capture is what
 *  actually catches a broken screen, and it names the cause. This only has to be
 *  low enough for the sparsest real page and high enough to reject the router's
 *  error boundary, which renders two. The sparsest page is `/log` signed out, at
 *  **thirteen** — `/login`, which this comment used to name at four, measures ten.
 *
 *  It is what the **empty** pass is held to, and since #73 it is no longer the
 *  only floor: on the seeded pass each route carries its own, in
 *  `scripts/floors.ts`. One number for the whole app had to be low enough for
 *  `/login` and was therefore far too low for `/log`. */
const MIN_ELEMENTS = Number(args.get('min-elements') ?? 3);

const ROUTES = (args.get('routes') ?? discoverRoutes().join(',')).split(',').filter(Boolean);
const LOCALES = (args.get('locales') ?? discoverLocales().join(',')).split(',').filter(Boolean);
/** Which accounts to measure. Both, unless asked otherwise — the seeded record
 *  is what the athlete has, and the empty one is what a new athlete sees. */
const PASSES = (args.get('passes') ?? 'seeded,empty').split(',').filter(Boolean);

// ------------------------------------------------------------- the measurement

interface Row {
	text: string;
	tag: string;
	cls: string;
	px: number;
	weight: number;
	color: string;
	backdrop: string;
	ratio: number;
	need: number;
	pass: boolean;
	disabled: boolean;
}

/** Runs in the page. Composites every ancestor background and inherited opacity
 *  down to the opaque ground, then measures. */
const PROBE = String.raw`(() => {
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => {
    const la = L(a), lb = L(b), hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  };

  const ground = parse(getComputedStyle(document.body).backgroundColor) ?? { r: 0, g: 0, b: 0, a: 1 };
  // Starts at the element itself, not at its parent. Text is painted on top of
  // its own element's background, and a filled button is the common case: with
  // the parent as the backdrop, white-on-vermilion was measured as
  // white-on-near-black and passed, and dark-on-vermilion measured as
  // dark-on-near-black and reported an impossible 1.00:1.
  const backdropOf = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg && bg.a > 0) stack.push(bg);
      if (bg && bg.a >= 1) break;
    }
    let acc = { ...ground, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };

  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!text) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    let op = 1;
    for (let n = el; n; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity || '1');

    const fgRaw = parse(cs.color);
    if (!fgRaw) continue;
    const backdrop = backdropOf(el);
    const fg = over({ ...fgRaw, a: fgRaw.a * op }, backdrop);
    const px = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    // WCAG 1.4.3 "large text": >=24px, or >=18.66px when bold.
    const need = px >= 24 || (px >= 18.66 && weight >= 700) ? 3 : 4.5;
    const r = ratio(fg, backdrop);
    // 1.4.3 exempts inactive controls. Reported, never failed.
    const disabled = !!el.closest('[disabled], [aria-disabled="true"], :disabled');

    out.push({
      text: text.slice(0, 44),
      tag: el.tagName.toLowerCase(),
      cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 56),
      px, weight,
      color: cs.color,
      backdrop: 'rgb(' + [backdrop.r, backdrop.g, backdrop.b].map((v) => Math.round(v)).join(',') + ')',
      ratio: Math.round(r * 100) / 100,
      need,
      pass: r >= need,
      disabled,
    });
  }
  return out;
})()`;

/**
 * How tall the page laid out, and how wide the viewport it did it in.
 *
 * Not a contrast reading, and it is here because this is the run that has a
 * seeded account and a real layout engine at the same time. #52 had to *derive*
 * `/log`'s desktop height from an older prototype's number — the one page whose
 * whole argument for a second pane is that it halves a long list — because the
 * screen it could measure was the empty one. Reported per route in the summary,
 * so the next layout claim about it rests on a measurement like every other
 * claim in this repo.
 */
const PAGE_BOX = `(() => ({
  height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
  width: window.innerWidth,
}))()`;

/** Wait until nothing is animating and nothing above the tree is still
 *  translucent.
 *
 *  Not defensive padding: a reading taken mid-fade comes back uniformly dark and
 *  looks exactly like a real, widespread contrast failure. The device harness on
 *  issue #54 reported a 56px overflow that did not exist by measuring its own
 *  in-progress state, and the athlete caught it. Measure once, settled. */
const SETTLE = `(async () => {
  await Promise.allSettled(document.getAnimations().map((a) => a.finished));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let op = 1;
  for (let n = document.body; n; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity || '1');
  return { running: document.getAnimations().filter((a) => a.playState === 'running').length, rootOpacity: op };
})()`;

// -------------------------------------------------------------------- run it

/** Everything one pass over the app reports back. */
interface Pass {
	failures: (Row & { screen: string })[];
	exempt: (Row & { screen: string })[];
	warnings: string[];
	/**
	 * What each route came to, so the two passes can be compared.
	 *
	 * Reduced across locales in the direction that is the harder claim:
	 * the **fewest** elements either locale rendered, and the **tallest** page
	 * either produced — pt-BR runs 1.4–2× longer than en-US, so it is the height
	 * a layout has to survive.
	 */
	rendered: Map<string, { elements: number; height: number }>;
	measured: number;
}

/** One pass over every route in every locale, on one boot state. */
async function measure(session: Session, boot: BootState): Promise<Pass> {
	const { cdp, origin, evaluate, goto } = session;
	const out: Pass = {
		failures: [],
		exempt: [],
		warnings: [],
		rendered: new Map(),
		measured: 0,
	};
	const seeded = boot.pass === 'seeded';

	for (const locale of LOCALES) {
		await session.setLocale(locale);
		for (const route of ROUTES) {
			const screen = `${boot.pass} ${locale} ${route}`;
			await goto(`${origin}${route}`);

			// The arrival control (#73), on every screen — the boot script runs on
			// every navigation, so one silent failure is one screen measured unseeded.
			await session.assertBooted(screen);

			const settled = await evaluate<{ running: number; rootOpacity: number }>(SETTLE);
			if (!settled || settled.running > 0 || settled.rootOpacity < 1) {
				fail(
					`${screen}: page never settled (running=${settled?.running}, rootOpacity=${settled?.rootOpacity}). ` +
						'A reading taken mid-animation is wrong in a way that looks like a real failure.',
				);
			}
			const rows = await evaluate<Row[]>(PROBE);
			if (!rows) fail(`${screen}: probe returned nothing`);

			// A crashed app is not a passing contrast run — the router's error
			// boundary renders two short, high-contrast strings, so without a guard
			// the check reports a clean sweep over a screen that never rendered.
			//
			// The guard is *what rendered*, not *what was logged*. Logging is too
			// blunt: React reports recoverable hydration mismatches (#418 and
			// friends) through the same channel as a fatal throw, and this app emits
			// one on first load of a production build — the prerendered shell is
			// deliberately content-free, so the first client paint never matches it.
			// Failing on that would make the check unrunnable on the very build it
			// exists to measure. Errors are surfaced; only an unrendered screen fails.
			const logged = cdp.drain();
			if (logged.length) {
				out.warnings.push(
					`${screen}: ${logged.length} page error(s) — ${logged[0].split('\n')[0]}`,
				);
			}
			// The floor is the route's own on the seeded pass and the global backstop
			// on the empty one, where a low count is the correct answer (#61 owns what
			// an empty screen should show; this only stops it being the only case
			// measured).
			// Thrown, not caught and turned into a `fail()` here: `fail` exits the
			// process, which skips the `finally` that closes Chrome, and an unfloored
			// route is now by far the likeliest way these gates go red. Unwinding
			// reaches the same message through the one `fail` at the bottom of the
			// file, with the session shut down on the way past.
			const floor = floorFor(route, seeded ? 'seeded' : 'empty', MIN_ELEMENTS, rows.length);
			if (rows.length < floor) {
				fail(
					`${screen}: only ${rows.length} text element(s) rendered, expected at least ${floor}.\n` +
						'  That is an empty or errored screen, not a well-contrasted one.' +
						(logged.length ? `\n  The page also reported: ${logged[0].split('\n')[0]}` : '') +
						(seeded
							? "\n  This route's floor is in scripts/floors.ts. Lower it only with a\n" +
								'  measurement, never to get the gate green.'
							: '\n  Override with --min-elements=N if the route really is this sparse.'),
				);
			}
			out.measured += rows.length;
			const box = (await evaluate<{ height: number; width: number }>(PAGE_BOX)) ?? {
				height: 0,
				width: 0,
			};
			const before = out.rendered.get(route);
			out.rendered.set(route, {
				elements: Math.min(before?.elements ?? Number.POSITIVE_INFINITY, rows.length),
				height: Math.max(before?.height ?? 0, box.height),
			});
			if (args.has('verbose')) {
				console.log(`  ${screen} — ${rows.length} text element(s)`);
				for (const r of rows) {
					console.log(
						`    ${r.pass ? ' ' : '!'} ${r.ratio.toFixed(2)}:1 ${r.px}px ${r.tag} "${r.text}"`,
					);
				}
			}
			for (const row of rows) {
				if (row.pass) continue;
				(row.disabled ? out.exempt : out.failures).push({ screen, ...row });
			}
		}
	}
	return out;
}

// The instant, printed before anything is measured: a run is only reproducible
// from its own output if the output says which day it resolved.
console.log(
	`check:contrast — clock pinned to ${PINNED_NOW_LOCAL} local (${PINNED_NOW}), ` +
		`measuring [${PASSES.join(' ')}]`,
);
if (PASSES.length < 2) {
	// Said out loud, because the cross-pass control below is the only check that
	// can catch a record installed where the app does not read it, and one pass
	// silently disables it.
	console.log(
		'  one pass only — the cross-pass control is off, so a record installed\n' +
			'  where the app does not read it would measure as a clean run.',
	);
}

/** The boot states to measure, in order. The seeded record is built once and
 *  handed to the pass that wants it — one Vite load, both locales. */
let exitCode = 0;
try {
	const boots: BootState[] = [];
	for (const pass of PASSES) {
		if (pass === 'seeded') {
			boots.push({ pass, now: PINNED_NOW, cells: await seededRecord(LOCALES) });
		} else if (pass === 'empty') boots.push(EMPTY_BOOT);
		else fail(`unknown pass '${pass}' — expected 'seeded' or 'empty'`);
	}

	const passes = new Map<string, Pass>();
	for (const boot of boots) {
		const session = await open({
			tool: 'check:contrast',
			width: WIDTH,
			height: HEIGHT,
			desktop: DESKTOP,
			boot,
			...(args.has('url') ? { url: args.get('url') as string } : {}),
		});
		try {
			passes.set(boot.pass, await measure(session, boot));
		} finally {
			await session.close();
		}
	}

	// The cross-pass control, and it is the one that proves the record was *read*
	// rather than merely written: a route the floors claim is content-bearing has
	// to render more with an account behind it than without one. A seed that
	// landed in a namespace nothing looks for passes every check above this and
	// fails here.
	//
	// A strict inequality rather than a declared margin, even though `/train`'s is
	// only 201 against 176. The margin there is the sets the athlete has logged,
	// and the 176 is the same slot prescribed from the program — so a copy edit
	// that thins the prescription thins *both* passes and leaves the difference
	// alone. What would close it is the logged work vanishing, which is the thing
	// being asserted.
	const seededPass = passes.get('seeded');
	const emptyPass = passes.get('empty');
	if (seededPass && emptyPass) {
		const inert = ROUTES.filter((route) => {
			const withRecord = seededPass.rendered.get(route)?.elements;
			const without = emptyPass.rendered.get(route)?.elements;
			if (withRecord === undefined || without === undefined) return false;
			return readsRecord(route) && withRecord <= without;
		});
		if (inert.length) {
			fail(
				`the seeded account changed nothing on ${inert.join(', ')}.\n` +
					'  Those routes render a training record, so measuring the same count with\n' +
					'  and without one means the rows were installed somewhere the app does not\n' +
					'  read — check the storage segment in scripts/seeded-record.ts.',
			);
		}
	}

	const failures = [...passes.values()].flatMap((p) => p.failures);
	const exempt = [...passes.values()].flatMap((p) => p.exempt);
	const warnings = [...passes.values()].flatMap((p) => p.warnings);
	const measured = [...passes.values()].reduce((n, p) => n + p.measured, 0);

	// Collapse to one line per distinct colour-on-backdrop-at-size combination.
	const group = (rows: (Row & { screen: string })[]) => {
		const byKey = new Map<string, Row & { screen: string; count: number; samples: string[] }>();
		for (const f of rows) {
			const key = `${f.color}|${f.backdrop}|${f.px}|${f.weight}`;
			const e = byKey.get(key) ?? { ...f, count: 0, samples: [] };
			e.count++;
			if (e.samples.length < 3) e.samples.push(`${f.screen} "${f.text}"`);
			byKey.set(key, e);
		}
		return [...byKey.values()].sort((a, b) => a.ratio - b.ratio);
	};

	const routeList = ROUTES.join(' ');
	const localeList = LOCALES.join(' ');

	if (warnings.length) {
		console.log('check:contrast — page errors seen while measuring (not fatal):');
		for (const w of warnings) console.log(`  ${w}`);
		console.log('');
	}

	if (exempt.length) {
		console.log(
			`check:contrast — ${exempt.length} instance(s) below the floor on disabled controls (exempt under WCAG 1.4.3, reported so they stay visible):`,
		);
		for (const u of group(exempt)) {
			console.log(`  ${u.ratio.toFixed(2)}:1  ${u.px}px  ${u.color} on ${u.backdrop}  ×${u.count}`);
		}
		console.log('');
	}

	if (failures.length) {
		console.error(
			`check:contrast — ${failures.length} instance(s) below the WCAG AA floor, ${group(failures).length} distinct case(s):\n`,
		);
		for (const u of group(failures)) {
			console.error(
				`  ${u.ratio.toFixed(2)}:1 (needs ${u.need}:1)  ${u.px}px/${u.weight}  ${u.color} on ${u.backdrop}  ×${u.count}`,
			);
			console.error(`      ${u.tag}.${u.cls}`);
			for (const s of u.samples) console.error(`      ${s}`);
		}
		console.error(
			'\n  If a ratio here looks impossible from the palette, check for `opacity` on an\n' +
				'  ancestor: it dims the text, and small type has no room between\n' +
				'  de-emphasised and unreadable. Mark state with colour instead.',
		);
		exitCode = 1;
	} else {
		console.log(
			`check:contrast — ok (${measured} text elements over ${PASSES.length} pass(es) [${PASSES.join(' ')}] × ` +
				`${ROUTES.length} route(s) [${routeList}] × ${LOCALES.length} locale(s) [${localeList}], ` +
				'all at or above WCAG AA)',
		);
		for (const [pass, p] of passes) {
			// Elements, and how tall the page laid out at this viewport — the numbers
			// `scripts/floors.ts` is re-derived from, and the ones a layout claim about
			// a long screen has to rest on rather than derive.
			const seen = [...p.rendered]
				.map(([route, { elements, height }]) => `${route} ${elements}el/${height}px`)
				.join(', ');
			console.log(`  ${pass} at ${WIDTH}px: ${seen}`);
		}
	}
} catch (e) {
	fail(e instanceof Error ? e.message : String(e));
}

process.exit(exitCode);
