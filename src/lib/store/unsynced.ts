// Unsynced work that outlives the tab — the durable half of #58.
//
// WHAT THIS FIXES
// ---------------
// `sync.ts` held its unsent writes in a `Map` in memory, and said so: the row
// survived a reload inside its collection, but *the fact that it had not reached
// the server* did not. So a reload while offline lost the intent to sync, and the
// row sat on the device until something else happened to touch it. That is the
// gap #57 recorded and handed here.
//
// WHY IT IS NOT CALLED AN OUTBOX
// ------------------------------
// `CONTEXT.md`'s **Unsynced work** puts *pending*, *queued*, *unsaved* and
// *outbox* on its `_Avoid_` list — which #58's own title says twice. ADR 0014
// rules the glossary name outranks the persisted key at every layer, and #72
// showed what skipping that costs once rows exist, so the term is taken here
// before anything is written: the storage key, the TypeScript names and the wire
// all say *unsynced*.
//
// AND WHY THE DEAD-LETTER IS A STATE, NOT A SECOND STORE
// -----------------------------------------------------
// The same glossary entry decides the shape: *"work that can never be sent is
// unsynced work in its final state, not a separate thing."* #58 described a queue
// **and** a dead-letter, which would have been two stores, two sizes to add up
// and two things for an indicator to get wrong. It is one sequence, and a refusal
// is a field on an entry. The behaviour the ticket actually asked for is
// unchanged and is the point of the split — a refused write leaves the replay so
// it cannot stall the writes behind it — but it stays *counted*, because an
// indicator that dropped it would tell the athlete their training was safe when
// it can never be sent.
//
// THE REPLAY IS FOREGROUND-ONLY, AND NOW ON PURPOSE
// -------------------------------------------------
// #24 made it foreground-only because that was "the only shape iOS permits". The
// athlete is on Chrome on Android, so that premise is dead and the athlete was
// asked again rather than left to inherit it. It stands, on its own grounds: one
// implementation, living beside the data it guards, and TanStack DB's own online
// detector is foreground-only by construction anyway. The cost is that a write
// made in a gym basement leaves on the next app open rather than on the walk
// home — a delay, not a loss, now that the sequence is durable.
import type { StorageApi } from '@tanstack/db';
import type { UnsyncedWrite, WriteRejection } from '$lib/recordWire';

/** Where one account's unsynced work is kept. Same `sendlab:<account>:` shape as
 *  the sixteen collections, and the account segment is what keeps two athletes on
 *  one device from replaying each other's writes. */
export const UNSYNCED_KEY = (account: string): string => `sendlab:${account}:unsynced`;

/**
 * A write the server has refused, and why.
 *
 * Not a failure to *reach* the server — that is transient and the write stays
 * sendable. This is a 200 whose report named the row: the client and the server
 * disagree about it, so retrying cannot change the answer.
 */
export interface RefusedWrite {
	readonly write: UnsyncedWrite;
	/** The server's own words, kept verbatim so a bug report can quote them. */
	readonly reason: string;
	/** When the refusal came back. */
	readonly at: number;
}

/** One row of unsynced work: what to send, and what became of it. */
interface Entry {
	readonly write: UnsyncedWrite;
	readonly refused?: { readonly reason: string; readonly at: number };
}

export interface UnsyncedWork {
	/** Record writes the athlete has just made. A second edit of a row replaces
	 *  the first **in place**, keeping its position in the sequence. */
	add(writes: readonly UnsyncedWrite[]): void;
	/** Everything still worth sending, oldest first. */
	sendable(): UnsyncedWrite[];
	/** Is this row waiting to be sent? What a hydrate asks before overwriting a
	 *  row: one still waiting is newer than anything the server can hold. */
	holds(collection: string, key: string): boolean;
	/** Account for a batch that reached the server: drop what was delivered, mark
	 *  what was refused. */
	settle(sent: readonly UnsyncedWrite[], rejected: readonly WriteRejection[]): void;
	/** The work in its final state — everything that can never be sent. */
	refused(): RefusedWrite[];
	/** All unsynced work, refused included. `CONTEXT.md`'s count. */
	size(): number;
}

/**
 * One row's identity: its collection and its key, joined on a NUL.
 *
 * Not decoration. A row key here can be free text — `savedPrograms` is keyed by
 * the athlete's own name for a program — so a printable separator can occur
 * inside either half, and `"a:b" + ":" + "c"` and `"a" + ":" + "b:c"` would be one
 * entry for two different rows. NUL cannot occur in a collection name or in any
 * key the app mints.
 */
function rowId(collection: string, key: string): string {
	return `${collection}\0${key}`;
}

/**
 * The unsynced work for one account.
 *
 * `account` is fixed at construction and is not a parameter of any call, for the
 * same reason the sync's is: work that could be pointed at a different account
 * mid-life is a way to replay one athlete's training into another's record.
 *
 * `storage` absent means memory — no `window`, or a `localStorage` that cannot be
 * read (jsdom, or Safari with storage denied). That is a real degradation, and
 * the one the **Unsynced work** entry warns about: the work then lives only as
 * long as the tab.
 */
