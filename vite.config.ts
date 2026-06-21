import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

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
