// TIMER (#101).
//
// The clock outside a session: pick a protocol, run it. Nothing here is
// training — a run records no session, no set and no history — so the screen
// reads no prescription and writes nothing to the training record. What it does
// keep is the athlete's place in the protocol, as a draft on this device, under
// the same two rules as Train's (`timerSetup.ts`): it comes back paused, and only
// for the protocol it was left in.
//
// The protocols are the **presets**: every library variant that carries one,
// read-only, computed by `resolveTimer` and never stored. Saved protocols (#103)
// join them as a second list, and a Protocols | Stopwatch switch (#108) goes
// above both. Neither is here yet; the layout leaves them their place rather than
// drawing it empty.
//
// Same posture as Train, so the same two rules: the clock is sticky, because the
// list scrolls under it and Start must stay in reach; and every row is a 44px
// target, the clock's controls 48px.
import { createFileRoute } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getContent } from '$lib/content';
import { clock } from '$lib/format';
import type { ProtocolKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { type PresetGroup, type PresetRow, resolveTimer } from '$lib/screens/timer';
import { useTimerSetup } from '$lib/timerSetup';
import { CueSettingsShortcut } from '../components/CueSettings';
import { Timer } from '../components/Timer';
import { Pane, Section } from '../components/ui/primitives';
import { option } from '../components/ui/variants';

export const Route = createFileRoute('/timer')({ component: TimerScreen });

function TimerScreen() {
	const locale = getLocale();
	const screen = useMemo(() => resolveTimer(getContent(locale), locale), [locale]);
	const presets = useMemo(
		() => screen.presets.flatMap((g) => g.presets.map((p) => ({ preset: p, group: g }))),
		[screen],
	);

	// WHICH PROTOCOL THE CLOCK IS RUNNING, held by identity.
	//
	// It opens on the one the athlete left the clock in — the stored draft's scope
	// names it — so coming back to this screen finds the same clock, paused where
	// it stopped. Read once, like the draft itself; after that only a tap on a row
	// changes it, and that tap is a different protocol, which starts clean.
	const [stored] = useTimerSetup('timer');
	const [selected, setSelected] = useState<ProtocolKey | null>(
		() =>
			presets.find((p) => p.preset.key === stored?.scope)?.preset.key ??
			presets[0]?.preset.key ??
			null,
	);
	// Owned here rather than by the Timer, for the reason Train gives: picking
	// another protocol remounts the clock, and the dialog should not close with it.
	const [clockOpen, setClockOpen] = useState(false);
	const current = presets.find((p) => p.preset.key === selected) ?? null;

	return (
		// Capped, like Train: one list and one clock, and a wider list says nothing
		// more about a protocol.
		<Pane className="gap-6">
			<header className="flex items-baseline justify-between gap-2 pt-1.5">
				<h1 className="h-screen-title min-w-0">{m.nav_timer()}</h1>
				<CueSettingsShortcut />
			</header>

			{current ? (
				<div className="sticky top-[44px] z-10 -mx-3 bg-bg/95 px-3 pt-1 pb-2 backdrop-blur">
					<Timer
						key={current.preset.key}
						slot="timer"
						protocol={current.preset.protocol}
						label={`${current.group.name} · ${current.preset.name}`}
						protocolKey={current.preset.key}
						clockOpen={clockOpen}
						onClockOpenChange={setClockOpen}
						editable={false}
						openOnStart
						titled={false}
					/>
				</div>
			) : null}

			<Section label={m.timer_presets()}>
				<div className="flex flex-col gap-5">
					{screen.presets.map((g) => (
						<PresetList key={g.exercise} group={g} selected={selected} onSelect={setSelected} />
					))}
				</div>
			</Section>
		</Pane>
	);
}

/** One exercise's presets, under its name and the study the library cites. */
function PresetList({
	group,
	selected,
	onSelect,
}: {
	group: PresetGroup;
	selected: ProtocolKey | null;
	onSelect: (key: ProtocolKey) => void;
}) {
	return (
		<section className="flex flex-col gap-1.5">
			<header className="flex flex-wrap items-baseline justify-between gap-x-3">
				<h3 className="eyebrow">{group.name}</h3>
				{group.study ? (
					<a
						href={group.study.url}
						target="_blank"
						rel="noopener noreferrer"
						// 44px to the finger without 44px in the layout: the padding is
						// taken back by the margin, so a group with a study sits as close
						// to its rows as one without.
						className="-my-3.5 inline-flex items-center gap-1 py-3.5 text-[11px] text-ink-dim underline decoration-line underline-offset-2 hover:text-ink"
					>
						{group.study.title}
						<ExternalLink size={10} aria-hidden="true" />
					</a>
				) : null}
			</header>
			<div className="flex flex-col gap-1">
				{group.presets.map((p) => (
					<PresetButton
						key={p.key}
						preset={p}
						on={p.key === selected}
						onSelect={() => onSelect(p.key)}
					/>
				))}
			</div>
		</section>
	);
}

/**
 * One preset: its name, its shape, how long it runs. Choosing it points the
 * clock at it; Start is the clock's, so a stray tap on the list never starts
 * anything.
 */
function PresetButton({
	preset,
	on,
	onSelect,
}: {
	preset: PresetRow;
	on: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onSelect}
			className={option({ on, width: 'full', class: 'flex min-h-11 items-center gap-3' })}
		>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span>{preset.name}</span>
				<span className="num text-[11px] font-normal text-ink-dim">{preset.shape}</span>
			</span>
			<span className="num shrink-0 text-[12px] font-normal text-ink-dim">
				{clock(preset.total)}
			</span>
		</button>
	);
}