export function createUnsyncedWork(account: string, storage: StorageApi | undefined): UnsyncedWork {
	const key = UNSYNCED_KEY(account);

	// A `Map` because insertion order *is* the replay order, and `set` on a key
	// already present keeps that key's original position — which is exactly the
	// rule wanted: the athlete's first edit of a row is where the row entered the
	// account's history, and re-ordering it on a second edit would reorder this
	// device's history against one that saw both.
	const entries = new Map<string, Entry>(load());

	function load(): [string, Entry][] {
		let raw: string | null = null;
		try {
			raw = storage?.getItem(key) ?? null;
		} catch {
			// Storage present but refusing to be read. Same answer as absent.
			return [];
		}
		if (!raw) return [];
		try {
			const parsed: unknown = JSON.parse(raw);
			if (!Array.isArray(parsed)) throw new Error('not an array');
			return parsed
				.filter(isEntry)
				.map((entry) => [rowId(entry.write.collection, entry.write.key), entry]);
		} catch (error) {
			// Loud, because what just failed to load is training the athlete
			// recorded and this device is the only place it existed. Not thrown: an
			// app that will not start is strictly worse, and the collections still
			// hold the rows themselves.
			console.warn(
				`${key} could not be read, so this device's unsynced work is lost:`,
				error,
				'\nThe rows are still in their collections; what is gone is the record that they had not been sent.',
			);
			return [];
		}
	}

	function save(): void {
		try {
			storage?.setItem(key, JSON.stringify([...entries.values()]));
		} catch (error) {
			// Quota, or storage denied mid-session. The work still replays for as
			// long as this tab lives.
			console.warn(`${key} could not be written:`, error);
		}
	}

	return {
		add(writes) {
			if (writes.length === 0) return;
			for (const write of writes) {
				// A refusal is a fact about the content that was sent, not a ban on
				// the key. The athlete has changed this row since, so the new content
				// is sendable — and refusing to try it would strand every later edit
				// of that row on this device permanently.
				entries.set(rowId(write.collection, write.key), { write });
			}
			save();
		},

		sendable() {
			const out: UnsyncedWrite[] = [];
			for (const entry of entries.values()) if (!entry.refused) out.push(entry.write);
			return out;
		},

		holds(collection, key) {
			const entry = entries.get(rowId(collection, key));
			// A refused row is deliberately *not* held. While a write is waiting the
			// local row is newer than anything the server has, and a hydrate must
			// leave it alone. Once the server has refused it that stops being true:
			// it can never be sent, so the server's copy is the only one that will
			// ever be real, and shielding it forever would pin a row this device can
			// never reconcile.
			return entry !== undefined && !entry.refused;
		},

		settle(sent, rejected) {
			for (const write of sent) {
				const id = rowId(write.collection, write.key);
				// Identity, not key: an edit made while the batch was in flight is a
				// different object under the same key, it has never been sent, and
				// clearing by key would silently drop it.
				if (entries.get(id)?.write === write) entries.delete(id);
			}
			const at = Date.now();
			for (const bad of rejected) {
				const id = rowId(bad.collection, bad.key);
				const entry = entries.get(id);
				console.error(
					`/api/state refused ${bad.collection}/${bad.key}: ${bad.reason}. ` +
						'The client and the server disagree about this row — one of them has a bug. ' +
						'It will not be retried; it stays counted as unsynced work in its final state.',
				);
				entries.set(id, {
					write: entry?.write ?? synthetic(bad),
					refused: { reason: bad.reason, at },
				});
			}
			save();
		},

		refused() {
			const out: RefusedWrite[] = [];
			for (const entry of entries.values()) {
				if (entry.refused) out.push({ write: entry.write, ...entry.refused });
			}
			return out;
		},

		size: () => entries.size,
	};
}

/** A refusal for a row this device no longer holds — the batch was cleared by a
 *  concurrent settle, or the server named a row that was never sent. Kept rather
 *  than dropped, so the count and the reason still reach the athlete. */
function synthetic(bad: WriteRejection): UnsyncedWrite {
	return { collection: bad.collection, key: bad.key, row: null, at: Date.now() };
}

/** Storage is parsed, not trusted: it can be written by an older build, a newer
 *  one, or by hand. An entry that cannot be replayed is worse than one dropped —
 *  it would be sent to `/api/state` as `undefined` and refused forever. */
function isEntry(value: unknown): value is Entry {
	if (typeof value !== 'object' || value === null) return false;
	const entry = value as { write?: unknown; refused?: unknown };
	const write = entry.write as UnsyncedWrite | undefined;
	if (typeof write !== 'object' || write === null) return false;
	if (typeof write.collection !== 'string' || typeof write.key !== 'string') return false;
	if (typeof write.at !== 'number') return false;
	if (entry.refused !== undefined) {
		const refused = entry.refused as { reason?: unknown; at?: unknown };
		if (typeof refused.reason !== 'string' || typeof refused.at !== 'number') return false;
	}
	return true;
}
