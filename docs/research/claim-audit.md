# Every number in the app that needs a claim — the audit

Resolves ticket [32](https://github.com/YgorPerez/send-lab/issues/32) of the claims-and-studies map
([29](https://github.com/YgorPerez/send-lab/issues/29)). **Enumeration only.** Nothing here decides
anything, nothing here is a grade, and no item below has been checked against a paper.

**Audited 2026-08-16**, against the SvelteKit tree at `development` (`60bde5c`), scoped to the
rebuild's surviving surface per [12](https://github.com/YgorPerez/send-lab/issues/12) — nine pages,
with `metrics`, `stats` and `exercises` dropped along with `metrics[]`, `probeLog[]`,
`customExercises` and `log[]`. Markers, the strength index and the probe are leaving per `CONTEXT.md`.

---

## The headline

| | Count |
| --- | ---: |
| **Claim-sized items on the surviving surface** | **253** |
| Scalar constants underneath them | ~660 |
| Items with a structural citation today | **6** |
| Items with a citation of any kind, including code comments | ~40 |
| Studies on file | 16 |

**253** is the number to size against. It is not 40 and it is not 400 — it is close enough to the
midpoint that the bilingual-prose-in-message-catalogues question genuinely goes either way, and the
tier split below is what should decide it. See [§14](#14-what-this-means-for-the-catalogues).

### Read this before reading the tier column

Every item below carries a first-pass tier guess — *literature*, *practitioner consensus*, or *our own
judgment*. **The guess is for sizing only and is explicitly not a grade.** It is one agent's read of
what the constant looks like, made without reading a single paper. Real grading needs a scale that does
not exist yet (it is not on this map's *Decisions so far*) and a human who has read the source on the
population it claims. Several guesses below will move a tier once someone actually reads the paper, and
the *literature* guesses are the ones most likely to be wrong — a plausible-looking constant is exactly
the thing that launders a guess into a fact.

---

## The counting convention

The map settled that **`Claim` is the unit, not the constant and not the paper**, and that a protocol's
`7s / 3s / 90%` triple is graded once. This audit counts on that basis. Concretely:

**One item =**

- **one variant's whole parameter set.** `repeaters` variant 0 — `7s work / 3s rest / 6 rounds / 180s
  set rest / 3–4 sets / 20mm / 60% / RPE 7–9` — is **1 item**, not 7 and not 11. It is one proposition:
  *this is what a 7/3 repeater set is*.
- **one banded threshold group.** The workload-ratio bands `<0.8 · 0.8–1.3 · 1.3–1.5 · >1.5` are
  **1 item**, because you cannot defend one cut point without defending the others.
- **one keyed table.** `LEVEL_FACTOR = { intermediate: 1, advanced: 0.7, elite: 0.5 }` is **1 item** —
  one proposition about diminishing returns, expressed as three numbers.
- **one questionnaire question,** including its whole option→value ladder. "How did you sleep?" with
  `10 / 7 / 3 / 0` is **1 item**. The ladder's shape is the claim.
- **one piece of advice prose,** per flag or verdict.
- **each distinct quantity embedded in prose** that is not a restatement of a parameter. "~60% of
  finger injuries are A2/A4" is its own item; "7/3 · 20mm half-crimp" in a variant's *name* is not,
  because it restates that variant's params.

**Where the convention is arguable, and which way I went:**

- **Per-exercise weekly progression rates are counted individually (8 items), not as one table.** Unlike
  `LEVEL_FACTOR`, each rate carries its own named study and stands or falls alone.
- **The three default phases are 3 items, not 1.** "Base is 4 weeks at 95% intensity / 110% volume" is a
  different proposition from "deload is 1 week at 50/50".
- **Exercise taxonomy is counted per exercise (14), not per variant (56).** `qualities`, `region`,
  `cnsCost` and `grip` decide what a verdict holds back, what the CNS-load figure is, and what the rehab
  pool contains — so they are decision inputs and in scope — but the assignment is substantially the same
  across an exercise's variants.
- **The glossary (13 definitions) is excluded from the 253.** A definition of "RFD" is not a value.
- **Unit conversions are excluded.** `LB_PER_KG = 2.20462` is definitional, not a claim.

If the human prefers constant-level counting, the raw number is **~660**, of which 303 are exercise
parameters, 110 are questionnaire option values, and 44 are grade-scale rungs.

---

## Per-area breakdown

| # | Area | Items | Where | Cited today? | Tier guess (sizing only) |
|---|---|---:|---|---|---|
| 1 | Exercise protocols and their parameters | **89** | `content/exercises.ts`, `content/en-US.ts` | comments only | mostly practitioner consensus |
| 2 | The built-in week (day types) | **7** | `content/en-US.ts` `days[]` | no | our judgment |
| 3 | Progression engine | **13** | `progression.ts`, `readinessPlan.ts`, `plan.ts` | dead `study` field | mixed |
| 4 | Periodization | **10** | `programGen.ts`, `state.svelte.ts`, `plan.ts`, `content/logic.ts` | no | our judgment |
| 5 | Program generation from the baseline | **18** | `programGen.ts`, `presets.ts`, `AssessmentForm.svelte` | no | our judgment |
| 6 | Readiness scoring | **25** | `content/logic.ts`, `content/en-US.ts`, `stats.ts` | **6 questions** | mixed |
| 7 | Verdicts and flags (the advice itself) | **28** | `content/en-US.ts` | no | mixed |
| 8 | Internal load, workload ratio, monotony | **11** | `stats.ts` | comments only | literature |
| 9 | Program-template warnings | **4** | `programStats.ts` | no | our judgment |
| 10 | Injury self-checks | **27** | `content/en-US.ts` `deep`, `content/logic.ts` | **`source` + `url` per instrument** | literature |
| 11 | Rehab staging | **11** | `rehab.ts` | no | practitioner consensus |
| 12 | Prescription resolution and default rests | **7** | `plan.ts`, `dayLog.ts`, `timerStore.svelte.ts`, `train/+page.svelte` | no | our judgment |
| 13 | Grade scales | **3** | `grades.ts` | no | practitioner consensus |
| | **Total** | **253** | | **6 structural** | |

Rough tier split across all 253, for sizing: **~55 literature · ~85 practitioner consensus · ~113 our
own judgment**. If that split survives contact with a human read, roughly **45% of the app is our own
judgment** and needs no paper at all — only an honest label. That is the single most important number
in this document after 253, because it is the one that makes the workload tractable.

---

## 1. Exercise protocols and their parameters — 89

`src/lib/content/exercises.ts`, `exerciseParams` — **14 exercises × 4 variants = 56 variants**, 195
populated numeric fields, 303 scalars. Canonical units are documented at the top of the file (counts,
seconds, kg, mm, %, RPE 0–10) and `n(min, max)` builds every range.

| Sub-area | Items | Note |
|---|---:|---|
| Variant prescriptions (one per variant) | 56 | 4 of them (`rest`) carry 3 numeric fields between them |
| Exercise-level taxonomy — `grip` / `qualities` / `region` / `cnsCost` | 14 | decision inputs, not display: they drive the verdict cap, CNS load and the rehab pool |
| Quantities in `note` / `why` prose not present in the params | 19 | |

Per-exercise parameter density, for whoever has to source these:

| Exercise | Numeric fields | Scalars | Exercise | Numeric fields | Scalars |
|---|---:|---:|---|---:|---:|
| `abra` | 28 | 34 | `slopdens` | 16 | 23 |
| `repeaters` | 23 | 30 | `pinch` | 15 | 26 |
| `recruit` | 19 | 30 | `density` | 15 | 27 |
| `maxhang` | 18 | 23 | `limitboulder` | 12 | 21 |
| `wrist` | 16 | 28 | `pull` | 12 | 22 |
| `antag` | 9 | 16 | `sport` | 5 | 10 |
| `perform` | 4 | 8 | `rest` | 3 | 5 |

**Nothing here cites anything structurally.** The file header documents units, not sources. Where a
source appears it is inside localized prose — `'Ferrer-Uris 2023: 60mm sloper ≈ half-crimp FDP
activation'` (`en-US.ts:192`), `'2–3s margin (López MAW)'` (`:362`), `'(Gilmore/Baar 2024)'` (`:416`) —
i.e. a citation the athlete reads but no machine can check, and one of them (Gilmore/Baar 2024) **has no
matching record in `STUDIES`**, which only carries `baar` (2017).

The 19 prose-only prescriptions are the least visible part of this area, because they look like flavour
text and are not: `'Reverse wrist curls 3×15 · band finger extensions 3×20–30 · pronation/supination
3×12'` (`:453`) is the *entire* prescription for `antag` variant 0, whose params carry only `rpe 5–7`.
Also here: `'≥6h from hard work'` (`:412`), `'err under 40%'` (`:416`), `'Phase 2: drop to 2–3 sets/grip
@ ~65–70%'` (`:225`), `'2×15–20 min continuous easy traversing (ARC)'` (`:273`), `'~30s between arms'`
(`:156`), `'Rotate block width across the 8 weeks'` (`:159`).

**Tier guess:** practitioner consensus for most of it. `maxhang` (10s × 3 sets @ 18–20mm) and
`repeaters` (7/3 × 6 rounds) have real literature behind the *shape*; the exact set counts and rest
intervals almost certainly do not. `abra` at 40% MVC has Baar behind the mechanism but the specific
`10s on / 20s off × 20 rounds` dose is a protocol, not a finding.

---

## 2. The built-in week — 7

`content/en-US.ts` `days[]` / `pt-BR.ts`. Seven day types (`limit-power`, `pinch-wrist`, `endurance`,
`pull`, `max-tissue`, `performance`, `rest`), each an ordered exercise list plus a load label
(HIGH / MOD / OFF) plus a prime/secondary pairing.

Each is a claim about session composition and weekly sequencing — *these two exercises belong in this
order on the same day, and this day is hard*. **Nothing cites anything.** The load label is also read
programmatically (see [§9](#9-program-template-warnings--4)), which is where it goes wrong.

**Tier guess:** our own judgment, drawing on practitioner convention for hard/easy alternation.

---

## 3. Progression engine — 13

`src/lib/progression.ts` (36 lines, the densest file in the audit), plus `adherenceRatio` in
`readinessPlan.ts` and `buildWeeksThrough` / `loadPct` in `plan.ts`.

| Item | Value | Named study |
|---|---|---|
| `abra` weekly gain | 3%/wk | `baar` |
| `density` weekly gain | 2.5%/wk | `baar` |
| `slopdens` weekly gain | 2.5%/wk | `ferrer` |
| `maxhang` weekly gain | 2%/wk | `lopez` |
| `recruit` weekly gain | 2%/wk | `nelson` *(reference)* |
| `pinch` weekly gain | 2%/wk | `nelson` *(reference)* |
| `pull` weekly gain | 2%/wk | `horst` *(reference)* |
| `repeaters` weekly gain | 1.5%/wk | `lattice` |
| `SYNERGY` + `SYNERGY_MULT` | `abra` doubles when `maxhang` is programmed | header comment cites Baar's ~3%→~6% |
| `LEVEL_FACTOR` | intermediate 1 · advanced 0.7 · elite 0.5 | none |
| Compounding model | `(1 + rate) ^ (buildWeeks − 1)` | none |
| `adherenceRatio` | floor 0.5; 0-logged and 0-scheduled weeks get full credit | none |
| Deload weeks do not accrue build weeks | `buildWeeksThrough` | none |

**The `study` field is dead.** `PROGRESSION` carries `{ weeklyPct, study }` per exercise, but
`weeklyRate()` reads only `weeklyPct` and **nothing in the tree ever reads `.study`** — no UI, no
export, no MCP tool. This slightly sharpens the map's note that progression "cites nothing
structurally": the structure exists, has eight rows filled in, and reaches nowhere. That is a cheaper
starting point for the citation model than the map assumes, and a warning about what happens when a
citation field has no test behind it.

**Three of eight rates rest on a `kind: 'reference'` source** — `nelson` (Camp4) and `horst` (Training
for Climbing) are coaching resources, self-declared as "cited for practical guidance, not as primary
evidence". That is already an honest one-bit grade doing exactly the job the map wants, on the
constants that most need it.

**Tier guess:** literature for `abra` / `density` / `slopdens` / `maxhang` / `repeaters` — though
"Baar found collagen synthesis rises" is a long way from "therefore 3% per week", and this is precisely
the population-and-inference gap the map warns about. Practitioner consensus for the three
reference-backed rates. Our own judgment for `LEVEL_FACTOR`, the compounding model and the adherence
floor.

---

## 4. Periodization — 10

| Item | Value | Where |
|---|---|---|
| Base phase | 4 weeks · 95% intensity · 110% volume | `state.svelte.ts:239`, `programGen.ts:92` |
| Peak phase | 3 weeks · 110% intensity · 85% volume | `state.svelte.ts:240`, `programGen.ts:99` |
| Deload phase | 1 week · 50% · 50% | `state.svelte.ts:241`, `programGen.ts:106` |
| Default block length | 8 weeks | `state.svelte.ts:247` |
| `LEVEL_SCALE` on phase intensity | intermediate 0.9 · advanced 1 · elite 1.1 | `programGen.ts:37` |
| Niggle softens every phase | × 0.9 intensity | `programGen.ts:161` |
| Ad-hoc phase defaults | 4 weeks · 100 · 100 | `plan.ts:602` |
| `phaseId` split rule | last week = deload; past the halfway point = phase 2 | `content/logic.ts:296` |
| Block-length clamp | 1–24 weeks | `plan.ts:390` |
| How intensity/volume apply | intensity scales `loadKg`; volume scales `sets` and `rounds`, floored at 1 | `plan.ts:592–596` |

`Periodization.svelte` turned out to hold **no built-in numbers at all** — it is a pure editor over
`program.phases`, and every default it displays comes from `state.svelte.ts` or `plan.ts:602`. The
ticket's expectation that it carries multipliers does not hold.

Note the duplication: `defaultPhases()` in `state.svelte.ts` and `levelPhases()` in `programGen.ts`
both encode 95/110, 110/85, 50/50 — one unscaled, one scaled. Two copies of the same three claims.

**Tier guess:** our own judgment throughout. Undulating intensity and a terminal deload are standard
practice, but 95→110 and a 110%-volume base week are chosen numbers.

---

## 5. Program generation from the baseline — 18

| Item | Value | Where |
|---|---|---|
| Weekday priority per goal (×3) | boulder `Mon Sat Fri Thu Wed Tue`, sport `Wed Sat Mon Thu Fri Tue`, all `Mon Wed Sat Fri Thu Tue` | `programGen.ts:22` |
| `FOCUS_DAY` | fingers→Fri · power→Mon · endurance→Wed · tissue→Fri | `:29` |
| `sessionCap` | ≤45 min → 2 exercises · ≤75 min → 3 · else unlimited | `:55` |
| `REQUIRES` gear map | 11 exercise→equipment bindings | `:40` |
| `gradeLevel` | V10+ → elite · V7+ → advanced · else intermediate | `:78` |
| `LOAD_FROM_BASELINE` | working load = 0.9 × tested max, for `maxhang` / `pull` / `pinch` | `:63` |
| `NIGGLE_RPE_CAP` | 8 on finger exercises | `:70` |
| `FRESH_LOAD` starting weights (×3 levels) | intermediate 15/15/10 · advanced 30/30/18 · elite 45/45/28 kg | `AssessmentForm.svelte:57` |
| Onboarding defaults | bodyweight 70 kg · 4 days/week · all four equipment types | `AssessmentForm.svelte:51–69` |
| Protocol presets (×5) | `boulder-power`, `sport-endurance`, `finger-base`, `tissue-base`, `all-round` — each a goal/focus/level/days tuple | `presets.ts:16` |

`presets.ts` holds **no protocol numbers of its own** — it is five assessment tuples fed through
`generateProgram`, so every number it produces is already counted in §4 and §1. The ticket lists it
alongside `Periodization.svelte` as a source of phase multipliers; neither is.

**Tier guess:** our own judgment throughout. `gradeLevel`'s V7/V10 cut points are the most defensible
(they track how the climbing world actually talks) and the weekday priorities the least — they are
scheduling preference dressed as prescription.

---

## 6. Readiness scoring — 25

`src/lib/content/logic.ts` and the `quiz` block in the locale files. **This is the best-documented and
most honestly-hedged area in the codebase.** `logic.ts:49–66` carries a note that says, in the code's
own words, that the exact weights and band thresholds "are a reasoned default, **NOT** empirically
derived" and should be treated "as a sensible starting heuristic, not calibrated truth". Whatever
grading scale gets built, that comment is the target register.

| Item | Value | Cited? |
|---|---|---|
| 10 questionnaire questions (option→value ladders) | `sleep`, `fatigue`, `soreness`, `body`, `illness`, `time`, `severity`, `stress`, `mood`, `skin` | **6 carry `study`** — the only structural citations in the app |
| `WELLNESS` weights + fallbacks | fatigue 1.2 · soreness 1 · sleep 1 · stress 0.8 · mood 0.8; unanswered → 8 | comment cites Saw 2016 / Laurent 2011 / Fullagar 2015 |
| Score→intensity bands | ≥78 high · ≥60 moderate · else tissue | comment: heuristic |
| Injury gate | fingers+sharp → rest · painful → tissue · tender → moderate | no |
| Illness gate | ≥2 → rest · =1 → moderate | comment cites Schwellnus 2016 |
| Workload-ratio → verdict | spike → moderate; high/low → info flag only | comment cites Impellizzeri 2020 |
| Monotony → verdict | high → moderate | comment cites Foster |
| Skin | ≤5 → flag · ≤2 → cap at moderate | no |
| Downward trend → verdict | → moderate | no |
| Below-baseline flag | score ≤ baseline − 12 | no |
| Time budget → `short` verdict | `time` ≤ 3 | no |
| Follow-up reveal rules | `body`>0 → severity; sleep ≤3 or fatigue ≤4 → stress+mood; base intensity high → skin | no |
| `OUTCOME_SCORE` | bailed 20 · flat 45 · as-expected 70 · strong 95 | no |
| Calibration mechanics | clamp ±12 · needs ≥4 outcomes · window last 10 | no |
| Personal baseline | rolling mean of last 14 · needs ≥5 entries | no |
| Trend detection | mean(last 3) − mean(prior 5), ±8 | no |

**The 6 cited questions are the entire structural-citation surface of the app** — `content/types.ts:177`
`study?: string`, rendered by `ReadinessQuiz.svelte:48`. Which four are uncited: `body`, `time`,
`severity`, `skin`.

**Tier guess:** literature for the illness gate and the *direction* of the wellness weighting;
our own judgment for every threshold, every option ladder's spacing, and the whole calibration
mechanism. The calibration loop is genuinely interesting here — it is the app's own answer to
"we don't know these numbers", and it is unsourced and unvalidated.

---

## 7. Verdicts and flags — 28

`content/en-US.ts` / `pt-BR.ts`. This is the area where the app is most directly *telling the athlete
something about their body*, and it is the least covered.

| Sub-area | Items |
|---|---:|
| 5 verdicts (title + advice + focus list) | 5 |
| Distinct quantities embedded in verdict prose | 6 |
| 17 surviving flags (3 more die with the probe) | 17 |

The embedded quantities are the sharp end: `'~60% of finger injuries'` are A2/A4 pulley (`:744`);
`'get it assessed if it lasts past 3–5 days'` (`:744`, `:779`); `'well under 40%'` for Abrahangs
(`:751`, `:784`); `'2–3 sets ... in ~15 min'` for recruitment pulls (`:765`); `'15g collagen + 50mg vit
C'` `'~60 min before'` (`:772`, and again in the phase-1 banner `:1091`); and in the deload banner,
`'true unloading costs ~10–20% tendon collagen in days (Baar)'` (`:1103`).

Two flags **quote a threshold back at the athlete along with its own caveat** — `acwr_spike` says
"ACWR > 1.5 … a range associated with higher injury risk in some research. The ACWR is a debated
heuristic, not a hard rule"; `monotony_high` says "the ≥2 mark is a rough guide, not a hard cutoff".
That is the map's *traceability-not-evidence* stance already being practised in prose, in two places
out of twenty-eight.

`illness_systemic` carries the strongest medical claim in the app — fever plus exercise "carries a real
risk of **myocarditis**", and "wait until symptom-free and fever-free for 24h". Three studies exist for
this (`illness`, `neckcheck`, `illness_revisit`), and the flag links to none of them.

**Tier guess:** literature for the illness flags and the pulley-injury epidemiology (the ~60% figure is
a real and checkable number); practitioner consensus for the rehab-adjacent advice; our own judgment
for the collagen-timing protocol, which is a mechanism finding turned into a dosing instruction.

---

## 8. Internal load, workload ratio, monotony — 11

`src/lib/stats.ts`. **These survive the `stats` page being dropped** — `acwr`, `weekLoad` and
`readinessInsights` all feed `computeReadiness` through `LoadSignals`, and `CONTEXT.md` says so
explicitly. An audit done page-by-page rather than function-by-function would wrongly delete this whole
section.

| Item | Value | Cited (comment) |
|---|---|---|
| Internal load = session RPE × session minutes | sRPE | Foster |
| Session-RPE fallback when nothing logged | 5 | no |
| Duration fallback chain | `durationMin` → summed work+rest → 2.5 min/set | no |
| EWMA smoothing constant | λ = 2/(N+1) | Williams et al. 2017 |
| Acute / chronic windows | ≈7 days / ≈28 days | Williams et al. 2017 |
| Minimum history before a ratio is shown | 21 days | no |
| Workload-ratio bands | <0.8 low · 0.8–1.3 optimal · 1.3–1.5 high · >1.5 spike | Gabbett/Hulin lineage, via `STUDIES` |
| Monotony | mean daily load ÷ SD over 7 days | Foster 1998 |
| Monotony when SD = 0 | 7 | no |
| Strain | weekly load × monotony | Foster 1998 |
| CNS weighting | low 1 · mod 2 · high 3 | no |

`CNS_WEIGHT` is **duplicated verbatim** in `stats.ts:18` and `programStats.ts:15`. One claim, two
copies — a good early test case for the "every constant resolves to a claim" gate, since a gate keyed
on claims rather than call sites catches this for free.

**Tier guess:** literature, and the best-sourced non-clinical area in the app. Three of the sixteen
studies (`acwr`, `ewma`, `foster`) exist to back exactly these eleven items, and the code chose EWMA
over rolling averages *for a stated methodological reason*. The uncited fallbacks (RPE 5, 2.5 min/set,
monotony 7) are our own judgment and are the weak joints.

---

## 9. Program-template warnings — 4

`src/lib/programStats.ts`, rendered by the Program editor.

| Item | Value |
|---|---|
| Back-to-back hard days | two consecutive `HIGH` days (wrapping) → warn |
| No rest day in the week | → warn |
| Single-region concentration | > 50% of planned sets on one region → warn |
| Planned-sets fallback when a variant has no `sets` | 1 |

**Bug, live today: the back-to-back warning compares a localized label.** `programStats.ts:98` tests
`a.load === 'HIGH'`, but `load` is display prose — `pt-BR.ts:12` says `'ALTO'`. So the warning **never
fires in Portuguese**. This is the exact trap ADR-0003 exists to prevent (a label is never an
identifier), and it is the same shape as the `REST_DAY_TYPE` fix that was already applied elsewhere in
the same file. Not this ticket's to fix, but the rebuild must not reproduce it.

**Tier guess:** our own judgment. The 50% threshold in particular is a round number with nothing behind
it.

---

## 10. Injury self-checks — 27

`content/en-US.ts` `deep`, scored by `content/logic.ts` `scoreDeep`. **The best-sourced part of the
app, as the ticket suspected** — and the only place where a source is *structural data* rather than
prose or a comment: `DeepAssessment` carries `source: string` and `url: string` fields
(`content/types.ts:215`), rendered to the athlete.

| Area | Instrument | URL on file | Questions |
|---|---|---|---:|
| `fingers` | VISA-C (climbing finger / hand / wrist) | `pmc.ncbi.nlm.nih.gov/articles/PMC12488532/` | 6 |
| `elbow` | PRTEE (lateral elbow tendinopathy) | `pubmed.ncbi.nlm.nih.gov/17254903/` | 6 |
| `shoulder` | SPADI (Shoulder Pain & Disability Index) | `physio-pedia.com/Shoulder_Pain_and_Disability_Index_(SPADI)` | 6 |

Count: 3 instrument-selection claims ("VISA-C's domains are the right screen for a climber's finger")
+ 18 question ladders + `scoreDeep` normalization + the 80/60 band thresholds + the band→rehab-stage
mapping + 3 band recommendations = **27**.

The band thresholds are the most carefully hedged constant in the app: `logic.ts:285` says
"Thresholds track the VISA-C group means (no-pain ~83, pain ~72, limiting ~60)". That is a stated
derivation from a stated source — a claim in everything but shape.

**There is no wrist self-check.** `wrist` is a `FlagArea` (`logic.ts:4`), a `RehabArea` (`rehab.ts:9`),
has two flags (`wrist_pain`, `wrist_niggle`) and a full rehab avoid-list — but `deep` has only
`fingers`, `elbow`, `shoulder`. `DeepAssessment.svelte:15` does `content.deep[area]` with no fallback.
So a wrist complaint routes into rehab staging with **no instrument behind the stage it lands in**.
(This is also where the standing note about a Silbernagel-based instrument comes from — nothing by that
name exists anywhere in the tree.)

**Tier guess:** literature, with the loudest population caveat in the audit. VISA-C, PRTEE and SPADI
are validated instruments — but validated as *whole scored questionnaires on clinical populations*, and
what ships here is a 6-item reduction with re-worded items and re-derived bands. "Modelled on" is
carrying real weight in that `source` string, and it is exactly the kind of misapplication the map
names as worse than a missing citation.

---

## 11. Rehab staging — 11

`src/lib/rehab.ts` (73 lines, zero citations of any kind — the least-sourced file that produces a
prescription).

| Item | Value |
|---|---|
| `acute` stage | RPE 4 · 45% intensity · 60% volume · 2 days/week · no auto-progression |
| `subacute` stage | RPE 6 · 65% · 70% · 3 days · no progression |
| `returning` stage | RPE 7 · 80% · 80% · 4 days · progression on |
| `POOL` — the rehab-safe exercise set | `antag`, `density`, `slopdens`, `abra`, `wrist`, `repeaters` |
| `AVOID` per area (×4) | fingers drops 6 · elbow 4 · shoulder 4 · wrist 3 |
| `PRIORITY` weekday order | `Tue Thu Mon Fri Wed Sat` — "low-CNS weekdays first" |
| Rehab block shape | 6 weeks, one phase |
| Exercise cap per rehab day | ≤ 3, falling back to `antag` alone |

The file's own header says it is "deliberately cautious — not medical advice". That is the right
posture and it is not a source. **The whole progression criterion is `stage.progress: boolean`** — there
is no criterion for *advancing* a stage other than re-running the self-check, so "rehab staging and its
progression criteria" from the ticket is, in the code, staging with no progression criteria at all.

**Tier guess:** practitioner consensus for the staged load-and-frequency ladder (that shape is standard
tendinopathy management); our own judgment for every specific number, the weekday ordering, and the
avoid-lists.

---

## 12. Prescription resolution and default rests — 7

| Item | Value | Where |
|---|---|---|
| Timer get-ready countdown default | 5s when `prepareSec` is unset | `plan.ts:306` |
| Timer seeding rule | work/rest/rounds = range **midpoint**; sets = range **minimum** | `plan.ts:307–311` |
| Prefilled set values | every field = range midpoint | `dayLog.ts:8`, `defaultSet` |
| Rest countdown after a completed set | `setRestSec` mid → `restSec` mid → **60s** | `train/+page.svelte:194` |
| Timer factory defaults | 7s work · 3s rest · 6 rounds | `timerStore.svelte.ts:32` |
| `PREFILL_FROM_METRIC` load factors | maxhang 0.9 · recruit 0.6 · density 0.6 · abra 0.5 · slopdens 0.4 · pinch 0.9 · pull 0.9 | `plan.ts:425` |
| Ordering rules | variant resolution (per-slot swap → program default → global swap → 0); `COMPOUND = Mon/Wed/Thu/Fri` days show a two-exercise chain | `plan.ts:145`, `week/+page.svelte:53` |

The midpoint-vs-minimum asymmetry is a real, uncommented choice: the timer seeds **sets at the minimum**
of the range while seeding everything else at the midpoint. That is a claim about how to interpret a
prescribed range, and it disagrees with `programStats.setsOf`, which uses the midpoint for the same
field. Two functions, two readings of the same number.

**Tier guess:** our own judgment throughout. The bare `60` is the clearest example of what the ticket
means by "a bare number in a prescription".

---

## 13. Grade scales — 3

`src/lib/grades.ts`. `BOULDER_SCALE` (V0–V17, 18 rungs), `ROUTE_SCALE` (5a–9c, 26 rungs), and the model
underneath both — grades stored as an **ordinal index**, i.e. treated as equally spaced.

The equal-spacing assumption is the claim; the scales themselves are convention. In the rebuild these
survive only as `Baseline` intake fields (`boulderGrade`, `routeGrade`) feeding `gradeLevel` — the
"hardest grades" *marker* dies with `metrics[]`, so grades stop trending. The file header, which
describes them as "the grade markers … so they trend and log like any marker", will be stale.

**Tier guess:** practitioner consensus for the scales, our own judgment for equal spacing (which is
demonstrably wrong — nobody thinks V15→V16 is the same step as V2→V3 — but may not matter for the one
use that survives).

---

## What is load-bearing and scheduled to die

Not part of the 253. Recorded because the rebuild loses working machinery here, and losing it quietly
is worse than losing it deliberately.

**1 — Dropping `metrics[]` leaves most weighted exercises with no prescribed load at all.** This is the
biggest finding in the audit. `prefillLoadKg` (`plan.ts:437`) is the only path from the athlete's
strength to a number of kilos on the screen, and `PREFILL_FROM_METRIC` reads `appState.metrics`
directly. Of the seven exercises in that table, **only `pull` variant 0 has a `loadKg` range in its
params** (30–45 kg); `maxhang`, `recruit`, `density`, `abra`, `slopdens` and `pinch` have none. So today
the load comes from a marker, and in the rebuild there will be no marker. `LOAD_FROM_BASELINE` in
`programGen.ts` has the same problem by a different route — onboarding seeds `targets[].loadKg` at
0.9 × tested max, and #12 already flags `assess_baseline` as changing. `FRESH_LOAD` in
`AssessmentForm.svelte` (9 starting weights by level) is the only strength number in the app that does
*not* come from a test, and it exists solely to prefill the test form, not as a fallback prescription.
**Either the rebuild keeps a strength number somewhere, or seven exercises ship with an RPE target and
nothing else.** Worth a ticket on the rebuild map, not this one.

**2 — The strength index is prior art for the grading scale this map still needs.** `strength.ts` is
leaving, and should — but it already does the thing #29 says has no scale: it emits a
`confidence: 'high' | 'med' | 'low'` alongside every estimate, banded by *how far the input sits from
the range where the estimate is trustworthy* (`edgeConfidence`: high 14–22 mm, low outside 6–30 mm).
Its header says outright that there is "no exact public edge→force law … so this is a documented
ESTIMATE", and `EDGE_K = 10` is commented `(tunable)`. That is a working, shipped, three-level honesty
grade with a stated derivation rule. Read it before designing the claim grades; then delete it.

**3 — The probe takes about 7 items with it.** `probeReadiness` thresholds (≥15% below baseline → low,
≥6% → fatigued, ≤−5% → fresh; needs ≥3 priors; window last 10), the `LoadSignals.probe` branch of
`computeReadiness`, three flags (`probe_low`, `probe_fatigued`, `probe_fresh`), the `rd_probe_why`
instruction ("one ~5s near-maximal pull"), and one of the sixteen studies (`probe` — Claudino 2017,
countermovement-jump readiness). Nothing else cites Claudino, so that study becomes an orphan the moment
the probe goes — the first test case for the map's "no orphan studies" CI check.

**4 — Markers take 5 metric descriptions and 44 grade-scale rungs' worth of purpose with them.** The
`metrics` block in both locale files (10 entries, 5 carrying test protocols like "Best 7-second lift on
an ~80mm pinch block" and "max added weight, 10s, 20mm edge") describes *how to test*, not how to train.
Those test protocols are claims, they are athlete-facing, and they die. If any part of baseline testing
survives onboarding, they come back — check before deleting.

**5 — `assessment.ts` and `customExercise.ts` go entirely**, along with `log[]`'s `'test'` entries
written from `assessment.ts:93`. No claims lost; noted for completeness.

---

## Other findings worth a human's attention

- **Six.** That is how many of the 253 items have a citation a machine can follow today. Every other
  link between a number and a source is a code comment, a name inside prose, or nothing. The map's
  framing is right, and the ratio is starker than "wired in exactly one place" suggests once the
  denominator is known.
- **The `study` field on `PROGRESSION` is filled in and unread.** Eight rows of citation data that reach
  no surface. Cheap to wire up; also a lesson about why the map's *Testing* workflow needs the
  every-constant-resolves check rather than trusting the field to be used.
- **Two of sixteen studies are self-declared non-primary** (`kind: 'reference'` — Hörst, Nelson), and
  they back three of the eight progression rates. The one-bit grade is already load-bearing.
- **The most honest prose in the app is in comments, not in the UI.** `logic.ts:49–66` tells a developer
  the wellness weights are not empirically derived; the athlete is told nothing of the kind. Making the
  app "visibly honest where it is guessing" is, in a lot of cases, promoting a comment into content.
- **Two live inconsistencies found while counting**, neither this ticket's to fix: the localized-label
  comparison in `programStats.ts:98` (§9), and midpoint-vs-minimum disagreement between `timerSeedFor`
  and `setsOf` (§12).
- **`pt-BR` parity holds** for everything counted here — the day types, quiz, verdicts, flags, deep
  checks and phases all mirror `en-US`. Every prose-carried claim is therefore two strings, not one.

---

## 14. What this means for the catalogues

The open question this audit was meant to sharpen: *does bilingual-prose-in-message-catalogues survive?*
Today's catalogues are **533 keys per locale** (`messages/en-US.json`), of which **51 are `study_*`** —
16 studies × 3 keys (`title`, `summary`, `applies`) plus 3 shared labels. The rest of the training prose
does not live there at all; it lives in `content/en-US.ts` and `content/pt-BR.ts`, which are 1124 and
1137 lines.

Extrapolating the existing 3-keys-per-study pattern to 253 claims, each needing a proposition, a summary
and a grade rationale in two locales:

| | Keys per locale | Total strings |
|---|---:|---:|
| Today (16 studies × 3) | 51 | 102 |
| 253 claims × 3 | **759** | **1,518** |
| Catalogue total after | **~1,240** | |

**That is a 2.3× growth of the message catalogue, with the claim prose outnumbering the entire existing
UI vocabulary.** Two observations that bear on the decision rather than making it:

- **The tier split changes the shape more than the count does.** If ~113 items land in *our own
  judgment*, their "grade rationale" is a sentence, not a literature summary — and many could share one.
  The 759 figure assumes every claim is bespoke; the real number depends on how much boilerplate the
  judgment tier can share.
- **Three of the areas are dense enough to argue for their own file regardless.** Exercise protocols
  (89) already have their prose in `content/*.ts` rather than the catalogues, and the split between
  language-neutral params and per-locale prose that `content/types.ts` establishes is the pattern that
  scales — claims plausibly want the same shape (ids and grades in one neutral file, prose per locale)
  rather than 759 flat catalogue keys.

Both of those are for the map's *Not yet specified* section to settle. What this audit contributes is
the denominator: **253**.
