// "Offline" / "Saving…" — what the strip says about work that has not left the
// device.
//
// WHY IT IS IN THE STRIP
// ---------------------
// ADR 0008 requires the athlete to be able to tell, *from any screen*, that
// training they just recorded is still only on this device. Before this it was
// visible on two — Settings and sign-in — neither of which anyone opens mid-set.
// That sentence is also why offline has two labels rather than one: see
// `lib/syncState.ts`, which is where the rule lives.
// The strip is the only surface the app owns on every screen, and it already
// carries the two things that belong to the app rather than to a page (the
// wordmark and the locale switch); this is a third of that kind.
//
// It sits beside the wordmark rather than beside the menu, and that is a layout
// decision as much as a semantic one. The strip is `justify-between`, so the left
// group is anchored left and the right group right: a token appearing and
// disappearing on the left moves nothing, where the same token beside the locale
// switch would slide two controls sideways every time a task is ticked. #83's
// acceptance criterion is exactly that the strip does not shift as the state
// changes.
//
// AND WHY IT IS SO OFTEN NOTHING
// ------------------------------
// The ADR's first state is *nothing on screen while all is well*, and it is
// explicit that the always-on saved/saving status the old app carried is "noise
// on a phone used mid-set". The rule lives in `lib/syncState.ts`; what this file
// adds is the rendering, and the one thing it must not do is find a reason to be
// visible more often than that rule says.
//
// THE SHELL CONSTRAINT
// --------------------
// This renders inside `AppShell`, which the build bakes into `/_shell.html` —
// one artefact, user-independent, precached by the service worker (ADR 0006). So
// it must render **nothing on the server and nothing on the first client
// render**, which it does by construction rather than by care: both hooks are
// `useSyncExternalStore` with a server snapshot that means "all is well"
// (`online: true`, no work), and React uses those same snapshots for the render
// that hydrates the baked markup. The live values land in the effect after it.
// `UpdatePrompt` reaches the same place by a different route, and for the same
// reason.

import { useOnline } from '$lib/online';
import * as m from '$lib/paraglide/messages';
import type { AppLocale } from '$lib/store/locale';
import { useSendableWork } from '$lib/store/record';
import { resolveSyncState, type SyncState } from '$lib/syncState';
import { chip } from './ui/variants';

/**
 * Each state's whole appearance, in one place.
 *
 * One map rather than a tone lookup beside a label ternary, because the two were
 * two dispatches over the same three-value type and they would drift the moment
 * the third state lands: a state added to one and forgotten in the other is a
 * chip with the right words in the wrong colour, which no test here would catch.
 *
 * Gold for offline — a fact about the device the athlete may want to act on, and
 * the tone the two pages that used to say it used. Neutral for saving: it is the
 * app doing its job, and a warning colour on a healthy write teaches the athlete
 * to ignore the one that is not.
 *
 * The locale is passed rather than read, for `UpdatePrompt`'s reason: `m.*()`
 * resolves the locale at call time, and the strip renders with the *boot* locale
 * until the app has hydrated (`__root.tsx`). Reading the ambient one here would
 * make this the single element in the strip in the other language.
 */
const SHOWN: Record<
	Exclude<SyncState, null>,
	{ tone: 'warn' | 'neutral'; label: (locale: AppLocale) => string }
> = {
	offline: { tone: 'warn', label: (locale) => m.sync_offline({}, { locale }) },
	// Gold too, and deliberately the same weight as plain offline: it is the same
	// fact with one more thing known about it, not an escalation. The escalation
	// in ADR 0008 is the refused-write message, which is unmissable and is not a
	// chip.
	'offline-unsent': { tone: 'warn', label: (locale) => m.sync_offline_unsent({}, { locale }) },
	saving: { tone: 'neutral', label: (locale) => m.sync_saving({}, { locale }) },
};

export function SyncStatus({ locale }: { locale: AppLocale }) {
	const online = useOnline();
	const sendable = useSendableWork();
	const state = resolveSyncState({ online, sendable });

	return (
		// The region is here even when it says nothing, and that is the point of it:
		// a live region inserted at the same moment its content appears is one
		// assistive technology was not watching, and the announcement is missed. So
		// the element outlives the state, and the empty case is an empty `<span>`
		// rather than a `null` return. Empty it has no padding, no border and no
		// text, so it occupies no width — measured, the chip lands exactly one
		// `gap-2` from the wordmark whether the region was empty a moment ago or
		// not, so the always-present region costs the strip nothing.
		<span role="status">
			{state === null ? null : (
				<span className={chip({ tone: SHOWN[state].tone })}>{SHOWN[state].label(locale)}</span>
			)}
		</span>
	);
}
