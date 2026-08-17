import { fileURLToPath } from 'node:url';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';
import { serveInlangPluginsLocally } from './scripts/inlang-local-plugins.ts';
import { PARAGLIDE_STRATEGY } from './scripts/paraglide-strategy.ts';

// `paraglideVitePlugin` fetches the inlang plugins from a CDN on every dev/build
// compile. Serve them from `node_modules` instead, so `pnpm dev` and `pnpm build`
// need no network access and can't emit a stringless bundle when a host is blocked
// (issue #9). Must run before the plugin below — it patches `fetch` for this
// process. `pnpm paraglide` installs the same shim for the CLI path.
serveInlangPluginsLocally();

export default defineConfig({
	resolve: {
		// Vite does not read tsconfig `paths`, so the alias the domain modules were
		// written against has to be declared here as well. Kept identical in
		// `vitest.config.ts`, which cannot load this file (the Start plugin has no
		// place in a jsdom test run).
		alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) },
	},
	plugins: [
		tailwindcss(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// Shared with `scripts/compile-messages.ts`, which compiles the same
			// output inside `pnpm check`. Both compilers must agree or whichever ran
			// last decides how the athlete's locale is resolved.
			strategy: [...PARAGLIDE_STRATEGY],
		}),
		tanstackStart({
			// ADR 0006: one `ssr: false` seam, at the root. The app tree never
			// prerenders; the build emits a root-only, user-independent shell at a
			// stable path, and that artefact is what the service worker precaches so
			// an installed app cold-starts without the network.
			spa: {
				enabled: true,
				prerender: { outputPath: '/_shell.html' },
			},
		}),
		// The server half of the build. Nitro detects Vercel from the build
		// environment and emits Build Output API v3 into `.vercel/output`, which is
		// what Vercel actually serves — a plain `dist/` deploys but 404s, which is
		// how this was found. Nitro's only npm dist-tag is a beta; ADR 0005 accepted
		// that knowingly, on the grounds that a Nitro failure is a *deploy-time*
		// failure — loud, immediate and reversible. Pinned exactly, like everything
		// else in the rebuild.
		nitro(),
		react(),
	],
});
