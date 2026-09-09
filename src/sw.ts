// The service worker, as a file someone can read.
//
// It was `workbox-build`'s `generateSW` until #76 — a worker emitted from a
// fixed template, configured through an options object, with nowhere to put a
// listener the template does not have an option for. That is the wall
// notifications run into: a `push` handler has to live *in* the worker, and
// #27's update strategy is heading for the same place. `generateSW`'s
// `importScripts` escape hatch would have worked; the source file won because a
// worker you can read beats one you configure.
//
// **This file adds no behaviour.** It is exactly what `generateSW` was emitting,
// written out: the same precache set, the same navigation fallback, the same API
// denylist, the same cleanup, `clientsClaim` and no `skipWaiting`. The point of
// keeping it identical is that the diff which later adds a push handler is small
// enough to review.
//
// THE UPDATE STRATEGY IS NOT MINE TO IMPROVE
// ------------------------------------------
// `clientsClaim()` with no `self.skipWaiting()` beside it is deliberate and
// belongs to #27, which is still open: a new worker takes over the page but a
// *waiting* one does not activate until the athlete asks. The message listener
// below is the only thing that ever activates it, and `components/UpdateAnnouncement.tsx`
// is what sends the message. `pnpm check:sw` fails the build if the string on
// either side goes missing — until this file existed, that string was workbox's
// to name and nothing in `src/` defined it. Now this does.
import { clientsClaim } from 'workbox-core';
import {
	cleanupOutdatedCaches,
	createHandlerBoundToURL,
	precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

/**
 * This file's `self`, which the DOM's is not.
 *
 * A module-scoped declaration, so it shadows the ambient global here and reaches
 * nothing else — `tsconfig.sw.json` is the only program this file belongs to, for
 * the same reason: a worker needs `WebWorker` where the app needs `DOM`, and one
 * program cannot hold both.
 *
 * `__WB_MANIFEST` is where `scripts/build-service-worker.ts` injects the precache
 * manifest. It is spelled on `self` rather than cast at the call site because the
 * injection is a **text** replacement of exactly `self.__WB_MANIFEST` in the
 * bundled output, and a cast is a thing a bundler may rewrite around.
 */
declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

// Registered before anything else, exactly as the generated worker had it: this
// is the update prompt's other half, and a worker that installs and then throws
// on the next line should still be able to hear the athlete ask for the update.
self.addEventListener('message', (event) => {
	if (event.data && (event.data as { type?: string }).type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// Caches from an older workbox precache revisioning scheme. Deliberately *not* a
// timestamped cache name: that would invalidate everything on every redeploy,
// including the builds where nothing changed, which is the opposite of what an
// installed app on a phone wants.
cleanupOutdatedCaches();

// ADR 0006: `/_shell.html` is the root-only, user-independent artefact the
// client-only tree cold-starts from. Serving it for every navigation is what
// makes an installed app open without the network — and the API is never served
// from the cache, because an authenticated read must not be answered with
// another account's response and a queued write is #24's job.
registerRoute(
	new NavigationRoute(createHandlerBoundToURL('/_shell.html'), { denylist: [/^\/api\//] }),
);
