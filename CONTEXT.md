# Send Lab

A training console for one climbing athlete. It decides what to train today from
how the athlete reports feeling, prescribes the work, records what was actually
done, and lets the prescription drift with the evidence.

## Language

### Athlete and account

**Athlete**:
The person a Send Lab account trains. Everything in the training record belongs
to exactly one athlete.
_Avoid_: user, client, patient

**Account**:
The authenticated identity that owns one athlete's training record. Appears in
sign-in, tokens and API authorization — and, once the training record is also
held on the device, as the boundary keeping one athlete's record separate from
another's on a shared device.
_Avoid_: user, profile

**Sign-in**:
The standing proof that a device is acting as an account. It lapses on its own;
a **sign-out** is the athlete ending it deliberately. Never a *session* — in this
app a session is training.
_Avoid_: session, auth session, login, authentication

**Training record**:
Everything one athlete's account holds — the program, the sessions, the readiness
checks, the bodyweight series, the baseline, the preferences. What an account
owns, as opposed to
the account itself, which is the identity that owns it; and what a second device
is catching up to.
_Avoid_: state, data, document, account data

**Baseline**:
The answers the generated program is built from — goal, focus, level, days per
week, equipment on hand, hardest grades, current niggles. It shapes which
weekdays train, what may be prescribed on them, and how hard the block pushes.
_Avoid_: assessment, profile, onboarding, survey, intake form

**Intake**:
The occasion on which the athlete gives their baseline: before the first
session, and again whenever they want a different program. Retaking it
regenerates the program and starts the block again at week one, so an intake is
not a one-off and the baseline it produces is not a profile the athlete edits a
field of. `welcome` is the screen that hosts one, the way `train` hosts a
session — a screen name, not this word.
_Avoid_: onboarding, setup, wizard, first run, sign-up, assessment

**Equipment**:
The gear the athlete has to train with — hangboard, board, rings, weights. It
filters which exercises the generated program may prescribe, so an intake that
names none of it leaves almost nothing to prescribe.
_Avoid_: gear, kit, apparatus, hardware

**Preferences**:
What the athlete has chosen about how the app reads and behaves — display units,
locale, time zone, and whether each notice reaches them. Part of the training
record and carried between devices with it, rather than a setting belonging to
one phone. **Settings** is the screen that edits them; the preferences are what
it edits.
_Avoid_: profile, user settings, app config

**Locale**:
Which of the app's languages the athlete reads it in. It belongs to the account
and not to the device, so a second phone and anything reading the account on the
athlete's behalf answer in the same language; unset means follow whatever device
is in hand.
_Avoid_: lang, translation

**Display unit**:
The unit a weight or a length is *read* in — kilograms or pounds, millimetres or
inches. A choice about reading only: what gets recorded is always the canonical
unit, so changing this never changes a stored number.
_Avoid_: measurement, unit system

### Prescribing

**Program**:
The reusable design of the athlete's training: a weekday template, periodization
phases, and prescription overrides. One is active; others can be saved and
switched.
_Avoid_: plan, routine, schedule, split, protocol

**Block**:
The run of weeks the active program spans.
_Avoid_: cycle, mesocycle, program length

**Phase**:
A stretch of consecutive weeks inside a block carrying its own intensity and
volume multipliers. A deload is a phase, not a separate concept.
_Avoid_: stage, period

**Training week**:
One iteration of the program's template, numbered from 1 within the block.
_Avoid_: microcycle, week

**Weekday**:
A calendar position within a training week, identified by the stable key `Mon`
through `Sun`. Never the localized label, and never a day type — a weekday says
*when*, a day type says *what*.
_Avoid_: day, day key

**Slot**:
One weekday of one training week — the addressable cell of a block. Slots are
what get customized, trained, and carried forward.
_Avoid_: day, session, entry, cell

**Day type**:
A reusable archetype for a slot: its category, load level, default exercise list,
and the two lines of copy that say what the day trains — a headline and the
subhead under it. A slot runs one day type; several slots can run the same one.
_Avoid_: day, template, protocol, split

