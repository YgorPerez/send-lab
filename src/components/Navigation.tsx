// THE NAVIGATION (#115, spec #113).
//
// On a phone, a bar on the bottom edge with the four places a training day moves
// between (Today, Train, Timer, Log) and More, which opens a sheet with the rest.
// From `lg`, the same element is a 200px rail down the left listing every
// destination, with More hidden. One `<nav>` under two stylesheets (ADR 0018):
// nothing here knows how wide the window is.
//
// WHY THE BAR CAME BACK
// ---------------------
// #52's bar held three destinations and had nowhere to put a fourth, so the
// pages that arrived later became one-offs (a Settings gear in the strip, a
// `week` chip on Today), and on 2026-09-08 the bar was replaced by a menu in the
// top-right corner. That fixed the one-offs and moved `train` and `timer`, which
// are opened mid-set, to the part of a phone a thumb reaches last. More is the
// overflow the old bar lacked: a new page gets a row in the sheet and in the
// rail, and the bar does not change. ADR 0018's 2026-11-07 amendment records it.
//
// WHAT IT HOLDS
// -------------
// The six pages that exist. `program` (#65) and `studies` (#67) add a row each to
// `DESTINATIONS` with `place: 'more'` when they land, and the bar stays four.
import { Dialog } from '@base-ui/react/dialog';
import { useLinkProps } from '@tanstack/react-router';
import {
	CalendarDays,
	ChevronRight,
	Dumbbell,
	Ellipsis,
	House,
	ScrollText,
	Settings,
	Timer,
	X,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { AppLocale } from '$lib/store/locale';
import { cn } from '$lib/utils';

/**
 * Every destination, in the order they are reached in.
 *
 * `bar` is on the bottom edge at every width; `more` is in More's sheet on a
 * phone and in the rail from `lg`. The bar keeps the menu's order, so the muscle
 * memory the menu built survives the move.
 */
const DESTINATIONS = [
	{ to: '/', label: m.nav_today, Icon: House, place: 'bar' },
	{ to: '/train', label: m.nav_train, Icon: Dumbbell, place: 'bar' },
	{ to: '/timer', label: m.nav_timer, Icon: Timer, place: 'bar' },
	{ to: '/log', label: m.nav_log, Icon: ScrollText, place: 'bar' },
	{ to: '/week', label: m.nav_week, Icon: CalendarDays, place: 'more' },
	// Sign-in is reached from Settings (its account panel), so it is Settings'
	// place: the bar never shows the athlete as nowhere (story 6).
	{ to: '/settings', label: m.nav_settings, Icon: Settings, place: 'more', holds: ['/login'] },
] as const;

type Place = (typeof DESTINATIONS)[number];

const IN_MORE = DESTINATIONS.filter((d) => d.place === 'more');

/** Whether the athlete is at `d`: on its own route, or on one it holds. */
function isAt(d: Place, here: string | null): boolean {
	if (here === null) return false;
	return d.to === here || ('holds' in d && (d.holds as readonly string[]).includes(here));
}

/**
 * One item, bar or rail.
 *
 * The current item is marked by colour, weight and a surface together
 * (DESIGN.md › Navigation): chalk and semibold, on a raised-panel pill behind the
 * icon in the bar and a raised row in the rail. It is keyed on `data-status`,
 * which each `Destination` and More set on themselves, so the two speak one
 * language.
 *
 * 48px tall in the bar, like the clock's controls, because it is reached without
 * looking (story 8); 44px in the rail, the mid-set size.
 */
const ITEM = cn(
	'group flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] leading-tight text-ink-faint transition-colors hover:text-ink',
	'data-[status=active]:font-semibold data-[status=active]:text-chalk',
	'lg:min-h-11 lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:text-[13.5px] lg:hover:bg-panel-2 lg:data-[status=active]:bg-panel-3',
);

/** The pill behind the bar's icon: the surface half of the current mark. */
const PILL =
	'flex h-7 w-12 shrink-0 items-center justify-center rounded-full transition-colors group-data-[status=active]:bg-panel-3 lg:h-auto lg:w-auto lg:group-data-[status=active]:bg-transparent';

/** The label: it wraps rather than clips (pt-BR runs longer), and centres under
 *  its icon in the bar. */
const LABEL = 'max-w-full text-center break-words lg:text-left';

/**
 * A link to one destination, marked current from `here` and from nothing else.
 *
 * Not `Link`, whose own active state comes from the router: the shell is baked
 * once, at `/`, so a router-marked bar bakes Today as current, and a cold start
 * on any other screen hydrates over that markup. React does not patch an
 * attribute that differs on hydration, so Today stayed marked on every screen
 * (found on the built app, #115). `useLinkProps` keeps what `Link` does for a
 * click (client navigation, modifier keys, preloading); this drops its active
 * props for the ones `here` decides, which are none until the app has hydrated.
 */
function Destination({
	to,
	current,
	className,
	onClick,
	children,
}: {
	to: (typeof DESTINATIONS)[number]['to'];
	current: boolean;
	className: string;
	onClick?: () => void;
	children: ReactNode;
}) {
	const routerProps: Record<string, unknown> = { ...useLinkProps({ to, onClick }) };
	delete routerProps['aria-current'];
	delete routerProps['data-status'];
	return (
		<a
			{...routerProps}
			aria-current={current ? 'page' : undefined}
			data-status={current ? 'active' : undefined}
			className={className}
		>
			{children}
		</a>
	);
}

/**
 * The app's navigation.
 *
 * `locale` is passed rather than read here for the reason the strip gives: the
 * shell re-keys its subtree on the locale, and a label that read the ambient
 * value would render the old language until something else re-rendered it.
 *
 * `here` is the matched route's id, handed down by the root only once the app
 * has hydrated, so no mark differs from the baked shell on the render that
 * hydrates it (see `Destination`).
 */
export function Navigation({ locale, here }: { locale: AppLocale; here: string | null }) {
	const inMore = IN_MORE.some((d) => isAt(d, here));
	return (
		<nav
			aria-label={m.nav_label({}, { locale })}
			data-navigation-bar=""
			// Fixed, and lifted out of the root snapshot so it holds still while the
			// screen under it is replaced (#54), as the strip does.
			style={{ viewTransitionName: 'navigation' }}
			className={cn(
				// The bar: the bottom edge, clearing the home indicator. Its whole box,
				// border and padding included, is `--nav-clear` (56px and the home
				// indicator), the height everything else on the page reserves.
				'fixed inset-x-0 bottom-0 z-20 flex h-[var(--nav-clear)] items-stretch border-t border-line bg-bg/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur',
				// The rail: under the strip, down the left edge, 200px border included,
				// which is `--nav-rail`.
				'lg:top-11 lg:right-auto lg:h-auto lg:w-50 lg:flex-col lg:gap-0.5 lg:border-t-0 lg:border-r lg:px-2 lg:pt-4 lg:pb-4',
			)}
		>
			{DESTINATIONS.map((d) => (
				<Destination
					key={d.to}
					to={d.to}
					current={isAt(d, here)}
					className={cn(ITEM, d.place === 'more' && 'hidden lg:flex')}
				>
					<span className={PILL}>
						<d.Icon size={22} strokeWidth={1.75} aria-hidden="true" />
					</span>
					<span className={LABEL}>{d.label({}, { locale })}</span>
				</Destination>
			))}
			<More locale={locale} here={here} current={inMore} />
		</nav>
	);
}

/**
 * More: the bar's fifth item, and the sheet it opens from the bottom edge.
 *
 * A sheet rather than a dropdown, because it opens against the same thumb that
 * pressed it (story 4). The trigger is hidden from `lg`, where the rail lists
 * every row; the sheet is not, so a sheet left open as the window crosses `lg`
 * (a phone rotated, a window widened) stays visible and closable rather than a
 * hidden modal holding focus.
 *
 * Marked current on any destination it holds (story 6), so the bar never shows
 * the athlete as nowhere. `aria-current="true"` rather than `"page"`: More is not
 * the page, it holds it.
 */
function More({
	locale,
	here,
	current,
}: {
	locale: AppLocale;
	here: string | null;
	current: boolean;
}) {
	const [open, setOpen] = useState(false);
	const label = m.nav_more({}, { locale });
	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				aria-label={label}
				aria-current={current ? 'true' : undefined}
				data-status={current ? 'active' : undefined}
				className={cn(ITEM, 'lg:hidden')}
			>
				<span className={PILL}>
					<Ellipsis size={22} strokeWidth={1.75} aria-hidden="true" />
				</span>
				<span className={LABEL}>{label}</span>
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
				<Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[520px] flex-col rounded-t-xl border border-b-0 border-line bg-panel pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-transform duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full">
					<div className="flex items-center gap-2 py-1 pr-1 pl-4">
						<Dialog.Title className="min-w-0 flex-1 text-[15px] font-semibold text-ink">
							{label}
						</Dialog.Title>
						<Dialog.Close
							aria-label={m.btn_close({}, { locale })}
							className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink"
						>
							<X size={20} strokeWidth={1.75} aria-hidden="true" />
						</Dialog.Close>
					</div>
					<div className="flex flex-col gap-0.5 px-1.5">
						{IN_MORE.map((d) => (
							<Destination
								key={d.to}
								to={d.to}
								current={isAt(d, here)}
								onClick={() => setOpen(false)}
								className="flex min-h-12 items-center gap-3 rounded-md px-3 text-[15px] text-ink transition-colors hover:bg-panel-2 data-[status=active]:bg-panel-3 data-[status=active]:font-semibold data-[status=active]:text-chalk"
							>
								<d.Icon size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
								<span className="min-w-0 flex-1">{d.label({}, { locale })}</span>
								<ChevronRight
									size={18}
									strokeWidth={2}
									className="shrink-0 text-ink-faint"
									aria-hidden="true"
								/>
							</Destination>
						))}
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
