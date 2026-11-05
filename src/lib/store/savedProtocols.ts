// The write half of saved protocols (#103) — one row per protocol, keyed by id.
//
// The fourth module of its kind, after `store/prefs.ts`, `store/baseline.ts` and
// `store/workingLoad.ts`, and the first that does not always wait for the
// hydrate. Their rule — wait, then update or insert — exists because they
// address a row by a key another device may already hold, and an insert over
// a key the hydrate is about to bring in throws, or invents a row that then
// beats the real one. A **duplicate** has neither problem: its key is minted
// here, fresh, so no other device can hold it and there is nothing to update.
// Inserting at once is what lets the copy appear under the athlete's finger
// offline, where the hydrate may not answer for a long time.
//
// A **delete** does wait. It names a row the athlete can see, so the row is
// already here — but a hydrate still in flight could put it back a moment
// after it went, and the athlete would watch their delete undo itself.
//
// Editing a saved protocol is #104's, and is an update by id like the delete.
import { newSavedProtocolId, type SavedProtocolId } from '$lib/ids';
import type { Protocol } from '$lib/protocol';
import type { SavedProtocol } from '$lib/types';
import { recordStore, recordSync } from './record';

/**
 * Keep a copy of a protocol as a new saved protocol, under `name`.
 *
 * The source is either a preset or another saved protocol; neither is touched.
 * `name` is the copy's default name, which the caller builds in the locale
 * (`resolveTimer`'s `copyName`) — from here on it is the athlete's.
 *
 * Resolves to the row it wrote, so the screen can point the clock at it.
 */
export async function duplicateProtocol(
	source: { name: string; protocol: Protocol },
	now: number = Date.now(),
): Promise<SavedProtocol> {
	const row: SavedProtocol = {
		id: newSavedProtocolId(),
		name: source.name,
		// A copy of the numbers, not the source's object: the collection holds
		// what it is handed, and a preset's protocol is shared by every render.
		protocol: { ...source.protocol },
		createdAt: now,
	};
	recordStore().savedProtocols.insert(row);
	return row;
}

/** Remove a saved protocol from the account, on every device. Already gone is
 *  not an error: a second tap on Delete, or a delete that arrived by sync. */
export async function deleteSavedProtocol(id: SavedProtocolId): Promise<void> {
	const sync = recordSync();
	if (sync) await sync.settled();

	const saved = recordStore().savedProtocols;
	if (saved.has(id)) saved.delete(id);
}
