import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import appCss from '../app.css?url';
import { AppShell } from '../components/AppShell';
import { authClient } from '../lib/auth-client';
import { useResolvedLocale } from '../lib/store/locale';
import { setActiveAccount } from '../lib/store/record';
import { useDeviceTimeZone } from '../lib/store/timeZone';
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
			// Matches `--bg` in `app.css`. The two have to move together: this is
			// what Android paints behind the status bar of the installed app, and a
			// stale value shows as a seam above the top strip.
			{ name: 'theme-color', content: '#07080a' },
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

	// Point the store at whoever is signed in. This is the account boundary (#57):
	// the collections are keyed `sendlab:<accountId>:*`.
	//
	// **Only once the session has resolved.** `useSession` starts pending and, with
	// no network, *stays* unresolved — and a session that is merely unknown is not
	// a signed-out athlete. Acting on the pending null swapped the store for the
	// signed-out namespace on every boot, and offline it stayed there: sixteen
	// empty collections, and whatever the athlete logged next filed somewhere that
	// never syncs. `store/record.ts` remembers the last account so the offline
	// launch opens the right one in the meantime.
	//
	// In an effect rather than a route loader, deliberately: ADR 0006 excludes
	// loaders for account data, because loader caching is what re-introduces
	// back/forward reuse of one athlete's data.
	const { data: session, isPending, error } = authClient.useSession();
	const accountId = session?.user?.id ?? null;
	useEffect(() => {
		if (isPending || error) return;
		setActiveAccount(accountId);
	}, [isPending, error, accountId]);

	// The active locale is held here, at the top of the app tree, for one reason:
	// switching it has to re-render *everything*. Paraglide's `m.*()` calls read
	// the locale at call time, so a component that does not re-render keeps
	// rendering the old language. Re-keying the subtree on the locale forces a
	// remount and makes the switch total rather than partial.
	//
	// Where the value comes from — the device on boot, the account once it
	// hydrates, both on a switch — is `store/locale.ts`'s.
	const [locale, chooseLocale] = useResolvedLocale();

	// The other thing the account learns from the device on boot (#75): which
	// IANA zone the athlete is in, so a daily job can work out when their morning
	// is. Unlike the locale this has no screen and no fallback — the browser
	// either names a zone or the account keeps reading as absent.
	useDeviceTimeZone();

	// #70: the shell prerenders with no `window`, so `getLocale()` throws there,
	// the baked text is always `en-US`, and the Outlet — the route itself never
	// SSRs, ADR 0006's seam — is baked empty. `useResolvedLocale` resolves the
	// *real* locale from `localStorage` synchronously, and the Outlet has real
	// content the instant its route module is ready — both true before React
	// ever gets to compare the first client render against that baked markup,
	// which is enough for React to discard and rebuild the tree (hydration
	// error #418; on `/` specifically the discard lands inside the previously
	// -empty Outlet in a way React treats as a structural mismatch rather than
	// a safe fill).
	//
	// So the first render that actually hydrates baked markup matches it on
	// purpose: `en-US`, no Outlet. The one exception is Vitest's own
	// `import.meta.env.MODE`: `tests/screens.test.ts` renders a route straight
	// to a string with `renderToString` — no mount, so no effect ever fires to
	// reveal anything — and it asserts on that string seeing each screen's full
	// vocabulary immediately, in whatever locale it asked for. There is nothing
	// in that call for a real hydration mismatch to happen *against*, so this
	// is the one context that should skip the defer rather than get stuck in
	// it. `useLayoutEffect` flips it before the browser paints in every other
	// context, so nothing is visibly lost — it only delays which render
	// hydration compares against.
	const [hydrated, setHydrated] = useState(import.meta.env.MODE === 'test');
	useIsomorphicLayoutEffect(() => setHydrated(true), []);
	const bootLocale = hydrated ? locale : 'en-US';

	return (
		<AppShell locale={bootLocale} onLocaleChange={chooseLocale}>
			<div key={bootLocale}>{hydrated && <Outlet />}</div>
		</AppShell>
	);
}

/** `useLayoutEffect` warns when it runs during the Node-side prerender crawl
 *  (no DOM to lay out against); `useEffect` there is silent and correct. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Shown while the client-only tree resolves. Deliberately content-free: it is
 *  part of the user-independent shell. */
function RootPending() {
	return <div className="min-h-dvh bg-background" />;
}
