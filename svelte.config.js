import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Vercel serverless (Node runtime): serves the client-rendered SPA plus the
		// better-auth and app-data API routes. State lives in Turso (libSQL).
		adapter: adapter({ runtime: 'nodejs20.x' }),
	},
};

export default config;
