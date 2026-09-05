// Ephemeral state: what the athlete is in the middle of, on this device only.
//
// WHAT BELONGS HERE, AND WHAT DOES NOT
// ------------------------------------
// Three stores: the rest timer, the readiness draft and the session draft. ADR
// 0008's rule is that ephemeral UI stays local-only and **never syncs** — it is
// not account data, it never reaches `/api/state`, and it never goes through
// TanStack DB. Losing it costs the athlete a re-entry; losing account data costs
// them training. That difference is why these are hand-held rather than
// collections, and #18 measured the alternatives rather than defaulting:
// `use-local-storage-state` at 680 B against TanStack DB level 2's 60.8 KB, which
// would also force the timer into a one-row keyed collection and cannot switch
// off cross-tab sync.
//
// THE KEY SCHEME
// --------------
// `sendlab:<name>:v<n>`, with the version **last**. `react-doctor`'s
// `client-localstorage-no-version` asks for exactly this shape and its reasoning
// is the reason to want it: when the stored shape changes, the old value is
// ignored instead of crashing the app. The version is per key, not global, so
// bumping the session draft does not throw away the athlete's timer setup.
//
// Deliberately *not* account-scoped, unlike the collections' `sendlab:<account>:`
// prefix (#56) and unsynced work (#58). Those hold training; these hold a form in
// progress, and they are scoped by something shorter-lived than an account
// anyway — see below. See `docs/adr/` and #59's resolution for the case that this
// should change if the app ever expects two athletes to share a device mid-day.
//
// THE SCOPE RULE
// --------------
// Every one of the three is only meaningful while the thing it belongs to is
// still on screen: the readiness draft belongs to a **day**, the session draft to
// a **slot**, the timer's setup to a **protocol**. Restoring one out of its scope
// looks like the app remembering and is the app lying — yesterday's answers
// offered as today's, one exercise's clock on another's card.
//
// So a stored value carries the scope it was written in, and reading it is
// `inScope(stored, now)`. One comparison, in one place, tested once. It was a
// hand-written day check in `readinessDraft.ts` before this, and that check had
// already carried the bug this shape prevents: a legacy branch compared a stored
// *localized* date against a freshly formatted one, which cannot match across a
// language switch (#55, ADR 0003).

/**
 * Anything that came out of storage and might be an object.
 *
 * Four places here parse a value they did not write — `inScope`, the timer's
 * config and run checks, and the session draft's — and each one has to rule out
 * `null` before it can read a field, because `typeof null === 'object'` and the
 * read would throw. One named guard, so that is stated once rather than four
 * times in four slightly different spellings.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** A stored value, tagged with the scope it was written in. */
export interface Scoped<T> {
	/** What the value belongs to: an ISO day, a `SlotKey`, a protocol key. A
	 *  string in every case, because it is compared and never interpreted. */
	readonly scope: string;
	readonly value: T;
}

/** Tag a value with its scope, ready to persist. */
export function scoped<T>(scope: string, value: T): Scoped<T> {
	return { scope, value };
}

/**
 * The stored value, if it still belongs to `scope` — otherwise nothing.
 *
 * Written to be *dull*, because every interesting version of it is wrong:
 *
 *   * The scope is compared with `===`. Slot keys and protocol keys are strings
 *     that can look numeric, and `'1' == 1` would restore one exercise's clock
 *     onto another's card.
 *   * The **scope** is what decides, never the value. `0`, `''` and `false` are
 *     all legitimate stored values, and a truthiness test on the value would
 *     silently discard them.
 *   * A value with no scope — an older build's shape, or a hand-edited key — is
 *     refused rather than assumed current. "In scope for whatever is asking" is
 *     the one answer that is never safe.
 */
export function inScope<T>(stored: Scoped<T> | undefined, scope: string): T | undefined {
	if (!isRecord(stored) || typeof stored.scope !== 'string') return undefined;
	return stored.scope === scope ? stored.value : undefined;
}

/** `sendlab:readinessDraft:v1`. One place, so a key cannot be spelled two ways
 *  across a `load` and a `save` — which persists nothing and reports nothing. */
export function ephemeralKey(name: string, version: number): string {
	return `sendlab:${name}:v${version}`;
}

/** Whether a storage key is one of these, told apart from a collection's
 *  `sendlab:<account>:<collection>` by the version segment.
 *
 *  Here rather than at the reader, because the shape above is this module's and
 *  a second copy of it elsewhere is a copy that stops agreeing: the reader is
 *  `store/collections.ts`'s `heldAccounts()`, which would otherwise report every
 *  draft as an account and tell a first-run athlete they are a returning one. */
export function isEphemeralKey(key: string): boolean {
	const [prefix, name, version, ...rest] = key.split(':');
	return prefix === 'sendlab' && !!name && /^v\d+$/.test(version ?? '') && rest.length === 0;
}
