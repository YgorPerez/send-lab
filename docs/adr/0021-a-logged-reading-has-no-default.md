# A logged reading has no default

A field the athlete's **body** is the only instrument for opens empty, stays
empty until they answer it, and is stored as absent if they never do. The app may
prefill a plan; it may not prefill a reading. Today that is one field — a set's
**RPE** — and the rule is written for the class rather than the field.

[ADR 0019](0019-an-intake-question-has-no-default.md) settled this for the intake
and said outright that it was not settling it for everything: *"Whether it binds
every form the rebuild has left to build is not settled here; the two screens that
write next (`week`, `program`) edit values the athlete already has, which is a
different case from asking for one."* The set logger is the third case, and it is
neither of those two. It is not editing a value the athlete already has, and it is
not an intake either — it is asking for a measurement, mid-session, in the one
place the athlete is the instrument.

So the line is not intake-versus-form. **It is plan versus reading.** A set's
other six fields are a plan the athlete edits: the load they pulled, the edge they
used, the reps they got. Opening those at the prescription's midpoint saves six
taps and states nothing untrue — if they did what was asked, the prefill is
already right. An RPE is not a target that got done. Nobody but the athlete can
observe it, so a number the app puts there is not a head start on the answer, it
*is* an answer, wearing their name. That is ADR 0019's sentence about the intake's
two booleans, one screen over.

## What it cost, and what it bought

Delivered by [#89](https://github.com/YgorPerez/send-lab/issues/89), which
[#40](https://github.com/YgorPerez/send-lab/issues/40) had decided in the form
*the set shows the prescribed RPE and takes the actual RPE, and they are never the
same field*. The **prescribed** range moved to the RPE column, beside where the
answer is typed, because a prescription a card away is fine to read and useless to
judge one number against.

Three places carry it, and each looks like an oversight without this file:

- `prefilledSet` fills six of a set's seven fields and leaves `rpe` null.
- `nextSet` carries every number the athlete gave into the next row and drops that
  one. A later set starting from the row above is the *better* default for load
  and reps and the same fabrication for a rating — one rung further from the
  prescription and no better sourced. This one was found in review, after the
  first half had shipped, which is the argument for writing the rule down rather
  than the field.
- `sessionLoad` returns no load for a session nobody rated, where it used to assume
  a moderate 5. sRPE (Foster) *is* the rating; without one there is nothing to
  scale by duration.

**The bill is on the load metrics, and it is real.** An unrated day now reads as a
rest day, so a history rated only here and there understates its own internal load
and its own monotony. The alternative was the fallback, and the fallback was worse
in kind rather than in degree: every workload band and every flag off it would
have been a statement about the app's own constant. That is exactly what
[#61](https://github.com/YgorPerez/send-lab/issues/61) found in
`computeReadiness`, scoring each wellness question's *fallback* and putting a
verdict made of nothing in front of the athlete. Understating a real number and
reporting an invented one are not the same mistake. How much a partly-rated window
should still be trusted is a weighting question, and it belongs to the load search
([#91](https://github.com/YgorPerez/send-lab/issues/91)), which is also the
feature this rule is a precondition for: a load search comparing logged RPE
against prescribed RPE would otherwise have been reading its own prefill and
converging on the number it started from.

## Consequences

**The reversal is one line, and it is silent** — 0019's own warning about its own
rule, and it applies harder here. Nothing fails, nothing goes red that is not
already written, and what comes out is merely a history of ratings nobody gave.
`tests/loggedSet.test.ts` asserts both halves (the first row opens unrated however
tight the prescribed range; a later row does not inherit one), `tests/stats.test.ts`
asserts that history nobody rated withholds a verdict rather than inventing one,
and `tests/screens.test.ts` asserts the prescribed range reaches the input in both
locales. Those four are the guard; this file is why they are worth keeping.

**A new field is decided on this axis before it is prefilled.** Ask what the
instrument is. If the answer is the athlete's own body or their own perception,
the field opens empty and its absence is a value the readers have to handle. If it
is something the app can know or the program asked for, prefill it. The bodyweight
series, the readiness answers and the injury self-checks are all already on the
first side of that line; the working load is the interesting near-miss, because
`ask` is non-null exactly when the athlete has never said what they load a variant
with, and ADR 0020 keeps it out of the overrides rather than defaulting it.

**It does not license withholding a display.** The prescription is still shown, in
two places now. What may not be done is putting it in the field where the answer
goes — showing the ask and taking the answer are not in tension, and the reason
this was a bug at all is that one field was doing both.
