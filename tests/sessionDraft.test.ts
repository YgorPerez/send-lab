// What a half-logged session comes back as — #59.
//
// The Train screen holds the athlete's working copy: the sets as they are being
// filled in, the note, the duration. Until now all of it lived in `useState` and
// a reload in the gym threw the lot away — and on Android a reload is one
// accidental pull away (#54).
//
// The scope is the **slot**, not the day: a slot is one weekday of one training
// week, which is the unit the screen resolves against. Restoring last Thursday's
// half-filled sets onto this Thursday would be the app inventing training that
// did not happen, which is worse by a long way than losing a draft.
import { describe, expect, it } from 'vitest';
import { scoped } from '../src/lib/ephemeral.ts';
import { asWeekdayKey, asWeekId, slotKey } from '../src/lib/ids.ts';
import type { PrescribedTask } from '../src/lib/screens/train.ts';
import { restoredSession, type SessionDraft } from '../src/lib/sessionDraft.ts';

const SLOT = slotKey(asWeekId(1), asWeekdayKey('Thu'));
const OTHER = slotKey(asWeekId(2), asWeekdayKey('Thu'));

/** A task with only the two fields anything here reads.
 *
 *  `PrescribedTask` has eleven, several nested, and `isDraft` deliberately checks
 *  the two the screen *dereferences* — building the other nine would be asserting
 *  against TypeScript rather than against the shape check. */
const task = (key: string, sets: object[]) => ({ key, sets }) as unknown as PrescribedTask;

/** What the resolver produced for today — the athlete's starting point. */
const FRESH: SessionDraft = {
	tasks: [task('w1-Thu:pull', [{ done: false }])],
	note: '',
	duration: '',
};

/** Two sets in, with a note. */
const WORKED: SessionDraft = {
	tasks: [task('w1-Thu:pull', [{ done: true, loadKg: 24 }])],
	note: 'left ring finger tight',
	duration: '38',
};

describe('reopening a session in progress', () => {
	it('gives back the working copy for the same slot', () => {
		expect(restoredSession(scoped(SLOT, WORKED), SLOT, FRESH)).toEqual(WORKED);
	});

	it('ignores a draft from another slot', () => {
		// Last Thursday's sets are not this Thursday's. Restoring them would be
		// the app inventing training.
		expect(restoredSession(scoped(OTHER, WORKED), SLOT, FRESH)).toEqual(FRESH);
	});

	it('starts fresh when nothing is stored', () => {
		expect(restoredSession(undefined, SLOT, FRESH)).toEqual(FRESH);
	});

	it('keeps a draft whose fields are empty but real', () => {
		// An athlete who cleared the note and logged nothing yet still has a draft:
		// the sets they have *unticked* are a deliberate state. A truthiness test
		// anywhere in here would silently restore the resolved copy over it.
		const emptied: SessionDraft = { tasks: [], note: '', duration: '' };
		expect(restoredSession(scoped(SLOT, emptied), SLOT, FRESH)).toEqual(emptied);
	});

	it('falls back when the stored draft is not the right shape', () => {
		// An older build wrote it, or a hand edit did. `:v1` in the key makes a
		// deliberate shape change cheap; this is the accidental case, and the
		// screen must not render `undefined.map`.
		expect(restoredSession(scoped(SLOT, { tasks: 'nope' } as never), SLOT, FRESH)).toEqual(FRESH);
		expect(restoredSession(scoped(SLOT, null as never), SLOT, FRESH)).toEqual(FRESH);
		expect(restoredSession(scoped(SLOT, { ...WORKED, note: 7 } as never), SLOT, FRESH)).toEqual(
			FRESH,
		);
	});

	it('refuses a task list holding something that is not a task', () => {
		// The rows are read as `t.key` and `t.sets` all over the screen. One bad
		// entry is a crash on render, and the draft is not worth that.
		expect(
			restoredSession(scoped(SLOT, { ...WORKED, tasks: [{ nope: 1 }] } as never), SLOT, FRESH),
		).toEqual(FRESH);
	});
});
