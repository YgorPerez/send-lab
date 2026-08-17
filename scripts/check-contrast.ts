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
// Set `CHROME_PATH` if Chrome is somewhere unusual.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientOutputDir } from './output-dir.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

// ---------------------------------------------------------------- arguments

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
	const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
	if (m) args.set(m[1], m[2] ?? '');
}
const WIDTH = Number(args.get('width') ?? 360);
const HEIGHT = Number(args.get('height') ?? 800);
/** Below this, a screen did not render rather than rendered well.
 *
 *  A backstop, not the main guard — the uncaught-exception capture is what
 *  actually catches a broken screen, and it names the cause. This only has to be
 *  low enough for the sparsest real page (the sign-in form, at four) and high
 *  enough to reject the router's error boundary, which renders two. */
const MIN_ELEMENTS = Number(args.get('min-elements') ?? 3);

/** The routes to visit, derived from the file-based route tree rather than
 *  listed here — a page added without a line in this script would otherwise be a
 *  page nobody ever measures. */
function discoverRoutes(): string[] {
	const dir = join(root, 'src', 'routes');
	if (!existsSync(dir)) return ['/'];
	const out: string[] = [];
	for (const name of readdirSync(dir, { withFileTypes: true })) {
		// `api/` is server routes, `__root` is the shell, `-`-prefixed files are
		// TanStack's non-route convention.
		if (name.isDirectory() || !name.name.endsWith('.tsx')) continue;
		if (name.name.startsWith('__') || name.name.startsWith('-')) continue;
		const base = name.name.replace(/\.tsx$/, '');
		out.push(base === 'index' ? '/' : `/${base}`);
	}
	return out.length ? out.sort() : ['/'];
}

/** The locales the project ships, from the inlang settings. */
function discoverLocales(): string[] {
	try {
		const settings = JSON.parse(
			readFileSync(join(root, 'project.inlang', 'settings.json'), 'utf8'),
		) as { locales?: string[] };
		return settings.locales?.length ? settings.locales : ['en-US'];
	} catch {
		return ['en-US'];
	}
}

const ROUTES = (args.get('routes') ?? discoverRoutes().join(',')).split(',').filter(Boolean);
const LOCALES = (args.get('locales') ?? discoverLocales().join(',')).split(',').filter(Boolean);

/** Where Paraglide persists the athlete's choice. Matches the `localStorage`
 *  strategy declared in `scripts/paraglide-strategy.ts`. */
const LOCALE_KEY = 'PARAGLIDE_LOCALE';

function fail(message: string): never {
	console.error(`check:contrast — ${message}`);
	process.exit(1);
}

// ------------------------------------------------------------------- chrome

function findChrome(): string {
	const fromEnv = process.env.CHROME_PATH;
	if (fromEnv) {
		if (!existsSync(fromEnv)) fail(`CHROME_PATH is set to ${fromEnv}, which does not exist`);
		return fromEnv;
	}
	const candidates = [
		'C:/Program Files/Google/Chrome/Application/chrome.exe',
		'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/usr/bin/google-chrome',
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser',
	];
	const found = candidates.find((p) => existsSync(p));
	if (!found) {
		fail(
			'no Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.\n' +
				'  This check deliberately does not skip when it cannot run: a contrast\n' +
				'  gate that silently passes is worse than no gate.',
		);
	}
	return found;
}

// ------------------------------------------------------------ static server

const MIME: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.webmanifest': 'application/manifest+json',
	'.woff2': 'font/woff2',
};

/** Serve the built client with an SPA fallback.
 *
 *  Deliberately not `vite preview`: the preview server keeps a handle on the
 *  native `@libsql` binary inside `.output`, and the next `pnpm build` then dies
 *  with an EPERM unlink that reads like a permissions problem rather than a
 *  still-running server. This reads files and holds nothing. */
function serve(dir: string): Promise<{ origin: string; close: () => Promise<void> }> {
	const shell = ['index.html', '_shell.html'].map((f) => join(dir, f)).find((p) => existsSync(p));
	if (!shell) fail(`no index.html or _shell.html in ${dir} — run \`pnpm build\` first`);

	const server = createServer((req, res) => {
		const url = new URL(req.url ?? '/', 'http://localhost');
		const asFile = join(dir, decodeURIComponent(url.pathname));
		const path = existsSync(asFile) && extname(asFile) ? asFile : shell;
		try {
			const body = readFileSync(path);
			res.writeHead(200, {
				'content-type': MIME[extname(path)] ?? 'application/octet-stream',
				'cache-control': 'no-store',
			});
			res.end(body);
		} catch {
			res.writeHead(404).end('not found');
		}
	});
	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => {
			const addr = server.address();
			const port = typeof addr === 'object' && addr ? addr.port : 0;
			resolve({
				origin: `http://127.0.0.1:${port}`,
				close: () => new Promise<void>((done) => server.close(() => done())),
			});
		});
	});
}

// ---------------------------------------------------------------- cdp client

interface Cdp {
	send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
	/** Uncaught exceptions and console errors seen since the last `drain()`. */
	drain: () => string[];
	close: () => void;
}

