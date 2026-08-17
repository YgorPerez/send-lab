// The frame: a fixed rail at the bottom, and a locale rocker in the header.
//
// The ten-item hamburger is the symptom the redesign map named, and this is what
// replaces it in Direction D: three destinations, each a 76px slab in the lower
// third, where a thumb reaches without regripping the phone. Three is not a
// compromise on ten — the prototype slice *is* three screens, and a rail is the
// shape that stops working somewhere around five. That limit is a finding, not a
// hidden cost: see the ticket.
//
// The rail lives here, in the root route, rather than in each screen, so it is
// mounted once and survives navigation. Two things follow from that. The
// indicator can spring between tabs instead of re-entering from nothing, and the
// rail is genuinely fixed — which #54 measured as the one thing a view
// transition leaves alone. `view-transition-name: rail` keeps it out of the
// screen's group so it does not cross-fade with the content sliding under it.
import { Link, useRouterState } from '@tanstack/react-router';
import { CalendarCheck, Dumbbell, ScrollText } from 'lucide-react';
import { motion } from 'motion/react';
import type * as React from 'react';
import { useEffect, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import { getLocale, locales, setLocale } from '$lib/paraglide/runtime';

const TABS = [
	{ to: '/', icon: CalendarCheck, label: () => m.nav_today() },
	{ to: '/train', icon: Dumbbell, label: () => m.nav_train() },
	{ to: '/log', icon: ScrollText, label: () => m.nav_log() },
] as const;

const LOCALE_LABEL: Record<string, string> = { 'en-US': 'EN', 'pt-BR': 'PT' };

/**
 * Whether the client has taken over from the prerendered shell.
 *
 * This is the cost of mounting the rail in the root route, and it is worth
 * writing down. ADR 0006 prerenders the root route — and only the root route —
 * into `_shell.html`, and requires that artefact to be **user-independent**. The
 * locale is device state: it lives in `localStorage`, the prerender cannot know
 * it, and a rail whose labels are read at render time therefore hydrates as
 * "Today / Train / Log" over a shell that said the same thing in the wrong
 * language. React reports that as a hydration mismatch and throws the tree away.
 *
 * The two requirements genuinely collide: a bottom rail wants to be mounted once
 * and survive navigation, which means the root; the shell contract says the root
 * cannot render anything the device decides. The gate is the resolution — the
 * chrome's *structure* is in the shell, its *words* arrive on the client.
 */
function useHydrated(): boolean {
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);
	return hydrated;
}

export function AppFrame({ children }: { children: React.ReactNode }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const hydrated = useHydrated();
	const active = Math.max(
		0,
		TABS.findIndex((t) => t.to === pathname),
	);

	return (
		<div className="min-h-dvh bg-bg">
			<main className="vt-screen mx-auto max-w-[34rem] px-3 pt-3 pb-[124px]">
				<Header hydrated={hydrated} />
				{children}
			</main>
			<Rail active={active} hydrated={hydrated} />
		</div>
	);
}

function Header({ hydrated }: { hydrated: boolean }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const current = TABS.find((t) => t.to === pathname) ?? TABS[0];
	const lede =
		pathname === '/train' ? m.sec_train() : pathname === '/log' ? m.sec_log() : m.sec_today();

	return (
		<header className="mb-1 flex items-start gap-3">
			<div className="min-w-0 flex-1">
				<h1 className="min-h-[32px] text-[30px] leading-[1.05] font-extrabold tracking-[-0.03em] text-ink">
					{hydrated ? current.label() : ''}
				</h1>
				<p className="mt-1 min-h-[14px] font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">
					{hydrated ? lede : ''}
				</p>
			</div>
			<LocaleRocker hydrated={hydrated} />
		</header>
	);
}

/** A two-position rocker, not a dropdown. Both states are visible at rest, so it
 *  reads without being opened — and it is 56px tall like everything else. */
function LocaleRocker({ hydrated }: { hydrated: boolean }) {
	// Read only after hydration: `getLocale()` on the prerendered shell answers
	// with the base locale, and the device may disagree. See `useHydrated`.
	const current = hydrated ? getLocale() : null;
	return (
		<fieldset
			className="well flex shrink-0 overflow-hidden rounded-md p-1"
			aria-label={hydrated ? m.lang_label() : undefined}
		>
			{locales.map((locale) => {
				const on = locale === current;
				return (
					<button
						key={locale}
						type="button"
						aria-pressed={on}
						onClick={() => {
							if (!on) setLocale(locale);
						}}
						className={`h-12 w-11 rounded-[8px] font-mono text-[13px] font-bold tracking-wider transition-transform duration-75 active:translate-y-[1px] ${
							on ? 'slab text-ink' : 'text-ink-faint'
						}`}
					>
						{LOCALE_LABEL[locale] ?? locale}
					</button>
				);
			})}
		</fieldset>
	);
}

function Rail({ active, hydrated }: { active: number; hydrated: boolean }) {
	return (
		<nav
			className="vt-rail fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/95 px-3 pt-2 pb-3 backdrop-blur-sm"
			aria-label={hydrated ? m.nav_menu() : undefined}
		>
			<div className="well relative mx-auto flex max-w-[34rem] gap-0 overflow-hidden rounded-lg p-1">
				<motion.span
					aria-hidden="true"
					className="slab absolute top-1 bottom-1 left-1 rounded-md"
					style={{ width: 'calc((100% - 0.5rem) / 3)' }}
					animate={{ x: `${active * 100}%` }}
					transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.9 }}
				/>
				{TABS.map((tab, i) => {
					const Icon = tab.icon;
					const on = i === active;
					return (
						<Link
							key={tab.to}
							to={tab.to}
							aria-current={on ? 'page' : undefined}
							className={`relative z-10 flex h-[68px] flex-1 flex-col items-center justify-center gap-1 rounded-md transition-transform duration-75 active:translate-y-[2px] ${
								on ? 'text-flag' : 'text-ink-faint'
							}`}
						>
							<Icon className="size-6" strokeWidth={on ? 2.75 : 2} />
							<span className="max-w-full min-h-[12px] truncate px-1 text-[12px] leading-none font-semibold tracking-tight">
								{hydrated ? tab.label() : ''}
							</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
