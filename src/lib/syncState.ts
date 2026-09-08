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
// now one of the answers, and it is the one that breaks the shape of the other
// two: they are facts about work in flight, and **refused work** is not in flight.
// It is spelled `'refused-work'` in both words, which `CONTEXT.md` requires of
// that term and ADR 0014 binds to the name: `screens/login.ts` already has a bare
// `'refused'` and it means a refused *sign-in*, which is a different event.
// It is therefore neither a smaller nor a larger version of "sending", it is not
// counted as work waiting (see `sendable` below), and it is the only state here
// that nothing in the reading can take away.
//
// Pure, and separated from the component that renders it, for the reason
// `prescription.ts` and `screens/login.ts` give: a decision worth asserting is
// worth asserting without a DOM.

/**
 * What the strip has to say, or `null` for the state that says nothing.
 *
 * `'sending'` is the athlete-facing word (`sync_sending`), not a claim that a
 * request is in flight this instant: between the push and the debounce firing
 * nothing has been sent yet, and that stretch is squarely part of what the
 * athlete means by "is it saved".
 */
export type SyncState = 'refused-work' | 'offline' | 'offline-unsent' | 'sending' | null;

export interface SyncReading {
	/** `lib/online.ts` — the browser's own answer, optimistic by nature. */
	readonly online: boolean;
	/**
	 * Unsynced work a flush could still deliver — `RecordSync.sendable()`.
	 *
	 * **Not `unsynced()`**, which includes refused work. Refused work is unsynced
	 * work in its final state (`CONTEXT.md`) and no connection ever brings that
	 * count down, so a strip counting it would say "Sending…" forever: permanent
	 * furniture, and a false promise besides.
	 */
	readonly sendable: number;
	/**
	 * Whether the server has **refused** any of this device's work —
	 * `RecordSync.refused()`, through `useRefusedWork`.
	 *
	 * A boolean rather than the count, because nothing above this counts them:
	 * refused work is identified by collection and row key, which mean nothing to
	 * the athlete, and mapping those to domain nouns ("Thursday's session") is
	 * #84's declared non-goal. What the strip can say is *that* it happened.
	 */
	readonly refused: boolean;
}

/**
 * The state to show, given what the device knows.
 *
 * **A dead connection is never reported as sending.** "Sending…" over no signal
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
 *
 * **Refused work outranks all three, and nothing in the reading takes it back.**
 * That is the ADR's own order of severities — an indicator yields to an
 * unmissable message — and it is what "the same slot at a different weight"
 * costs (#84): while refused work stands, the strip is not also reporting the
 * connection. The alternative was two tokens competing for one slot on a 360px
 * phone, which is the *second parallel surface* #84 ruled out in its first
 * paragraph.
 *
 * The consequence is worth stating rather than discovering: while refused work
 * stands, this function does not answer `'offline'` or `'sending'` at all. There
 * is exactly one thing that ends it, and it is not something the athlete can be
 * told to do — `unsynced.ts`'s `add()` replaces an entry when the *same row* is
 * written again, dropping its refusal, because a refusal is a fact about content
 * and not a ban on the key. So the notice lasts until the athlete happens to edit
 * that one row, which for an appended session is never.
 *
 * That is the right trade only because refused work is the app's most serious
 * state and essentially never happens — and it is the strongest argument for the
 * ticket that maps refused work back to a domain noun and lets the athlete deal
 * with it deliberately.
 */
export function resolveSyncState({ online, sendable, refused }: SyncReading): SyncState {
	// First, and unconditionally. Everything below this line is a fact about work
	// that is still going to arrive.
	if (refused) return 'refused-work';
	if (!online) return sendable > 0 ? 'offline-unsent' : 'offline';
	return sendable > 0 ? 'sending' : null;
}
