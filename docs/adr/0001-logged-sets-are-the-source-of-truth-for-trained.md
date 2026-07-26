---
status: accepted
---

# Logged sets are the source of truth for "trained"

Three records independently claimed to answer "was this slot trained?": a manual
per-slot tick (`completed`), a per-task map written by an effect in Train
(`taskDone`), and the `done` flag on each logged set. They disagreed —
`weekCompletion` (which drives adherence and therefore progression) read only
`taskDone`, `missedYesterday` read only the sets, and nothing read `completed` at
all. We picked the logged sets: a slot is trained iff some set in its session is
marked done. `taskDone` becomes a derived cache of that fact and `completed` goes
away, so adherence and carry-forward can no longer contradict each other.

## Consequences

- The Week tab's tick has to write a real completed set rather than its own flag.
- `completed` holds data for existing production accounts, so removing it needs a
  migration that replays those ticks as sets — not a blind drop.
- Anything reading `taskDone` must tolerate it being stale until the cache is
  rebuilt from sets, since only Train currently writes it and only for the slot
  on screen.
