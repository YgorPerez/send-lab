import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function getRouter() {
	return createTanStackRouter({
		routeTree,
		// Every navigation animates. The router cannot animate Back per-link
		// (PR #7697) and Back is a system gesture on a phone, so the choice was
		// animate-everything or a hard cut — see `src/lib/viewTransition.ts` for
		// the guards this turns on.
		defaultViewTransition: true,
		// The router's own scroll restoration. Note it never sets
		// `history.scrollRestoration = 'manual'`, which regresses swipe-back
		// (router #7956).
		scrollRestoration: true,
		defaultPreload: 'intent',
	});
}

declare module '@tanstack/react-router' {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
