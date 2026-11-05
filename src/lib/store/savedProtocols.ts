// The write half of saved protocols (#103) — one row per protocol, keyed by id.
//
// The fourth module of its kind, after `store/prefs.ts`, `store/baseline.ts` and
// `store/workingLoad.ts`, and the first that does not always wait for the
// hydrate. Their rule — wait, then update or insert — exists because they
// address a row by a key another device may already hold, and an insert over
// a key the hydrate is about to bring in throws, or invents a row that then
// beats the real one. A **new row** — made from scratch, or a duplicate — has
// neither problem: its key is minted here, fresh, so no other device can hold
// it and there is nothing to update. Inserting at once is what lets it appear
// under the athlete's finger offline, where the hydrate may not answer for a
// long time.
//
// A **delete** and an **edit** (#104) do wait. Each names a row the athlete can
// see, so the row is already here — but a hydrate still in flight could put the
// old row back a moment after it changed, and the athlete would watch their
// delete or their edit undo itself.
import { newSavedProtocolId, type SavedProtocolId } from '$lib/ids';
import type { NamedProtocol, SavedProtocol } from '$lib/types';
import { recordStore, recordSync } from './record';

/**
 * Keep a new saved protocol: made from scratch in the editor (#104), or a copy
 * of a preset or of another saved protocol (#103). Listed last, since the list
 * is in the order protocols were made. Resolves to the row it wrote, so the
 * screen can point the clock at it.
 *
 * Made from scratch, the protocol has been read by the editor
 * (`readProtocolForm`) — named, whole, runnable. Copied, its source is left
 * untouched and `name` is the copy's default, which the caller builds in the
 * locale (`resolveTimer`'s `copyName`); from here on it is the athlete's.
 */
export async function createSavedProtocol(
	named: NamedProtocol,
	now: number = Date.now(),
): Promise<SavedProtocol> {
	const row: SavedProtocol = {
		id: newSavedProtocolId(),
		name: named.name,
		// A copy of the numbers, not the caller's object: the collection holds
		// what it is handed, and a preset's protocol is shared by every render.
		protocol: { ...named.protocol },
		createdAt: now,
	};
	recordStore().savedProtocols.insert(row);
	return row;
}

/**
 * Change a saved protocol's name and numbers (#104). Its id and its place in
 * the list stay: the id is what it is, and the list is in the order protocols
 * were made, not edited.
 *
 * One that is gone by the time the account answers — deleted on another
 * device while this one had the editor open — stays gone. Writing it back
 * would undo a delete the athlete made on purpose.
 */
export async function updateSavedProtocol(
	id: SavedProtocolId,
	named: NamedProtocol,
): Promise<void> {
	const sync = recordSync();
	if (sync) await sync.settled();

	const saved = recordStore().savedProtocols;
	if (!saved.has(id)) return;
	saved.update(id, (row) => {
		row.name = named.name;
		row.protocol = { ...named.protocol };
	});
}

/** Remove a saved protocol from the account, on every device. Already gone is
 *  not an error: a second tap on Delete, or a delete that arrived by sync. */
export async function deleteSavedProtocol(id: SavedProtocolId): Promise<void> {
	const sync = recordSync();
	if (sync) await sync.settled();

	const saved = recordStore().savedProtocols;
	if (saved.has(id)) saved.delete(id);
}
