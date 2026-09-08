// Which of ADR 0008's visible states the app is in, if any.
//
// The ADR allows three, and the ruling that shapes this module is the first of
// them: **nothing on screen while all is well.** The old app carried an always-on
// saved/saving status and the ADR calls it "noise on a phone used mid-set", so
// `null` is not an edge case here — it is the answer almost all of the time, and
// anything that made this function return a state more often than it has to would
// be turning the indicator back into furniture.
//
// The third state — an unmissable message when a write has been **refused** — is
// deliberately not one of the answers. It is not a smaller or larger version of
// "saving": refused work can never be sent, so it needs a message the athlete has
// to act on rather than a token in the strip, and it must not be counted as work
// in flight. See `sendable` below.
//
// Pure, and separated from the component that renders it, for the reason
// `prescription.ts` and `screens/login.ts` give: a decision worth asserting is
// worth asserting without a DOM.

/**
 * What the strip has to say, or `null` for the state that says nothing.
 *
 * `'saving'` is the athlete-facing word (`sync_saving`), not a claim that a
 * request is in flight this instant: between the push and the debounce firing
 * nothing has been sent yet, and that stretch is squarely part of what the
 * athlete means by "is it saved".
 */
export type SyncState = 'offline' | 'offline-unsent' | 'saving' | null;

export interface SyncReading {
	/** `lib/online.ts` — the browser's own answer, optimistic by nature. */
	readonly online: boolean;
	/**
	 * Unsynced work a flush could still deliver — `RecordSync.sendable()`.
	 *
	 * **Not `unsynced()`**, which includes refused work. Refused work is unsynced
	 * work in its final state (`CONTEXT.md`) and no connection ever brings that
	 * count down, so a strip counting it would say "Saving…" forever: permanent
	 * furniture, and a false promise besides.
	 */
	readonly sendable: number;
}

/**
 * The state to show, given what the device knows.
 *
 * **A dead connection is never reported as saving.** "Saving…" over no signal
 * reads as *it is on its way*, which is the reading that gets an athlete to close
 * the app on work that has not left the device.
 *
 * **But offline does not simply outrank waiting work, because that answers the
 * wrong question.** Both are true at once — work waiting on a device with no
 * signal is the ordinary case in a gym basement — and collapsing them made
 * offline-with-nothing-waiting and offline-with-twelve-rows-waiting the same
 * chip. #83 exists to let the athlete tell *"whether the training they just
 * recorded has left the device"*, and under that collapse logging a set in a
 * basement changed nothing on screen: the one question the strip is for, asked in
 * the one place it matters, and unanswered.
 *
 * So the combined case is its own answer. It is still **one** indicator at one
 * severity, which is what ADR 0008's three states are about — the third of them
 * is *unmissable*, and this is not that. And it is still not furniture: it needs
 * both a dead connection and work that has not gone, and it stands down to plain
 * `'offline'` the moment the work drains.
 */
export function resolveSyncState({ online, sendable }: SyncReading): SyncState {
	if (!online) return sendable > 0 ? 'offline-unsent' : 'offline';
	return sendable > 0 ? 'saving' : null;
}
