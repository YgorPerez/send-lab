// The instrument's chrome, and the answer to "what is navigation when the design
// has almost no chrome?".
//
// THE READOUT STRIP (top)
// -----------------------
// An instrument has one primary display, and it stays lit whatever channel you
// are looking at. Here that is the readiness score — the number the whole app
// exists to produce. Same place, same size, on all three screens, coloured by
// the verdict, and live: re-answer the check on Today and Train's header changes
// with it. Train and Log are not "other screens"; they are the same instrument
// showing different readings while the master reading stays visible.
//
// It carries `view-transition-name: inst-header`, which lifts it out of the
// navigation snapshot. The panel holds still; only the readings sweep.
//
// THE FUNCTION STRIP (bottom)
// ---------------------------
// A tab bar with the tab bar taken away: one structural rule, four mono labels
// under it, no icons, no pills, no fill, no elevation, no active-tab chip. What
// marks the active position is a 2px needle riding *on* the rule, which travels
// rather than cuts. That is a mode selector on a front panel — and it is 56px of
// thumb target while adding a single line of chrome to the screen.
//
// The fourth position is the locale, not a settings screen and not a hamburger:
// unit and language selection live on the panel of any real instrument, right
// next to the mode switch. The needle never travels there — it is a state
// toggle, not a channel.
import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { LOCALES, localeTag, switchLocale } from '$lib/localeSwitch';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { usePrototype, useReading } from '$lib/prototypeSnapshot';
import { cn } from '$lib/utils';

const CHANNELS = [
	{ to: '/', label: () => m.nav_today() },
	{ to: '/train', label: () => m.nav_train() },
	{ to: '/log', label: () => m.nav_log() },
] as const;

export function Panel({ children }: { children: React.ReactNode }) {
	const locale = getLocale();
	const path = useRouterState({ select: (s) => s.location.pathname });
	const { today } = usePrototype();
	const live = useReading();
	const reading = live ?? { score: today.score, color: today.verdict.color };
	const active = Math.max(
		0,
		CHANNELS.findIndex((c) => c.to === path),
	);

	// The prerendered shell says `<html lang="en">` and must stay
	// user-independent (ADR 0006), so the document language is corrected here
	// instead — on mount, and again on every switch.
	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	return (
		<div className="min-h-dvh bg-bg">
			<header
				className="fixed inset-x-0 top-0 z-20 flex h-11 items-center gap-2.5 border-b border-line-2 bg-bg px-4"
				style={{ viewTransitionName: 'inst-header' }}
			>
				<span className="shrink-0 font-mono text-[11px] font-bold tracking-[0.26em] text-ink">
					SEND·LAB
				</span>
				<span aria-hidden className="h-px min-w-2 flex-1 bg-line" />
				<span
					className="shrink-0 font-mono text-[17px] leading-none font-bold"
					style={{ color: reading.color }}
				>
					{reading.score ?? '––'}
				</span>
				<span className="inst-label-xs max-w-[104px] shrink truncate">{m.rd_score()}</span>
			</header>

			<main className="pt-11 pb-16">{children}</main>

			<nav
				className="fixed inset-x-0 bottom-0 z-20 border-t border-line-2 bg-bg"
				style={{ viewTransitionName: 'inst-footer' }}
			>
				<div className="relative grid grid-cols-4">
					{/* The needle. A CSS transform, not a shared-element view transition:
					    #54 measured that view transitions leave a fixed bar alone, and
					    naming an element inside one pulls it back into the animation and
					    flickers at the corners. A transform gets the travel with none of
					    that, and it runs alongside the router's own transition. */}
					<span
						aria-hidden
						className="absolute top-0 left-0 h-[2px] w-1/4 bg-flag transition-transform duration-[220ms] ease-[cubic-bezier(0.16,0.84,0.34,1)]"
						style={{ transform: `translateX(${active * 100}%)` }}
					/>
					{CHANNELS.map((c, i) => (
						<Link
							key={c.to}
							to={c.to}
							className={cn(
								'flex h-14 items-center justify-center overflow-hidden font-mono text-[11px] tracking-[0.14em] uppercase transition-colors',
								i === active ? 'text-ink' : 'text-ink-faint active:text-ink-dim',
							)}
						>
							<span className="truncate px-1">{c.label()}</span>
						</Link>
					))}
					<div className="flex h-14 items-center justify-center gap-1 border-l border-line">
						{LOCALES.map((l) => (
							<button
								key={l}
								type="button"
								onClick={() => switchLocale(l)}
								aria-label={`${m.lang_label()} · ${l}`}
								aria-pressed={l === locale}
								className={cn(
									'px-1.5 py-3 font-mono text-[11px] tracking-[0.12em]',
									l === locale ? 'text-flag underline underline-offset-[6px]' : 'text-ink-faint',
								)}
							>
								{localeTag(l)}
							</button>
						))}
					</div>
				</div>
			</nav>
		</div>
	);
}

/** The channel name, printed under the readout strip with the one line of
 *  context that channel needs. The old app spent a paragraph of lede copy here;
 *  an instrument spends a line. */
export function ScreenHead({ title, context }: { title: string; context?: React.ReactNode }) {
	return (
		<div className="flex items-baseline gap-3 border-b border-line px-4 py-3">
			<h1 className="shrink-0 font-mono text-[13px] font-bold tracking-[0.18em] text-ink uppercase">
				{title}
			</h1>
			<span aria-hidden className="h-px min-w-2 flex-1 self-center bg-line" />
			{context ? <span className="inst-label-xs min-w-0 truncate">{context}</span> : null}
		</div>
	);
}
