---
status: accepted
---

# Bodyweight survives the marker cull, as its own thing

The rebuild's keep/drop audit dropped markers wholesale — the athlete's tested
performance numbers stop being tracked over time. Bodyweight was listed inside
the definition of a marker, so the cull swept it along with the rest. Nobody
decided that; it happened because of where the word sat in a sentence.

The contradiction surfaced when the redesign was about to be prototyped. Its
brief tells all four directions to render the same content on Today, and that
content includes a bodyweight nudge — a control whose only job is to write a
reading into a series that no longer exists. Four sessions were about to build
four different guesses about what it does.

**Bodyweight survives, and it is not a marker.** A marker is a *test*: the
athlete sets up, pulls maximally, and the number is the outcome of effort spent.
Bodyweight is a reading — nothing is tested, nothing is expended, and it is
consumed as the divisor other numbers are expressed against rather than as
progress in its own right. Markers were dropped because tracking tested numbers
over time was scope the athlete did not want. That reason does not reach a number
you get by standing on a scale.

The word was doing double duty and that is what hid the problem. `Assessment`
holds a one-off bodyweight captured at onboarding, and the metric series held
another, tracked over time. Both were "bodyweight" in prose. They are now
distinguished in `CONTEXT.md`: the baseline captures the first reading, and every
later one is logged from Today.

## Considered options

**Drop the nudge along with markers.** The simplest reading of the audit, and the
one the code already implemented. Rejected because it leaves the app unable to
answer "what do I weigh now" — and because the numbers that survive on Today are
not the only consumers; anything expressed as a percentage of bodyweight needs a
current divisor to be honest.

**Keep only the baseline number, editable in settings.** One bodyweight, no
series, no nudge. Rejected because a single number captured at onboarding goes
stale across an eight-week block, and a stale divisor is worse than an absent one:
it produces confident, wrong percentages rather than an obvious gap.

## Consequences

**The account state carries a `bodyweight` series** where it used to carry ten
marker series under `metrics`. This is the shape the state model inherits; it is
not a decision about where that state lives.

**Strength index stays dropped.** It normalizes marker readings taken at
different edge depths, and those readings are gone — bodyweight surviving does
not resurrect it. `src/lib/strength.ts` is therefore dead code for the rebuild
and should go when the page tickets reach it.

**A nudge needs a designed home.** It is content on Today in the redesign brief,
so the direction prototypes render it, and whichever direction wins owns what it
looks like.
