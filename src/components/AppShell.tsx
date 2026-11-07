// The chrome: the top strip, the navigation, and the frame `main` sits in.
//
// WHAT IT IS NOW (#115, spec #113)
// --------------------------------
// The strip carries what belongs to the app rather than to a screen: the
// wordmark and the sync state on the left, and on the right at most one action
// the matched route supplies (`lib/chrome.ts`). The locale switch left it for
// Settings (story 12): a control touched once does not take the most visible spot
// on every screen. The navigation is `Navigation`: a bar on the bottom edge of a
// phone, the same element as a 200px rail from `lg`.
//
// The history, kept short because ADR 0018 carries it: #52 built a three-item bar
// and rail, the 2026-09-08 amendment replaced them with a menu in this strip when
// three destinations could not hold six pages, and #115 brought the bar back with
// More as its overflow, which is what the three-item bar lacked.
//
// WHAT HOLDS, UNCHANGED
// ---------------------
// ADR 0006, which is the reason any of this is shaped the way it is. This
// component is what the build bakes into `/_shell.html`, the artefact the service
// worker precaches and serves on a cold start, so it **must stay
// user-independent and must not read the viewport**: a layout chosen here (a
// `matchMedia` read, a width in state) makes that one artefact viewport-specific
// — either two shells to keep in sync, or one that is wrong for half the loads
// and corrects itself after hydration, which is #70's mismatch with a new cause.
// `tests/desktop.test.ts` asserts nobody reintroduces the read.
//
// So the bar and the rail differ only in `lg:` utilities, and every height the
// rest of the page has to clear is a CSS variable that changes at `lg` and on the
// intake (`--nav-clear`, `--nav-rail` in `app.css`), never a number read here.
// What the matched route says (no navigation on the intake, the strip's action)
// arrives as props from `__root.tsx`, which hands down the baked answer until the
// app has hydrated.
//
// The strip and the navigation are fixed and each carries a
// `view-transition-name` (`topbar`, `navigation`), which lifts them out of the
// root snapshot so they hold still while the screen between them is replaced
// (#54). `tests/motion.test.ts` counts the names.
import type { ReactNode } from 'react';
import type { Chrome } from '$lib/chrome';
import type { AppLocale } from '$lib/store/locale';
import { Navigation } from './Navigation';
import { SyncStatus, useSyncState } from './SyncStatus';
import { UpdateAnnouncement } from './UpdateAnnouncement';

export function AppShell({
	locale,
	chrome,
	here,
	children,
}: {
	locale: AppLocale;
	/** What the matched route says about the chrome; the baked answer until the
	 *  app has hydrated (`__root.tsx`). */
	chrome: Chrome;
	/** The matched route's id, or `null` until the app has hydrated. */
	here: string | null;
	children: ReactNode;
}) {
	// Read here and handed down, because two things in the left group are decided
	// from it: what the strip says, and whether the wordmark is still what the
	// strip is for. It is `null` on the server and on the render that hydrates the
	// baked shell — by construction, see `SyncStatus` — so the artefact this bakes
	// into is the ordinary strip, wordmark and all.
	const sync = useSyncState();
	const { ScreenAction } = chrome;
	return (
		// The rail's width is padding on the frame rather than a margin on `main`,
		// so `main` centres its measure in what the rail leaves, not in the window.
		// `data-navigation` is what `app.css` reads to stop reserving the bar's
		// height and the rail's width on a screen that has neither.
		<div
			className="min-h-dvh bg-bg lg:pl-[var(--nav-rail)]"
			data-navigation={chrome.navigation ? undefined : 'none'}
		>
			{/* The wordmark, the sync state and one screen action: what belongs to
			    the app rather than to a screen, plus the one thing a screen may put
			    here. The sync state is here because ADR 0008 requires the athlete to
			    see unsent work from *any* screen, and this is the only surface every
			    screen has.

			    Full width on a phone. From `lg` its content sits in `main`'s measure
			    beside the rail, so the wordmark and every screen's title share one
			    left edge (story 16). */}
			<header
				className="fixed inset-x-0 top-0 z-20 h-11 border-b border-line bg-bg/95 backdrop-blur lg:pl-[var(--nav-rail)]"
				style={{ viewTransitionName: 'topbar' }}
			>
				<div className="flex h-full items-center justify-between gap-2 px-gutter lg:mx-auto lg:max-w-[1000px]">
					{/* The wordmark is anchored left, so the sync state is put beside it
					    rather than beside the action: appearing and disappearing there
					    moves nothing, where the same token on the right would slide the
					    action sideways every time a task is ticked (#83).

					    The wordmark stands down for a refusal (#84), and only for that.
					    ADR 0008's third state is an *unmissable* message rather than a
					    token, so it takes the whole left side — and what it takes the
					    room from is the app introducing itself, which is the least
					    important thing in the strip. The right side does not move either
					    way. */}
					<div className="flex min-w-0 flex-1 items-center gap-2">
						{sync === 'refused-work' ? null : <span className="eyebrow">Send Lab</span>}
						<SyncStatus state={sync} locale={locale} />
					</div>
					{/* The screen's one action, if the route names one: a 44px icon
					    control, the strip's full height. */}
					{ScreenAction ? (
						<div className="flex shrink-0 items-center">
							<ScreenAction locale={locale} />
						</div>
					) : null}
				</div>
			</header>

			{/* The one `<nav>`. Not on the intake, which needs the whole screen and
			    has its own way out on every step (story 72). Before `main` in the
			    document, though it is drawn below it on a phone: a keyboard reaches
			    the rail without tabbing through the whole screen, and a screen reader
			    meets the landmark first. Fixed, so the order moves nothing on screen. */}
			{chrome.navigation ? <Navigation locale={locale} here={here} /> : null}

			{/* `max-w-[520px]` is the phone measure and it stays the phone measure.
			    1000px is two of the 360px columns these screens were designed against
			    plus their gutters — the width a second column needs, and no more.
			    Which pages spend it on a second column and which cap themselves back
			    down is the page's own call; `Panes` is where they say so.

			    The bottom padding is the page's own 56px of run-out plus whatever
			    the bar covers (`--nav-clear`: the bar and the home indicator on a
			    phone, nothing from `lg` or on the intake), so the last row scrolls
			    clear of it. */}
			<main
				className="mx-auto w-full max-w-[520px] px-gutter pt-[52px] pb-[calc(3.5rem+var(--nav-clear))] lg:max-w-[1000px] lg:pt-[60px]"
				style={{ viewTransitionName: 'screen' }}
			>
				{children}
			</main>

			{/* Nothing until a new version is actually waiting, and nothing at all on
			    the server — see the file for why the prerendered shell must not carry
			    it. It sits on top of the bar, never under it (story 14). */}
			<UpdateAnnouncement locale={locale} />
		</div>
	);
}
