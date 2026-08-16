import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Vitest replaces `node:test` (issue #20), driven by the offline-first
// assertions (#24) rather than preference: three of them need `localStorage`, a
// DOM, and the ability to fake being offline, all of which are hand-rolled under
// `node:test`. Vitest is also a Vite runner, so module resolution matches the
// app's rather than needing a parallel setup — Paraglide's generated output is
// plain files on disk and resolves without the plugin.
//
// #20 also specified a **second, browser-mode suite**, because jsdom has no
// service worker and so a jsdom-only suite can never prove the app works
// offline — the headline feature of this rebuild. That suite is NOT wired here.
// Its specs are #24's five assertions (register the worker, go offline, tick a
// task, reload for real, reconnect, assert it reached the server), none of which
// exist yet, and standing up the Playwright provider to run an empty directory
// would be a green check that proves nothing. It lands with #24 / #27.
export default defineConfig({
	// Mirrors `vite.config.ts`. This file cannot load the app config directly —
	// the TanStack Start plugin has no place in a jsdom run — so the one alias the
	// domain modules rely on is declared in both. Keep them in step.
	resolve: {
		alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) },
	},
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					environment: 'jsdom',
					include: ['tests/**/*.test.ts'],
					exclude: ['tests/browser/**'],
				},
			},
		],
	},
});
