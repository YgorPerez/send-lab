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
//
// Set `CHROME_PATH` if Chrome is somewhere unusual. Chrome, the static server
// and the CDP client are `scripts/browser.ts`, shared with `check:motion`.
import { discoverLocales, discoverRoutes, fail, open, parseArgs } from './browser.ts';

// ---------------------------------------------------------------- arguments

const args = parseArgs();
const WIDTH = Number(args.get('width') ?? 360);
const HEIGHT = Number(args.get('height') ?? 800);
/** Below this, a screen did not render rather than rendered well.
 *
 *  A backstop, not the main guard — the uncaught-exception capture is what
 *  actually catches a broken screen, and it names the cause. This only has to be
 *  low enough for the sparsest real page (the sign-in form, at four) and high
 *  enough to reject the router's error boundary, which renders two. */
const MIN_ELEMENTS = Number(args.get('min-elements') ?? 3);

const ROUTES = (args.get('routes') ?? discoverRoutes().join(',')).split(',').filter(Boolean);
const LOCALES = (args.get('locales') ?? discoverLocales().join(',')).split(',').filter(Boolean);

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

const session = await open({
	tool: 'check:contrast',
	width: WIDTH,
	height: HEIGHT,
	...(args.has('url') ? { url: args.get('url') as string } : {}),
});
const { cdp, origin, evaluate, goto } = session;

let exitCode = 0;
try {
	const failures: (Row & { screen: string })[] = [];
	const warnings: string[] = [];
	const exempt: (Row & { screen: string })[] = [];
	let measured = 0;

	for (const locale of LOCALES) {
		await session.setLocale(locale);
		for (const route of ROUTES) {
			const screen = `${locale} ${route}`;
			await goto(`${origin}${route}`);
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
				warnings.push(`${screen}: ${logged.length} page error(s) — ${logged[0].split('\n')[0]}`);
			}
			if (rows.length < MIN_ELEMENTS) {
				fail(
					`${screen}: only ${rows.length} text element(s) rendered, expected at least ${MIN_ELEMENTS}.\n` +
						'  That is an empty or errored screen, not a well-contrasted one.' +
						(logged.length ? `\n  The page also reported: ${logged[0].split('\n')[0]}` : '') +
						'\n  Override with --min-elements=N if the route really is this sparse.',
				);
			}
			measured += rows.length;
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
				(row.disabled ? exempt : failures).push({ screen, ...row });
			}
		}
	}

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
			`check:contrast — ok (${measured} text elements over ${ROUTES.length} route(s) [${routeList}] × ${LOCALES.length} locale(s) [${localeList}], all at or above WCAG AA)`,
		);
	}
} finally {
	await session.close();
}

process.exit(exitCode);
