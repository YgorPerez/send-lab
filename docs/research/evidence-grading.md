# Evidence-grading schemes — what exists, and what transfers

Resolves ticket [#30](https://github.com/YgorPerez/send-lab/issues/30) of
[Map: claims, evidence grades and the studies surface](https://github.com/YgorPerez/send-lab/issues/29).
**Research only. This document deliberately makes no recommendation** — the choice of scheme belongs
to the grading-scale decision ticket. Where the evidence favours one option on a *factual* dimension
(licensing, translation, published reliability figures) it is stated as the fact it is, and marked as
such.

**Researched 2026-08-16.** Every scheme claim cites the scheme's own publication where one is
reachable. Several of the canonical documents are paywalled or served as scanned PDFs; where a fact
comes from a secondary reproduction rather than the primary, that is said in the line.

---

## 0. Where the app is starting from

Read from `src/lib/studies.ts` (114 lines) and `CONTEXT.md`.

The app already carries a **one-bit evidence grade** and nothing else. `Study` is
`{ id, authors, year, url, kind?: 'reference' }`, and the only grading is the optional `kind`, whose
own comment reads:

```ts
/** Omitted for peer-reviewed studies; 'reference' marks a book or coaching
 *  resource — cited for practical guidance, not as primary evidence. */
kind?: 'reference';
```

So the existing distinction is *peer-reviewed paper* vs *coaching resource* — two rungs, applied to
the **document**, not to a proposition. `CONTEXT.md` defines **Study** as "a cited source behind a
question, threshold, or prescription". Sixteen studies exist; two of the sixteen (`horst`, `nelson`)
are `kind: 'reference'` with no year, pointing at an author's site rather than a paper.

Two structural facts follow, and they recur throughout this document:

- **Every scheme below grades something other than a document.** GRADE grades a *body of evidence for
  one outcome*; OCEBM grades *the study design you found for a question*; SORT grades *a
  recommendation*. None of them grades a paper. #29's decision that `Claim` is the unit — not the
  constant and not the paper — is aligned with all of them, and is the one place where the app's
  model already matches the field.
- **The current one-bit grade collapses two different axes**: "is this peer-reviewed" and "how much
  should you believe it". Hörst's *Training for Climbing* is not peer-reviewed; that is a statement
  about provenance, not about certainty. Every scheme below separates those axes, most of them
  explicitly.

---

## 1. The established schemes

### 1.1 GRADE

**What it is.** *Grading of Recommendations Assessment, Development and Evaluation.* An informal
collaboration begun in 2000, governed since 2013 by the GRADE Guidance Group (G3), an executive
committee of up to twelve rotating members
(<https://www.gradeworkinggroup.org/>). The working group's own site claims **"more than 120
organizations from over 20 countries around the world have endorsed or are using GRADE"** (ibid.);
the 2008 *BMJ* primer put it at "more than 25 organisations" including WHO, the American College of
Physicians, UpToDate and Cochrane
(<https://pmc.ncbi.nlm.nih.gov/articles/PMC2335261>). It is far and away the dominant scheme.

**The rungs — four, and they are about confidence, not about study design.** From the GRADE
Handbook, §5.1 (<https://gdt.gradepro.org/app/handbook/handbook.html>):

| Rung | Definition (verbatim) |
| --- | --- |
| **High** | "We are very confident that the true effect lies close to that of the estimate of the effect." |
| **Moderate** | "We are moderately confident in the effect estimate: The true effect is likely to be close to the estimate of the effect, but there is a possibility that it is substantially different" |
| **Low** | "Our confidence in the effect estimate is limited: The true effect may be substantially different from the estimate of the effect." |
| **Very low** | "We have very little confidence in the effect estimate: The true effect is likely to be substantially different from the estimate of effect" |

The 2008 *BMJ* wording was future-research-facing rather than confidence-facing — "High quality —
Further research is very unlikely to change our confidence in the estimate of effect" through "Very
low quality — Any estimate of effect is very uncertain"
(<https://pmc.ncbi.nlm.nih.gov/articles/PMC2335261>). **The label changed too**: what GRADE called
*quality of evidence* it now calls *certainty of evidence*, defined in 2017 as "the certainty that a
true effect lies on one side of a specified threshold or within a chosen range" (Hultcrantz et al.,
*J Clin Epidemiol* 87:4–13, <https://doi.org/10.1016/j.jclinepi.2017.05.006>). Both vocabularies are
still in circulation in the wild.

**How you get to a rung.** You do not pick one. You start from study design and move:

- Randomised trials start **high**; observational studies start **low**.
- **Five domains rate down** — risk of bias (study limitations), inconsistency, **indirectness**,
  imprecision, publication bias. Each can lower the rating by one or two levels.
- **Three domains rate up** — large magnitude of effect; all plausible confounding would reduce the
  demonstrated effect (or increase it where none was observed); dose–response gradient. Each can
  raise it by one or two levels. Rating up is only available to evidence that has not already been
  rated down.

(Handbook, <https://gdt.gradepro.org/app/handbook/handbook.html>; Cochrane Handbook ch. 14,
<https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14>.)

**The unit graded.** "Quality of evidence is rated for each outcome across studies (i.e. for a body
of evidence). This does not mean rating each study as a single unit" — GRADE Handbook §5.1. Two
outcomes from the *same* trial can carry different certainty.

**Certainty is separate from the recommendation.** GRADE deliberately splits them: certainty is
High/Moderate/Low/Very low; recommendation strength is a separate two-category axis, **strong** or
**weak/conditional** (<https://pmc.ncbi.nlm.nih.gov/articles/PMC2335261>). The *BMJ* paper is blunt
about why: "Not all grading systems separate decisions regarding the quality of evidence from
strength of recommendations. Those that fail to do so create confusion."

**Size of the specification.** GRADE is not a table. It is a numbered series in the *Journal of
Clinical Epidemiology* — the working group's own publication list runs at least to *GRADE guidelines
14/15/16* on evidence-to-decision, with later numbered guidance continuing (e.g. *GRADE guidance
36*, on inconsistency, <https://www.jclinepi.com/article/S0895-4356(23)00046-X/fulltext>) — plus a
book-length handbook. Article 8 of the series is the one on indirectness
(<https://www.jclinepi.com/article/S0895-4356(11)00183-1/fulltext>, paywalled at time of writing;
HTTP 403).

### 1.2 The Oxford CEBM Levels of Evidence (2011)

**What it is.** A one-page table produced by the OCEBM Levels of Evidence Working Group — Jeremy
Howick, Iain Chalmers, Paul Glasziou, Trish Greenhalgh, Carl Heneghan, Alessandro Liberati, Ivan
Moschetti, Bob Phillips, Hazel Thornton, Olive Goddard, Mary Hodgkinson — hosted by the Centre for
Evidence-Based Medicine, University of Oxford
(<https://www.cebm.ox.ac.uk/resources/levels-of-evidence/ocebm-levels-of-evidence>).

**The rungs — five, crossed with seven question types.** The table is two-dimensional: a row per
*kind of question*, a column per level. The "Does this intervention help? (Treatment Benefits)" row
is the one relevant to a training console (table v2.1,
<https://www.cebm.ox.ac.uk/files/levels-of-evidence/cebm-levels-of-evidence-2-1.pdf>, quoted
verbatim):

| Level | Treatment Benefits |
| --- | --- |
| **1** | "Systematic review of randomized trials or n-of-1 trials" |
| **2** | "Randomized trial or observational study with dramatic effect" |
| **3** | "Non-randomized controlled cohort/follow-up study" |
| **4** | "Case-series, case-control studies, or historically controlled studies" |
| **5** | "Mechanism-based reasoning" |

The other rows cover prevalence, diagnosis, prognosis, common harms, rare harms and screening. Level
5 is `n/a` for the prevalence and prognosis rows and "Mechanism-based reasoning" for the rest.

**It has a downgrade/upgrade rule, in a footnote.** Verbatim:

> "\* Level may be graded down on the basis of study quality, imprecision, indirectness (study PICO
> does not match questions PICO), because of inconsistency between studies, or because the absolute
> effect size is very small; Level may be graded up if there is a large or very large effect size."

That single footnote is a compressed restatement of GRADE's eight domains. **There is no guidance in
the table on how far to move or on how to decide** — the Introductory Document supplies judgment, not
rules.

**Note the n-of-1 placement.** The 2011 table puts **n-of-1 trials at Level 1 for treatment
benefits**, alongside systematic reviews of randomised trials, and the CEBM page flags this as the
most-misread cell: the intended meaning of Level 1 for treatments is "either N-of-1 randomized trials
or systematic reviews of randomized trials"
(<https://www.cebm.ox.ac.uk/resources/levels-of-evidence/ocebm-levels-of-evidence>). For the rare-harms
row, Level 1 includes "n-of-1 trial with the patient you are raising the question about". This is the
only scheme surveyed here that ranks single-subject evidence at the top. **#29 put n-of-1 validation
out of scope**; this is a fact about the scheme, not an argument to revisit that.

**What its own authors say it is not.** The Introductory Document
(<https://www.cebm.ox.ac.uk/files/levels-of-evidence/cebm-levels-of-evidence-introduction-2-1.pdf>)
opens with a standing header:

> "This must be read before using the Levels: no evidence ranking system or decision tool can be used
> without a healthy dose of judgment and thought."

and lists explicitly:

> "The Levels is NOT intended to provide you with a definitive judgment about the quality of
> evidence. There will inevitably be cases where 'lower level' evidence — say from an observational
> study with a dramatic effect — will provide stronger evidence than a 'higher level' study — say a
> systematic review of few studies leading to an inconclusive result"

> "The Levels will NOT PROVIDE YOU WITH A RECOMMENDATION."

**Its stated design goal is speed.** The document frames the table as a search shortcut: "Designed so
that it can be used as a short-cut for busy clinicians, researchers, or patients to find the likely
best evidence… Imagine making a decision about treatment benefits in 'real time' (a few minutes, or
at most a few hours)." And on how it differs from GRADE:

> "unlike GRADE, it explicitly refrains from making definitive recommendations, and it can be used
> even if there are no systematic reviews available."

**Fact bearing on the ten-minute test:** OCEBM is the only scheme in this survey whose own
documentation states a target application time, and it is minutes.

### 1.3 The Oxford CEBM Levels of Evidence (2009) — the version it replaced

Still widely cited, and structurally different. Ten rungs with letter sub-levels — 1a, 1b, 1c, 2a,
2b, 2c, 3a, 3b, 4, 5 — plus Grades of Recommendation A–D
(<https://www.cebm.ox.ac.uk/resources/levels-of-evidence/oxford-centre-for-evidence-based-medicine-levels-of-evidence-march-2009>).
The two rungs that matter here:

- **Level 5** — "Expert opinion without explicit critical appraisal, or based on physiology, bench
  research or 'first principles'".
- **Grade D** — "Level 5 evidence or troublingly inconsistent or inconclusive studies of any level".

The 2011 rewrite **deleted expert opinion as a level** and replaced it with "mechanism-based
reasoning", which is a narrower thing: reasoning from physiology, not deference to a person. That
deletion is the single most decision-relevant difference between the two versions for question 4
below.

### 1.4 SORT — Strength of Recommendation Taxonomy

**What it is.** Developed by the editors of the major US family-medicine journals — *American Family
Physician*, *Family Medicine*, *The Journal of Family Practice*, *Journal of the American Board of
Family Practice*, *BMJ-USA* — with the Family Practice Inquiries Network, published 2004
(<https://www.aafp.org/pubs/afp/issues/2004/0201/p548.html>; *J Am Board Fam Pract* 17:59).

**Two axes, three rungs each.** Strength of recommendation (verbatim):

| Grade | Definition |
| --- | --- |
| **A** | "Recommendation based on consistent and good quality patient-oriented evidence" |
| **B** | "Recommendation based on inconsistent or limited quality patient-oriented evidence" |
| **C** | "Recommendation based on consensus, usual practice, opinion, disease-oriented evidence, and case series for studies of diagnosis, treatment, prevention, or screening" |

Quality of an individual study, for treatment/prevention/screening questions:

| Level | Treatment / prevention / screening |
| --- | --- |
| **1** — good-quality patient-oriented evidence | "SR/meta-analysis of RCTs with consistent findings", "High quality individual RCT", "All-or-none study" |
| **2** — limited-quality patient-oriented evidence | "Lower quality clinical trial", "Cohort study", "Case-control study" |
| **3** — other evidence | "Consensus guidelines, extrapolations from bench research, usual practice, opinion, disease-oriented evidence, or case series" |

And a two-value consistency judgment: **consistent** = "Most studies found similar or at least
coherent conclusions"; **inconsistent** = "Considerable variation among study findings and lack of
coherence". (Definitions above reproduced from
<https://www.wikidoc.org/index.php/Strength_of_Recommendations_Taxonomy(SORT)>, which mirrors the
AFP tables; the AFP page itself renders them as figures.)

AFP's own current summary card is shorter, and notably names expert opinion explicitly
(<https://www.aafp.org/pubs/afp/issues/2018/1201/p660G.html>): **A** "Consistent, good-quality
patient-oriented evidence"; **B** "Inconsistent or limited-quality patient-oriented evidence"; **C**
"Consensus, disease-oriented evidence, usual practice, expert opinion, or case series". **Three rungs,
each one sentence** — the most compact statement of any scheme here, and the closest in shape to
something that fits on a phone.

**SORT's distinctive move is POEM vs DOE.** It grades on whether the outcome matters to the person,
not on design alone:

> **Patient-oriented evidence** — "Outcomes that matter to patients and help them live longer or
> better lives, including reduced morbidity, reduced mortality, symptom improvement, improved quality
> of life, or lower cost"

> **Disease-oriented evidence** — "Intermediate, histopathologic, physiologic, or surrogate results
> (e.g., blood sugar, blood pressure, flow rate, coronary plaque thickness) that may or may not
> reflect improvement in patient outcomes"

(<https://www.aafp.org/pubs/afp/issues/2004/0201/p548.html>.) A study can be a flawless RCT and still
be capped at grade C if its outcome is a surrogate. **This axis maps onto climbing training more
directly than any other single idea in this document**: a trial measuring finger-flexor MVC change is
disease-oriented; a trial measuring redpoint grade is patient-oriented. See §3.4.

**SORT is three rungs and one of them is explicitly the consensus/opinion rung.** Grade C is not "weak
evidence" — it is a named home for "consensus, usual practice, opinion".

### 1.5 SIGN

Scottish Intercollegiate Guidelines Network. The 1999–2012 grading system
(<https://www.sign.ac.uk/assets/sign_grading_system_1999_2012.pdf>) is eight evidence levels crossed
with four recommendation grades plus a fifth non-graded category. Verbatim, the evidence levels:

`1++` "High quality meta-analyses, systematic reviews of RCTs, or RCTs with a very low risk of bias" ·
`1+` low risk of bias · `1-` high risk of bias · `2++` high-quality SRs of case-control/cohort ·
`2+` low risk of confounding · `2-` high risk · `3` "Non-analytic studies, e.g. case reports, case
series" · **`4` "Expert opinion"**.

Recommendation grades A–D, each of which contains **"directly applicable to the target population"**
as a *condition of the grade*, and each of which admits "extrapolated evidence" from one level up as
a substitute at the lower grade. And, separately from A–D:

> **Good practice points** — "Recommended best practice based on the clinical experience of the
> guideline development group"

SIGN has since migrated its newer guidelines to GRADE, but the older system remains the most
frequently-copied nine-rung ladder in the wild.

### 1.6 USPSTF

US Preventive Services Task Force. Five recommendation grades and, separately, three levels of
certainty
(<https://www.uspreventiveservicestaskforce.org/uspstf/about-uspstf/methods-and-processes/grade-definitions>):

| Grade | Definition | Suggestion for practice |
| --- | --- | --- |
| **A** | "High certainty that the net benefit is substantial" | "Offer or provide this service" |
| **B** | "High certainty that the net benefit is moderate or moderate certainty that the net benefit is moderate to substantial" | "Offer or provide this service" |
| **C** | "At least moderate certainty that the net benefit is small" | "Offer or provide this service for selected patients depending on individual circumstances" |
| **D** | "Moderate or high certainty that the service has no net benefit or that the harms outweigh the benefits" | "Discourage the use of this service" |
| **I** | "Current evidence is insufficient to assess the balance of benefits and harms" | "Read the clinical considerations section" |

Two features worth naming. First, **the grade is a function of certainty × net benefit magnitude**,
not of certainty alone — A and B differ by how big the benefit is, not by how sure you are. Second,
**the "Suggestions for practice" column is the scheme's own answer to the presentation question**:
every rung ships with the sentence a reader is meant to act on. See §7.

### 1.7 ACC/AHA — the scheme with an explicit expert-opinion rung

The American College of Cardiology / American Heart Association system separates **Class of
Recommendation** (1, 2a, 2b, 3-No-Benefit, 3-Harm) from **Level of Evidence** (A, B-R, B-NR, C-LD,
C-EO). In 2015 they subdivided the old "Level C" catch-all into two named rungs
(<https://www.ahajournals.org/doi/10.1161/cir.0000000000000312>; primary paywalled, definitions below
from the ACC/AHA classification reproductions):

- **C-LD (Limited Data)** — "Non randomized observational studies with limitations in design or
  execution or Metanalysis of such studies."
- **C-EO (Expert Opinion)** — **"Consensus opinion of experts based on clinical experience."**

(Definitions reproduced from <https://www.wikidoc.org/index.php/ACC_AHA_guidelines_classification_scheme>;
the primary — *Circulation* 2016;133:1426–8, doi:10.1161/CIR.0000000000000312 — is paywalled and
returned HTTP 403.) The full LOE ladder is **A** ("Data derived from multiple randomized clinical
trials or meta-analyses of such studies"), **B-R** (randomised), **B-NR** (non-randomised), **C-LD**,
**C-EO**.

This is the clearest prior art for the two sub-evidence rungs #29 asks for: a major scheme that
carries "we reasoned from mechanism" and "the practitioners agree" as *separate, named, displayed*
levels rather than as an absence.

### 1.8 NHMRC — the scheme that grades population match as its own component

The Australian National Health and Medical Research Council's *additional levels of evidence and
grades for recommendations* (<https://www.mja.com.au/sites/default/files/NHMRC.levels.of.evidence.2008-09.pdf>)
is the odd one out and the most directly useful for question 3. A recommendation's grade is derived
from a **five-component matrix**, each component rated A–D independently:

1. Evidence base · 2. Consistency · 3. Clinical impact · 4. **Generalisability** · 5. Applicability

The **generalisability** row is a four-rung ordinal scale *specifically about population mismatch*,
verbatim:

| | A | B | C | D |
| --- | --- | --- | --- | --- |
| **Generalisability** | "population/s studied in body of evidence are the same as the target population for the guideline" | "population/s studied in the body of evidence are similar to the target population for the guideline" | "population/s studied in body of evidence differ to target population for guideline but it is clinically sensible to apply this evidence to target population" | "population/s studied in body of evidence differ to target population and hard to judge whether it is sensible to generalise to target population" |

with a footnote giving the intended flavour: "For example, results in adults that are clinically
sensible to apply to children". The document is explicit that generalisability and applicability
"consider external factors… in terms of the generalisability for the intended population and setting
of the proposed recommendation".

The overall grades read like plain sentences rather than jargon:

| Grade | Description (verbatim) |
| --- | --- |
| **A** | "Body of evidence can be trusted to guide practice" |
| **B** | "Body of evidence can be trusted to guide practice in most situations" |
| **C** | "Body of evidence provides some support for recommendation(s) but care should be taken in its application" |
| **D** | "Body of evidence is weak and recommendation must be applied with caution" |

Two mechanically interesting rules come with it. A **hard gate**: "A recommendation cannot be graded A
or B unless the evidence base and consistency of the evidence are both rated A or B." And a **wording
rule tied to grade**: "Words such as 'must' or 'should' are used when the evidence underpinning the
recommendation is strong, and words such as 'might' or 'could' are used when the evidence body is
weaker." The hard gate is the kind of thing #29's *Testing* workflow could check in CI without
judgment; the wording rule is prior art for §7.

NHMRC additionally uses **consensus-based recommendations** and **practice points** as non-graded
categories where evidence is insufficient — see §5.

### 1.9 How many schemes are there, in total

The relevant number is not four. AHRQ's 2002 evidence report *Systems to Rate the Strength of
Scientific Evidence* (West S, King V, Carey TS, et al., AHRQ Publication No. 02-E016,
<https://www.ncbi.nlm.nih.gov/books/NBK33881/>) **"considered 121 systems"** — 20 for systematic
reviews, 49 for RCTs, 19 for observational studies, 18 for diagnostic-test studies. The proliferation
is itself the documented problem: a later review of specialty-society grading systems states the
issue as "The plethora of grading systems available, make it difficult for guideline developers to
choose which system to adopt resulting in different guidelines using different systems and confusion
among users" (<https://pmc.ncbi.nlm.nih.gov/articles/PMC4952165/>), and GRADE's own founding aim was
"to reduce unnecessary confusion arising from multiple systems for grading evidence and
recommendations"
(<https://www.gradeworkinggroup.org/docs/Criteria_for_using_GRADE_2016-04-05.pdf>).

**Fact worth stating plainly:** inventing a new scale for Send Lab would make it number 122+. That is
neither an argument for nor against — it is the base rate.

### 1.10 The schemes side by side

| Scheme | Rungs | Second axis? | What is graded | Opinion/consensus rung? |
| --- | --- | --- | --- | --- |
| **GRADE** | **4** (High / Moderate / Low / Very low) | Yes — strength: strong / weak-conditional | A body of evidence, **per outcome** | **No — explicitly excluded** |
| **OCEBM 2011** | **5** (Levels 1–5) × 7 question types | No — refuses to recommend | The best available study design for a question | Level 5 = mechanism-based reasoning, **not opinion** |
| **OCEBM 2009** | **10** (1a–5) | Yes — Grades A–D | Study design | Level 5 = expert opinion; Grade D |
| **SORT** | **3** + **3** (Strength A/B/C; Quality 1/2/3) | Combined | A recommendation, and separately a study | Strength C / Quality 3 |
| **SIGN** | **8** (1++ … 4) + **4** grades + GPP | Yes — Grades A–D | Study, then recommendation | Level 4 = expert opinion; **Good Practice Point outside the ladder** |
| **USPSTF** | **5** grades (A/B/C/D/I) + **3** certainty levels | Combined into the grade | A service recommendation | Grade I = insufficient evidence |
| **ACC/AHA** | **5** LOE (A, B-R, B-NR, C-LD, C-EO) + **5** COR | Yes — COR 1/2a/2b/3 | A recommendation | **C-EO = expert opinion, a named displayed rung** |
| **NHMRC** | **4** grades (A–D) from a **5-component × 4-rung matrix** | Combined | A recommendation | CBR and practice point, **outside the grades** |
| **ACSM (NHLBI)** | **4** (A/B/C/D) | No | A recommendation in a position stand | Category D = panel consensus |
| **Sports nutrition (2023)** | **6** tiers | Two bands (strong / optional) | A source type | Tier 6 = expert opinion |
| **Send Lab today** | **2** (`kind: 'reference'` or not) | No | A document | n/a |

Range of rung counts in routine clinical use: **3 to 10**, clustering at **4–5**.

---

## 2. Licensing, side by side

This is the dimension on which the schemes genuinely differ, and the differences are not subtle.

| Scheme | Maintainer | Licence position |
| --- | --- | --- |
| **OCEBM 2011 Levels** | OCEBM Levels of Evidence Working Group / University of Oxford | **CC BY 4.0.** The CEBM site states "© 2026 University of Oxford. All blog posts and resources are published under a CC BY 4.0 license" (<https://www.cebm.ox.ac.uk/resources/levels-of-evidence/ocebm-levels-of-evidence>). The table itself carries only a "How to cite" block, no restriction. **Reproducible and translatable with attribution, no permission needed.** |
| **GRADE (the method)** | GRADE Working Group | No licence fee, no patent, no permission gate on *using* the approach. But there is a published criteria document for **claiming** you used it, and the working group "discourage[s] the use of 'modified GRADE approaches'" (<https://www.gradeworkinggroup.org/docs/Criteria_for_using_GRADE_2016-04-05.pdf>). See below. |
| **GRADE Handbook (the text)** | Schünemann, Brożek, Guyatt, Oxman | **"Permission to reproduce or translate the GRADE handbook for grading the quality of evidence and the strength of recommendation should be sought from the editors."** (<https://gdt.gradepro.org/app/handbook/handbook.html>.) Free to read online; reproducing or **translating** the text is gated on asking. |
| **GRADEpro GDT (the tool)** | Evidence Prime | Commercial. Free tier "free forever for groups of up to three researchers" (3 members, 25 questions); Team tier **$2,400 per active project per year**; Enterprise by quote (<https://www.gradepro.org/pricing>). Using GRADE does not require the tool. |
| **SORT** | American Academy of Family Physicians | **Most restrictive of the set.** AFP content notice, verbatim (<https://www.aafp.org/pubs/afp/issues/2018/1201/p660G.html>): "Copyright © 2026 by the American Academy of Family Physicians. This content is owned by the AAFP. A person viewing it online may make one printout of the material and may use that printout only for his or her personal, non-commercial reference. This material may not otherwise be downloaded, copied, printed, stored, transmitted or reproduced in any medium, whether now known or later invented, except as authorized in writing by the AAFP." Reproducing the SORT tables verbatim in a shipped app would need written permission. The *ideas* (POEM/DOE, A/B/C) are not ownable; the table text is asserted to be. |
| **SIGN** | Healthcare Improvement Scotland | Published as a free PDF; no CC licence asserted on the grading-system sheet (<https://www.sign.ac.uk/assets/sign_grading_system_1999_2012.pdf>). Crown-copyright-adjacent; status for third-party reuse not stated on the document. **Unverified.** |
| **USPSTF** | US Preventive Services Task Force / AHRQ | US federal government work, 17 U.S.C. §105 — **public domain**. AHRQ permits reproduction and redistribution "provided that it is reproduced without any changes", but adds a restriction: the work "may not be reproduced, reprinted, or redistributed for a fee, nor may the work be sold for profit or incorporated into a profit-making venture" (<https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/copyright-notice>). Send Lab is a private single-athlete app with no commercial surface, so the fee restriction is not currently engaged — but it is a live term. |
| **NHMRC** | Australian NHMRC | Published as a free PDF via MJA; licence not asserted on the document itself. **Unverified.** |
| **ACC/AHA** | ACC / AHA | Journal-published (*Circulation*, *JACC*); paywalled, publisher copyright. |

**The two facts most likely to matter to a bilingual app.** First, **OCEBM is CC BY 4.0 and GRADE's
handbook text explicitly asks permission before translation** — and a pt-BR locale file containing a
rendered Portuguese definition of each rung *is* a translation. Second, **the four GRADE rung
*names* (high/moderate/low/very low certainty) are used freely, unlicensed, across the entire
literature** including by third parties who never asked; what the handbook gates is reproducing or
translating *the handbook*. Those are different objects and the practical exposure is small, but the
sentence in the handbook is real and quoted above.

**On calling it GRADE.** The working group's criteria document (approved by the Guidance Group March
2016) lists what must hold before you say you used GRADE. Abridged, verbatim:

> 1. "The certainty in the evidence… should be defined consistently with the definitions used by the
>    GRADE Working Group."
> 2. "Explicit consideration should be given to each of the GRADE domains for assessing the certainty
>    in the evidence (although different terminology may be used)."
> 3. "The overall certainty in the evidence should be assessed for each important outcome using four
>    or three categories… and definitions for each category that are consistent with the definitions
>    used by the GRADE Working Group."
> 4. "Evidence summaries and evidence to decision criteria should be used as the basis for
>    judgements… Ideally, evidence profiles should be used… and these should be based on systematic
>    reviews."
> 5. "Explicit consideration should be given to each of the GRADE criteria for determining the
>    direction and strength of a recommendation or decision."
> 6. "The strength of recommendations should be assessed using two categories (for or against an
>    option)…"

Criterion 4 is the one that bites a single-author app: it wants evidence profiles based on systematic
reviews. **Fact, not recommendation:** a scale that adds rungs below "very low" for practitioner
consensus and for our own judgment would, by criterion 3, no longer be GRADE, and the working group
asks that such a thing not be called GRADE. Nothing prevents building it; the naming is what is
constrained.

---

## 3. What the schemes are built for, and what survives the move to training

Every scheme in §1 was built to answer one question: *should this patient receive this treatment.*
That shows up in their machinery in four specific ways, and each one behaves differently when moved
onto training prescription.

### 3.1 The blinding problem is not a quality problem — it is structural, and the tools cannot tell

This is the sharpest mismatch, and it is measurable.

**PEDro**, the standard physiotherapy trial-quality scale, scores 10 items
(<https://pedro.org.au/english/resources/pedro-scale/>). Two of them are:

> 5. there was blinding of all subjects
> 6. there was blinding of all therapists who administered the therapy

Neither is achievable in a training trial. You cannot conceal from a climber that they are hangboarding
at 90% rather than 60%. The empirical prevalence in PEDro's own database: **blinding of therapists 1%,
blinding of subjects 6%** — a construct-validity analysis of the database found these items "were
virtually never implemented" (<https://pmc.ncbi.nlm.nih.gov/articles/PMC7079093/>). In practice most
exercise RCTs are capped at 8/10 by design, not by execution.

The same shows up in Cochrane's risk-of-bias framework. A systematic audit of **340 exercise-science
studies** (Preobrazenski N, et al., *iScience* 2024;27(3):109010,
<https://pmc.ncbi.nlm.nih.gov/articles/PMC10884506/>) found, for 2020 papers, high-or-unclear risk of
**performance bias in 86%** and **detection bias in 86%**, and that **"seven studies (~2%) were judged
to have low risks of all sources of bias."** In Cochrane's exercise-therapy review of chronic low back
pain, **79%** were at risk of performance bias for the same reason
(<https://pubmed.ncbi.nlm.nih.gov/34580864/>).

**The field built its own instrument in response.** TESTEX (Smart NA, et al., *Int J Evid Based
Healthc* 2015;13:9–18, doi:10.1097/XEB.0000000000000020, <https://pubmed.ncbi.nlm.nih.gov/25734864/>)
is a 15-point exercise-trial scale that **removes the participant- and therapist-blinding items
entirely**, keeping only assessor blinding, on the stated rationale that "blinding of exercise
training participants is not feasible, as is blinding of the investigators directly supervising the
training. Therefore, these criteria are redundant for exercise training studies." It spends the freed
points on things that actually vary in training research: exercise attendance, whether relative
intensity stayed constant, exercise volume and energy expenditure, and control-group activity
monitoring.

**Consequence for any scheme borrowed intact.** GRADE's risk-of-bias domain, applied honestly to
training literature, rates down almost everything by at least one level for a reason that carries no
information — it is true of the entire field, uniformly, and so it does not discriminate between a
careful trial and a sloppy one. A published review of physical-activity interventions states it
directly: "GRADE and ROB are designed predominantly with medical interventions such as drug trials in
mind. The complex real-world physical activity interventions included in this study, which typically
involve no blinding and larger dropout rates, were penalised by these tools"
(<https://www.tandfonline.com/doi/full/10.1080/1750984X.2024.2309614>). The specialty-grading review
in §1.9 names the same failure mode generically: traditional systems produce "inappropriately low
grades" for valid recommendations in fields whose questions are not drug trials
(<https://pmc.ncbi.nlm.nih.gov/articles/PMC4952165/>).

### 3.2 The climbing base is small enough to count

This is the number that most changes what a scale can usefully discriminate.

The only meta-analysis of climbing-specific training (Stien N, Riiser A, Shaw MP, Andersen V, *Biology
of Sport* 2023;40(1):179–191, <https://pmc.ncbi.nlm.nih.gov/articles/PMC9806751/>) reviewed **11
studies and 225 climbers total**, of which **5 studies / 110 climbers** entered the meta-analysis. The
dead-hang stratum was **2 studies / 53 climbers**; the finger-strength stratum **4 studies / 80
climbers**. Six further studies (115 climbers) were excluded for having no control group. PEDro scores
ranged 5–7 of 10, median 6. Verbatim:

> "none of the studies blinded the allocation of the climbers to the investigators and assessors, or
> the climbers themselves"

> "Four out of five studies included in the meta-analysis did not include an adequate number of
> participants to obtain an α = 0.05 and a β = 0.2 which indicates that the included studies were
> under-powered."

The wider climbing literature is descriptive rather than interventional. A review of physical
performance testing in climbing found **156 studies / 429 tests**, of which **55.4% provided no data on
test quality at all** (Langer K, Simon C, Wiemeyer J, *Front Sports Act Living* 2023;5:1130812,
<https://pmc.ncbi.nlm.nih.gov/articles/PMC10203485/>). A review of performance determinants covered
**74 articles / 2,691 climbers (25% female)** and used **no formal quality-assessment instrument** —
PRISMA only — concluding that "current evidence on performance-determining factors in climbing is
limited due to the lack of standardization of testing protocols and study populations"
(Faggian S, et al., *J Sport Health Sci* 2024;14:100974,
<https://pmc.ncbi.nlm.nih.gov/articles/PMC11904605/>).

**Fact, stated plainly:** the entire controlled-trial base for climbing training is roughly eleven
trials and a couple of hundred subjects, with zero blinding anywhere in it. A four-rung certainty
scale applied honestly to this literature will put nearly everything on the bottom two rungs. Whether
that is a bug or the point is exactly the decision #30 defers.

### 3.3 The wider training literature is small, underpowered, and does not replicate well

- **Median sample size in musculoskeletal RCTs is 44 (IQR 31–62)**, with "just 8% likely to detect
  small (d = 0.2) to moderate (d = 0.5) effects" across 266 trials
  (<https://link.springer.com/article/10.1186/s40798-025-00908-8>).
- **Power calculations were reported in 17%** of the 340 exercise-science studies audited above, rising
  from 2.8% in 1995 to 31.2% in 2020 (<https://pmc.ncbi.nlm.nih.gov/articles/PMC10884506/>).
- **Replication:** across 25 replications of Q1-journal applied sport/exercise findings, **88% of
  replication effect sizes decreased in magnitude** and only **7 of 25 (28%)** met all three robustness
  criteria (*Sports Med* 2025, doi:10.1007/s40279-025-02201-w,
  <https://pmc.ncbi.nlm.nih.gov/articles/PMC12513899/>).

This bears directly on GRADE's **imprecision** domain, which is the one most likely to fire, and — see
§6 — the one raters agree on least.

### 3.4 Per-population effect sizes do not license per-person inference, and the schemes have no rung for that

This is the deepest mismatch, because it is not about grading quality at all.

- **Atkinson G, Batterham AM.** "True and false interindividual differences in the physiological
  response to an intervention." *Exp Physiol* 2015, doi:10.1113/EP085070
  (<https://physoc.onlinelibrary.wiley.com/doi/epdf/10.1113/EP085070>). Within-subject random variation
  is unavoidable even with gold-standard measurement, and is sometimes large enough to explain *all*
  apparent individual-response differences. True individual response is quantified only by comparing
  the SD of change between intervention and comparator arms.
- **Hecksteden A, et al.** "Individual response to exercise training — a statistical perspective."
  *J Appl Physiol* 2015;118(12):1450–9, doi:10.1152/japplphysiol.00714.2014
  (<https://journals.physiology.org/doi/full/10.1152/japplphysiol.00714.2014>); and the 2018 follow-up
  (*J Appl Physiol* 2018;124(6):1567–79) concluding that responder/non-responder classification "is
  dependent on the distribution of training effects within the trial and may not be interpreted as a
  general characteristic of the subject", and that response may be outcome-specific.
- The S&C literature names the error: coaches must "not fall prey to ecological fallacy (whereby
  inferences regarding an individual are derived from data that examined the group to which they
  belonged)" — Turner AN, "What Is Evidence-Based Practice in Strength and Conditioning?", *Strength
  Cond J* 2024, doi:10.1519/SSC.0000000000000840
  (<https://www.nsca.com/contentassets/4ef2b3d73ab34196b0290a0f6af98a91/what_is_evidence_based_practice_in_strength.pdf>).
  Same paper on RCTs: "RCTs determine intervention effects upon groups of participants rather than the
  individual."
- **The ACSM's own position stand grades "There is considerable variability in individual responses to
  a standard dose of exercise" as its highest evidence category (A)** while offering no mechanism to
  act on it — its conclusion is only "The exercise prescription is best adjusted according to
  individual responses" (Garber CE, et al., *Med Sci Sports Exerc* 2011;43(7):1334–1359,
  <https://pubmed.ncbi.nlm.nih.gov/21694556/>).

**No scheme in §1 has a rung, domain or annotation for "this is a group mean and the athlete is one
person."** GRADE's indirectness comes closest, but it is about whether the *studied population*
matches the *target population* — a between-groups question. The within-group variance question is
orthogonal to every axis in every scheme surveyed. If the scale is to carry it, it has to be added.

**SORT's POEM/DOE axis is the one clinical idea that maps cleanly onto climbing.** A trial measuring
finger-flexor MVC change is disease-oriented evidence; a trial measuring redpoint grade is
patient-oriented. SORT would cap the former at grade C regardless of design quality
(<https://www.aafp.org/pubs/afp/issues/2004/0201/p548.html>). Given that climbing's own testing review
found 429 distinct tests across 156 studies with no standardisation
(<https://pmc.ncbi.nlm.nih.gov/articles/PMC10203485/>), the surrogate-outcome problem is live and
large in exactly this domain.

### 3.5 The one asymmetry that runs the other way: consequence

Turner states it plainly for S&C: "the consequences of inefficient or inappropriate exercise
programming are not normally detrimental to general health and well-being nor has significant
financial repercussions (S&C coaches perhaps do not need to be as risk averse as medical
practitioners)"
(<https://www.nsca.com/contentassets/4ef2b3d73ab34196b0290a0f6af98a91/what_is_evidence_based_practice_in_strength.pdf>).

Every clinical scheme's calibration — how much certainty you need before saying "do this" — is set
against irreversible harm. USPSTF's grades are literally a function of *net benefit*
(<https://www.uspreventiveservicestaskforce.org/uspstf/about-uspstf/methods-and-processes/grade-definitions>);
GRADE's certainty is defined relative to a *decision threshold*
(<https://doi.org/10.1016/j.jclinepi.2017.05.006>). A training console's decision threshold is not a
clinical one. **Fact:** the schemes carry a risk calibration that does not transfer, and none of them
expose it as a tunable parameter — it is baked into the rung definitions.

Caveat in the other direction, and it is a real one for this app: `CONTEXT.md` and the deep-assessment
instruments mean Send Lab does touch injury territory (VISA-C, PRTEE, SPADI, Silbernagel). Claims about
tendon rehab are closer to the clinical calibration than claims about hangboard set counts. **A single
scale spans both.**

### 3.6 What sport has built for itself

Three data points, all facts rather than endorsements:

1. **ACSM uses NHLBI's four evidence categories, A–D.** Category **B** is the notable one — it fires
   explicitly when "the trials were undertaken in a population that differs from the target population
   of the recommendation." Category **D** is "Panel consensus judgment". There is **no case-series
   rung, no n-of-1 rung and no mechanism rung** — the bottom of the ACSM ladder is panel consensus, not
   individual data (Table 3, Garber 2011, <https://pubmed.ncbi.nlm.nih.gov/21694556/>; original
   categories from NHLBI, <https://www.nhlbi.nih.gov/files/docs/guidelines/ob_gdlns.pdf>). ACSM's 2026
   resistance-training stand appears to have moved to an AMSTAR + modified-GRADE percentage score
   (doi:10.1249/MSS.0000000000003897) — *unverified, full text unreachable.*
2. **Sports nutrition built a six-tier hierarchy that promotes consensus documents to rung 2.** (1)
   SRs/meta-analyses of RCTs; **(2) position stands and consensus statements**; (3) individual RCTs; (4)
   less well-controlled trials and observational research; (5) case studies/reports; (6) expert
   opinion (*Front Nutr* 2023;10:1118547,
   <https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2023.1118547/full>). It does
   not use GRADE. Its stated reason for demoting SRs is latency — they "can take years to publish,
   which could mean their findings have been surpassed by more recent research."
3. **No NSCA position statement I could reach carries an evidence grade at all**, and **IRCRA — the
   climbing research body, founded 2011 — has published no evidence-grading scheme.** IRCRA's one
   standard (Draper N, et al., *Sports Technology* 2015;8(3–4):88–94,
   doi:10.1080/19346182.2015.1107081) is a *reporting* standard: required climber descriptors, the
   1–32 IRCRA Reporting Scale, and five ability groups (lower grade / intermediate / advanced / elite /
   higher elite). It governs how you describe subjects, not how you weigh a finding. *Both recorded as
   "not found" rather than "confirmed absent" — several full texts were unreachable.*

**And the consensus genre itself has a published methodological critique.** Shrier I, "Consensus
meetings and statements are flawed by design", *SportRxiv* 2020, doi:10.31236/osf.io/86t72
(<https://sportrxiv.org/index.php/server/preprint/download/51/85/68>): "most medical consensus
statements do not define 'consensus' criteria a priori… the methods state that 'items were voted on to
achieve a majority', which is >50%. I would suggest that 50.1% is not a strong enough endorsement to
make prescriptive recommendations because 'expert opinion' among the participants suggests the
recommendation is just as likely to be incorrect as correct." His worked example is the IOC
acute:chronic workload ratio statement, where "the analytical methods used in the original articles
were known to be flawed at the time of publication." **This matters to any rung named "practitioner
consensus": the rung's own field has documented that the label does not guarantee a process.**

---

## 4. Population mismatch — what each scheme calls it

**Yes, every scheme has a mechanism. They are named differently and they sit in different places.**
The app's commonest case — an effect measured on untrained or non-climbing subjects, applied to a
trained climber — is squarely what these are for.

| Scheme | Name | Where it sits | What it does |
| --- | --- | --- | --- |
| **GRADE** | **Indirectness** | One of the five rate-down domains | Lowers certainty by 1 level, or "in extreme cases" by 2 |
| **OCEBM 2011** | **Indirectness** | Footnote to the whole table | "study PICO does not match questions PICO" → grade the level down; no amount specified |
| **SIGN** | **"directly applicable to the target population"** / **"extrapolated evidence"** | A *condition* inside each recommendation grade | Not directly applicable → you drop to the next grade down via the "extrapolated evidence" clause |
| **NHMRC** | **Generalisability** | One of five independently-rated matrix components | Rated A–D on its own, then folded into the overall grade |
| **SORT** | *(none for population)* | — | Handles *outcome* mismatch instead, via POEM vs DOE |
| **ACSM** | *(unnamed)* | Inside the Category B definition | "the trials were undertaken in a population that differs from the target population of the recommendation" → Category B |
| **USPSTF** | Folded into "certainty" | — | Certainty is defined over "representative primary care populations" |

### 4.1 GRADE's indirectness, in detail

GRADE defines indirectness by comparing the study's PICO to the question's PICO. The Cochrane Handbook
states it as two sub-types: **indirect comparisons** (you have A-vs-placebo and B-vs-placebo but want
A-vs-B) and evidence addressing "a restricted version of the main review question in terms of
population, intervention, comparator or outcomes"
(<https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14>). The GRADE
Handbook enumerates the applicability sources as differences in **population**, **interventions** and
**outcomes** (surrogate endpoints) (<https://gdt.gradepro.org/app/handbook/handbook.html>). GRADE
guidelines 8 is the primary reference and is paywalled
(<https://www.jclinepi.com/article/S0895-4356(11)00183-1/fulltext>, HTTP 403 at time of writing).

**How far you move.** Verbatim from the Handbook on population indirectness: "The effect on overall
quality of evidence will vary depending on how different the study populations are, as a result
quality may not decrease, decrease by a one level or decrease by two levels."

**The restraint clause matters as much as the rule.** GRADE's guidance is that "GRADE users should not
rate down for indirectness unless there are compelling reasons to believe that differences between the
question… and the available evidence are likely to result in meaningful and systematic differences in
the observed relative or absolute effects." *Different population* is not by itself grounds; *reason to
believe the effect itself differs* is. The worked example in the Handbook is a two-level downgrade
because "the biology of seasonal influenza was sufficiently different from that of avian influenza".

**Read against training:** the trained-vs-untrained case is one where "meaningful and systematic
differences in the observed… effects" is not speculation — diminishing returns with training status is
a mainstream finding, and the ACSM category-B definition treats population divergence as
grade-determining on its own. So GRADE's restraint clause probably does *not* protect most of our
claims from a downgrade. That is an inference from the two sources, flagged as such, not a quoted
finding.

### 4.2 NHMRC's generalisability row is the only one that isolates population

It is the only formulation of the seven written as a standalone four-rung ordinal scale about
population match alone, in plain prose, with no other domain mixed in — everywhere else, population
mismatch is one input to a composite judgment. Reproduced verbatim in §1.8. Its footnoted example — "results in
adults that are clinically sensible to apply to children" — is structurally the same shape as
"results in untrained undergraduates that are sensible to apply to a trained climber", including the
part where the answer is a judgment call and the scheme says so.

### 4.3 The mismatch none of them expresses

Per §3.4: all seven mechanisms above are about *which population was studied*. None is about *the
athlete is one person and the number is a mean*. #29 already names population mismatch as
misapplication ("an effect measured on untrained undergraduates is not evidence about a trained
climber"), which is the indirectness axis; the group-to-individual axis is a second, separate thing
that no surveyed scheme carries.

---

## 5. The rungs below "evidence"

#29 requires rungs for **practitioner consensus** and **our own reasoned judgment**. The schemes split
sharply on this, and the split is philosophical, not cosmetic.

### 5.1 GRADE: no. Explicitly, and by design

> "Expert opinion is not a category of quality of evidence. Expert opinion represents an interpretation
> of evidence in the context of experts' experiences and knowledge."
> — GRADE Handbook (<https://gdt.gradepro.org/app/handbook/handbook.html>)

The 2008 *BMJ* primer lists it as one of the defects of earlier systems: "Systems that classify 'expert
opinion' as a category of evidence also create confusion"
(<https://pmc.ncbi.nlm.nih.gov/articles/PMC2335261>).

**"Very low" is not the opinion rung.** It means "We have very little confidence in the effect
estimate: The true effect is likely to be substantially different from the estimate of effect" — it
still presupposes *an effect estimate from a body of evidence*. A claim with no studies behind it has
no GRADE rating at all, not a rating of Very low. **This is the single most important structural fact
in this section for a scale that must be able to say "no evidence — our judgment".**

**What GRADE does instead: expert *evidence* vs expert *opinion*.** Schünemann HJ, Zhang Y, Oxman AD,
"Distinguishing opinion from evidence in guidelines", *BMJ* 2019;366:l4606, doi:10.1136/bmj.l4606
(<https://www.ilcor.org/uploads/Tools-GRADE-guidelines-Expert-Opinion-vs-Guidelines.pdf>). The
distinction, verbatim:

> "a clinical expert might say: 'I operated on 100 patients with prostate cancer and none of them died
> from prostate cancer.' That is evidence. It is not the same as saying: 'Prostatectomy is effective.'
> That is an opinion."

> "We define expert evidence as the observations or experience obtained from a person who is
> knowledgeable about or skilful in a particular area. A description of expert evidence should minimise
> interpretation of the extent to which the evidence does or does not support a conclusion. **The
> evidence can be treated, if appropriately summarised, in the same way as case reports or case
> series.**"

> "expert opinion is not the same as evidence."

The paper also records the history: "the Canadian Task Force on the Periodic Health Examination in 1979
included expert opinion as the lowest level of evidence. This categorisation can still be found in
hierarchies of evidence."

**Read for us:** GRADE's answer to "a coach says X works" is *do not grade the coach; extract what the
coach observed and grade that as a case series.* That is a workflow instruction, not a rung. It has a
direct bearing on how a `Claim` sourced from Hörst or Nelson would be modelled.

### 5.2 Everyone else: yes, and here are the exact rungs

| Scheme | Consensus / opinion rung | Verbatim |
| --- | --- | --- |
| **CEBM 2009** | Level 5 | "Expert opinion without explicit critical appraisal, or based on physiology, bench research or 'first principles'" |
| **CEBM 2011** | Level 5 | **"Mechanism-based reasoning"** — expert opinion was *removed* in the rewrite |
| **SIGN** | Level 4 | "Expert opinion" |
| **SIGN** | *Good practice point* (outside A–D) | "Recommended best practice based on the clinical experience of the guideline development group" |
| **SORT** | Strength C | "Recommendation based on consensus, usual practice, opinion, disease-oriented evidence, and case series…" |
| **SORT** | Quality level 3 | "Consensus guidelines, extrapolations from bench research, usual practice, opinion, disease-oriented evidence, or case series" |
| **ACC/AHA** | LOE **C-EO** | "Consensus opinion of experts based on clinical experience." |
| **ACC/AHA** | LOE **C-LD** | "Non randomized observational studies with limitations in design or execution or Metanalysis of such studies." |
| **ACSM** | Category **D** | "Expert judgment is based on the panel's synthesis of evidence… and/or derived from the consensus of panel members based on clinical experience or knowledge that does not meet the above-listed criteria." |
| **NHMRC** | *Consensus-based recommendation* and *practice point*, both **outside** the A–D grades | Non-graded categories used where evidence is insufficient |
| **USPSTF** | Grade **I** | "Current evidence is insufficient to assess the balance of benefits and harms" |
| **Sports nutrition six-tier** | Tier 6 | "Expert opinion" |

**Three observations, as facts.**

1. **The CEBM 2011 rewrite is the clearest statement of the modern position.** It kept a bottom rung
   but changed what it contains: from *a person's opinion* to *mechanism-based reasoning*. That is a
   different claim type — "this should work because of how tendons adapt" is inspectable and arguable;
   "Hörst says so" is not. #29's two required rungs happen to sit on either side of this line:
   *practitioner consensus* is the 2009 formulation, *our own reasoned judgment* is closer to the 2011
   one.
2. **Two schemes put the judgment rung structurally outside the graded ladder rather than at its
   bottom** — SIGN's Good Practice Points and NHMRC's practice points / consensus-based
   recommendations. That is a modelling choice available to us: *not a rung at all, but a different
   kind of thing*, which sidesteps the "is opinion weaker evidence or not evidence" argument entirely.
3. **The rung is documented as abuse-prone.** Venus C, et al., "Transparency in clinical practice
   guidelines: the problem of consensus-based recommendations and practice points", *Intern Med J*
   2021, doi:10.1111/imj.15179 (<https://pubmed.ncbi.nlm.nih.gov/33631865/>; full text 403). The
   companion paper is "Evidence-poor medicine: just how evidence-based are Australian clinical practice
   guidelines?" (*Intern Med J* 2020, doi:10.1111/imj.14466). The documented failure mode is that
   guidelines fail to define these categories and use them inconsistently, so practice points get
   excluded from analyses "because of inconsistency in definition and usage between guidelines".
   *Numbers not verified — both full texts were paywalled.* The transferable fact is the failure mode,
   not the figure: a judgment rung that is not tightly defined becomes the place ungraded assertions
   go to hide, which is precisely the pressure #29 identified in the other direction.

---

## 6. Applying it alone, consistently, in ten minutes

This is the practical test, and there is direct published evidence on it.

### 6.1 GRADE's own inter-rater reliability is poor to moderate

Hartling L, Fernandes RM, Seida J, Vandermeer B, Dryden DM. "From the Trenches: A Cross-Sectional Study
Applying the GRADE Tool in Systematic Reviews of Healthcare Interventions." *PLoS ONE*
2012;7(4):e34697, doi:10.1371/journal.pone.0034697
(<https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0034697>;
<https://pmc.ncbi.nlm.nih.gov/articles/PMC3320617/>). Trained reviewers applied GRADE independently
across three systematic reviews (48, 66 and 75 included studies; 29 comparisons, 12 outcomes):

| Domain | Review 1 (bronchiolitis) | Review 2 (rotator cuff) | Review 3 (hip fracture) |
| --- | --- | --- | --- |
| Risk of bias | κ = 0.41 | 33% agreement | κ = 0.06 |
| Consistency | κ = 0.84 | κ = 0.37 | κ = 0.79 |
| Directness | 41% agreement | 100% agreement | 100% agreement |
| Precision | κ = 0.18 | κ = 0.19 | κ = 0.21 |
| **Overall quality** | **κ = 0.44** | **58% agreement** | **κ = 0.18** |

Authors' conclusions, verbatim: **"As researchers with varied levels of training and experience use
GRADE, there is risk for variability in interpretation and application"**, with "variable agreement
across the GRADE domains, reflecting areas where further guidance is required." Precision "created the
most uncertainty due to difficulties in identifying 'optimal' information size and 'clinical decision
threshold.'"

**Read for a single author:** overall-rating agreement between trained raters ranged κ = 0.18–0.44 —
slight to moderate. A single rater has no inter-rater problem by construction, but the same instability
reappears as *intra*-rater drift across a 200-claim backlog authored over months. Nothing here measures
intra-rater reliability; that is an unfilled gap.

### 6.2 A second study decomposed the domains — and found population indirectness was the *worst* item

Meader N, et al., "A checklist designed to aid consistency and reproducibility of GRADE assessments:
development and pilot validation." *Syst Rev* 2014;3:82, doi:10.1186/2046-4053-3-82
(<https://pmc.ncbi.nlm.nih.gov/articles/PMC4124503/>; **CC BY**, freely reproducible). Two reviewers
applied a 30-item checklist across 29 meta-analyses. Agreement by domain:

| Domain | Items | Agreement |
| --- | --- | --- |
| **Imprecision** | 5 | κ = 0.89–1.0 — almost perfect |
| Inconsistency | 5 | κ = 0.50–1.0 |
| Risk of bias | 9 | κ = 0.20–1.0; attrition 0.44, selective reporting 0.25 |
| Publication bias | 6 | κ = 0.26–1.0; grey-literature search only 0.26 |
| **Indirectness** | 5 | **Below-chance agreement for population applicability and intervention applicability**; surrogate outcomes and direct comparisons κ = 1.0; timeframe 0.47 |

Overall, "For most (70%) checklist items, there was good agreement between reviewers. The main problems
were for items relating to indirectness where considerable judgement is required."

**The two studies point in opposite directions and this is worth naming rather than smoothing over.**
Hartling found *directness* agreed 100% in two of three reviews and *precision* agreed worst
(κ = 0.18–0.21); Meader found *imprecision* agreed almost perfectly (κ = 0.89–1.0) and *population
indirectness* agreed **below chance**. The likely explanation is that they measured different things —
Hartling asked for a single holistic directness verdict, Meader decomposed it into five sub-questions
of which "is the study population applicable" is the one requiring an unaided judgment call. **The
transferable fact is uncomfortable and directly on point: the judgment our commonest case requires —
does an effect measured on untrained subjects apply to a trained climber — is the judgment with the
worst measured reproducibility in the whole instrument.** No amount of scheme choice removes that; it
is a property of the question.

Meader's checklist is also the closest published thing to a one-person aid: "The use of this checklist
may be an aid to improving the consistency and reproducibility of GRADE assessments, particularly for
inexperienced users **or in rapid reviews without the resources to conduct assessments by two
researchers independently**", and "Our checklist may offer improvements in efficiency and time and
therefore may be beneficial when used in the context of a rapid review." It is CC BY and therefore
reproducible and translatable without asking.

### 6.3 The schemes' own statements about effort

- **CEBM on GRADE**, from their explanation page: *"What GRADE has gained in accuracy, it may have lost
  in simplicity and efficiency. The GRADE system takes time to master"*, and *"No hierarchy or levels
  of evidence can be used without careful thought"*
  (<https://www.cebm.ox.ac.uk/resources/levels-of-evidence/explanation-of-the-2011-ocebm-levels-of-evidence>).
- **CEBM on OCEBM**: designed for decisions made "in 'real time' (a few minutes, or at most a few
  hours)" (Introductory Document).
- **GRADE's own criteria for claiming use** (§2) ask for evidence profiles "based on systematic
  reviews", and its criteria 4 and 5 describe a panel process. **Fact:** the workflow GRADE specifies
  is not a one-person ten-minute workflow; it is a review-team workflow. Applying its *rung
  definitions* without its *process* is exactly the "modified GRADE approach" the working group
  discourages.

### 6.4 What is cheap and what is expensive, by domain

Reading the five rate-down domains against a one-person, ten-minute, climbing-literature workflow:

| Domain | Cost to apply alone | Signal in this literature | Measured agreement |
| --- | --- | --- | --- |
| **Indirectness** | Cheap to *look up* (read the sample description), expensive to *judge* | **High** — it is the commonest real case | Contested: 100% (Hartling) vs **below chance** for population applicability (Meader) |
| **Risk of bias** | Moderate | **Near-zero** — 86% of the field is high/unclear performance bias (§3.1), so it does not discriminate | κ = 0.06–0.41 (Hartling); 0.20–1.0 (Meader) |
| **Inconsistency** | Cheap with 2+ studies, **undefined with 1** | Low — most claims here rest on 1–2 studies | κ = 0.37–0.84 / 0.50–1.0 |
| **Imprecision** | Expensive — needs optimal information size and a decision threshold | High (median n = 44, §3.3) but requires numbers most papers don't give | κ = 0.18–0.21 (Hartling) vs 0.89–1.0 (Meader) |
| **Publication bias** | **Not assessable** by one person over a handful of studies | Unknowable at this corpus size | κ = 0.26–1.0 |

**Facts, stated without a conclusion attached:** of GRADE's five rate-down domains, one (publication
bias) is effectively inapplicable at this corpus size; one (risk of bias) carries almost no
discriminating signal in exercise literature because nearly all of it fails the same items for the same
structural reason; one (inconsistency) is undefined for single-study claims and NHMRC's rule for that
case is explicit — "If there is only one study, rank this component as 'not applicable'"; and the two
that carry real signal (indirectness, imprecision) are the two with the most contested measured
reproducibility.

---

## 7. Presentation

There is more prior art here than anywhere else in this document, and one directly relevant randomised
trial on lay readers.

### 7.1 The one experiment on lay comprehension

**Akl EA, et al. "Symbols were superior to numbers for presenting strength of recommendations to health
care consumers: a randomized trial." *J Clin Epidemiol* 2007;60(12):1298–1305,
doi:10.1016/j.jclinepi.2007.03.011** (<https://pubmed.ncbi.nlm.nih.gov/17998085/>;
<https://www.jclinepi.com/article/S0895-4356(07)00109-6/pdf>, PDF 403). Randomised design, 84
participants, **health care consumers — not clinicians** — in a community health education programme.
Compared symbols vs numbers vs letters for representing strength of recommendation and quality of
evidence.

Full abstract, verbatim:

> "For the presentation of the SOR, participants had better objective understanding of symbols than
> numbers (**74% vs. 14%**, P<0.001)… For the presentation of the QOE, objective understanding of
> symbols and letters was similar (**91% vs. 95%**, P=0.509). Participants scored both symbols and
> letters positively; the scores for symbols were however lower for ease of understanding (md=−0.7,
> P=0.019), clearness and conciseness (md=−0.6, P=0.051)…"

> "Symbols were superior to numbers for the presentation of the SOR. Objective understanding was high
> for both symbols and letters for the presentation of the QOE, but **letters conveyed the QOE better
> than symbols**."

**Read carefully, because the two axes came out differently.** For *strength of recommendation* —
the axis §9 argues does not transfer to us — symbols crushed numbers, 74% vs 14%. For **quality of
evidence — our axis** — symbols and letters were statistically indistinguishable (91% vs 95%) and the
authors' own conclusion favours **letters**, with symbols scoring *worse* on ease of understanding and
conciseness. So the headline "symbols beat numbers" is real but is about the wrong axis; on the axis
Send Lab cares about, the finding is **letters ≈ symbols, both ~90%+, letters marginally ahead**. What
is unambiguous across both axes is that **bare numbers are the worst option for a lay reader**.

Supporting, from the icon literature: icons "were better understood when they contained a numeric or
symbolic representation of direction and magnitude (e.g., a circle with '+3' or just '+' inside)" —
i.e. a symbol that *encodes how much*, not a symbol that merely *labels a tier*.

### 7.2 GRADE's own answer is not a badge — it is the verb

The GRADE Working Group's guidance on communicating certainty is **GRADE guidelines 26** (Santesso N,
et al., *J Clin Epidemiol* 2020;119:126–135, <https://pubmed.ncbi.nlm.nih.gov/31711912/>). Its
mechanism is **hedging the main verb of the sentence**, crossed with effect size. Reproduced from the
AHRQ methods chapter that carries the templates
(<https://www.ncbi.nlm.nih.gov/books/NBK563880/>):

| Certainty | Large effect | Moderate effect | Small but important | Trivial / none |
| --- | --- | --- | --- | --- |
| **High** | "X **results in** a large reduction/increase in outcome" | "X **reduces/increases** outcome" | "X reduces/increases outcome **slightly**" | "X results in **little to no difference** in outcome" |
| **Moderate** | "X **likely / probably** results in a large reduction…" | "X **likely / probably** reduces/increases outcome" | "X **probably** reduces/increases outcome slightly" | "X **likely** results in little to no difference…" |
| **Low** | "X **may** result in a large reduction…" / "**The evidence suggests** X results in…" | "X **may** reduce/increase outcome" / "**The evidence suggests** X reduces…" | "X **may** reduce/increase outcome slightly" | "X **may** result in little to no difference…" |
| **Very low** | — (single form for all effect sizes) | **"The evidence is very uncertain about the effect of X on outcome"** — or "X may reduce/increase/have little to no effect on outcome **but the evidence is very uncertain**" | | |

Two things worth naming. First, **the certainty is carried inside the prose, so a reader who never
looks at a badge still receives it.** Second, the paper's own development history records that "we are
uncertain" tested badly — it was read as *we don't know* rather than *the evidence is weak* — and was
revised to put the uncertainty on the evidence: "the evidence is very uncertain". That is a concrete
wording finding, arrived at by testing, that any bottom-rung label inherits.

**NHMRC has the same idea in cruder form:** "Words such as 'must' or 'should' are used when the
evidence underpinning the recommendation is strong, and words such as 'might' or 'could' are used when
the evidence body is weaker" (§1.8). **USPSTF has it as a table column** — every grade ships with its
"Suggestions for practice" sentence (§1.6).

### 7.3 Cochrane forbids its authors from showing the rung names to lay readers

**This is the sharpest presentation finding in the document, and it comes from Cochrane's own house
style guide.** *Template and guidance for writing a Cochrane Plain language summary* (Pitcher N,
Mitchell D, Hughes C, v1 January 2022 — supplement to Handbook Chapter III,
<https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/guidance-writing-cochrane-plain-language-summary.pdf>),
§2.5.2, under **"Do not"**, verbatim:

> "refer to '**very low-/low-/moderate-/high-certainty evidence**'. **Readers have indicated in
> feedback to us that they do not find these terms easy to understand**;
> use GRADE jargon such as 'indirectness' or 'imprecision'."

and §2.6: "Do not use GRADE jargon such as 'downgrading' or 'very low/low/moderate/high certainty
evidence."

The organisation that co-developed GRADE, publishes the certainty ratings in every review, and has more
lay-reader feedback than anyone in the field, instructs its authors **not to put the four rung names in
front of a lay reader at all.** Whatever scale Send Lab picks, this is the strongest available evidence
on whether "Moderate certainty" means anything on a phone: Cochrane's answer, from user feedback, is
no.

**What they use instead** is a plain-language rewrite of the same matrix (§2.5.2, verbatim). Note it is
*not* the GRADE-26 wording — it is simpler, and the very-low cell is different again:

| Effect size | **High** | **Moderate** | **Low** | **Very low** |
| --- | --- | --- | --- | --- |
| Large | "Intervention **causes** a large reduction/increase in outcome" | "Intervention **probably causes** a large reduction/increase…" | "Intervention **may cause** a large reduction/increase…" | "**It is unclear if** intervention has an effect on outcome" **/** "**We do not know if** intervention has an effect on outcome." **/** "Intervention may reduce/increase/have little to no effect on outcome **but we are very uncertain about the results**" |
| Moderate | "Intervention **reduces/increases** outcome" | "Intervention **probably** reduces/increases outcome" | "Intervention **may** reduce/increase outcome" | *(same three)* |
| Small, important | "…reduces/increases outcome **slightly**" | "**probably** reduces/increases outcome slightly" | "**may** reduce/increase outcome slightly" | *(same)* |
| Trivial / none | "Intervention **makes little to no difference** to outcome" | "**probably** makes little to no difference…" | "**may** make little to no difference…" | *(same)* |

And a **separate, confidence-framed ladder** for the limitations section (§2.6) — a third wording set
for the same four rungs:

> **High** — "We are confident that …"
> **Moderate** — "We are moderately confident in the evidence because…" / "Our confidence in the
> evidence is only moderate because of concerns about …"
> **Low** — "We have little confidence in the evidence because …"
> **Very low** — "We are not confident in the evidence because …"

…with plain-language glosses for each GRADE domain, e.g. **imprecision** → "Studies were very small." /
"There are not enough studies to be certain about the results of our outcomes."; **risk of bias** → "It
is possible that people in the studies were aware of which treatment they were getting."

**Cochrane's hard formatting constraints**, verbatim from the same document — all of them mechanically
checkable, which matters for #29's *Testing* workflow:

- **"400 to 850 words, including the title."**
- Reading age: "you could aim for a reading age of around **11 years old**" (matching the UK NHS
  service manual's target).
- "Aim for an average of **20 words in a sentence**."
- "Write numbers as numerals (1, 2, 3…) rather than words."
- Must be "easy to translate into any of the **14 languages** in which Cochrane makes the summaries
  available."
- "**Do not make any recommendations about whether or not a treatment should be used.**"
- "Leave plenty of white space in your summary. Dense text is hard to read."

**And compliance in the wild is dire.** Jelicic Kadic A, et al. "Cochrane plain language summaries are
highly heterogeneous with low adherence to the standards." *BMC Med Res Methodol* 2016;16:61,
doi:10.1186/s12874-016-0162-y (<https://pmc.ncbi.nlm.nih.gov/articles/PMC4877986/>). Across **1,562
reviews**: mean adherence 57%, "not a single PLS completely adhered to the standards", and **only 11
(0.7%) addressed quality of evidence using GRADE** — the single lowest-scoring item. Read for us: even
the organisation with a mandatory template and paid editors fails to get the grade into the
lay-facing summary 99% of the time.

### 7.4 The symbol convention, with its actual codepoints and its stated rationale

GRADE Handbook **Table 6.4, "Suggested representations of quality of evidence and strength of
recommendations"** (<https://gdt.gradepro.org/app/handbook/handbook.html>):

| Certainty | Symbol | Letter |
| --- | --- | --- |
| High | ⨁⨁⨁⨁ | A |
| Moderate | ⨁⨁⨁◯ | B |
| Low | ⨁⨁◯◯ | C |
| Very low | ⨁◯◯◯ | D |

**The codepoints are U+2A01 `⨁` (N-ARY CIRCLED PLUS OPERATOR) and U+25EF `◯` (LARGE CIRCLE)** — *not*
U+2295 `⊕`, which is what most secondary reproductions (including some earlier in this document's
sources) show. That is a real font-stack concern on a mobile PWA: U+2A01 is a mathematical operator
with patchy coverage outside maths fonts. Drawing the ramp as SVG or CSS sidesteps it entirely.
Recommendation strength in the same table is rendered as arrows — "Strong for an intervention ↑↑ 1 /
Weak for an intervention ↑? 2 / Weak against an intervention ↓? 2" (a fourth row, presumably "Strong
against ↓↓ 1", was lost to a page break — **unverified**).

Cochrane's Summary of Findings tables render **symbol *plus* word** — "⊕⊕⊕⊕ High", "⊕⊕⊕◯ Moderate",
"⊕⊕◯◯ Low", "⊕◯◯◯ Very low" — and mandate a footnote for anything below the top rung: "Judgements
other than of 'high' certainty should be made transparent using explanatory footnotes or the 'Comments'
column"
(<https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14>). **Neither the
GRADE Handbook nor Cochrane Handbook prescribes any colour for the certainty cell** — the convention is
shape-and-count, which survives greyscale, colour-vision deficiency and dark mode for free. *(Whether a
live Cochrane Library table adds colour could not be verified; cochranelibrary.com 403s automated
fetching.)*

**GRADE's own stated reasoning for choosing symbols**, verbatim from Handbook §6.3.2 — and note it is
an argument from *history*, not from comprehension:

> "Most guideline panels have used letters and numbers to summarize their recommendations. Because of
> highly variable use of numbers and letters by different organizations this presentation may be
> confusing. Symbolic representations of the quality of evidence and strength of recommendations are
> appealing in that they are not burdened with this historical confusion. On the other hand, clinicians
> seem to be very comfortable with numbers and letters, which are particularly suitable for verbal
> communication… **We suggest guideline developers consider using both words and symbols (which may be
> less confusing than numbers or letters)**"

The older treatment is Schünemann HJ, Best D, Vist G, Oxman AD. "Letters, numbers, symbols and words:
how to communicate grades of evidence and recommendations." *CMAJ* 2003;169(7):677–680
(<https://www.cmaj.ca/content/169/7/677>; full text 403 — **secondary**). It records that letters are
"easily communicated verbally and likely to be understood intuitively in many cultures", but "because
there is more than one alphabet, their use may be limited across cultures" — not a constraint for
en-US/pt-BR, both Latin.

**Summary of the format evidence, since it is scattered:** numbers are worst (14%); letters and symbols
are both ~90%+ for quality of evidence with letters marginally ahead; GRADE recommends *both* words and
symbols; Cochrane ships symbol + word; and Cochrane forbids the words in plain-language summaries.
These are not fully consistent with each other, and that is the state of the evidence.

### 7.5 NICE deliberately refuses badges and puts the strength in the verb

*Developing NICE Guidelines: The Manual* (PMG20), §9.1, verbatim via NICE's NCBI Bookshelf deposit
(<https://www.ncbi.nlm.nih.gov/books/NBK310375/>):

> "**The GRADE system allocates labels or symbols to represent the strength of a recommendation. NICE
> has chosen not to do this, but to reflect the strength in the wording of the recommendation.** NICE
> uses '**offer**' (or similar wording such as 'measure', 'advise', 'commission' or 'refer') to reflect
> a **strong** recommendation, usually where there is clear evidence of benefit. NICE uses
> '**consider**' to reflect a recommendation for which the evidence of benefit is **less certain**."

§9.2 adds a discipline worth noting for a controlled vocabulary: "**To minimise confusion, 'consider'
should only be used to indicate the strength of a recommendation**… '**Consider offering' should be
avoided** because of potential confusion with the wording of strong recommendations." Three levels:
*must / must not* (legal duty or extremely serious consequences), *offer / do not offer*, *consider*.

And every published NICE guideline restates the convention **for the reader**, in the guideline itself
— e.g. NG97 Dementia (<https://www.ncbi.nlm.nih.gov/books/NBK536513/>), verbatim:

> "**The wording used in the recommendations in this guideline denotes the certainty with which the
> recommendation is made (the strength of the recommendation).**"
> "We use '**offer**' … **when we are confident that, for the vast majority of patients, an intervention
> will do more good than harm, and be cost effective.**"
> "We use '**consider**' when we are confident that an intervention will do more good than harm for most
> patients … **but other options may be similarly cost effective.**"

**Fact:** the largest guideline body in the UK looked at GRADE's badges and declined them, on the record,
in favour of two verbs plus a standing legend. That is the strongest counter-example to a badge-first
design, and it costs zero horizontal space on a phone.

### 7.6 Who shows grades to whom — the clinician/patient split

| Product | Shown to clinicians | Shown to lay readers |
| --- | --- | --- |
| **UpToDate** | **1A / 1B / 1C / 2A / 2B / 2C** on nearly every recommendation (<https://www.wolterskluwer.com/en/solutions/uptodate/policies-legal/grading-guide>) | **Nothing.** "The Basics" (5th–6th-grade) and "Beyond the Basics" (10th–12th) carry no grade annotations; hedging is carried entirely by "recommend" vs "suggest". *(Strongly indicated from third-party reprints; live pages are JS-gated — **unverified**.)* |
| **BMJ Best Practice** | **A / B / C** badge placed "**ao lado do texto relevante**" — inline next to the claim — clicking through to a full evidence table (<https://bestpractice.bmj.com/info/evidence-tables/>) | n/a |
| **NICE** | verb-encoded (§7.5) | "Information for the public" versions — **unverified**, 403 |
| **MedlinePlus** | — | **No grading of any kind.** Articles carry a reference list, a review date, named reviewers and a URAC accreditation seal — nothing per-claim (<https://medlineplus.gov/about/using/criteria/>) |
| **theNNT** | colour-only stoplight, four rungs (below) | same |

**UpToDate's ladder is worth reading as a rung-naming exercise**, verbatim: 1A "Strong recommendation,
high quality evidence" — "Clinicians should follow a strong recommendation unless a clear and
compelling rationale for an alternative approach is present"; 1C — "Benefits **appear to** outweigh risk
and burdens"; 2C — "**Very weak recommendation; other alternatives may be equally reasonable.**" Note it
uses **three** evidence tiers (A/B/C), not four: it does not carry GRADE's "very low" into its display
grammar at all.

**BMJ Best Practice is the closest structural analogue to what #29 describes** — a per-claim badge
inline in the prose, clicking through to the evidence. Its rolled-up score maps GRADE onto three
letters (fetched in pt-BR because the site is geo-locked; the English original is **unverified**):
"**A** = A confiança na evidência é alta ou moderada a alta / **B** = … moderada ou baixa a moderada /
**C** = … baixa ou muito baixa", alongside a separate direction-of-effect column. Its own printed
caveat: "**isto não se traduz necessariamente em significância clínica**."

**theNNT** (<https://thennt.com/thennt-rating-system/>) is the one verified consumer-facing
colour-graded system, and it collapses certainty and benefit onto one axis — verbatim: "we provide a
**color-coded summary for you to use (borrowed from the traditional stoplight)**"; **Green** "there is
clear evidence of patient-important benefits"; **Yellow** "**We don't think the data is conclusive or
substantial enough to be able to give a clear rating yet**"; **Red** "benefits and harms may be equal or
equivocal"; **Black** "very clear associated harms… without any recognizable benefit". So *yellow* means
*uncertain* and *red* means *certain but not worth it* — a single scale carrying two different
questions. Their own caveat: "there are downsides to trying to categorize everything into neat little
boxes – some therapies may not fit well into our schema."

### 7.7 Colour: the accessibility constraint is a hard one

- **WCAG 2.2 Success Criterion 1.4.1 Use of Color, Level A** (<https://www.w3.org/TR/WCAG22/#use-of-color>),
  verbatim: "*Color is not used as the only visual means of conveying information, indicating an
  action, prompting a response, or distinguishing a visual element.*" **A colour-only evidence badge
  fails WCAG at Level A** — the lowest bar. Also engaged: **1.4.11 Non-text Contrast (AA)**, 3:1 for
  "graphical objects", which catches a coloured pip or ring that carries meaning.
- **Prevalence**, US National Eye Institute
  (<https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/color-blindness>),
  verbatim: "*About 1 in 12 men have color vision deficiency*"; "**The most common type of color vision
  deficiency makes it hard to tell the difference between red and green.**"
- **Cochrane's own risk-of-bias graphics already solve this, and the solution is instructive.** The
  `robvis` package (McGuinness & Higgins, *Res Synth Methods* 2021, doi:10.1002/jrsm.1411) draws a
  **glyph inside each coloured circle** — low `+`, some concerns `−`, high `x`, critical `!`, no
  information `?` — so the colour is redundant. It ships two palettes: the default `"cochrane"` is a
  red/green pair (`#02C100` / `#BF0000`), i.e. the worst case for deuteranopia; the alternative
  `"colourblind"` is a **single-hue lightness ramp** (`#fed98e` → `#fe9929` → `#d95f0e` → `#993404`,
  ColorBrewer YlOrBr). **Fact: the redundant-glyph pattern and the single-hue ramp are both already
  standard practice inside Cochrane's own toolchain.**
- **Colour is read as a ranking even when it is not one.** Hirschel T, Vandvik P, Agoritsas T. *BMJ Open*
  2025;15(2):e083032, doi:10.1136/bmjopen-2023-083032
  (<https://pmc.ncbi.nlm.nih.gov/articles/PMC11815444/>) — 32 think-aloud sessions with residents on a
  MAGICapp infographic. Participant, verbatim: "*It feels like there is a hidden color code, the PPI and
  H2 are in green are better than the sucralfates in orange.*" And a whole section was skipped because it
  rendered "*small and gray*". Also, on the strength axis: "*The recommendation is weak, this is why I
  wouldn't apply it to my clinical practice*" — a weak rating read as a reason to ignore rather than as
  a reason to weigh.
- **Harvey balls** are the general name for the filled-fraction device (Poppel, Booz Allen, 1970s;
  *Consumer Reports* used them 1979–2016 — <https://en.wikipedia.org/wiki/Harvey_balls>). GRADE's ⨁/◯
  ramp is structurally the same idea rendered as four discrete glyphs rather than one partially-filled
  circle.

### 7.8 Even experts misread the tables

Vitlov N, Bralić N, Poklepović Peričić T, et al. "Comparative Analysis of Expert, Clinician, and Health
Care User Interactions With Summary of Findings Tables: Usability Study." *J Med Internet Res*
2026;28:e86045, doi:10.2196/86045. **n = 120** — 40 GRADE/Cochrane experts, 40 clinicians, 40 health
care users — click-to-reveal protocol across four SoF tables of rising complexity. Verbatim:

> "Simpler SoF tables with a small number of outcomes and single target cells were correctly
> interpreted by most participants, regardless of their expertise. As table complexity and task demand
> increased, all participant groups demonstrated reduced performance… **even experts experienced
> difficulties with tasks requiring synthesis and interpretation across multiple table cells. Questions
> requiring comparison and integration of information across outcomes resulted in the highest rates of
> incorrect responses in all groups.**"

> "SoF tables remain cognitively demanding even for experienced users of evidence synthesis… current
> SoF formats may impose substantial intrinsic and extraneous cognitive load, particularly for
> nonexpert audiences."

On the simplest table all three groups scored a median 2/2 (P=.89); on the most complex, one question
drew 34% wrong answers across all 120 participants. **The transferable finding is about density, not
about grading: one grade next to one claim was read correctly by nearly everyone; comparison across
several graded rows was not.** Earlier user testing of GRADE evidence tables (n=20,
<https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4608675/>) found participants preferred *tabular* over
prose and preferred *less complex* tables, but rejected the most simplified versions as "too
simplistic".

### 7.9 Calibrated hedge-words: the IPCC precedent

The only widely deployed system that pins hedge-words to numbers, and the closest structural analogue
to GRADE's certainty × effect-size matrix outside medicine. IPCC AR5 **likelihood** scale (via
<https://www.greenfacts.org/en/climate-change-ar5-science-basis/l-3/1-likelihood.htm>; ipcc.ch 403s):

| Term | Probability |
| --- | --- |
| Virtually certain | 99–100% |
| Very likely | 90–100% |
| Likely | 66–100% |
| About as likely as not | 33–66% |
| Unlikely | 0–33% |
| Very unlikely | 0–10% |
| Exceptionally unlikely | 0–1% |

Alongside it IPCC runs a **separate qualitative confidence axis with five levels — "very low, low,
medium, high, and very high"** — reflecting "the type, amount, quality, and consistency of evidence"
and "the degree of agreement". **Two orthogonal axes, one numeric and one qualitative, both published
with a standing legend.** Whether readers actually map the terms to the intended ranges was not
established here — the Budescu line of work on that was not reached (§10).

### 7.10 Inline provenance markers, and per-claim confidence in consumer products

**Wikipedia's inline cleanup family** is the most widely-seen per-claim provenance marker in existence.
Rendered forms: `[citation needed]`, `[dubious – discuss]`, `[unreliable source?]`, `[better source
needed]`, `[failed verification]`, `[according to whom?]`, `[who?]`, `[when?]`, `[clarification
needed]`, `[weasel words]`, `[original research?]`, `[medical citation needed]`
(<https://en.wikipedia.org/wiki/Template:Citation_needed>). `|reason=` renders as a hover tooltip. Note
the design: **superscript, bracketed, text-only, no colour, no icon, and it links to an explanation.**
Note also, for §8, that **pt.wikipedia renders it differently** — `{{carece de fontes}}` →
`[carece de fontes?]`, with a question mark the English version lacks.

**Consensus.app's "Consensus Meter"** is the closest consumer analogue to a per-claim confidence
display (<https://help.consensus.app/en/articles/10069920-the-consensus-meter>). Verbatim: "a visual
representation of whether the research leans more toward a '**Yes**', '**No**', '**Possibly**', or
'**Mixed**'"; "**requires at least 5 relevant papers to display results**"; "you'll see the number of
papers that contributed to the results"; "**Each cited paper is color-coded to match its stance. Click
or hover on a colored citation to explore the paper behind that position.**" So: a four-category
segmented bar + a paper count + per-citation colour-matched stance tags + drill-down. **Its categories
are *stance*, not *certainty*** — study quality is a secondary drawer (Recency / Methods / Journals /
Citations). Their own stated limits, verbatim: "The Consensus Meter is **not a perfect reflection of all
the science on a topic**"; "The model will occasionally **incorrectly classify results**… **We show you
exactly which papers are contributing… and how we classified them.**"

**Source-level badges move behaviour barely at all.** Aslett K, Guess AM, Bonneau R, Nagler J, Tucker
JA. "News credibility labels have limited average effects on news diet quality and fail to reduce
misperceptions." *Sci Adv* 2022;8(18):eabl3844, doi:10.1126/sciadv.abl3844
(<https://pmc.ncbi.nlm.nih.gov/articles/PMC9075792/>), verbatim: "On average across the sample, we are
unable to detect changes in real-world consumption of news from low-quality sources after 3 weeks. We
can also rule out small effects on perceived accuracy of popular misinformation…" — with a meaningful
effect only among the heaviest misinformation consumers (~10%). Ground News and NewsGuard are likewise
**source-level, not claim-level** (NewsGuard: green shield ≥60 / red shield <60 per *site*). **Read for
us: the badge literature outside medicine grades the publisher, not the proposition — which is the
axis #29 has already decided against.**

### 7.11 What already exists in the app

The current shadcn-svelte `Badge` (`src/lib/components/ui/badge/badge.svelte`) has six variants —
`default`, `secondary`, `destructive`, `outline`, `ghost`, `link` — of which exactly one
(`destructive`) is semantically coloured. **Fact:** a 4-, 5- or 6-rung colour ramp is not available
from the existing variants and would need new tokens either way, and per §7.7 the ramp would need a
non-colour channel alongside it to clear WCAG 1.4.1. "Just use the badge variants" is not an option
that exists.

### 7.12 The one thing nobody in this literature does

**Almost nobody displays an evidence grade to the person the prescription is for.** GRADE's audience is
guideline panels and systematic reviewers; Cochrane's SoF tables are read by clinicians and Cochrane
*forbids* the rung names in the lay summary; UpToDate grades for clinicians and strips grades from its
patient tiers; MedlinePlus grades nothing; NICE encodes strength in verbs and declines badges outright.
The consumer-facing analogues are outside medicine (Consensus, NewsGuard) or commercial and
unverifiable (Examine — HTTP 429 behind a bot wall on every attempt; see §10).

**The whole prior art for putting an evidence grade in front of a lay reader and measuring whether it
landed is Akl 2007: one randomised trial, 84 participants, nineteen years old.** Everything else in
this section is either professional-facing, or a house style guide, or an argument from first
principles.

---

## 8. Bilingual — which rung names survive translation

The app is en-US / pt-BR, and ADR-0003 ("Identity is never a display string") records the trap in its
sharpest form: English labels that are byte-identical to stable keys make an entire bug class
invisible in the base locale. A grade named `high` in code and rendered "High" in en-US is exactly
that shape. This section reports which schemes' rung names have settled Portuguese and which do not.

### 8.1 GRADE has settled, government-published pt-BR

Brazil's Ministry of Health / CONITEC publishes *Sistema GRADE — manual de graduação da qualidade da
evidência e força de recomendação para tomada de decisão em saúde*
(<https://www.gov.br/conitec/pt-br/midias/artigos_publicacoes/diretrizes/grade.pdf>). Its stated
licence is **"Creative Commons Atribuição-SemDerivações 3.0 Não Adaptada"** — CC BY-**ND** 3.0. Note
the **ND**: attribution is fine, *derivatives are not*. A locale file that paraphrases or shortens
their definitions would be a derivative; quoting them intact with attribution would not.

The terms, verbatim from a peer-reviewed Brazilian review (Lemos A. "GRADE: um sistema para graduar
qualidade de evidência e força da recomendação e as implicações para a prática fisioterapêutica."
*Fisioter Bras* 2017;18(5):657–66,
<https://docs.bvsalud.org/biblioref/2018/07/908601/grade-um-sistema-para-graduar-qualidade-de-evidencia-e-forca-da_fezpaMt.pdf>):

| Concept | en-US | pt-BR |
| --- | --- | --- |
| Certainty rungs | High / Moderate / Low / Very low | **alta / moderada / baixa / muito baixa** |
| Recommendation strength | Strong / Weak | **forte / fraca** |
| Study limitations | risk of bias | **limitação do estudo** |
| Inconsistency | inconsistency | **inconsistência** |
| Imprecision | imprecision | **imprecisão** |
| **Indirectness** | indirectness | **direcionamento** |
| Publication bias | publication bias | **viés de publicação** |

**Three of these translate cleanly and one does not.** The four rung names are ordinary Portuguese
adjectives with no semantic loss — *alta*, *moderada*, *baixa*, *muito baixa* are what a Brazilian
reader would say unprompted. **Indirectness is the problem.** The Portuguese literature renders it
**"direcionamento"** — literally *directing* / *targeting* — which does not carry the "in-" negation
at all, and the paper feels obliged to gloss it: it writes every domain as `direcionamento
(indirectness)` with the English in parentheses, and then spends a paragraph on the semantics:

> "É importante destacar a semântica dos termos utilizados. O uso do prefixo latino 'in, im',
> indicando negação/sentido contrário, mostra que está sendo mensurado o grau de imperfeição dos
> estudos. Confia-se, portanto, no estudo menos inconsistente, menos impreciso, menos indireto…"

**Fact:** the domain we need most (§4) is the one whose name has no stable Portuguese equivalent, and
Brazilian authors writing for Brazilian readers still parenthesise the English. Its *definition*
translates fine — "refere à extensão na qual a população, intervenção e desfecho são similares aos de
interesse" — it is the one-word label that does not.

### 8.2 Which naming styles are locale-proof, as a property

- **Pure ordinals and letters are locale-proof by construction.** OCEBM's "Level 1–5", SORT's "A/B/C",
  SIGN's "1++ … 4", ACC/AHA's "C-EO", NHMRC's "A–D" carry no translatable content in the label itself
  — only in the definition sitting behind it. CEBM even ships official French, Japanese and Polish
  versions of the table (<https://www.cebm.ox.ac.uk/resources/levels-of-evidence/ocebm-levels-of-evidence>),
  which is possible precisely because the numerals do not move.
- **Adjectival rungs translate but must be translated.** GRADE's four are the easy case; they have a
  government-published pt-BR rendering already.
- **Compound coined terms are the hard case.** "Mechanism-based reasoning", "patient-oriented
  evidence", "Good Practice Point", "practice point", "expert evidence" — none of these has a settled
  Portuguese form, and each would be a coinage we invent and then have to keep stable. SORT's POEM/DOE
  acronym is unusable in pt-BR: the mnemonic is an English word.
- **The trade-off is stated, not resolved:** a numeric ladder is translation-proof and opaque ("what is
  Level 3?"); an adjectival ladder is self-describing and needs a translated definition per rung per
  locale. ADR-0003's rule points at keying on stable ids either way, so the choice is about what the
  reader sees, not about what is stored.

### 8.3 Practical consequence for the catalogue

#29 already flags that the rebuild's catalogues are 534 keys each and that 200 claims × (proposition +
summary + rationale) × 2 locales "may not survive its own success". Grade rung names are the *cheap*
part of that — a scale of 4–6 rungs is 4–6 label keys plus 4–6 definition keys per locale, a constant
cost, not a per-claim one. **The per-claim translation cost is in the grade *rationale*, not in the
grade.** Whichever scheme is chosen, the rationale ("downgraded because the subjects were untrained
undergraduates") is free prose in two locales, once per claim.

---

## 9. What explicitly does not transfer

Named here so it can be ignored on purpose rather than by accident. All of it is real, load-bearing
machinery in its own context; none of it survives the move to a private single-athlete console.

**Everything scoped to systematic reviews.**

- **Evidence profiles and Summary of Findings tables.** GRADE criterion 4 asks that certainty
  judgments rest on evidence profiles "based on systematic reviews"
  (<https://www.gradeworkinggroup.org/docs/Criteria_for_using_GRADE_2016-04-05.pdf>). We are grading a
  claim against the two or three papers that exist, not synthesising a literature.
- **Publication bias as a domain.** Funnel-plot asymmetry needs many studies. With a dead-hang stratum
  of two studies (§3.2) it is not assessable, not merely hard.
- **Optimal information size**, meta-analytic heterogeneity (I², CI overlap), and pooled effect
  estimates. Hartling's raters identified OIS as the single hardest thing to apply
  (<https://pmc.ncbi.nlm.nih.gov/articles/PMC3320617/>).
- **Two-reviewer independent duplicate assessment.** Structurally unavailable with one author. Meader's
  checklist is explicitly aimed at this gap
  (<https://pmc.ncbi.nlm.nih.gov/articles/PMC4124503/>).

**Everything scoped to guideline panels.**

- GRADE's **Evidence-to-Decision frameworks**, the resource-use / cost domain (GRADE guidelines 10),
  values-and-preferences elicitation, panel composition, conflict-of-interest declarations, voting
  thresholds, and the RAND/UCLA appropriateness method and Delphi rounds. There is no panel. Shrier's
  critique of the consensus genre (§3.6) is about *other people's* panels and is relevant only as
  evidence that "practitioner consensus" is a weaker label than it sounds.
- **NHMRC's "Applicability" component** — it asks whether evidence suits "the Australian health care
  setting", with organisational factors like "availability of trained staff, clinic time, specialised
  equipment". Noise here. Its sibling **Generalisability** is the useful half (§4.2).

**The second axis — strength of recommendation — does not mean what it means clinically.**

GRADE's strong/weak split, USPSTF's A–D "Suggestions for practice", SORT's A/B/C, SIGN's A–D and
NHMRC's A–D are all statements about *what a clinician should do for a population of patients whose
values vary*. GRADE is explicit that a **conditional** recommendation is one where "different choices
will be appropriate for different patients and those decisions must be consistent with each patient's
values and preferences" (<https://book.gradepro.org/guideline/grade-recommendations>). Send Lab has one
athlete, whose values are known, who is also the author of the app. **Fact:** the certainty axis transfers; the recommendation-strength axis has no population to
be uncertain about. Note this cuts against copying any scheme whole — SORT, SIGN, NHMRC and USPSTF all
grade *recommendations*, not evidence, so adopting their letters imports the axis that does not apply.
GRADE and OCEBM are the two that grade evidence separately from recommendation.

**Regulatory and publication machinery.** Nothing in this document about submission, reporting
standards (PRISMA, CONSORT, SCRIBE), retraction policy or journal requirements applies. Send Lab is not
published and not regulated. The one adjacent thing that *is* live is #29's re-review cadence, which is
its own answer to retraction and replication failure and needs no external scheme.

**The clinical risk calibration.** Per §3.5 — every rung definition in every clinical scheme is
calibrated against irreversible harm. It is baked into the definitions and none of the schemes exposes
it as a parameter.

**OCEBM's non-treatment rows.** Of its seven question types, prevalence, diagnostic accuracy and
screening have no analogue in a training console. Prognosis ("what will happen if we do not add a
therapy?") arguably does, for injury-risk claims. Treatment benefits and common harms are the two rows
that carry the load.

**And one thing that does transfer more than it looks like it should:** the *unit*. Every scheme grades
a proposition-shaped thing — a PICO question, a recommendation, an outcome — never a document. #29's
`Claim` decision already matches; it is not a departure from the field.

---

## 10. What this research does not settle

- **The intra-rater question.** Every reliability figure in §6 is *inter*-rater. Nobody has measured
  whether one person applying GRADE (or anything else) to 200 claims over six months produces
  consistent grades at claim 200 as at claim 1. That is the actual risk for this app and there is no
  published number for it.
- **Whether a scheme's rungs can be adopted without its process.** GRADE's criteria document says no
  (§2); OCEBM's introductory document says the table is deliberately a shortcut and expects judgment to
  live outside it. Whether that distinction has any consequences for a private app is a judgment call,
  not a fact — the only hard consequence found is the naming constraint.
- **The Venus figures.** The proportion of guideline recommendations that are consensus-based or
  practice points rather than evidence-based is documented as a problem but the numbers were behind a
  paywall (§5.2, item 3).
- **ACSM's 2026 instrument.** The resistance-training position stand appears to have moved from NHLBI
  A–D to AMSTAR plus a percentage-scored modified GRADE. Unverified — full text unreachable. If it
  holds, the largest sports-medicine body in the field has just adopted a *modified* GRADE, which is
  its own data point.
- **How many claims the coverage audit will return.** Every judgment about "ten minutes per claim"
  scales differently at 20 claims than at 200, and #29 lists the audit's count as not-yet-known. The
  reliability and effort facts in §6 are per-claim; the total is unknown.
- **PEDro's and TESTEX's reuse licences.** Both are published openly; neither states reuse terms on the
  document. Unverified.
- **Whether the sub-evidence rungs should be rungs or a separate kind.** §5.2 observation 2 records
  that two schemes place them outside the ladder rather than at its bottom. Which is better for a
  reader on a phone is a design question this document does not answer.
- **Examine.com's current scheme.** The closest consumer-facing commercial analogue. Its grades page
  returned HTTP 429 on every attempt, so the current rung set, its calculation and its display are
  unverified. What is confirmed from indexes: letter grades applied **per intervention–outcome pair**,
  varying by study population — the per-outcome unit, in a consumer product.
- **CMAJ 2003 full text.** The letters/numbers/symbols/words paper is the field's explicit treatment of
  the presentation question and is behind a 403. §7.4 is assembled from its abstract and indexes.
- **Whether a pt-BR readability metric exists.** §7.5 notes Cochrane's 6th–8th-grade target as a
  mechanically checkable property. Whether an equivalent measure exists for Brazilian Portuguese, and
  whether it is comparable, was not investigated.
- **Nothing in this document is a recommendation.** Where a fact points hard in one direction —
  OCEBM is CC BY and GRADE's handbook is not; bare numbers tested worst with lay readers; the
  climbing literature is eleven trials — that is the fact reported, not a conclusion drawn. The scale
  is chosen on the decision ticket.
