---
status: accepted
---

# A session records the day type it ran

`Session` held `{ at, weekday, exercises, note, durationMin }` and no day type. The
Log screen wanted one, so it looked the session's weekday up in the **built-in
week** and rendered that day type's category.

That is a lookup by *when* answering a question about *what*. It is correct only
while the athlete's program still runs the day type the library ships for that
weekday. The moment they change Thursday from pull to endurance, **every past
Thursday in the log relabels itself** — history rewritten by a change to the plan,
silently, with no edit to any session.

**A session now carries `dayType`, stamped when it is logged.**

## Why this needed a decision rather than a fix

Because it changes what a session *is*. `CONTEXT.md` is explicit that a session is
*"the training actually done in one slot on one calendar date"* — history, as
against a slot, which is a plan. A field that has to be re-derived from the current
program on every render is not history; it is the plan wearing history's clothes.
Adding the field is the glossary's own definition finally being true of the type.

## What hid it

The built-in week is 1:1 — seven day types, seven weekdays, in order — so the
lookup returned the right answer for every session anyone had ever seeded. Under
the old single `Day` record it was also a single `.find()` that read as total, and
nothing in the shape suggested an approximation.

ADR 0016 is what made it visible, by splitting the day type from the weekday: once
the lookup was `builtInWeek.find(...)` feeding `dayTemplate(...)`, the two halves
were plainly a *when* and a *what* with a join in between. 0016 preserved the
behaviour deliberately and recorded that fixing it "changes what a session is, and
belongs to whoever owns that". This is that.

## The alternative, and why it lost

**Stop showing a day type on a logged session.** The app cannot honestly say what
was trained, so say nothing — smaller, and it removes a lie rather than making it
true.

It loses on what the Log screen is for. The day type is the orientation cue that
tells the athlete which session they are looking at before they open it; a list of
dates and set counts is harder to scan, and the information is not genuinely
unavailable — it is known at the moment of logging and simply was not kept.

## What it cost

One field on the entity, one on the wire schema, two seed constructors, and the
Log screen's read, which got *shorter*: a two-step join became `dayTemplate(content,
s.dayType)`, and localizing what was recorded is all it does now.

`resolveDayType` was made public for it, which is the honest primitive — the
question is asked **once**, when the session is logged, instead of being re-asked
of the current program on every render.

No migration. #11's *Out of scope* ports no accounts and no history, and
`record_row` holds zero rows in production, so the field is **required** rather
than optional. An optional field would have bought nothing and left every reader
handling an absence that cannot occur.

## Consequences

**The day type is stamped, so it is a display-independent id.** `DayTypeId`, never a
label — ADR 0003 and ADR 0012 both apply, and the Log screen resolves the localized
category through `dayTemplate` at render as it always did.

**A session and its slot can now disagree, and that is the point.** After the
athlete edits Thursday, a session logged last week says pull and this week's slot
says endurance. Any future feature comparing planned against trained should read
the session for what happened and the program for what was planned, and never
substitute one for the other.

**`resolveDayType` is exported**, so a second caller could now re-derive rather than
read the stored value. Reading the session is correct; re-deriving is the bug this
ADR closes.
