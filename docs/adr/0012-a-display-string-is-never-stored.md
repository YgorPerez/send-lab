# A display string is never stored, not even as a cache

ADR-0003 established that identity is never a display string. This goes one step
further: a localized display string is not **persisted at all**, not even as a
render cache alongside the identity it was derived from. Every entity in
`src/lib/types.ts` carries an ISO calendar date or an epoch timestamp and nothing
else; the localized label is produced at render by `displayDate(iso)`.

## Why the stronger rule

Five entities used to carry a `date` string beside their `at` identity, and two
code paths — `displayDate.ts`'s `isTodayEntry()` and `readinessDraft.ts`'s draft
loader — compared that stored string against a **freshly formatted `today()`**.
That comparison cannot match once the athlete switches language: the stored half
is frozen in whatever wrote it. Both sites carried comments citing ADR-0003 while
doing the thing ADR-0003 forbids, which is the evidence that "store it, just
don't match on it" does not hold as a convention. A cache that sits next to an
identity gets compared to one eventually.

It was safe to delete rather than repair because nothing in the rebuild wrote the
field — only `prototype-fixtures.ts` supplied it, computing it from the ISO date —
and issue #11's *Out of scope* rules that no accounts or training history are
carried across, so the pre-timestamp data both fallbacks existed for can never
arrive.

`Session.at`, `LoggedReadinessCheck.at`, `SelfCheck.at` and `BodyweightReading.at`
are the surviving identities. `displayDate(iso)` is the only way a date reaches a
screen, and `src/lib/stats.ts` returns ISO labels so the analytics stay
locale-free.

## Considered and rejected

**Keep `date` as a denormalized display cache**, formatting once on write instead
of on every render. Rejected on the evidence above: the two existing comparisons
happened despite an explicit comment forbidding them, and a per-row
`toLocaleDateString` is not a measured cost on a screen that renders 28 sessions.

## Consequences

- The persisted shape is fixed before #56 defines collections over it. Adding a
  cached label later is a migration, not an edit.
- No field remains in violation. `LoggedExercise.name` was the last one — a
  localized exercise name, so a session logged in English showed English names
  after a switch to pt-BR. #69 removed it and replaced it with `variant`, an index
  into the exercise's variants, and `exerciseLabel(exercise, variant)` produces
  the label at render. An index rather than a re-resolution of the *current*
  program swap: the athlete swapping a variant must not relabel the sessions that
  used the old one, so what is stored is what was done.
