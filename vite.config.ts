import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { useLocalInlangPlugins } from './scripts/inlang-local-plugins';

// `paraglideVitePlugin` fetches the inlang plugins from a CDN on every dev/build
// compile. Serve them from `node_modules` instead, so `pnpm dev` and `pnpm build`
// need no network access and can't emit a stringless bundle when a host is blocked
// (issue #9). Must run before the plugin below — it patches `fetch` for this
// process. `pnpm paraglide` installs the same shim for the CLI path.
useLocalInlangPlugins();

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// Pure client-side SPA: persist the user's choice, fall back to the
			// browser language, then the base locale. No URL/cookie/server strategy.
			strategy: ['localStorage', 'preferredLanguage', 'baseLocale'],
		}),
	],
});
