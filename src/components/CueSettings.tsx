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
// (#106) is one, the flash (#107) another, and nothing above them moves.
import { Popover } from '@base-ui/react/popover';
import { SlidersHorizontal } from 'lucide-react';
import { useId, useSyncExternalStore } from 'react';
import { canSpeak, subscribeVoices } from '$lib/cues';
import * as m from '$lib/paraglide/messages';
import { COUNTDOWN_LENGTHS, type CuePrefs } from '$lib/protocol';
import type { AppLocale } from '$lib/store/locale';
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

/** Whether this device can vibrate at all. iOS Safari has no
 *  `navigator.vibrate`, and `cues.ts` stays silent there. */
const canVibrate = () =>
	typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

/**
 * The switches, in the order they are read. Message functions, not strings, so
 * each reads the locale when it renders.
 *
 * `supported` is for a delivery this device cannot make. The switch stays live
 * there rather than disabled: the preference is the account's, and an athlete on
 * an iPhone may be setting it for the Android phone they train with. What the
 * row may not do is pretend, so it says the device cannot (`unsupported`).
 * `subscribe` is for an answer that can change while the page is open: a
 * browser lists its voices only after it is first asked for them.
 *
 * The voice comes first: it carries the most when the athlete is not looking.
 */
const SWITCHES: readonly {
	field: CueSwitch;
	label: () => string;
	supported?: () => boolean;
	subscribe?: (notify: () => void) => () => void;
	unsupported?: () => string;
}[] = [
	{
		field: 'voice',
		label: m.cues_voice,
		supported: canSpeak,
		subscribe: subscribeVoices,
		unsupported: m.cues_voice_unsupported,
	},
	{
		field: 'buzz',
		label: m.cues_buzz,
		supported: canVibrate,
		unsupported: m.cues_buzz_unsupported,
	},
	// Every screen can flash, so there is nothing for it to warn about.
	{ field: 'flash', label: m.cues_flash },
];

/** Nothing about the device changes while the page is open, unless a switch
 *  says otherwise. */
const noSubscription = () => () => {};
/** The server cannot know, so it claims nothing; the client answers on
 *  hydration, without a mismatch, because `useSyncExternalStore` renders the
 *  server's answer first. */
const assumeSupported = () => true;

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
			{SWITCHES.map(({ field, label, supported, subscribe, unsupported }) => (
				<SwitchRow
					key={field}
					label={label()}
					checked={prefs[field]}
					onChange={(on) => void writePrefs({ [field]: on })}
					supported={supported}
					subscribe={subscribe}
					unsupported={unsupported}
				/>
			))}
		</div>
	);
}

/**
 * The Timer screen's way in: the screen's one action, at the right of the top
 * strip (#119, the strip's slot from #115), opening the same rows over the page.
 *
 * Discreet on purpose. The screen is the list and the clock; this is reached
 * for before Start, or with the full-screen clock closed between sets — never
 * mid-hang — so it is an icon rather than a section in the flow. In the strip
 * it is the 44px ghost square the More sheet's close is: alone on the strip's
 * right it is attached to nothing larger, which is what the vocabulary's
 * bordered-icon rule is about, and a border would sit on the strip's own
 * edges. It is a popover, so the page stays in view around it.
 *
 * `locale` is the strip's, passed rather than read, for the reason the strip
 * gives: the shell re-keys its subtree on the locale, and a label read from the
 * ambient value would keep the old language until something else re-rendered.
 *
 * Its title is an eyebrow where Settings gives the same words a section
 * heading: the popover sits under the page in rank, and the title is there to
 * name the dialog for a screen reader more than to head it.
 */
export function CueSettingsShortcut({ locale }: { locale: AppLocale }) {
	const title = m.cues_title({}, { locale });
	return (
		<Popover.Root>
			<Popover.Trigger
				render={<button type="button" aria-label={title} />}
				className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink data-[popup-open]:bg-panel-3 data-[popup-open]:text-chalk"
			>
				<SlidersHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Positioner sideOffset={6} align="end" collisionPadding={16} className="z-50">
					<Popover.Popup className="w-[min(320px,calc(100vw-32px))] rounded-lg border border-line bg-panel px-3 pt-2.5 pb-1 shadow-lg transition-[opacity,transform] duration-150 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
						<Popover.Title className="eyebrow pb-1">{title}</Popover.Title>
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
	supported = assumeSupported,
	subscribe = noSubscription,
	unsupported,
}: {
	label: string;
	checked: boolean;
	onChange: (on: boolean) => void;
	supported?: () => boolean;
	subscribe?: (notify: () => void) => () => void;
	unsupported?: () => string;
}) {
	const id = useId();
	const noteId = useId();
	const here = useSyncExternalStore(subscribe, supported, assumeSupported);
	const note = here || !unsupported ? null : unsupported();
	return (
		<div>
			<ControlRow id={id} label={label}>
				<Switch
					checked={checked}
					onCheckedChange={onChange}
					labelledBy={id}
					describedBy={note ? noteId : undefined}
				/>
			</ControlRow>
			{note ? (
				// Gold, like Settings' caveats: a warning about this device, not a stop.
				<p id={noteId} className="pb-2.5 text-[12.5px] leading-snug text-gold">
					{note}
				</p>
			) : null}
		</div>
	);
}
