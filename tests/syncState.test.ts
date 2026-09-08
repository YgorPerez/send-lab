// What the strip says about the queue, and — mostly — what it does not say.
//
// ADR 0008 allows exactly three visible states, and since #84 all three have a
// surface. It spends most of its ruling on the first: *"nothing on screen while
// all is well … the always-on saved/saving status the old app carried is noise on
// a phone used mid-set."* So the assertion that matters here is the negative one.
// An indicator that is right about offline and right about waiting work, and also
// on screen when neither is true, has failed the decision it was built from.
//
// It is a pure function rather than three branches inside a component, for the
// usual reason in this codebase (`prescription.ts`, `screens/login.ts`): the
// decision is worth asserting and rendering is not what makes it true.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { SyncStatus } from '../src/components/SyncStatus.tsx';
import { resolveSyncState, type SyncState } from '../src/lib/syncState.ts';

describe('nothing on screen while all is well', () => {
	test('a connection and no waiting work shows nothing at all', () => {
		expect(resolveSyncState({ online: true, sendable: 0, refused: false })).toBeNull();
	});
});

describe('the two states #83 built', () => {
	test('no connection is said, whatever the work', () => {
		expect(resolveSyncState({ online: false, sendable: 0, refused: false })).toBe('offline');
	});

	test('work waiting on a reachable server is said as sending', () => {
		expect(resolveSyncState({ online: true, sendable: 1, refused: false })).toBe('sending');
		expect(resolveSyncState({ online: true, sendable: 12, refused: false })).toBe('sending');
	});

	// The precedence, and the reason for it: offline is *why* nothing is being
	// sent. "Sending…" over a dead connection is a promise the device cannot keep,
	// and it is the more alarming of the two to be wrong about — the athlete
	// reads it as "it is on its way" and closes the app.
	test('a dead connection is never reported as sending', () => {
		expect(resolveSyncState({ online: false, sendable: 3, refused: false })).not.toBe('sending');
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
		expect(resolveSyncState({ online: false, sendable: 1, refused: false })).toBe('offline-unsent');
		expect(resolveSyncState({ online: false, sendable: 0, refused: false })).toBe('offline');
	});

	// The half that makes it honest rather than decorative: it goes away. Not by
	// the connection coming back on its own — by the work draining once it has.
	test('goes back to plain offline when the work has drained', () => {
		expect(resolveSyncState({ online: false, sendable: 2, refused: false })).toBe('offline-unsent');
		expect(resolveSyncState({ online: false, sendable: 0, refused: false })).toBe('offline');
		expect(resolveSyncState({ online: true, sendable: 0, refused: false })).toBeNull();
	});
});

// The count handed in is `sendable`, not `unsynced` — the half a flush can still
// deliver. Refused work is unsynced work in its final state (`CONTEXT.md`) and no
// amount of connection brings it down, so counting it here would pin "Sending…" to
// the strip permanently: furniture, and a lie. Refused work gets the third state,
// which is not this one.
describe('refused work is not what the sendable count counts', () => {
	test('a sendable count of zero reads as settled when nothing was refused', () => {
		expect(resolveSyncState({ online: true, sendable: 0, refused: false })).toBeNull();
	});
});

