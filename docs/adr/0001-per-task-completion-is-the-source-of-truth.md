---
status: accepted
---

# Per-task completion is the source of truth for "trained"

Three records independently claimed to answer "was this slot trained?": a manual
per-slot tick (`completed`), a per-task map written when a set is marked done
(`taskDone`), and the `done` flag on each logged set. They disagreed — adherence
(and therefore progression) read only `taskDone`, carry-forward read only the
logged sets, and nothing read `completed` at all, so ticking a day on the Week tab
earned no credit and the work was still offered as missed the next day. We made
`taskDone` the single record: logging a done set writes it, the Week tab's tick
writes it, and both adherence and carry-forward read it. `completed` is gone.

## Why not the logged sets themselves

The obvious choice — a slot is trained iff some set in its session is done — is
not implementable as stated. Slots are keyed by *(week, weekday)* and sessions by
*calendar date*, and the app has no anchor between the two: there is no start date
for a block, and the current week is set by hand. So for any week other than the
one containing today, "which sessions belong to this slot" has no answer, and
adherence has to be computable for every past week.

`taskDone` is keyed in the same space as the schedule, so it can answer the
question for any week. The logged sets remain the *evidence* — they are what
writes `taskDone` during a session — but the per-task record is what the schedule
reads back.

## Consequences

- `taskDone` is written by the Train page for the slot on screen and by the Week
  tab's tick; it is not recomputed from sets on load, so editing a past session's
  sets elsewhere will not retroactively change adherence.
- Giving a block a real start date would remove the obstacle above and let the
  sets become authoritative directly. Worth revisiting if calendar anchoring is
  ever added.
- Legacy `completed` ticks are folded into `taskDone` by the lazy state migration,
  which credits each ticked slot's resolved exercises.
