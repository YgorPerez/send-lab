// Recent (#111): the protocols the athlete last ran on the Timer screen, on this
// device only.
//
// The fifth ephemeral store (`ephemeral.ts`). A draft, not training record: a
// run on the Timer screen records nothing (`CONTEXT.md`, **Saved protocol**), so
// what was run there is the device remembering a convenience, never history,
// and it never syncs (ADR 0008). Losing it costs the athlete a scroll.
//
// Before this, the only thing kept was the protocol the clock was last *pointed*
// at (`timerSetup.ts`, the shelf's `last`), which is one protocol and moves on
// every tap on a row. This is what was *run*: a Start or a Resume.
//
// It holds keys and nothing else. A key is resolved through what the screen can
// run at read time, so a preset the library dropped or a saved protocol since
// deleted falls out of the list instead of being shown under a stale name, and a
// name is never stored (ADR 0012).
//
// Unscoped, like the stopwatch's: it belongs to the screen, not to a day or a
// protocol, and is current until something newer is run.
import { useCallback } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { ephemeralKey } from '$lib/ephemeral';
import type { ProtocolKey } from '$lib/ids';

const KEY = ephemeralKey('recentProtocols', 1);

/** How many Recent shows. */
export const RECENT_SHOWN = 3;

/**
 * How many runs are kept. More than are shown, because Saved takes its own rows
 * out of Recent: an athlete who ran two saved protocols and a preset still sees
 * three rows, filled from further back.
 */
const KEPT = 8;

/** The stored list, parsed rather than trusted: anything else is nothing run. */
function keysOf(stored: unknown): string[] {
	return Array.isArray(stored) ? stored.filter((k): k is string => typeof k === 'string') : [];
}

/** The list once `key` has been run: first, and only once. */
export function ran(stored: unknown, key: ProtocolKey): string[] {
	return [key, ...keysOf(stored).filter((k) => k !== key)].slice(0, KEPT);
}

/**
 * What Recent lists: the last `RECENT_SHOWN` run that the screen can still run,
 * newest first, leaving out every row Saved already shows.
 */
export function recentOf<T extends { key: string }>(
	stored: unknown,
	runnable: readonly T[],
	saved: ReadonlySet<string>,
): T[] {
	const byKey = new Map(runnable.map((r) => [r.key, r]));
	const shown: T[] = [];
	for (const key of keysOf(stored)) {
		const row = saved.has(key) ? undefined : byKey.get(key);
		if (row) shown.push(row);
		if (shown.length === RECENT_SHOWN) break;
	}
	return shown;
}

/**
 * The stored list, and the call that records a run. Cross-tab sync off, as the
 * clock's drafts are: two tabs each recording would reorder each other's list.
 */
export function useRecentProtocols(): [unknown, (key: ProtocolKey) => void] {
	const [stored, setStored] = useLocalStorageState<unknown>(KEY, {
		defaultValue: undefined,
		storageSync: false,
	});
	const record = useCallback(
		(key: ProtocolKey) => setStored((prev: unknown) => ran(prev, key)),
		[setStored],
	);
	return [stored, record];
}
