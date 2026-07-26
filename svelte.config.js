import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Vercel serverless (Node runtime): serves the client-rendered SPA plus the
		// better-auth and app-data API routes. State lives in Turso (libSQL).
		adapter: adapter({ runtime: 'nodejs20.x' }),
		// Replaced by the equivalent guard in src/lib/server/csrf.ts, which this app
		// needs because the built-in check cannot exempt a route and so blocks the
		// form-encoded, Origin-less POST that the OAuth token endpoint must accept.
		csrf: { checkOrigin: false },
	},
};

export default config;
