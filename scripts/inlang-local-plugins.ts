// Serves inlang's CDN-hosted plugins from the local, lockfile-pinned npm packages.
//
// `project.inlang/settings.json` declares its plugins as `cdn.jsdelivr.net` URLs,
// and the inlang SDK resolves every entry in `modules` by calling `fetch(uri)` and
// importing the response body as a base64 `data:` URL. There is no local-path form
// to switch to: Node's `fetch` cannot read `file:` URLs, so an HTTPS URL is the
// only shape the SDK accepts. That makes message compilation depend on reaching a
// CDN at build time — see issue #9.
//
// Two things make that dependency worse than a plain network dependency:
//
//   * `fetchPlugin` never checks `response.ok`, so any proxy or captive portal that
//     answers 200 with an explanatory body has that body imported *as the plugin*.
//     A blocked host here produced `SyntaxError: Unexpected identifier 'not'` —
//     the "Host not in allowlist" message being parsed as JavaScript.
//   * the SDK's plugin cache is network-first and writes whatever `fetch` returned,
//     so that error text gets persisted to `project.inlang/cache/plugins/` and
//     replayed on later runs. Pre-seeding the cache can't fix it, because a fetch
//     that "succeeds" always overwrites the cached copy.
//
// So this shim intercepts at the `fetch` layer instead. Each CDN plugin URL is
// mapped to the matching file in `node_modules`, which pnpm pins in the lockfile,
// and served from disk. Everything else falls through to the real `fetch`.
//
// Intercepting rather than rewriting `settings.json` is deliberate: the URLs stay
// the canonical record of which plugin and major version this project expects, so
// external inlang tooling (the IDE extension, the web editor) keeps working, and
// the version actually served is asserted against that URL below rather than
// drifting silently.
import { readFileSync } from 'node:fs';

/** `https://cdn.jsdelivr.net/npm/<pkg>@<major>/<subpath>` */
const CDN_PLUGIN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/(@[^/]+\/[^@/]+|[^@/]+)@(\d+)\/(.+)$/;

const INSTALLED = Symbol.for('send-lab.inlang-local-plugins');

type Settings = { modules?: string[] };

function localFileFor(url: string): string {
	const match = CDN_PLUGIN.exec(url);
	if (!match) {
		throw new Error(
			`Cannot serve inlang plugin locally — unrecognized module URL:\n  ${url}\n` +
				`Expected https://cdn.jsdelivr.net/npm/<pkg>@<major>/<subpath>. Add the\n` +
				`package to devDependencies and teach scripts/inlang-local-plugins.ts the\n` +
				`new URL shape.`,
		);
	}
	const [, pkg, wantedMajor, subpath] = match;

	// Read package.json by path rather than resolving it: these packages restrict
	// their `exports`, so `require.resolve('<pkg>/package.json')` throws.
	const pkgRoot = `node_modules/${pkg}`;
	let installedVersion: string;
	try {
		installedVersion = JSON.parse(readFileSync(`${pkgRoot}/package.json`, 'utf8')).version;
	} catch {
		throw new Error(
			`inlang plugin "${pkg}" is declared in project.inlang/settings.json but is\n` +
				`not installed. Run: pnpm add -D ${pkg}@${wantedMajor}`,
		);
	}

	// The URL pins a major; the lockfile pins the exact version. If they disagree,
	// the build would silently compile against a different plugin than declared.
	const installedMajor = installedVersion.split('.')[0];
	if (installedMajor !== wantedMajor) {
		throw new Error(
			`inlang plugin "${pkg}" version mismatch:\n` +
				`  settings.json asks for major ${wantedMajor} (${url})\n` +
				`  node_modules has ${installedVersion}\n` +
				`Install a matching major, or update the URL in settings.json.`,
		);
	}

	const file = `${pkgRoot}/${subpath}`;
	// Fail here rather than serving an empty body the SDK would import as a plugin.
	readFileSync(file);
	return file;
}

/**
 * Redirects the inlang plugin URLs in `settings.json` to local files, so message
 * compilation needs no network access. Idempotent, and safe to call from both the
 * compile script and `vite.config.ts` — only the first call patches `fetch`.
 */
export function serveInlangPluginsLocally(settingsPath = 'project.inlang/settings.json'): string[] {
	const settings: Settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
	const urls = (settings.modules ?? []).filter((m) => m.startsWith('http'));

	const served = new Map<string, string>();
	for (const url of urls) served.set(url, localFileFor(url));

	const global = globalThis as typeof globalThis & { [INSTALLED]?: true };
	if (served.size > 0 && !global[INSTALLED]) {
		const realFetch = globalThis.fetch;
		globalThis.fetch = (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.href
						: (input as Request).url;
			const file = served.get(url);
			if (file === undefined) return realFetch(input, init);
			return Promise.resolve(
				new Response(readFileSync(file, 'utf8'), {
					status: 200,
					headers: { 'content-type': 'text/javascript' },
				}),
			);
		};
		global[INSTALLED] = true;
	}

	return [...served.values()];
}