**Headline**:
The one line a day type leads with, naming the work it exists for —
"Recruitment pulls → Limit bouldering", "Full rest". Library copy, so it is
localized and the athlete never writes it, and it is the most prominent thing on
today's plan after the day type's own name. The **subhead** is the line under it:
the supporting work and any caveat. Neither is an identifier — a day type is
addressed by its `DayTypeId` (ADR-0003).
_Avoid_: focus, primary, prime, description, summary

**Built-in week**:
The training library's own mapping from each weekday to the day type it runs
before the athlete's program customizes anything. It is content, not program: the
athlete never edits it, and a weekday template overrides it.
_Avoid_: default week, the week, days, day list

**Weekday template**:
One weekday's entry in the program: the day type it runs, plus any customization
of that day type's exercises or label. It applies to every training week in the
block, where a slot is one weekday of one week.
_Avoid_: day, day config, program day, schedule

**Rest day**:
A slot whose day type prescribes no exercises. Rest days are never scheduled
work, so they never count against adherence.
_Avoid_: off day, recovery day

**Exercise**:
A named movement in the library, with one or more variants. The library is the
app's, not the athlete's — they choose among movements rather than adding them.
_Avoid_: movement, drill, protocol
_Changing_: athlete-authored exercises exist in the SvelteKit app and are
**already removed from the rebuild**, which closes the library.

**Variant**:
One interchangeable option of an exercise, carrying its own targets. Every
exercise has a default variant.
_Avoid_: version, option, alternative

**Swap**:
The athlete's choice of a non-default variant for an exercise — either
library-wide, per weekday in the program, or for a single slot.
_Avoid_: substitution, override, alternative

**Prescription**:
The targets an exercise is to be trained at in a specific slot, after swaps,
overrides, weekly progression, and phase scaling are all resolved. What the
athlete is asked to do.
_Avoid_: target, spec, params, dose

**Protocol**:
The shape of an effort — how work and rest alternate and how many times, as in
the 6 × (7s on / 3s off) repeater protocol. A named method, which is why the
studies and the rest timer both use the word; never a program, a day type or a
session.
_Avoid_: interval scheme, routine

**Override**:
A stored deviation from a built-in target, set by the athlete, and addressed by
the weekday it applies to. Feeds into the prescription; anything not overridden
falls back to the built-in value. A **working load** is not one (ADR-0020).
_Avoid_: custom, target, edit

**Progression**:
The week-on-week climb in prescribed load, at a rate scaled by the athlete's
level and by how much they actually trained. It scales a **working load**, so an
exercise without one does not progress.
_Avoid_: overload, ramp, increase

**Weighted exercise**:
One of the seven exercises that carry a **working load**. A closed, enumerated
set, like the body areas and the day types — not a property derivable from what
an exercise prescribes. The entry used to claim the line was "answered by grade
or time alone", and that line does not hold: `density` is twenty-to-forty second
hangs and is one of the seven, `repeaters` is seven seconds on and three off and
is not. What actually settled the membership is which exercises the app once
derived a load for from a marker. On a pinch block the added load is the whole
load.
_Avoid_: loaded exercise, weight exercise

**Working load**:
The load an exercise is actually trained at, held per exercise and **variant**.
*Settling* while the load search is still moving it; *settled* once two
consecutive on-target sessions agree, after which progression scales it. Never an
override (ADR-0020).
_Avoid_: working weight, target load, base load, prescribed load

**Load search**:
The first few sessions spent finding the athlete's real working load, driven by
the gap between the prescribed **RPE** and the RPE the athlete actually gave. A
set with no RPE given is no gap rather than a gap of zero, and moves nothing.
Ends when the working load settles, and re-opens if a settled one drifts.
_Avoid_: probe, calibration, tuning, auto-tune

### Training and recording

**Session**:
The training actually done in one slot on one calendar date. A slot is a plan; a
session is the history — so it records the day type it ran, rather than being
read back off whatever the program runs on that weekday now. Never the
authenticated one, which is a **sign-in**: this word is the training one.
_Avoid_: workout, day, entry

**Task**:
One exercise as it appears in one slot — the unit the athlete ticks off.
_Avoid_: item, entry, todo