// ADR 0008's third state, and #84: *"an unmissable message when a write has
// permanently failed."* It is a severity above the other two rather than a fourth
// thing beside them, and these are the three properties that follow from that.
describe('work the server has refused', () => {
	// The whole hazard of a refusal is that it arrives as a 200 and has no other
	// symptom, so the state has to exist even when every other reading says the
	// device is healthy — which, with the work already moved out of the replay, is
	// exactly what they say.
	test('is said on a device that otherwise looks perfectly healthy', () => {
		expect(resolveSyncState({ online: true, sendable: 0, refused: true })).toBe('refused-work');
	});

	// The acceptance criterion, and the confusion #82 fixed on the sign-out path:
	// refused work is the one kind a signal does not fix, so a reconnect must not
	// take the message away. Nothing in the reading can.
	test('does not clear on reconnect, or on the rest of the work draining', () => {
		expect(resolveSyncState({ online: false, sendable: 4, refused: true })).toBe('refused-work');
		expect(resolveSyncState({ online: true, sendable: 4, refused: true })).toBe('refused-work');
		expect(resolveSyncState({ online: true, sendable: 0, refused: true })).toBe('refused-work');
	});

	// It outranks both of #83's states, which is what "the same slot at a different
	// weight" costs: while the refusal stands, the strip is not also reporting the
	// connection. That is the ADR's own order — an indicator yields to an
	// unmissable message — and the alternative is two tokens competing in one slot
	// on a 360px phone.
	test('outranks offline and sending, so one slot says one thing', () => {
		for (const online of [true, false]) {
			for (const sendable of [0, 1, 12]) {
				expect(resolveSyncState({ online, sendable, refused: true })).toBe('refused-work');
			}
		}
	});
});

// AND WHAT THE STRIP ACTUALLY RENDERS.
//
// The rule above needs no DOM and the file says so. This is a different claim:
// that each state reaches the athlete in their own language, and that the third
// one is not the chip the other three are. It is assertable here only because
// #84 made `SyncStatus` a function of its state — the reading moved up to
// `AppShell`, which is the shell and cannot be rendered without a router.
//
// The browser gates cannot cover this. `check:contrast` and `check:motion` walk
// real routes, and no route ever has refused work on it, so the notice is invisible
// to both — the numbers behind it (6.44:1 on the fill, two lines at 360) were
// measured by driving a real refusal through `/api/state` and belong to the commit
// that made them. What belongs here is that the words arrive at all.
describe('what the strip renders for each state', () => {
	const LABELS: Record<Exclude<SyncState, null>, { 'en-US': string; 'pt-BR': string }> = {
		'refused-work': {
			'en-US': 'The server refused some training. It will never be sent.',
			'pt-BR': 'O servidor recusou parte do treino. Ela nunca será enviada.',
		},
		offline: { 'en-US': 'Offline', 'pt-BR': 'Offline' },
		'offline-unsent': { 'en-US': 'Offline · not sent', 'pt-BR': 'Offline · não enviado' },
		sending: { 'en-US': 'Sending…', 'pt-BR': 'Enviando…' },
	};

	function strip(state: SyncState, locale: 'en-US' | 'pt-BR'): string {
		return renderToString(createElement(SyncStatus, { state, locale }));
	}

	for (const locale of ['en-US', 'pt-BR'] as const) {
		test(`${locale}: every state says its own words`, () => {
			for (const [state, label] of Object.entries(LABELS)) {
				expect(strip(state as SyncState, locale)).toContain(label[locale]);
			}
		});
	}

	// The first of ADR 0008's three states, on the surface rather than in the rule:
	// the region is there — a live region inserted with its content is one the
	// screen reader was not watching — and it says nothing at all.
	test('the settled state renders the region and no words', () => {
		const html = strip(null, 'en-US');
		expect(html).toContain('role="status"');
		expect(html.replace(/<[^>]*>/g, '').trim()).toBe('');
	});

	// The third state is not the chip the other three are, and the escalation is
	// the whole of #84: same slot, different weight. So it carries the accent fill
	// and it does not carry the chip's 10px mono token.
	test('refused work is a filled notice, not a chip', () => {
		const notice = strip('refused-work', 'en-US');
		expect(notice, 'the notice lost the accent fill').toContain('bg-flag');
		expect(notice, 'the notice is announced as politely as the chip it outranks').toContain(
			'aria-live="assertive"',
		);
		expect(notice, 'the notice is a chip after all').not.toContain('font-mono');

		for (const state of ['offline', 'offline-unsent', 'sending'] as const) {
			const chip = strip(state, 'en-US');
			expect(chip, `${state} is not a chip`).toContain('font-mono');
			expect(chip, `${state} took the accent fill`).not.toContain('bg-flag');
		}
	});
});
