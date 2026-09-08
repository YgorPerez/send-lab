// PROTOTYPE — THE TOP-STRIP MENU. THROWAWAY.
//
// Three shapes for the menu that replaces the Settings gear, switchable at
// `?menu=A|B|C` from the bar at the bottom. None of this is production code and
// none of it is merged: it lives on `proto/menu`, off `development`.
//
// WHY THIS EXISTS
// ---------------
// The athlete went looking for `week` and could not find it. It is reached from a
// chip in Today's header — a one-off affordance invented because there was
// nowhere else to put it, exactly as Settings became a one-off gear in the strip
// for the same reason. Two one-offs is the symptom; the missing menu is the
// cause. `nav_menu` has been sitting in both locales, unused, since the SvelteKit
// app, which had nine nav destinations to this rebuild's three.
//
// WHY THIS DOES NOT CONTRADICT #52
// --------------------------------
// ADR 0018 and #52 fix the tab bar at **three destinations** — "the three places
// the athlete goes on a training day" — and that claim survives untouched here.
// `week`, `program`, `studies` and `settings` are not training-day destinations;
// they are the rest of the app. A menu is where the rest of the app belongs, so
// this completes the three-tab decision rather than reopening it. **The tab bar
// is not modified by any variant.**
//
// WHY NO VARIANT PUTS THESE IN THE RAIL
// -------------------------------------
// The obvious desktop answer — the rail has room, so let it grow a second group —
// is the one ADR 0018 forecloses: the rail carries *the same three destinations*
// as the tab bar, because a rail with six in it makes desktop a second
// information architecture and every page ticket then owes two answers to "where
// is this reached from". So the menu is strip-anchored at both widths, and the
// only `lg:` differences are size ones. A variant that broke that would be
// drawing a decision this repo already made.
//
// WHAT IT HOLDS, AND THE HONEST GAP
// ---------------------------------
// Four destinations, two of which do not exist yet: `program` is #65 and
// `studies` is #67 behind #37. They render as **unavailable rather than hidden**,
// because a menu that grows items as tickets land teaches the athlete a different
// shape every month, and because seeing what is coming is the thing a menu is
// good at. Whether that is right is one of the questions to judge.
import { Dialog } from '@base-ui/react/dialog';
import { Popover } from '@base-ui/react/popover';
import { Link } from '@tanstack/react-router';
import {
	CalendarDays,
	FlaskConical,
	Menu as MenuIcon,
	Settings,
	SlidersHorizontal,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { AppLocale } from '$lib/store/locale';
import { Eyebrow } from './ui/primitives';
import { chip } from './ui/variants';

/** One row in the menu. `to` is null for a destination that is not built yet. */
interface Destination {
	to: '/week' | '/settings' | null;
	label: (o?: Record<string, never>, opts?: { locale?: AppLocale }) => string;
	Icon: typeof CalendarDays;
	/** Which half of the app it belongs to — used only by variant C. */
	group: 'training' | 'app';
	/** The ticket that builds it, for the ones that do not exist. */
	ticket?: string;
}

const DESTINATIONS: Destination[] = [
	{ to: '/week', label: m.nav_week, Icon: CalendarDays, group: 'training' },
	{ to: null, label: m.nav_program, Icon: SlidersHorizontal, group: 'training', ticket: '#65' },
	{ to: null, label: m.nav_studies, Icon: FlaskConical, group: 'app', ticket: '#67' },
	{ to: '/settings', label: m.nav_settings, Icon: Settings, group: 'app' },
];

const VARIANTS = ['A', 'B', 'C'] as const;
type Variant = (typeof VARIANTS)[number];
const VARIANT_NAME: Record<Variant, string> = {
	A: 'Bottom sheet',
	B: 'Anchored dropdown',
	C: 'Full screen, grouped',
};

/**
 * The variant, from `?menu=`.
 *
 * Read **after mount**, never during render. The shell prerenders with no
 * `window` and `check:hydration` is a permanent gate (#70): a first render that
 * branched on the URL would bake one answer into `/_shell.html` and mismatch at
 * every other. Defaults to `A` on the server and on the first client render, then
 * settles.
 */
function useVariant(): Variant {
	const [variant, setVariant] = useState<Variant>('A');
	useEffect(() => {
		const asked = new URLSearchParams(window.location.search).get('menu')?.toUpperCase();
		if (asked && (VARIANTS as readonly string[]).includes(asked)) setVariant(asked as Variant);
	}, []);
	return variant;
}

/**
 * The control in the strip, in place of the gear. 36px like the gear it replaces
 * — the strip is 44px tall, so it cannot carry a 44px target.
 *
 * Presentational only. The accessible name goes on the `<button>` each variant
 * hands to `Dialog.Trigger`/`Popover.Trigger`, because that button *is* the
 * control; labelling this wrapper instead puts an `aria-label` on a `<span>` with
 * no role, which says nothing to a screen reader.
 */
const TRIGGER_CLASS =
	'flex size-9 items-center justify-center rounded-md border border-line text-ink-faint transition-colors hover:text-ink';

function TriggerIcon() {
	return <MenuIcon size={16} strokeWidth={1.8} />;
}

/** A destination as a row. `size` is the only thing the three variants disagree
 *  about at row level; the shapes differ around them. */
function Row({
	d,
	locale,
	onNavigate,
	compact,
}: {
	d: Destination;
	locale: AppLocale;
	onNavigate: () => void;
	compact?: boolean;
}) {
	const height = compact ? 'min-h-10' : 'min-h-12';
	const inner = (
		<>
			<d.Icon size={compact ? 15 : 17} strokeWidth={1.7} className="shrink-0" />
			<span className="flex-1 text-[13.5px]">{d.label({}, { locale })}</span>
			{d.ticket ? <span className={chip({ tone: 'ghost' })}>{d.ticket}</span> : null}
		</>
	);

	// Unbuilt destinations drop their fill rather than fading out — the measured
	// rule for a control that is unavailable rather than broken. `opacity-40` put
	// a disabled label at 2.46:1.
	if (!d.to) {
		return (
			<span
				aria-disabled
				className={`flex ${height} items-center gap-3 rounded-md px-3 text-ink-faint`}
			>
				{inner}
			</span>
		);
	}
	return (
		<Link
			to={d.to}
			onClick={onNavigate}
			className={`flex ${height} items-center gap-3 rounded-md px-3 text-ink transition-colors hover:bg-panel-2`}
			activeProps={{ className: 'bg-panel-3 text-chalk' }}
		>
			{inner}
		</Link>
	);
}

// ------------------------------------------------------------------ variant A
//
// A BOTTOM SHEET. The menu opens against the thumb rather than under the finger
// that tapped it — the control is in the top strip, which on a phone is the part
// of the screen a hand does not reach. Every other reach decision in this app
// went the same way (the tab bar is at the bottom, the timer's controls are at
// the bottom), so this is the one that matches the app's own posture.
//
// The cost: the sheet is far from the control that opened it, which is the thing
// to judge. It is also the only variant with room for 48px rows.

function VariantA({ locale }: { locale: AppLocale }) {
	const [open, setOpen] = useState(false);
	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				render={<button type="button" aria-label={m.nav_menu({}, { locale })} />}
				className={TRIGGER_CLASS}
			>
				<TriggerIcon />
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
				<Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-line bg-panel px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-transform duration-150 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full lg:mx-auto lg:max-w-[420px] lg:rounded-b-xl lg:border">
					<Dialog.Title className="sr-only">{m.nav_menu({}, { locale })}</Dialog.Title>
					<div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
					<nav className="flex flex-col gap-0.5">
						{DESTINATIONS.map((d) => (
							<Row
								key={d.label({}, { locale })}
								d={d}
								locale={locale}
								onNavigate={() => setOpen(false)}
							/>
						))}
					</nav>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

// ------------------------------------------------------------------ variant B
//
// AN ANCHORED DROPDOWN. The panel opens where the control is, which is the
// conventional answer and the one that costs the least screen. It is a *quick
// jump* rather than a place you land: compact rows, no grouping, no room for a
// subtitle if a destination ever wants one.
//
// The bet against A: the athlete is not mid-set when they open this — they are
// standing still, looking at the strip they just tapped — so thumb reach matters
// less here than it does for the tab bar.

function VariantB({ locale }: { locale: AppLocale }) {
	const [open, setOpen] = useState(false);
	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger
				render={<button type="button" aria-label={m.nav_menu({}, { locale })} />}
				className={TRIGGER_CLASS}
			>
				<TriggerIcon />
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Positioner sideOffset={6} align="end" className="z-50">
					<Popover.Popup className="w-[220px] rounded-lg border border-line bg-panel p-1 shadow-lg transition-[opacity,transform] duration-150 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
						<nav className="flex flex-col gap-0.5">
							{DESTINATIONS.map((d) => (
								<Row
									key={d.label({}, { locale })}
									d={d}
									locale={locale}
									compact
									onNavigate={() => setOpen(false)}
								/>
							))}
						</nav>
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		</Popover.Root>
	);
}

/**
 * Variant C's two group headings, and the only strings in this file that are not
 * from `messages/`.
 *
 * Deliberately local. The grouping *is* what C is proposing, so it may not
 * survive the judgement — and a throwaway that lost its argument would still have
 * left two keys behind in a catalogue `check:i18n` holds to parity. If C wins,
 * these become real keys in the build ticket.
 *
 * The first pass reused `sec_week` and `nav_settings` because they existed, which
 * put "MICROCYCLE" over Week + Program and "SETTINGS" over Studies + Settings —
 * a heading naming one of its own children. Grouping cannot be judged through
 * labels that wrong.
 */
const GROUPS: Record<AppLocale, { key: 'training' | 'app'; title: string }[]> = {
	'en-US': [
		{ key: 'training', title: 'What you train' },
		{ key: 'app', title: 'The app' },
	],
	'pt-BR': [
		{ key: 'training', title: 'O que você treina' },
		{ key: 'app', title: 'O app' },
	],
};

// ------------------------------------------------------------------ variant C
//
// A FULL SCREEN, GROUPED. The menu is a place rather than an overlay: two named
// halves — what you train with, and what the app is — with room for the eyebrow
// rank to do the grouping the other two cannot afford.
//
// The bet: four destinations do not need this, and nine did. It is here because
// the SvelteKit app had nine and this one is at four *and rising* — `program`
// and `studies` are both coming — so the question is whether the shape that fits
// today is the shape that fits in three tickets' time.

function VariantC({ locale }: { locale: AppLocale }) {
	const [open, setOpen] = useState(false);
	const groups = GROUPS[locale];
	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				render={<button type="button" aria-label={m.nav_menu({}, { locale })} />}
				className={TRIGGER_CLASS}
			>
				<TriggerIcon />
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Popup className="fixed inset-0 z-50 overflow-y-auto bg-bg px-3 pt-3 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 lg:px-5">
					<div className="mx-auto w-full max-w-[520px]">
						<header className="flex h-11 items-center justify-between">
							<Dialog.Title className="h-screen-title">{m.nav_menu({}, { locale })}</Dialog.Title>
							<Dialog.Close
								className="flex size-9 items-center justify-center rounded-md border border-line text-ink-faint hover:text-ink"
								aria-label="Close"
							>
								✕
							</Dialog.Close>
						</header>
						{groups.map((g) => (
							<section key={g.key} className="mt-6 flex flex-col gap-2.5">
								<Eyebrow>{g.title}</Eyebrow>
								<nav className="flex flex-col gap-0.5 border-t border-line-soft pt-2">
									{DESTINATIONS.filter((d) => d.group === g.key).map((d) => (
										<Row
											key={d.label({}, { locale })}
											d={d}
											locale={locale}
											onNavigate={() => setOpen(false)}
										/>
									))}
								</nav>
							</section>
						))}
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

/** The menu, in whichever shape `?menu=` asked for. Rendered by `AppShell` in
 *  place of the Settings gear. */
export function PrototypeMenu({ locale }: { locale: AppLocale }): ReactNode {
	const variant = useVariant();
	if (variant === 'B') return <VariantB locale={locale} />;
	if (variant === 'C') return <VariantC locale={locale} />;
	return <VariantA locale={locale} />;
}

/**
 * The variant bar. Deliberately not from the vocabulary — it must not read as
 * part of the design being judged. Not gated on `import.meta.env.PROD`, for the
 * reason #60's was not: the whole file is throwaway and lives on a branch that is
 * never merged, and #52 established that this app is judged against the deployed
 * preview, where a bar that vanished in the production bundle would be useless.
 */
export function PrototypeMenuSwitcher() {
	const variant = useVariant();
	const go = (step: number) => {
		const i = VARIANTS.indexOf(variant);
		const next = VARIANTS[(i + step + VARIANTS.length) % VARIANTS.length];
		const url = new URL(window.location.href);
		url.searchParams.set('menu', next);
		window.location.href = url.toString();
	};

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const el = document.activeElement;
			if (
				el instanceof HTMLInputElement ||
				el instanceof HTMLTextAreaElement ||
				(el instanceof HTMLElement && el.isContentEditable)
			) {
				return;
			}
			if (e.key === 'ArrowLeft') go(-1);
			if (e.key === 'ArrowRight') go(1);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center lg:bottom-6">
			<div className="pointer-events-auto flex items-center gap-1 rounded-full border-2 border-chalk bg-bg px-1 py-1 shadow-lg">
				<button
					type="button"
					onClick={() => go(-1)}
					aria-label="Previous menu variant"
					className="flex size-8 items-center justify-center rounded-full text-chalk hover:bg-panel-3"
				>
					←
				</button>
				<span className="num px-1 text-[11px] whitespace-nowrap text-chalk">
					{variant} · {VARIANT_NAME[variant]}
				</span>
				<button
					type="button"
					onClick={() => go(1)}
					aria-label="Next menu variant"
					className="flex size-8 items-center justify-center rounded-full text-chalk hover:bg-panel-3"
				>
					→
				</button>
			</div>
		</div>
	);
}
