// The chrome: a thin top strip, and three destinations that are a bottom tab bar
// on a phone and a left rail on a wide screen.
//
// Replacing the ten-item hamburger is half of this direction. Three tabs is not
// a shortened menu — it is the claim that the app has exactly three places the
// athlete goes on a training day, and that everything else (week, settings,
// studies) is reached *from* one of them rather than sitting beside them. If
// that claim is wrong, the tab bar is where it shows. **The rail carries the
// same three and no more** (#52): a wide screen has room for the other six, and
// putting them there would make desktop a different app, with a second
// information architecture to keep in step with the phone's.
//
// ONE DOM, TWO STYLESHEETS
// ------------------------
// The rail is the tab bar restyled, not a second tree. There is exactly one
// `<nav>` and one `<main>` in this file, and every desktop difference is a `lg:`
// utility on them. That is not tidiness — it is ADR 0006. This component is what
// the build bakes into `/_shell.html`, the artefact the service worker precaches
// and serves on a cold start, and a layout chosen *here* (a `matchMedia` read, a
// width in state) would make that one artefact viewport-specific: either two
// shells to keep in sync, or one shell that is wrong for half the loads and
// corrects itself after hydration — which is #70's mismatch with a new cause.
// `tests/desktop.test.ts` asserts nobody reintroduces the viewport read.
//
// Both bars are fixed and carry their own `view-transition-name`, which lifts
// them out of the root snapshot so they hold still while the screen under them is
// replaced (#54: a fixed bar survives a view transition intact). The names are
// paired with the `::view-transition-group` rules in `app.css`; changing one
// without the other silently re-animates the chrome. The rail keeps `tabbar`
// unchanged — it is the same element, so it holds still for the same reason.
import { Link } from '@tanstack/react-router';
import { Dumbbell, House, ScrollText, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import * as m from '$lib/paraglide/messages';
import type { AppLocale } from '$lib/store/locale';
import { cn } from '$lib/utils';
import { PrototypeMenu, PrototypeMenuSwitcher } from './PrototypeMenu';

const TABS = [
	{ to: '/', label: m.nav_today, Icon: House },
	{ to: '/train', label: m.nav_train, Icon: Dumbbell },
	{ to: '/log', label: m.nav_log, Icon: ScrollText },
] as const;

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
	return (
		// The rail's width is padding on the frame rather than a margin on `main`,
		// so `main` centres itself inside what is left — the content column is
		// centred in the usable width rather than in the window.
		<div className="min-h-dvh bg-bg lg:pl-[200px]">
			{/* Full width on both, including across the rail. The wordmark and the
			    locale switch are the two things that belong to the app rather than to
			    a screen, and splitting them either side of the rail's edge would put
			    the app's own name inside the navigation. */}
			<header
				className="fixed inset-x-0 top-0 z-20 flex h-11 items-center justify-between gap-2 border-b border-line bg-bg/95 px-3 backdrop-blur lg:px-5"
				style={{ viewTransitionName: 'topbar' }}
			>
				<span className="eyebrow">Send Lab</span>
				<div className="flex items-center gap-2">
					<LocaleSwitch locale={locale} onChange={onLocaleChange} />
					{/* PROTOTYPE (throwaway, `proto/menu`). The Settings gear is replaced
					    by the menu that holds it, plus `week`, `program` and `studies` —
					    the destinations that are not training-day ones. The gear became a
					    one-off because there was nowhere for it to live, and `week`'s chip
					    in Today's header is the same mistake a second time; the missing
					    menu is what produced both. The tab bar is untouched: #52's three
					    destinations are a claim about a training day, which this does not
					    contradict. See `PrototypeMenu.tsx`. */}
					<PrototypeMenu locale={locale} />
				</div>
			</header>

			{/* `max-w-[520px]` is the phone measure and it stays the phone measure.
			    1000px is two of the 360px columns these screens were designed against
			    plus their gutters — the width a second column needs, and no more.
			    Which pages spend it on a second column and which cap themselves back
			    down is the page's own call; `Panes` is where they say so. */}
			<main
				className="mx-auto w-full max-w-[520px] px-3 pt-[52px] pb-[76px] lg:max-w-[1000px] lg:px-5 lg:pt-[60px] lg:pb-14"
				style={{ viewTransitionName: 'screen' }}
			>
				{children}
			</main>

			{/* PROTOTYPE (throwaway). Cycles `?menu=`; also ← / →. */}
			<PrototypeMenuSwitcher />

			<nav
				className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur lg:top-11 lg:right-auto lg:w-[200px] lg:border-t-0 lg:border-r"
				style={{ viewTransitionName: 'tabbar' }}
			>
				<div className="mx-auto flex max-w-[520px] lg:mx-0 lg:max-w-none lg:flex-col lg:gap-0.5 lg:p-2.5">
					{TABS.map(({ to, label, Icon }) => (
						<Link
							key={to}
							to={to}
							// 48px tall on a phone and still 44px in the rail. A pointer is
							// precise enough for less, but a second set of sizes is a second
							// thing to keep in step and the athlete gains nothing from it
							// (#52, question 6). `hover:` is free on touch — Tailwind 4 emits
							// it inside `@media (hover: hover)`.
							className="relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 py-2.5 text-ink-faint transition-colors hover:text-ink lg:min-h-11 lg:flex-none lg:flex-row lg:justify-start lg:gap-2.5 lg:rounded-md lg:px-2.5 lg:py-2 lg:hover:bg-panel-2"
							activeOptions={{ exact: to === '/' }}
							activeProps={{ className: 'text-chalk' }}
						>
							{({ isActive }: { isActive: boolean }) => (
								<>
									<span
										className={cn(
											'absolute inset-x-4 top-0 h-[2px] rounded-full transition-opacity lg:inset-x-auto lg:inset-y-1.5 lg:left-0 lg:h-auto lg:w-[2px]',
											isActive ? 'bg-flag opacity-100' : 'opacity-0',
										)}
									/>
									<Icon size={18} strokeWidth={isActive ? 2.2 : 1.7} />
									{/* Explicit `{ locale }`, not the implicit `getLocale()` the
									    function falls back to: Paraglide's own runtime locale
									    updates the instant `localStorage` is read, before React's
									    hydration-deferred `locale` prop (#70) catches up, and the
									    two disagreeing is a text hydration mismatch on every
									    pt-BR load. */}
									<span className="eyebrow">{label({}, { locale })}</span>
								</>
							)}
						</Link>
					))}
				</div>
			</nav>
		</div>
	);
}
