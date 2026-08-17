// Generate the service worker after `vite build`.
//
// This is a *placeholder worker with real precaching*, not the designed one —
// the PWA shell ticket (#27) owns install prompts, update flow, notifications
// and the offline write queue. It exists now because ADR 0005 makes a broken
// worker a build failure, and a check that can never fail is not a check.
//
// Neither host gives the service-worker author an asset manifest, so the glue is
// hand-rolled either way; ADR 0005 budgeted ~40 lines of `workbox-build` for it.
//
// Staleness: workbox stamps a content revision onto every precached URL, so a
// changed file invalidates itself. There is deliberately no timestamped cache
// name — that would invalidate the whole cache on every redeploy, including the
// builds where nothing changed, which is the opposite of what an installed app
// on a phone wants.
import { generateSW } from 'workbox-build';
import { clientOutputDir } from './output-dir.ts';

const clientDir = clientOutputDir();

const { count, size, warnings } = await generateSW({
	globDirectory: clientDir,
	swDest: `${clientDir}/sw.js`,
	globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
	// ADR 0006: `/_shell.html` is the root-only, user-independent artefact the
	// client-only tree cold-starts from. Serving it for every navigation is what
	// makes an installed app open without the network.
	navigateFallback: '/_shell.html',
	// The API is never served from the cache — an authenticated read must not be
	// answered with another account's response, and a queued write is #24's job.
	navigateFallbackDenylist: [/^\/api\//],
	runtimeCaching: [],
	cleanupOutdatedCaches: true,
	clientsClaim: true,
	// A new worker activates immediately instead of waiting for every window of
	// this origin to close.
	//
	// `false` is the safer default, and it is why this was set that way: swapping
	// assets under a running page can 404 a lazily-loaded chunk from the build
	// that page started on. But on a phone an installed app is backgrounded, not
	// closed, so "wait until every client goes away" means "never" — and the
	// athlete judged this prototype on a build three pushes old, seeing none of
	// the fixes that had been deployed for them. A prototype that cannot reach
	// the person judging it is worth less than a rare chunk miss.
	//
	// A prototype-phase choice, not the update strategy. #27 owns that, and the
	// answer there is a prompt — "a new version is ready, reload" — which updates
	// deliberately rather than at either extreme.
	skipWaiting: true,
	sourcemap: false,
});

for (const w of warnings) console.warn(`build:sw — ${w}`);
console.log(`build:sw — precached ${count} file(s), ${(size / 1024).toFixed(1)} kB`);
