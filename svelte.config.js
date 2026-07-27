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
		// `trustedOrigins: ['*']` is how the built-in check is turned off since
		// SvelteKit 2.69 — the spelling `checkOrigin: false` is deprecated, and the
		// two are documented as equivalent. Trusting every origin here is safe only
		// because csrf.ts re-applies the same rule to every non-exempt route.
		csrf: { trustedOrigins: ['*'] },
	},
};

export default config;