async function connect(port: number): Promise<Cdp> {
	let pages: { type: string; webSocketDebuggerUrl: string }[] = [];
	for (let i = 0; i < 40 && pages.length === 0; i++) {
		try {
			const r = await fetch(`http://127.0.0.1:${port}/json/list`);
			pages = ((await r.json()) as typeof pages).filter((t) => t.type === 'page');
		} catch {
			await new Promise((r) => setTimeout(r, 400));
		}
	}
	if (!pages.length) fail('Chrome started but exposed no page to drive');

	const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
	await new Promise<void>((resolve, reject) => {
		ws.addEventListener('open', () => resolve());
		ws.addEventListener('error', () => reject(new Error('CDP socket failed')));
	});

	let nextId = 1;
	const pending = new Map<
		number,
		{ resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }
	>();
	// Anything the page threw. Without this the check happily measures a router
	// error boundary and reports "ok" — which it did, on its first run, on a page
	// whose only two text nodes were "Something went wrong!" and "Show Error".
	let problems: string[] = [];

	ws.addEventListener('message', (e) => {
		const msg = JSON.parse(String(e.data)) as {
			id?: number;
			method?: string;
			params?: Record<string, unknown>;
			result?: Record<string, unknown>;
			error?: unknown;
		};

		if (msg.id == null) {
			if (msg.method === 'Runtime.exceptionThrown') {
				const d = (msg.params?.exceptionDetails ?? {}) as {
					text?: string;
					exception?: { description?: string };
				};
				problems.push(d.exception?.description ?? d.text ?? 'uncaught exception');
			}
			if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
				const argv = (msg.params.args ?? []) as { value?: unknown; description?: string }[];
				problems.push(
					argv.map((a) => String(a.description ?? a.value ?? '')).join(' ') || 'console.error',
				);
			}
			return;
		}

		const slot = pending.get(msg.id);
		if (!slot) return;
		pending.delete(msg.id);
		if (msg.error) slot.reject(new Error(JSON.stringify(msg.error)));
		else slot.resolve(msg.result ?? {});
	});

	return {
		send: (method, params = {}) =>
			new Promise((resolve, reject) => {
				const id = nextId++;
				pending.set(id, { resolve, reject });
				ws.send(JSON.stringify({ id, method, params }));
			}),
		drain: () => {
			const seen = problems;
			problems = [];
			return seen;
		},
		close: () => ws.close(),
	};
}

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

const chromePath = findChrome();
const base = args.get('url');
const server = base ? null : await serve(clientOutputDir());
const origin = base ?? server?.origin ?? fail('no origin to test');

const profile = mkdtempSync(join(tmpdir(), 'send-lab-contrast-'));
// A private debug port, not the default 9222: agents and sessions run in
// parallel here, and on the shared port one run attaches to another's browser.
const debugPort = 9200 + Math.floor(Math.random() * 500);
const chrome = spawn(chromePath, [
	`--remote-debugging-port=${debugPort}`,
	'--headless=new',
	'--disable-gpu',
	'--no-first-run',
	'--no-default-browser-check',
	`--user-data-dir=${profile}`,
	`--window-size=${WIDTH},${HEIGHT}`,
	'about:blank',
]);
chrome.on('error', () => fail(`could not start Chrome at ${chromePath}`));

const cleanup = async () => {
	chrome.kill();
	await server?.close();
	try {
		rmSync(profile, { recursive: true, force: true });
	} catch {
		// A locked profile directory is not worth failing the run over.
	}
};

let exitCode = 0;
try {
	const cdp = await connect(debugPort);
	await cdp.send('Page.enable');
	await cdp.send('Runtime.enable');
	await cdp.send('Log.enable');
	await cdp.send('Emulation.setDeviceMetricsOverride', {
		width: WIDTH,
		height: HEIGHT,
		deviceScaleFactor: 2,
		mobile: true,
	});

	const evaluate = async <T>(expression: string): Promise<T> => {
		const r = (await cdp.send('Runtime.evaluate', {
			expression,
			returnByValue: true,
			awaitPromise: true,
		})) as { result?: { value?: T } };
		return r.result?.value as T;
	};
	const goto = async (url: string) => {
		await cdp.send('Page.navigate', { url });
		await new Promise((r) => setTimeout(r, 1200));
	};

	const failures: (Row & { screen: string })[] = [];
	const exempt: (Row & { screen: string })[] = [];
	let measured = 0;

	for (const locale of LOCALES) {
		await goto(`${origin}/`);
		await evaluate(
			`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, ${JSON.stringify(locale)})`,
		);
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

			// A crashed app is not a passing contrast run. The router's error
			// boundary renders two short, high-contrast strings, so without this the
			// check reports a clean sweep over a screen that never rendered.
			const thrown = cdp.drain();
			if (thrown.length) {
				fail(
					`${screen}: the page threw before it could be measured —\n    ${thrown.slice(0, 3).join('\n    ')}\n` +
						'  Contrast cannot be measured on a screen that did not render.',
				);
			}
			if (rows.length < MIN_ELEMENTS) {
				fail(
					`${screen}: only ${rows.length} text element(s) rendered, expected at least ${MIN_ELEMENTS}. ` +
						'That is an empty or errored screen, not a well-contrasted one. ' +
						'Override with --min-elements=N if the route really is this sparse.',
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

	cdp.close();
} finally {
	await cleanup();
}

process.exit(exitCode);
