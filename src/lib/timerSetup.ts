// The rest timer's persisted setup — #59's third ephemeral store.
//
// WHY THE CLOCK REMEMBERS ANYTHING AT ALL
// ---------------------------------------
// Because of a hazard measured on the real device rather than imagined: on
// Android, **pull-to-refresh fires a real reload in the installed app** (#54,
// suppression owned by #27). The athlete is mid-repeater with a hand on the
// phone, the page reloads, and until now the clock came back idle with their
// place in the protocol gone.
//
// TWO RULES MAKE RESTORING SAFE, AND WITHOUT EITHER IT IS WORSE THAN FORGETTING
// -----------------------------------------------------------------------------
//   1. **It comes back paused, never running.** Wall-clock time passed while the
//      page was gone and nothing on the device knows how much, so a clock that
//      resumed itself would count down from a `remaining` that is simply wrong —
//      on the one screen the athlete is deliberately not looking at. The tap to
//      resume is the correction, and it is theirs to make.
//   2. **It comes back only for the protocol it was saved under.** The Timer is
//      remounted per pinned task and variant (`train.tsx`'s `protocolKey`), or
//      per preset or saved protocol on the Timer screen, and one exercise's
//      position shown on another's card is worse than no memory. Train keeps one
//      draft; the Timer screen keeps one per protocol (`ClockShelf`).
//
// Both are arithmetic, so both live here and not in the component — the same
// split `protocol.ts` makes, and for the same reason: a component test
// cannot reach them.
//
// `storageSync: false` at the hook, per #18: two tabs each ticking would fight
// over `remaining` every second, so cross-tab sync is a hazard here rather than a
// feature. It is the one of the three stores that switches it off.
import { useCallback } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { ephemeralKey, inScope, isRecord, type Scoped, scoped } from '$lib/ephemeral';
import type { ProtocolKey } from '$lib/ids';
import {
	IDLE,
	PROTOCOL_FIELDS,
	type Protocol,
	type Run,
	readProtocol,
	SEGMENTS,
	type Segment,
} from '$lib/protocol';

/**
 * Which screen's clock this is: where it lives. Each screen keeps its own, because
 * a single shared draft meant leaving Train mid-protocol for the Timer screen
 * (#101) overwrote Train's place, and coming back found it idle.
 *
 * Not "slot": a slot is one weekday of one training week (`CONTEXT.md`), and
 * Train is the screen that shows them.
 */
export type ClockHome = 'train' | 'timer';

/**
 * Train's is the key the timer has always used, so a draft written before the
 * split still comes back. It holds one draft: Train shows one pinned protocol at
 * a time, and moving to another task is moving on from the last one.
 *
 * The Timer screen's holds a shelf of them, one per protocol (`ClockShelf`), at
 * version 2: the first version held one draft, as Train's does, and lost a place
 * on every tap on another row.
 */
const KEYS: Record<ClockHome, string> = {
	train: ephemeralKey('timer', 1),
	timer: ephemeralKey('timerScreen', 2),
};

/** The storage key a screen's clock is kept under. */
export function timerDraftKey(home: ClockHome): string {
	return KEYS[home];
}

/** What is worth persisting: the athlete's protocol, and where they were in it.
 *  Not `running` — see rule 1; it is never stored and never restored. */
export interface TimerSetup {
	readonly config: Protocol;
	readonly run: Run;
}

/** A clock ready to render. */
export interface RestoredTimer {
	readonly config: Protocol;
	readonly run: Run;
	/** Always `false`. Named rather than omitted, because the whole point is that
	 *  the caller does not have to remember to pause it. */
	readonly running: false;
}

/**
 * The clock to open with, given what was stored and what today prescribes.
 *
 * `seeded` is the protocol resolved for the pinned task — what the athlete is
 * being asked to do. It wins whenever the stored setup is for something else, is
 * unusable, or is absent.
 *
 * `fixed` is for a protocol the athlete cannot edit — a preset (#101). The seed
 * is then the only configuration there is, and a stored one that differs from it
 * means the library moved on: its numbers are dropped and so is the place in
 * them, for the reason the scope check drops a place in another protocol.
 */
export function restored(
	stored: Scoped<TimerSetup> | undefined,
	protocolKey: ProtocolKey,
	seeded: Protocol,
	{ fixed = false }: { fixed?: boolean } = {},
): RestoredTimer {
	const setup = inScope(stored, protocolKey);
	// A draft from before cooldown (#104) has none, and reads as none: the same
	// protocol it was, so its place is kept.
	const config = readProtocol(setup?.config);
	if (!config || (fixed && !sameProtocol(config, seeded))) {
		// No usable configuration means no usable *position* either: `round 3 of 6`
		// describes a protocol we no longer have, and carrying it onto the
		// prescribed one is the same cross-protocol confusion rule 2 exists to
		// prevent — reached by a different route.
		return { config: seeded, run: IDLE, running: false };
	}
	// The configuration outlives any one run of it, so a stored run that is
	// unusable costs the athlete their place and not their setup.
	return { config, run: isResumable(setup?.run) ? setup.run : IDLE, running: false };
}

