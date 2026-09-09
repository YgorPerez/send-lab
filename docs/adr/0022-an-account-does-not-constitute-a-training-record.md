---
status: accepted
---

# An account does not constitute a training record, so the first sign-in adopts one

`CONTEXT.md` defined these two terms in a circle. **Account** was "the
authenticated identity that owns one athlete's training record", and **Training
record** was "everything one athlete's account holds". Read together they say a
training record exists because an account holds it — which leaves no name for the
thing this app already ships, already promises, and already keeps on purpose:
the training an athlete logs with nobody signed in.

It is not an edge case that slipped through. `login_no_record` says it to the
athlete in their own language — *"Send Lab works without an account: what you
train stays on this device. An account syncs it across devices and keeps a copy
off this one"* — and `store/collections.ts` states the policy beside the storage
segment that holds it: *"Training logged with nobody signed in is real and is
kept, but it is not an account."* Three places in the app agree that this
training is real. The glossary was the only thing that could not describe it.

**So an account is what *syncs* a training record, and what keeps two athletes'
records apart on a shared device — not what brings one into being.** That is
already what the sign-in copy promises, almost word for word. Training logged
with nobody signed in is a training record: the athlete's, real, and kept.

**The corollary is that the first sign-in adopts it.** If the signed-out record
is the athlete's training record, and an account is the thing that syncs their
training record, then signing in for the first time has to pick up the record
already in front of them. Anything else makes the promise true only of the bytes
on the disk.

## Considered options

**Leave it separate, and fix the copy instead.** This is today's behaviour, and
it is coherent: the signed-out segment belongs to nobody, no sign-in ever touches
it, and `login_no_record` stops implying continuity. It was rejected because the
implication is the honest part. An athlete who trains for two weeks and then
creates an account has not changed their mind about whose training it was, and a
console for one climbing athlete that answers "that was somebody else's" is
answering a question nobody asked. The copy is not the thing that is wrong.

**Refuse to let anyone train signed out.** Rejected without much thought: it
contradicts ADR 0006's whole shape. The app is client-only and works offline
before it works online, and gating training behind a network round-trip to an
auth provider is the opposite of that.

## Consequences

**Adoption has to consume the segment, not copy out of it.** If the rows are left
behind after the first sign-in, the *next* account to sign in first on that
device adopts them too, and one athlete's sessions end up in two accounts'
histories with no way to tell which is the original. Adoption is a move.

**On a shared device, adoption absorbs whoever trained before.** This is the
sharp edge, and it is the mirror image of the reason **Account** exists at all —
`lib/screens/login.ts` already says the quiet part: *"a record here means
*someone* signed in on this device, and **Account** exists in the glossary
precisely because that someone need not be the person now reading."* The same is
true of a signed-out record, and adoption pushes it into an account and then
syncs it off the device, where it cannot be taken back.

It is accepted here on the grounds in the first line of `CONTEXT.md`: this is a
training console for **one** climbing athlete, on their own phone. The hazard is
real and the population it endangers is empty. If Send Lab ever serves a second
athlete on one device, this is the decision to reopen first — and `heldAccounts()`
is already the machinery that would tell them apart.

**A record adopted late must not beat the server's own.** The sync is
last-write-wins over `updated_at` (ADR 0008, ADR 0015), so adopting a fortnight
of rows into an account that has newer rows elsewhere must not stamp them with
*now*. The rows carry when they were trained; adoption is not an edit of them.

**`heldAccounts()` is now wrong at the login screen.** It excludes the signed-out
segment deliberately, so a device holding nothing but signed-out training reports
`no-record` — it tells the athlete their training is not there, on the one screen
written to avoid exactly that. Under this decision that device *is* holding a
record.

**The app does not do any of this yet.** The decision is recorded ahead of the
work, which is issue
[#97](https://github.com/YgorPerez/send-lab/issues/97) — it carries the
walk-through, the constraints above restated as requirements, and the three
questions this decision deliberately leaves open (whether adoption is announced,
whether it is offered or automatic, and whether the unsent queue comes with it).
`CONTEXT.md`'s **Training record** entry carries a `_Changing_` marker saying the
app and the glossary disagree here until it lands.
