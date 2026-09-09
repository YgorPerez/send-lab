// The chrome: a thin top strip, and nothing else.
//
// WHAT WAS HERE, AND WHY IT IS NOT
// --------------------------------
// Until #52's decision was reopened this file carried three destinations as a
// bottom tab bar on a phone and a 200px left rail on a wide screen. Three tabs
// was not a shortened menu — it was the claim that the app has exactly three
// places the athlete goes on a training day, and that everything else is reached
// *from* one of them rather than sitting beside them. The file said, of that
// claim: "if that claim is wrong, the tab bar is where it shows."
//
// It showed. As the other six pages arrived the claim held only by producing
// one-offs: `settings` became a lone gear in this strip, and `week` a chip in
// Today's header, each invented because there was nowhere for it to live. The
// athlete went looking for `week`, could not find it, and asked for a menu — then
// for the bar to go with it. Both are now in `Menu.tsx`, which is the app's whole
// navigation.
//
// The rail went with the bar, necessarily: it *was* the bar restyled, one element
// under two stylesheets, so there was nothing left to restyle. A wide screen now
// centres `main` across its own measure rather than sitting beside a 200px
// gutter.
//
// WHAT SURVIVES UNCHANGED
// -----------------------
// ADR 0006, which is the reason any of this is shaped the way it is. This
// component is what the build bakes into `/_shell.html`, the artefact the service
// worker precaches and serves on a cold start, so it **must stay
// user-independent and must not read the viewport**: a layout chosen here (a
// `matchMedia` read, a width in state) makes that one artefact viewport-specific
// — either two shells to keep in sync, or one that is wrong for half the loads
// and corrects itself after hydration, which is #70's mismatch with a new cause.
// `tests/desktop.test.ts` still asserts nobody reintroduces the read; what it no
// longer asserts is a `<nav>` that no longer exists.
//
// The strip is still fixed and still carries `view-transition-name: 'topbar'`,
// which lifts it out of the root snapshot so it holds still while the screen
// under it is replaced (#54). There are two such names now, not three: `tabbar`
// left with the bar, and `tests/motion.test.ts` counts them.
import type { ReactNode } from 'react';
import * as m from '$lib/paraglide/messages';
import type { AppLocale } from '$lib/store/locale';
import { cn } from '$lib/utils';
import { Menu } from './Menu';
import { SyncStatus, useSyncState } from './SyncStatus';
import { UpdatePrompt } from './UpdatePrompt';

/**
 * Locale, switched in place.
 *
 * The switch **reports** the choice and does not persist it. It used to call
 * Paraglide's `setLocale` itself, which was fine while the device was the only
 * place a locale lived; #57 made it account data too, and "switching writes both"
 * is one rule that belongs in one function — `store/locale.ts`'s `chooseLocale`.
 * A control that half-persists is how the other half stops happening.
 *
 * Short codes, not `lang_en` / `lang_pt`: "Português (BR)" does not fit a control
 * this size in either locale, and a language tag is an identifier rather than
 * copy.
 */
function LocaleSwitch({
	locale,
	onChange,
}: {
	locale: AppLocale;
	onChange: (l: AppLocale) => void;
}) {
	const pick = (l: AppLocale) => {
		if (l === locale) return;
		onChange(l);
	};
	const opts: { id: AppLocale; short: string; full: string }[] = [
		{ id: 'en-US', short: 'EN', full: m.lang_en() },
		{ id: 'pt-BR', short: 'PT', full: m.lang_pt() },
	];
	return (
		// Each button carries its own accessible name (`lang_en` / `lang_pt`), so
		// the container needs no grouping label — and a `role="group"` on a plain
		// div is what the linter (correctly) refuses.
		<div className="flex items-center overflow-hidden rounded-md border border-line">
			{opts.map((o) => (
				<button
					key={o.id}
					type="button"
					aria-label={o.full}
					aria-pressed={o.id === locale}
					onClick={() => pick(o.id)}
					className={cn(
						'num min-h-9 px-2.5 text-[10px] tracking-wider transition-colors',
						o.id === locale ? 'bg-panel-3 text-chalk' : 'text-ink-faint hover:text-ink',
					)}
				>
					{o.short}
				</button>
			))}
		</div>
	);
}

export function AppShell({
	locale,
	onLocaleChange,
	children,
}: {
	locale: AppLocale;
	onLocaleChange: (l: AppLocale) => void;
	children: ReactNode;
}) {
	// Read here and handed down, because two things in the left group are decided
	// from it: what the strip says, and whether the wordmark is still what the
	// strip is for. It is `null` on the server and on the render that hydrates the
	// baked shell — by construction, see `SyncStatus` — so the artefact this bakes
	// into is the ordinary strip, wordmark and all.
	const sync = useSyncState();
	return (
		// The rail's width is padding on the frame rather than a margin on `main`,
		// so `main` centres itself inside what is left — the content column is
		// centred in the usable width rather than in the window.
		<div className="min-h-dvh bg-bg">
			{/* Full width on both. The wordmark, the sync state and the locale switch
			    are what belongs to the app rather than to a screen — the third of
			    them because ADR 0008 requires the athlete to see unsent work from
			    *any* screen, and this is the only surface every screen has. */}
			<header
				className="fixed inset-x-0 top-0 z-20 flex h-11 items-center justify-between gap-2 border-b border-line bg-bg/95 px-3 backdrop-blur lg:px-5"
				style={{ viewTransitionName: 'topbar' }}
			>
				{/* The wordmark is anchored left, so the sync state is put beside it
				    rather than beside the controls: appearing and disappearing there
				    moves nothing, where the same token on the right would slide the
				    locale switch and the menu sideways every time a task is ticked
				    (#83).

				    The wordmark stands down for a refusal (#84), and only for that.
				    ADR 0008's third state is an *unmissable* message rather than a
				    token, so it takes the whole left side — and what it takes the room
				    from is the app introducing itself, which is the least important
				    thing in the strip. The right group does not move either way. */}
				<div className="flex min-w-0 flex-1 items-center gap-2">
					{sync === 'refused-work' ? null : <span className="eyebrow">Send Lab</span>}
					<SyncStatus state={sync} locale={locale} />
				</div>
				<div className="flex items-center gap-2">
					<LocaleSwitch locale={locale} onChange={onLocaleChange} />
					{/* The app's whole navigation. It replaces the Settings gear rather
					    than sitting beside it: the gear was a one-off because there was
					    nowhere for Settings to live, and a menu that held everything
					    *except* Settings would leave the same shape behind. */}
					<Menu locale={locale} />
				</div>
			</header>

			{/* `max-w-[520px]` is the phone measure and it stays the phone measure.
			    1000px is two of the 360px columns these screens were designed against
			    plus their gutters — the width a second column needs, and no more.
			    Which pages spend it on a second column and which cap themselves back
			    down is the page's own call; `Panes` is where they say so. */}
			<main
				className="mx-auto w-full max-w-[520px] px-3 pt-[52px] pb-14 lg:max-w-[1000px] lg:px-5 lg:pt-[60px]"
				style={{ viewTransitionName: 'screen' }}
			>
				{children}
			</main>

			{/* Nothing until a new version is actually waiting, and nothing at all on
			    the server — see the file for why the prerendered shell must not carry
			    it. It sits in the space the tab bar left. */}
			<UpdatePrompt locale={locale} />
		</div>
	);
}
