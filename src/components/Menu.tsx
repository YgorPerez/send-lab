// THE MENU.
//
// Every destination in the app, behind one control in the top strip. It is the
// app's whole navigation: there is no tab bar and no rail.
//
// WHY THE TAB BAR IS GONE
// -----------------------
// [#52](https://github.com/YgorPerez/send-lab/issues/52) fixed the bar at three
// destinations on the claim that there are exactly three places the athlete goes
// on a training day, and that held while there were three pages. It stopped
// holding as the other six arrived: `settings` became a lone gear in the strip
// and `week` became a chip in Today's header, each a one-off invented because
// there was nowhere for it to live. The athlete went looking for `week` and could
// not find it, which is what settled it — two one-offs were the symptom, the
// missing menu was the cause, and `nav_menu` had been sitting unused in both
// locales since the SvelteKit app, which had nine destinations to this rebuild's
// three.
//
// Prototyped four ways on `proto/menu`; this is variant D, chosen by the athlete.
// [ADR 0018](../../docs/adr/0018-the-desktop-layout-is-css-below-the-shell.md)
// carries what that decision replaced.
//
// WHY A DROPDOWN AND NOT A SHEET
// ------------------------------
// The two shapes that survived were a bottom sheet, opening against the thumb,
// and this — opening where the control is, with the page still readable behind
// it. The sheet's argument was reach, and it is a real one: the strip is the part
// of a phone a hand does not get to, and `train` is now reached from here *during
// a session*. The dropdown won on the page staying visible, and the reach cost is
// paid down rather than dismissed: the trigger fills the strip's full 44px rather
// than sitting at the gear's 36px, and every row is 44px, because this navigation
// is now touched mid-set and the measured rule applies to it.
//
// WHAT IT HOLDS
// -------------
// The five pages that exist. `program` ([#65](https://github.com/YgorPerez/send-lab/issues/65))
// and `studies` ([#67](https://github.com/YgorPerez/send-lab/issues/67)) are not
// here: the prototype showed them greyed with their ticket numbers on, which is a
// developer's view of the app, and a menu row that goes nowhere is furniture. Each
// ticket adds its own row when it lands.
import { Popover } from '@base-ui/react/popover';
import { Link } from '@tanstack/react-router';
import {
	CalendarDays,
	Dumbbell,
	House,
	Menu as MenuIcon,
	ScrollText,
	Settings,
} from 'lucide-react';
import { useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { AppLocale } from '$lib/store/locale';

/**
 * The destinations, in the order they are reached in.
 *
 * The three that were the tab bar come first and keep their order, so the muscle
 * memory the bar built survives its removal. `week` sits with them because it is
 * training; `settings` is last because it is about the app.
 */
const DESTINATIONS = [
	{ to: '/', label: m.nav_today, Icon: House },
	{ to: '/train', label: m.nav_train, Icon: Dumbbell },
	{ to: '/log', label: m.nav_log, Icon: ScrollText },
	{ to: '/week', label: m.nav_week, Icon: CalendarDays },
	{ to: '/settings', label: m.nav_settings, Icon: Settings },
] as const;

/**
 * The app's navigation.
 *
 * `locale` is passed explicitly rather than read here for the reason the tab
 * labels gave: the shell re-keys its subtree on the locale, and a label that read
 * the ambient value would render the old language until something else forced it
 * to re-render.
 */
export function Menu({ locale }: { locale: AppLocale }) {
	const [open, setOpen] = useState(false);

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			{/* The full height of the strip, not the gear's 36px. This is the only
			    way into five of the app's pages and one of them is opened mid-set;
			    the control that reaches them does not get to be smaller than the
			    thing it replaced. */}
			<Popover.Trigger
				render={<button type="button" aria-label={m.nav_menu({}, { locale })} />}
				className="flex h-11 items-center justify-center rounded-md border border-line px-2.5 text-ink-faint transition-colors hover:text-ink data-[popup-open]:bg-panel-3 data-[popup-open]:text-chalk"
			>
				<MenuIcon size={16} strokeWidth={1.8} />
			</Popover.Trigger>

			<Popover.Portal>
				<Popover.Positioner sideOffset={6} align="end" className="z-50">
					<Popover.Popup
						// `w-[232px]` is measured, not chosen: `Configurações` is the
						// longest label in either locale and it sets the floor once the
						// icon, the gaps and the padding are taken out. pt-BR runs 1.4–2×
						// longer than en-US and is what a nav panel overflows on first.
						className="w-[232px] rounded-lg border border-line bg-panel p-1 shadow-lg transition-[opacity,transform] duration-150 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0"
					>
						<nav className="flex flex-col gap-0.5">
							{DESTINATIONS.map(({ to, label, Icon }) => (
								<Link
									key={to}
									to={to}
									onClick={() => setOpen(false)}
									// 44px, because `train` is reached from here during a
									// session now. The prototype's rows were 40px, which was
									// defensible while the tab bar carried the mid-set
									// destinations and is not any more.
									className="flex min-h-11 items-center gap-3 rounded-md px-3 text-[13.5px] text-ink transition-colors hover:bg-panel-2"
									activeProps={{ className: 'bg-panel-3 font-semibold text-chalk' }}
									// `/` matches every route as a prefix, so the home entry
									// needs the exact match its siblings do not.
									activeOptions={{ exact: to === '/' }}
								>
									<Icon size={17} strokeWidth={1.7} className="shrink-0" />
									<span className="min-w-0 flex-1">{label({}, { locale })}</span>
								</Link>
							))}
						</nav>
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		</Popover.Root>
	);
}
