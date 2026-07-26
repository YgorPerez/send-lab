---
status: accepted
---

# Identity is never a display string

The app is bilingual, so every user-facing label is locale-dependent — yet
persisted records were keying on those labels. Sessions identified their slot by
the *translated* weekday label and their date by a locale-formatted string, and
the rest day was located by matching a load label against the literal `OFF`. A
locale switch silently changed the identity of stored data. We settled the rule:
records key on stable ids and ISO dates only, and labels are resolved for display
at render time.

The trap was that the English weekday labels are byte-identical to the stable
weekday keys (`Mon`, `Tue`, …), so every one of these bugs is invisible in the
base locale and only reproduces in `pt-BR`.

## Consequences

- Views and exports that previously rendered a stored label must resolve the id
  to a label through the active locale's content.
- Existing production rows hold labels in whichever locale the athlete was using
  when they were written, so backfills must map from *both* locales' label sets,
  not just the current one.
- Tests that only run in the base locale cannot catch a regression of this class;
  a `pt-BR` case is required to have coverage that means anything.
