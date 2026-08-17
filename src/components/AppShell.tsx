// The chrome: a thin top strip and a persistent bottom tab bar.
//
// Replacing the ten-item hamburger is half of this direction. Three tabs is not
// a shortened menu — it is the claim that the app has exactly three places the
// athlete goes on a training day, and that everything else (week, settings,
// studies) is reached *from* one of them rather than sitting beside them. If
// that claim is wrong, the tab bar is where it shows.
//
// Both bars are fixed and carry their own `view-transition-name`, which lifts
// them out of the root snapshot so they hold still while the screen under them
// is replaced (#54: a fixed bar survives a view transition intact).
import { Link } from '@tanstack/react-router';
import { Dumbbell, House, ScrollText } from 'lucide-react';
import * as m from '$lib/paraglide/messages';
import { setLocale } from '$lib/paraglide/runtime';
import { cn } from '$lib/utils';

/** The two locales the app ships. Declared here rather than imported: Paraglide
 *  emits `runtime.js` as JSDoc-annotated JavaScript and does not export a
 *  `Locale` type, so importing one is a compile error rather than a widening. */
export type AppLocale = 'en-US' | 'pt-BR';

const TABS = [
	{ to: '/', label: m.nav_today, Icon: House },
	{ to: '/train', label: m.nav_train, Icon: Dumbbell },
	{ to: '/log', label: m.nav_log, Icon: ScrollText },
] as const;

/** Locale, switched in place.
 *
 *  Paraglide's `setLocale` reloads the document by default. A reload here would
 *  throw away every bit of in-progress session state on the Train screen, so it
 *  is suppressed and the caller re-renders the tree instead. Short codes, not
 *  `lang_en` / `lang_pt`: "Português (BR)" does not fit a control this size in
 *  either locale, and a language tag is an identifier rather than copy. */
function LocaleSwitch({
	locale,
	onChange,
}: {
	locale: AppLocale;
	onChange: (l: AppLocale) => void;
}) {
	const pick = (l: AppLocale) => {
		if (l === locale) return;
		setLocale(l, { reload: false });
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
						'num px-2 py-1 text-[10px] tracking-wider transition-colors',
						o.id === locale ? 'bg-panel-3 text-chalk' : 'text-ink-faint',
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
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-dvh bg-bg">
			<header
				className="fixed inset-x-0 top-0 z-20 flex h-11 items-center justify-between gap-2 border-b border-line bg-bg/95 px-3 backdrop-blur"
				style={{ viewTransitionName: 'topbar' }}
			>
				<span className="eyebrow">Send Lab</span>
				<LocaleSwitch locale={locale} onChange={onLocaleChange} />
			</header>

			<main
				className="mx-auto w-full max-w-[520px] px-3 pt-[52px] pb-[76px]"
				style={{ viewTransitionName: 'screen' }}
			>
				{children}
			</main>

			<nav
				className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur"
				style={{ viewTransitionName: 'tabbar' }}
			>
				<div className="mx-auto flex max-w-[520px]">
					{TABS.map(({ to, label, Icon }) => (
						<Link
							key={to}
							to={to}
							className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-ink-faint"
							activeOptions={{ exact: to === '/' }}
							activeProps={{ 'data-on': 'true', className: 'text-chalk' }}
						>
							{({ isActive }: { isActive: boolean }) => (
								<>
									<span
										className={cn(
											'absolute inset-x-4 top-0 h-[2px] rounded-full transition-opacity',
											isActive ? 'bg-flag opacity-100' : 'opacity-0',
										)}
									/>
									<Icon size={18} strokeWidth={isActive ? 2.2 : 1.7} />
									<span className="eyebrow">{label()}</span>
								</>
							)}
						</Link>
					))}
				</div>
			</nav>
		</div>
	);
}
