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

**Training record**:
Everything one athlete's account holds — the program, the sessions, the readiness
checks, the bodyweight series, the baseline. What an account owns, as opposed to
the account itself, which is the identity that owns it; and what a second device
is catching up to.
_Avoid_: state, data, document, account data

**Baseline**:
The one-off intake taken at onboarding — goal, focus, level, days per week, gear
on hand, hardest grades, current niggles. Shapes the generated program and its
progression rate.
_Avoid_: assessment, profile, onboarding, survey

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
A reusable archetype for a slot: its category, load level, and default exercise
list. A slot runs one day type; several slots can run the same one.
_Avoid_: day, template, protocol, split

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
A stored deviation from a built-in target, set by the athlete. Feeds into the
prescription; anything not overridden falls back to the built-in value.
_Avoid_: custom, target, edit

**Progression**:
The week-on-week climb in prescribed load, at a rate scaled by the athlete's
level and by how much they actually trained.
_Avoid_: overload, ramp, increase

### Training and recording

**Session**:
The training actually done in one slot on one calendar date. A slot is a plan; a
session is the history — so it records the day type it ran, rather than being
read back off whatever the program runs on that weekday now.
_Avoid_: workout, day, entry

**Task**:
One exercise as it appears in one slot — the unit the athlete ticks off.
_Avoid_: item, entry, todo

**Set**:
One logged effort within a session: load, edge, time, reps, rest, effort, grip,
and whether it was completed.
_Avoid_: rep, attempt, effort

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

**Adherence**:
The share of a training week's scheduled slots that were trained. Scales how far
progression carries into later weeks.
_Avoid_: compliance, completion, consistency

**Held work**:
Exercises pulled out of today's session because the verdict caps intensity below
what they demand. Held, not cancelled.
_Avoid_: skipped, dropped, deferred

**Carry-forward**:
Scheduled work that went untrained — skipped or held — offered again on the next
training day.
_Avoid_: missed work, backlog, catch-up

**Unsynced work**:
Training the athlete has recorded on this device that has not yet reached the
server. Safe to keep training on — reads come from the device — but it exists in
one place only, and an uninstalled app may have it deleted by the browser after
a week idle. Work that can never be sent is unsynced work in its final state,
not a separate thing.
_Avoid_: pending, queued, unsaved, outbox, offline changes

**Draft**:
What the athlete is part-way through entering, before it is recorded — a
half-answered readiness check, a session with some sets filled in, a clock they
have configured but not started. It lives on one device, is never sent to the
server, and belongs to the thing it was started against: a draft answers to one
day, one slot, or one protocol, and is discarded rather than offered once that
has moved on.

Not unsynced work, which is the opposite case in the pair the athlete is most
likely to confuse: unsynced work is training already *recorded* and certain to
reach the server, while a draft is training not recorded at all and never will
be. Losing unsynced work loses history; losing a draft costs a re-entry.
_Avoid_: pending, partial, autosave, unsaved, in-flight

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
Still present in the SvelteKit app until cutover.

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
_Leaving_: dropped with Marker.

**Internal load**:
Session effort multiplied by session minutes — what a session cost the athlete,
as opposed to the load on the bar.
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
