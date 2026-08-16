import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { useEffect } from 'react';
import appCss from '../app.css?url';
import { installViewTransitionGuards } from '../lib/viewTransition';

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			// `viewport-fit=cover` is harmless here — every safe-area inset measured
			// 0px on the athlete's device (#54) — but it costs nothing and keeps an
			// iPhone from letterboxing. iOS is best-effort, not ignored.
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1, viewport-fit=cover',
			},
			{ name: 'theme-color', content: '#0c0d10' },
			{ title: 'Send Lab' },
		],
		links: [
			{ rel: 'stylesheet', href: appCss },
			{ rel: 'manifest', href: '/manifest.webmanifest' },
			{ rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
			{ rel: 'apple-touch-icon', href: '/icon-180.png' },
		],
	}),
	shellComponent: RootDocument,
	component: RootComponent,
	pendingComponent: RootPending,
});

/**
 * The app shell.
 *
 * ADR 0006: this is the one `ssr: false` seam, and the build prerenders exactly
 * this into `/_shell.html` — root route only. It **must stay user-independent**:
 * the service worker precaches it so an installed app cold-starts without the
 * network, and anything account-specific in here either leaks between accounts
 * or forces a network round-trip at the precise moment the app should feel
 * instant. Read nothing here that depends on who is signed in.
 */
function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

function RootComponent() {
	// Guards that `defaultViewTransition: true` requires — the UA-transition
	// check, the skipped-transition rejection handler, and the assertion that
	// nothing set `scrollRestoration = 'manual'`.
	useEffect(() => installViewTransitionGuards(), []);

	// Registering the worker is what makes the app installable as a WebAPK, and
	// what serves `/_shell.html` on a cold start with no network. The update
	// flow, the install prompt and the offline write queue are #27's and #24's;
	// this is registration only.
	useEffect(() => {
		if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
		void navigator.serviceWorker.register('/sw.js');
	}, []);

	return <Outlet />;
}

/** Shown while the client-only tree resolves. Deliberately content-free: it is
 *  part of the user-independent shell. */
function RootPending() {
	return <div className="min-h-dvh bg-background" />;
}
