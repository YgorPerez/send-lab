import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Pure client-side app (localStorage persistence) — prerender to a static site.
		// `200.html` SPA fallback keeps the prerendered index.html intact while
		// still serving deep links on static hosts that support it.
		adapter: adapter({
			fallback: '200.html',
		}),
	},
};

export default config;
