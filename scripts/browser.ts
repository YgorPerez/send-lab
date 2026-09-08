// The browser harness the measuring checks share.
//
// `check:contrast` and `check:motion` both need the same four things: a Chrome
// binary, a static server over the built client, a CDP socket, and the project's
// own route and locale lists. Extracted here when the second one arrived — a
// second copy of this would be a second place for the `vite preview` trap and
// the shared-debug-port trap to be re-learned.
//
// #73 added a fifth thing, and put it here for the same reason: **what state the
// page boots with**. The clock the app resolves today's slot from, and the
// training record it reads, are now part of the session rather than of each
// check — so the three of them measure one account on one instant, name which
// pass they are reporting, and none of them grows its own copy of the
// installation. `scripts/seeded-record.ts` is that state; this is the seam it
// arrives through.
//
// NOT IN `pnpm verify`. Both callers run against a *built* app in a real browser,
// and `verify` stays jsdom-only and browserless on purpose: a gate that needs
// Chrome and a completed build is a gate that gets skipped on the machine that
// most needs it.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientOutputDir } from './output-dir.ts';
import { LOCALE_KEY } from './paraglide-strategy.ts';
import { discoverRoutesIn } from './routes.ts';
import { BOOT_CHECK, type BootReport, type BootState, bootScript } from './seeded-record.ts';

export const root = fileURLToPath(new URL('..', import.meta.url));

// ---------------------------------------------------------------- arguments

/** `--width=320 --verbose` → `{ width: '320', verbose: '' }`. */
export function parseArgs(argv: string[] = process.argv.slice(2)): Map<string, string> {
	const out = new Map<string, string>();
	for (const a of argv) {
		const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
		if (m) out.set(m[1], m[2] ?? '');
	}
	return out;
}

/**
 * The viewport half of every check's arguments, in one place.
 *
 * `--desktop` picks a pointer-and-keyboard machine; `--width` / `--height`
 * override either default. It is one function rather than four lines repeated in
 * each check because the *pairing* is the thing that has to stay true: a desktop
 * session at a 360px viewport, or a 1280px viewport reporting `hover: none`, are
 * both combinations no device has, and both read as working measurements.
 */
export function viewport(args: Map<string, string>): {
	width: number;
	height: number;
	desktop: boolean;
} {
	const desktop = args.has('desktop');
	return {
		desktop,
		width: Number(args.get('width') ?? (desktop ? 1280 : 360)),
		height: Number(args.get('height') ?? (desktop ? 900 : 800)),
	};
}

let toolName = 'check';

/**
 * Teardown for every session still open, run on the way out.
 *
 * `fail` exits the process, which skips every `finally` above it — so a failing
 * run used to leave a headless Chrome holding its profile directory, and the
 * comment on `open()` about a leaked browser being talked to by the next run
 * described a leak this file was itself producing. It mattered more once #73
 * made a single `check:motion` run open four sessions rather than two.
 *
 * Sync work only: `process.on('exit')` cannot await anything. Killing Chrome and
 * dropping its profile are both synchronous, and the static server is a socket
 * this process owns, which dies with it.
 */
const openSessions = new Set<() => void>();
process.on('exit', () => {
	for (const teardown of openSessions) {
		try {
			teardown();
		} catch {
			// Already gone. Nothing to report on the way out.
		}
	}
});

export function fail(message: string): never {
	console.error(`${toolName} — ${message}`);
	process.exit(1);
}

// ------------------------------------------------------------------ project

/** The routes to visit, derived from the route tree rather than listed here.
 *  `scripts/routes.ts` carries the whole of why, including the #86 failure that
 *  made it read the generated tree instead of guessing at filenames. This is only
 *  the seam where a throw becomes the `fail` the checks share. */
export function discoverRoutes(): string[] {
	try {
		return discoverRoutesIn(root);
	} catch (e) {
		return fail(e instanceof Error ? e.message : String(e));
	}
}

