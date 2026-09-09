// "Offline" / "Sending…" / "The server refused some training." — what the strip
// says about work that has not left the device.
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
// changes. The one exception is the refusal below, which is not a token.
//
// AND WHY ONE OF THE THREE IS NOT A CHIP
// ---------------------------------------
// ADR 0008's states are three *severities*: silent, an indicator, and "an
// unmissable message when a write has permanently failed". #84 built the third,
// and it is escalated out of this slot rather than given a second surface beside
// it — the same place at a different weight. A refusal therefore takes the
// strip's whole left side: the notice is a filled `--flag` bar carrying a real
// sentence — the app's one other use of the accent fill, which is otherwise the
// single `primary` button a screen gets — and the wordmark stands down for it
// (`AppShell`), because the strip
// has one voice at a time and the app introducing itself is the less important
// one. A 10px token would not have been the third severity; the vocabulary doc
// said so before this was built ("its third is *unmissable*, and a chip is not
// that"), and at 360px a token beside the wordmark has ~138px, which is not a
// sentence in either locale.
//
// The escalation is why the notice never appears *with* a chip:
// `resolveSyncState` returns one state and refused work outranks the other two.
// The price is recorded there — while refused work stands the strip is not also
// reporting the connection.
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
// render**, which it does by construction rather than by care: all three readings
// are `useSyncExternalStore` with a server snapshot that means "all is well"
// (`online: true`, no work waiting, nothing refused), and React uses those same
// snapshots for the render that hydrates the baked markup. The live values land in
// the effect after it. That is also what keeps the wordmark in the baked shell:
// nothing is refused in the artefact, so nothing has stood down in it.
// `UpdatePrompt` reaches the same place by a different route, and for the same
// reason.

import { useOnline } from '$lib/online';
import * as m from '$lib/paraglide/messages';
import type { AppLocale } from '$lib/store/locale';
import { useRefusedWork, useSendableWork } from '$lib/store/record';
import { resolveSyncState, type SyncState } from '$lib/syncState';
import { chip } from './ui/variants';

/**
 * What the strip has to say right now, live.
 *
 * Read by `AppShell` and handed back down, rather than read here: the wordmark
 * yields to the refusal notice, so the strip's left side has two things to decide
 * from one answer and asking twice is two subscriptions to the same store for one
 * value.
 *
 * All three readings render "all is well" on the server and on the first client
 * render, which is not care but construction — see THE SHELL CONSTRAINT above.
 */
export function useSyncState(): SyncState {
	const online = useOnline();
	const sendable = useSendableWork();
	const refused = useRefusedWork();
	return resolveSyncState({ online, sendable, refused });
}

/**
 * Each state's whole appearance, in one place.
 *
 * One map rather than a tone lookup beside a label ternary, because the two were
 * two dispatches over the same three-value type and they would drift the moment
 * the third state lands: a state added to one and forgotten in the other is a
 * chip with the right words in the wrong colour, which no test here would catch.
 *
 * Gold for offline — a fact about the device the athlete may want to act on, and
 * the tone the two pages that used to say it used. Neutral for sending: it is the
 * app doing its job, and a warning colour on a healthy write teaches the athlete
 * to ignore the one that is not.
 *
 * The locale is passed rather than read, for `UpdatePrompt`'s reason: `m.*()`
 * resolves the locale at call time, and the strip renders with the *boot* locale
 * until the app has hydrated (`__root.tsx`). Reading the ambient one here would
 * make this the single element in the strip in the other language.
 */
const SHOWN: Record<
	Exclude<SyncState, null | 'refused-work'>,
	{ tone: 'warn' | 'neutral'; label: (locale: AppLocale) => string }
> = {
	offline: { tone: 'warn', label: (locale) => m.sync_offline({}, { locale }) },
	// Gold too, and deliberately the same weight as plain offline: it is the same
	// fact with one more thing known about it, not an escalation. The escalation
	// in ADR 0008 is the refused-write message, which is unmissable and is not a
	// chip.
	'offline-unsent': { tone: 'warn', label: (locale) => m.sync_offline_unsent({}, { locale }) },
	sending: { tone: 'neutral', label: (locale) => m.sync_sending({}, { locale }) },
};

export function SyncStatus({ state, locale }: { state: SyncState; locale: AppLocale }) {
	return (
		// The region is here even when it says nothing, and that is the point of it:
		// a live region inserted at the same moment its content appears is one
		// assistive technology was not watching, and the announcement is missed. So
		// the element outlives the state, and the empty case is an empty `<span>`
		// rather than a `null` return.
		//
		// `flex-1` is for the refusal, which needs the width a sentence takes. It
		// costs the other three states nothing: the group is anchored left, so a
		// region that is full-width and empty looks exactly like one that is
		// zero-width and empty, and — measured — the chip still lands exactly one
		// `gap-2` from the wordmark whether the region was empty a moment ago or not.
		//
		// And the politeness escalates with the severity, rather than the element
		// being swapped for a louder one: `role="status"` is polite, which is right
		// for a chip that comes and goes, and ADR 0008's third state is
		// *unmissable*, so it is announced assertively. Changing the attribute on
		// the region that is already there is what keeps the escalation from costing
		// the announcement, for the same reason the region outlives the state.
		<span
			role="status"
			aria-live={state === 'refused-work' ? 'assertive' : 'polite'}
			className="min-w-0 flex-1"
		>
			{state === null ? null : state === 'refused-work' ? (
				<RefusedWork locale={locale} />
			) : (
				<span className={chip({ tone: SHOWN[state].tone })}>{SHOWN[state].label(locale)}</span>
			)}
		</span>
	);
}

/**
 * The third severity: a filled bar, a whole sentence, and no way to dismiss it.
 *
 * **Filled rather than outlined** is the weight step, and it is the app's second
 * use of the accent fill — `button`'s `primary` is otherwise the only filled
 * vermilion a screen gets, one of them. Spending it on the chrome is deliberate:
 * this is the one thing in the app that outranks whatever the athlete came to the
 * screen to do. What is reused is the *measured pair* rather than the recipe —
 * dark ink on the vermilion, not white, because white measures 3.11:1 on `--flag`
 * and the ground measures 6.44:1 (`variants.ts` carries the full note) — since
 * `button` owns a control's shape and this is not a control.
 *
 * **It names the server, and it never says "signal".** The whole hazard of
 * refused work is that it arrives as a 200 with no other symptom, and the failure
 * #82 fixed on the sign-out path was copy that promised a retry for work that was
 * never going to be sent. So: *the server refused*, and *never*.
 *
 * **It does not name what was refused**, which is #84's declared non-goal:
 * refused work is identified by collection and row key, and mapping those to
 * "Thursday's session" is its own ticket. Settings keeps the detail it can
 * already give (`set_refused_note`).
 *
 * Not a button. It could reasonably link to Settings, and it deliberately does
 * not: a control in the shell is a control on every screen, and there is nothing
 * on the other end of it the athlete can do about refused work yet.
 */
function RefusedWork({ locale }: { locale: AppLocale }) {
	return (
		<span
			// `block`, so a sentence that does not fit wraps instead of overflowing:
			// at 360px this has ~214px and both locales run to two lines, which the
			// 44px strip has room for. `text-bg` is the measured pair, not a
			// stylistic choice.
			className="block rounded-md border border-flag bg-flag px-2 py-0.5 text-[11.5px] leading-[1.25] font-semibold text-bg"
		>
			{m.sync_refused_work({}, { locale })}
		</span>
	);
}
