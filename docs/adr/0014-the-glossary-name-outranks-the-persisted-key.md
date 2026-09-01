# The glossary's name outranks the persisted key

When a stored field's name disagrees with `CONTEXT.md`, **the storage moves.** The
glossary term is the canonical name at every layer the athlete's data passes
through — the collection, the row, the server document, the wire — and a key that
carries a word from a term's `_Avoid_` list is a defect to be fixed rather than a
historical fact to be adapted around.

This binds **names only**. The glossary has no standing on behaviour, and it lost
that argument in #55 when it was used to make a behavioural claim. What it settles
is what a thing is called.

## Why this needed deciding

`prescription.ts` declared `ResolverState` with a field `sessions`, named for the
glossary's **Session**. The persisted document called the same array `workouts` —
which is the first word on Session's `_Avoid_` list. The same disagreement sat one
field over: `ResolverState.baseline` against the document's `assessment`, where
*assessment* is the first word on **Baseline**'s `_Avoid_` list.

So one array had two names across one seam, and each of the two tickets that
touched the area left the disagreement in place. #55 renamed the *type* to
`Baseline` and never touched the state key. #69 named the resolver's field
`sessions` and wrote a comment deferring the rename — to **#59**, which is the
ephemeral-state ticket and never owned it. That mis-attribution survived two
tickets and was only caught when #56 came to implement the interface. An unowned
rename does not stay put; it drifts, and it takes its documentation with it.

## The alternative, and why it lost

The cheaper option was an adapter: keep the persisted keys and rename on the way
into `ResolverState`, in the one function that assembles the record. It costs
nothing to write and it is invisible.

That is the objection. An adapter makes the disagreement permanent and free,
which means it is never resolved — every later reader has to learn both names and
which layer speaks which, and every new field gets to choose. The mapping also has
to be repeated at each seam that grows: the collection, the write path, the MCP
endpoint's payload. The cost of *not* deciding compounds; the cost of deciding is
paid once.

## What it cost, and why that was affordable here

Renaming a persisted key normally means a migration. It did not here, and the
reason is specific rather than general: the rebuild carries no accounts or history
across (#11, *Out of scope*), the alpha is five accounts of roughly 28 KB, and the
athlete has said data continuity is not required. #56's collections are new
storage rather than a rewrite of the SvelteKit document, so client-side the rename
cost nothing at all.

The server side was not free. `server/stateOps.ts`'s `defaultState()` and
`sanitizeState()` said `workouts` and `assessment`, and **#57 renamed them** when
it mounted the write path. In the event the module was replaced rather than
edited: ADR 0015 made the unit of storage a row, so the whole-document skeleton
and its coercing sanitizer had nothing left to describe, and `server/record/rows.ts`
carries the glossary's names from the first line. That work existed because of
this decision and was recorded here rather than discovered there.

## Consequences

**A new field takes the glossary's word, at every layer, on the first write.** The
cheapest moment to name a stored field correctly is before anything has stored it.

**The audit is a grep, and it is not finished.** #56 recorded the client store as
clean and it was not: #72 found four survivors there — `dayPlan`, `dayExercises`,
`daySwaps` and `Program.targets` — each naming a key shape the code does not have.
The lesson is that "clean" has to mean *grepped against the `_Avoid_` lists*, term
by term, and not merely *looks right*. These still say a word the glossary avoids,
and each is owned rather than merely noticed:

- ~~`server/stateOps.ts` — the document skeleton.~~ **Done in #57**, by
  replacement rather than rename: `server/record/rows.ts` is the per-key guard that
  succeeded it, and it says `sessions` and `baseline` and has no `log`.
- ~~`lib/migrate.ts` — writes `workouts` and the long-dead `dayKey`.~~ **Ruled in
  #72**: deleted rather than rewritten. It upgraded *legacy* documents, and #11's
  *Out of scope* ports no accounts and no history, so there was never going to be
  anything for it to upgrade. Nothing in `src/` imported it.
- `lib/stats.ts` — parameters and prose, no behaviour. Cosmetic and contained.
- `resolveDay` (`lib/prescription.ts`) and `applyEditDay` (`server/programOps.ts`)
  — both say *day* for something that is not a weekday: `resolveDay` returns a
  **day type**, `applyEditDay` edits a **weekday template**, and *day* is on both
  terms' `_Avoid_` lists. #72 found these while renaming its own four and
  deliberately did **not** take them: `resolveDay`'s `day` is the content
  library's `Day`/`days`/`dayTemplate` family, so the rename is that family's,
  not one function's. Owned here so it is not re-discovered as new.
- `messages/` — the key `log_workouts`. Note the *text* is already right in both
  locales ("Sessions" / "Treinos"); only the key drifted, which is what makes it
  the least urgent and the easiest to forget.

**This does not license renaming a glossary term to match the code.** The
direction is one-way. If a stored name looks better than the term, the argument to
have is about the term — in `CONTEXT.md`, where changing it is visible — and not
by leaving the storage as a second opinion.
