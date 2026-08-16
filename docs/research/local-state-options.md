# Persisted local state in React — the `localStorageCollectionOptions` spike, and the survey

Two questions, researched together because they meet at the same boundary.

**Question A — the spike.** Does TanStack DB's `localStorageCollectionOptions` (persistence
"level 2", `docs/research/tanstack-db.md` §4.1) share the defect class that
[TanStack/db#1659](https://github.com/TanStack/db/issues/1659) documents against
`persistedCollectionOptions` and the SQLite adapters? This decides whether the cheap path is
viable for **account data** on
[#24](https://github.com/YgorPerez/send-lab/issues/24).

**Question B — the survey.** What is actually available for React-ergonomic persisted local
state, for the three **ephemeral** stores only — the rest timer and the two form drafts — which
are localStorage-only, never account data, and never go through TanStack DB. Prompted by the
athlete's words: *"using localstorage in react is always a pain to me."* Feeds
[#18](https://github.com/YgorPerez/send-lab/issues/18), whose scope now also covers what holds
non-persisted interactive UI state.

**Researched 2026-08-15. Research only. This document recommends nothing** — the weighing happens
on #18 and #24 with the athlete. Where a fact has a consequence, the consequence is stated as a
consequence, not as advice.

Only primary sources: package source read from the published npm tarballs and from the projects'
own repositories, official documentation, the npm registry, GitHub issues and pull requests, and
MDN. No third-party write-ups, no benchmark blogs, no listicles. Every claim carries a URL and a
version or a date. Where a fact could not be established it is marked **UNKNOWN** and the sources
checked are named.

Four framing facts, up front, so nothing below is read out of scope:

1. **There is no SSR here and there cannot be one.**
   [ADR 0006](../adr/0006-the-app-is-client-only-with-one-server-seam.md) puts the whole app tree
   behind one `ssr: false` seam at the root. So the entire "does it hydrate safely / does it flash
   on the server" axis — which is what most of these libraries' documentation spends its warnings
   on — **does not apply and is not reported as a differentiator.** Where a library's SSR feature
   exists it is noted as inert, not as a benefit.
2. **The sizes here are trivial.** ~5 accounts, ~28 KB of account state, 5.6 KB largest document.
   The three ephemeral values are ~201 bytes (timer, measured below), and two drafts of similar
   order. Any performance claim scoped to large datasets or collaborative editing does not
   transfer; §12 names each one that is so scoped.
3. **Bundle sizes in this document were measured, not looked up.** Method in §8.1. This produces
   the first real minified+gzipped figure for the TanStack DB level-2 path, which
   `docs/research/tanstack-db.md` §7.1 recorded as unpublished anywhere.
4. **Question A's answer is not the one the RFC's existence suggests.** It is narrower and more
   specific, and it cuts both ways. §5 states it in one paragraph.

---

## Versions this document describes

Read from `https://registry.npmjs.org/<package>` and the GitHub API on **2026-08-15**.

| Package | Latest | Published | Weekly downloads | License |
| --- | --- | --- | ---: | --- |
| `@tanstack/db` | **0.7.2** | 2026-08-13 | 588,921 | MIT |
| `@tanstack/react-db` | **0.2.1** | 2026-08-13 | 527,715 | MIT |
| `@tanstack/db-sqlite-persistence-core` | **0.2.12** | 2026-08-13 | — | MIT |
| `zustand` | **5.0.15** | 2026-08-13 | 50,575,102 | MIT |
| `@tanstack/store` | **0.11.1** | 2026-08-05 | 27,547,092 | MIT |
| `@tanstack/react-store` | **0.11.1** | 2026-08-05 | 26,481,439 | MIT |
| `@tanstack/persister` | **0.1.1** | **2025-07-12** | 650 | MIT |
| `jotai` | **2.20.2** | 2026-07-14 | 5,664,774 | MIT |
| `use-local-storage-state` | **20.0.0** | 2026-07-16 | 332,601 | MIT |
| `usehooks-ts` | **3.1.1** | **2025-02-05** | 5,165,980 | MIT |
| `idb-keyval` | **6.3.0** | 2026-07-08 | 7,885,050 | Apache-2.0 |
| `localforage` | **1.10.0** | **2021-08-18** | 8,367,866 | Apache-2.0 |
| `dexie` | **4.4.5** | 2026-08-14 | 2,178,856 | Apache-2.0 |
| `dexie-react-hooks` | **4.4.0** | 2026-03-18 | 456,902 | Apache-2.0 |

Repository health, from the GitHub API on the same day. "Last default-branch commit" is the top
commit of `GET /repos/{owner}/{repo}/commits`, which is not the same as `pushed_at` — `pushed_at`
counts pushes to any branch, including bot branches, and is misleading for two of these.

| Repo | Stars | Open issues | Last default-branch commit | Archived |
| --- | ---: | ---: | --- | --- |
| `pmndrs/zustand` | 58,570 | 3 | 2026-08-13 | no |
| `pmndrs/jotai` | 21,238 | 5 | 2026-08-15 | no |
| `TanStack/store` | 882 | 30 | 2026-08-11 | no |
| `TanStack/persist` | **32** | 1 | **2026-05-13** | no |
| `astoilkov/use-local-storage-state` | 1,231 | 6 | 2026-07-16 | no |
| `juliencrn/usehooks-ts` | 7,852 | **126** | **2025-02-05** | no |
| `jakearchibald/idb-keyval` | 3,228 | 24 | 2026-07-08 | no |
| `localForage/localForage` | 25,799 | **250** | **2024-07-30** | no |
| `dexie/Dexie.js` | 14,537 | 594 | 2026-08-14 | no |
| `TanStack/db` | 3,865 | 284 | 2026-08-15 | no |

Download counts are reported here as one fact among others. They are not an argument: `localforage`
has 8.4 M weekly downloads and has not shipped a release in five years.

---

# Question A — the `localStorageCollectionOptions` spike

## 1. It is a separate code path, and the separation is total

`localStorageCollectionOptions` lives in **one file**, `packages/db/src/local-storage.ts`, 874
lines, inside the core `@tanstack/db` package. The published tarball for
`@tanstack/db@0.7.2` ships `package/src/local-storage.ts` and it is **byte-identical** to
`https://github.com/TanStack/db/blob/main/packages/db/src/local-storage.ts` as read on 2026-08-15
(verified by `diff`; both 874 lines). Line numbers below refer to that file and are therefore
valid against both the published package and `main`.

Its complete import list, lines 1–19:

```ts
import { safeRandomUUID } from './utils/uuid'
import {
  InvalidStorageDataFormatError,
  InvalidStorageObjectFormatError,
  SerializationError,
  StorageKeyRequiredError,
} from './errors'
import type { … } from './types'
import type { StandardSchemaV1 } from '@standard-schema/spec'
```

A UUID helper, four error classes, types, and a schema spec. **Nothing from the persistence layer,
because the persistence layer is not in this package at all.** Grepping the entire published
`@tanstack/db@0.7.2` `src/` tree for `persistedCollectionOptions` returns **zero hits**;
`persistedCollectionOptions` is exported from `@tanstack/db-sqlite-persistence-core`
(`package/src/index.ts`: `export * from './persisted'`), a different package which lists
`@tanstack/db` as a *dependency* and is never depended on in the other direction.

So the answer to the ticket's literal question is:

> **No. `localStorageCollectionOptions` does not use, wrap, or import any part of the machinery
> RFC #1659 audits.** It implements its own `SyncConfig` (`createLocalStorageSync`, lines 691–874)
> and its own `onInsert`/`onUpdate`/`onDelete` wrappers (lines 439–530). The only thing the two
> share is the collection engine itself — `createCollection`, the optimistic-state overlay, and
> the transaction state machine — which is not what the RFC found broken.

The RFC says as much itself. Its scope line reads *"Fifteen open issues cluster around
`persistedCollectionOptions` + `electricCollectionOptions` + the browser/mobile SQLite persistence
adapters"* ([#1659](https://github.com/TanStack/db/issues/1659), §1, read 2026-08-15). The strings
`localStorage`, `localStorageCollectionOptions` and `local-storage` **appear zero times in the
RFC's 250-line body**; the one occurrence of the words "local storage" is D8's phrase *"never reach
local storage"*, which in that row means the SQLite replica, not `window.localStorage`.

## 2. The write path, precisely

### 2.1 What lands in storage

One `localStorage` key, holding one JSON object, mapping an encoded row key to
`{ versionKey, data }` (lines 43–46, 399–417):

```ts
interface StoredItem<T> { versionKey: string; data: T }
```

```ts
const saveToStorage = (dataMap: Map<string | number, StoredItem<any>>): void => {
  try {
    const objectData: Record<string, StoredItem<any>> = {}
    dataMap.forEach((storedItem, key) => { objectData[encodeStorageKey(key)] = storedItem })
    const serialized = parser.stringify(objectData)
    storage.setItem(config.storageKey, serialized)
  } catch (error) {
    console.error(`[LocalStorageCollection] Error saving data to storage key "…":`, error)
    throw error
  }
}
```

Keys are type-prefixed to stop `1` and `"1"` colliding — `n:1` vs `s:1`, lines 168–191, with a
documented fallback for unprefixed legacy data. The whole collection is rewritten on every
mutation; there is no per-row write.

### 2.2 When it writes — and this is the load-bearing detail

The three wrappers are structurally identical. `wrappedOnInsert`, lines 439–471, with the ordering
comments verbatim from the source:

```ts
const wrappedOnInsert = async (params: InsertMutationFnParams<any>) => {
  params.transaction.mutations.forEach((mutation) => {
    validateJsonSerializable(parser, mutation.modified, `insert`)      // 1. serializability check
  })

  // Call the user handler BEFORE persisting changes (if provided)
  let handlerResult: any = {}
  if (config.onInsert) {
    handlerResult = (await config.onInsert(params)) ?? {}              // 2. ← the suspension point
  }

  // Always persist to storage
  params.transaction.mutations.forEach((mutation) => {
    lastKnownData.set(mutation.key, { versionKey: generateUuid(), data: mutation.modified })
  })
  saveToStorage(lastKnownData)                                        // 3. the setItem
  sync.confirmOperationsSync(params.transaction.mutations)            // 4. optimistic → synced
  return handlerResult
}
```

`wrappedOnUpdate` is lines 473–505 and `wrappedOnDelete` lines 507–530, with the same
handler-then-persist order.

Two cases follow, and they behave completely differently:

**Case 1 — no user handler (a purely local collection).** `config.onInsert` is undefined, so the
`await` on line 448 never executes. An `async` function body runs synchronously until its first
`await`, and the call chain above it does too: `collection.insert()` calls
`directOpTransaction.commit()` (`packages/db/src/collection/mutations.ts:253`), `commit()` runs
synchronously to `await this.mutationFn(…)` (`packages/db/src/transactions.ts:524`), and the
mutationFn evaluates `this.config.onInsert!({…})` (`mutations.ts:238`) — i.e. calls
`wrappedOnInsert` — *before* suspending. **`localStorage.setItem` therefore executes synchronously,
inside the `collection.insert(…)` call, before it returns.** `update` and `delete` take the same
route (`mutations.ts:435`, `mutations.ts:539`, each followed by `directOpTransaction.commit()` at
`:450` and `:554`).

That is a real property and it is the good case. It is at least as durable as the
`localStorage.setItem` the app already does at `src/lib/timerStore.svelte.ts:357`.

**Case 2 — a user handler is present (a collection backed by a server).** Line 448 suspends. The
`setItem` does not happen until the handler's promise resolves. If the handler is a `fetch` to
`/api/state`:

- **The tab closes while the fetch is in flight → nothing was written. On reload the mutation is
  gone.** The optimistic value lived only in the collection's in-memory overlay.
- **The device is offline and the fetch rejects → the transaction fails, the optimistic state is
  rolled back, and `saveToStorage` is never reached.** This is not incidental; it is a *tested,
  asserted* behaviour. `packages/db/tests/local-storage.test.ts:1051` — "should rollback mutations
  when transaction fails" — asserts exactly it, including `expect(parsed['rollback-test']).toBeUndefined()`
  against the storage contents.

**Case 3 — manual transactions.** These do not go through the wrappers at all; the app must call
`utils.acceptMutations(transaction)` (lines 550–608). Both the JSDoc (lines 112–119) and the
documentation site show the same ordering, and the JSDoc comment is explicit:

> ```ts
> const tx = createTransaction({
>   mutationFn: async ({ transaction }) => {
>     // Make API call first
>     await api.save(...)
>     // Then persist local-storage mutations after success
>     localSettings.utils.acceptMutations(transaction)
>   }
> })
> ```
> — `packages/db/src/local-storage.ts:110–119`; the docs site carries the same shape under
> "Manual Transactions", <https://github.com/TanStack/db/blob/main/docs/collections/local-storage-collection.md>

**So the answer to "what happens to an optimistic mutation that has not yet been accepted by the
server when the tab closes?" is: it is lost, and this is the designed contract, not a bug.** The
documented, first-party pattern for a server-backed localStorage collection persists *after* the
server accepts, never before.

### 2.3 Reads, and cross-tab

`sync()` (lines 783–824) does one `loadFromStorage` at mount, `write`s every row as an `insert`,
`commit()`s, `markReady()`s, and registers one `storage` listener:

```ts
const handleStorageEvent = (event: StorageEvent) => {
  if (event.key !== storageKey || event.storageArea !== storage) return
  processStorageChanges()
}
storageEventApi.addEventListener(`storage`, handleStorageEvent)
```

`processStorageChanges` (lines 750–777) re-reads the whole key and diffs against `lastKnownData`
by `versionKey` (lines 712–744), emitting insert/update/delete. It uses the storage contents, not
`event.newValue`, so a coalesced burst of writes from another tab converges correctly.

One sharp edge worth naming: the guard is `event.storageArea !== storage`. If you pass a **custom
`storage` object** — which the docs actively encourage, showing an encrypting wrapper — that
identity check can never match `window.localStorage`, and **cross-tab sync silently stops working**
unless you also supply a matching `storageEventApi`. The docs do describe supplying a custom
`storageEventApi`, but as an *extension* for Electron/IPC, not as a repair for something the custom
storage broke. This is code-verified against lines 813 and 830–836, and there is no open issue
about it.

### 2.4 Quota and failure — the exact opposite of D7

D7's mechanism is *"persistence runs as a `void` promise whose failure is only `console.error`'d"*.
Level 2 has no such promise. `saveToStorage` **re-throws** (line 415), inside the mutation handler,
so the throw propagates to `Transaction.commit()`, which sets `error`, calls `this.rollback()`, and
rethrows (`transactions.ts:528–547`). The collection and storage stay consistent: the row is
removed from the optimistic overlay and was never written.

This is tested. `packages/db/tests/local-storage.test.ts:1511` — "should handle storage.setItem
failures gracefully" — injects a `throw new Error('QuotaExceededError: Storage full')` and asserts
`await expect(tx.isPersisted.promise).rejects.toThrow()`.

**The residual hazard is where the error surfaces, not whether it is swallowed at the storage
layer.** `collection.insert()` ends with `directOpTransaction.commit().catch(() => undefined)`
(`mutations.ts:253`), with the source comment *"Errors still reject `tx.isPersisted.promise`; this
catch only prevents global unhandled rejections."* So if the app calls `collection.insert(…)` and
never awaits the returned transaction's `isPersisted` promise — which is exactly what the docs'
own examples do, `userPreferencesCollection.insert({ id: 'theme', mode: 'dark' })` — a quota
failure produces a `console.error`, a silent rollback, and **no UI signal whatsoever**. Handling it
is the app's job and requires awaiting the transaction.

For contrast, the D7 shape is still present verbatim in the currently published
`@tanstack/db-sqlite-persistence-core@0.2.12`, `package/src/persisted.ts:2476–2491`:

```ts
params.commit()
if (!openTransaction.internal) {
  void runtime
    .persistAndBroadcastExternalSyncTransaction({ … })
    .catch((error) => { console.warn(`Failed to persist wrapped sync transaction:`, error) })
}
```

In-memory commit first; durable write fire-and-forget; failure downgraded to `console.warn`. Level
2 does the reverse in both respects.

### 2.5 Serialization

`parser` defaults to the global `JSON` (line 380) and is swappable via `config.parser`
(lines 81–85, `{ parse, stringify }`). Every mutation is pre-flighted through
`validateJsonSerializable` (lines 133–146), which calls `parser.stringify` and converts a throw
into a `SerializationError` — so a `BigInt` or a cycle fails the *transaction* rather than
corrupting the key. What it does **not** do is round-trip: a `Date` goes in and a string comes
back, silently. The library's own test fixtures use `createdAt: new Date()` throughout and never
assert the restored type.

## 3. What the issue tracker actually holds against level 2

Searched `repo:TanStack/db` on 2026-08-15 via the GitHub search API, four ways: for
`localStorageCollectionOptions` in title or body (9 results), for `localStorage` in title (2), for
`localStorage` restricted to open issues (7), and for the phrase `"local storage"` in open issues
(6).

**Open, and actually about `localStorageCollectionOptions`: one.**

| # | Opened | Last activity | State | What it is |
| --- | --- | --- | --- | --- |
| [#471](https://github.com/TanStack/db/issues/471) — "useLiveQuery returning stale results when querying local storage collection" | 2025-08-29 | 2025-10-16 | **open** | Live-query result reverts to pre-mutation data until refresh. Maintainer `samwillis` replied 2025-10-04: *"I've tried to reproduce it but not be able to so far… A reproduction would be ideal."* No repro was supplied. Filed against a 0.1.x/0.2.x-era `@tanstack/db`; the last comment is ten months old. |
| [#1058](https://github.com/TanStack/db/issues/1058) — "feat: add writeUpsert util to localstorage collection" | 2025-12-20 | 2026-01-27 | open | Feature request, not a defect. |

**Closed, and fixed:**

| # | Opened → closed | What it was |
| --- | --- | --- |
| [#397](https://github.com/TanStack/db/issues/397) | 2025-08-11 → 2025-11-18 | `update`/`delete` always applied to the *last* item regardless of the id passed. Closed as completed. The current code's use of `mutation.key` — "Use the engine's pre-computed key for consistency", lines 455, 489, 518 — is that fix. |
| [#755](https://github.com/TanStack/db/issues/755) | 2025-11-04 → **2025-11-05** | "localStorageCollectionOptions performance issues": ~20 fps rendering under a hundred objects, buttery smooth on `localOnlyCollectionOptions`. Closed as completed the next day. |
| [#955](https://github.com/TanStack/db/issues/955) | 2025-12-03 → 2026-02-17 | `acceptMutations` collection-matching bug — reported as **`localOnly` failing where `localStorage` worked**, i.e. level 2 was the working reference implementation. |
| [#203](https://github.com/TanStack/db/issues/203) | 2025-06-25 → 2025-07-03 | The PR that introduced the feature. |

The remaining hits (#873, #1186, #1453, #630, #374) are not about this code path; #1453 is an open
PR against `persistedCollectionOptions`, i.e. level 3.

**Test coverage.** `packages/db/tests/local-storage.test.ts` at `main` is **2,105 lines and 45
tests** across 16 `describe` blocks, including `cross-tab synchronization`, `Rapid mutations and
cache consistency`, `Cross-tab sync during mutations`, `acceptMutations edge cases`, `Storage write
failure scenarios`, and `lastKnownData consistency`. It contains **zero** `it.fails`, `it.skip`,
`it.todo` or `describe.skip`. That is the direct counterpart to the RFC's ground-truth branch,
where three `it.fails` remain.

## 4. D7 and D8 status, re-checked today

The existing research recorded these as unfixed on **2026-07-13** and flagged the check as stale.
Re-verified 2026-08-15:

| Fact | Status on 2026-08-15 | Evidence |
| --- | --- | --- |
| RFC [#1659](https://github.com/TanStack/db/issues/1659) | **still open**, still Draft, body still dated "updated 2026-07-13" | GitHub API: `state=open`, `updated_at=2026-07-25T15:28:11Z` |
| The `it.fails` ground-truth tests | **still failing, still on the branch** | `explore-persistence-electric-sqlite`, `packages/db-sqlite-persistence-core/tests/review-claims.test.ts`, three `it.fails` at lines 166, 197, 248 — the last two being *"does not silently drop a committed sync transaction when the disk write fails"* (D7) and *"persists an accepted optimistic mutation so it survives restart before the sync stream echoes it"* (D8). Branch head is `2026-07-10T14:51:23Z`, untouched since. |
| D7's mechanism in shipped code | **still present in the newest published release** | `@tanstack/db-sqlite-persistence-core@0.2.12`, published 2026-08-13, `package/src/persisted.ts:2476–2491`, quoted in §2.4 |
| [#1456](https://github.com/TanStack/db/issues/1456) (D8's issue) | **open**, last activity 2026-06-04 | GitHub API |
| [#82](https://github.com/TanStack/db/issues/82) "Offline-First Support" | **open**, opened 2025-05-14 | GitHub API |
| [#865](https://github.com/TanStack/db/issues/865) "Persistence of synced data" | **open**, last activity 2026-04-28 | GitHub API |

**Nothing has been fixed. One thing got worse:** a new comment on the RFC, `iwimarin`,
**2026-07-25** — after the date the previous research read — is a production report of D7 in the
wild:

> Production report for D7 / invariant 7: we observed a persisted Electric replica whose resume
> marker advanced past rows that did not make it into its SQLite materialization. On the next boot
> the valid-looking resume offset meant the missing rows were never re-sent. The triggering
> condition is consistent with the fire-and-forget persistence path
> (`void runtime.persistAndBroadcastExternalSyncTransaction(...).catch(...)`): the in-memory source
> commits and downstream resume metadata can progress even if a durable write fails.
> — <https://github.com/TanStack/db/issues/1659#issuecomment>, 2026-07-25

And the RFC has explicitly **deferred** the D8 fix out of the hardening series:

> 3. **Offline outbox (D8).** Persisting pending sync-present mutations is genuinely new behavior
>    (the #865 "persisted base + pending delta" design) and is out of scope for this hardening
>    series. Decide whether to document the current contract loudly ("electric+persistence does not
>    persist unconfirmed writes") as an interim step.
> — #1659, §5 "Open decisions"

## 5. The answer, in one paragraph

**`localStorageCollectionOptions` does not share the RFC's defect class — it is a separate,
well-tested, 874-line file with one open unreproduced issue — but it reaches the same
user-visible outcome as D8 by design rather than by bug, whenever the collection is server-backed.**
D7's specific mechanism (write-behind persistence whose failure is swallowed) is structurally
absent: level 2's write is in the mutation path and throws, and there is a passing test for the
quota case. D8's *symptom* — "offline writes die on reload" — is reproduced exactly, because the
first-party pattern for a level-2 collection with an `onInsert` handler, and the documented pattern
for manual transactions, both persist to `localStorage` **after** the server accepts. A level-2
collection is therefore durable-by-construction only when nothing about it talks to a server; the
moment it does, unconfirmed writes are memory-only until the network round-trip completes.

That is a narrow and precise finding, and it lands on #24 as a shape question rather than a
quality question: level 2 is a fine **local cache with a server mirror**, and is not, by itself,
an **offline write store**. The library's own answer for the second thing is level 4,
`@tanstack/offline-transactions` — the outbox — which `docs/research/tanstack-db.md` §4.4–4.5 already
covers and which the RFC does not audit either.

## 6. Two smaller findings from the same read

**The docs and the source disagree about `id`.** `docs/collections/local-storage-collection.md`
lists `id` under **"Required Options"**. The source defaults it: `const collectionId = id ??
\`local-collection:${config.storageKey}\`` (line 545), and the type makes it optional. Harmless,
but it is the kind of drift that says how closely this page is maintained.

**The docs name this app's exact ephemeral use case.** Under "Use Cases":

> LocalStorage collections are perfect for: User preferences and settings · UI state that should
> persist across sessions · **Form drafts** · Recently viewed items · User-specific configurations ·
> Small amounts of cached data
> — <https://github.com/TanStack/db/blob/main/docs/collections/local-storage-collection.md>

That is the readiness draft and the assessment draft, named. §11 prices what using it for them
would actually cost, since that is a live option for #18.

---

# Question B — the survey

## 7. What is actually being replaced

Three stores, all localStorage-only, all with a Svelte implementation that has to be rewritten in
React regardless of what wins.

| Store | Where it lives today | Shape | Write trigger | Measured size |
| --- | --- | --- | --- | --- |
| **Rest timer** | `src/lib/timerStore.svelte.ts:350–380`, key `sendlab:timer` | 16 flat fields (strings, numbers, booleans, one `undefined`-able `key`) | `$effect` over the whole `timer` rune → serialises on **every** field change, and `tick()` mutates `remaining` on a **1000 ms `setInterval`** | **201 bytes** for a representative running snapshot (`JSON.stringify` of a mid-set state, measured) |
| **Readiness draft** | `src/lib/readinessDraft.ts`, key `sendlab:readinessDraft` | `{ day: ISO date, answers: Record<string, …>, probe: number \| null }` | explicit `saveReadinessDraft(…)` call | order of a few hundred bytes |
| **Baseline wizard draft** | `src/lib/AssessmentForm.svelte:44, 126, 198`, key `sendlab:assessmentDraft` | 15-field snapshot including a `baseline` record | `$effect` over the snapshot → every wizard field change | order of 1 KB |

Three properties of the current implementation are worth stating because they are requirements in
disguise:

1. **Restore is synchronous and happens at module scope**, before first paint
   (`timerStore.svelte.ts:361–376`, `readinessDraft.ts:11–22`, `AssessmentForm.svelte:41–48` used as
   the `$state` initialiser). Nothing flashes a default value. Anything asynchronous — IndexedDB,
   or a React store that hydrates in an effect — changes this observable behaviour.
2. **Corrupt storage is swallowed, deliberately**, in all three: `catch { /* ignore corrupt
   storage */ }`, `catch { // corrupt draft — start fresh }`, `catch { return null }`.
3. **Cross-tab sync is absent, deliberately.** Nothing listens to `storage`. For the timer this is
   arguably correct: two tabs each running their own `setInterval` would fight over `remaining`
   every second. **Cross-tab sync is not automatically a feature here** — for one of the three
   stores it is a hazard, so the ability to turn it *off* matters as much as having it.

## 8. The platform facts the whole comparison rests on

- **The `storage` event never fires in the tab that made the change.** *"The event is not fired on
  the window that made the change."* For `localStorage`, *"the event is fired in all other browsing
  contexts that are in the same origin as the initiating document. This includes other tabs with
  the same origin."*
  — <https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event>, read 2026-08-15.
  **Consequence:** every library below must carry a *second*, same-tab notification channel if two
  React components are to share one key. How each does that is the single biggest behavioural
  difference in the survey.
- **Web Storage is synchronous.** *"Both `sessionStorage` and `localStorage` in Web Storage are
  synchronous in nature… blocking the execution of other JavaScript code until the operation is
  completed."*
  — <https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API>
- **The quota is 5 MiB per origin and overflow throws.** *"Browsers can store up to 5 MiB of local
  storage… Once this limit is reached, browsers throw a `QuotaExceededError` exception which should
  be handled by using a `try...catch` block."*
  — <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>.
  At ~1.5 KB total across three keys this app is at roughly **0.03%** of the budget. Quota is not a
  realistic failure mode here; *storage being unavailable* is.
- **The brief's "Safari private mode throws" is out of date as a general claim.** MDN now states:
  *"In private mode, `localStorage` is treated like `sessionStorage`. The storage APIs are still
  available and fully functional, but all data stored in the private window is deleted when the
  browser or browser tab is closed."*
  — <https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API>.
  The throwing cases that remain are real but narrower, and `use-local-storage-state`'s source
  enumerates them with issue links: Firefox with `dom.storage.enabled=false` makes `localStorage`
  `null`; Safari with cookies disabled throws `SecurityError: The operation is insecure.` on
  *access*; and quota overflow throws on write
  (`node_modules/use-local-storage-state/src/useLocalStorageState.js`, comments at the `getSnapshot`
  and `setState` `try` blocks, v20.0.0). Note the second one throws on *reading the object*, which
  means a naive `typeof localStorage !== 'undefined'` guard is not enough.
- **IndexedDB serialises with the structured clone algorithm, not JSON.** That is what makes `Date`
  round-trip, and it is the only real serialization argument for moving off `localStorage`. It is
  also asynchronous, which is the argument against.

### 8.1 How the bundle sizes below were measured

Not looked up. For each candidate, a minimal real-usage entry file was bundled with
**esbuild 0.25.12** (`--bundle --minify --format=esm --platform=browser`) with `react`,
`react-dom` and `use-sync-external-store` marked external — React because it is already in the app,
the shim because it is a shared optional peer that would otherwise be counted differently per
candidate — and the output gzipped at level 9. Packages were resolved from their published npm tarballs at the
versions in the table above. This measures *what the app would actually add*, after tree-shaking,
which is the number that matters and which none of these projects publishes in this form.

## 9. The results table

| Option | Version | min | **min + gzip** | Cross-tab | Same-tab multi-instance | Write throttling | On write failure | `Date` |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- |
| **hand-rolled, minimal** (§10.7) | — | — | ~0 | no | no | none | your choice | string |
| **hand-rolled, full** (§10.7) | — | — | ~0.3 KB | yes | yes | none | your choice | string |
| **`use-local-storage-state`** | 20.0.0 | 1,271 B | **680 B** | yes, opt-out | yes, module-level callback set | none | in-memory fallback + `isPersistent: false` | string |
| **`usehooks-ts` `useLocalStorage`** | 3.1.1 | 4,174 B | **1,880 B** | yes | yes, `local-storage` CustomEvent | none | `console.warn`, **and the React state is not updated either** | string |
| **`zustand` + `persist`** | 5.0.15 | 2,685 B | **1,360 B** | **no** | yes (one store) | none | throws out of `set()` | string |
| **`zustand` core only** | 5.0.15 | 640 B | **417 B** | n/a | yes | n/a | n/a | n/a |
| **`jotai` + `atomWithStorage`** | 2.20.2 | 11,519 B | **4,665 B** | yes | yes (one atom) | none | throws out of the atom setter | string |
| **`jotai` core only** | 2.20.2 | 9,978 B | **4,105 B** | n/a | yes | n/a | n/a | n/a |
| **`@tanstack/react-store`** | 0.11.1 | 4,313 B | **1,778 B** | **no persistence at all** | yes | n/a | n/a | n/a |
| **`idb-keyval`** | 6.3.0 | 676 B | **390 B** | **no change events** | no | n/a (async) | promise rejects | **survives** |
| **`localforage`** | 1.10.0 | 30,544 B | **9,896 B** | no change events | no | n/a (async) | promise rejects | survives |
| **`dexie`** | 4.4.5 | 100,172 B | **32,623 B** | yes, `BroadcastChannel` | yes, `liveQuery` | n/a (async) | promise rejects | survives |
| **`@tanstack/db` level 2** (`createCollection` + `localStorageCollectionOptions`, no live query) | 0.7.2 | 94,696 B | **26,344 B** | yes | yes | none | rethrows → rollback | string |
| **`@tanstack/db` level 2 + `useLiveQuery`** | 0.7.2 / 0.2.1 | 212,430 B | **60,772 B** | yes | yes | none | rethrows → rollback | string |

**Nothing in this list throttles writes.** Every option writes on every state change,
synchronously for the `localStorage`-backed ones. At 201 bytes once per second that is a
non-issue — but it is a fact about all of them equally, so it cannot discriminate between them, and
any option that needs throttling needs it hand-added. Zustand had a community PR for exactly this,
[#3499 "feat(persist): add equalityFn for redundant write dedupe"](https://github.com/pmndrs/zustand/pull/3499),
and it was **closed without merging**.

## 10. Per option

### 10.1 `zustand` 5.0.15 + `persist`

Source read: `https://github.com/pmndrs/zustand/blob/main/src/middleware/persist.ts` (403 lines).

**API shape.** `create(persist(stateCreator, { name, storage, partialize, version, migrate,
merge, onRehydrateStorage, skipHydration }))`. Reads are `useStore(s => s.field)`; writes are
`set(partial)`. Zero runtime dependencies; `react`, `@types/react`, `immer` and
`use-sync-external-store` are all optional peers.

**Cross-tab: none, and undocumented.** `persist.ts` contains **no** `addEventListener` and no
`BroadcastChannel` — grep-verified against the file at `main`. Independently, the 1,002-line
official reference page
(`https://github.com/pmndrs/zustand/blob/main/docs/reference/middlewares/persist.md`) mentions
"tab", "storage event", "BroadcastChannel", "throttle", "debounce" and "quota" **zero times each**.
There is also no open issue asking for it. Two tabs with a persisted zustand store diverge
silently, last-writer-wins on the key.

**Write path.** Two wrappers, both unconditional (lines 213–243):

```ts
const setItem = () => {
  const state = options.partialize({ ...get() })
  return storage.setItem(options.name, { state, version: options.version })
}
const savedSetState = api.setState
api.setState = (state, replace) => { savedSetState(state, replace); return setItem() }
const configResult = config((...args) => { set(...args); return setItem() }, get, api)
```

Every `set` writes the whole partialized state. Synchronous with `createJSONStorage(() =>
localStorage)`.

**Write failure.** `createJSONStorage`'s `setItem` is `storage.setItem(name, JSON.stringify(…))`
with **no `try`/`catch`** (lines 56–57). The only `try` in the whole file guards *acquiring* the
storage object (lines 36–39) and the async-hydration path. So a `QuotaExceededError` propagates
synchronously out of `set()` — i.e. out of your event handler and into React's error boundary. A
community PR to fix this,
[#3441 "fix(persist): handle storage write errors gracefully"](https://github.com/pmndrs/zustand/pull/3441),
was **closed without merging** (checked 2026-08-15).

**What the project says about its own helper.** Merged 2026-07-09 in
[#3541](https://github.com/pmndrs/zustand/pull/3541), now in the reference docs:

> **Note:** `createJSONStorage` is a convenience helper suited for quick prototyping. It uses
> `JSON.parse`/`JSON.stringify` without runtime validation, so unexpected or corrupted data in
> storage is not caught. For production applications, implement a custom `PersistStorage` that
> validates the persisted value, for example using a schema validation library like
> [Zod](https://zod.dev).

This is a direct answer to #18's question 4 about validation at the boundary — the same answer the
MCP research reached about `sanitizeState`: the boundary check is hand-written either way.

**TypeScript.** Ships its own `index.d.ts`, no `@types` package. Known friction: the `persist`
middleware's type gymnastics are the reason zustand ships a
`ts_version_4.5_and_above_is_required.d.ts` sentinel file; typed middleware composition
(`persist` + `immer` + `devtools`) is the part users file issues about. The store is a single
object, so the branded-identity types #18 wants are ordinary TS and not affected.

**Maintenance.** 3 open issues on 58,570 stars is the strongest maintenance signal in this
document. Released 2026-08-13.

**Vite / client-only:** yes. No build-step requirement, no plugin.

### 10.2 `@tanstack/react-store` 0.11.1

**It has no persistence story, and the maintainers have said where the story is meant to live.**

`packages/store/src/index.ts` at `main` exports exactly `./types`, `./atom`, `./store`, `./shallow`.
`packages/react-store/src/index.ts` re-exports all of that and adds hooks only
(`createStoreContext`, `useCreateAtom`, `useCreateStore`, `useSelector`, `useAtom`, `_useStore`,
and a deprecated `useStore`). There is no storage adapter, no `persist`, no `localStorage`
reference.

A PR proposing one, [TanStack/store#246 "feat: add state persistence support"](https://github.com/TanStack/store/pull/246),
was **closed unmerged** on 2025-12-01 with:

> we already have a separate [TanStack Persister](https://github.com/TanStack/persister) project
> that I started 6 months ago. It may be best to keep that stuff separate. I would hope that we
> would need minimal changes to the core store package to interact with persister.
> — `KevinVandy`, 2025-12-01

That referred project, now `TanStack/persist`, is: **32 stars, `@tanstack/persister@0.1.1`
published 2025-07-12 — thirteen months ago — 650 weekly downloads, 1 open issue, last commit
2026-05-01 (`chore: rename packages to tanstack persist`) with no release since.**

So the honest statement is: TanStack Store is a fine minimal store (1,778 B gzipped with the React
binding, more than zustand's 417 B because the entry pulls `atom` and `shallow` alongside `Store`),
and its persistence answer is a project that has not shipped in over a year.

### 10.3 `jotai` 2.20.2 + `atomWithStorage`

Source read: `https://github.com/pmndrs/jotai/blob/main/src/vanilla/utils/atomWithStorage.ts`
(269 lines).

**API shape.** `atomWithStorage(key, initialValue, storage?, { getOnInit? })`, consumed with
`useAtom`/`useAtomValue`. Also ships `createJSONStorage`, `withStorageValidator` (a typed guard
wrapper — the only first-party validation hook in this whole survey), a `RESET` sentinel that
removes the key, and first-class async-storage support.

**Cross-tab: yes, and correct.** `createJSONStorage` installs a subscriber (lines 159–180):

```ts
const storageEventCallback = (e: StorageEvent) => {
  if (e.storageArea === getStringStorage() && e.key === key) callback(e.newValue)
}
window.addEventListener('storage', storageEventCallback)
```

Both `key` and `storageArea` are checked; it guards `getStringStorage() instanceof window.Storage`
before installing, so a custom non-`Storage` backend degrades to a no-op rather than
misbehaving — a nicer failure than TanStack DB's silent identity-check miss (§2.3). The
subscription is installed in `baseAtom.onMount`, so it is live only while the atom is mounted.

**The documented gotcha, and it is the athlete's exact complaint.** From the official docs:

> **getOnInit** (optional, by default **false**): A boolean value indicating whether to get item
> from storage on initialization. **Note that in an SPA with `getOnInit` either not set or `false`
> you will always get the initial value instead of the stored value on initialization.** If the
> stored value is preferred set `getOnInit` to `true`.
> — <https://github.com/pmndrs/jotai/blob/main/docs/utilities/storage.mdx>, lines 46 and 159

The docs then spell out the console trace: `LOG "symbol" SOL_USDC (initial render)` followed by
`LOG "symbol" BTC_USDC (after storage loads)`. This app is an SPA by ADR 0006, so the default is
wrong for it and `getOnInit: true` is mandatory on all three stores. It is a one-word fix that is
easy to forget on the fourth store someone adds. Note this is **not** an SSR concern — it happens
in a pure client render.

**Write failure.** `setItem` is `getStringStorage()?.setItem(key, JSON.stringify(newValue, replacer))`
with no `try`/`catch` (lines 138–142). Throws out of the atom setter. `getItem` *is* guarded and
falls back to `initialValue` on a parse error (lines 121–128).

**Cost.** 4,665 B gzipped, of which 4,105 B is jotai core. Adopting `atomWithStorage` means
adopting jotai's atom model for these three values — which is only sensible if jotai is also the
answer for interactive UI state.

### 10.4 `use-local-storage-state` 20.0.0

Source read: the published tarball, `package/src/useLocalStorageState.js`, **137 lines total.**
Small enough to audit in full, which was done.

**API shape.**
`const [value, setValue, { isPersistent, removeItem }] = useLocalStorageState(key, { defaultValue, serializer, storageSync, defaultServerValue })`.
Zero runtime dependencies. Peers: `react >=18`, `react-dom >=18`.

**Correctness properties, each verified in source:**

- **`useSyncExternalStore`**, not `useState` + `useEffect`. This is the React-18-correct primitive
  for an external mutable source, with a `useRef`-held snapshot cache so identity is stable.
- **Two notification channels.** A module-level `callbacks: Set` fires all hooks on the same key in
  the *same* tab (`triggerCallbacks(key)` at the end of `setState` and `removeItem`), and a
  `window.addEventListener('storage', …)` handles other tabs, guarded on both
  `e.key === key` **and** `e.storageArea === localStorage`.
- **Cross-tab is opt-out.** `storageSync: false` skips the listener entirely — *"If you set to
  `false`, updates won't be synchronized across tabs, windows and iframes"* (readme). This is the
  only library in the survey with a first-class switch for it, and per §7 the rest timer is a case
  that wants it off.
- **Failure is a first-class state, not an exception.** `setState` does
  `try { localStorage.setItem(…); inMemoryData.delete(key) } catch { inMemoryData.set(key, value) }`
  and then notifies regardless. Reads consult `inMemoryData` first. The hook returns
  `isPersistent: !inMemoryData.has(key)` so the UI can say so. The readme documents the intent —
  quoted verbatim, so it uses its own vocabulary rather than this repo's:
  *"In-memory fallback when `localStorage` throws an error and can't store the data. Provides a
  `isPersistent` API to let you notify the user their data isn't currently being stored."*
- **`undefined` is handled.** `parseJSON` maps the literal string `"undefined"` back to the value
  `undefined`, with a source comment explaining that `JSON.parse(JSON.stringify(undefined))` would
  otherwise blow up.
- **Corrupt JSON falls back to the default**, silently — same policy the three current stores use.

**`Date`, stated by the project itself:**

> JSON does not serialize `Date`, `Regex`, or `BigInt` data. You can pass in
> [superjson](https://github.com/blitz-js/superjson) or other `JSON`-compatible serialization
> library for more advanced serialization.
> — readme, v20.0.0

**Scope limits, stated plainly.** It is one hook over one key. It is **not** a store: it has no
selectors, no way to hold non-persisted interactive state, and nothing for #18's other half. If it
were adopted for the three ephemeral values, something else still has to hold the interactive UI
state. Sibling packages by the same author cover adjacent cases (`use-storage-state`,
`use-session-storage-state`, `use-db`), each with the same one-hook shape.

**Maintenance.** One maintainer, 1,231 stars, 6 open issues, v20.0.0 on 2026-07-16, commits the
same day. The project's own claim is *"Actively maintained for the past 4 years"* in the readme,
while the commit *"✏️ update readme: 6 years maintained"* on 2026-07-16 says six; the readme body
still says four. Bus factor of one is the real risk, mitigated by the code being 137 auditable
lines you could vendor.

### 10.5 `usehooks-ts` 3.1.1 `useLocalStorage`

Source read: `https://github.com/juliencrn/usehooks-ts/blob/master/packages/usehooks-ts/src/useLocalStorage/useLocalStorage.ts`
(191 lines).

**API shape.** `const [value, setValue, removeValue] = useLocalStorage(key, initialValue, {
serializer, deserializer, initializeWithValue })`. `setValue` accepts an updater function, so it
reads like `useState`.

**Cross-tab: yes, plus a same-tab custom event.** It listens to `storage` *and* to a bespoke
`'local-storage'` event that `setValue` dispatches itself:

```ts
window.dispatchEvent(new StorageEvent('local-storage', { key }))
```

with the source comment *"this only works for other documents, not the current one"* on the
`storage` listener. Correct approach; note that the same-tab event is **global**, so every
`useLocalStorage` instance in the app re-reads its key on any write by any other instance —
`handleStorageChange` early-returns only when the incoming event carries a `key` that differs.

**Write failure: the sharpest difference in the survey.** The write and the state update are inside
one `try`:

```ts
try {
  const newValue = value instanceof Function ? value(readValue()) : value
  window.localStorage.setItem(key, serializer(newValue))
  setStoredValue(newValue)                       // ← only reached if setItem succeeded
  window.dispatchEvent(new StorageEvent('local-storage', { key }))
} catch (error) {
  console.warn(`Error setting localStorage key “${key}”:`, error)
}
```

**If the write throws, React state is not updated either.** The UI silently refuses the change and
logs a warning. `use-local-storage-state` does the opposite: it keeps the value in memory and tells
you it is not persisted. Neither is wrong, but they are opposite policies and the choice is
observable to the athlete.

**Implementation model.** `useState` + `useEffect` + `useEventListener`, not `useSyncExternalStore`.
`readValue` is a `useCallback` with `initialValue` in its dependency array, so passing an inline
object or array literal as the initial value changes the callback's identity on every render and
re-registers the listeners each time. Memoize or pass a factory.

**`undefined`** is handled (`if (value === 'undefined') return undefined`). Parse errors
`console.error` and fall back.

**Maintenance is the problem.** `master`'s top commit is **2025-02-05**, the same day as the last
release; the last two commits are `🔖 Update version` and a peer-dependency bump for React 19.
**126 open issues.** The repo's `pushed_at` reads 2026-08-14, which is why it looks alive at a
glance — that is traffic on non-default branches. Eighteen months without a default-branch commit,
on a grab-bag library declaring **32** `use*` hooks in its published `dist/index.d.ts`, is the fact
to weigh. Bundle cost is 1,880 B gzipped for the
one hook after tree-shaking, which is fine; but the barrel entry also pulls `lodash.debounce`
into the resolution graph, so the tree-shaking has to work for that number to hold.

### 10.6 Moving off `localStorage`: `idb-keyval`, `localforage`, `dexie`

The question is whether IndexedDB is worth it at ~1.5 KB across three keys. Facts, then the shape
of the trade.

**`idb-keyval` 6.3.0** — 390 B gzipped, the smallest thing in this document. Fourteen exported
functions (`get`, `set`, `setMany`, `getMany`, `update`, `del`, `delMany`, `clear`, `keys`,
`values`, `entries`, `createStore`, `promisifyRequest`, `UseStore`), all promise-returning, all
tree-shakeable. Its own readme: *"It's small and tree-shakeable. If you only use get/set, the
library is 295 bytes (brotli'd)."* **No change events at all** — grep for `addEventListener` and
`BroadcastChannel` in `dist/index.js` returns zero. There is no React binding; you write the hook.
Apache-2.0 (npm reports the license as `NOASSERTION` on GitHub's side; the package declares
`Apache-2.0`).

**`localforage` 1.10.0** — 9,896 B gzipped. **Last release 2021-08-18 — five years ago. Last
default-branch commit 2024-07-30. 250 open issues.** Its value proposition is fallbacks to
WebSQL and `localStorage` for browsers that this app does not support. `idb-keyval`'s own readme
makes the comparison: *"localForage offers similar functionality, but supports older browsers with
broken/absent IDB implementations. Because of that, it's orders of magnitude bigger (~7k)."* The
8.4 M weekly downloads are inertia, not maintenance.

**`dexie` 4.4.5** — 32,623 B gzipped, plus `dexie-react-hooks` 4.4.0 for `useLiveQuery`. Actively
released (2026-08-14). It is the only IndexedDB option here with cross-tab reactivity: `dexie.mjs`
line 6490 constructs a `BroadcastChannel` and propagates change parts to other tabs, and closes it
on `pagehide` for bfcache safety. It is also a full query layer with schema versioning and
migrations — for three ephemeral values it is 32 KB to hold 1.5 KB.

**What IndexedDB buys and what it costs, at this size:**

| | `localStorage` | IndexedDB |
| --- | --- | --- |
| `Date`, `Map`, `Set`, `ArrayBuffer` | lost (JSON) unless you add a serializer | preserved (structured clone) |
| Read at startup | **synchronous**, available before first paint | asynchronous — the value arrives after a render |
| Write on the way out | synchronous `setItem` completes | a transaction started at `pagehide` may not commit |
| Quota | 5 MiB/origin | much larger, irrelevant here |
| iOS ITP | deleted after 7 idle days unless installed | **identically deleted** — WebKit's policy covers "localStorage, Cache API, IndexedDB, Service Worker, and File System" (webkit.org/blog/14403, and `docs/research/framework-tanstack-start.md` §5) |

**The two rows that decide it are the synchronous ones, and they are exactly the rest timer's
requirements.** Today the timer restores at module scope before paint and re-arms its interval
(`timerStore.svelte.ts:361–376`); an async read means a visible flash of `idle` or a suppressed
render. Durability is *not* an argument for IndexedDB here, because ITP deletes both alike.

### 10.7 The hand-rolled baseline, measured honestly

The brief calls this "~30 lines". It is 24 or 63 depending on which properties you keep, and being
precise about which is the point of including it.

**Minimal — no cross-tab, no same-tab sharing, no in-memory fallback: 24 lines, 23 non-blank.**

```ts
import { useCallback, useState } from 'react'

export function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  })
  const set = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* quota or disabled storage — keep the in-memory value */
      }
    },
    [key],
  )
  return [value, set] as const
}
```

This is a faithful port of what the three Svelte stores do today, including the
swallow-corrupt-storage policy, and it is genuinely enough for all three of them *if* nothing
else in the app reads the same key.

**Full — `useSyncExternalStore`, same-tab sharing, opt-out cross-tab, in-memory fallback,
`isPersistent`: 63 lines, 56 non-blank.** That version was written out and counted; it is
essentially `use-local-storage-state`'s 137 lines with the SSR path, the custom-serializer option
and the `removeItem` handle removed. Reaching feature parity means re-deriving the same four
subtleties MDN and §8 describe, and the two that are easy to get wrong are the `e.storageArea`
guard and the fact that `storage` does not fire in the originating tab.

**So the honest framing of the baseline is: 24 lines to match today's behaviour exactly, or ~60
lines and one library's worth of subtlety to beat it.** The 680-byte library is the same 137 lines,
tested, with one maintainer.

## 11. Could one option cover both halves of #18?

#18 has to decide two things at once: what holds the three ephemeral persisted values, and what
holds non-persisted interactive UI state (the part TanStack DB is not being adopted for). Which
candidates can answer both:

| Option | Ephemeral persisted | Interactive non-persisted UI state | Notes |
| --- | --- | --- | --- |
| `zustand` + `persist` | yes | **yes** — this is its primary job | One dependency for both. Cost: no cross-tab, and writes throw. Already a live candidate on #18. |
| `jotai` + `atomWithStorage` | yes | **yes** | One dependency for both. Cost: 4.1 KB core, and `getOnInit: true` required on every persisted atom. |
| `@tanstack/react-store` | **no** | yes | Persistence lives in a project with no release in 13 months (§10.2). |
| `use-local-storage-state` | yes, best-in-class | **no** | Would need a second thing for UI state. |
| `usehooks-ts` | yes | no | Same, plus §10.5's maintenance facts. |
| hand-rolled hook | yes | partially (`useState`/context) | The Train page's "don't re-render nine pages when one checkbox ticks" requirement in #18 is what plain context does badly. |
| `@tanstack/db` level 2 | yes (docs name "Form drafts") | yes, via `localOnlyCollectionOptions` | **Zero new dependencies** if TanStack DB is adopted for account data — but see below. |

The last row deserves its own paragraph because it is the only option that could reduce the
dependency count rather than raise it.

**Using TanStack DB level 2 for the ephemeral stores would cost 26.3 KB gzipped without live
queries, or 60.8 KB with** (§9, measured). If TanStack DB is already being adopted for account
data, that cost is already paid and the marginal cost of also holding the timer and the two drafts
is near zero. Two frictions remain, both structural rather than defects:

1. **Everything must become rows with a `getKey`.** `docs/research/tanstack-db.md` §1.1 and §6.2
   already established this. The timer is one object with 16 flat fields, so it becomes a
   one-row collection keyed by a constant — workable but odd. The readiness draft is naturally
   one row per day.
2. **Cross-tab sync is always on** and cannot be switched off (§2.3 — the only escape is a custom
   `storage` object, which breaks the sync by accident rather than by intent). For the rest timer
   that is the hazard named in §7.

## 12. Where the sources' claims do not transfer

Stated because the brief asks for it explicitly.

- **`localforage`'s and `dexie`'s value propositions are about scale and browser breadth.** Dexie's
  schema versioning, compound indexes and query layer are for datasets this app does not have.
  `localforage`'s driver fallbacks target browsers this app does not support.
- **`idb-keyval`'s "295 bytes brotli'd"** is brotli, get/set only. The measurement in §9 is gzip of
  a bundle importing `get`/`set`/`del`, which is why it reads 390 B.
- **`use-local-storage-state`'s "689 B (brotlied)"** readme figure and this document's 680 B gzip
  figure agree closely by coincidence of method; they are different compressions of different
  entry graphs.
- **Every download count in this document is a popularity fact and nothing else.** `localforage`
  outranks `dexie` four to one and has not shipped since 2021.
- **TanStack DB's own performance claims** are scoped to large datasets and, in the launch post, to
  collaborative apps — already recorded in `docs/research/tanstack-db.md` §7.4 and unchanged here.
- **Nothing in this survey was benchmarked.** No claim about rendering speed is made, in either
  direction, including about TanStack/db#755, which is reported as an issue history fact and not as
  a current performance characteristic.

## 13. Staleness warnings on load-bearing facts

- **`@tanstack/db@0.7.2` is two days old** (published 2026-08-13) and seven sibling packages shipped
  the same day. §1–§6 describe a two-day-old release.
- **RFC #1659 is a Draft with active comment traffic.** The 2026-07-25 production report arrived
  after the previous research was written. Re-check before any decision on #24; the **nine** PRs
  the RFC proposes in its §4 could land at any time, and PR 6 is the one that carries D7.
- **`localStorageCollectionOptions` has been stable in shape since #203 (2025-07-03)**, but every
  behavioural claim in §2 is read from `0.7.2`/`main` on 2026-08-15 and is not guaranteed forward.
- **`usehooks-ts`'s 18-month gap and `localforage`'s 5-year gap** are the two facts most likely to
  change (in either direction) and most consequential if they do.
- **MDN's private-browsing statement (§8) contradicts a widely-repeated older claim.** It was read
  2026-08-15 and is not version-stamped by MDN; the specific throwing cases enumerated from
  `use-local-storage-state`'s source remain independently true.

## 14. Open questions this research could not settle

- **UNKNOWN: whether `@tanstack/db`'s level-2 collection has any behaviour under `pagehide` /
  `visibilitychange`.** The source registers no such listener, so a mutation whose handler is
  in-flight when the tab is hidden is subject to §2.2 case 2. Whether the app could compensate with
  its own `pagehide` write was not designed here.
- **UNKNOWN: whether TanStack DB's live-query engine would tree-shake further** than the 26.3 KB /
  60.8 KB measured. The measurement used esbuild with default settings and no `sideEffects`
  overrides; a Vite production build with Rollup may differ. The direction of the difference is not
  known.
- **UNKNOWN: the real-world frequency of the Safari "cookies disabled → `SecurityError` on
  accessing `localStorage`" case.** It is documented in `use-local-storage-state`'s source with an
  issue link, but no incidence data exists.
- **UNKNOWN: whether TanStack/db#471** (the one open level-2 issue) still reproduces on 0.7.2. It
  was never reproduced by the maintainer, has no repro case, and its last comment predates six
  minor releases.
- **Not investigated: `valtio` (2.3.2), `nanostores` (1.5.0), `react-use` (17.6.1),
  `@uidotdev/usehooks` (2.4.1).** Registry metadata was pulled for all four but no source was read.
  `@uidotdev/usehooks` last published **2023-10-23**; `react-use` is Unlicense with fourteen runtime
  dependencies. Named here so the omission is deliberate rather than an oversight.

---

## Sources

Everything below was read on **2026-08-15** unless a different date is given.

### TanStack DB — source

- `packages/db/src/local-storage.ts` at `main` — <https://github.com/TanStack/db/blob/main/packages/db/src/local-storage.ts> (874 lines; verified byte-identical to `package/src/local-storage.ts` in the `@tanstack/db@0.7.2` npm tarball)
- `packages/db/src/collection/mutations.ts`, `packages/db/src/transactions.ts` — from the same tarball
- `packages/db/tests/local-storage.test.ts` at `main` — <https://github.com/TanStack/db/blob/main/packages/db/tests/local-storage.test.ts> (2,105 lines, 45 tests, no `it.fails`)
- `packages/db-sqlite-persistence-core/src/persisted.ts` — from the `@tanstack/db-sqlite-persistence-core@0.2.12` npm tarball
- `packages/db-sqlite-persistence-core/tests/review-claims.test.ts` on branch `explore-persistence-electric-sqlite` — <https://github.com/TanStack/db/blob/explore-persistence-electric-sqlite/packages/db-sqlite-persistence-core/tests/review-claims.test.ts>
- Package list — <https://api.github.com/repos/TanStack/db/contents/packages>

### TanStack DB — documentation and issues

- LocalStorage Collection docs — <https://github.com/TanStack/db/blob/main/docs/collections/local-storage-collection.md>
- `skills/db-core/persistence/SKILL.md`, shipped inside the `@tanstack/db@0.7.2` tarball
- RFC #1659, "Hardening the SQLite persistence / Electric sync stack" — <https://github.com/TanStack/db/issues/1659>
- #471, #1058, #1456, #82, #865, #397, #755, #955, #203, #1453 — `https://github.com/TanStack/db/issues/<n>`

### Other libraries — source

- zustand `src/middleware/persist.ts` — <https://github.com/pmndrs/zustand/blob/main/src/middleware/persist.ts>
- zustand persist reference docs — <https://github.com/pmndrs/zustand/blob/main/docs/reference/middlewares/persist.md>
- zustand PRs [#3541](https://github.com/pmndrs/zustand/pull/3541) (merged 2026-07-09), [#3441](https://github.com/pmndrs/zustand/pull/3441) (closed unmerged), [#3499](https://github.com/pmndrs/zustand/pull/3499) (closed unmerged)
- jotai `src/vanilla/utils/atomWithStorage.ts` — <https://github.com/pmndrs/jotai/blob/main/src/vanilla/utils/atomWithStorage.ts>
- jotai storage docs — <https://github.com/pmndrs/jotai/blob/main/docs/utilities/storage.mdx>
- TanStack Store `packages/store/src/index.ts`, `packages/react-store/src/index.ts` — <https://github.com/TanStack/store>
- TanStack Store PR [#246](https://github.com/TanStack/store/pull/246), closed unmerged 2025-12-01
- TanStack Persist — <https://github.com/TanStack/persist>
- `use-local-storage-state` `src/useLocalStorageState.js` and `readme.md`, from the v20.0.0 npm tarball; repo <https://github.com/astoilkov/use-local-storage-state>
- `usehooks-ts` `useLocalStorage.ts` — <https://github.com/juliencrn/usehooks-ts/blob/master/packages/usehooks-ts/src/useLocalStorage/useLocalStorage.ts>
- `idb-keyval` `dist/index.d.ts`, `dist/index.js`, `README.md`, from the v6.3.0 npm tarball
- `dexie` `dist/dexie.mjs` (BroadcastChannel at line 6490), from the v4.4.5 npm tarball

### Platform

- Window `storage` event — <https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event>
- Web Storage API — <https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API>
- Storage quotas and eviction criteria — <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>
- `Storage.setItem()` — <https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem>
- WebKit, "Updates to storage policy" — <https://webkit.org/blog/14403/updates-to-storage-policy/> (2023-08-10)

### Registry and measurement

- `https://registry.npmjs.org/<package>` and `https://api.npmjs.org/downloads/point/last-week/<package>` for every version and download figure
- `https://api.github.com/repos/<owner>/<repo>` and `/commits` for every repository-health figure
- Bundle sizes measured locally with **esbuild 0.25.12** per §8.1

### This repository

- `CONTEXT.md` — vocabulary
- [ADR 0006](../adr/0006-the-app-is-client-only-with-one-server-seam.md) — the `ssr: false` seam
- `docs/research/tanstack-db.md` on `research/tanstack-db` — §4 (the four persistence levels), §4.7 (the RFC), §7 (bundle cost)
- `docs/research/framework-tanstack-start.md` on `research/framework-tanstack-start` — §5 (iOS ITP)
- `src/lib/timerStore.svelte.ts`, `src/lib/readinessDraft.ts`, `src/lib/AssessmentForm.svelte`
- Issues [#18](https://github.com/YgorPerez/send-lab/issues/18), [#24](https://github.com/YgorPerez/send-lab/issues/24), [#11](https://github.com/YgorPerez/send-lab/issues/11)
