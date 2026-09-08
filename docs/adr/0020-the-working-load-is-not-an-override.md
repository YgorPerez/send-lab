---
status: accepted
---

# The working load is not an override

`CONTEXT.md` defines an **override** as "a stored deviation from a built-in
target, set by the athlete", feeding the prescription wherever a built-in value
would otherwise apply. A **working load** is a load the athlete sets, stored, and
read back into the prescription. By the glossary's own words it should be an
override, and it is not.

**It gets a sixteenth collection, keyed exercise *and* variant.** Decided at
[#40](https://github.com/YgorPerez/send-lab/issues/40) and built by
[#88](https://github.com/YgorPerez/send-lab/issues/88). Three reasons, each priced
separately, and any one of them is sufficient.

## 1. `OverrideKey` cannot spell it

`overrideKey` is `` `${weekday}:${exercise}` `` (`lib/ids.ts`). It carries no
variant. But a working load is a property of the exercise *and* the variant: 30kg
on weighted pull-ups says nothing about a one-arm ladder, and swapping the variant
is swapping the work. `prefillLoadKg` already agreed — it matched on both, and
refused to seed one variant from another's history — before
[#87](https://github.com/YgorPerez/send-lab/issues/87) deleted it as never-wired.

The weekday half is worse than merely useless. The same exercise scheduled
Wednesday and Saturday is one working load, but two override keys, so the athlete
would be asked twice and the two answers could disagree — with nothing in the
model to say which is the load.

## 2. Two writers, one field

The load search rewrites the working load after every session while it is
settling. The Program page ([#65](https://github.com/YgorPerez/send-lab/issues/65))
exists to let the athlete edit overrides by hand. Putting the working load in
`program.overrides` points both at the same field, and the athlete's edit and the
search's next write silently race for it.

Separate collections make that unspellable rather than merely unlikely. **#65 must
not grow a load field on the override editor.**

## 3. A working load is not a session

The ladder's middle tier is a self-report: *the load you usually use*, no test
required. The tempting cheap implementation is to write it as a logged session so
the existing history readers pick it up for free.

That fabricates training that never happened — the sin
[#61](https://github.com/YgorPerez/send-lab/issues/61) and
[#29](https://github.com/YgorPerez/send-lab/issues/29) exist to prevent. A tested
max is honest history; "what I usually use" is a recollection. Which tier a number
came from is therefore recorded with it, because #29 grades a test and a guess
differently.

## What hid it, and why this is worth an ADR at all

The rebuild already contained a precedent that said the opposite, and it was dead
the entire time. `LOAD_FROM_BASELINE` in `programGen.ts` seeded a working load per
exercise — `t.loadKg`, written into `program.overrides` under a
`weekday:exercise` key. It read `baselines[map.metric]`, both callers passed `{}`,
and the intake collects no tested max, so it never once produced a number.

So anyone restoring load-seeding would have found a worked example, in the right
file, using overrides, and followed it into all three problems above. #87 deleted
it; this ADR is what remains in its place, because deleting the corpse removes the
wrong answer without recording the right one.

## The alternative, and why it lost

Widen `OverrideKey` to `weekday:exercise:variant` and keep working loads in
`program.overrides`. No new collection, no row spec, no outbox path, no
`/api/state` key — it is by far the cheaper build.

It loses on all three counts. `OverrideKey` is a **persisted, wire-visible
identity**: widening it rewrites every stored program and changes the
`/api/state` contract, which is ADR-0007 and ADR-0015 territory rather than a
field addition. The weekday segment stays wrong even widened — it would now ask
the athlete once per weekday *per variant*. And it does nothing at all about two
writers, which is the failure that actually corrupts a number rather than merely
multiplying it.

## Consequences

**Progression is inert until a working load exists.** `autoProgress` is a flag;
what it switches on is `loadPct`, which resolves `progression.ts`'s weekly rate to
a percentage and scales the prescribed range by it. Exactly one variant in the
library carries a built-in `loadKg` (`pull`, `content/exercises.ts`), so on six of
the seven weighted exercises the study-backed rates have been multiplying nothing
since the rebuild began. `store/baseline.ts`'s `programFor` says so at the point
where a reader would otherwise assume a fallback covers it.

**A tested max is not a working load, so the ladder never asks for one.** The
tempting reading of tier 1 — and the one the ticket's own wording invites — is
"what is your max on this". It is wrong for the same reason the middle tier is
not a session: a max is what an exercise can be *tested* at and a working load is
what it is *trained* at, and on `density` (twenty-to-forty second hangs, to
failure) those differ by a lot in the direction that hurts fingers.

Turning one into the other needs a **per-exercise fraction**, which is exactly
the `0.9 / 0.6 / 0.5 / 0.4` table [#87](https://github.com/YgorPerez/send-lab/issues/87)
deleted, and #40 authorised precisely one new unsourced multiplier — spent on the
per-level target index. So every rung asks the same question, *what do you load
this with*, and `WorkingLoadSource.tested` records only that the number was
**measured** rather than recalled. That is the difference
[#29](https://github.com/YgorPerez/send-lab/issues/29) grades; it is not a
difference in what kind of number was stored.

This is recorded here rather than in its own ADR because it is the same trap one
level down: someone restoring a max-to-load conversion would be restoring the
table #87 deleted, and would find nothing saying so. `CONTEXT.md`'s **Marker**
entry carries the rule where it will actually be read.

**`pinch` needs a nonzero floor.** Tier 3 is bodyweight-only for the hangs, which
is a genuine prescription on a 20mm edge. On a pinch block the added load *is* the
entire load, and a pinch block with nothing on it is not a set.

**The glossary gained two terms, and kept one it was about to lose.** **Working
load** and **Load search** are new; **Probe** stays as departing readiness history
and the word is not reused, because the readiness Probe was read for same-day
freshness and never for progress — the exact inverse of what a load search does.
`tests/screenReads.test.ts` asserts the string `probe` is absent from the Today
read to prove the readiness Probe left the rebuild, and reusing the word would
have turned that tripwire into a false alarm.
