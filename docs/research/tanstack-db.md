# TanStack DB as the local-first substrate — research findings

Resolves ticket [#28](https://github.com/YgorPerez/send-lab/issues/28) of the Next.js rebuild map
([#11](https://github.com/YgorPerez/send-lab/issues/11)). **Research only. This document does not
recommend anything** — the weighing happens on
[#18](https://github.com/YgorPerez/send-lab/issues/18) and
[#24](https://github.com/YgorPerez/send-lab/issues/24) with the athlete. Where a fact has a
consequence, the consequence is stated as a consequence, not as advice.

**Researched 2026-08-15.** Every claim carries a URL and a version or a date. Where a fact could not
be established from a primary source it is marked **UNKNOWN** and the sources checked are named.
Only primary sources were used: the TanStack DB documentation and repository, package READMEs and
source files at `main`, the changesets changelogs, GitHub issues and RFCs, the TanStack and
ElectricSQL announcement posts, the npm registry, MDN's browser-compat-data, and WebKit's own posts.
No third-party write-ups were consulted for any claim.

Two framing facts that shape the whole document, stated up front so nothing below is read out of
scope:

1. **TanStack DB describes itself as BETA and has not shipped 1.0.** Unlike TanStack Start — where
   the npm version disguises the status (see `framework-tanstack-start.md` §1.1) — here the version
   string and the stability claim agree. `@tanstack/db` is `0.7.2` and the README says so.
2. **Every performance claim in the primary sources is scoped to large datasets and, in the launch
   post, to collaborative apps.** This app is a private single-athlete console: ~5 accounts, ~28 KB
   of state, no collaboration, no real-time co-editing. Section 7 and the contradictions section say
   exactly which claims do not transfer.

Question 10 is where the decision turns, and it is the longest section.

---

## Versions this document describes

All read from `https://registry.npmjs.org/<package>` on 2026-08-15 unless noted.

| Thing | Version | Published |
| --- | --- | --- |
| `@tanstack/db` | **0.7.2** | 2026-08-13 |
| `@tanstack/react-db` | **0.2.1** | 2026-08-13 |
| `@tanstack/db-ivm` (the differential-dataflow engine) | **0.1.18** | 2026-03-25 |
| `@tanstack/query-db-collection` | **1.2.4** | 2026-08-13 |
| `@tanstack/offline-transactions` | **1.0.45** | 2026-08-13 |
| `@tanstack/browser-db-sqlite-persistence` | **0.2.12** | 2026-08-13 |
| `@tanstack/db-sqlite-persistence-core` | **0.2.12** | 2026-08-13 |
| `@tanstack/electric-db-collection` | **0.3.18** | 2026-08-13 |
| `@tanstack/svelte-db` (the current stack's binding, for contrast) | **0.2.2** | 2026-08-13 |
| `@journeyapps/wa-sqlite` — declared peer of the browser SQLite adapter | peer range **`^1.4.1`**; npm `latest` is **2.0.3** | 2026-08-13 |
| Documented status | **BETA** | README badge `status-beta`, and the line quoted in §2.3 |

Note the publish dates. **Seven of these shipped 48 hours before this document was written.**
`@tanstack/db@0.7.0` landed 2026-08-12 and `@tanstack/react-db@0.2.0` on 2026-08-13. Anything below
that describes the current API describes a two-day-old API.

---

## 1. What it actually is

### 1.1 Three primitives, and a required shape for your data

The overview page names the model in one list:

> TanStack DB works by:
>
> - **defining collections** typed sets of objects that can be populated with data
> - **using live queries** to query data from/across collections
> - **making optimistic mutations** using transactional mutators
> — <https://tanstack.com/db/latest/docs/overview>, read 2026-08-15

The load-bearing word is *sets of objects*. **A collection is a keyed set of rows, and `getKey` is a
required option on every collection type** — it is listed under "Required Options" on
`localStorageCollectionOptions`, `localOnlyCollectionOptions` and `queryCollectionOptions` alike
(`docs/collections/*.md`, `docs/collections/query-collection.md`). There is no primitive for "a
document" or "a scalar". Anything the app wants to hold has to be expressed as rows with keys. §3.3
and §6 are both consequences of this one fact.

### 1.2 The API surface a consumer touches

From the React binding (`packages/react-db/src/`, read at `main` 2026-08-15) the exported hooks are:

```
useLiveQuery  useLiveSuspenseQuery  useLiveInfiniteQuery  useLiveQueryEffect  usePacedMutations
```

From core (`@tanstack/db`), the consumer-facing functions the docs use are `createCollection`,
`createLiveQueryCollection`, `liveQueryCollectionOptions`, `createOptimisticAction`,
`createTransaction`, the expression helpers (`eq`, `gt`, `isNull`, `not`, …), and the collection
option creators (`localStorageCollectionOptions`, `localOnlyCollectionOptions`, and per-backend ones
from their own packages).

A read looks like this, verbatim from the docs:

> ```ts
> const Todos = () => {
>   const { data: todos } = useLiveQuery((q) =>
>     q
>       .from({ todo: todoCollection })
>       .where(({ todo }) => eq(todo.completed, false))
>       .orderBy(({ todo }) => todo.created_at, 'asc')
>       .select(({ todo }) => ({ id: todo.id, text: todo.text }))
>   )
>   return <List items={ todos } />
> }
> ```
> — <https://tanstack.com/db/latest/docs/overview>

A write looks like this:

> ```ts
> const todoCollection = createCollection({
>   id: "todos",
>   onUpdate: async ({ transaction }) => {
>     const { original, changes } = transaction.mutations[0]
>     await api.todos.update(original.id, changes)
>   },
> })
>
> todoCollection.update(todo.id, (draft) => { draft.completed = true })
> ```
> — same page

### 1.3 What the library owns

- **The reactive read path.** Live queries are compiled to differential dataflow and update
  incrementally: *"TanStack DB live queries are implemented using [d2ts](https://github.com/electric-sql/d2ts),
  a TypeScript implementation of differential dataflow. This allows the query results to update
  _incrementally_ (rather than by re-running the whole query)."* (overview). Filters, joins across
  collections, `orderBy`, `groupBy`, aggregates, `limit`/`offset` and derived collections
  ("Every query returns another collection which can _also_ be queried").
- **Optimistic state and rollback.** *"The collection maintains optimistic state separately from
  synced data. When live queries read from the collection, they see a local view that overlays the
  optimistic mutations on top of the immutable synced data… If the handler throws an error, the
  optimistic state is rolled back."* (overview)
- **Transaction bookkeeping.** Four states — `pending`, `persisting`, `completed`, `failed` — with
  `tx.isPersisted.promise` to await, and automatic rollback on failure
  (`docs/guides/mutations.md#transaction-states`).
- **Intra-transaction mutation merging**, by a documented truth table
  (`insert + update → insert`, `insert + delete → removed`, `update + delete → delete`,
  `update + update → update`) and **paced mutations** (debounce / throttle / queue strategies).
- **Loading strategy.** Three sync modes: *"Eager mode (default): Loads entire collection upfront.
  Best for <10k rows of mostly static data… On-demand mode: Loads only what queries request. Best
  for large datasets (>50k rows)… Progressive mode"* (overview). This app is unambiguously in the
  eager band.
- **Optional runtime validation** via any Standard Schema instance (Zod, Valibot, ArkType, Effect).

### 1.4 What the application still writes

Everything that touches the network, and everything that decides policy:

- **The handlers.** `onInsert`, `onUpdate`, `onDelete` (or a `mutationFn` on a manual transaction)
  are the app's own `fetch` calls. The docs are explicit that these are *"responsible for writing the
  mutation to the backend"*.
- **The endpoint contract.** §3 is the whole of this.
- **Retry.** Stated as a design decision, quoted in full because it matters for #24:
  > **Important:** TanStack DB does not automatically retry failed mutations. If a mutation fails
  > (network error, server error, etc.), the transaction transitions to `failed` state and the
  > optimistic state is rolled back. This is by design.
  > — <https://tanstack.com/db/latest/docs/guides/mutations>
  Retry arrives only if you add `@tanstack/offline-transactions` (§4.4).
- **Conflict policy.** §5. There is none in the library.
- **All UI.** Pending/failed state is exposed as data; nothing renders it for you.

---

## 2. Real maturity, not the version string

### 2.1 Project age: seventeen months, and the React binding is not newer than the engine

- The repository **`TanStack/db` was created 2025-03-11T21:01:29Z**; the oldest commit reachable on
  `main` is **2025-03-19**, *"return collection from preload call (#8)"*, by Sam Willis
  (GitHub API, read 2026-08-15). MIT licensed. **3,865 stars, 284 open issues**, last push
  2026-08-15.
- `@tanstack/db@0.0.1` was published **2025-05-12T21:56:29Z**.
- `@tanstack/react-db@0.0.1` was published **2025-05-12T21:57:03Z** — **34 seconds later.**

That settles the question the ticket asked. **`@tanstack/react-db@0.2.1` is not a young binding over
a mature engine. The binding and the engine are the same age, from the same monorepo, released
together, and versioned together.** They ship in lockstep to this day: every package in the family
published on 2026-08-13 within four seconds of each other.

The only part of the stack that is genuinely older is the query engine's ancestor. The differential
dataflow implementation is `d2ts`, whose repository **`electric-sql/d2ts` was created
2024-11-07T11:25:45Z** (GitHub API); it is vendored into the monorepo as `@tanstack/db-ivm`, first
published 2025-07-29. So the mathematics is about twenty-one months old and the product around it is
seventeen.

For contrast, both `@tanstack/react-db` and `@tanstack/svelte-db` are 0.2.x. The current stack would
be adopting a pre-1.0 binding either way; nothing about the React choice makes this worse.

### 2.2 Release history — and, unlike TanStack Start, real breaking-change documentation

Minor lines and their first release (npm registry, 2026-08-15):

| `@tanstack/db` | first | releases | | `@tanstack/react-db` | first | releases |
| --- | --- | ---: | --- | --- | --- | ---: |
| 0.0.x | 2025-05-12 | 32 | | 0.0.x | 2025-05-12 | 32 |
| 0.1.x | 2025-07-29 | 12 | | 0.1.x | 2025-07-29 | **96** |
| 0.2.x | 2025-09-08 | 6 | | 0.2.x | **2026-08-13** | 2 |
| 0.3.x | 2025-09-17 | 3 | | | | |
| 0.4.x | 2025-09-25 | 21 | | | | |
| 0.5.x | 2025-11-12 | 34 | | | | |
| 0.6.x | 2026-03-25 | 17 | | | | |
| 0.7.x | **2026-08-12** | 3 | | | | |

128 published versions of `@tanstack/db`, 130 of `@tanstack/react-db`, zero majors.

`packages/db/CHANGELOG.md` **does** mark breaking changes, with migration guides. This is a
materially better artefact than the one `framework-tanstack-start.md` §1.5 found on
`@tanstack/react-start`, where no breaking marker exists at all. The dated list:

| Version | Date | Breaking change |
| --- | --- | --- |
| 0.0.5 | 2025-05 | *"Collections must have a getId function & use an id for update/delete operators"* ([#134](https://github.com/TanStack/db/pull/134)) |
| 0.0.6 | 2025-05 | *"Calling `collection.insert()`, `.update()`, or `.delete()` without being inside a `useOptimisticMutation` callback and without a corresponding persistence handler (`onInsert`, etc.) configured on the collection will now throw an error."* |
| 0.0.29 | 2025-08 | Typed error classes; *"Error handling code using string matching will need to be updated to use `instanceof` checks"* |
| 0.2.0 | 2025-09-08 | JOIN optionality; *"Code that previously ignored optionality now requires proper optional chaining syntax."* |
| 0.3.0 | 2025-09-17 | *"`commit()` now throws errors when the mutation function fails (previously returned a failed transaction)"* ([#558](https://github.com/TanStack/db/pull/558)) |
| 0.4.20 | 2025-10/11 | `lastError()`, `isError()`, `errorCount()` became getters rather than methods |
| 0.5.0 | 2025-11-12 | SQL three-valued logic; *"This changes the behavior of `WHERE` and `HAVING` clauses when dealing with `null` and `undefined` values."* `eq(x, null)` now excludes rows; use `isNull()` |
| 0.5.12 | 2025-12 | *"⚠️ Breaking Change for Custom Sync Layers / Query Collections: `LoadSubsetOptions.where` no longer includes cursor expressions for pagination."* ([#960](https://github.com/TanStack/db/pull/960)) |
| 0.6.0 | 2026-03-25 | *"`autoIndex` now defaults to `off` instead of `eager`… `BTreeIndex` is no longer exported from `@tanstack/db` main entry point"* ([#1353](https://github.com/TanStack/db/pull/1353)) |

Read as an upgrade-risk profile: **roughly one breaking change per minor line, every minor line, for
fourteen months, each documented with a migration path.** The honest reading is that the API is
still moving and that the project tells you when it moves. Both halves are true.

One caveat from the most recent release. `0.7.0` introduced `createLiveQueryObserver` and migrated
all five framework adapters onto it, describing it as:

> The observer is an **internal, unstable contract** for TanStack DB's official adapters — it is
> exported so the adapter packages can consume it, but it is not a public extension point yet and
> its API may change in any release.
> — `packages/db/CHANGELOG.md`, 0.7.0

That is a rewrite of the plumbing under every binding, three days old at time of writing.

### 2.3 The stability statements, in the project's own words, in date order

- **2025-07-30**, launch post: *"TanStack DB 0.1 (first beta) is available now."*
  — <https://tanstack.com/blog/tanstack-db-0.1-the-embedded-client-database-for-tanstack-query>
- **2025-11-12**, 0.5 post: *"We're targeting 1.0 for December 2025, focusing on API stability and
  comprehensive docs."* and *"**This is new. We need early adopters.** Query-Driven Sync works and
  ships today, but it's fresh."*
  — <https://tanstack.com/blog/tanstack-db-0.5-query-driven-sync>
- **2026-03-25**, 0.6 post, on the persistence layer this ticket exists to evaluate:
  *"This is the first _alpha_ release of persistence, and so we want to hear your feedback."*
  — <https://tanstack.com/blog/tanstack-db-0.6-app-ready-with-persistence-and-includes>
- **Today**, README at `main`: a `status-beta` badge, and
  > Tanstack DB is currently in BETA.
  > — <https://github.com/TanStack/db/blob/main/README.md>

**The December 2025 target for 1.0 was missed by nine months and has not been renewed anywhere.**
The latest release is 0.7.2. A search of the repository's issues for `1.0` in the title returns
**zero** results (GitHub search API, 2026-08-15) — there is no public 1.0 checklist, and no
equivalent of TanStack Start's `needed-for-start-stable` label.

### 2.4 Two 1.x packages inside a beta product

`@tanstack/query-db-collection` is at **1.2.4** and `@tanstack/offline-transactions` at **1.0.45**.
Both cut `1.0.0` on the same day, **2025-11-12** — the day `@tanstack/db@0.5.0` shipped.
`offline-transactions@1.0.0`'s entire changelog entry is:

> ## 1.0.0
> ### Patch Changes
> - Updated dependencies […]: @tanstack/db@0.5.0
> — `packages/offline-transactions/CHANGELOG.md`

**The leading `1` on the outbox package is version alignment, not a stability declaration** — the
same pattern `framework-tanstack-start.md` §1.1 found on `@tanstack/react-start@1.168.46`. Anyone
reading `@tanstack/offline-transactions@1.0.45` as a mature 1.x is reading a number that was set by a
dependency bump.

### 2.5 Who maintains it, and Electric's role

Top contributors by commit count (GitHub API, 2026-08-15): `KyleAMathews` 388, `github-actions[bot]`
203, `kevin-dp` 127, `samwillis` 122, `renovate[bot]` 33, `thruflo` 14.

ElectricSQL is listed under **Partners** in the README, with its logo. Electric's own account of the
origin, by James Arthur, **2025-07-29**:

> When Electric co-founder Kyle Mathews approached Tanner to work on this, they immediately aligned
> on DX and a vision for incrementally adoptable local-first app development.
> — <https://electric.ax/blog/2025/07/29/local-first-sync-with-tanstack-db>
> (`electric-sql.com` 301-redirects here as of 2026-08-15)

So the four humans with the most commits are Electric-affiliated, the differential-dataflow engine
came from Electric's `d2ts`, and Electric is a commercial partner. That is a concentration fact, not
a quality judgement, and §3 establishes that it does **not** produce a technical dependency on
Electric.

The monorepo maintains bindings for React, Vue, Angular, Solid and Svelte, plus seven collection
adapters and eight SQLite persistence adapters (`packages/` listing, 2026-08-15) — 24 packages.
Maintenance attention is spread wide.

### 2.6 Is anyone running it in production?

**UNKNOWN, and no primary source names one.** Everything found:

- The launch post's only adoption evidence is anonymous and self-labelled pre-beta:
  > One early-alpha adopter, building a Linear-like application, swapped out a pile of MobX code for
  > TanStack DB and told us with relief, "everything is now completely instantaneous when clicking
  > around the app, even w/ 1000s of tasks loaded."
  > — 0.1 post, 2025-07-30
- The 0.6 post's SSR appeal is addressed to teams *planning* production use, not running it:
  > We are exploring SSR support and want input from teams planning to use TanStack DB in production.
  > — 0.6 post, 2026-03-25
- The README has no "who's using this" section. `docs/community/resources.md` lists two unofficial
  community adapters (Dexie, PGlite) and has three empty placeholder sections
  (*"Share your starter templates and boilerplates here"*).

npm downloads for the week 2026-08-03 → 2026-08-09 (`api.npmjs.org/downloads/point/last-week`):
`@tanstack/db` 588,921; `@tanstack/react-db` 527,715; `@tanstack/offline-transactions` 37,254;
`@tanstack/browser-db-sqlite-persistence` 32,119. Recorded as measurements. Download counts include
CI and mirrors and are not evidence of production use, and no argument in this document rests on
them.

---

## 3. Does it require a particular backend?

### 3.1 No. There is a documented, first-party path to an arbitrary endpoint you control

The library's own statement of intent:

> **True backend flexibility**: Work with any data source through pluggable collection creators.
> Whether you're using REST APIs, GraphQL, Electric, Firebase, or building something custom,
> TanStack DB adapts to your stack.
> — 0.1 post, 2025-07-30

and, on sync engines specifically:

> This isn't just about sync engines like Electric (though they make this pattern incredibly
> powerful). It's about enabling a fundamentally different data loading strategy that works with any
> backend: REST, GraphQL, or real-time sync.
> — same post

The concrete mechanism is `@tanstack/query-db-collection`. Its **required options are exactly four**:

> - `queryKey`… `queryFn`: Function that fetches data from the server… `queryClient`: TanStack Query
>   client instance… `getKey`: Function to extract the unique key from an item
> — <https://tanstack.com/db/latest/docs/collections/query-collection>

Nothing about Postgres, shapes, txids, WebSockets or logical replication. `electricCollectionOptions`
is one adapter among seven (`query`, `electric`, `powersync`, `rxdb`, `trailbase`, `localStorage`,
`localOnly`), and the docs' *first* usage example is the REST one, not the Electric one.

There is also a documented escape hatch for a bespoke protocol — the "collection options creator"
pattern. The contract is a `sync` function receiving four callbacks:

> ```typescript
> const sync: SyncConfig<T>['sync'] = (params) => {
>   const { begin, write, commit, markReady, collection } = params
>   …
>   return () => { connection.close() }
> }
> ```
> — <https://tanstack.com/db/latest/docs/guides/collection-options-creator>
>
> 1. **begin()** - Start collecting changes
> 2. **write()** - Add changes to the pending transaction (buffered until commit)
> 3. **commit()** - Apply all changes atomically to the collection state
> 4. **markReady()** - Signal that initial sync is complete

The same guide is explicit that this is overkill for a plain endpoint: *"**Note**: If you're just
hitting an API and returning data, use the query collection instead."*

### 3.2 The contract the endpoint would have to honour

This is the sharp part, and it is a real constraint:

> ### Full State Sync
>
> The query collection treats the `queryFn` result as the **complete state** of the collection. This
> means:
>
> - Items present in the collection but not in the query result will be deleted
> - Items in the query result but not in the collection will be inserted
> - Items present in both will be updated if they differ
>
> ### Empty Array Behavior
>
> When `queryFn` returns an empty array, **all items in the collection will be deleted**. This is
> because the collection interprets an empty array as "the server has no items".
> — <https://tanstack.com/db/latest/docs/collections/query-collection>

And on writes:

> By default, after any persistence handler (`onInsert`, `onUpdate`, or `onDelete`) completes
> successfully, the query will automatically refetch to ensure the local state matches the server
> state.
> — same page; `{ refetch: false }` opts out

So the contract is: **each collection needs an endpoint (or a slice of one) that returns the
complete, keyed set of that collection's rows, and a write path.** Nothing more.

### 3.3 What that means against `/api/state`

Today's server is one JSON document per account. `src/routes/api/state/+server.ts` is 34 lines:
`GET` returns `JSON.parse(row.data)` or `{}`; `POST` takes the request body as text, validates that
it parses, and does a whole-row `onConflictDoUpdate` — **a whole-document replace, not a merge**.
(The REST surface at `src/routes/api/v1/state/+server.ts` additionally offers a deep-merging `PATCH`
and a replacing `PUT`.) The client side is `hydrate()` at `src/lib/state.svelte.ts:396` — cache-first
from `localStorage`, then `fetch('/api/state')` — and `startPersistence()` at `:500`, a 600 ms
debounced `JSON.stringify(appState)` POST.

Two shapes are available, and they are very different bets:

**(a) One collection, one row.** `getKey: () => 'state'`, `queryFn` returns
`[await (await fetch('/api/state')).json()]`, `onUpdate` POSTs the row back. This works and requires
**zero server change**. It also throws away the entire proposition: a live query over a one-row
collection has nothing to be incremental about, the differential dataflow engine is inert, and the
merge granularity is exactly the whole-document last-write-wins the app already has. You would be
paying §7's bundle for a `useState`.

**(b) Explode the document into collections.** `taskDone`, `workouts`, `log`, `metrics`, `dayPlan`,
`daySwaps`, `dayExercises`, `deepLog`, `readinessLog`, `probeLog`, `savedPrograms`,
`customExercises` are all already key-addressable maps or arrays in `AppState`
(`src/lib/state.svelte.ts:137–173`). Each becomes a collection whose `queryFn` fetches `/api/state`
once and selects its slice — the docs have a section for exactly this, *"Selecting Rows from Wrapped
Responses"* — and whose handlers write back per row. **This is where the value is, and it is also
where the server work is**: per-row writes need a per-row write path. `/api/v1/state`'s deep-merging
`PATCH` is the nearest existing thing; whether it is the right contract is a #24 decision, not a
TanStack DB one.

`prefs` (`src/lib/state.svelte.ts:158`, `{ weight, length, notify }`) is the awkward case in shape
(b): it is a scalar record, not a set. It becomes a one-row collection with a synthetic key, the same
pattern §6 describes for ephemeral UI state.

**Established: no backend of any particular shape is required, and Turso is untouched. What is
required is that whatever the endpoint returns per collection is the complete set for that
collection.**

---

## 4. Where it persists on the client, and whether it survives iOS

This is the section with the sharpest finding.

### 4.1 There are four levels, not one, and they differ enormously in maturity

| Level | Mechanism | Package | Storage | Documented where |
| --- | --- | --- | --- | --- |
| 0 | Nothing | `@tanstack/db` default | memory | overview |
| 1 | `localOnlyCollectionOptions` | core | memory, explicitly | docs site |
| 2 | `localStorageCollectionOptions` | core | `localStorage` (or any localStorage-shaped object) | docs site |
| 3 | `persistedCollectionOptions` + `createBrowserWASQLitePersistence` | `@tanstack/browser-db-sqlite-persistence` 0.2.12 | **wa-sqlite + OPFS**, in a dedicated Web Worker | **README only** |
| 4 | `startOfflineExecutor` (the outbox) | `@tanstack/offline-transactions` 1.0.45 | **IndexedDB, with a localStorage fallback** | **README only** |

**Levels 3 and 4 are not on the documentation site.** `docs/config.json` — the file that generates
the docs navigation — lists Getting Started, five Guides, seven Collections, five Frameworks,
Community and API Reference. It contains **no page for persistence and no page for offline
transactions** (read at `main`, 2026-08-15). The two capabilities that
[#24](https://github.com/YgorPerez/send-lab/issues/24) is entirely about are announced in a blog post
and documented in package READMEs, and nowhere else.

The answer to the ticket's literal question — "IndexedDB, Cache API, memory only?" — is therefore
**all of memory, localStorage, IndexedDB and OPFS, depending on which of four packages you wire up.
Nothing is on by default.** The Cache API is not used; TanStack DB has no service-worker component
at all (§10, item 6).

### 4.2 Level 2, the cheap one: what it actually writes

From `packages/db/src/local-storage.ts` at `main`, the on-disk format is a single JSON string under
one key you name, mapping encoded row key → `{ versionKey, data }`:

```ts
interface StoredItem<T> { versionKey: string; data: T }
```

`saveToStorage` builds `Record<string, StoredItem>` and calls `parser.stringify` (default `JSON`)
then `storage.setItem(config.storageKey, serialized)`. Cross-tab sync is `storage` events on
`window`, and both `storage` and `storageEventApi` are swappable. This is the mechanism closest to
what the app already does at `src/lib/state.svelte.ts:506` (`localStorage.setItem(cacheKey, snapshot)`).

### 4.3 Level 3, the expensive one: wa-sqlite on OPFS

> Browser SQLite persistence for TanStack DB using `wa-sqlite` + OPFS.
> …
> `openBrowserWASQLiteOPFSDatabase(...)` starts a dedicated Web Worker and routes SQL operations
> through it. OPFS sync access handle APIs are used in that worker context.
> — <https://github.com/TanStack/db/blob/main/packages/browser-db-sqlite-persistence/README.md>

Multi-tab coordination is opt-in (`BrowserCollectionCoordinator`, Web Locks + BroadcastChannel);
single-tab is the default and *"does not require `BroadcastChannel` or Web Locks for correctness."*

**Does OPFS run on iOS?** Yes. `FileSystemFileHandle.createSyncAccessHandle` is recorded in
mdn/browser-compat-data (`api/FileSystemFileHandle.json`, read 2026-08-15) as
`safari: { version_added: "15.2" }` with `safari_ios: "mirror"`, and MDN's page carries the
*"Baseline Widely available"* banner ("available across browsers since March 2023"). The API is
restricted to dedicated workers and secure contexts, which is what the adapter does.

The vendor's own rationale for choosing SQLite over IndexedDB is worth quoting, because it is also
the honest statement of the cost:

> We considered a split design where the browser used IndexedDB directly to avoid the SQLite WASM
> download. That path introduced tradeoffs… We also evaluated the cost of the WASM bundle. In
> practice, for apps already syncing data to the client, the additional cost is relatively small.
> The tradeoff favors a more consistent persistence and query model over minimizing initial payload
> size.
> — 0.6 post, 2026-03-25

Note the scoping clause: *for apps already syncing data to the client*. §7 measures the bytes.

### 4.4 Level 4, the outbox: exactly the shape #24 item 3 asks for

`@tanstack/offline-transactions`, from its README:

> - **Outbox Pattern**: Persist mutations before dispatch for zero data loss
> - **Automatic Retry**: Configurable retry behavior with exponential backoff + jitter by default
> - **Multi-tab Coordination**: Leader election ensures safe storage access
> - **FIFO Sequential Processing**: Transactions execute one at a time in creation order
> - **Flexible Storage**: IndexedDB with localStorage fallback
>
> 1. Mutation is persisted to IndexedDB/localStorage
> 2. Optimistic update is applied locally
> 3. When online, mutation is sent to server
> 4. On success, mutation is removed from outbox

With a public API of `createOfflineTransaction`, `waitForTransactionCompletion`, `removeFromOutbox`,
`peekOutbox`, `dispose`, an `isOfflineEnabled` flag, and a `NonRetriableError` class for permanent
failures.

One behaviour to note for a single-athlete app that may still have two tabs open:

> - **Leader tab**: Full offline support with outbox persistence
> - **Non-leader tabs**: Online-only mode for safety

A second tab silently loses offline write durability. The `onLeadershipChange` callback exists so the
app can say so; saying so is the app's job.

### 4.5 It does not assume background reconciliation — and the source proves it

`packages/offline-transactions/src/connectivity/OnlineDetector.ts`, read at `main` 2026-08-15:

```ts
/**
 * Web-based online detector that uses browser APIs.
 * Listens for:
 * - `window.online` event for network connectivity changes
 * - `document.visibilitychange` event for tab/window focus changes
 */
export class WebOnlineDetector implements OnlineDetector {
  private startListening(): void {
    …
    window.addEventListener(`online`, this.handleOnline)
    document.addEventListener(`visibilitychange`, this.handleVisibilityChange)
  }
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === `visible`) { this.notifyListeners() }
  }
```

**The outbox drains on `online` and on the page becoming visible, from the page, and never
otherwise.** There is no Background Sync registration, no Periodic Sync, no service-worker
involvement anywhere in the package (`src/` contains `connectivity`, `coordination`, `executor`,
`outbox`, `retry`, `storage`, `telemetry` — no worker).

This is precisely the design [#24](https://github.com/YgorPerez/send-lab/issues/24)'s iOS constraint
block mandates: *"Design it as foreground-only: it flushes when the app is open and regains
connectivity, and never otherwise."* **TanStack DB's outbox does not have to be bent to fit iOS; it
already has that shape.** That is a genuine positive finding and it should be recorded as one.

### 4.6 But ITP still deletes everything it writes, and the library changes nothing about that

WebKit's storage policy enumerates its scope:

> There are many types of website data, and the policy discussed in this post is mostly related to
> the types created by storage APIs: localStorage, Cache API, IndexedDB, Service Worker, and File
> System.
> — <https://webkit.org/blog/14403/updates-to-storage-policy/>, 2023-08-10

**"File System" is OPFS.** So all four TanStack DB levels — `localStorage` (level 2), IndexedDB
(level 4), OPFS (level 3), and the service-worker registration the shell needs — sit inside the same
covered set that `framework-tanstack-start.md` §5 established is deleted after **7 idle days** on
iOS unless the app is installed to the home screen (webkit.org/blog/10218, 2020-03-24; home-screen
web apps exempt because they "are not part of Safari").

**Consequence, stated plainly: adopting TanStack DB does not weaken and does not strengthen the iOS
install precondition on #24. It is exactly as true afterwards.** Nothing in the library's storage
choices escapes ITP, because there is no script-writable storage that does. The install prompt owned
by [#27](https://github.com/YgorPerez/send-lab/issues/27) remains a correctness dependency of #24
either way.

### 4.7 The persistence layer has an open RFC listing thirteen verified defects, and two of them are this app's exact failure mode

This is the single most important paragraph in the document, and it is not a rumour — it is the
maintainers' own audit. [TanStack/db#1659](https://github.com/TanStack/db/issues/1659), *"RFC:
Hardening the SQLite persistence / Electric sync stack"*, opened by `KyleAMathews`, **status Draft,
updated 2026-07-13**, open as of 2026-08-15:

> Fifteen open issues cluster around `persistedCollectionOptions` + `electricCollectionOptions` +
> the browser/mobile SQLite persistence adapters: #82, #865, #1415, #1416, #1443, #1453, #1456,
> #1478, #1486, #1487, #1498, #1499, #1560, #1567, #1589.
>
> These are not fifteen independent bugs. Every serious one reduces to a small set of broken
> invariants, and the worst share a single shape: **the persistence layer and the sync adapter each
> own state the other one wipes.** The terminal user-visible state is always the same — a collection
> that is `ready`, empty, and silent.

The two defects that matter here, quoted from the RFC's own table with its own verification column:

> **D7** — Sync commits are write-behind: the in-memory commit lands, then persistence runs as a
> `void` promise whose failure is only `console.error`'d. Visible, "committed" data silently vanishes
> on restart. — *RED test; kept as `it.fails`*
>
> **D8** — Sync-present optimistic mutations never reach local storage; only stream echoes persist.
> **Offline writes die on reload.** (#1456, #82) — *RED test; kept as `it.fails`*

And two more worth naming:

> **D12** — No corruption handling anywhere: a truncated/corrupt SQLite file wedges startup
> (sync-present) or silently readies empty (local-only) on every launch until the user manually
> deletes the file. — *Code-verified (zero `SQLITE_CORRUPT`/`integrity_check` references)*
>
> **D10** — Web Locks leadership is orthogonal to OPFS exclusive access: each tab spawns its own
> wa-sqlite worker wanting the exclusive sync access handle; the second tab's worker can't open the
> file, so it error-loops forever. — *Code-verified; browser-only, needs e2e infra to test*

Three qualifications, because overstating this would be as wrong as ignoring it:

1. **The scope is level 3.** The RFC is about `persistedCollectionOptions` + the SQLite adapters
   (mostly paired with `electricCollectionOptions`). It does not audit
   `localStorageCollectionOptions`, and it does not audit `@tanstack/offline-transactions`' own
   outbox.
2. **`it.fails` means "not fixed at the time the RFC was written."** Other defects in the same table
   are marked *"fixed"* or have community PRs. D7 and D8 were among the unfixed ones on 2026-07-13.
   Whether they have since landed was not re-verified line by line and is a **staleness warning**.
3. **The RFC is evidence of a project auditing itself rigorously**, with failing tests as
   ground truth, on a public branch. That is a maturity signal in the positive direction about
   process, simultaneous with a maturity signal in the negative direction about the code.

The consequence for this ticket is narrow and precise: **the persistence layer whose stated failure
mode is "offline writes die on reload" is the one #24 would be adopting it for, and its own
maintainers describe it as alpha (0.6 post) with unfixed data-loss defects (RFC #1659).** The failure
mode of this app is *lost training data*, which the ticket already named as the reason the bar is
high.

### 4.8 The plan of record, for context

[TanStack/db#865](https://github.com/TanStack/db/issues/865), *"Persistence of synced data"*, opened
by `samwillis` 2025-11-20, is the design issue. It closes:

> We are intending to work on persistence after v1 of DB. It's a significant undertaking and only
> something that a smaller portion of users need right now.

Persistence shipped in 0.6 on 2026-03-25, **before** v1, which has still not arrived. The issue was
not updated. And [#82](https://github.com/TanStack/db/issues/82), *"Offline-First Support"*, opened
by a community member 2025-05-14, is **still open** fifteen months later with 23 comments.

---

## 5. Merge semantics

### 5.1 It is none of CRDT, LWW-per-field, or an operation log. There is no merge engine

Searching every guide and collection doc for "conflict" returns two hits, neither of which is a
two-client reconciliation (`docs/guides/error-handling.md` on rolling back dependent transactions,
and `docs/collections/query-collection.md` on direct writes losing to refetched query data). There is
no conflict-resolution page, no merge-policy option, and no vector clock, HLC or version vector
anywhere in the documented API.

What exists instead is a **server-authoritative optimistic overlay**:

> The collection maintains optimistic state separately from synced data. When live queries read from
> the collection, they see a local view that overlays the optimistic mutations on top of the
> immutable synced data.
>
> The optimistic state is held until the handler resolves, at which point the data is persisted to
> the server and synced back. If the handler throws an error, the optimistic state is rolled back.
> — <https://tanstack.com/db/latest/docs/overview>

with a five-step lifecycle:

> 1. **Optimistic state applied** … 2. **Handler invoked** … 3. **Backend persistence** …
> 4. **Sync back**: The handler ensures server writes have synced back to the collection …
> 5. **Optimistic state dropped**: Once synced, the optimistic state is replaced by the confirmed
>    server state
> — <https://tanstack.com/db/latest/docs/guides/mutations>

and an explicit statement of authority even under persistence:

> For synced collections, persistence does **not** change the source of truth. The server remains
> authoritative. Persistence provides a durable local base for fast startup, offline work, and
> reconciliation back to the upstream source of truth when sync resumes.
> — 0.6 post, 2026-03-25

And where a local write and a server read disagree, the rule is stated:

> If your `queryFn` returns data that conflicts with your direct writes, the query data will take
> precedence.
> — <https://tanstack.com/db/latest/docs/collections/query-collection>

**So: the server wins, always, and the client's job is to roll back or adopt.** That is a coherent
model. It is not a merge strategy, and it does not answer #24 item 4.

The only merging the library does is between the client's *own* successive mutations before they
reach the network — the `insert+update → insert` truth table, and the paced-mutation strategies
(*"Multiple rapid mutations automatically merge together into a single transaction"*). Useful; not
reconciliation.

### 5.2 Against this app's document

The luck #24 identified is real and worth restating: `taskDone` is `Record<string, boolean>` keyed by
composite slot-exercise keys (`"w1-Tue:pinch"`, `src/lib/state.svelte.ts:147-149`); `workouts`, `log`,
`metrics[*]`, `deepLog`, `readinessLog` and `probeLog` are append-only series. Today all of it is
shipped as one blob: `JSON.stringify(appState)` on a 600 ms debounce, whole-document replace at the
server (`src/lib/state.svelte.ts:500-525`, `src/routes/api/state/+server.ts:19-34`).

What TanStack DB changes, precisely: **write granularity, not merge policy.** Modelled as shape (b)
from §3.3, ticking one task becomes one row-scoped mutation carrying one key, and two devices ticking
different keys produce non-overlapping writes. Structurally the collision disappears — but it
disappears because the writes got smaller, and the writes got smaller because *the handler you wrote*
sends one key instead of a document. **The library supplies the row-shaped local model; it does not
supply the per-key server contract that makes the row-shaped model pay off.** That contract is #24
item 4 and it stays hand-written (§10).

For the cases that genuinely conflict — two devices editing the same slot's day plan differently —
TanStack DB has nothing to offer. The later handler to reach the server wins; the losing client
adopts the server's answer on its next refetch, silently, because "the query data will take
precedence."

And on the pending-write path, core has no durability and no retry: *"TanStack DB does not
automatically retry failed mutations… the transaction transitions to `failed` state and the
optimistic state is rolled back. This is by design."* On a flaky mobile connection that is a
disappearing tick. Durability arrives only with `@tanstack/offline-transactions` (§4.4), which is a
separate package, undocumented on the docs site, whose exponential-backoff retry then becomes the
answer.

**Established: TanStack DB's merge model is not a better fit than a per-key merge, because it is not
a merge model. It is a finer-grained write model plus server-wins. For a document that is already
merge-friendly, the machinery is heavier than what it replaces on the read side, and roughly neutral
on the write side unless the server changes too.**

---

## 6. Does it replace the UI store, or sit beside one?

### 6.1 The library covers both, in two purpose-built collection types

`localOnlyCollectionOptions` is documented as exactly the ephemeral case:

> LocalOnly collections are designed for in-memory client data or UI state that doesn't need to
> persist across browser sessions or sync across tabs.
> — <https://tanstack.com/db/latest/docs/collections/local-only-collection>

and `localStorageCollectionOptions` as the persisted-but-local case:

> LocalStorage collections store small amounts of local-only state that persists across browser
> sessions and syncs across browser tabs in real-time… **Use Cases**: User preferences and settings;
> UI state that should persist across sessions; **Form drafts**; …
> — <https://tanstack.com/db/latest/docs/collections/local-storage-collection>

Both are shipped inside the core package and re-exported from `@tanstack/react-db`, so they cost no
extra dependency. Both have the same write ergonomics, stated identically in both docs:

> **Important:** LocalStorage collections work differently than server-synced collections… you
> **directly mutate state** by calling methods like `collection.insert()`, `collection.update()`, and
> `collection.delete()` — that's all you need to do.

The rest timer, Train draft and assessment draft map onto `localStorageCollectionOptions` (drafts,
persisted, never account data — form drafts are a listed use case) or `localOnlyCollectionOptions`
(pure in-memory). The rule from [[persistence-layers]] survives untouched: a LocalStorage collection
*is* `localStorage`, so "SQLite for account data, `localStorage` only for ephemeral UI" is not
violated by using one for ephemeral UI.

### 6.2 The cost is that scalars have to become rows

Every collection requires `getKey`. The rest timer is one object, not a set. It becomes a one-row
collection with a synthetic key, read through
`useLiveQuery(q => q.from({ t: timerCollection }).where(({t}) => eq(t.id, 'timer')))` and then
`[0]`-indexed — the pattern the docs' own settings example uses (`const currentPrefs = prefs[0]`).
That is more ceremony than the current `src/lib/timerStore.svelte.ts`, for state that has no
relational structure to exploit.

### 6.3 One documented footgun where the two kinds meet

If a manual transaction spans a local collection and a server collection, the local half does not
persist by itself:

> When using LocalStorage collections with manual transactions (created via `createTransaction`), you
> must call `utils.acceptMutations()` to persist the changes
> — local-storage-collection docs; the LocalOnly page carries the identical warning

Only bites when mixing; worth knowing before mixing.

**Established: adopting TanStack DB means one library, two (or more) collections — not one store and
not two libraries. It does not force the ephemeral state into the account document, and it does not
force it out of `localStorage`.**

---

## 7. Bundle cost

### 7.1 No minified-and-gzipped figure is published anywhere

Checked and found empty: the docs site (no performance/bundle page in `docs/config.json`), the
README, all three release blog posts, and the repository's tooling — a code search of `TanStack/db`
for `size-limit` returns **0 results**, and `.github/workflows/` contains `autofix`, `claude`,
`e2e-tests`, `pr`, `release`, `reproduce-and-fix-issue-claude`, `review-pr-claude` and `zizmor`, with
**no bundle-size job** (2026-08-15).

The only vendor statement about size is a disclaimer of the exact number, and it is scoped:

> We also evaluated the cost of the WASM bundle. In practice, for apps already syncing data to the
> client, the additional cost is relatively small. The tradeoff favors a more consistent persistence
> and query model over minimizing initial payload size.
> — 0.6 post, 2026-03-25

**"Apps already syncing data to the client" is not this app.** This app syncs 28 KB.

### 7.2 What can be measured from published artefacts

Sum of `dist/esm/**/*.js` from the published tarballs (via `unpkg.com/<pkg>@<ver>/?meta`, 2026-08-15).
These are **unminified and tree-shakeable**, so they are an upper bound on shipped source, not a
bundle figure — recorded because they are the only reproducible numbers available:

| Package | Files | Bytes (unminified ESM) |
| --- | ---: | ---: |
| `@tanstack/db@0.7.2` | 70 | 644,513 |
| `@tanstack/db-ivm@0.1.18` | 31 | 76,142 |
| `@tanstack/react-db@0.2.1` | 6 | 12,674 |
| `@tanstack/query-db-collection@1.2.4` | 5 | 50,713 |
| `@tanstack/offline-transactions@1.0.45` | 22 | 61,432 |

`@tanstack/db`'s runtime dependencies are `@standard-schema/spec`, `@tanstack/pacer-lite` and
`@tanstack/db-ivm`; `@tanstack/react-db` adds only `use-sync-external-store`.

### 7.3 The WASM is measurable exactly, and it does not tree-shake

`@tanstack/browser-db-sqlite-persistence@0.2.12` declares `@journeyapps/wa-sqlite: ^1.4.1` as a peer
dependency. Measured against `unpkg.com/@journeyapps/wa-sqlite@1.4.1/`, 2026-08-15:

| File | Raw bytes | Transfer with `Accept-Encoding: gzip` |
| --- | ---: | ---: |
| `dist/wa-sqlite.wasm` | 1,103,644 | **513,299** |
| `dist/wa-sqlite-async.wasm` | 2,215,978 | **773,082** |

**Which build the adapter loads was not established — UNKNOWN** (the source was not read). So the
level-3 persistence path costs **somewhere between ~500 KB and ~775 KB gzipped of WebAssembly**, on
top of the JavaScript, before any of it is used.

**Consequence, not advice:** the account document this would persist is 5.6 KB today and ~28 KB of
state overall. The compressed WASM alone is **roughly 18–27× the entire thing it is being asked to
store**, on a mobile-first client-only tree where initial JS is a stated product concern. Level 2
(`localStorageCollectionOptions`) costs zero extra bytes beyond core and is in the same package.

### 7.4 The claims that do not transfer

For completeness, the performance claims and their stated scope:

- *"0.7 ms to update one row in a sorted 100k collection on an M1 Pro"* — 0.1 post and overview.
  Benchmark on a 100,000-row collection.
- *"**Your app would be dramatically faster if you just loaded 20MB of normalized data upfront**"* —
  the 0.1 post's framing section, headed "The 20MB Question", explicitly invoking Linear, Figma and
  Slack.
- The 0.1 post's target audience: *"Have 1000+ item datasets causing rendering performance issues…
  Build collaborative features but struggle with slow optimistic updates… if your collaborative
  features feel sluggish compared to Linear and Figma."*
- The docs' own sizing guidance: eager mode is *"Best for <10k rows of mostly static data like user
  preferences or small reference tables."*

**Every one of those is scoped to large datasets, and most to multi-user collaboration. None of them
transfers to a private single-athlete console with ~28 KB of state.** The only mode the docs
recommend for data this size is eager mode, which is the default and the least interesting one.

---

## 8. Client-only compatibility

### 8.1 Confirmed — and client-only is the *only* supported mode

`packages/react-db/src/useLiveQuery.ts` at `main`, read 2026-08-15, ends:

```ts
return useSyncExternalStore(subscribeRef.current, () =>
  observer.getSnapshot(),
) as any
```

**Two arguments. There is no third `getServerSnapshot`.** React therefore throws during
server rendering, and the error is exactly the one reported in
[TanStack/db#361](https://github.com/TanStack/db/issues/361):

> Uncaught Error: Switched to client rendering because the server rendering errored:
> Missing getServerSnapshot, which is required for server-rendered content. Will revert to client
> rendering. … at useLiveQuery
> — reporter `lotap`, 2025-09-07, on TanStack Start

The maintainer's answer, `samwillis` (collaborator), **2025-09-07**:

> We don't support SSR with DB yet. It's on the roadmap, but for now you need to disable it on the
> routes that us DB

#361 was closed on 2025-10-05 by `KyleAMathews` — *"Closing in favor of
https://github.com/TanStack/db/issues/545"*. **[#545](https://github.com/TanStack/db/issues/545),
"Add SSR & RSC Support for @tanstack/react-db", has been open since 2025-09-12** with 16 comments.
[#1534](https://github.com/TanStack/db/issues/1534), a request to add `getServerSnapshot` for React
19 SSR, has been open since 2026-05-18. A search for open issues with SSR in the title returns five.

The project's current position, from the 0.6 post's closing section headed *"Toward v1: help us get
SSR right"*:

> Rather than shipping a shallow solution, we are working with design partners to shape this
> properly. We are exploring SSR support and want input from teams planning to use TanStack DB in
> production.

### 8.2 The consequence for this app

**This is the one question where TanStack DB's immaturity costs this app literally nothing.**
[#17](https://github.com/YgorPerez/send-lab/issues/17) already declined RSC, the app tree is
browser-only behind one `ssr: false` seam, and `framework-tanstack-start.md` §6 established that both
candidate hosts make that seam first-class. The library's only supported configuration and the app's
already-chosen configuration are the same configuration. Nothing needs to be worked around, and the
workaround the maintainer prescribes ("disable it on the routes that use DB") is already the
architecture.

---

## 9. The exit

### 9.1 The data: three answers, very different

**The server copy is not at risk at all.** `/api/state` on Turso is the app's own endpoint and its own
schema; TanStack DB never touches the server. If the library is abandoned, the athlete's training
history is exactly where it is today. That is the single most important fact in this section and it
should be weighed before any of the rest.

The client copies vary:

| Level | Format | Recoverable by hand? |
| --- | --- | --- |
| 2 — `localStorage` collection | one JSON string under a key you name: `{ [encodedKey]: { versionKey, data } }` (`packages/db/src/local-storage.ts`) | **Yes, trivially.** `JSON.parse`, then map `v => v.data`. No lock-in. |
| 4 — offline outbox | IndexedDB (or localStorage) via `IndexedDBAdapter` / `LocalStorageAdapter`; `peekOutbox()` is public API | Partially. The public method exists; the persisted record shape is **not documented** — **UNKNOWN**. |
| 3 — SQLite persistence | an OPFS SQLite file with `collection_registry`, `collection_metadata`, `applied_tx` tables and per-collection `schemaVersion` (table names from RFC #1659) | **Materially harder.** OPFS files are not user-visible, and reading them needs a worker plus a SQLite build. RFC #1659 D12 records that a corrupt file has **no** recovery path today. |

### 9.2 The code: the read path is the cost

Every write site is `collection.update(key, draft => …)` plus a handler, and **the handlers are
ordinary `fetch` calls that survive intact** — they are the app's code, not the library's.

Every read site is a live query. `useLiveQuery((q) => q.from({...}).join(...).where(...).select(...))`
is a query-builder DSL with no equivalent outside TanStack DB, and there is no serialisation format
to port. **On exit, every read site is rewritten.** This app reads state on all 9 pages.

Set against what that replaces: today the read path is direct property access on one Svelte `$state`
object (`src/lib/state.svelte.ts`), and derived values are plain functions. Adopting live queries
makes the read path library-shaped. It does not make the data library-shaped.

### 9.3 Abandonment risk, as facts

MIT licensed. 3,865 stars. 284 open issues. Last push 2026-08-15. The four highest-commit humans are
Electric-affiliated (§2.5), Electric is a named commercial Partner in the README, and the funding
model is the TanStack partner programme rather than a corporate owner. A fork is legally free; the
part that would be expensive to maintain alone is `@tanstack/db-ivm`, a differential-dataflow
implementation.

**No argument in this section rests on the TanStack brand or on star counts.** The portable facts are:
the server data is untouched; the level-2 client format is plain JSON; the level-3 client format is
an OPFS SQLite file with no documented recovery path; and the rewrite surface on exit is proportional
to read sites, not to data volume.

---

## 10. What it would actually delete from #24

[#24](https://github.com/YgorPerez/send-lab/issues/24) makes seven decisions and then adds an iOS
constraint block. Taken one at a time.

### 10.1 The seven decisions

**1. Where does the local copy live?** — **Owned, mechanically. Not owned, as a policy.**

TanStack DB supplies four ready-made answers (§4.1) and you write no storage code for any of them.
What it does not supply is the decision #24 item 1 is actually asking: *whether account data is
allowed client-side at all*, given [[persistence-layers]]'s rule. The library has no opinion, and
restating the rule versus quietly violating it is still the app's call. It also does not decide
between level 2 and level 3, and that choice carries §7's 500–775 KB of WASM and §4.7's alpha
persistence layer.

**2. What is the source of truth while running?** — **Owned outright. This is the cleanest win.**

Local-first reads are the library's entire proposition — *"take the network off the interaction path
with instant optimistic writes"*, *"optimise client performance with sub-millisecond live queries"*.
Today every read goes through `hydrate()` and then in-memory state seeded from the API
(`src/lib/state.svelte.ts:396-420`); inverting that to "read from the local collection, sync
underneath" is what you are buying. Nothing about item 2 stays hand-written.

**3. The outbox.** — **Mostly owned.**

`@tanstack/offline-transactions` is item 3, near enough verbatim: persist-before-dispatch to
IndexedDB, FIFO replay, exponential backoff with jitter, `NonRetriableError` for permanent failures,
leader election so two tabs cannot corrupt the queue, and `peekOutbox()` to inspect it. Item 3's
"what replays them, when" and "what happens if replay fails" both have library answers.

What stays yours: **when it drains on iOS** — nothing runs while the app is closed, and the library
agrees by construction (§4.5), so "foreground-only" is a fact you inherit rather than a design you
make. **Whether the athlete sees pending state** — the data is exposed (row metadata / virtual props
were added in 0.6 for exactly *"outbox views of unpersisted data"* and *"delivery or sync state
indicators"*), but every pixel is yours. And **what a non-leader tab means to the athlete**, since
that tab silently drops to online-only.

**4. The merge strategy — the crux.** — **Not owned. At all.**

§5 is the evidence. There is no CRDT, no operation log, no LWW-per-field, no conflict-resolution API.
What you get is finer write granularity, which makes `taskDone`'s structural non-conflict *expressible*
— but the per-key server contract that turns row-shaped writes into per-key merges is something you
write, against `/api/state` or `/api/v1/state`'s `PATCH`. Naming which cases genuinely conflict
(the same slot's plan edited two ways) and deciding what wins is untouched: the library's only rule
is that the server's answer replaces yours, silently.

**#24 itself calls item 4 "the crux". It is the one item TanStack DB does not own.**

**5. Which surfaces work offline?** — **Not owned.**

Choosing between all 9 pages and the daily-use path (`train`, `week`, `log`) is a product decision. So
is the auth edge #24 flags — `getSession` hits the database on every call, and what an expired session
does to a device offline for a week. TanStack DB has no session model and no route model.

**6. What the service worker actually does.** — **Not owned, and note it is orthogonal.**

**TanStack DB has no service-worker component.** Nothing in `@tanstack/db`,
`@tanstack/offline-transactions` or `@tanstack/browser-db-sqlite-persistence` registers or runs in a
worker; the outbox is page-resident (§4.5) and the SQLite adapter uses a *dedicated* worker for OPFS,
not a service worker. Asset precaching, the shell, versioning and cache invalidation on deploy are
exactly as they were, and `framework-tanstack-start.md` §5.1's PWA-tooling findings are unaffected in
either direction.

**7. How is it tested?** — **Not owned. It adds test surface.**

Item 7's minimum bar — *"a write made offline survives a reload and reaches the server on
reconnect"* — is still yours to write, and would now have to cover the outbox, leader election, and
(if level 3) a persistence layer whose own RFC keeps `it.fails` tests for **"offline writes die on
reload"** and **"committed data silently vanishes on restart"** (§4.7). The test is more necessary
after adoption, not less.

### 10.2 The count

Of #24's seven decisions: **two owned outright (2, and most of 3), one owned mechanically but not as
policy (1), and four not owned at all (4, 5, 6, 7)** — including the one #24 names as the crux.

The largest single piece of new engineering in the rebuild is not deleted. It is redistributed: the
local store and the outbox stop being hand-written; the merge rules, the offline surface list, the
service worker and the test all stay exactly where they were.

### 10.3 The iOS constraint block

#24's constraint added 2026-08-15 makes two claims. Against TanStack DB:

1. **"No way to run code on iOS while the app is closed… Design it as foreground-only."** —
   **Compatible, and already implemented that way.** `WebOnlineDetector` drains on `online` and on
   `visibilitychange → visible`, from the page (§4.5). No part of TanStack DB assumes background
   reconciliation. This constraint costs nothing to satisfy.
2. **"On iOS, installation is the precondition for durable local writes."** — **Unchanged.** WebKit's
   storage policy covers *"localStorage, Cache API, IndexedDB, Service Worker, and File System"*, and
   every storage level TanStack DB offers is inside that set (§4.6). The install prompt owned by
   [#27](https://github.com/YgorPerez/send-lab/issues/27) remains a correctness dependency of #24
   whichever substrate is chosen.

---

## Where the sources contradict each other

1. **Version numbers versus the stability claim, again.**
   `@tanstack/query-db-collection@1.2.4` and `@tanstack/offline-transactions@1.0.45` are 1.x packages
   inside a product whose README says BETA and whose core is `0.7.2`. Both cut `1.0.0` on 2025-11-12,
   and `offline-transactions@1.0.0`'s entire changelog entry is a dependency bump to
   `@tanstack/db@0.5.0`. Same pattern `framework-tanstack-start.md` §1.1 found on
   `@tanstack/react-start`, and the same warning applies: the leading `1` is alignment, not a
   declaration.
2. **The 1.0 date.** The 0.5 post (2025-11-12) said *"We're targeting 1.0 for December 2025."* As of
   2026-08-15 the latest release is 0.7.2, there is no 1.0 tracking issue, and no primary source
   retracts or renews the target. It was not withdrawn; it was simply not met.
3. **When persistence was going to be built.** Issue #865 (samwillis, 2025-11-20) says
   *"We are intending to work on persistence after v1 of DB."* Persistence shipped in 0.6 on
   2026-03-25, before v1, and the issue was never updated. The plan moved forward; the tracking issue
   did not.
4. **Docs coverage versus shipped capability.** `@tanstack/offline-transactions` and the eight SQLite
   persistence packages have READMEs and a blog post but **no page in `docs/config.json`**, the
   docs-site navigation. The two capabilities most relevant to #24 are the two the documentation site
   does not cover.
5. **Every benchmark's scope.** *"0.7 ms"* is measured on a 100,000-row collection. *"The 20MB
   Question"* is framed around Linear, Figma and Slack. The 0.1 post's target audience is teams with
   *"1000+ item datasets"* and *"collaborative features."* **This app is ~28 KB, one athlete, no
   collaboration; none of these transfer**, and the docs' own sizing note puts it in eager mode,
   *"<10k rows of mostly static data"* — the default, least differentiated mode.
6. **RFC #1659 versus the 0.6 announcement.** The blog says persistence gives *"durable local state,
   including synced data and pending mutations"*; the maintainers' own RFC, four months later, records
   *"Offline writes die on reload"* and *"Visible, 'committed' data silently vanishes on restart"* as
   verified defects with failing tests. Both are primary sources from the same project. The RFC is
   newer and more specific.
7. **OPFS support versus the adapter's error class.** MDN records `createSyncAccessHandle` as Safari
   15.2 / iOS mirrored and "Baseline Widely available", while the browser adapter's README says
   *"OPFS capability failures are surfaced as `PersistenceUnavailableError`"* — implying some
   environments fail. Which ones is **UNKNOWN**.

---

## Staleness warnings on load-bearing facts

- **Everything about the current API is two to three days old.** `@tanstack/db@0.7.0` shipped
  2026-08-12, `0.7.1`/`0.7.2` on 2026-08-13, `@tanstack/react-db@0.2.0` on 2026-08-13. The 0.6→0.7
  gap was 4.5 months, so this may be the start of a cycle rather than a settled point. `0.7.0`'s
  headline change explicitly labels `createLiveQueryObserver` an *"internal, unstable contract"*
  whose *"API may change in any release."*
- **§4.7's RFC is the fact most worth re-checking before any decision.**
  [TanStack/db#1659](https://github.com/TanStack/db/issues/1659) is a **Draft**, last updated
  2026-07-13. D7 and D8 were `it.fails` then. Whether they have landed since was not verified
  line-by-line here, and they are the two that decide whether level-3 persistence can be trusted with
  training data.
- **The BETA status and the missing 1.0 are both live.** Re-check
  <https://github.com/TanStack/db/blob/main/README.md> and the TanStack blog for a 1.0 post.
- **#545 (SSR) is open since 2025-09-12.** If it lands, §8's "client-only is the only supported mode"
  framing changes — in a direction that costs this app nothing either way.
- **wa-sqlite version drift.** The browser adapter declares peer `^1.4.1`; npm `latest` is `2.0.3`
  (2026-08-13). §7.3's byte figures are measured against 1.4.1 and would need re-measuring against
  whatever a real install resolves.
- **npm download figures are for the week 2026-08-03 → 2026-08-09** and move weekly.
- MDN's `createSyncAccessHandle` page is stamped 2025-07-04; the compat data was read from
  `mdn/browser-compat-data` at `main` on 2026-08-15. WebKit's storage-policy post is 2023-08-10 and
  the 7-day/home-screen facts are carried over from `framework-tanstack-start.md` §5, sourced to
  webkit.org/blog/10218 (2020-03-24).

---

## Open questions this research could not settle

1. **Which wa-sqlite build the browser adapter loads.** The cost of level-3 persistence is therefore a
   range — **513 KB to 773 KB gzipped** — not a number. `packages/browser-db-sqlite-persistence/src`
   was not read.
2. **Minified-and-gzipped cost of `@tanstack/db` + `@tanstack/react-db` in a real build.** No figure
   is published, the repo has no size tooling, and the vendor's only statement disclaims the number.
   Two builds of the same app would settle it — the same open question `framework-tanstack-start.md`
   §5.6 recorded for the framework choice.
3. **Whether any organisation runs TanStack DB in production.** No primary source names one (§2.6).
   The only testimonial is anonymous and self-described "early-alpha".
4. **Whether `localStorageCollectionOptions` shares the SQLite layer's defect class.** RFC #1659 does
   not cover it and no equivalent audit exists. Given §4 makes level 2 the cheap path, this is the
   most valuable unanswered question in the document.
5. **The offline outbox's persisted IndexedDB record shape**, and therefore how recoverable a stuck
   outbox is by hand. `peekOutbox()` is documented; the on-disk format is not.
6. **Whether an eager-mode collection round-trips the whole document on every write.** The docs say a
   successful persistence handler triggers an automatic refetch unless it returns `{ refetch: false }`.
   Against a single-document backend that would mean a full `/api/state` GET per tick. Not measured.
7. **How collection lifecycle interacts with sign-out.** The app calls `clearLocal()` on sign-out
   (`src/lib/state.svelte.ts:490`); every documented TanStack DB example defines collections as
   module-level singletons. Whether a second account signing in on the same device can observe the
   first account's rows was not examined — the same hazard class `nextjs-today.md` §7 catalogued for
   Next's caches.
8. **Whether `@tanstack/db` works under a strict CSP without `unsafe-eval`.** The live-query compiler
   builds query plans at runtime; whether it uses `new Function` anywhere was not checked, and a
   client-only PWA is a natural place for a tight CSP.

---

## Sources

All read 2026-08-15 unless a different date is given.

### TanStack DB — documentation

- Overview — <https://tanstack.com/db/latest/docs/overview>
- Installation — <https://tanstack.com/db/latest/docs/installation>
- Quick Start — <https://tanstack.com/db/latest/docs/quick-start>
- Mutations guide, including the retry statement and mutation-merging table — <https://tanstack.com/db/latest/docs/guides/mutations>
- Live Queries guide — <https://tanstack.com/db/latest/docs/guides/live-queries>
- Error Handling guide — <https://tanstack.com/db/latest/docs/guides/error-handling>
- Creating a Collection Options Creator, the custom-sync contract — <https://tanstack.com/db/latest/docs/guides/collection-options-creator>
- Query Collection, including "Full State Sync" and "Empty Array Behavior" — <https://tanstack.com/db/latest/docs/collections/query-collection>
- LocalStorage Collection — <https://tanstack.com/db/latest/docs/collections/local-storage-collection>
- LocalOnly Collection — <https://tanstack.com/db/latest/docs/collections/local-only-collection>
- Electric Collection — <https://tanstack.com/db/latest/docs/collections/electric-collection>
- React adapter overview — <https://github.com/TanStack/db/blob/main/docs/framework/react/overview.md>
- Community resources — <https://github.com/TanStack/db/blob/main/docs/community/resources.md>
- `docs/config.json`, the docs-site navigation, showing no persistence or offline-transactions page — <https://github.com/TanStack/db/blob/main/docs/config.json>

### TanStack DB — repository, source and changelogs

- Repository, MIT, 3,865 stars, 284 open issues, created 2025-03-11 — <https://github.com/TanStack/db>
- README, the BETA badge and statement, and the Partners section — <https://github.com/TanStack/db/blob/main/README.md>
- `packages/db/CHANGELOG.md` and `packages/react-db/CHANGELOG.md` — the dated breaking-change history
- `packages/offline-transactions/CHANGELOG.md` and `packages/query-db-collection/CHANGELOG.md` — the 1.0.0 entries
- `packages/db/src/local-storage.ts` — `StoredItem`, `saveToStorage`, `loadFromStorage`
- `packages/react-db/src/useLiveQuery.ts` — the two-argument `useSyncExternalStore` call
- `packages/offline-transactions/README.md` — the outbox contract
- `packages/offline-transactions/src/connectivity/OnlineDetector.ts` — `WebOnlineDetector`
- `packages/browser-db-sqlite-persistence/README.md` — wa-sqlite + OPFS, single- and multi-tab
- `packages/` listing — 24 packages including eight SQLite persistence adapters
- Issue 82, "Offline-First Support", open since 2025-05-14 — <https://github.com/TanStack/db/issues/82>
- Issue 361, "Missing getServerSnapshot", closed 2025-10-05, with samwillis's 2025-09-07 reply — <https://github.com/TanStack/db/issues/361>
- Issue 545, "Add SSR & RSC Support for @tanstack/react-db", open since 2025-09-12 — <https://github.com/TanStack/db/issues/545>
- Issue 865, "Persistence of synced data", open since 2025-11-20 — <https://github.com/TanStack/db/issues/865>
- Issue 1534, `getServerSnapshot` for React 19 SSR, open since 2026-05-18 — <https://github.com/TanStack/db/issues/1534>
- **Issue 1659, "RFC: Hardening the SQLite persistence / Electric sync stack", Draft, updated 2026-07-13** — <https://github.com/TanStack/db/issues/1659>
- `electric-sql/d2ts`, created 2024-11-07 — <https://github.com/electric-sql/d2ts>

### Announcements

- TanStack DB 0.1, "first beta", 2025-07-30 — <https://tanstack.com/blog/tanstack-db-0.1-the-embedded-client-database-for-tanstack-query>
- TanStack DB 0.5, "targeting 1.0 for December 2025", 2025-11-12 — <https://tanstack.com/blog/tanstack-db-0.5-query-driven-sync>
- TanStack DB 0.6, "the first _alpha_ release of persistence", 2026-03-25 — <https://tanstack.com/blog/tanstack-db-0.6-app-ready-with-persistence-and-includes>
- ElectricSQL, "Local-first sync with TanStack DB", James Arthur, 2025-07-29 — <https://electric.ax/blog/2025/07/29/local-first-sync-with-tanstack-db> (`electric-sql.com` 301-redirects here)

### Platform and browser

- WebKit, "Updates to Storage Policy", the covered-storage enumeration, 2023-08-10 — <https://webkit.org/blog/14403/updates-to-storage-policy/>
- WebKit, "Full Third-Party Cookie Blocking and More", the 7-day cap and its Home Screen exemption, 2020-03-24 — <https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/>
- MDN, `FileSystemFileHandle.createSyncAccessHandle`, page dated 2025-07-04 — <https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle>
- `mdn/browser-compat-data`, `api/FileSystemFileHandle.json` — <https://github.com/mdn/browser-compat-data>

### Registry and measurements

- npm registry metadata for `@tanstack/db`, `@tanstack/react-db`, `@tanstack/db-ivm`, `@tanstack/query-db-collection`, `@tanstack/offline-transactions`, `@tanstack/browser-db-sqlite-persistence`, `@tanstack/db-sqlite-persistence-core`, `@tanstack/electric-db-collection`, `@tanstack/svelte-db`, `@tanstack/vue-db`, `@tanstack/solid-db`, `@tanstack/angular-db`, `@tanstack/powersync-db-collection`, `@tanstack/rxdb-db-collection`, `@tanstack/trailbase-db-collection`, `@tanstack/db-collections`, `@journeyapps/wa-sqlite` — read from `https://registry.npmjs.org/`
- Download counts — `https://api.npmjs.org/downloads/point/last-week/<package>`
- File sizes and gzip transfer sizes — `https://unpkg.com/<package>@<version>/?meta` and `curl -H "Accept-Encoding: gzip"` against unpkg

### This repository

- `CONTEXT.md`
- `src/lib/state.svelte.ts` — `AppState` (`:137-173`), `prefs` (`:158`), `hydrate` (`:396`), `clearLocal` (`:490`), `startPersistence` (`:500-525`)
- `src/routes/api/state/+server.ts` — the whole-document GET/POST
- `src/routes/api/v1/state/+server.ts` — the deep-merging `PATCH` and replacing `PUT`
- `docs/research/framework-tanstack-start.md` on `research/framework-tanstack-start` — §1 (the version-versus-stability pattern), §5 (the iOS storage and background-execution constraints), §5.6 and §6 (bundle and client-only)