/** The locales the project ships, from the inlang settings. */
export function discoverLocales(): string[] {
	try {
		const settings = JSON.parse(
			readFileSync(join(root, 'project.inlang', 'settings.json'), 'utf8'),
		) as { locales?: string[] };
		return settings.locales?.length ? settings.locales : ['en-US'];
	} catch {
		return ['en-US'];
	}
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
				'  This check deliberately does not skip when it cannot run: a gate that\n' +
				'  silently passes is worse than no gate.',
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

export interface Cdp {
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
	// Anything the page threw. Without this a check happily measures a router
	// error boundary and reports "ok" — which the contrast check did, on its first
	// run, on a page whose only two text nodes were "Something went wrong!" and
	// "Show Error".
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

// -------------------------------------------------------------- the session

export interface Session {
	cdp: Cdp;
	origin: string;
	/** The pass this session is measuring, for the check to name in its output.
	 *  `unpinned` when the caller asked for no boot state at all. */
	pass: string;
	/**
	 * The arrival control (#73, story 18): assert the current page is in the state
	 * this session asked for, or fail naming `where`.
	 *
	 * A harness that silently failed to install the record renders exactly the
	 * empty app, and an empty app is a clean contrast run, a quiet console and a
	 * screen with nothing on it to animate. So the record is not assumed to have
	 * landed, it is asked about after each page has loaded — and it lives here
	 * rather than in each check, because three copies of a control is three places
	 * for one of them to stop being a control.
	 *
	 * `scripts/seeded-record.ts` carries what it actually asks and what each part
	 * of it can catch.
	 */
	assertBooted: (where: string) => Promise<BootReport>;
	/** Evaluate an expression in the page and bring the value back. */
	evaluate: <T>(expression: string) => Promise<T>;
	/** Navigate, then wait long enough for the client-only tree to render. */
	goto: (url: string) => Promise<void>;
	/** Set the athlete's locale the way the app itself persists it, then reload. */
	setLocale: (locale: string) => Promise<void>;
	close: () => Promise<void>;
}

export interface OpenOptions {
	/** Prefixes every message. Use the npm script's name. */
	tool: string;
	width?: number;
	height?: number;
	/**
	 * What `prefers-reduced-motion` should report.
	 *
	 * Always set explicitly, never left to the browser. **Headless Chrome
	 * defaults to `reduce`** — which meant the motion check's control run came
	 * back already reduced and could not tell its two passes apart. Left unset,
	 * every measurement here would silently be a reduced-motion measurement on
	 * one machine and a full-motion one on another.
	 */
	reducedMotion?: boolean;
	/**
	 * Emulate a pointer-and-keyboard machine rather than a phone (`--desktop`).
	 *
	 * Added for #52, which gave the app a second layout. Width alone does not
	 * reach it: `mobile: true` keeps the mobile device metrics whatever the number
	 * is, and — the part that actually matters — `hover:` utilities live inside
	 * `@media (hover: hover)`, which Chrome reports as `none` under mobile
	 * emulation. So a desktop run at `--width=1280` without this measures the wide
	 * layout with every hover state switched off, which is not what a laptop gets.
	 *
	 * Emulated at the browser, like `prefers-reduced-motion` above and for the same
	 * reason: a stylesheet cannot be tricked into matching a media query from
	 * inside the page.
	 */
	desktop?: boolean;
	/** Serve this origin instead of the built output (`--url=…`). */
	url?: string;
	/** Milliseconds to wait after a navigation before reading the page. */
	settleMs?: number;
	/**
	 * What the page boots holding: the clock's starting instant, and the training
	 * record installed before the app's own script runs (#73).
	 *
	 * Left out, a session boots the way it did before #73 — an empty store on the
	 * machine's own clock — which is a *third* thing rather than either pass, so
	 * every check that measures passes should say which one it is asking for
	 * (`EMPTY_BOOT` is the named empty account, on the pinned clock).
	 */
	boot?: BootState;
}

/**
 * Start Chrome over the built client and return a driven page.
 *
 * Always `await session.close()` in a `finally` — a leaked headless Chrome holds
 * its profile directory and the next run picks a different debug port and
 * happily talks to the corpse.
 */
export async function open(options: OpenOptions): Promise<Session> {
	toolName = options.tool;
	// Defaulted from `desktop` rather than fixed at the phone, so a caller that
	// bypasses `viewport()` above still cannot get desktop media at a 360px
	// viewport.
	const width = options.width ?? (options.desktop ? 1280 : 360);
	const height = options.height ?? (options.desktop ? 900 : 800);
	const settleMs = options.settleMs ?? 1200;

	const chromePath = findChrome();
	const server = options.url ? null : await serve(clientOutputDir());
	const origin = options.url ?? server?.origin ?? fail('no origin to test');

	const profile = mkdtempSync(join(tmpdir(), `send-lab-${options.tool.replace(/\W+/g, '-')}-`));
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
		`--window-size=${width},${height}`,
		'about:blank',
	]);
	chrome.on('error', () => fail(`could not start Chrome at ${chromePath}`));

	const teardown = () => {
		// `chrome.kill()` kills the process this spawned, and Chrome is not one
		// process: a headless browser is a parent plus a renderer, a GPU process and
		// a utility process, and on Windows those are not in the parent's job by
		// default. So killing the handle left three live processes per session
		// holding the profile directory — which is why `rmSync` below needed its
		// `catch`, and why the warning on `open()` about the next run talking to a
		// corpse was describing a leak this file produced itself. Measured: nine
		// orphans after ten runs, before #73 tripled the sessions per run.
		if (chrome.pid != null && process.platform === 'win32') {
			spawnSync('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore' });
		} else {
			chrome.kill();
		}
		try {
			rmSync(profile, { recursive: true, force: true });
		} catch {
			// A locked profile directory is not worth failing the run over.
		}
	};
	openSessions.add(teardown);

	const close = async () => {
		openSessions.delete(teardown);
		teardown();
		await server?.close();
	};

	try {
		const cdp = await connect(debugPort);
		await cdp.send('Page.enable');
		await cdp.send('Runtime.enable');
		await cdp.send('Log.enable');
		await cdp.send('Emulation.setDeviceMetricsOverride', {
			width,
			height,
			deviceScaleFactor: options.desktop ? 1 : 2,
			mobile: !options.desktop,
		});
		// The media feature, emulated at the browser rather than faked in the page:
		// a stylesheet cannot be tricked into matching a media query, and this is the
		// only way to observe what the athlete's device actually gets.
		//
		// Set on every session, including the full-motion one. Headless Chrome
		// reports `reduce` by default, so leaving it unset does not mean "the
		// browser's default" — it means "reduced", quietly, on every measurement.
		await cdp.send('Emulation.setEmulatedMedia', {
			features: [
				{
					name: 'prefers-reduced-motion',
					value: options.reducedMotion ? 'reduce' : 'no-preference',
				},
				// Set on both runs rather than only the desktop one, so a phone
				// measurement asserts `hover: none` instead of inheriting whatever the
				// headless default happens to be — the same trap the note above records
				// for `prefers-reduced-motion`, which defaults to `reduce` here.
				{ name: 'hover', value: options.desktop ? 'hover' : 'none' },
				{ name: 'any-hover', value: options.desktop ? 'hover' : 'none' },
				{ name: 'pointer', value: options.desktop ? 'fine' : 'coarse' },
				{ name: 'any-pointer', value: options.desktop ? 'fine' : 'coarse' },
			],
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
			await new Promise((r) => setTimeout(r, settleMs));
		};

		// The boot state, installed as a script that runs before the page's own on
		// every navigation. Registered here rather than evaluated after a load
		// because the app reads the store on its first render: a record written
		// afterwards would leave every measurement one frame late, and the frame it
		// missed is the empty one.
		if (options.boot) {
			await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
				source: bootScript(options.boot),
			});
		}

		// `unpinned` is neither pass: it is a caller that asked for no boot state,
		// and therefore for the machine's own clock and whatever storage holds.
		const pass = options.boot?.pass ?? 'unpinned';

		return {
			cdp,
			origin,
			pass,
			assertBooted: async (where: string) => {
				const report = await evaluate<BootReport | null>(BOOT_CHECK);
				if (!report || !report.ok) {
					fail(
						`${where}: the page is not in the state this pass asked for — ` +
							`${report?.why ?? 'the control itself returned nothing'}.\n` +
							'  Nothing measured here is comparable to anything: the page would have\n' +
							'  booted on the machine clock, or read a record from another namespace.',
					);
				}
				if (options.boot?.cells && report.installed === 0) {
					fail(
						`${where}: the '${pass}' pass installed no rows, so this is the\n` +
							'  empty app being measured and reported as the seeded one.',
					);
				}
				return report;
			},
			evaluate,
			goto,
			setLocale: async (locale: string) => {
				await goto(`${origin}/`);
				await evaluate(
					`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, ${JSON.stringify(locale)})`,
				);
			},
			close: async () => {
				cdp.close();
				await close();
			},
		};
	} catch (e) {
		await close();
		throw e;
	}
}
