---
status: accepted
---

# The account document becomes collections, and offline writes need their own queue

One JSON document per account has served this app well: it is small, it is easy
to reason about, and its sync is a debounced whole-document POST that cannot get
out of order with itself. The rebuild gives that up, and this records why, what
replaces it, and the one thing the replacement does not do.

The requirement that forces it is offline writes. The athlete has to be able to
tick tasks and log a session in a gym basement, and a whole-document
last-write-wins sync means the last device to reconnect overwrites the other's
work wholesale. The document is *already* merge-friendly where it counts —
`taskDone` is a commutative set of composite keys, `workouts` and `log` are
append-only — so the granularity to merge at is the row, and the document shape
is what stands in the way.

**TanStack DB is adopted as the local-first substrate, and it settles the shape
by construction.** Its collections are typed keyed row sets: `getKey` is required
on every collection type and there is no document or scalar primitive. A
one-collection-one-row arrangement does work, but it leaves the dataflow engine
inert over a single row and preserves exactly the whole-document last-write-wins
being replaced — paying a bundle for a `useState`. There is no half-adoption. So
the document splits, and `/api/state` grows a per-key write path. That server
work is the price of the row-level granularity, and it is the point.

**Account data persists to `localStorage`, not to SQLite in WebAssembly.** The
account state is roughly 28 KB. The SQLite-and-OPFS option downloads 500–775 KB
of WebAssembly to store it — eighteen to twenty-seven times the payload — on an
app whose mobile-first requirement is explicit. It is also where every defect in
the library's own hardening RFC sits, including both of the data-loss ones. The
`localStorage` path was verified to be a genuinely separate code path: a single
file inside the core package that imports none of the audited machinery, with
forty-five tests and no failing ones, and which re-throws and rolls back on a
quota failure rather than swallowing it.

## Why offline writes need a second package

The `localStorage` collection writes to storage *after* the server accepts, not
before. With a sync handler attached the order is: await the handler, then save.
So the athlete ticks a task with no signal, the send fails, the transaction rolls
back, the save is never reached, and the tick is gone on reopen. A passing test in
the library asserts precisely this. It is the documented contract rather than a
bug, and the maintainers have put fixing it at that layer explicitly out of scope.

`@tanstack/offline-transactions` closes the gap by persisting to IndexedDB
*before* dispatch and replaying in order with backoff. It is taken rather than
hand-written because a queue that must survive being killed mid-write is fiddly
code to get right alone, and hand-writing it would leave the substrate doing half
the job it was adopted for. The cost is recorded plainly: that package is
documented only in a README, has no page on the documentation site, and its 1.x
version number is version alignment rather than a stability claim.

## Ephemeral state is unchanged, and does not go through any of this

The rest timer, the Train draft and the assessment draft stay `localStorage`-only
and never become account data. They use `use-local-storage-state`, at 680 bytes,
chosen on measured behaviour: it is the only surveyed option that reads through
`useSyncExternalStore`, guards both notification channels correctly, surfaces a
failed write as state rather than an exception, and lets cross-tab sync be turned
off per store. That last one is not a detail — two tabs each ticking the rest
timer would fight over the remaining seconds every second, so cross-tab sync is a
hazard there rather than a feature.

The alternatives failed on specifics rather than taste. The most popular store's
persistence middleware has no cross-tab sync at all and does not document its
absence. The same framework family's own store has no persistence story, and the
package its maintainers point at has not shipped a release in over a year. One
widely used hook returns the initial value instead of the stored one in a
single-page app unless a flag is set on every atom. Another updates React state
only if the write succeeded, so a failed write silently refuses the change on
screen.

## Consequences

**`/api/state` needs a per-key write path.** The dropped `/api/v1/state`
deep-merging `PATCH` is the nearest existing shape and is worth reading before
designing its replacement.

**The merge strategy is still unwritten, and this decision does not supply it.**
TanStack DB has no merge engine — not a CRDT, not per-field last-write-wins, not
an operation log, but a server-authoritative optimistic overlay where the server's
answer replaces the local one and a throw rolls it back. What changes is write
*granularity*, not merge *policy*: one tick becomes one row-scoped mutation, so
`taskDone` keys stop colliding — but they stop colliding because the write got
smaller, and the write got smaller because the handler we wrote sends one key. Two
devices editing the same day's plan still conflict, and the loser adopts the
server's answer silently. Deciding what that should do is the offline ticket's
remaining work, and it is the part with the athlete's training history in it.

**Every package here is pinned exactly.** The condition ADR 0005 attached to the
framework applies with more force at this layer, because the failure mode is lost
training data rather than a broken build. The substrate is beta, seventeen months
old, missed a 1.0 target by nine months without renewing it, carries roughly one
breaking change per minor line, and has no named production user in any primary
source. This was put to the athlete before the choice and reaffirmed after. Two
things do cut in its favour: its outbox is foreground-only by construction, which
is what iOS forces regardless, and its lack of server-rendering support costs
nothing here.
