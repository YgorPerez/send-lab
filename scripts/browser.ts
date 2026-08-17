// The browser harness the measuring checks share.
//
// `check:contrast` and `check:motion` both need the same four things: a Chrome
// binary, a static server over the built client, a CDP socket, and the project's
// own route and locale lists. Extracted here when the second one arrived — a
// second copy of this would be a second place for the `vite preview` trap and
// the shared-debug-port trap to be re-learned.
//
// NOT IN `pnpm verify`. Both callers run against a *built* app in a real browser,
// and `verify` stays jsdom-only and browserless on purpose: a gate that needs
// Chrome and a completed build is a gate that gets skipped on the machine that
// most needs it.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientOutputDir } from './output-dir.ts';

export const root = fileURLToPath(new URL('..', import.meta.url));

/** Where Paraglide persists the athlete's choice. Matches the `localStorage`
 *  strategy declared in `scripts/paraglide-strategy.ts`. */
export const LOCALE_KEY = 'PARAGLIDE_LOCALE';

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

let toolName = 'check';

export function fail(message: string): never {
	console.error(`${toolName} — ${message}`);
	process.exit(1);
}

// ------------------------------------------------------------------ project

/** The routes to visit, derived from the file-based route tree rather than
 *  listed here — a page added without a line in a script would otherwise be a
 *  page nobody ever measures. */
export function discoverRoutes(): string[] {
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
	/** Serve this origin instead of the built output (`--url=…`). */
	url?: string;
	/** Milliseconds to wait after a navigation before reading the page. */
	settleMs?: number;
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
	const width = options.width ?? 360;
	const height = options.height ?? 800;
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

	const close = async () => {
		chrome.kill();
		await server?.close();
		try {
			rmSync(profile, { recursive: true, force: true });
		} catch {
			// A locked profile directory is not worth failing the run over.
		}
	};

	try {
		const cdp = await connect(debugPort);
		await cdp.send('Page.enable');
		await cdp.send('Runtime.enable');
		await cdp.send('Log.enable');
		await cdp.send('Emulation.setDeviceMetricsOverride', {
			width,
			height,
			deviceScaleFactor: 2,
			mobile: true,
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

		return {
			cdp,
			origin,
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
