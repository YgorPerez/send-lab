// What the strip says about the queue, and — mostly — what it does not say.
//
// ADR 0008 allows exactly three visible states and spends most of its ruling on
// the first: *"nothing on screen while all is well … the always-on saved/saving
// status the old app carried is noise on a phone used mid-set."* So the
// assertion that matters here is the negative one. An indicator that is right
// about offline and right about waiting work, and also on screen when neither is
// true, has failed the decision it was built from.
//
// It is a pure function rather than three branches inside a component, for the
// usual reason in this codebase (`prescription.ts`, `screens/login.ts`): the
// decision is worth asserting and rendering is not what makes it true.
import { describe, expect, test } from 'vitest';
import { resolveSyncState } from '../src/lib/syncState.ts';

describe('nothing on screen while all is well', () => {
	test('a connection and no waiting work shows nothing at all', () => {
		expect(resolveSyncState({ online: true, sendable: 0 })).toBeNull();
	});
});

describe('the two states this ticket builds', () => {
	test('no connection is said, whatever the work', () => {
		expect(resolveSyncState({ online: false, sendable: 0 })).toBe('offline');
	});

	test('work waiting on a reachable server is said as sending', () => {
		expect(resolveSyncState({ online: true, sendable: 1 })).toBe('sending');
		expect(resolveSyncState({ online: true, sendable: 12 })).toBe('sending');
	});

	// The precedence, and the reason for it: offline is *why* nothing is being
	// sent. "Sending…" over a dead connection is a promise the device cannot keep,
	// and it is the more alarming of the two to be wrong about — the athlete
	// reads it as "it is on its way" and closes the app.
	test('a dead connection is never reported as sending', () => {
		expect(resolveSyncState({ online: false, sendable: 3 })).not.toBe('sending');
	});
});

// The ticket's first sentence: *"the athlete can tell whether the training they
// just recorded has left the device."* Offline outranking sending satisfied the
// ADR's "offline **or** queued" and not that sentence — offline with nothing
// waiting and offline with twelve rows waiting were the same chip, so logging a
// set in a basement changed nothing on screen and the one question the strip
// exists to answer went unanswered in the one place it is asked.
//
// So the combined case is said in one chip rather than left to be inferred. Still
// one indicator at one severity, which is what ADR 0008's three states are about
// — the third is *unmissable*, and this is not that.
describe('offline, with training that has not left the device', () => {
	test('says so, and is not the same state as offline and settled', () => {
		expect(resolveSyncState({ online: false, sendable: 1 })).toBe('offline-unsent');
		expect(resolveSyncState({ online: false, sendable: 0 })).toBe('offline');
	});

	// The half that makes it honest rather than decorative: it goes away. Not by
	// the connection coming back on its own — by the work draining once it has.
	test('goes back to plain offline when the work has drained', () => {
		expect(resolveSyncState({ online: false, sendable: 2 })).toBe('offline-unsent');
		expect(resolveSyncState({ online: false, sendable: 0 })).toBe('offline');
		expect(resolveSyncState({ online: true, sendable: 0 })).toBeNull();
	});
});

// The count handed in is `sendable`, not `unsynced` — the half a flush can still
// deliver. Refused work is unsynced work in its final state (`CONTEXT.md`) and no
// amount of connection brings it down, so counting it here would pin "Sending…" to
// the strip permanently: furniture, and a lie. Refused work gets the third state,
// which is not this one.
describe('refused work is not what this counts', () => {
	test('a sendable count of zero reads as settled even when work was refused', () => {
		expect(resolveSyncState({ online: true, sendable: 0 })).toBeNull();
	});
});
