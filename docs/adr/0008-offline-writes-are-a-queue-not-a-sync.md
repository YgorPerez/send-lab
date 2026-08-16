---
status: accepted
---

# Offline writes are a queue, and the client now holds a replica of account data

The rebuild requires that the athlete can tick tasks and log a session in a gym
basement with no signal. That single requirement rewrites a rule this codebase
has held since state moved off the browser, and it forces a set of decisions that
are individually small and collectively easy to erode. This records them together.

**The persistence rule changes, deliberately.** It used to read: SQLite for
account data, `localStorage` only for ephemeral UI. Offline writes make that
impossible — you cannot read a plan from a server the phone cannot reach — so the
client now holds a **complete replica of account data**, in `localStorage`, and
pending writes in IndexedDB. The rule that replaces it: Turso remains canonical
and is the only durable copy; whatever the client holds is a replica the browser
may evict without warning; and ephemeral UI state stays local-only and never
syncs. The boundary between the two halves is unchanged — does this belong to the
account, or to this device right now — only the account half is now mirrored
locally.

**Reads are local-first.** They come from the local store, and sync happens behind
them. This inverts the old model, where every read was an API call.

**Writes go through a queue, not a sync.** Each mutation is persisted before it is
dispatched, then replayed in order with backoff. The queue is **foreground-only**:
it drains when the app is open and has connectivity, and never otherwise. That is
not a simplification — iOS provides no way to run code while the app is closed, so
it is the only shape available on the athlete's primary device.

## Why the simple merge rule is safe here

Sync resolves conflicts by last-write-wins **per key**, where key means the
collection row key. That precision is the whole safety argument, and losing it
would turn this rule into a data-loss bug.

The account document is stored as collections of rows (ADR 0007). Append-only
history — workouts, the log, the deep and readiness logs, rehab history — is keyed
by entry id, so two devices appending produce two *different* keys. Last-write-wins
never fires there, and no entry can be lost. Completion ticks are a set of
composite keys, so two devices ticking different tasks never touch each other
either.

What genuinely conflicts is a short list: the same task ticked in one place and
unticked in another, the same day's plan edited two ways, and the same preference
or the current week changed on both devices. Each resolves to the later write, and
the other side is discarded silently. A per-kind ruleset was offered and declined
in favour of the simpler implementation — an acceptable trade precisely because the
structural properties above mean the simple rule cannot reach the training history,
which is the part that cannot be reconstructed from memory.

None of this comes from the store library. That library is a server-authoritative
optimistic overlay: the server's answer replaces the local one, and a throw rolls
it back. It changes write *granularity*. The policy above is ours, and it lives in
the per-key write path the state endpoint grows.

## Consequences

**A permanently-failed write must be dead-lettered.** Replay is FIFO, so one write
the server will never accept sits at the head of the queue and stops everything
behind it — including sessions logged since — silently, with the app looking
healthy. A non-retriable failure therefore moves aside so the rest of the queue
drains, and the athlete is told something did not save.

**Pending state is visible only when there is something to see.** Nothing on screen
while all is well; an indicator when offline or when writes are queued; an
unmissable message when a write has permanently failed. The always-on saved/saving
status the old app carried is noise on a phone used mid-set.

**Every page works offline except sign-in**, which needs the server to verify
anything at all. Settings splits: preferences work offline because they are account
data already held locally, while sign-out, account actions and API tokens require a
network.

**Offline, the app trusts the local store; it verifies only when online.** It has no
choice — checking a session requires a database round trip. On reconnect with an
expired session the athlete signs in again and the queue waits rather than failing.
Three rules follow, each guarding a path where data disappears without an error:
session expiry never clears the local store or the queue, and only an explicit
sign-out made online, after the queue has drained, clears anything; the store stays
namespaced per account, and that isolation needs a test rather than an assumption,
because one athlete's queued writes replaying into another's account is the worst
outcome available here; and when running uninstalled on iOS with unsynced writes,
the app warns, because Safari deletes all script-writable storage after seven idle
days and the queue would be gone with no conflict and no error to notice.

That last point makes installation a correctness dependency rather than a
nice-to-have, which is why it is owned as its own decision rather than left to
whoever builds the manifest.

**Five assertions belong in the build gate**, because offline behaviour that is not
tested rots quietly: a write made offline survives a reload and reaches the server
on reconnect; a permanently-rejected write is dead-lettered and the queue behind it
still drains; session expiry does not clear local state; two accounts on one device
cannot see or replay each other's data; and append-only collections never lose an
entry when two clients diverge. The last one is the property the entire merge rule
rests on, so it should be asserted rather than believed — and per ADR 0003 it must
run in `pt-BR`, since completion keys are built from stable ids whose English
labels are byte-identical to them.