/**
 * The Timer screen's drafts: one per protocol, and which protocol it was last
 * pointed at.
 *
 * The screen lists every preset and saved protocol, and a tap on another row is
 * the commonest thing done on it. The draft is scoped to the protocol (spec #98:
 * "for a saved protocol that is its id, for a preset its variant"), so each
 * protocol keeps its own place, and a tap away and back finds it where it was.
 * Each entry is still scoped, and still read through `restored()`: paused, and
 * only for the protocol it names.
 *
 * Only places worth coming back to are kept — a protocol at its start or at its
 * end has none, and its numbers are the protocol's own — and only the
 * `SHELF_LIMIT` most recently left, so a draft for a protocol since deleted
 * falls off the end rather than staying forever.
 */
export interface ClockShelf {
	/** The protocol the clock was last pointed at, place or not. */
	readonly last: string;
	/** Most recently left first. */
	readonly drafts: readonly Scoped<TimerSetup>[];
}

/** How many protocols keep their place at once. More than the athlete is ever
 *  part-way through, and few enough that the shelf stays a handful of bytes. */
export const SHELF_LIMIT = 8;

/** The shelf with `protocolKey`'s place written, or dropped if it has none. */
export function shelve(stored: unknown, protocolKey: ProtocolKey, setup: TimerSetup): ClockShelf {
	const others = shelfOf(stored).drafts.filter((d) => d.scope !== protocolKey);
	const placed = setup.run.segment !== 'idle' && isResumable(setup.run);
	const drafts = placed ? [scoped(protocolKey, setup), ...others] : others;
	return { last: protocolKey, drafts: drafts.slice(0, SHELF_LIMIT) };
}

/** `protocolKey`'s draft on the shelf, ready for `restored()`. */
export function draftOn(stored: unknown, protocolKey: ProtocolKey): Scoped<TimerSetup> | undefined {
	return shelfOf(stored).drafts.find((d) => d.scope === protocolKey);
}

/** The protocol the Timer screen's clock was last pointed at. */
export function lastOn(stored: unknown): string | undefined {
	return isRecord(stored) && typeof stored.last === 'string' ? stored.last : undefined;
}

/** Parsed, not trusted: anything that is not a shelf reads as an empty one. */
function shelfOf(stored: unknown): ClockShelf {
	if (!isRecord(stored) || !Array.isArray(stored.drafts)) return { last: '', drafts: [] };
	const drafts = (stored.drafts as unknown[]).filter(
		(d): d is Scoped<TimerSetup> => isRecord(d) && typeof d.scope === 'string',
	);
	return { last: lastOn(stored) ?? '', drafts };
}

/**
 * Persist the athlete's setup and position for this protocol, and hand back the
 * one stored for it.
 *
 * Cross-tab sync off, per #18. The setter is a sink rather than a source: the
 * component owns `config` and `run` as React state — they change every second
 * and the clock cannot read them back through storage — and reads the stored
 * draft once, at mount, through `restored()`.
 */
export function useTimerSetup(
	home: ClockHome,
	protocolKey: ProtocolKey,
): [Scoped<TimerSetup> | undefined, (setup: TimerSetup) => void] {
	const [stored, setStored] = useLocalStorageState<unknown>(KEYS[home], {
		defaultValue: undefined,
		storageSync: false,
	});
	// Stable, because the caller writes from an effect keyed on it. An inline
	// arrow here is a new function every render, which makes that effect run on
	// every render rather than when the clock actually moved — a `localStorage`
	// write per render instead of one per tick.
	const persist = useCallback(
		(setup: TimerSetup) =>
			setStored((prev: unknown) =>
				home === 'train' ? scoped(protocolKey, setup) : shelve(prev, protocolKey, setup),
			),
		[setStored, home, protocolKey],
	);
	const draft =
		home === 'train' ? (stored as Scoped<TimerSetup> | undefined) : draftOn(stored, protocolKey);
	return [draft, persist];
}

/** The protocol the Timer screen's clock was last pointed at, so the screen
 *  opens on it. */
export function useLastTimerProtocol(): string | undefined {
	const [stored] = useLocalStorageState<unknown>(KEYS.timer, {
		defaultValue: undefined,
		storageSync: false,
	});
	return lastOn(stored);
}

function sameProtocol(a: Protocol, b: Protocol): boolean {
	return PROTOCOL_FIELDS.every((f) => a[f] === b[f]);
}

/** A run worth coming back to. `done` is excluded deliberately: it is a clock
 *  with nothing left to run, and restoring it hands the athlete a dead timer they
 *  must reset before they can use it. */
function isResumable(value: unknown): value is Run {
	if (!isRecord(value)) return false;
	if (typeof value.segment !== 'string' || !SEGMENTS.includes(value.segment as Segment)) {
		return false;
	}
	if (value.segment === 'done') return false;
	return (
		typeof value.remaining === 'number' &&
		Number.isFinite(value.remaining) &&
		typeof value.round === 'number' &&
		typeof value.set === 'number'
	);
}
