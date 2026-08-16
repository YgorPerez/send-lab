# Addendum — consumer-facing evidence grading in the wild

**Provenance, stated plainly.** This is the output of a sub-agent spawned while resolving
[#30](https://github.com/YgorPerez/send-lab/issues/30). Its hand-off back to the parent researcher
**failed** (`SendMessage` could not reach it), so this material never reached
`evidence-grading.md` and is preserved here rather than lost. It has **not** been merged into that
document's argument, and its claims have not been independently re-verified beyond what is noted.

It covers ground the main document does not: `evidence-grading.md` mentions Cochrane and Examine but
contains nothing on NIH ODS, NatMed Pro, Healthline, Harvard Nutrition Source, Labdoor, or Cochrane's
Plain Language Summary guidance.

**Facts only — no recommendations.** Fetched August 2026.

**Tooling note:** examine.com returns HTTP 429 with a Vercel Security Checkpoint page to plain fetches.
A 200 required `curl` with a full browser header set — real Chrome UA plus `Accept`, `Accept-Language`,
`Upgrade-Insecure-Requests`, `sec-ch-ua`, and all four `Sec-Fetch-*` headers.

---

## 1. Examine.com

### 1a. The methodology page moved

`https://examine.com/about/grades/` still resolves but 30x-redirects to
`https://examine.com/about/research-process/#examine-database`. The standalone grades page is gone;
methodology now lives inside "Our research process and editorial policy".

### 1b. Current rungs, verbatim

> **A:** Multiple, mostly consistent studies suggest at least a moderate effect.
> **B–C:** Fewer studies suggest a possible effect, there's some inconsistency in the data, or the
> effect is small.
> **D:** Either there's very little research on the topic, the studies are highly inconsistent, the
> effect is null or very small, or a combination of these issues.
> **F:** The evidence indicates that the intervention may make that specific outcome worse for the
> specific condition which that grade applies to.

**B and C share one published definition** — distinct letters in the UI, merged prose.

Scale framing, verbatim:

> Interventions that are indexed in the Examine Database are assigned a letter grade from A to F, with
> A indicating the most effective and F denoting those that are unsafe for that specific outcome.
> Examine grades are automatically calculated from the following 3 main inputs:
> - Magnitude of effect
> - Consistency of effect across studies
> - Number of studies

Scope, verbatim:

> The Examine Database is where we collect data exclusively from randomized controlled trials in humans
> or from meta-analyses of these trials.

**Undocumented word labels.** Every grade carries a plain-English `grade_label` used in the UI but
explained nowhere in prose. Extracted from embedded page JSON:

| Letter | `grade_label` |
|---|---|
| A | `High potential` |
| B | `Moderate potential` |
| C | `Low potential` |
| D | `Negligible potential` |

### 1c. Certainty and effect size are visually separate, structurally fused

The grade is a **composite that already folds magnitude in**, so it is not a clean certainty axis in the
GRADE sense. Table columns are `Intervention | Grade | Effect | Evidence`, where **Evidence** is raw
counts only (`50 Studies`, `Participants: 904`).

Effect magnitude, verbatim:

> Effect magnitudes (the arrows in the Effect column) are entered by hand by our expert research team.
> Examine researchers look at the body of evidence rather than single trials… take into account both the
> absolute magnitude and the clinical significance to determine the overall direction (increase,
> decrease, mixed, or none) and size (small, medium, large) of the effect.

Valence layer, verbatim:

> "Improvement" indicates a beneficial effect, "detriment" means a harmful effect, and
> "decrease/increase" indicates that whether there is a benefit or harm depends on the specific context
> (like testosterone, which is "good" when it goes down in a woman with polycystic ovary syndrome but
> "bad" if it decreases in an older man who is doing strength training).

### 1d. Visual encoding, from live markup

**Table badge** — 40×40 rounded square, bold uppercase white letter, drop shadow, solid grade colour.

**Free summary rail** — stacked two-tone pills, a saturated letter chip butted against a lighter tint of
the same hue carrying the outcome name:

```
[A] Power Output +1 more
[B] Anaerobic Capacity +8 more
[C] 12 outcomes
[D] 26 outcomes
```

Note the pattern: **top grades name their outcomes, low grades collapse to a bare count.**

**Effect meter** — inline SVG "signal bars made of arrows": three arrows of increasing height, filled
count encodes magnitude, filled `#6C757D` grey against unfilled `#d7cde0`. `No effect` is deliberately
**not** an arrow but a solid horizontal bar. A text label always sits under the glyph.

**Colour ramp** (from the site's compiled CSS; `-top` = chip, `-bottom` = strip):

| Grade | `-top` | `-bottom` |
|---|---|---|
| A | `rgb(162 206 98)` | `rgb(189 218 144)` |
| B | `rgb(221 211 87)` | `rgb(231 224 137)` |
| C | `rgb(250 184 22)` | `rgb(253 203 103)` |
| D | `rgb(234 124 75)` | `rgb(241 142 116)` |
| F | `rgb(234 78 78)` | `rgb(243 98 98)` |

Green → yellow → amber → orange → red, with **the letter as the redundant non-colour channel**.

**Small screens:** rows are a CSS grid rather than table layout — grade 100px, effect 120px, evidence
140–180px, name takes the remainder; vertical rules only at ≥md.

### 1e. Paywall

Partially paywalled. Logged out, the first three rows show Grade + Effect, then study and participant
counts stay visible while **Grade and Effect cells go blank**. The per-supplement grade *summary rail*
is free. Examine+ is `$29/mo`, `$16.50/mo billed yearly`, `Lifetime $999`.

### 1f. Three grading vocabularies shipped at once

**Interactions** — two-axis. Evidence: **probable** / **possible** / **theoretical**. Severity:
**severe** / **moderate** / **minor** / **unknown**.

**Supplement Guides** — an actionability ladder, verbatim: `Combinations` ("our top picks — the most
proven, safe, and effective") / `Primary` ("best safety/efficacy profile") / `Secondary` ("less
effective, less safe, or less proven, but still potentially beneficial") / `Promising` ("less evidence
for their effects. They could work or be a waste of money, and it's too early to say which") /
`Unproven` ("backed by tradition or by animal, epidemiological, biological, or anecdotal evidence, but
not yet by convincing human trials") / `Inadvisable` ("either potentially dangerous or simply
ineffective, marketing claims notwithstanding").

### 1g. Licensing — fully proprietary

> All the content and material on Examine.com is protected by copyright under both Canadian and foreign
> laws.

> You agree not to reproduce, duplicate, copy, distribute, sell, resell, or exploit any portion of
> Examine.com and its content… without express written permission by Examine.

They actively sell the data — an API/licensing enquiry form exists, advertising "evidence grades across
966 supplements, 497 conditions/goals, and 839 measured health outcomes".

---

## 2. NIH Office of Dietary Supplements — **the only public-domain scheme found**

No letter grades, no badges, no stars — but a strongly conventionalised verbal system, and the
consumer/professional split is a clean natural experiment.

### 2a. Consumer version — a four-column verdict table

Columns, verbatim: `INGREDIENT | DOES IT WORK? | IS IT SAFE? | BOTTOM LINE`.

`Does it work?` opens with a blunt verdict where one exists — the antioxidants row begins with the
single word **"No."** — then narrates. `Bottom Line` is a stock sentence, and the stock sentences form a
de-facto ordinal ladder carried **entirely by the quantifier**:

| Implied rung | Verbatim stem |
|---|---|
| nothing | "There's **no scientific evidence** to support…" |
| nothing | "There's **no scientific support** for…" |
| barely any | "There's **very little scientific evidence** to support…" |
| a little | "There's **little scientific evidence** to support…" |
| a little | "There's **not much scientific evidence** to support…" |
| some, thin | "There's **limited scientific evidence** to support…" |
| contested | "**Sports-medicine experts disagree** on the value of…" |
| unclear | "**It's not clear whether** taking HMB supplements will improve athletic performance." |
| conditional | "Beet juice **might improve** aerobic exercise performance **if you're recreationally active**." |
| settled | "**Sports-medicine experts agree** that creatine supplements can improve performance…" |

**Zero inline citations in the consumer version.**

### 2b. Health-professional version — the axes get their own columns

`Ingredient | Proposed Mechanism of Action | Evidence of Efficacy | Evidence of Safety`, and inside the
efficacy cell the two axes are **physically split into two lines** — an evidence-base descriptor, then a
labelled `Research findings :` line. Verbatim (beetroot):

> Limited clinical trials with conflicting results
> **Research findings :** Might improve performance and endurance to some degree in time trials and
> time-to-exhaustion tests among runners, swimmers, rowers, and cyclists; appears to be most effective
> in recreationally active nonathletes

The full descriptor set is `{quantity} × {consistency} × {duration/size qualifier}` compiled into one
noun phrase — a two-to-three-dimension certainty statement compressed to a single line, **with no
scale**. Observed values include `Several small clinical trials`, `Limited clinical trials with
conflicting results`, `Few short-term clinical trials that show no benefit for physical performance`,
`Numerous clinical trials with mostly consistent results`, and
`Numerous clinical trials generally showing a benefit for high-intensity, intermittent activity;
potential variation in individual responses`.

Cross-links are explicit and reciprocal between the two versions.

### 2c. Licensing — public domain

> **Public Use Policy** — Most of the information available from this site is within the public domain
> and unless stated otherwise, may be freely downloaded and reproduced, provided the content has not
> been changed or modified. When using information from this site, we do ask that you avoid creating the
> impression that the ODS is endorsing or promoting any particular product or service.

### 2d. Sibling — NCCIH

Fixed consumer headings "What Have We Learned?" / "What Do We Know About Safety?" / "Keep in Mind", and
the same quantifier ladder. Note `likely safe` / `possibly safe` is the same vocabulary family NatMed
uses as **formal rungs** — but here it is prose, not a rating.

---

## 3. Cochrane's Plain Language Summary guidance — **the richest artefact found**

*Template and guidance for writing a Cochrane Plain language summary*, Pitcher, Mitchell & Hughes,
Version 1, January 2022.

### 3a. The hard prohibition

Verbatim (p.14):

> • refer to 'very low-/low-/moderate-/high-certainty evidence'. **Readers have indicated in feedback to
> us that they do not find these terms easy to understand**;
> • use GRADE jargon such as 'indirectness' or 'imprecision'.
> • include summary statistics and confidence intervals.

Repeated p.17. **Cochrane's own consumer guidance bans the GRADE rung names from reader-facing text**
and replaces the scale with sentence templates.

### 3b. The 4×4 narrative matrix (effect size × certainty), verbatim

| Effect ↓ / Certainty → | High | Moderate | Low | Very low |
|---|---|---|---|---|
| **Large** | causes a large reduction/increase | **probably** causes a large reduction/increase | **may** cause a large reduction/increase | It is unclear if… **OR** We do not know if… **OR** …but we are very uncertain about the results |
| **Moderate** | reduces/increases | **probably** reduces/increases | **may** reduce/increase | ″ |
| **Small, important** | reduces/increases **slightly** | **probably** reduces/increases **slightly** | **may** reduce/increase **slightly** | ″ |
| **Trivial or none** | makes little to no difference | **probably** makes little to no difference | **may** make little to no difference | ″ |

The entire certainty axis collapses to **three modal words plus one escape hatch**: (nothing) /
`probably` / `may` / "we do not know". The very-low column merges all effect sizes into one cell.

Their own caveat, verbatim — directly relevant to a bilingual app:

> We acknowledge that the modifying terms suggested (such as 'probably' or 'may') have different
> meanings to different people and that they can be difficult to translate into other languages. For
> example, 'probably' does not have a unique translation in Chinese, and 'may' can be translated in at
> least 3 different ways in French… If you use qualifiers other than 'probably' or 'may', you should use
> them consistently throughout your summary.

### 3c. Limitations sentence stems, verbatim

| GRADE judgement | Stem |
|---|---|
| High | `We are confident that …` |
| Moderate | `We are moderately confident in the evidence because…` |
| Low | `We have little confidence in the evidence because …` |
| Very low | `We are not confident in the evidence because …` |

Plus a jargon-to-plain crosswalk:

- **Risk of bias** → "It is possible that people in the studies were aware of which treatment they were
  getting."
- **Inconsistency** → "The studies were done in different types of people/used different ways of
  delivering intervention."
- **Indirectness** → "The evidence does not cover all of the people/intervention/comparators/outcomes we
  were interested in."
- **Imprecision** → "Studies were very small." / "There are not enough studies to be certain…"
- **Publication bias** → "The studies that provide results for our review are likely to exaggerate the
  benefits…"
- **No studies** → "We found no studies to help us answer our question."

Directly relevant to small screens, verbatim:

> Readers will find overly dense summaries difficult to read… **Focus on the comparison(s) that have the
> most clinical importance for decision makers, not the ones with the most data or the best results.**

**Licensing:** no licence statement anywhere in the 35-page PDF; assume all rights reserved.

---

## 4. Healthline and Harvard

### 4a. Healthline — a binary article-level badge, not a per-claim grade

A teal `#02838d` "Evidence Based" pill next to the category name, opening a modal reading:

> This article is based on scientific evidence, written by experts and fact checked by experts… **This
> article contains scientific references. The numbers in the parentheses (1, 2, 3) are clickable links
> to peer-reviewed scientific papers.**

**One state only — no ladder.** Citations anchor to descriptive phrases ("A 2021 review found…") wrapped
in a custom element that rates **the source's provenance, not the claim's strength**:

```html
<hl-trusted-source source="PubMed Central"
                   rationale="Highly respected database from the National Institutes of Health">
```

That element appears 64 times on a single page. Four separate date types are published: written,
medically reviewed, fact-checked, updated. Also notable in 2026: *"All our health information is created
by humans for humans, and we do not publish content developed using generative AI tools."*

Proprietary.

### 4b. Harvard T.H. Chan Nutrition Source — no grading at all

No badge, no letter, no star, no rating widget. Evidence strength lives entirely in prose plus
**bracketed numeric citations with range collapsing** — `[1]`, `[2-4]`, `[20-32]` — where bracket-range
length is the only visible quantity signal. Hedging is free-form, not templated. One convention worth
noting: **per-reference conflict-of-interest asterisks in the reference list.** Proprietary.

---

## 5. Other products with a per-claim badge

### 5a. NatMed Pro — the most elaborate verified scheme

**Two parallel ordinal scales** (effectiveness, safety), assigned **per indication**:

> A product might be rated "Possibly Effective" for one condition, but be rated "Likely Ineffective" for
> another condition, depending on the evidence.

Seven effectiveness rungs: `EFFECTIVE` / `LIKELY EFFECTIVE` / `POSSIBLY EFFECTIVE` /
`POSSIBLY INEFFECTIVE` / `LIKELY INEFFECTIVE` / `INEFFECTIVE` / `INSUFFICIENT EVIDENCE`. Mirror safety
scale: `LIKELY SAFE` / `POSSIBLY SAFE` / `POSSIBLY UNSAFE` / `LIKELY UNSAFE` / `UNSAFE` /
`INSUFFICIENT EVIDENCE`, route-dependent — "camphor is rated 'LIKELY SAFE' when used topically, but it
is rated 'UNSAFE' when used orally."

Three transferable design features:

1. **Every rung carries an explicit action instruction** — "generally considered appropriate to
   recommend" / "do not have enough high-quality evidence to recommend for most people" / "People should
   be advised NOT to take". Prescriptive, not merely descriptive.
2. **Each rung is an AND-conjunction of three machine-checkable criteria.** Verbatim for Likely
   Effective: *"Evidence from multiple (2+) randomized clinical trials or meta-analysis including
   several hundred patients (level of evidence = A). Studies have a low risk of bias and high level of
   validity by meeting stringent assessment criteria (quality rating = A). Evidence consistently shows
   POSITIVE outcomes for a given indication without significant valid evidence to the contrary."*
   Internal `level of evidence` and `quality rating` sub-scales feed the public rung.
3. **Effective vs Likely Effective differ only by regulatory review.**

**Licensing, with a live datapoint.** Proprietary subscription — and MedlinePlus dropped it. Verbatim
banner:

> **As of July 29, 2025, the herbs and supplements information from the Therapeutic Research Center
> (TRC) Natural Medicines Comprehensive Database is unavailable.**

MedlinePlus now links out to NCCIH / NIH ODS narrative pages — the US government's consumer portal
**traded a per-indication rating scheme for ungraded prose**, apparently over licensing.

### 5b. Labdoor — letter grades on the wrong axis

Prominent `A+` letter badges grading **product quality** (label accuracy, purity, heavy metals), not
evidence for an effect. Relevant because **the letter-badge convention is already occupied by a
different meaning in supplement UX.**

### 5c. Evidence Stack — numeric 5-point per-claim score

`5.0 (Strong)` / `4.0 (Good)` / `3.0 (Moderate)` / `2.0 (Weak)` / `1.0 (Very weak)`, with bands
"Recommended shortlist — 4.0+" and "Useful but situational — 3.0–3.9". Explicitly claim-scoped:
*"Scores summarize evidence that a supplement does its stated job"*, so a supplement does not inherit a
score from unrelated outcomes. **Low provenance** — single page, unknown operator, no licence statement.

---

## 6. Licensing summary

| Source | Scheme | Status |
|---|---|---|
| Examine.com | A–F composite + 3-arrow effect meter | **Proprietary**; data sold via licensing form; grade partially paywalled |
| **NIH ODS** | "Does it work? / Is it safe? / Bottom Line" + quantifier ladder | **Public domain**, reproducible if unmodified and non-endorsing |
| NCCIH | "What Have We Learned?" narrative | US federal, same public-domain posture |
| Cochrane PLS guidance | 4×4 effect × certainty matrix + `probably`/`may` | **No licence stated**; assume all rights reserved |
| Healthline | binary "Evidence Based" badge | Proprietary |
| Harvard Nutrition Source | none; bracketed citations only | Proprietary |
| NatMed Pro | 7-rung × 6-rung, per indication | Proprietary; MedlinePlus licence terminated 2025-07-29 |
| Labdoor | A+…F **product-quality** grade | Proprietary; wrong axis |
| Evidence Stack | 1.0–5.0 numeric | No licence statement; low provenance |

---

## 7. Explicitly could not verify

1. **Examine's pre-revamp A–D "Level of Evidence" scheme**, where certainty and magnitude were separate
   columns. Well attested in secondary sources, but the historical legend could not be retrieved —
   web.archive.org was blocked from this environment. The A–D wording circulating in secondary write-ups
   is **unverified**. What *is* verifiable is the structural change: the current scheme is one composite
   letter that bundles magnitude into the grade.
2. **Examine's F-grade word label** — A–D confirmed from shipped data; no F appeared on any page sampled.
3. **evidentlycochrane.net** — entirely unreachable (`ECONNREFUSED` via both fetch paths). All Evidently
   Cochrane content is search-snippet only, including the high/moderate/low/very-low certainty gloss.
4. **consumerlab.com** — HTTP 403 on every path tried.
5. **NatMed Pro's visual encoding** — rung definitions are public, monographs are behind subscription.
6. **Zoe / Levels / Rootine / AG1 / WHOOP / Oura** — no per-claim evidence badge found. Reported as *not
   found*, **not** as "does not exist".
7. **Cochrane PLS guidance currency** — the file at the "current handbook" URL is stamped Version 1,
   January 2022; no newer revision found, but a newer one could not be positively ruled out.

---
---

# Part B — presenting an evidence grade to a lay reader: the empirical literature

**Provenance.** A second sub-agent of [#30](https://github.com/YgorPerez/send-lab/issues/30), whose
hand-off to the parent researcher also failed. Preserved here for the same reason as Part A. The parent
document contains Akl 2007 and Santesso, and **nothing** on Damman, Glenton, Carrasco-Labra, Rosenbaum,
Büchter, Holst, Budescu, WCAG, Birch, robvis, Knapp, icon arrays, Harvey balls or numeracy.

Its own confidence flags — **[UNVERIFIED]** and **[PARTIAL]** — are reproduced verbatim and must not be
stripped. Several key numbers come from search indexing rather than a direct read of a paywalled source
and are marked as such. Given that four of this repo's own sixteen citations point at the wrong paper,
**re-verify anything before quoting it as exact.**

---

## B1. Traffic-light colour, and why it is not sufficient on its own

**The canonical evidence-quality traffic-light tool ships a colour-blind palette as a first-class
option.** `robvis` — the standard RoB 2 / ROBINS-I / QUADAS-2 figure tool — defaults to red/amber/green
but documents, verbatim: *"Default is 'cochrane' which used the ubiquitous Cochrane colours, while a
preset option for a colour-blind friendly palette is also available (colour = 'colourblind')."*
McGuinness LA, Higgins JPT. *Research Synthesis Methods*. 2021;12(1):55–61. DOI 10.1002/jrsm.1411.
Its own maintainers treat red/amber/green as an accessibility hazard.

**NICE does not colour-code evidence strength.** It uses traffic lights for *clinical risk
stratification* (NG143, fever in under-5s) and conveys recommendation strength through **verbs** —
"offer" / "consider". No NICE convention for colour-coding evidence strength was found.

**TheNNT.com** grades green / yellow / red / black. **[PARTIAL]** — page returned HTTP 403; wording from
indexing.

**Front-of-pack nutrition labelling is the largest lay-facing traffic-light deployment.** UK multiple
traffic light: red/amber/green plus %RI numbers, voluntary, DH/FSA guidance updated Nov 2016.
Hersey JC et al. *Nutrition Reviews*. 2013;71(1):1–14. DOI 10.1111/nure.12000. PMID 23282247, verbatim:
*"Consumers can more easily interpret and select healthier products with nutrient-specific FOP nutrition
labels that incorporate text and symbolic color to indicate nutrient levels rather than
nutrient-specific labels that only emphasize numeric information."* See also Ducrot P et al.
*Nutrients*. 2015;7(8):7106–7125 (PMID 26305255) and *Am J Prev Med*. 2016;50(5):627–636 (PMID 26699246).

### Colour-vision deficiency prevalence

Birch J. Worldwide prevalence of red-green color deficiency. *JOSA A*. 2012;29(3):313–320.
DOI 10.1364/JOSAA.29.000313. PMID 22472762. Abstract verbatim: *"Large random population surveys show
that the prevalence of deficiency in European Caucasians is about 8% in men and about 0.4% in women and
between 4% and 6.5% in men of Chinese and Japanese ethnicity."*

US National Eye Institute, verbatim: *"About 1 in 12 men have color vision deficiency"*.

Wong B. Points of view: Color blindness. *Nature Methods*. 2011;8:441. DOI 10.1038/nmeth.1618 — origin of
the widely-used 8-colour "Wong palette". **[PARTIAL]** paywalled; figures from indexing.

### WCAG 1.4.1 — the normative requirement

**SC 1.4.1 Use of Color (Level A), verbatim:**

> Color is not used as the only visual means of conveying information, indicating an action, prompting a
> response, or distinguishing a visual element.

From the Understanding document, verbatim: *"providing the information conveyed with color through
another visual means ensures users who cannot see color can still perceive the information"* and *"This
should not in any way discourage the use of color on a page, or even color coding if it is complemented
by other visual indication."*

Also engaged: **SC 1.4.11 Non-text Contrast (Level AA)** — *"The visual presentation of the following
have a contrast ratio of at least 3:1 against adjacent color(s): User Interface Components [and]
Graphical Objects"*. **A red/amber/green grade chip is a "graphical object" under this criterion.**

**Net requirement: a redundant non-colour encoding** — shape, glyph, text label, pattern or position —
wherever colour carries meaning. Note this is exactly what Examine.com's design does (Part A §1d): the
letter is the redundant channel over the colour ramp.

---

## B2. Harvey balls and GRADE's circled symbols

**Harvey balls** — round ideograms filled to varying degrees, encoding ordinal levels in comparison
tables. Attributed to Harvey L. Poppel at Booz Allen Hamilton in the 1970s; **[PARTIAL]** the attribution
rests on non-primary sources only.

**Consumer Reports used them from 1979 to October 2016 and then abandoned them.** Their design agency,
verbatim: *"The redesign evolved the ratings to make them more intuitive, moving away from the red and
black circles to a more universally understood scale where green is excellent and red is poor."* So the
most famous consumer-facing Harvey-ball system **traded fill-level encoding for colour encoding** — the
opposite direction to what WCAG 1.4.1 would counsel, and worth weighing against it.

**Harvey balls in evidence grading: none found.** **[UNVERIFIED — negative result.]**

### GRADE's four levels

Balshem H et al. GRADE guidelines: 3. Rating the quality of evidence. *J Clin Epidemiol*.
2011;64(4):401–406. DOI 10.1016/j.jclinepi.2010.07.015. PMID 21208779. Verbatim: *"GRADE specifies four
categories—high, moderate, low, and very low—that are applied to a body of evidence, not to individual
studies."*

Handbook definitions, verbatim:

- **High:** *"We are very confident that the true effect lies close to that of the estimate of the
  effect."*
- **Moderate:** *"We are moderately confident in the effect estimate: The true effect is likely to be
  close to the estimate of the effect, but there is a possibility that it is substantially different"*
- **Low:** *"Our confidence in the effect estimate is limited: The true effect may be substantially
  different from the estimate of the effect."*
- **Very low:** *"We have very little confidence in the effect estimate: The true effect is likely to be
  substantially different from the estimate of effect"*

**Symbol form:** ⊕⊕⊕⊕ / ⊕⊕⊕⊝ / ⊕⊕⊝⊝ / ⊕⊝⊝⊝.

**[FLAG]** The empty glyph is **inconsistent across sources** — U+229D CIRCLED DASH (⊝) in GRADEpro and
GRADE publications, U+25EF LARGE CIRCLE (◯) in some Cochrane HTML. No canonical codepoint. Functionally a
four-step discrete fill meter, but built from circled-plus/circled-minus, so **at small sizes the four
states differ only by how many of four glyphs contain a "+"** — a direct concern for a phone.

### GRADE's verbal encoding — what lay readers actually meet

Santesso N et al. GRADE guidelines 26: informative statements. *J Clin Epidemiol*. 2020;119:126–135.
DOI 10.1016/j.jclinepi.2019.10.014. PMID 31711912. Verbatim: *"Statements for low, moderate and high
certainty evidence were acceptable to >60%. Key guidance … includes statements for high, moderate and low
certainty for a large effect on intervention x as: x results in a large reduction…; x likely results in a
large reduction…; x may result in a large reduction…, respectively."*

So: high → "results in"; moderate → "likely/probably results in"; low → "may result in"; very low → "the
evidence is very uncertain about…". This is the same ladder as Cochrane's plain-language matrix in
Part A §3b.

---

## B3. Star ratings

**Newcastle-Ottawa Scale** is the mainstream star-based quality tool, verbatim: *"A 'star system' has
been developed in which a study is judged on three broad perspectives: the selection of the study groups;
the comparability of the groups; and the ascertainment of either the exposure or outcome of interest."*
Researcher-facing, not lay. **[UNVERIFIED]** the widely-cited "max 9 stars" is not stated on the landing
page.

**No star-based grade in Cochrane, GRADE, NICE or USPSTF.** **[UNVERIFIED — negative result.]** USPSTF
uses A/B/C/D/I letters; SIGN and SORT use letters; GRADE uses circles.

### The key experiment — and stars lose

Damman OC, De Jong A, Hibbard JH, Timmermans DRM. Making comparative performance information more
comprehensible. *BMJ Quality & Safety*. 2016;25(11):860–869. DOI 10.1136/bmjqs-2015-004120.
PMID 26543066; PMCID PMC5136725.

n=902 consumers of varying socioeconomic status and cognitive ability. With 20 providers displayed,
proportion correctly identifying the top three:

| Format | Correct |
|---|---|
| **Coloured dots** | **84.3%** |
| Word icons | 76.6% |
| Star ratings | 70.6% |
| Numbers | 62.0% |
| Bar graphs | 54.2% |

Conclusion verbatim: *"particular presentation formats enhanced consumer understanding of CPI, most
importantly the use of overall performance scores, word icons and coloured dots, and a reduced number of
providers displayed."* **The most directly transferable finding in the corpus.**

Supporting Hibbard/Peters line: Peters E et al. *Med Care Res Rev*. 2007;64(2):169–190. PMID 17406019,
verbatim: *"Results were particularly strong for those lower in numeracy, who had higher comprehension
and made better choices when the information-presentation format was designed to ease the cognitive
burden and highlight the meaning of important information."* Also Hibbard JH et al. *Health Serv Res*.
2002;37(2):291–313 (PMID 12035995) and *Med Care Res Rev*. 2010;67(3):275–293 (PMID 20093399).

---

## B4. Comprehension trials

**Akl EA et al. Symbols were superior to numbers for presenting strength of recommendations to health
care consumers: a randomized trial.** *J Clin Epidemiol*. 2007;60(12):1298–1305.
DOI 10.1016/j.jclinepi.2007.03.011. PMID 17998085.

Verbatim: *"For the presentation of the SOR, participants had better objective understanding of symbols
than numbers (74% vs. 14%, P<0.001). … For the presentation of the QOE, objective understanding of
symbols and letters was similar (91% vs. 95%, P=0.509). Participants scored both symbols and letters
positively; the scores for symbols were however lower for ease of understanding (md=-0.7, P=0.019)…
Conclusion: Symbols were superior to numbers for the presentation of the SOR. Objective understanding was
high for both symbols and letters for the presentation of the QOE, but letters conveyed the QOE better
than symbols."*

**Load-bearing, and easy to misread from the title: for *quality of evidence* specifically, symbols were
NOT better than letters — 91% vs 95%, with letters scoring higher on subjective ease.** n=84, small.

**Glenton C et al.** Presenting the results of Cochrane Systematic Reviews to a consumer audience.
*Medical Decision Making*. 2010;30(5):566–577. DOI 10.1177/0272989X10375853. PMID 20643912. 34 members of
the public across four countries, think-aloud. Key line: **"Text modifiers … to convey different levels
of quality were only partially understood, whereas symbols with explanations were more helpful."** — bare
"may"/"probably" underperformed **a symbol paired with a legend**.

**Santesso N et al.** A summary to communicate evidence from systematic reviews to the public. *J Clin
Epidemiol*. 2015;68(2):182–190. DOI 10.1016/j.jclinepi.2014.04.009. PMID 25034199. RCT, n=143, five
countries. Verbatim: *"more participants understood the benefits and harms and quality of evidence (53%
vs. 18%, P < 0.001) … Better understanding was independent of education level."* **Even with the best
format only 53% understood benefits, harms and quality of evidence.**

**Carrasco-Labra A et al.** Improving GRADE evidence tables part 1. *J Clin Epidemiol*. 2016;74:7–18.
DOI 10.1016/j.jclinepi.2015.12.007. PMID 26791430. n=290 randomized. Verbatim: *"two (understanding risk
difference and quality of the evidence associated with a treatment effect) showed large differences
favoring the new format [63% … and 62% … more correct answers, respectively]."* **Understanding the
certainty rating itself was one of the two worst-performing items in the old format.**

**Rosenbaum SE et al.**, two 2010 papers (PMID 20434023, 20434024): user testing revealed *"unexpected
comprehension problems, mainly confusion about what the different numbers referred to"*, and SoF tables
cut time-to-find-key-information from 4 minutes to 90 seconds (P=0.002).

### The strongest negative finding

**Büchter RB et al.** Communicating Uncertainty in Written Consumer Health Information to the Public.
*J Med Internet Res*. 2020;22(8):e15899. DOI 10.2196/15899. PMID 32773375; PMCID PMC7445603. n=1727.
Conclusions verbatim: *"Communicating even a large magnitude of uncertainty for a treatment effect had
little impact on the perceived effectiveness. Efforts to improve public understanding of research are
needed to improve the understanding of evidence-based health information."*

**Holst C, Woloshin S, Oxman AD, Rose C, Rosenbaum S, Munthe-Kaas HM.** *JMIR Public Health and
Surveillance*. 2025;11:e62828. DOI 10.2196/62828. PMID 40101228. Six arms, US and Norway. **Plain
language beat no explicit language (37% vs 21% US; 53% vs 42% Norway); GRADE language showed inconclusive
effects.** Showing a margin of error helped only minorities (21–36%) and, combined with plain language,
*decreased* perceived certainty about benefits. **[PARTIAL]** figures from a PMC full-text fetch summary,
not a character-exact abstract.

---

## B5. Verbal probability words are read inconsistently — the sharpest quantified evidence

This bears directly on GRADE's lay-facing encoding, because that encoding *is* a verbal quantifier.

**Budescu DV et al.** Improving communication of uncertainty in the reports of the IPCC.
*Psychological Science*. 2009;20(3):299–308. DOI 10.1111/j.1467-9280.2009.02284.x. Judgments deviated
significantly from IPCC guidelines **even when respondents had access to those guidelines**.
**[PARTIAL]** from indexing.

**Budescu DV, Por H-H, Broomell SB, Smithson M.** The interpretation of IPCC probabilistic statements
around the world. *Nature Climate Change*. 2014;4(6):508–512. DOI 10.1038/nclimate2194. 25 samples,
24 countries, **17 languages**. Laypeople **regress the terms toward 50%**; the pattern is stable across
languages; adding an explicit numeric range alongside the verbal term raised consistency with IPCC
guidelines **from 27% to 40%**. **[PARTIAL]** paywalled; from indexing.

**Wallsten TS et al.** Measuring the vague meanings of probability terms. *JEP: General*.
1986;115(4):348–365. Terms like "probable" and "likely" map to **membership functions over [0,1] rather
than points**, differing substantially between individuals. **[PARTIAL]**.

### The medicines-labelling analogue — a 4–9× miscalibration

**Knapp P, Raynor DK, Berry DC.** Comparison of two methods of presenting risk information to patients.
*Quality & Safety in Health Care*. 2004;13(3):176–180. DOI 10.1136/qhc.13.3.176. PMID 15175486. Verbatim:
*"The mean likelihood estimate given for the constipation side effect was 34.2% in the verbal group and
8.1% in the numerical group; for pancreatitis it was 18% in the verbal group and 2.1% in the numerical
group."*

The EU guideline defines "common" as 1–10% and "rare" as 0.01–0.1%. **Readers read the verbal descriptor
as roughly 4–9× too large.** See also Berry DC et al. *Drug Safety*. 2003;26(1):1–11 (PMID 12495359);
Knapp P et al. *Br J Health Psychol*. 2009;14(3):579–594 (PMID 18992183); *Health Expectations*.
2016;19(2):264–274 (PMID 25645270).

**Taken together:** Glenton (verbal modifiers only partially understood) plus Budescu (regression toward
50%, stable across 17 languages) plus Knapp (systematic over-estimation) predict that a purely verbal
grade will be read inconsistently **unless paired with a symbol-plus-legend or a numeric anchor.** This
is in direct tension with Cochrane's plain-language guidance in Part A §3a, which bans the rung names and
leans entirely on `probably` / `may`.

---

## B6. Icon arrays, numeracy, and badges

**Zikmund-Fisher BJ et al.** Blocks, ovals, or people? *Medical Decision Making*. 2014;34(4):443–453.
DOI 10.1177/0272989X13511706. PMID 24246564. n=1502. Verbatim: *"Risk recall was significantly higher
with more anthropomorphic icons (restroom icons, head outlines, and photos) than with other icon
types."* Caveat verbatim: *"optimal icon types may depend on numeracy and/or graphical literacy skills."*

**Fagerlin A, Zikmund-Fisher BJ, Ubel PA.** Helping patients decide: ten steps to better risk
communication. *JNCI*. 2011;103(19):1436–1443. PMID 21931068 — *"including using plain language,
pictographs, and absolute risks instead of relative risks."* See also Galesic M et al. *Health
Psychology*. 2009;28(2):210–216 (PMID 19290713); Garcia-Retamero R, Galesic M. *Soc Sci Med*.
2010;70(7):1019–1025 (PMID 20116159) — *"Visual aids were most useful for participants who had low
numeracy but relatively high graphical literacy skills."*; Trevena LJ et al. *BMC Med Inform Decis Mak*.
2013;13(Suppl 2):S7 (PMID 24625237).

**Numeracy.** Peters E et al. Numeracy and decision making. *Psychological Science*. 2006;17(5):407–413.
PMID 16683928 — the less numerate *"were influenced more by competing, irrelevant affective
considerations."*

**US health literacy (NAAL 2003):** Below Basic 14%, Basic 22%, Intermediate 53%, Proficient 12% — **36%
at basic or below**. **[PARTIAL]** the NCES PDF is image-based and could not be text-extracted; figures
quoted from a peer-reviewed secondary source, Cutilli CC, Bennett IM. *Orthopedic Nursing*.
2009;28(1):27–34, PMCID PMC2668931.

**Badges.** Thumbs up/down and shields have **no documented convention in evidence grading**
(**[UNVERIFIED — negative results]**). The one well-documented, empirically evaluated badge convention
certifies research *practices*, not evidence strength: COS Open Practice Badges. Kidwell MC et al.
*PLoS Biology*. 2016;14(5):e1002456. PMID 27171007, verbatim: *"Before badges, less than 3% of
Psychological Science articles reported open data. After badges, 23% reported open data … 39% reported
open data in the first half of 2015, an increase of more than an order of magnitude from baseline."*
Evidence a badge changes **producer** behaviour — not evidence about lay comprehension.

---

## B7. What Part B could not verify

Reproduced verbatim from the sub-agent, and **not** to be stripped when this material is used:

1. **No study found testing lay comprehension of GRADE's ⊕⊕⊕⊝ glyphs specifically** against alternative
   visual encodings (Harvey balls, bars, dots, stars). Akl 2007 (n=84) is the closest.
2. Exact Unicode codepoint for GRADE's "empty" circle — inconsistent across sources.
3. IPCC AR5 likelihood table verbatim — ipcc.ch returned 403.
4. Consumer Reports' current rating scale definition — 403.
5. TheNNT rating-system page — 403; wording from indexing only.
6. PIAAC numeracy distributions — not retrieved.
7. **Nature-hosted (Wong 2011; Budescu 2014) and SAGE-hosted (Budescu 2009) texts could not be read
   directly; key numbers come from indexing and should be re-verified before quoting as exact.**
8. Harvey balls origin rests on non-primary sources only.
9. Newcastle-Ottawa "max 9 stars" not confirmed on the OHRI landing page.
10. No comprehension study specific to the CMS 5-star hospital display.