**Set**:
One logged effort within a session: load, edge, time, reps, rest, **RPE**, grip,
and whether it was completed. The unit anything is counted in — three sets are
three sets and never "three efforts", though *effort* is both what an RPE rates
and what the app calls it on screen.
_Avoid_: rep, attempt

**RPE**:
How hard a set felt, answered by the athlete and never by the app. A
**prescription** carries an RPE *range* — what the set was asked to feel like —
and the set carries the one number the athlete gave; they are two things and
never one field. A set nobody rated has no RPE, which is neither a zero nor the
middle of what was asked for. *Effort* is the plain word the app pairs with it
on screen ("Effort (RPE)").
_Avoid_: exertion, difficulty, hardness, effort score

**Logged exercise**:
One exercise inside a session, holding the sets recorded against it. It is an
instance of a library exercise, not another word for one — and it is history,
where a task is plan.
_Avoid_: session exercise, entry, task

**Round**:
One pass through the work and rest segments inside a set — what the rest timer
counts down. A 6 × (7s on / 3s off) set runs six rounds, and the athlete logs the set
rather than each round.
_Avoid_: cycle, interval, rep

**Segment**:
The part of a protocol running right now — preparing, working, resting between
rounds, or resting between sets. Seconds long, and never a phase: a phase spans
weeks.
_Avoid_: phase, interval, stage, step

**Trained**:
A slot is trained once at least one of its tasks is marked complete — including
exercises the athlete added off-script, which count toward training rather than
against it. The one question adherence and carry-forward both ask.
_Avoid_: completed, done, logged

**Missed**:
A scheduled slot whose day has passed untrained — the app's claim that the
athlete had the chance and did not take it, which is why it is never said of an
account with no training behind it at all. A state of a slot and never of work:
what a missed slot hands forward is carry-forward.
_Avoid_: failed, incomplete, no-show, skipped

**Adherence**:
The share of a training week's scheduled slots that were trained. Scales how far
progression carries into later weeks.
_Avoid_: compliance, completion, consistency

**Held work**:
Exercises pulled out of today's session because the verdict caps intensity below
what they demand. Held, not cancelled.
_Avoid_: skipped, dropped, deferred

**Carry-forward**:
Scheduled work that went untrained — missed or held — offered again on the next
training day. It is *work*, and never a slot's state: a slot the athlete
part-trained is **trained** and still hands its untouched exercises forward, so
carry-forward is read from the tasks rather than off a slot.
_Avoid_: missed work, backlog, catch-up

**Unsynced work**:
Training the athlete has recorded on this device that has not yet reached the
server. Safe to keep training on — reads come from the device — but it exists in
one place only, and an uninstalled app may have it deleted by the browser after
a week idle. Work the server has declined is **refused work** — unsynced work in
its final state, not a separate thing.

Said to the athlete as this noun and one verb: the work is *unsynced work*, and
what happens to it is that it is **sent** — "waits until it has been sent", "will
never be sent", "not sent". Never *saved*: that word already names two other
things the athlete does here, a **saved program** and a draft the app saves as it
is typed, so it cannot also mean this. (It is for that reason absent from the list
below rather than on it — a word this codebase uses for something else makes the
audit unrunnable, not stricter.)
_Avoid_: pending, queued, unsaved, outbox, offline changes

**Refused work**:
Unsynced work the server has declined to store — its final state, and the one
kind of it that finding a signal does not fix. Always both words: a refused
*sign-in* is a different event, and the bare word is ambiguous between them.
_Avoid_: rejected work, failed write, dead letter, sync error, conflict, refusal

**Draft**:
What the athlete is part-way through entering, before it is recorded — a
half-answered readiness check, a session with some sets filled in, a clock they
have configured but not started, a baseline they have started and not finished.
It lives on one device and is never sent to the server.

A draft belongs to the thing it was started against — one day, one slot, one
protocol, one account — and is discarded rather than offered once that thing has
moved on. What counts as moving on is the scope's own: a day turns, a slot is
left, a protocol changes, and an account's baseline draft ends when the baseline
it was feeding is recorded. The scope is what makes a draft honest; offering one
outside it is the app remembering something that is no longer true.

