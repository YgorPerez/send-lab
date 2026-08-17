// The editorial primitives Direction C is built from.
//
// The bet: one thing at a time. A screen is not a dashboard of panels, it is a
// short sequence of *chapters*, each of which fills the phone on its own. The
// athlete advances by flicking or by tapping a numeral in the rail; nothing is
// removed from the information architecture, only from the first screenful.
//
// The rail is the honesty check on that bet. Progressive disclosure that buries
// a thing behind a menu is a cut wearing a disguise; progressive disclosure that
// keeps every chapter one tap away on the same page is a sequence. The rail is
// what makes the second claim true, so it is fixed, always visible, and it
// carries as many marks as the screen has chapters.
import { Collapsible } from '@base-ui/react/collapsible';
import { type ReactNode, use, useEffect, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import { LocaleContext, LocaleToggle } from './Locale';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export interface ChapterDef {
	/** DOM id of the chapter section — what the rail scrolls to. */
	id: string;
	label: string;
}

const prefersReducedMotion = (): boolean =>
	typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function goToChapter(id: string): void {
	document.getElementById(id)?.scrollIntoView({
		behavior: prefersReducedMotion() ? 'auto' : 'smooth',
		block: 'start',
	});
}

/**
 * Which chapter owns the middle of the viewport.
 *
 * `rootMargin` collapses the observation band to a thin strip across the middle
 * of the screen, so exactly one full-height chapter is ever "active" and the mark
 * in the rail does not flicker between two of them at a boundary.
 */
function useActiveChapter(idsKey: string): string {
	const [active, setActive] = useState('');
	useEffect(() => {
		const ids = idsKey.split('|');
		const els = ids
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el != null);
		if (els.length === 0) return;
		setActive(els[0].id);
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
			},
			{ rootMargin: '-48% 0px -48% 0px', threshold: 0 },
		);
		for (const el of els) io.observe(el);
		return () => io.disconnect();
	}, [idsKey]);
	return active;
}

/** The chapter rail: the whole screen, as numerals, always one tap away. */
export function ChapterRail({ chapters }: { chapters: ChapterDef[] }) {
	const active = useActiveChapter(chapters.map((c) => c.id).join('|'));
	return (
		<nav
			aria-label={m.c_chapters()}
			className="c-vt-rail fixed top-1/2 right-0 z-20 flex w-11 -translate-y-1/2 flex-col items-center gap-1 py-2"
		>
			{chapters.map((c, i) => {
				const on = c.id === active;
				return (
					<button
						key={c.id}
						type="button"
						aria-current={on ? 'true' : undefined}
						onClick={() => goToChapter(c.id)}
						className={`flex h-9 w-9 items-center justify-center font-display text-[13px] transition-colors ${
							on ? 'text-flag' : 'text-ink-faint'
						}`}
					>
						<span className="sr-only">{c.label}</span>
						<span aria-hidden="true">{ROMAN[i] ?? String(i + 1)}</span>
					</button>
				);
			})}
		</nav>
	);
}

/**
 * One chapter — a full screenful with one idea on it.
 *
 * `min-height` is the viewport minus the reading bar. `dvh` alone is correct
 * here: #54 measured `svh == lvh == dvh` on the athlete's device, so the usual
 * three-unit dance buys nothing.
 */
export function Chapter({
	id,
	index,
	label,
	children,
}: {
	id: string;
	index: number;
	label: string;
	children: ReactNode;
}) {
	return (
		<section
			id={id}
			className="flex min-h-[calc(100dvh-4.5rem)] scroll-mt-0 flex-col justify-center border-line border-t py-10 first:border-t-0"
		>
			<h2 className="c-eyebrow mb-6 flex items-baseline gap-2">
				<span className="font-display text-flag text-sm not-italic">
					{ROMAN[index] ?? String(index + 1)}
				</span>
				<span>{label}</span>
			</h2>
			{children}
		</section>
	);
}

/**
 * A detail behind one tap.
 *
 * Everything the fixture carries has to be reachable, and in this direction most
 * of it is reachable *here*: the "why we ask" behind a question, the options
 * behind an answer, the fields behind a logged set. The trigger states what is
 * inside rather than saying "more", because a screen this sparse gives no other
 * clue.
 */
export function Disclose({
	label,
	children,
	defaultOpen = false,
}: {
	label: string;
	children: ReactNode;
	defaultOpen?: boolean;
}) {
	return (
		<Collapsible.Root defaultOpen={defaultOpen}>
			<Collapsible.Trigger className="c-eyebrow group flex items-center gap-1.5 py-1 text-left text-ink-dim">
				<span className="inline-block transition-transform group-data-[panel-open]:rotate-90">
					›
				</span>
				{label}
			</Collapsible.Trigger>
			<Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
				<div className="pt-2 pb-1">{children}</div>
			</Collapsible.Panel>
		</Collapsible.Root>
	);
}

/** The page head: wordmark, the screen's own name, and the locale control. */
export function Masthead({ title }: { title: string }) {
	return (
		<header className="flex items-baseline justify-between gap-4 border-line border-b pt-8 pb-3">
			<div className="flex items-baseline gap-3">
				<span className="c-eyebrow text-ink">Send Lab</span>
				<span className="c-eyebrow">{title}</span>
			</div>
			<LocaleToggle />
		</header>
	);
}

/**
 * A screen.
 *
 * `lang` is set here rather than on `<html>` because ADR 0006 keeps the root
 * shell user-independent and the athlete's locale is not. It is load-bearing and
 * not decoration: `hyphens: auto` on the display type only fires when the element
 * declares a language, and hyphenation is the difference between a Portuguese
 * verdict title that breaks and one that overflows.
 */
export function Screen({
	title,
	chapters,
	children,
}: {
	title: string;
	chapters: ChapterDef[];
	children: ReactNode;
}) {
	const { locale } = use(LocaleContext);
	return (
		<main lang={locale} className="min-h-dvh bg-background pr-11 pb-24 pl-6 text-foreground">
			<Masthead title={title} />
			<ChapterRail chapters={chapters} />
			{children}
		</main>
	);
}

/** A hairline. The only divider this direction owns. */
export function Rule({ className = '' }: { className?: string }) {
	return <hr className={`border-line border-t ${className}`} />;
}
