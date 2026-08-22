---
status: accepted
---

# The server stores one row per row, and a delete is a tombstone

ADR 0007 split the account document into fifteen keyed collections, because the
granularity the athlete's offline writes have to merge at is the row. It split
the **client**. `app_state` stayed what it had always been: one row per account
holding a JSON blob, `user_id` primary key, `data TEXT`.

So when #57 came to build the per-key write path the ticket assumes, the schema
underneath it was still whole-document, and nothing in ADR 0007 or the ticket
settled which way that went. This is the decision, and it is a decision about
live data.

**The server stores one row per row.** A new table:

```sql
CREATE TABLE record_row (
  account_id  TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  collection  TEXT NOT NULL,  -- 'taskDone', 'sessions', ...
  row_key     TEXT NOT NULL,  -- the collection's own getKey(row)
  row         TEXT,           -- one row, JSON. NULL is a tombstone.
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (account_id, collection, row_key)
);
```

**Not `state_row`, and not a `data` column.** `CONTEXT.md`'s **Training record**
reads `_Avoid_: state, data, document, account data`, and ADR 0014 binds the
glossary's name at "every layer the athlete's data passes through — the
collection, the row, the server document, the wire". The first cut of this shipped
as `state_row(… data …)` and the review caught it before anything was stored,
which is the moment ADR 0014's own Consequences call the cheapest one. The *route*
stays `/api/state`: #12 and #18 named it and it is an external contract, not a
name minted here.

## The alternative, and why it lost

The cheap option was to keep the blob and merge per key server-side: read the
document, patch the one key, write it back. No DDL, no risk to anyone's data, and
the endpoint's contract would have looked identical from the outside.

That last part is the objection. The contract would *look* per-key while the
storage stayed whole-document, so every write would still serialize the whole
document and two concurrent per-key writes would still collide on one row. The
collision that ADR 0007 exists to stop — two devices ticking two different tasks
— would have been stopped in the client and reintroduced one layer down, where it
is much harder to see. A per-key path over a blob is a per-key path in name.

The third option, blob now and the table when #58's outbox makes concurrency
real, loses for a related reason: it makes the outbox ticket rewrite the write
path it inherits, and it means the interesting failure arrives at the same time
as the machinery that makes failures hard to reproduce.

## What it cost, and why that was affordable

Renaming or reshaping storage normally means a migration. It did not here.

The change is **additive**: one `CREATE TABLE IF NOT EXISTS`, applied to the live
database while `app_state` was left exactly as it stood. No secondary index — every
read here is "the whole record for one account", which the primary key's leading
column already serves, and a separate index on `account_id` would be a duplicate
that only cost write amplification. Production
is still the SvelteKit app on `main`, it reads `app_state`, and it cannot see the
new table. Nothing migrates between them — #11's *Out of scope* carries no
accounts or training history across the rebuild — so the two coexist until the
rebuild replaces production, at which point `app_state` is dropped rather than
converted.

`drizzle-kit push` prompts and therefore needs a TTY, which an agent session does
not have. So the DDL is written out in `scripts/apply-ddl.ts` and run through
`@libsql/client` directly. That has a side benefit worth keeping: what was
applied to the database with real accounts on it is in the repository history
rather than in someone's shell.

## The merge rule, and the clock it uses

**Last-write-wins per row key**, in the `ON CONFLICT` clause of a single
statement rather than in a read followed by a write — a read-then-write is two
statements with a race between them, which is the race the per-key path exists to
remove.

The version compared is **the writing device's clock at the moment of the edit**,
not the server's arrival time. That is what makes the rule survive the outbox
(#58): a tick queued in a gym basement and flushed an hour later has to lose to
an edit made on the phone in the meantime, and arrival order says the opposite.

A tie goes to the incoming write (`>=`, not `>`). Two devices writing the same key
in the same millisecond is not something ordering can help with, and treating a
tie as a loss would make the *retry* of a write report as stale — the outbox
re-flushes, and a re-flush has to be idempotent rather than surprising.

## A delete is a tombstone

`row IS NULL` means deleted. The row itself stays, with the time of its deletion.

A hard `DELETE` looks simpler and is wrong under this merge rule: with the row
gone there is nothing left to compare a late, stale update against, so the row
comes back from the dead. Keeping the key with its deletion time makes delete and
update the same rule instead of two, and the resurrection case has a test.

**And a hydrate reports the tombstones rather than hiding them.** The first cut
filtered them out of the response, which quietly made deletion unsyncable: the
client cannot treat a missing row as deleted — a row absent from the response is
far more often a write that has not synced yet, and deleting on absence would mean
logging a session on a plane, landing, and watching it disappear. So absence has to
mean "keep what you have", and the tombstone is then the only thing that can carry
a deletion to a second device at all.

The cost is that tombstones accumulate and nothing prunes them. At five accounts
of roughly 28 KB that is affordable, and a sweep belongs with the ticket that
starts generating them in bulk.

## Consequences

**There is no default document server-side.** Absence is representable per key
now, so a brand-new account is fifteen empty collections and the server holds no
skeleton at all. `stateOps.ts`'s `defaultState()` — the last copy of the client's
defaults living one HTTP hop from the client's own — is deleted rather than
renamed.

**A malformed row is rejected rather than coerced.** `sanitizeState()` coerced,
because the unit of the write was the whole document and rejecting it would have
discarded everything the athlete had. Per key that reason is gone: rejecting one
row keeps every other row, so coercion would only mean silently storing something
other than what the device sent, under the key the device chose. The per-key
guard reports which row it refused and why, and the rest of the batch lands.

**A hydrate is not authoritative over the store.** The server is one of two
writers, not the truth. Three rules follow, and each is a way training could
otherwise be lost: a row the client has changed and not yet sent is left alone (it
is newer by construction); a row merely absent is left alone; a row the server
reports as deleted is deleted.

**The client's `getKey` has a server-side twin, and they are held together by a
test.** The server re-derives a row's key and refuses a write where the two
disagree — without it a client bug can file one row under two keys, and
last-write-wins per row key cannot merge two rows that never collide.