Not unsynced work, which is the opposite case in the pair the athlete is most
likely to confuse: unsynced work is training already *recorded* that the server
does not have yet and may never get, while a draft is training not recorded at
all and never will be. Losing unsynced work loses history; losing a draft costs a
re-entry.
_Avoid_: pending, partial, autosave, unsaved, in-flight

### Reaching the athlete

**Cue**:
One event in a running protocol the athlete has to be told about while they are
not looking at the screen — a segment beginning or ending, the last three
seconds, the protocol finishing. It is the event and not the sound: one cue has
three deliveries, a sound, a buzz and a notification, and a cue with all three
switched off is still the same cue.
_Avoid_: beep, alert

**Daily notice**:
The one message sent each morning naming the day type the athlete's slot runs
today, carrying that day type's headline. Read from the program rather than from
what has been trained, so it is true on a device that has not synced in a week —
and a rest day sends nothing rather than sending that there is nothing.
_Avoid_: reminder, digest, alert, morning push

**Nudge**:
A standing invitation on a screen to record something the app cannot know on its
own — today's bodyweight, the one the athlete meets daily. It asks, and being
ignored is a normal outcome; it never claims anything is wrong or overdue, which
is what separates it from a flag. Never the verb: a calibration *nudging* a score
is arithmetic, and this is a piece of a screen.
_Avoid_: callout, nag, reminder

**Time zone**:
Where the athlete's day starts — the IANA zone their device reports, held on the
account because it is the only thing that lets a server decide when their morning
is. A zone and never an offset: an offset moves twice a year and the zone that
holds it does not. It belongs to the device rather than to the athlete's taste, so
it is read and never asked for, and an account that has never reported one has
none rather than a guessed one.
_Avoid_: locale, UTC offset, TZ

### Readiness

**Readiness check**:
The daily questionnaire the athlete answers before training. Core questions are
always asked; follow-ups appear only when the answer could change the verdict.
_Avoid_: quiz, assessment, check-in, day recommender

**Readiness score**:
0–100 from the wellness answers, higher meaning fresher, shifted by the
athlete's own calibration.
_Avoid_: rating, index, wellness score

**Verdict**:
The ceiling set on today's session — rest, tissue, moderate, short, or green.
The single answer a readiness check produces.
_Avoid_: recommendation, intensity, conclusion, result

**Flag**:
A specific problem the readiness check surfaced, with its own advice, severity,
and optional body area. Several can accompany one verdict.
_Avoid_: warning, alert, issue, note

**Calibration**:
A per-athlete offset applied to the readiness score, learned from how their
sessions actually turned out against what was predicted.
_Avoid_: adjustment, correction, tuning

**Outcome**:
How a session actually went, reported by the athlete afterwards: bailed, flat,
as-expected, or strong. The only thing calibration learns from.
_Avoid_: result, feedback, rating, review

**Probe**:
An objective same-day reading — a quick maximal finger pull — compared against
the athlete's own recent norm to catch fatigue they haven't noticed. Read for
today's freshness, never for progress.
_Avoid_: test, metric, marker, measurement
_Leaving_: **already removed from the rebuild.** A readiness check rests on
wellness answers and load alone, with no objective reading to contradict them.
Still present in the SvelteKit app until cutover. **The word is not reused** — the
search for a working load is a **load search**, and this reading was the opposite
of it: same-day freshness, never progress.

**Injury self-check**:
A per-area questionnaire modelled on a validated clinical instrument, scoring
0–100 and banding to a rehab stage. Informs training, never diagnoses.
_Avoid_: deep assessment, diagnosis, screening, test

**Band**:
Which of three ranges an injury self-check score fell in — manageable, moderate
or significant. It is what routes the athlete to a rehab stage, so it is never
free text.
_Avoid_: bracket, tier, grade, level

**Pain level**:
How a reported symptom presents, from stiff through tender and painful to sharp.
Distinct from a flag's severity, which is how urgently to act, and from soreness,
which is one of the daily wellness answers.
_Avoid_: severity, soreness, pain score

