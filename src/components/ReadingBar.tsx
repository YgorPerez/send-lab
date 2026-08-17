// What replaces the ten-item hamburger.
//
// The old menu is the clearest symptom of "not really a phone app": every screen
// is two taps and a modal away, and the modal covers the thing you were reading.
// The replacement here is deliberately not an icon bar — this direction's claim
// is that type is the interface, and three words set in the display face read
// faster at arm's length than three glyphs the athlete has to learn.
//
// It is fixed and it carries its own `view-transition-name` (`c-vt-bar`). #54
// measured that a fixed bar survives a view transition intact; that is only true
// once it is named, because an unnamed fixed element is captured inside the root
// snapshot and cross-fades with everything else.
import { Link, useRouterState } from '@tanstack/react-router';
import * as m from '$lib/paraglide/messages';

const DESTINATIONS = [
	{ to: '/', label: () => m.nav_today() },
	{ to: '/train', label: () => m.nav_train() },
	{ to: '/log', label: () => m.nav_log() },
] as const;

export function ReadingBar() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return (
		<nav className="c-vt-bar fixed inset-x-0 bottom-0 z-30 border-line border-t bg-background/95 backdrop-blur">
			<ul className="flex items-stretch">
				{DESTINATIONS.map(({ to, label }) => {
					const active = pathname === to;
					return (
						<li key={to} className="flex-1">
							<Link
								to={to}
								className={`flex h-[4.5rem] items-center justify-center font-display text-[19px] transition-colors ${
									active ? 'text-flag' : 'text-ink-dim'
								}`}
							>
								<span className={active ? 'border-flag border-b pb-1' : 'pb-1'}>{label()}</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
