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
- ~~`lib/intervalProtocol.ts` — `IntervalConfig`.~~ **Done in the 2026-09-01
  domain-modeling pass.** It held `{prepare, work, rest, rounds, sets, setRest}`,
  which is precisely the glossary's **Protocol**, whose `_Avoid_` list reads
  "interval scheme" — and *interval* is on **Round**'s and **Segment**'s lists too.
  Found late because the word sat in a *type* and a *filename* rather than in a
  stored key, which is the half of "at every layer" that is easiest to skip;
  #59 sharpened it by deriving the type from its own `PROTOCOL_FIELDS`. Now
  `Protocol` in `lib/protocol.ts`, and `TimerProtocol` was deleted rather than
  renamed, because its extra field was a localized label welded onto a domain type
  (ADR 0012).
- `lib/stats.ts` — parameters and prose, no behaviour. Cosmetic and contained.
- ~~`missedYesterday`, `TodayScreen.missed`, and the keys `td_missed` /
  `td_missed_do`.~~ **Done in the 2026-09-08 domain-modeling pass**, and it is
  the entry where both directions of the audit were needed to see one defect.
  *Missed work* is the first phrase on **Carry-forward**'s `_Avoid_` list, so the
  first direction found the names — but it could not say what was wrong with them,
  because the glossary had no word for the other sense the code was also using.
  `SlotState` (`lib/screens/week.ts`) had minted `'missed'` for **a slot**, which
  the glossary never named, and the two senses were indistinguishable in a grep.

  What settled it was a scenario rather than a reading: **a slot can be `trained`
  and populate `TodayScreen.missed` at the same time.** ADR 0001 makes one tick
  enough to call a slot trained, while `carryForwardFromYesterday` hands forward
  every task *not* ticked — so an athlete who does one of Wednesday's two
  exercises gets `Wed:trained` on Week and a non-null `missed` on Today, off the
  same record. Measured against the seeded account, not argued. The field was
  therefore not merely saying an avoided word; it was making a claim about the
  slot that the value it holds does not support.

  So the pass did both halves: `CONTEXT.md` gained **Missed** (a state of a slot,
  never of work) and **Carry-forward** gained the sentence that keeps them apart,
  and the names moved onto the terms — `carryForwardFromYesterday`,
  `TodayScreen.carryForward`, `td_carry_forward`. `SlotState`'s `'missed'` is
  unchanged and now defined rather than invented. Nothing persisted, so nothing
  migrated.
- `resolveDay` (`lib/prescription.ts`) and `applyEditDay` (`server/programOps.ts`)
  — both say *day* for something that is not a weekday: `resolveDay` returns a
  **day type**, `applyEditDay` edits a **weekday template**, and *day* is on both
  terms' `_Avoid_` lists. #72 found these while renaming its own four and
  deliberately did **not** take them, on the grounds that `resolveDay`'s `day` was
  the content library's `Day`/`days`/`dayTemplate` family. **That blocker is gone**:
  ADR 0016 split `Day` into `DayType` and `BuiltInWeekday`, so `resolveDay` now
  returns a `DayType` and the name is plainly wrong rather than ambiguously wrong.
  Unblocked, still not taken — deliberately, since 0016 was a shape change and
  mixing a rename across the same nine modules is how both become unreviewable.
  This is now the oldest live entry on the list.
- `messages/` — the key `log_workouts`. Note the *text* is already right in both
  locales ("Sessions" / "Treinos"); only the key drifted, which is what makes it
  the least urgent and the easiest to forget. Beside it, `set_assessment_desc`
  and `set_redo_assessment` say *assessment* in the key and *onboarding* in the
  English text — the first words on **Baseline**'s and **Intake**'s lists. Found
  in the 2026-09-05 domain pass on #66, and the fix there is **deletion, not
  rename**: neither is referenced anywhere in `src/`, and a redo control built
  later would take the glossary's words. They are two of 267 unused keys of 566,
  which is a survey of its own and not this list's business — these two are here
  because they say an avoided word, which is the criterion.
- ~~`login`'s `first-run` notice and its `login_first_run` message key.~~ **Caught
  before it shipped**, in the same pass, and it is the entry that shows the audit
  works at write time rather than only in arrears. *First run* is on **Intake**'s
  `_Avoid_` list, and the key sat one button away from the control that opens an
  intake. Renamed to `no-record` / `login_no_record`, with its partner `returning`
  — itself already the name of a rehab stage (`stage_returning`) — becoming
  `has-record`. The rename also fixed a claim: the pair named a *person* where the
  device is all that is known.
- ~~`content/types.ts` — `DayType.prime` and `DayType.sec`.~~ **Found and done in
  the 2026-09-02 pass**, and it is the entry that says the audit method has a hole.
  Every item above says a word some `_Avoid_` list names, so a grep finds it. These
  two said nothing the glossary had an opinion on — because **`Day type`'s entry did
  not mention them at all**, though they are the most prominent copy on the plan
  card after the day's own name. A grep against the `_Avoid_` lists cannot find a
  field the glossary does not know exists.

  What made them worth taking anyway: `sec` is the three letters this codebase uses
  everywhere else for *seconds* (`workSec`, `restSec`, `prepareSec`, `setRestSec`),
  and `en-US.ts` carries `sec: 'Contact strength / RFD…'` and `unit: 'sec @ load'`
  in one file. Now `headline` and `subhead`, and `CONTEXT.md` has an entry for the
  pair so the next grep can see them. Content-only, never persisted, so nothing
  migrated.

  **The audit therefore needs a second direction**: walk the *types* and ask which
  fields have no glossary entry, rather than only walking the glossary and grepping
  for words it avoids. The first direction finds drift; only the second finds
  concepts the language never named.

**This does not license renaming a glossary term to match the code.** The
direction is one-way. If a stored name looks better than the term, the argument to
have is about the term — in `CONTEXT.md`, where changing it is visible — and not
by leaving the storage as a second opinion.
