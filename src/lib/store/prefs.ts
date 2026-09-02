// The write half of preferences.
//
// One row, every field, and one rule for reaching it: **the device half is
// immediate; the account half waits for the hydrate.** Preferences are the one
// collection the settings screen edits field by field, and each field used to
// need its own copy of the update-or-insert below — `store/locale.ts` carried the
// first — so it lives here once, and the locale switch calls it too.
//
// WHY IT WAITS
// ------------
// With no prefs row yet there is nothing to update, and inserting one means
// inventing the athlete's *other* preferences and stamping the invention with the
// current clock. Before the account has answered there is always no row, so a
// write in that window would push fabricated defaults that then beat the
// athlete's real `lb`/`in` under last-write-wins. Waiting costs the athlete
// nothing they can see — the local write is still what the screen reads next —
// and guessing costs them their settings.
import { SINGLETON_KEY } from './collections';
import { NO_PREFS, type Prefs, recordStore, recordSync } from './record';

/**
 * Record one or more preferences on the account.
 *
 * Resolves once the row holds the change. A caller that only needs the screen to
 * reflect it does not have to await this: the collection is live, and the row
 * appears the moment it is written.
 */
export async function writePrefs(patch: Partial<Prefs>): Promise<void> {
	const sync = recordSync();
	// Signed out there is nothing to wait for and nothing to race: the row is
	// local-only, and inventing the rest of it costs nobody anything.
	if (sync) await sync.settled();

	const prefs = recordStore().prefs;
	if (prefs.has(SINGLETON_KEY)) {
		prefs.update(SINGLETON_KEY, (draft) => {
			Object.assign(draft, patch);
		});
	} else {
		prefs.insert({ id: SINGLETON_KEY, ...NO_PREFS, ...patch });
	}
}
