// The write half of the working load — one row, keyed exercise and variant.
//
// The third module of its kind, after `store/prefs.ts` and `store/baseline.ts`,
// and it follows their rule for their reason: **wait for the hydrate, then
// update or insert.** With no row yet there is nothing to update, and a
// collection throws on an `insert` over a key it already holds — so "has this
// exercise been answered for" has to be asked of the hydrated store rather than
// of an empty one. Ask it too early and the athlete is asked a question they
// have already answered on another device, and their answer is then overwritten
// by the one they gave under duress at the hangboard.
//
// It is a plain upsert and not a patch: a working load is one number and one
// provenance, and re-answering replaces both. Answering `usual` over a `tested`
// must take the *grade* down with the number, or the record would claim a
// self-report was measured.
//
// It takes the whole row rather than its parts, and that is what lets the screen
// apply the athlete's answer to the card **immediately** while this trails
// behind: the two are then the same row, `at` included, rather than two rows a
// few milliseconds apart that a merge would have to order.
import { type LoadKey, loadKey } from '$lib/ids';
import type { WorkingLoad } from '$lib/types';
import { recordStore, recordSync } from './record';

/**
 * Record what an exercise is trained at, at this variant.
 *
 * Resolves once the row is in the store, and **nothing on screen is waiting for
 * it**. Train holds its tasks as local state frozen at mount so the targets
 * cannot move mid-session, so it applies the athlete's answer to the card itself
 * (`withWorkingLoad`) and calls this behind. What the row buys is the *next*
 * session, on this device and on any other.
 *
 * `load.at` is the moment the athlete answered, which is the only clock the
 * merge rule can order two devices by (`server/record/store.ts`) — so it is the
 * caller's to stamp, at the tap, rather than this module's to stamp once the
 * hydrate it waits for has come back.
 */
export async function writeWorkingLoad(load: WorkingLoad): Promise<void> {
	const sync = recordSync();
	// Signed out there is nothing to wait for: the row is local-only, and there is
	// no server copy for a local insert to beat.
	if (sync) await sync.settled();

	const key: LoadKey = loadKey(load.exercise, load.variant);
	const loads = recordStore().workingLoads;
	if (loads.has(key)) {
		loads.update(key, (draft) => {
			Object.assign(draft, load);
		});
	} else {
		loads.insert(load);
	}
}
