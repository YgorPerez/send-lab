# A shared closed set moves down a layer, never up

When the same closed set of values is needed on both sides of a layering
boundary, its one canonical declaration goes in the **lower** layer and the
upper layer re-exports it. It is never resolved by having the lower layer import
from the higher one, and it is never left declared twice.

The two layers here are `src/lib/content/` (the training library: localized prose
plus language-neutral parameters) and the rest of `src/lib/` (the app's entities
and logic). The dependency runs **app → content**: `lib/types.ts` imports
`DayTypeId`, `Grip` and `VerdictId` from `content/types.ts`, and nothing in
`content/` imports from `lib/`.

## Why this needed deciding

A body area — `'fingers' | 'elbow' | 'shoulder' | 'wrist'` — was declared twice
and byte-identically: as `FlagArea` in `content/logic.ts`, where a readiness flag
routes to it and the per-area self-checks are keyed by it, and as `RehabArea` in
`lib/types.ts`, where `SelfCheck.area` and `Rehab.area` store it. The rehab stage
was declared twice the same way. Both content-side copies carried comments saying
they were "kept local so content has no app import", which is a true reason not
to import upward and not a reason to duplicate.

The obvious fix is the wrong one. Importing `RehabStage` into `content/logic.ts`
**type-checks** — TypeScript has no notion of the layer boundary — and inverts the
dependency, which is how a content module ends up transitively depending on the
app's store. That was tried and reverted before this decision was made.

The evidence that duplication also fails: `routes/index.tsx` carried
`area={t.selfCheck.area as FlagArea}`. A cast between two identical unions,
written because the compiler could not know they were the same set. A duplicate
closed set does not stay silent — it surfaces as casts at every boundary
crossing, and a cast is exactly what stops being correct when one copy gains a
fifth member and the other does not.

## The precedent it follows

`SelfCheckBand` was already declared in `content/logic.ts` and imported by
`lib/types.ts` for `SelfCheck.band`. The app importing a *content* closed set is
the allowed direction, and this generalizes it: the value set is content's to
define, and the app's job is to store one.

## Consequences

- `BodyArea` and `RehabStage` are declared in `content/types.ts`, beside
  `DayTypeId`, `Grip`, `VerdictId`, `Region` and `Cost`. `lib/types.ts`
  re-exports both. `FlagArea` and `RehabArea` are gone: each named the *role* the
  set was playing rather than the thing, which is why neither worked for both.
- The cast in `routes/index.tsx` is deleted. One declaration means nothing to
  reconcile.
- `Content.selfChecks` is keyed by `BodyArea` instead of `string`, and typing it
  found that only three of the four areas have an instrument — **there is no
  wrist self-check**, while the comment above the field claimed all four. It is
  `Partial<Record<BodyArea, …>>` now, so the gap is visible rather than asserted
  away. Nothing hits it yet: the only lookup is a hard-coded `.fingers`.
- The limit of the rule: this applies to closed **value sets**, not to entities.
  `Session` does not move into `content/` because the content library has no
  business knowing what a session is. The test is whether the lower layer already
  needs the concept for its own reasons — content keys `selfChecks` and `flags` by
  body area whether the app exists or not.

## Considered and rejected

**Leave both declarations and document the split.** Zero churn, and the comments
were already there. Rejected because #69 was about to add call sites on both
sides of the line, and because the `as FlagArea` cast shows what accumulates
instead: the duplication is not free, it is paid for at every crossing.

**A third module below both** (`src/lib/areas.ts`), imported by content and app
alike. Rejected as inventing a layer the repo does not have, to hold one union of
four strings, when the layer that should own it already exists and already owns
five other closed sets.

**Import upward into `content/`.** Rejected on the dependency direction, above.
It compiles, which is the whole problem: nothing but this decision stops it.
