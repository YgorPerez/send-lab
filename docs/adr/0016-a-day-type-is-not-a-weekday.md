---
status: accepted
---

# A day type is not a weekday, and the built-in week is what joined them

`CONTEXT.md` has always been explicit that these are two things — "a weekday says
*when*, a day type says *what*" — and lists `day` on the `_Avoid_` list of
**Weekday**, **Slot**, **Day type** and **Weekday template** alike. The content
library disagreed. `Day` carried both:

```ts
interface Day {
  id: DayTypeId;                      // what
  k: string; label: string;           // when
  type, prime, sec, load, color, ex;  // what
}
```

And `content.days` was searched by **both** keys, for two different jobs: by `k`
for `weekdayLabel` and `builtInDayType`, by `id` for `dayTemplate`, and by both in
`programOps.ts`, which derived the day-type list and the weekday→day-type map off
the one array.

**A day type is now `DayType` and holds no weekday. The mapping is its own
record, `BuiltInWeekday`, and the array it forms is the built-in week** — a term
`CONTEXT.md` gained here, because the concept was in the code (`builtInDayType`)
and in no glossary.

## Why this needed deciding, rather than renaming

ADR 0014 owns a rename it has now deferred twice: `resolveDay` returns a day type
and `applyEditDay` edits a weekday template, and *day* is on both terms' `_Avoid_`
lists. #72 found them, declined them, and recorded that "the rename is that
family's, not one function's."

That was the right instinct for the wrong reason. The rename kept being deferred
because **no name worked**. `Day` could not become `DayType` while it carried `k`
and `label`; it could not become `Weekday` while it carried the protocol. `day`
survived because it is the only word vague enough to cover a conflation. The
blocked rename was a symptom, and renaming was never going to clear it.

## What hid it

The built-in week is 1:1 — seven day types, seven weekdays, one array, in order:
limit-power↔Mon, pinch-wrist↔Tue, endurance↔Wed, pull↔Thu, max-tissue↔Fri,
performance↔Sat, rest↔Sun. It reads as "the week", and every lookup returns the
right answer.

This is the same shape as the trap `CONTEXT.md` warns about at the top: the
English weekday labels are byte-identical to the stable keys, so a
label-as-identifier bug is invisible in the base locale. Here the two *sets* line
up instead of the two *strings*, and the effect is the same — the model is wrong
and every test passes.

It also had already bitten once. #55 found `generateProgram` writing
`template[d.k] = { dayType: d.k }` — a weekday key where a day-type id belongs,
with `d.k === restKey` a comparison that could never be true. It was caught by
naming a *field* `dayType`. The split is what makes it unspellable rather than
merely caught.

## The alternative, and why it lost

Keep one record and stop `dayTemplate` from returning the weekday fields, so a
resolved day cannot carry a weekday it does not belong to. Cheap, contained, and
it fixes the live symptom.

It loses because the symptom is not the problem. One record still means
`content.days` is searched by two keys for two purposes, the rename stays blocked,
and every new field gets to pick a side. It also cannot express two things the
glossary already promises: two weekdays running the same day type ("several slots
can run the same one"), and a day type no weekday runs by default. Neither is
spellable while the mapping is a field of the thing being mapped.

## What it cost

Less than the two deferrals implied: 7 entries × 2 locale files, and 9 modules.
The locale restructure is mechanical — `k` and `label` move out of each day type
into a `builtInWeek` entry naming the day type by id. No storage changes, because
nothing persisted a `Day`: programs store `dayType` ids and weekday keys already,
which is ADR-0002 doing its job.

## Consequences

**`BuiltInWeekday.k` stays `string`, not `WeekdayKey`.** That brand lives in
`lib/ids.ts`, and ADR 0013 forbids `content/` importing upward — "it compiles,
which is the whole problem". Typing it properly means moving the weekday key set
down into `content/types.ts`, which is ADR 0013's own prescription and a decision
of its own rather than a side effect of this one. Left as it was found.

**The Log screen's day type is an approximation, and now visibly so.** `sessionRow`
looks a session's weekday up in the built-in week and reads that day type's
category. Under one record this was one `.find()` and looked total; split, it is a
lookup by *when* feeding a field that describes *what*, and the gap is the point:
**a `Session` records no day type at all.** So once the athlete edits a weekday's
day type, the Log row goes on showing the built-in one. Behaviour was preserved
rather than fixed here — the fix is to record the day type on the session, which
changes what a session *is* and belongs to whoever owns that.

> **Fixed by [ADR 0017](0017-a-session-records-the-day-type-it-ran.md).** A session
> now carries `dayType`, stamped when it is logged, and `sessionRow` reads it
> instead of joining through the built-in week. The split above is what made the
> approximation visible; recording it is what made the glossary's "a session is the
> history" true of the type.

**ADR 0014's deferred rename is unblocked but not taken.** `resolveDay` now
returns a `DayType` and `dayTemplate` returns one too, so both names are now
plainly wrong rather than ambiguously wrong. That rename is still ADR 0014's, and
doing it in the same change as the split would have mixed a shape change with a
naming change across the same nine modules.

**The glossary was right the whole time.** Nothing in `CONTEXT.md` moved except an
addition. This is the direction ADR 0014 fixed — the storage moves to the
glossary, never the reverse — applied to a shape rather than a name.
