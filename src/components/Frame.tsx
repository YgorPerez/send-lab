// The case the three screens sit in.
//
// NAVIGATION — the ticket's hardest question, and this is the answer.
//
// The rebuild inherited a ten-item hamburger, which is the clearest symptom of
// "not really a phone app". The obvious replacement is a tab bar, and a tab bar
// is wrong for this direction: icons, a pill, a chosen accent and 56px of
// chrome are exactly the consumer vocabulary the direction rejects.
//
// So the bar stays and stops being navigation-only. Bench equipment does not
// have tabs; it has a **channel selector**, and every channel shows its current
// reading whether or not you are looking at it. Each of the three cells carries
// its own live number — readiness on 01, sets logged on 02, sessions on 03 —
// so the bar is instrumentation that happens to be tappable rather than chrome
// that costs 44px and says nothing. It also means the athlete can read the
// state of all three screens from any one of them, which is the thing a tab bar
// with icons cannot do.
//
// No icons, no radius, no accent fill: the active channel simply inverts, the
// way a lit segment does.
//
// The locale control is a **units switch**, top right — two hairline cells,
// EN | PT. Instruments put unit selection on the case, not in a settings
// screen, and every direction is judged in both locales, so it has to be
// reachable on the phone in one tap from any screen.

import { Link, useRouterState } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';
import * as m from '$lib/paraglide/messages';
import { switchLocale, useLocale } from '$lib/prototype/locale';
import { usePrototype } from '$lib/prototype/usePrototype';
import { cn } from '$lib/utils';

const CHANNELS = [
	{ index: '01', to: '/' },
	{ index: '02', to: '/train' },
	{ index: '03', to: '/log' },
] as const;

/** Which way the sweep runs. Stamped on <html> before the router navigates, and
 *  read by the `::view-transition-new(panel)` rules in `app.css`. */
function stampDirection(from: string, to: string): void {
	const a = CHANNELS.findIndex((c) => c.to === from);
	const b = CHANNELS.findIndex((c) => c.to === to);
	document.documentElement.dataset.dir = b >= a ? 'fwd' : 'back';
}

export function Frame({ children }: { children: ReactNode }) {
	const locale = useLocale();
	const fx = usePrototype();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	// Drives the pt-BR tracking relaxation in `app.css`. Portuguese labels run
	// long enough that 0.16em of letter-spacing is the difference between fitting
	// and not; the rule lives in CSS, the switch lives here.
	useEffect(() => {
		document.documentElement.dataset.locale = locale;
		document.documentElement.lang = locale;
	}, [locale]);

	const setsDone = fx.train.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);
	const setsTotal = fx.train.items.reduce((n, it) => n + it.sets.length, 0);

	const readings: Record<string, string> = {
		'/': String(fx.today.score),
		'/train': `${setsDone}/${setsTotal}`,
		'/log': String(fx.log.sessions.length),
	};
	const names: Record<string, string> = {
		'/': m.nav_today(),
		'/train': m.nav_train(),
		'/log': m.nav_log(),
	};

	return (
		<div className="flex min-h-dvh flex-col bg-bg">
			<header className="[view-transition-name:rail-top] sticky top-0 z-20 flex h-8 shrink-0 items-center gap-2 border-rule border-b bg-bg px-3">
				<span className="lbl text-ink">Send&nbsp;Lab</span>
				<span aria-hidden="true" className="h-px flex-1 bg-line" />
				<span className="lbl text-ink-faint">{fx.today.dateLabel}</span>
				<div className="flex border border-line">
					<button
						aria-pressed={locale === 'en-US'}
						className={cn(
							'lbl lbl-tight px-1.5 py-1',
							locale === 'en-US' ? 'bg-ink text-bg' : 'text-ink-faint',
						)}
						onClick={() => switchLocale('en-US')}
						type="button"
					>
						EN
					</button>
					<button
						aria-pressed={locale === 'pt-BR'}
						className={cn(
							'lbl lbl-tight border-line border-l px-1.5 py-1',
							locale === 'pt-BR' ? 'bg-ink text-bg' : 'text-ink-faint',
						)}
						onClick={() => switchLocale('pt-BR')}
						type="button"
					>
						PT
					</button>
				</div>
			</header>

			<main className="[view-transition-name:panel] min-w-0 flex-1 pb-[52px]">{children}</main>

			<nav className="[view-transition-name:rail-bot] fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 gap-px border-rule border-t bg-line">
				{CHANNELS.map((c) => {
					const active = pathname === c.to;
					return (
						<Link
							className={cn(
								'flex h-[52px] flex-col justify-center gap-0.5 px-2',
								active ? 'bg-ink text-bg' : 'bg-bg text-ink-dim',
							)}
							key={c.to}
							onClick={() => stampDirection(pathname, c.to)}
							to={c.to}
						>
							<span className="lbl truncate" style={active ? { color: 'inherit' } : undefined}>
								<span className={active ? 'opacity-60' : 'text-ink-faint'}>{c.index}</span>{' '}
								{names[c.to]}
							</span>
							<span className="num text-[15px] leading-none">{readings[c.to]}</span>
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