**Niggle**:
A current low-grade finger or tendon complaint the athlete is still training on.
Given at the intake, where it is not a note: it caps finger effort in every
finger exercise the generated program prescribes and softens each phase. Not an
injury, which stops training rather than capping it, and not a pain level, which
says how a symptom presents rather than that one is present.
_Avoid_: tweak, twinge, strain, injury, tendinopathy

**Synovitis**:
Pain or swelling at a finger joint, **as the athlete reports it** from the
fist-hook check at intake. It is the one clinical word the glossary keeps, and it
is kept as a name for what was reported and never as a finding — the same line
an injury self-check draws when it informs training without diagnosing. What it
routes to is the fingers self-check, not a conclusion.
_Avoid_: diagnosis, inflammation, PIP swelling

**Body area**:
A part of the body that can be hurt: fingers, elbow, shoulder or wrist. One
concept in two roles — a readiness flag surfaces one, an injury self-check scores
one, and a rehab block targets one. Not a region, which is what an *exercise*
loads and is an axis of training rather than of injury.
_Avoid_: region, joint, body part, injury site

**Rehab**:
The mode where the program is replaced by a conservative plan for one injured
area. The prior program is restored when rehab ends.
_Avoid_: recovery, prehab, deload

### Measuring

**Marker**:
A tested performance number tracked over time — max hang, pinch, rate of force
development, contact strength, critical force, density, pull, hardest grades.
Read for progress, never for today's freshness.
_Avoid_: metric, PR, benchmark, stat
_Leaving_: dropped in the rebuild — the athlete's tested numbers stop being
tracked over time. Internal load, workload ratio and monotony are unaffected:
they are derived from sessions, not from markers, and a readiness check still
reads them. **Bodyweight is the exception and survives** — it is not a test.
What leaves is the *tracking*, not the reading. The **load search**'s first tier
is a working load the athlete has **measured** rather than one they recall — the
distinction is how good the evidence is, not what kind of number it is. It is
never a tested max: a max is what an exercise can be tested at and a working load
is what it is trained at, and turning one into the other needs a per-exercise
fraction this app deliberately does not have.

**Bodyweight**:
The athlete's weight, tracked over time. Not a marker: nothing is tested and no
effort is expended, and it is read as the divisor other numbers are expressed
against rather than as progress in its own right. The baseline captures the
first reading; every later one is logged from Today.
_Avoid_: weight, mass, bw

**Strength index**:
A marker normalized so readings taken on different edge depths or block widths
are comparable, carrying how much to trust the conversion.
_Avoid_: normalized score, adjusted max
_Changing_: it does **not** leave with **Marker**, as this entry used to say. It
survives inverted — read once to suggest a starting **working load** from the
athlete's level and bodyweight, rather than tracked over time as progress. The
level half is the app's own judgment and says so; the hold-size conversion is the
part this term is named for.

**Internal load**:
Session **RPE** multiplied by session minutes — what a session cost the athlete,
as opposed to the load on the bar. A session nobody rated has none: with no RPE
there is nothing to scale by duration, only a duration.
_Avoid_: training load, volume, stress

**Workload ratio**:
Recent internal load measured against the athlete's longer-run average, banded
low / optimal / high / spike. One input to a verdict, never the decider.
_Avoid_: ACWR (in prose), load ratio, spike

**Monotony**:
How little a training week's daily loads vary. High monotony is a risk signal
regardless of total load.
_Avoid_: sameness, variability

### Evidence

**Claim**:
A stated proposition behind something the app asserts — a protocol, a
threshold, a progression rate — carrying how far it should be trusted and the
studies that back it. Every number the athlete is shown resolves to one. A
claim may honestly record that nothing backs it but the app's own reasoning.
_Avoid_: fact, finding, assertion, rationale

**Evidence grade**:
How far a claim should be trusted, from strong published evidence down to the
app's own reasoning. It belongs to the claim, not to the study — the same study
can strongly support one claim and barely touch another.
_Avoid_: confidence, quality, rating, score

**Study**:
A cited source a claim rests on: a peer-reviewed publication, or a book or
coaching resource cited for practical guidance rather than as primary evidence.
Studies back claims; a study is never attached directly to a number.
_Avoid_: reference, paper, citation
