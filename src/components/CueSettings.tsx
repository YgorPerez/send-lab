// HOW THE CLOCK'S CUES REACH THE ATHLETE (#105).
//
// One component, mounted twice: in Settings, where the athlete looks for it
// later, and behind the Timer screen's header control, where they change it
// between sets. Both read and write the same preferences row, so the two can
// never disagree, and the planner reads that row on the next cue — a change made
// mid-run is heard on the next beat, not on the next session.
//
// WHAT IT OWNS
// ------------
// Which cue preferences exist, in what order, and how each is asked: the
// countdown is a choice of three lengths (`COUNTDOWN_LENGTHS`), and every other
// preference is a switch. The rows are `ControlRow`s; the surface is the caller's,
// because Settings puts them on a card and the popover already is one.
//
// ADDING A CUE PREFERENCE
// -----------------------
// A switch is one entry in `SWITCHES` once its field is on `CuePrefs`: the voice
// (#106) and the flash (#107) are each a line there, and nothing above them moves.
import { Popover } from '@base-ui/react/popover';
import { SlidersHorizontal } from 'lucide-react';
import { useId } from 'react';
import * as m from '$lib/paraglide/messages';
import { COUNTDOWN_LENGTHS, type CuePrefs } from '$lib/protocol';
import { writePrefs } from '$lib/store/prefs';
import { usePrefs } from '$lib/store/record';
import { cn } from '$lib/utils';
import { ControlRow } from './ui/primitives';
import { Segmented } from './ui/Segmented';
import { Switch } from './ui/Switch';

/** The cue preferences that are on or off. Derived from `CuePrefs`, so a
 *  switch can only be offered for a field the planner actually reads. */
type CueSwitch = {
	[K in keyof CuePrefs]: CuePrefs[K] extends boolean ? K : never;
}[keyof CuePrefs];

/** The switches, in the order they are read. Message functions, not strings,
 *  so each reads the locale when it renders. */
const SWITCHES: readonly { field: CueSwitch; label: () => string }[] = [
	{ field: 'buzz', label: m.cues_buzz },
];

/** The lengths as the athlete reads them. `s` is the SI symbol and the same in
 *  both locales, as it is in a protocol's shape (`7s/3s`). */
const LENGTHS = COUNTDOWN_LENGTHS.map((n) => ({ id: n, label: `${n}s` }));

export function CueSettings({ className }: { className?: string }) {
	const prefs = usePrefs();
	const countdownId = useId();

	return (
		<div className={cn('flex flex-col divide-y divide-line-soft', className)}>
			<ControlRow id={countdownId} label={m.cues_countdown()}>
				<Segmented
					value={prefs.countdown}
					options={LENGTHS}
					onChange={(countdown) => void writePrefs({ countdown })}
					labelledBy={countdownId}
					className="num flex w-[156px] shrink-0 gap-1.5"
				/>
			</ControlRow>
			{SWITCHES.map(({ field, label }) => (
				<SwitchRow
					key={field}
					label={label()}
					checked={prefs[field]}
					onChange={(on) => void writePrefs({ [field]: on })}
				/>
			))}
		</div>
	);
}

/**
 * The Timer screen's way in: one control at the right of its header, opening the
 * same rows over the page.
 *
 * Discreet on purpose. The screen is the clock and the list; this is reached
 * for between sets, never mid-hang, so it is an icon in the header rather than
 * a section in the flow. It still carries its own border and its 44px — an icon
 * without them does not read as a control (the vocabulary's measured rule) —
 * and a popover rather than a dialog, as the menu is, so the protocol the
 * athlete is about to run stays visible behind it.
 */
export function CueSettingsShortcut() {
	return (
		<Popover.Root>
			<Popover.Trigger
				render={<button type="button" aria-label={m.cues_title()} />}
				className="flex min-h-11 min-w-11 shrink-0 items-center justify-center self-center rounded-md border border-line text-ink-faint transition-colors hover:text-ink data-[popup-open]:bg-panel-3 data-[popup-open]:text-chalk"
			>
				<SlidersHorizontal size={16} strokeWidth={1.8} />
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Positioner sideOffset={6} align="end" collisionPadding={16} className="z-50">
					<Popover.Popup className="w-[min(320px,calc(100vw-32px))] rounded-lg border border-line bg-panel px-3 pt-2.5 pb-1 shadow-lg transition-[opacity,transform] duration-150 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
						<Popover.Title className="eyebrow pb-1">{m.cues_title()}</Popover.Title>
						<CueSettings />
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		</Popover.Root>
	);
}

function SwitchRow({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (on: boolean) => void;
}) {
	const id = useId();
	return (
		<ControlRow id={id} label={label}>
			<Switch checked={checked} onCheckedChange={onChange} labelledBy={id} />
		</ControlRow>
	);
}
