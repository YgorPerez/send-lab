import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Node server: serves the client-rendered SPA plus the better-auth and
		// app-data API routes / server hooks that back the login system.
		adapter: adapter(),
	},
};

export default config;
