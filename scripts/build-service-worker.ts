// Build the service worker after `vite build`: bundle the source, then inject the
// precache manifest into it.
//
// It was `generateSW` until #76 — an options object in, a worker out, emitted
// from a template with nowhere to put a listener the template has no option for.
// The worker is now `src/sw.ts`, a file with the decisions written in it, and
// this script's job shrank to the two mechanical steps that file cannot do for
// itself.
//
// **Bundle first, inject second.** `injectManifest` is a text replacement and
// explicitly "will not compile or bundle your `swSrc` file", so the ESM source
// and its three `workbox-*` imports have to become one classic script before it
// runs. Vite does that here rather than a second bundler being introduced for it,
// and the intermediate lands outside the client directory so the glob below can
// never pick it up.
//
// Neither host gives the service-worker author an asset manifest, so the glue is
// hand-rolled either way; ADR 0005 budgeted ~40 lines of `workbox-build` for it.
//
// Staleness is decided in `src/sw.ts` now, not here: this script only stamps the
// content revisions workbox uses to invalidate a changed file.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { injectManifest } from 'workbox-build';
import { clientOutputDir } from './output-dir.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const clientDir = clientOutputDir();

// Not under `clientDir`: anything in there is a candidate for the precache glob,
// and a worker that precaches an unbundled copy of itself is the kind of thing
// that only shows up on a device that has gone offline.
const stagingDir = join(root, 'node_modules', '.cache', 'send-lab-sw');

// `configFile: false` on purpose. The app's Vite config carries Tailwind,
// Paraglide, TanStack Start and Nitro — none of which a service worker has any
// business loading, and Nitro in particular would try to build a server here.
await build({
	configFile: false,
	logLevel: 'warn',
	// The worker is a classic script (`register('/sw.js')` with no `type`), so the
	// bundle is an IIFE with everything inlined — no `importScripts`, no second
	// file to keep in step with it.
	build: {
		outDir: stagingDir,
		emptyOutDir: true,
		minify: 'esbuild' as const,
		sourcemap: false,
		lib: {
			entry: join(root, 'src', 'sw.ts'),
			formats: ['iife'],
			name: 'sw',
			fileName: () => 'sw.js',
		},
	},
	// Whitespace and syntax, but **not identifiers**. Two reasons, and the first is
	// not an aesthetic one: `pnpm check:sw` reads the built worker and asserts it
	// calls `precacheAndRoute` with a literal, non-empty manifest — the gate that
	// exists because a worker precaching nothing looks identical to a working one
	// until the device goes offline. Mangling the name renames the call and the
	// gate stops being able to see it. The second is that it keeps the artefact
	// legible, which is what this ticket was for. Comments and whitespace still go,
	// so the worker weighs what the generated pair of files did.
	esbuild: { minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false },
	// workbox's modules branch on this for their development logging. Set
	// explicitly rather than left to Vite's default, because the value decides how
	// noisy the athlete's console is and it should not depend on how this script
	// was invoked.
	define: { 'process.env.NODE_ENV': '"production"' },
});

const staged = join(stagingDir, 'sw.js');

const { count, size, warnings } = await injectManifest({
	swSrc: staged,
	swDest: join(clientDir, 'sw.js'),
	globDirectory: clientDir,
	globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
});

for (const w of warnings) console.warn(`build:sw — ${w}`);
console.log(`build:sw — precached ${count} file(s), ${(size / 1024).toFixed(1)} kB`);
