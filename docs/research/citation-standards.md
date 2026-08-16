# Standards for citation and claim data — research findings

Resolves ticket [#31](https://github.com/YgorPerez/send-lab/issues/31) of
[Map: Every claim traceable and graded](https://github.com/YgorPerez/send-lab/issues/29). Research
only. **This document reports facts and does not recommend.** The `Claim` and `Study` shapes belong
to the data-model ticket; nothing here is a proposal.

**Researched 2026-08-16.** Every API response quoted below was fetched live on that date from this
machine, and the request that produced it is shown. Rate-limit numbers are read from response
headers, not from documentation. Where a documented figure and an observed figure disagree, both are
given.

**The frame that decides what counts as usable.** Claims and studies here are static content compiled
into a TypeScript bundle for a private, single-athlete app, in a public repo, with no server and no
database. So the test applied throughout is not "is this a good standard" but "can this run at build
time or in a browser, for free, on a corpus that will never exceed a few hundred claims and about a
hundred studies". A great deal of what follows fails that test, and where it does the document says
so rather than describing it neutrally.

---

## Summary of what was found

| Question | Short answer |
| --- | --- |
| 1. CSL-JSON | A real, schema-validated, 45-type / 103-variable format with a JSON Schema on npm and a `custom` extension point. Has `DOI`, `PMID`, `PMCID` as first-class variables. Has **no licence variable at all**. Client-side formatting works but drags in citeproc plus XML style and locale files, and the pt-BR locale translates only connective furniture, never the paper's title. |
| 2. DOI → metadata | **Viable, free, no key.** Crossref: 5 req/s anonymous, 10 req/s with an email in the User-Agent. NCBI E-utilities: 3 req/s anonymous, 10 with a free key, HTTP 429 when exceeded (observed). Authors, year, title, journal, volume, pages all come back. One judgment call survives automation: `issued` is the online-first date, not the citation year. |
| 3. DOI → licence | **Partially viable and dangerous where it isn't.** Only 57.3% of Crossref journal articles carry any licence field. Two authoritative sources gave *contradictory* licences for a paper in this corpus. Of the 16 studies, exactly **one** is unambiguously CC-BY. |
| 4. Claim prior art | Several borrowable *shapes*, no adoptable *standard*. Every evidence-grading vocabulary is prose, not data. The one thing with a proper machine-readable grade enum has three members and no slot for "no evidence". |
| 5. Link rot | See §5. Measured on this corpus: 0 of 16 URLs are dead, but a naively configured link checker would report **11 failures**. |

**The single most decision-relevant finding is not in the ticket's five questions.** Running the
existing 16 studies against the APIs described in §2 found **four wrong records**, including one
citation that points at a completely unrelated paper. That is reported in §0 because it changes what
questions 2 and 3 are worth.

---

## 0. What exists today, and what a machine can already tell about it

Read from `src/lib/studies.ts` and `src/lib/content/types.ts`.

The shape is four fields plus an optional one-bit grade:

```ts
export interface Study {
	id: string;
	authors: string;
	year: string;
	/** A real, stable destination (paper, PubMed search, or the author's site). */
	url: string;
	/** Omitted for peer-reviewed studies; 'reference' marks a book or coaching
	 *  resource — cited for practical guidance, not as primary evidence. */
	kind?: 'reference';
}
```

Three properties of this shape matter for everything below.

**`authors` is a compound free-text field.** It carries the author list *and* the journal, joined by
an em dash: `'Shaw, Lee-Barthel, Ross, Wang & Baar — Am J Clin Nutr'`. Two logical fields in one
string, in a fixed but unenforced convention. Nothing can validate it and nothing can reformat it.

**`year` is a string, and sometimes not a year.** The two coaching references carry `year: '—'`.

**`url` is the only identifier.** There is no DOI, no PMID, no PMCID field. The identity of a study
is a URL, and ten of the sixteen URLs are `pubmed.ncbi.nlm.nih.gov/<pmid>/` — so a PMID *is* present
in the corpus today, but as a substring of a URL rather than as data.

Citation is wired in exactly one place, `content/types.ts:177`:

```ts
	/** Study id (into STUDIES) backing this question. */
	study?: string;
```

An optional plain `string`, unbranded, on `QuizQuestion` only.

### 0.1 An audit of the 16 studies against Crossref and PubMed

Because §2 asks whether metadata can be fetched rather than typed, the obvious way to test it is to
fetch the metadata that is already typed and compare. Every PubMed URL in `studies.ts` was resolved
through E-utilities `esummary` and every resolvable DOI through the Crossref REST API. **Four of the
sixteen entries are wrong**, and they fail in four different ways.

**1. `probe` cites an unrelated paper — a microbiology genome study.** This is the serious one.

```
studies.ts: { id: 'probe', authors: 'Claudino et al. — J Sci Med Sport', year: '2017',
              url: 'https://pubmed.ncbi.nlm.nih.gov/27765661/' }
```

PMID 27765661 resolves to:

```
27765661 | J Biotechnol | 2017 Jan 10 | Fang H | doi= 10.1016/j.jbiotec.2016.10.015
    The complete genome of Dietzia timorensis ID05-A0528(T) revealed the genetic basis for its
```

The intended paper — Claudino et al., *The countermovement jump to monitor neuromuscular status: A
meta-analysis*, J Sci Med Sport 2017 — is **PMID 27663764**, DOI `10.1016/j.jsams.2016.08.011`. The
recorded PMID is off by roughly a hundred thousand, which is the signature of a transcription slip,
not of a fabricated citation. The prose and the author attribution are right; the link is wrong. It
has been wrong for as long as the file has existed and nothing in the repo could have noticed,
because the URL returns HTTP 203 and renders a perfectly valid page.

This is precisely the failure mode map #29 names — *"A plausible citation is worse than none — it
launders a guess into a fact"* — arriving not through fabrication but through a typo. It is also the
cheapest possible thing to catch mechanically, and §2 is entirely about the machinery that catches
it.

**2. `ewma` points at a different paper than its author list names.**

```
studies.ts: { id: 'ewma', authors: 'Williams, West, Kemp, Stokes et al. — Br J Sports Med',
              year: '2017', url: 'https://pubmed.ncbi.nlm.nih.gov/27789430/' }
```

PMID 27789430 is **Carey DL** et al., *Training loads and injury risk in Australian football —
differing acute:chronic workload ratios influence match injury risk*, Br J Sports Med 2017,
PMC5537557. Williams, West, Kemp & Stokes is a real and different 2017 BJSM paper (the EWMA
methodology letter). Journal and year are right; the authors and the link disagree with each other.

**3. `lattice` has the wrong journal.** Recorded as `Giles et al. (Lattice) — Eur J Appl Physiol`.
PMID 33647876 is *Int J Sports Physiol Perform*, 2021, DOI `10.1123/ijspp.2020-0637`, "An All-Out
Test to Determine Finger Flexor Critical Force in Rock Climbers." The Lattice group has published in
EJAP; this particular paper did not.

**4. `lopez` has the wrong journal.** Recorded as `López-Rivera & González-Badillo — J Sports Sci`.
PMID 30988852 is *J Hum Kinet* 66:183–195, DOI `10.2478/hukin-2018-0057`.

Two further entries are not errors but are worth naming, because they are the cases where an
automated fetch would *introduce* a discrepancy rather than remove one:

- **`sleep`** is recorded as 2015. Crossref reports `issued: [[2014, 10, 15]]` — but also
  `published-print: [[2015, 2]]` and `published-online: [[2014, 10, 15]]`. The recorded year is the
  correct citation year; Crossref's headline date field is the online-first date. See §2.4.
- **`acwr`** is recorded as 2016. Crossref: `issued: [[2015, 10, 28]]`, `published-print:
  [[2016, 2]]`. Same pattern.

**Score: 12 of 16 correct, 2 wrong journals, 1 wrong author attribution, 1 citation pointing at an
unrelated paper.** All four are detectable by an unattended script against free APIs. None are
detectable by a human reading `studies.ts`.

---

## 1. CSL-JSON

### 1.1 What it is, and where the authority actually lives

The CSL 1.0.2 specification (<https://docs.citationstyles.org/en/stable/specification.html>) defines
the **XML style language** and the item types and variables it operates on. It never mentions
CSL-JSON. The input data format is defined separately, by a JSON Schema:

- <https://github.com/citation-style-language/schema/blob/master/schemas/input/csl-data.json>
- canonical `$id`: `https://resource.citationstyles.org/schema/v1.0/input/json/csl-data.json`

Measured properties of that file (12,222 bytes, draft-07):

```
top-level type:              array   — a CSL-JSON file is an ARRAY of items
items.required:              ["type", "id"]
items.additionalProperties:  false
items.properties:            103 keys
type enum:                   45 values
definitions:                 name-variable, date-variable
```

Two structural facts follow. The top level is an **array** — `csl-data.json` validates a list, not a
single item. And `additionalProperties: false` applies at the item level *and* inside
`name-variable` / `date-variable`, which makes the schema strict enough to reject real Crossref
output in ten places (§1.5).

The schema repo carries its own caveat: *"the CSL-JSON schema is not yet fully normative, and care
must be taken to ensure compatibility with other tools built around CSL-JSON."*

The spec and the schema also disagree slightly. `part-number` / `printing-number` /
`supplement-number` in the spec are `part` / `printing` / `supplement` in the schema;
`journalAbbreviation` and `shortTitle` are camelCase legacy aliases carried for Zotero. Notably,
**the spec lists a `license` variable that the schema does not have** — see §1.7.

### 1.2 The field list for a journal article

Verbatim, schema-valid, and validated against `csl-data.json` with **0 errors**:

```json
[
  {
    "id": "shaw-2017-gelatin",
    "type": "article-journal",
    "title": "Vitamin C-enriched gelatin supplementation before intermittent activity augments collagen synthesis",
    "container-title": "The American Journal of Clinical Nutrition",
    "author": [
      { "family": "Shaw",        "given": "Gregory" },
      { "family": "Lee-Barthel", "given": "Ann" },
      { "family": "Ross",        "given": "Megan L. R." },
      { "family": "Wang",        "given": "Bing" },
      { "family": "Baar",        "given": "Keith" }
    ],
    "issued": { "date-parts": [[2017, 1]] },
    "volume": "105",
    "issue": "1",
    "page": "136-143",
    "DOI": "10.3945/ajcn.116.138594",
    "URL": "https://doi.org/10.3945/ajcn.116.138594",
    "ISSN": "0002-9165",
    "language": "en",
    "custom": { "evidence-grade": "B", "send-lab-area": "fingers" }
  }
]
```

**Casing is not uniform.** `DOI`, `URL`, `ISSN`, `ISBN`, `PMID`, `PMCID` are uppercase; everything
else is lowercase-hyphenated. A lowercase `url` fails validation.

**`DOI`, `PMID` and `PMCID` are all first-class CSL variables.** That is directly relevant to §2 and
§5: the identifiers this project would want to store anyway already have designated homes, so
storing them is not an extension.

**Names.** The `name-variable` definition permits `family`, `given`, `dropping-particle`,
`non-dropping-particle`, `suffix`, `comma-suffix`, `static-ordering`, `literal`, `parse-names`, and
nothing else. `literal` is the corporate-author escape hatch —
`{"literal": "American College of Sports Medicine"}` — and renders correctly.

**Dates.** The `date-parts` form is a nested array: outer 1–2 entries (one date, or a range), inner
1–3 numbers (`[year]`, `[year, month]`, `[year, month, day]`, month 1-based). **The truncation is
the precision signal** — `[[2017, 1]]` means "January 2017", `[[2020]]` means "2020"; there is no
separate precision field. `literal` and `raw` exist for unparseable dates.

One documented-but-untrue detail worth knowing: the schema's own description says an EDTF string is
"preferred", but the `anyOf` array in current master has exactly **one** branch — the object form.
`"issued": "2017-01"` would fail validation today. The description is aspirational relative to the
schema body.

### 1.3 The other item types

45 types in total:

```
article, article-journal, article-magazine, article-newspaper, bill, book,
broadcast, chapter, classic, collection, dataset, document, entry,
entry-dictionary, entry-encyclopedia, event, figure, graphic, hearing,
interview, legal_case, legislation, manuscript, map, motion_picture,
musical_score, pamphlet, paper-conference, patent, performance, periodical,
personal_communication, post, post-weblog, regulation, report, review,
review-book, software, song, speech, standard, thesis, treaty, webpage
```

A `book` drops `container-title`, `volume`, `issue` and `page`, and gains `publisher`,
`publisher-place`, `edition`, `ISBN`, `number-of-pages`. A `webpage` uses `container-title` for the
site name and `accessed` for the retrieval date. A `report` uses `genre` for the report kind and
`number` for its number. All three are shapes the corpus has (two coaching websites, and the Springer
book chapter would be `chapter`).

### 1.4 Build-time validation

The schema is machine-readable JSON Schema draft-07, **MIT licensed** (confirmed via the GitHub API,
`license.spdx_id == "MIT"`), and validates fine with `ajv`. But **it is not published on npm** —
`csl-schema`, `@citation-style-language/schema`, `csl-data` and `csl-data-json` all 404 on the
registry. Adopting it means vendoring a 12 KB file.

There is an npm package of TypeScript types, `csl-json@0.1.0` (MIT, 5,753 bytes unpacked, zero
deps, <https://www.npmjs.com/package/csl-json>), but it is stale: its `ItemType` union has 34
members against the schema's 45, missing `classic`, `collection`, `document`, `event`, `hearing`,
`periodical`, `regulation`, `software`, `standard` and `performance`.

### 1.5 Support, and the Crossref gotcha

| Tool | Import | Export |
| --- | --- | --- |
| Zotero | yes | yes — <https://www.zotero.org/support/dev/data_formats> lists CSL JSON both directions |
| Better BibTeX | — | yes ("Better CSL JSON" translator) |
| Pandoc | yes (`--bibliography`) | yes (`-t csljson`) |
| Quarto | yes (delegates to Pandoc) | — |
| Crossref | — | yes, by content negotiation |
| Obsidian Citations / Simple Citations | yes | — |
| Citation.js | yes | yes |
| Mendeley | **unverified** | **unverified — probably not** |

Crossref content negotiation works and is confirmed live. The media type is
`application/vnd.citationstyles.csl+json`, and both routes are equivalent:

```bash
curl -LH "Accept: application/vnd.citationstyles.csl+json" "https://doi.org/10.7717/peerj.15464"
curl -LH "Accept: application/vnd.citationstyles.csl+json" \
     "https://api.crossref.org/v1/works/10.7717/peerj.15464/transform"
```

**But what comes back is not schema-valid CSL-JSON.** Validated against `csl-data.json`, the live
response for `10.7717/peerj.15464` fails in several places. Of the 38 keys returned, **23 are not
CSL variables at all**:

```
alternative-id, article-number, content-domain, created, deposited, funder, indexed,
is-referenced-by-count, license, link, member, prefix, published, published-online,
reference, reference-count, references-count, relation, resource, score, short-title,
subject, subtitle
```

Three failures matter more than the rest:

1. **`"type": "journal-article"` is not a valid CSL type.** CSL's type is **`article-journal`** — the
   hyphenated halves are swapped. Verified against the enum: `'article-journal' in enum → True`,
   `'journal-article' in enum → False`. A copy-paste produces an item citeproc will not recognise.
2. **`ISSN` comes back as an array**; the schema says string. So does `title` and `container-title`
   on the `/works` route (the `/transform` route flattens those two but not `ISSN`).
3. **`author[]` entries carry `sequence`, `affiliation` and `role`**, which blow up
   `name-variable`'s `additionalProperties: false`.

So Crossref is an excellent *source* for CSL-JSON but not a *supplier* of it. A normalising pass of
roughly twenty lines stands between the two. That pass runs once, at authoring time, in a script —
it does not need to ship.

### 1.6 Formatting a citation client-side — what it actually costs

This is where the "automatic formatting of a citation in either locale" hope meets its bill.

**`citeproc@2.4.63`** (<https://www.npmjs.com/package/citeproc>) is the reference implementation and
everything else wraps it. Measured, not quoted:

| Artifact | Bytes |
| --- | --- |
| `citeproc_commonjs.js` unminified | 967,493 |
| unminified + gzip | 194,031 |
| minified (esbuild) | 381,233 |
| **minified + gzip** | **97,177** |

Zero runtime dependencies, and it runs under plain Node with no DOM shim, so it bundles for a
browser without polyfills.

**Licence: `CPAL-1.0 OR AGPL-1.0`.** Both branches are copyleft; CPAL adds an attribution-badge
clause. For a private app that is never distributed this is largely inert, but it is not MIT.

**It needs the style XML and the locale XML at runtime.** The constructor is
`new CSL.Engine(sys, style, lang, forceLang)`, where `style` is the serialised CSL XML, and `sys`
must supply a **synchronous** `retrieveLocale()`. Synchronous means you cannot `await` a fetch inside
it — the locale string must already be in memory before the engine is constructed. There is no
built-in default style.

Measured file sizes from the styles and locales repos:

| File | raw | gzip |
| --- | --- | --- |
| `apa.csl` | 85,658 | 13,377 |
| `vancouver.csl` | 18,126 | 3,395 |
| `nature.csl` | 6,445 | 1,616 |
| `locales-en-US.xml` | 32,649 | 5,658 |
| `locales-pt-BR.xml` | 27,363 | 5,006 |

**Realistic bilingual browser payload, gzipped:**

```
citeproc.min.js       97,177
apa.csl               13,377
locales-en-US.xml      5,658
locales-pt-BR.xml      5,006
------------------------------
TOTAL                121,218 B gz   (~118 KB)

with vancouver.csl instead:  ~109 KB
with nature.csl instead:     ~107 KB
```

For scale against map #29's own framing: the athlete's entire account state is ~28 KB. This is a
citation formatter roughly four times the size of everything the app knows about the athlete, and it
is precached into the service worker along with everything else.

**The styles and locales are CC BY-SA 3.0, not MIT.** From the styles repo README: *"All styles in
this repository are released under the Creative Commons Attribution-ShareAlike 3.0 Unported license.
For attribution, any software using CSL styles from this repository must include a clear mention of
the CSL project and a link to https://citationstyles.org/. When redistributing styles, the listings
of authors and contributors in the style metadata must be kept as is."* Bundling `apa.csl` and
`locales-pt-BR.xml` therefore carries an attribution obligation and a share-alike condition on those
files. (Neither repo has a root `LICENSE` file; the terms live in the READMEs.)

**The wrappers do not make this smaller.**

- `citeproc-plus@2.0.4` (LGPL-3.0) is **20.5 MB unpacked across 395 files**. It ships pre-parsed,
  gzipped style objects and expects your bundler to emit them as static assets it lazily fetches —
  which for a server-free app means they become part of the static deployment anyway. It
  self-describes as *"an early version so be aware that the API may change."*
- `@citation-js/plugin-csl@0.8.2` (MIT, 457 KB) bundles exactly three styles (`apa`, `harvard1`,
  `vancouver`) and five locales — **`de-DE`, `en-US`, `es-ES`, `fr-FR`, `nl-NL`. `pt-BR` is not
  among them**, and neither is `pt-PT`. For a bilingual en/pt-BR app this package gives English only
  out of the box. Its MIT licence is also not transitive: it hard-depends on `citeproc`, so the
  CPAL/AGPL terms travel with it.
- `@citeproc-rs/wasm@0.2.0` (MPL-2.0) is **25 MB unpacked, with a 4,991,933-byte `.wasm` binary** —
  roughly 50× citeproc-js gzipped. Zotero's README calls it *"a work-in-progress implementation"*.
  It is not a lighter option.

**There is no maintained lightweight CSL engine for JavaScript.** The whole ecosystem reduces to
citeproc-js, its TypeScript port, the Rust/WASM port, and wrappers around those.

### 1.7 The bilingual question, answered concretely

This is the part most likely to be assumed rather than checked, and the answer is the opposite of
the hopeful one.

`locales-pt-BR.xml` exists (27,363 bytes, 343 `<term>` elements, 198 unique terms) and follows ABNT
NBR 6023:2025. It translates: `edition` → `edição` (`ed.`), `accessed` → `acesso em`, `retrieved` →
`recuperado`, `available at` → `disponível em`, `page` → `página` (`p.`), `volume` → `volume` (`v.`),
`issue` → `número` (`n.`), `no date` → `sem data` (`s.d.`), `and` → `e`, `in` → `em`, `editor` →
`organizador` (`org.`), `translator` → `tradutor` (`trad.`), `chapter` → `capítulo` (`cap.`),
`anonymous` → `anônimo`, month names (`janeiro`…`dezembro`), and ordinals (`º`/`ª`, `primeira`,
`segunda`…). It also redefines date-part ordering — `dd de mês de aaaa` for text form, `dd/mm/aaaa`
for numeric. `et-al` stays `et al.`, because it is Latin.

**It does not translate the title, the journal name, the publisher, or any other item content.** A
CSL locale file contains only `<term>`, `<date>` and `<style-options>` elements. There are zero
`<title>` elements in it, and CSL has no mechanism anywhere for a locale to translate an item's
`title` or `container-title`. Those strings come from the CSL-JSON item and render verbatim.

Run for real through citeproc-js against the same items in both locales, APA 7 changes **exactly two
things**:

```
en-US:  Mobråten, M., & Weber, S. (2020). The Climbing Bible: Technical, Physical and
        Mental Training for Rock Climbing (1st ed.). Vertebrate Publishing.
        Shaw, G., Lee-Barthel, A., Ross, M. L. R., Wang, B., & Baar, K. (2017). Vitamin
        C-enriched gelatin supplementation before intermittent activity augments collagen
        synthesis. The American Journal of Clinical Nutrition, 105(1), 136–143.
        Lattice Training. (2023, May 12). Finger Strength Benchmarks. …

pt-BR:  Mobråten, M., & Weber, S. (2020). The Climbing Bible: Technical, Physical and
        Mental Training for Rock Climbing (1o ed.). Vertebrate Publishing.
        Shaw, G., Lee-Barthel, A., Ross, M. L. R., Wang, B., & Baar, K. (2017). Vitamin
        C-enriched gelatin supplementation before intermittent activity augments collagen
        synthesis. The American Journal of Clinical Nutrition, 105(1), 136–143.
        Lattice Training. (2023, maio 12). Finger Strength Benchmarks. …
```

`May` → `maio`, `1st ed.` → `1o ed.` The in-text cluster is **byte-identical**. Vancouver shows more
surface because it uses more terms (`2017 Jan` → `janeiro de 2017`, `[cited 2026 Aug 16]` →
`[citado 16 de agosto de 2026]`, `Available from:` → `Disponível em:`), and **Nature produces
byte-identical output in both locales** because it uses no localised terms at all.

**So: a CSL-formatted citation is bilingual only in its connective furniture.** The scientific
content — paper title, journal name, publisher — is one string in one language, and CSL has no
opinion about translating it. If the Portuguese side of the app should show a Portuguese rendering of
a title, that must live in the message catalogue exactly as it does today. This bears directly on
ADR-0003's *a label is never an identifier*: CSL does not change where the bilingual boundary sits,
it only formats what is on the English side of it.

### 1.8 The concrete delta from the current shape

| Current field | CSL-JSON | What changes |
| --- | --- | --- |
| `id` | `id` | Direct. |
| `authors` (free text) | **splits into `author[]` + `container-title`** | The one field that genuinely fragments. |
| `year: '2017'` | `issued: {"date-parts": [[2017]]}` | String → nested numeric array. |
| `year: '—'` | **omit `issued`** | The sentinel has no equivalent. |
| `url` | `URL` | Casing changes; lowercase fails validation. |
| `kind?: 'reference'` | `type: 'book'` \| `'webpage'` \| … — *or nothing* | Depends what the flag means; see below. |
| — | `type` | **New and required**, with no default. 16 deliberate assignments. |
| — | `title` | Currently in the message catalogues. |

**What the `authors` split costs.** `'Shaw, Lee-Barthel, Ross, Wang & Baar — Am J Clin Nutr'` is one
authored string that renders verbatim today. Structured, it needs **given names that are not in the
corpus** (with `{"family": "Shaw"}` alone, APA renders a bare `Shaw`) — recoverable from Crossref,
but new data. And the abbreviated journal name is a *separate* variable, `container-title-short`;
Crossref returned `"The American Journal of Clinical Nutrition"` for it, i.e. not actually
abbreviated, so `Am J Clin Nutr` would have to be hand-supplied anyway. What is gained in exchange is
real: et-al truncation, author sorting and `Shaw et al.` in-text forms are impossible against an
opaque string and automatic against `author[]`.

**What `kind: 'reference'` becomes depends on what it means**, and the comment in `studies.ts` says
both things at once — *"'reference' marks a book or coaching resource — cited for practical guidance,
not as primary evidence"*:

- The **bibliographic** half ("a book or coaching resource") maps cleanly and better onto `type`:
  `book`, `webpage`, `chapter`, `report`, `standard`, `thesis`, `dataset`, `software`. That is
  precisely what CSL's type vocabulary is for.
- The **editorial** half ("not as primary evidence") is a judgement about the claim, not a property
  of the document, and CSL has **no** variable for it.

So the one existing one-bit evidence grade splits in two under CSL, and only half of it has a home.

**The extension point is `custom`, and it is schema-blessed.** Verbatim from `csl-data.json`:

```json
"custom": {
  "title": "Custom key-value pairs.",
  "type": "object",
  "description": "Used to store additional information that does not have a designated CSL JSON field. The custom field is preferred over the note field for storing custom data, particularly for storing key-value pairs, as the note field is used for user annotations in annotated bibliography styles.",
  "examples": [
    { "short_id": "xyz", "other-ids": ["alternative-id"] },
    { "metadata-double-checked": true }
  ]
}
```

`custom` is an untyped object with no `additionalProperties: false`, so arbitrary keys validate —
confirmed empirically on the item in §1.2. An evidence grade, a claim-id back-reference, or a
message-catalogue key all validate there.

The older alternative is the `note` field's **"cheater syntax"**
(`{:original-date: 2001-04-15}`, or `type: dataset` on its own line), documented at
<https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html>. The citeproc-js docs describe it
as *"intended as a temporary workaround to avoid blocking issues in user projects; it is not
supported by all CSL processors, and does not form part of the CSL standard."* `custom` supersedes
it, and the schema says so.

**Note what `custom` has to carry that the spec once had a home for.** Appendix IV of the CSL
specification lists a **`license`** variable; `csl-data.json` does not implement it. So CSL-JSON as
actually validated **cannot express a paper's licence** — which is the single fact §3 shows this
project most needs to record per study. It goes in `custom` or nowhere.

### 1.9 What CSL-JSON would and would not buy, concretely

**Would buy:**

- Designated homes for `DOI`, `PMID`, `PMCID` — the identifiers §2 and §5 both want anyway.
- A 12 KB MIT-licensed JSON Schema that validates the corpus at build time, catching malformed
  records mechanically. (This is *shape* validation only. It would not have caught any of the four
  errors in §0.1, all of which are well-formed records pointing at the wrong thing.)
- Structured `author[]`, which makes et-al, sorting and in-text forms possible at all.
- A 45-member type vocabulary that expresses the book/website/chapter distinctions the corpus already
  has, better than a one-bit `kind`.
- A one-off DOI-to-metadata import via Crossref content negotiation — after a ~20-line normalising
  pass (§1.5).
- Export to Zotero/Pandoc, if anyone ever wants it. Nobody has asked.

**Would not buy:**

- **Free bilingual citations.** The locale translates furniture, not content (§1.7).
- **A licence field.** The schema has none (§1.8).
- **An evidence grade.** `custom`, or nowhere.
- **A small bundle.** ~118 KB gzipped for en+pt-BR APA formatting, plus CC BY-SA attribution and
  CPAL/AGPL copyleft — against an app whose entire account state is ~28 KB.
- **Correctness of the data.** §0.1's four errors are all schema-valid.

---

## 2. DOIs, Crossref, and PubMed/PMC — is adding a study a one-field chore?

**Short answer: yes for anything with a DOI or a PMID, which is 14 of the current 16.** All the APIs
involved are free, need no key, and are callable from a build script. What survives automation is a
small number of genuine judgment calls, listed in §2.4.

### 2.1 The Crossref REST API

Base URL `https://api.crossref.org`. No signup, no key. Documentation:
<https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/>, which
states: *"Anyone can access the REST API, no signup or registration is required."*

**Three service pools, and the difference between them is a `mailto`.** Observed live, by reading
`x-rate-limit-*` headers:

| Pool | How to get it | Observed headers |
| --- | --- | --- |
| Public | Do nothing | `x-rate-limit-limit: 5`, `x-rate-limit-interval: 1s`, `x-concurrency-limit: 1`, `x-api-pool: public-single` |
| Polite | `User-Agent: send-lab/1.0 (mailto:you@example.com)` or `?mailto=` | `x-rate-limit-limit: 10`, `x-rate-limit-interval: 1s`, `x-concurrency-limit: 3`, `x-api-pool: polite-single` |
| Plus | `Crossref-Plus-API-Token: Bearer <key>` — a paid subscription | Documented as 150/interval, no concurrency limit |

Both observations are reproducible:

```console
$ curl -sD - -o /dev/null "https://api.crossref.org/works/10.1136/bjsports-2015-095788"
x-rate-limit-limit: 5
x-rate-limit-interval: 1s
x-concurrency-limit: 1
x-api-pool: public-single

$ curl -sD - -o /dev/null -A "send-lab/1.0 (mailto:ygor@infotera.com.br)" \
    "https://api.crossref.org/works/10.1136/bjsports-2015-095788"
x-rate-limit-limit: 10
x-rate-limit-interval: 1s
x-concurrency-limit: 3
x-api-pool: polite-single
```

At 10 requests per second the entire 16-study corpus is fetched in under two seconds. Even the
public pool clears it in four. **Crossref Plus does not transfer** — it is a paid subscription aimed
at production integrations, and this corpus is three orders of magnitude below the point where it
would matter.

Also note `access-control-allow-origin: *` on every response: the API is callable from a browser as
well as from a build script.

### 2.2 What a DOI lookup actually returns

`GET https://api.crossref.org/works/10.3945/ajcn.116.138594` returns a 20 KB JSON document. Every
field `studies.ts` currently stores by hand is in it, plus a great deal more:

```json
{
  "DOI": "10.3945/ajcn.116.138594",
  "type": "journal-article",
  "title": ["Vitamin C–enriched gelatin supplementation before intermittent activity augments collagen synthesis"],
  "container-title": ["The American Journal of Clinical Nutrition"],
  "short-container-title": ["The American Journal of Clinical Nutrition"],
  "author": [
    {"given": "Gregory",   "family": "Shaw",        "sequence": "first",      "affiliation": []},
    {"given": "Ann",       "family": "Lee-Barthel", "sequence": "additional", "affiliation": []},
    {"given": "Megan LR",  "family": "Ross",        "sequence": "additional", "affiliation": []},
    {"given": "Bing",      "family": "Wang",        "sequence": "additional", "affiliation": []},
    {"given": "Keith",     "family": "Baar",        "sequence": "additional", "affiliation": []}
  ],
  "issued":          {"date-parts": [[2017, 1]]},
  "published-print": {"date-parts": [[2017, 1]]},
  "volume": "105", "issue": "1", "page": "136-143",
  "ISSN": ["0002-9165"],
  "publisher": "Elsevier BV",
  "is-referenced-by-count": 191,
  "reference-count": 51,
  "URL": "http://dx.doi.org/10.3945/ajcn.116.138594",
  "license": [ /* see §3.2 */ ]
}
```

Two things are worth naming because they change how much code the mapping takes. `title` and
`container-title` are **arrays of strings**, not strings — a Crossref quirk that trips people who
assume a scalar. And `author[]` is a proper structured name list with `family`/`given` split, which
is what makes locale-correct formatting possible at all; the current `authors` string cannot be
reformatted because the surname boundary is not marked.

**The `select` parameter trims the payload.** `?select=DOI,title,author,container-title,issued`
returns only those keys, turning a 20 KB response into a few hundred bytes — relevant if this ever
runs in CI across the whole corpus.

### 2.3 Finding the DOI in the first place

The one-field chore assumes you already have the DOI. Crossref's `query.bibliographic` does fuzzy
matching from a free-text citation, and on the corpus's own worst case it works:

```console
$ curl -sG "https://api.crossref.org/works" \
    --data-urlencode "query.bibliographic=The countermovement jump to monitor neuromuscular status: A meta-analysis Claudino 2017" \
    --data-urlencode "rows=3" --data-urlencode "select=DOI,title,container-title,issued,score"

54.1 | 10.1016/j.jsams.2016.08.011 | Journal of Science and Medicine in Sport | [[2017, 4]]
       The countermovement jump to monitor neuromuscular status: A meta-analysis
35.4 | 10.33915/etd.13292          | ?                                        | [[None]]
       Assessment of Countermovement Jump in Athlete Status and Monitoring
34.7 | 10.5040/9781350872233       | Countermovement Jump (CMJ) Test           | [[2012]]
       Countermovement Jump (CMJ) Test
```

The correct DOI is the top hit at score 54.1 against 35.4 for the runner-up.

**But `score` has no documented threshold, and Crossref always returns something.** Asked for a work
that does not exist in Crossref — Eric Hörst's *Training for Climbing* website — it returns
plausible-looking garbage rather than an empty list:

```
20.6 | 10.5040/9781718225787.0004 | other   | Climbing the Steps to Weight Training Success
20.3 | 10.1186/isrctn18006574     | dataset | Climbing training in children with cerebral palsy
```

Nothing in the response says "no match". A script that takes the top hit unconditionally will
cheerfully attach a cerebral-palsy dataset DOI to a coaching website. Any automated DOI *discovery*
therefore needs a human confirming the match; automated DOI *resolution* (you already have the
identifier, fetch its metadata) does not.

### 2.4 NCBI E-utilities — PubMed and PMC

Base URL `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`. Guidelines at
<https://www.ncbi.nlm.nih.gov/books/NBK25497/>.

**Rate limits, documented and observed.** The documentation says *"no more than three URL requests
per second"* without a key, and up to 10/s with one. API keys are free from an NCBI account. The
documented limit is enforced and is visible in the headers:

```
X-Ratelimit-Limit: 3
X-Ratelimit-Remaining: 2
Access-Control-Expose-Headers: X-RateLimit-Limit,X-RateLimit-Remaining
```

Exceeding it returns **HTTP 429**, confirmed by firing eight concurrent requests:

```console
$ for i in 1 2 3 4 5 6 7 8; do curl -so /dev/null -w "%{http_code} " "$ESUMMARY_URL" & done; wait
200 429 200 200 429 429 429 429
```

The guidelines also ask that large jobs be run *"either weekends or between 9:00 PM and 5:00 AM
Eastern time during weekdays"* — a rule written for people harvesting millions of records, not for a
sixteen-row file, but it is the stated policy.

`esummary` for a PMID returns everything needed, and crucially returns the **cross-identifiers**:

```json
{"uid": "30988852",
 "pubdate": "2019 Mar", "epubdate": "2019 Mar 27",
 "source": "J Hum Kinet", "fulljournalname": "Journal of human kinetics",
 "authors": [{"name": "López-Rivera E"}, {"name": "González-Badillo JJ"}],
 "title": "Comparison of the Effects of Three Hangboard Strength and Endurance Training Programs on Grip Endurance in Sport Climbers.",
 "volume": "66", "issue": "", "pages": "183-195",
 "issn": "1640-5544", "essn": "1899-7562",
 "articleids": [
   {"idtype": "pubmed", "value": "30988852"},
   {"idtype": "pmc",    "value": "PMC6458579"},
   {"idtype": "doi",    "value": "10.2478/hukin-2018-0057"}
 ]}
```

Note that `authors[].name` here is `"López-Rivera E"` — surname plus initials in one string, *not*
split into family/given the way Crossref splits it. If a locale-correct formatted citation is ever
wanted, Crossref is the better source of names and PubMed is not sufficient.

**A dedicated ID converter exists** and is the cheapest way to go PMID ↔ PMCID ↔ DOI in bulk. It has
moved; the old `www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/` now 301s to:

```console
$ curl -s "https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/?ids=30988852,26511006,9662690,33647876&format=json&tool=send-lab&email=..."
{"status":"ok",
 "records":[
   {"doi":"10.2478/hukin-2018-0057","pmcid":"PMC6458579","pmid":30988852,"requested-id":"30988852"},
   {"pmid":26511006,"status":"error","errmsg":"Identifier not found in PMC"},
   {"pmid":9662690, "status":"error","errmsg":"Identifier not found in PMC"},
   {"pmid":33647876,"status":"error","errmsg":"Identifier not found in PMC"}]}
```

`"Identifier not found in PMC"` means no PMC record — which for §3 also means no free full text and
no licence statement to read.

**Europe PMC is a third option, and it is the only single call that returns metadata *and* licence
together.** No key, no registration, `https://www.ebi.ac.uk/europepmc/webservices/rest/search`:

```console
$ curl -s 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:"10.1136/bjsports-2016-096572"&resultType=core&format=json'

id: 27535991          pmid: 27535991      pmcid: PMC5013087
doi: 10.1136/bjsports-2016-096572
title: How much is too much? (Part 2) International Olympic Committee consensus statement on load in sport and risk of illness.
journalInfo: British journal of sports medicine
authorString: Schwellnus M, Soligard T, Alonso JM, Bahr R, Clarsen B, Dijkstra HP, Gabbett TJ, ...
pubYear: 2016         firstPublicationDate: 2016-09-01
isOpenAccess: Y       inEPMC: Y       inPMC: Y       license: cc by-nc
```

and for a closed paper:

```console
$ ... query=DOI:"10.1123/ijspp.2020-0637"
{'id': '33647876', 'pmid': '33647876', 'doi': '10.1123/ijspp.2020-0637',
 'isOpenAccess': 'N', 'inEPMC': 'N', 'license': None}
```

### 2.5 What does *not* automate

Four things survive, and they are the reason "one field" is not literally true.

**The citation year is a judgment call.** Crossref's `issued` is the earliest known publication date,
which for any journal with online-first publishing is not the year anyone cites. Both affected
studies in this corpus show it:

| Study | `studies.ts` | `issued` | `published-online` | `published-print` |
| --- | --- | --- | --- | --- |
| `sleep` (Fullagar) | `'2015'` | `[[2014,10,15]]` | `[[2014,10,15]]` | `[[2015,2]]` |
| `acwr` (Hulin) | `'2016'` | `[[2015,10,28]]` | `[[2015,10,28]]` | `[[2016,2]]` |

In both cases the hand-typed year is right and `issued` is wrong for citation purposes.
`published-print` is the field that matches, but it is absent on born-digital and online-only
journals, so neither field alone is correct in general.

**Two of sixteen sources have no DOI and never will.** `trainingforclimbing.com` and
`camp4humanperformance.com` are websites. They are exactly the entries already carrying
`kind: 'reference'` and `year: '—'`. Any identifier-first design has to keep a URL-only path for
them.

**Non-journal sources have DOIs but need discovery.** The `neckcheck` entry is a Springer book
chapter; it does have a DOI (`10.1007/978-3-662-55713-6_56`, found by bibliographic query at score
42.3) but it is not in `studies.ts` and is not derivable from the PMC URL that is.

**Retractions are a separate lookup.** The PMC OA service returns a `retracted="no"` attribute (§3.3)
but only for articles in the OA subset. Crossref exposes retraction via `update-to` / Crossmark
`relation` records, which none of this corpus carries. Map #29 explicitly names *"papers get
retracted, superseded, or fail to replicate"* as the reason validation needs a re-review cadence;
nothing in §2 automates that check for the ten studies with no PMC record.

---

## 3. Open-access licensing, mechanically

This is the question with the sharpest practical consequence — the repo is public, so "may this PDF
be committed?" has a legal answer and getting it wrong is infringement. The answer splits into two
halves that are constantly confused, including by the APIs themselves.

### 3.1 "Free to read" and "free to redistribute" are different, and the APIs disagree about which they report

**Free to read** means a copy is reachable without payment. It says nothing about copying. **Free to
redistribute** means the licence grants you the right to make and distribute further copies — which
is what committing a PDF to a public GitHub repo does.

PMC states the position plainly at <https://pmc.ncbi.nlm.nih.gov/about/copyright/>. Articles are
*"provided by the respective publishers or authors"*, and users must *"adhere to the terms and
conditions defined by the copyright holder"*. Many articles are *"protected by U.S. and/or foreign
copyright laws, even though PMC provides free access to it."* Reuse *"beyond the license terms or
those allowed by the fair use principles of the copyright laws, requires the written permission of
the copyright owners."* Only the Open Access Subset is *"made available under a Creative Commons or
similar license that allows more liberal redistribution and reuse than a traditional copyrighted
work."*

The same page also forbids something a "download the corpus" script might do without thinking:
*"Systematic downloading of batches of articles from the main PMC web site, in any way, is prohibited
because of copyright restrictions."* Only the OAI-PMH, FTP and Cloud services are sanctioned for
automated retrieval.

**Unpaywall's `is_oa` is a free-to-read flag, and reading it as a licence flag is the classic
mistake.** For the Baar/Shaw gelatin paper, `https://api.unpaywall.org/v2/10.3945/ajcn.116.138594`
returns:

```json
{"is_oa": true, "oa_status": "bronze",
 "best_oa_location": {"host_type": "publisher", "license": null,
   "url_for_pdf": "https://academic.oup.com/ajcn/article-pdf/105/1/136/23801346/ajcn138594.pdf",
   "version": "publishedVersion"}}
```

`is_oa: true` with `license: null` is Unpaywall's "bronze" category: the publisher has made the PDF
readable at no charge, under no open licence, revocably. That PDF is not redistributable. The same
paper, asked of PMC's own OA service, is refused outright:

```console
$ curl -s "https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi?id=PMC5183725"
<OA>...<error code="idIsNotOpenAccess">identifier 'PMC5183725' is not Open Access</error></OA>
```

This paper is in the corpus, is freely readable at the PMC URL `studies.ts` already stores, and may
not be committed.

### 3.2 What Crossref's `license` field is, and how far it goes

Crossref works carry a `license` array. Each element is a licence URL, a `content-version`, and a
start date with `delay-in-days` for embargoes. The three `content-version` values are `vor` (version
of record), `am` (accepted manuscript) and `tdm` (a version deposited for text and data mining), plus
`unspecified`.

For the Elsevier paper above:

```json
"license": [
  {"content-version": "tdm", "delay-in-days": 0,
   "URL": "https://www.elsevier.com/tdm/userlicense/1.0/",  "start": {"date-parts": [[2017,1,1]]}},
  {"content-version": "tdm", "delay-in-days": 0,
   "URL": "https://www.elsevier.com/legal/tdmrep-license",  "start": {"date-parts": [[2017,1,1]]}},
  {"content-version": "vor", "delay-in-days": 2227,
   "URL": "http://www.elsevier.com/open-access/userlicense/1.0/", "start": {"date-parts": [[2023,2,6]]}}
]
```

Three licences, none of them Creative Commons, two of them scoped to text mining only, and the
version-of-record one embargoed 2227 days. A check that merely asks "does this DOI have a licence?"
answers *yes* here and would be badly wrong. **The presence of a `license` array means nothing; only
its URL and `content-version` mean anything.**

The same DOI also carries this in `assertion`:

> "Copyright © 2017 American Society for Nutrition. Published by Elsevier Inc. All rights are
> reserved, including those for text and data mining, AI training, and similar technologies."

**Coverage is the bigger limit.** Measured live against the Crossref API on 2026-08-16 using
`filter=has-license:true` with `rows=0`:

| Set | Count | With a `license` field |
| --- | --- | --- |
| All Crossref works | 185,497,315 | 83,460,589 — **45.0%** |
| `type:journal-article` | 123,186,304 | 70,538,587 — **57.3%** |

So **roughly 4 in 10 journal articles carry no licence assertion in Crossref at all.** For those,
Crossref's answer to "may I commit this?" is silence, which is not the same as "no" and must not be
read as "yes".

**And Crossref does not verify what it is told.** Its own best-practice page
(<https://www.crossref.org/documentation/principles-practices/best-practices/license/>) says: *"we
make sure the URLs provided are URLs, but don't verify that they resolve to an active license."* The
licence is publisher-asserted metadata, not an authority.

### 3.3 The PMC Open Access Subset, precisely

The OA service — `https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi?id=PMC<id>` — is the most direct
machine answer available for anything with a PMCID. No key, no registration. It returns an XML record
carrying `license=` and `retracted=`, plus download links:

```xml
<record id="PMC11282332" citation="J Sport Health Sci. 2024 Sep 9; 13(5):663-665"
        license="CC BY-NC-ND" retracted="no">
  <link format="tgz" href="ftp://ftp.ncbi.nlm.nih.gov/pub/pmc/oa_package/b6/ce/PMC11282332.tar.gz"/>
  <link format="pdf"  href="ftp://ftp.ncbi.nlm.nih.gov/pub/pmc/oa_pdf/b6/ce/main.PMC11282332.pdf"/>
</record>
```

`https://pmc.ncbi.nlm.nih.gov/tools/openftlist/` splits the subset into three buckets: **commercial
use allowed** (CC0, CC BY, CC BY-SA, CC BY-ND), **non-commercial only** (CC BY-NC, CC BY-NC-SA,
CC BY-NC-ND), and **Other** — *"no machine-readable license, no license, or custom license."*

**The trap is the third bucket, and it is enormous.** Counted live via E-utilities `esearch` against
`db=pmc` on 2026-08-16:

| Set | Count |
| --- | --- |
| PMC total | 12,522,248 |
| PMC Open Access Subset | 8,150,363 |
| — CC0 | 8,699 |
| — CC BY | 2,883,435 |
| — CC BY-ND | 7,792 |
| — CC BY-SA | 1,463 |
| — CC BY-NC | 482,776 |
| — CC BY-NC-ND | 756,463 |
| — CC BY-NC-SA | 83,319 |

Commercial-use-allowed licences account for **2,901,389 — 35.6%** of the OA subset. NC-restricted CC
licences account for another 1,239,239 (15.2%). That leaves roughly **4.0 million articles, 49% of
the "Open Access Subset", carrying no CC licence tag at all.**

Those articles are in the subset — downloadable through the sanctioned FTP service — and still carry
no reuse grant. The corpus contains a live example. `PMC7123245`, the `neckcheck` Springer book
chapter, is in the OA package listing yet reports:

```xml
<record id="PMC7123245" citation="Return to Play in Football. 2017 Sep 4;:755-769"
        license="none" retracted="no">
  <link format="tgz" href="ftp://ftp.ncbi.nlm.nih.gov/pub/pmc/oa_package/75/9e/PMC7123245.tar.gz"/>
</record>
```

`license="none"` on a record that hands you a download link. **Being fetchable from the OA package
service is not permission.** Note also the missing `<link format="pdf">` — this record offers only
the archive.

### 3.4 Two authoritative sources gave contradictory licences for a paper in this corpus

This is the finding that most directly limits how far the question can be automated.

For `10.2478/hukin-2018-0057` (the `lopez` study, PMC6458579):

| Source | Reported licence |
| --- | --- |
| Unpaywall `best_oa_location.license` | **`cc-by`** |
| PMC OA service `license=` | **`CC BY-NC-ND`** |
| Crossref `license[].URL` | **`http://creativecommons.org/licenses/by-nc-nd/3.0`** |

Two of three agree on CC BY-NC-ND; Unpaywall says CC BY. A pipeline that trusted Unpaywall would
have concluded this paper was freely redistributable in a public repo and committed a PDF that is in
fact No-Derivatives and Non-Commercial. **A single-source licence check is not safe.** Agreement
between Crossref and PMC is available for free and is the cheap way to catch this.

### 3.5 The whole corpus, licensed

Every study with a resolvable DOI, run through Unpaywall, Crossref and (where a PMCID exists) the PMC
OA service:

| Study | DOI | Unpaywall `oa_status` / licence | PMC OA subset | Redistributable? |
| --- | --- | --- | --- | --- |
| `ferrer` | `10.7717/peerj.15464` | gold / `cc-by` | — | **Yes — CC BY 4.0**, confirmed by Crossref (`https://creativecommons.org/licenses/by/4.0/`) |
| `lopez` | `10.2478/hukin-2018-0057` | gold / `cc-by` ⚠️ | `CC BY-NC-ND` | No — NC + ND; Unpaywall contradicted (§3.4) |
| `illness` | `10.1136/bjsports-2016-096572` | hybrid / `cc-by-nc` | `CC BY-NC` | Non-commercial only |
| `ewma`(→Carey) | `10.1136/bjsports-2016-096309` | hybrid / `cc-by-nc` | `CC BY-NC` | Non-commercial only |
| `illness_revisit` | — (PMC11282332) | — | `CC BY-NC-ND` | No — ND |
| `neckcheck` | `10.1007/978-3-662-55713-6_56` | — | `license="none"` | **No — in OA subset, no licence** |
| `baar` | `10.3945/ajcn.116.138594` | bronze / `null` | **not in subset** | **No — free to read only** |
| `acwr` | `10.1136/bjsports-2015-094817` | bronze / `null` | not in PMC | No — free to read only |
| `probe`(→Claudino) | `10.1016/j.jsams.2016.08.011` | green / `other-oa` | not in PMC | Unclear — repository copy, licence unstated |
| `lattice` | `10.1123/ijspp.2020-0637` | closed | not in PMC | No |
| `hooper` | `10.2165/00007256-199520050-00003` | closed | not in PMC | No |
| `prs` | `10.1519/JSC.0b013e3181c69ec6` | closed | not in PMC | No |
| `sleep` | `10.1007/s40279-014-0260-0` | closed | not in PMC | No (Crossref licence: `http://www.springer.com/tdm` — text-mining only) |
| `foster` | `10.1097/00005768-199807000-00023` | closed | not in PMC | No |
| `horst`, `nelson` | no DOI | — | — | Websites; ordinary copyright |

**Of sixteen studies, exactly one — `ferrer`, the PeerJ paper — is unambiguously committable.** Map
#29's tier 3 is *"Papers whose licence genuinely permits it (CC-BY)"*; on today's corpus that tier
holds one paper.

Four distinct "no" reasons appear, and they are not interchangeable: closed (4), free-to-read-only
bronze (2), NC-restricted (2), ND-restricted (2), in-the-OA-subset-but-unlicensed (1), and one
`other-oa` green record whose licence is simply not stated anywhere machine-readable.

### 3.6 So: can the licence be determined programmatically?

**For a PMCID: yes, reliably, and it is one unauthenticated GET.** The OA service is authoritative
about the PMC subset, distinguishes `idIsNotOpenAccess` from `license="none"` from a named CC
licence, and throws in `retracted=`.

**For a bare DOI: partially, and the gaps are dangerous rather than merely inconvenient.** 43% of
journal-article DOIs carry no licence field; Crossref does not verify what it stores; and the
aggregators disagree with each other on real papers in this corpus.

**What a mechanical check can honestly produce is a three-way answer, not a yes/no** —
*known-permissive* (an explicit CC BY / CC0 / CC BY-SA / CC BY-ND URL, corroborated across Crossref
and PMC), *known-restricted* (an explicit NC or ND or proprietary licence, or `idIsNotOpenAccess`),
and *unknown* (no licence field, `license="none"`, `other-oa`, or sources disagreeing). Today those
buckets hold 1, 10 and 3 of the DOI-bearing studies respectively. Only the first bucket answers the
commit question affirmatively, and only the first bucket can be answered without a human.

**Two further distinctions that the licence string alone does not settle:**

- **NC is not a defined term.** Creative Commons' own FAQ treats "NonCommercial" as fact-dependent
  and unsettled at the margins. A public GitHub repo hosting a private, non-monetised training app is
  a plausible non-commercial use, but "plausible" is the operative word, and GitHub's own terms grant
  other users a right to view and fork what is in a public repo — which is a redistribution the NC
  clause has to tolerate. This is a legal judgment, not an API call.
- **ND forbids derivatives, not copies.** A CC BY-NC-ND PDF may be redistributed verbatim; what is
  forbidden is adapting it. Extracting a figure, or committing a cropped or annotated version, is the
  part ND blocks.

Neither of these is what the map's tier 3 is asking about — tier 3 says CC-BY specifically, and
CC-BY is the only case with no argument attached.

---

## 4. Prior art for claims, not citations

The question is whether anything already models *a proposition backed by sources* rather than a
bibliography entry. Several things do. **None of them is adoptable as a standard; two or three are
worth borrowing a shape from.** The dividing line throughout is whether a thing is a data shape a
static TypeScript file could copy, or an infrastructure commitment.

### 4.1 Schema.org `ClaimReview` — a fact-check verdict, and its consumer is dead

<https://schema.org/ClaimReview>. Hierarchy `Thing > CreativeWork > Review > ClaimReview`, described
as *"A fact-checking review of claims made (or reported) in some creative work (referenced via
itemReviewed)."*

**It defines exactly one property of its own**: `claimReviewed` (Text) — *"A short summary of the
specific claims reviewed in a ClaimReview."* Everything else is inherited: `reviewRating` (Rating),
`itemReviewed` (Thing), `reviewBody`, `author`, `datePublished`, `url`.

`Rating` (<https://schema.org/Rating>) carries `ratingValue`, `bestRating` (*"The highest value
allowed in this rating system"*), `worstRating`, `ratingExplanation` (*"A short explanation (e.g. one
to two sentences) providing background context and other information that led to the conclusion
expressed in the rating"*), and `reviewAspect`.

One correction to a common assumption: **`alternateName` is not a `Rating` property.** It is
inherited from `Thing`; Google's fact-check docs merely repurpose it as the human-readable verdict
string. Google's docs (<https://developers.google.com/search/docs/appearance/structured-data/factcheck>)
require `claimReviewed`, `reviewRating`, `url`; recommend `author` and `itemReviewed`; suggest
`claimReviewed` stay **under 75 characters**; and recommend a 1–5 scale from "False" to "True" with
`worstRating` minimum 1.

**Two reasons it does not fit.** First, the axis is wrong: `reviewRating` is one scalar on a
false↔true axis, whereas an evidence grade is a scalar on a *confidence* axis that is orthogonal to
truth. A claim can be entirely true and honestly graded "low certainty", and can be graded "high
certainty" and later overturned. There is no slot for how many studies, what designs, or what
population. Second, `itemReviewed` points at *the work containing the utterance*, not at supporting
evidence — the arrow points the opposite way from claim → studies.

Third, and decisively for anyone hoping for ecosystem benefit: Google's own page states
**"We're phasing out support for `ClaimReview` markup in Google Search. However, this markup remains
supported by the Factcheck Explorer Tool."** Secondary reporting places the removal of Fact Check
rich results in **June 2025**. The vocabulary term still exists; the reason to emit it does not.

> **Verdict:** the `bestRating`/`worstRating`/label trick — shipping the scale alongside the value —
> is worth stealing. The type is not, and its consumer is gone.

### 4.2 `schema.org/Claim` — the right noun, the wrong properties

<https://schema.org/Claim>, `Thing > CreativeWork > Claim`, present in V30.0 (2026-03-19), and
flagged by schema.org as being *"in the 'new' area — implementation feedback and adoption from
applications and websites can help improve our definitions"*. Described as *"a specific,
factually-oriented claim that could be the itemReviewed in a ClaimReview."*

It defines **three** properties: `appearance` (*"Indicates an occurrence of a Claim in some
CreativeWork"*), `firstAppearance`, and `claimInterpreter`.

All three are about **where the claim was uttered and who transcribed it**. There is no evidence
pointer and no grade. Evidence-bearing has to be smuggled in via `CreativeWork.citation`.

> **Verdict:** a naming precedent for treating a proposition as a first-class object, and nothing
> more. Its actual properties model "who said this and where", which is the wrong axis entirely.

### 4.3 `MedicalEvidenceLevel` — the only machine-readable evidence grade found

<https://schema.org/MedicalEvidenceLevel>, `Thing > Intangible > Enumeration > MedicalEnumeration >
MedicalEvidenceLevel`, *"Level of evidence for a medical guideline. Enumerated type."* Exactly three
members, with stable URLs and verbatim definitions:

| Member | Definition |
| --- | --- |
| [`EvidenceLevelA`](https://schema.org/EvidenceLevelA) | "Data derived from multiple randomized clinical trials or meta-analyses." |
| [`EvidenceLevelB`](https://schema.org/EvidenceLevelB) | "Data derived from a single randomized trial, or nonrandomized studies." |
| [`EvidenceLevelC`](https://schema.org/EvidenceLevelC) | "Only consensus opinion of experts, case studies, or standard-of-care." |

This is the ACC/AHA level-of-evidence scheme, verbatim. It is consumed by
[`MedicalGuideline`](https://schema.org/MedicalGuideline), whose four-property shape is structurally
close to what map #29 describes: `evidenceLevel` (the enum), `evidenceOrigin` (Text — *"Source of the
data used to formulate the guidance, e.g. RCT, consensus opinion, etc."*), `guidelineDate` (*"Date on
which this guideline's recommendation was made"*), and `guidelineSubject`. The subtype
`MedicalGuidelineRecommendation` adds `recommendationStrength`.

Two observations. The **enum + free-text origin + date** pattern is exactly the escape hatch a
three-level enum needs, and `guidelineDate` is a ready-made home for the dated validation sign-off.
But **all three levels presume that some study exists.** There is no member for "no evidence — our
judgment", which is the grade map #29 says must be sayable. That would be a locally invented fourth
level, at which point the enum is no longer `MedicalEvidenceLevel`.

> **Verdict:** genuinely borrowable, and the only machine-readable grade vocabulary in this survey
> with stable term URLs. Three members and a missing floor.

### 4.4 W3C Web Annotation Data Model — right for the sign-off, wrong for the claim

<https://www.w3.org/TR/annotation-model/>, **W3C Recommendation, 23 February 2017**. Core statement:
*"An annotation is considered to be a set of connected resources, typically including a body and
target, and conveys that the body is related to the target."*

Structure: `body` (0+), `target` (**1+, required**), `motivation`. The thirteen motivation values are
`assessing`, `bookmarking`, `classifying`, `commenting`, `describing`, `editing`, `highlighting`,
`identifying`, `linking`, `moderating`, `questioning`, `replying`, `tagging`. Eight selectors exist
(`FragmentSelector`, `CssSelector`, `XPathSelector`, `TextQuoteSelector`, `TextPositionSelector`,
`DataPositionSelector`, `SvgSelector`, `RangeSelector`). `TextualBody` allows an inline literal body.

The model is a **JSON-LD serialisation, transport-agnostic, mandating no server**. That part is
usable.

**It cannot model a standalone proposition.** `target` is mandatory and the entire selector machinery
exists to anchor a note to a region of a document. An annotation without a target is malformed.
`motivation: assessing` is the closest fit for evidence work, but a motivation is an unstructured
hint, not a grade — there is no rating and no confidence anywhere in the model.

Where it *does* fit is precisely one place: **the validation sign-off**. An annotation whose `target`
is a `TextQuoteSelector` over the passage in the paper, whose `body` is a `TextualBody` reading
"confirms the claim for trained climbers", with `motivation: assessing`, `creator` and `created`, is
exactly the dated human read map #29 describes — anchored to the sentence that justifies it. That is
plain JSON with zero infrastructure.

**The transport half is a different story.** The
[Web Annotation Protocol](https://www.w3.org/TR/annotation-protocol/) requires an HTTP annotation
server with LDP Containers supporting GET/HEAD/OPTIONS/POST/PUT/DELETE. **Not usable.**

**Hypothes.is is a server, full stop.** Its own docs describe `h` as *"the web app that serves most
of the https://hypothes.is/ website, including the web annotations API"*; the browser client is *"a
client for h's API"*. Self-hosting is possible but the dev-environment prerequisites alone are Git,
GNU Make, pyenv, Docker Desktop, Node, npm and Yarn on Python 3.11. **Running a multi-service Python
web application and a Docker stack to hold one athlete's ~100 claims is not a trade anyone would
make.** The data model is a file format; Hypothes.is is an ops burden.

> **Verdict:** borrow the `motivation: assessing` + `creator` + `created` + `TextQuoteSelector` shape
> for the sign-off. The model cannot represent the Claim itself, and the product cannot be used at
> all.

### 4.5 Nanopublications — the right idea, wrapped in a research-community protocol

<https://nanopub.net/>, guidelines at <https://nanopub.net/guidelines/working_draft/>. A
nanopublication is *"a small knowledge graph snippet with metadata that is treated as an independent
(scientific) publication"*.

**Four named graphs, not three** — the guidelines are explicit that the three content graphs are
*"linked to its parts via triples in an additional head graph"*:

1. **Head** — links the nanopublication URI to its parts.
2. **Assertion** — *"contains such statements that form the main claim"*.
3. **Provenance** — *"contains one or more RDF triples that provide information about the
   assertion"*.
4. **Publication Info** — *"provenance information regarding the nanopublication itself"*.

Required vocabulary: `rdf:type np:Nanopublication` plus `np:hasAssertion`, `np:hasProvenance`,
`np:hasPublicationInfo`. Serialisation: *"We recommend using TriG syntax for writing
nanopublications"* — TriG is required in practice because named graphs are the whole mechanism.
Trusty URIs embed a content hash so modification is detectable.

**What publishing costs, from the reference client's own setup docs**
(<https://nanopublication.github.io/nanopub-py/getting-started/setup/>): generate an **RSA keypair**
(*"stored under `HOMEDIR/.nanopub/id_rsa`"*); have an **ORCID iD**; store a profile at
`HOMEDIR/.nanopub/profile.yml`; optionally publish an introduction nanopublication linking your ORCID
to your key; run `np setup`; then publish against the network. The Nanopub Registry
(<https://registry.knowledgepixels.com/>) held roughly **68,826 nanopublications across 601 accounts
and 336 agents** as of a December 2025 snapshot.

The conceptual split is the sharpest match in this entire survey: **assertion (the Claim) /
provenance (which studies, what method) / publication info (who signed off, when)** is precisely the
three-way separation map #29 already drew independently. But the whole value proposition is
*decentralised third-party verifiability of published knowledge*, and a private single-athlete app
has no third party to convince. RDF in TriG, an RSA keypair, an ORCID, trusty-URI hashing and a
global registry with fewer than seventy thousand documents in it is ceremony with no payer.

> **Verdict:** steal the three-way separation, in plain TypeScript objects. Everything else is
> infrastructure and identity ceremony that buys nothing here.

### 4.6 Evidence grading vocabularies — all four are prose

This is the finding that most constrains the "adopt rather than invent" hope: **there is no
machine-readable representation of any major evidence-grading system.** No OWL file, no JSON, no term
URIs. They are PDFs and journal articles.

**GRADE** (<https://www.gradeworkinggroup.org/>, handbook at
<https://gdt.gradepro.org/app/handbook/handbook.html>) — *"a common, sensible and transparent approach
to grading quality (or certainty) of evidence and strength of recommendations."* Four certainty
levels, verbatim:

| Level | Definition |
| --- | --- |
| **High** | "We are very confident that the true effect lies close to that of the estimate of the effect." |
| **Moderate** | "We are moderately confident in the effect estimate: The true effect is likely to be close to the estimate of the effect, but there is a possibility that it is substantially different" |
| **Low** | "Our confidence in the effect estimate is limited: The true effect may be substantially different from the estimate of the effect." |
| **Very low** | "We have very little confidence in the effect estimate: The true effect is likely to be substantially different from the estimate of effect" |

Strength of recommendation is kept explicitly separate: *"A recommendation should have one of two
strengths (strong or conditional, also called weak) and one of two directions (for or against)"* — a
2×2. The method behind the levels is five downgrading domains (risk of bias, inconsistency,
indirectness, imprecision, publication bias) and three upgrading domains (large effect,
dose-response, residual confounding), with RCTs starting high and observational studies starting low.

**GRADE's licence could not be verified as open.** No explicit licence statement was found on
gradeworkinggroup.org; the handbook carries a permissions note directing reproduction and translation
requests to the editors. Four one-word labels are not the kind of thing a licence practically
restrains, but the handbook prose is not free to copy wholesale. **GRADE's floor is "very low
certainty", which still presupposes evidence exists** — it has no member for "none".

**Oxford CEBM Levels of Evidence** (<https://www.cebm.ox.ac.uk/resources/levels-of-evidence/>) — the
2009 version has ten levels with a/b/c sublevels per question type; the 2011 version flattened to
**1–5** (*"levels '1a', '1b', and '1c', in the original Levels was replaced with simply '1'"*).
Grades of recommendation A–D: A = *"consistent level 1 studies"*, B = *"consistent level 2 or 3
studies or extrapolations from level 1 studies"*, C = *"level 4 studies or extrapolations from level
2 or 3 studies"*, D = *"level 5 evidence or troublingly inconsistent or inconclusive studies of any
level"*.

**2009 Level 5 is the only published label in this survey that honestly covers "our judgment"**:
*"Expert opinion without explicit critical appraisal, or based on physiology, bench research or
'first principles'."* That wording names the exact failure mode training advice tends toward.

**And CEBM is the licensing bright spot.** The site footer states: *"© 2026 University of Oxford. All
blog posts and resources are published under a CC BY 4.0 license."* CC BY 4.0 is the only
unambiguously open licence across all four grading systems.

**SORT** (Ebell et al., *Am Fam Physician* 2004,
<https://www.aafp.org/pubs/afp/issues/2004/0201/p548.html>) uses two deliberately separate scales —
**letters for the recommendation** (a body of evidence) and **numbers for an individual study**.
Grades: A = *"consistent and good-quality patient-oriented evidence"*, B = *"inconsistent or
limited-quality patient-oriented evidence"*, C = *"consensus, usual practice, opinion, disease-oriented
evidence, or case series"*.

SORT's distinctive contribution is the **patient-oriented vs disease-oriented** split.
Patient-oriented evidence measures morbidity, mortality, symptom improvement, quality of life;
disease-oriented evidence measures surrogate endpoints that *"may or may not reflect improvements in
patient outcomes"*. Grade C demotes disease-oriented evidence to the bottom tier **regardless of
study design**.

That axis is unusually relevant here. Most climbing-training research measures surrogate endpoints —
tendon stiffness, force-time integral, MVC, critical force — not the outcome the athlete cares about
(climbs harder, does not get injured). Under SORT, a well-run RCT measuring tendon stiffness is still
Grade C evidence for "this makes you climb harder". Several studies in the current corpus are exactly
that shape. No open licence was found for SORT; AAFP content is copyrighted.

> **Verdict:** four vocabularies, zero machine-readable forms, one clean open licence (CEBM, CC BY
> 4.0). The labels transcribe in minutes; there is nothing to import. Two systems separate
> grade-of-claim from quality-of-each-study, which matches the claim→studies arrow directly.

### 4.7 Everything else, briefly

**PROV-O** (<https://www.w3.org/TR/prov-o/>, W3C Recommendation 2013) — Entity / Activity / Agent
plus nine starting-point properties (`wasGeneratedBy`, `wasDerivedFrom`, `wasAttributedTo`,
`startedAtTime`, `used`, …). Pure vocabulary, no infrastructure. It does **not** model claims,
propositions or beliefs. *Borrowable:* `wasAttributedTo` + a timestamp as a naming convention for the
sign-off. Everything else is about deriving artefacts from artefacts — wrong subject.

**Evidence and Conclusion Ontology (ECO)** (<https://obofoundry.org/ontology/eco.html>) — two top
classes, **evidence** (*"a type of information that is used to support an assertion"*) and **assertion
method**. Distributed as `eco.owl` / `eco.obo` with JSON-LD and Turtle serialisations, **CC0 1.0** —
the most permissive licence in this survey. *But its terms are molecular-biology assay types*
("inferred from direct assay", "inferred from sequence similarity"), useless for exercise science.
The two-class shape is right; the vocabulary is inapplicable. (Its own site
`evidenceontology.org` currently serves an expired TLS certificate — a small live demonstration of
§5.)

**Wikidata's reference model** (<https://www.wikidata.org/wiki/Help:Sources>) — statements carry
references as property-value pairs: **`stated in (P248)`** for publications with their own item,
**`reference URL (P854)`** *"for websites and online databases"* when the source lacks one, plus
`retrieved (P813)`, `page(s) (P304)`, `DOI (P356)`. Statements carrying only `imported from (P143)`
*"are not considered sourced"*. Two conventions worth noting: **qualifiers** add context to the
statement (validity period, applicable population) separately from references; and the **rank
system** — `preferred` / `normal` / `deprecated` — lets contradicted or superseded statements stay in
the data rather than being deleted. That last is a ready answer for "a claim we no longer believe but
whose constants still reference it". Wikidata itself is a hosted triplestore with a SPARQL endpoint;
the conventions transfer, the platform does not.

**Argument Interchange Format (AIF)** — I-nodes (propositional information) vs S-nodes (scheme
applications: inference, conflict, preference). The only surveyed model treating *conflict between
claims* as first-class. But it is built for multi-agent argumentation and defeasible-reasoning
engines, has **no notion of evidence quality at all**, and 100–200 training claims that mostly do not
argue with each other do not need a defeasible-reasoning substrate.

**SKOS** (<https://www.w3.org/TR/skos-reference/>, W3C Recommendation 2009) — `skos:Concept`,
`prefLabel`/`altLabel`, `broader`/`narrower`, `definition`. The spec is explicit that it **does not
model propositions or assertions**: *"a thesaurus or classification scheme… does not assert any axioms
or facts."* Usable only to publish the grade vocabulary as a concept scheme — which is what a
TypeScript `Record<Grade, {label, definition}>` already is. No established "SKOS-based argument
model" exists as a named artefact.

**SciScore** (<https://sciscore.com/>) — a **hosted commercial SaaS** scoring manuscript methods
sections for rigor. Pay-per-use: 10 free scores/year via ORCID, then $19 for 4 more, $99 for 25, $399
for 100. It publishes **no reusable vocabulary**; the score is an opaque model output. This is a
subscription to grade papers the human is going to read anyway. **Does not transfer, and would not
help if it did.**

### 4.8 Is any of it worth borrowing for 16–200 claims in a TypeScript file?

The honest summary across §4:

- **No standard is adoptable.** Every candidate either models the wrong thing (`ClaimReview`,
  `schema.org/Claim`, PROV-O, SKOS, AIF), requires a server or a key or an ORCID (Web Annotation
  Protocol, Hypothes.is, nanopubs, Wikidata, SciScore), or exists only as prose (GRADE, CEBM, SORT).
- **Four shapes are worth borrowing**, all of them expressible as plain TypeScript at no cost: the
  nanopub **assertion / provenance / sign-off** three-way split; `MedicalGuideline`'s **enum + free-text
  origin + date**; SORT's **letter-for-claim / number-for-study** two-scale design and its
  **patient-oriented vs disease-oriented** axis; and Wikidata's **deprecated rank** for superseded
  claims.
- **Nothing has a grade for "no evidence — our judgment"** except OCEBM 2009 Level 5 and SORT Grade C,
  and both of those phrase it as *expert opinion*, which is a slightly different and more flattering
  thing than what map #29 means.
- **Anything designed for institutional repositories or reference-manager sync is over-engineered by
  three or four orders of magnitude for this corpus** and should be read as such rather than
  neutrally: nanopublications exist so that strangers can verify a claim's provenance
  cryptographically; Hypothes.is exists so that thousands of readers can annotate shared documents;
  Wikidata exists to serve a hundred million statements over SPARQL. This is one athlete, a few
  hundred propositions, and a file that is compiled into a bundle.

---

## 5. Link rot

### 5.1 Measured failure rates

No published study reports "% of URLs dead at exactly five years". Every five-year figure below is
interpolated between published anchors and is labelled as such.

**Pew Research Center, "When Online Content Disappears" (17 May 2024)** —
<https://www.pewresearch.org/data-labs/2024/05/17/when-online-content-disappears/>. Sampled from
Common Crawl snapshots, one per year 2013–2023, checked October 2023:

| Cohort | Age at check | Inaccessible |
| --- | --- | --- |
| 2013 pages | 10 years | **38%** |
| 2021 pages | ~2 years | **~20%** |
| 2023 pages | <1 year | **8%** |

Interpolating between the 2-year and 10-year anchors puts five years around **25–30%**. Pew's
secondary corpora: 54% of sampled English Wikipedia pages had at least one dead reference link (11%
of reference links dead); 23% of news pages had at least one broken link.

**Klein et al., "Scholarly Context Not Found: One in Five Articles Suffers from Reference Rot", PLOS
ONE 9(12): e0115253** — <https://doi.org/10.1371/journal.pone.0115253>. The largest scholarly
measurement: **1,841,901 STM articles** (arXiv, Elsevier, PubMed Central), publication years
1997–2012, over a million "web at large" URI references, live-tested March 2013.

- **One in five (~20%)** of all STM articles suffer reference rot; restricted to articles that
  actually contain web-at-large references, **seven in ten (~70%)**.
- Age gradient, link rot alone: articles published **2012 → 14–17%**; articles published
  **1997 → 66–76%**. A five-year point from this curve lands around **25–35%**.
- Useful vocabulary the paper defines: *link rot* = the URI no longer provides access; *content
  drift* = the resource has changed; *reference rot* = either. **Content drift is invisible to any
  status-code check**, which matters for §5.4.

**Bowers, Stanton & Zittrain (2021), the New York Times corpus** —
<https://cyber.harvard.edu/publication/2021/paper-record-meets-ephemeral-web>. 553,693 NYT articles
1996–2019 carrying 2,283,445 external links. 25% of deep links completely inaccessible, with a clean
age gradient: **6% for 2018 articles (~3 years), 43% for 2008 articles (~13 years), 72% for 1998
articles**. Interpolates to roughly **10–15% at five years** — the most optimistic of the three.

**Zittrain, Albert & Lessig (2014), legal citations** — *"more than 70% of the URLs within the
Harvard Law Review and other journals, and 50% of the URLs within United States Supreme Court
opinions, do not link to the originally cited information."*
<https://hls.harvard.edu/bibliography/perma-scoping-and-addressing-the-problem-of-link-and-reference-rot-in-legal-citations-2/>.
The widely repeated decimals "70.9%" and "49.9%" could not be verified against the primary PDF, which
returned 403 to an automated fetcher. The horizon here is not five years — it aggregates across 15+
years of citations.

**Half-lives**, where traceable to primary sources:

| Study | Sample | Half-life |
| --- | --- | --- |
| Spinellis (2003), CACM 46(1):71–77 | 4,224 URLs from 2,471 IEEE Computer / CACM articles, 1995–1999 | **~4 years** |
| Hennessey & Ge (2013), BMC Bioinformatics 14(S14):S5 | 17,110 URLs from Web of Science abstracts, 1996–2010 | **median 9.3 years** (95% CI 9.3–10.0) |

Spinellis' decay shape, verified against the author's own full text
(<https://www.spinellis.gr/pubs/jrnl/2003-CACM-URLcite/html/urlcite.html>): **20% decay in the first
year after publication, then ~10% per year for three years — roughly 50% gone at four years.** Figures
circulating for Nelson & Allen (23 yrs), Fetterly (138 weeks), McCown (10 yrs) and Weblock (14 yrs)
trace only to Wikipedia and were not verified.

**Convergent estimate: roughly 25–50% of arbitrary URLs cited today will fail within five years.**
The spread reflects corpus composition, not measurement error. **No study measures link rot in
sports-science or coaching literature, and none measures it for the coaching-website class of
source** — which is exactly what `trainingforclimbing.com` and `camp4humanperformance.com` are.

### 5.2 Do DOIs help? Yes, about an order of magnitude — with a large caveat

**Mechanically**, a DOI is a Handle System identifier (ISO 26324) resolved by the doi.org proxy, which
redirects to a target URL **supplied and maintained by the registrant**. The DOI Foundation's own
framing is unusually candid:

> "Persistence is a function of organizations, not of technology; a persistent identifier system
> requires a persistent organization, agreed policies and defined processes."
> — <https://www.doi.org/the-identifier/what-is-a-doi/>

**Crossref membership terms are contractual** (<https://www.crossref.org/membership/terms/>): *"The
Identifier shall serve as the permanent URL link to the Response Page. The Member shall register the
Response Page URL with Crossref, keep it up-to-date and active."* On cessation, *"in the event that
the Content permanently ceases to be maintained by the Member, Crossref is entitled to redirect
Identifiers to an Archive or a 'Defunct DOI' page."* Obligations survive termination of membership.

So when a publisher folds, the best case is a redirect to an archive or a stub. The DOI keeps
resolving; the article may not be there. The size of that gap is measured: **Eve (2024)**, sampling
**7,438,037 DOIs**, found **27.64% seemingly unpreserved in any archive**, and only 0.96% of Crossref
members confirmed to preserve >75% of their content in three or more archives
(<https://zenodo.org/records/10782401>). Separately, **Laakso, Matthias & Jahn (2021)** documented
**176 open-access journals that vanished from the web** between 2000 and 2019
(<https://doi.org/10.1002/asi.24460>).

**Measured DOI resolution failure — and the trap inside the measurement.** The substantial published
number is Crossref's own (<https://www.crossref.org/blog/what-do-we-know-about-dois/>, 29 Feb 2024),
from a sample of **5,000 DOIs resolved twice with different clients**:

| Client | Resolved 200 | Failure rate |
| --- | --- | --- |
| Headless browser / server-side script | 3,301 / 5,000 = **66.02%** | **~34%** |
| Headful browser with stealth plugin | 4,852 / 5,000 = **97.04%** | **~3%** |

Crossref's own explanation: *"a large number of scholarly publishers use Digital Rights Management
techniques on their sites that block a crawl of this type."*

**Two conclusions, which must not be conflated.** DOIs really are roughly an order of magnitude more
durable than raw URLs — ~3% failure against 25–38% at ten years. And **the 34%-vs-3% gap is the most
important number in this section for anyone planning a CI link check**, because a CI checker *is* the
headless-script client. Crossref's own instrumentation produced a 31-percentage-point false-positive
rate against its own DOIs. Note also that the 3% figure is Crossref's number about Crossref's own
members; no independent large-scale audit of DOI resolution failure was found.

**Content negotiation means the metadata survives the journal.** `curl -LH "Accept:
application/vnd.citationstyles.csl+json" https://doi.org/{doi}` is served by **Crossref's registry,
not the publisher's server** (docs at <https://citation.doi.org/docs.html> — note that
`citation.crosscite.org` now 301-redirects there, a live example of a documentation URL that moved).
So title, authors, year and journal remain retrievable even if the landing page 404s. **The full text
does not.** Content negotiation preserves the citation, never the content.

**Does everything in this corpus have a DOI?** No, and the gaps are informative. Journal articles:
essentially always. Books: partially — books are ~17% of Crossref records, and Springer/Elsevier
academic books usually have DOIs while trade and self-published coaching books do not. ISBN always
exists for books but **is not resolvable — it is not a URL and has no official resolver.** The two
coaching websites have no DOI and no realistic path to one, and they are simultaneously the
highest-rot-risk and least-identifier-supported entries in the corpus.

**PMIDs and PMCIDs are strong persistent identifiers in their own right.** NLM policy is that PMIDs
**do not change and are never reused**, including after a record is deleted; when duplicates are
merged NLM keeps the earliest record and redirects the removed PMID
(<https://www.nlm.nih.gov/bsd/licensee/medline_maintenance.html>). So a PMID may redirect, but it will
not point at the wrong paper.

**And there is a concrete, recent demonstration of why identifiers beat URLs.** PMC migrated its
primary domain in **October 2024**, from `www.ncbi.nlm.nih.gov/pmc/...` to `pmc.ncbi.nlm.nih.gov/...`
(<https://www.nlm.nih.gov/pubs/techbull/so24/so24_PMC_Website_Updates.html>). Old links 301-redirect,
verified live. A corpus that hard-coded the old form in 2023 is now serving a redirect on every PMC
link; a corpus storing PMCIDs and templating the URL was a one-line change. `studies.ts` already uses
the *new* form, so this particular migration was absorbed — but it was absorbed by hand-editing
URLs, which is the cost the identifier-first approach removes.

### 5.3 The URL templates, verified live

| Identifier | Template |
| --- | --- |
| DOI | `https://doi.org/{doi}` |
| PMID | `https://pubmed.ncbi.nlm.nih.gov/{pmid}/` |
| PMCID | `https://pmc.ncbi.nlm.nih.gov/articles/PMC{id}/` |
| PMCID (legacy) | `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC{id}/` → **301** to the above |

The **PMC ID Converter** (§2.4) accepts **up to 200 IDs per request**, needs no key, and speaks XML,
JSON, HTML and CSV. One batch call backfills DOIs and PMCIDs for the whole corpus, offline, once.

### 5.4 What a small project does about it — and why the obvious answer misfires here

**Archiving: Internet Archive Save Page Now (SPN2)** is free and scriptable.
`POST https://web.archive.org/save`, auth header `Authorization: LOW {accesskey}:{secret}`, keys free
from <https://archive.org/account/s3.php>. Documented limits: **12 concurrent captures authenticated
(6 anonymous), 100,000 captures/day authenticated (4,000 anonymous), max 10 captures per URL per
day**, and an IP-level limit of ~15 submissions/minute with a 5-minute block if exceeded. The
`if_not_archived_within=<timedelta>` parameter is the knob that makes a scheduled job idempotent.

**But the commonly cited availability API is unreliable.** `https://archive.org/wayback/available?url=…`
returned **HTTP 429 "Too Many Requests"** on the very first call from this machine during this
research, and on every retry — with no key documented and no documented limit. It is simply heavily
throttled at the shared-IP level. The **CDX API worked on the first try from the same IP**:
`https://web.archive.org/cdx/search/cdx?url={url}&limit=3&output=json` returns a clean JSON array of
captures. For a small project, **CDX is the reliable read path and `wayback/available` is not.**

**archive.today** has no official submission API, documents an approximate 10–20 MB/day per-IP cap,
and deliberately returns invalid DNS responses to Cloudflare's 1.1.1.1 resolver. It is scriptable only
in the screen-scraping sense and is fragile in CI.

**Perma.cc is not free at this scale.** The free tier is a **one-time trial of 10 links** on
registration — not 10/month. Paid individual tiers are $10/mo for 10 links, $25/mo for 100, $100/mo
for 500. Free unlimited use is restricted to courts and to academic users sponsored by a registrar
library. **A subscription does not transfer.**

**Link checking in CI** is free and works — `lychee` (Rust, Apache-2.0/MIT,
`lycheeverse/lychee-action`), `linkinator`, `markdown-link-check`, `htmltest` all run on a standard
Actions runner. The problem is not cost. It is that **the false-positive rate on this specific corpus
is catastrophic.**

Measured on the actual 16 URLs in `studies.ts`, three ways each:

| URL class | HEAD (bot UA) | GET (bot UA) | GET (Chrome UA) |
| --- | --- | --- | --- |
| `pubmed.ncbi.nlm.nih.gov/*` (10 URLs) | **203** | **203** | **203** |
| `pmc.ncbi.nlm.nih.gov/*` (3 URLs) | 200 | 200 | 200 |
| `link.springer.com/*` | 200 | 200 | 200 |
| `trainingforclimbing.com`, `camp4humanperformance.com` | 200 | 200 | 200 |
| `peerj.com/articles/15464/` | **403** | **403** | **403** |

**Zero of the sixteen URLs are actually dead. Eleven of them return a non-200 status.**

Both non-200 classes are traps, in opposite directions.

**PubMed returns HTTP 203 with a bot interstitial**, consistently, regardless of user agent. The
response carries `Vary: X-NCBI-CAPTCHA, X-GCP-Client-IP, User-Agent, Cookie` and a body containing a
hidden `<div id="cookie-required">` reading "Cookies must be enabled." **203 is inside lychee's
default `--accept` range (`100..=103,200..=299`)**, so lychee reports these as healthy while the
server is serving a cookie wall rather than the article. A checker configured to accept only `200`
flags all ten as broken. **Either configuration is wrong**, and no status-code check can tell the
difference.

**PeerJ returns 403 to automation.** In the corpus measurement above, a Chrome user-agent did not
help; in a separate measurement against a different PeerJ article, a Chrome UA did flip 403 → 200. The
behaviour is Cloudflare-mediated and not deterministic. The one paper in the corpus that is
unambiguously CC-BY (§3.5) is the one whose URL a link checker cannot verify.

This is not idiosyncratic. **lychee issue #1157, "Don't treat sites with 403 status codes as broken
links"** (<https://github.com/lycheeverse/lychee/issues/1157>) lists 40+ major sites that 403 to
lychee, **explicitly including Science, The Lancet and NEJM** — the same class of domain as this
corpus. lychee's own docs state that *"Some websites use bot detection services like Cloudflare Bot
Management to prevent automated tools from accessing their content."* During this research alone,
five hosts returned 403 to an automated fetcher — `harvardlawreview.org`, `papers.ssrn.com`,
`perma.cc`, `doaj.org` and `sciencedirect.com` — and all five are live, healthy sites.

**NCBI's stated position makes the PubMed case worse than a technical annoyance.** NLM says
outright: *"NCBI does not allow scripting against our web pages. If you script, we may restrict your
access"* (<https://support.nlm.nih.gov/kbArticle/?pn=KA-05510>). A CI job hitting
`pubmed.ncbi.nlm.nih.gov/{pmid}/` is scripting against a web page; the 203 interstitial *is* the
enforcement. The sanctioned route for checking that a PubMed record exists is E-utilities or the ID
Converter API — which, notably, is also the route that would have caught the `probe` error in §0.1.

**Two GitHub Actions facts compound this.** `lychee-action` **defaults `fail: true`**, and the
documented scheduled-run pattern pairs it with `peter-evans/create-issue-from-file` gated on a
non-zero exit code — which files a GitHub issue on every transient 403. And in a **public**
repository, **scheduled workflows are automatically disabled after 60 days with no repository
activity** (<https://github.com/orgs/community/discussions/86087>), where "activity" means a push,
release or merged PR — not issue comments. There is no banner and no error; you only discover it by
opening the workflow page. **A scheduled link-check job silently stops running exactly when the repo
goes quiet, which is precisely when link rot is accumulating unobserved.**

### 5.5 The shape of the answer

Restating what was measured rather than what is usually assumed:

- Arbitrary URLs: **~25–50% dead at five years**, depending on corpus. Coaching websites are the
  worst class and the least studied.
- DOIs: **~3% resolution failure** measured by a real browser, **~34%** measured by a script — the
  same DOIs. The durability is real; the *checkability* is not.
- The corpus today: **0 of 16 dead, 11 of 16 non-200.** The link-checking problem here is entirely a
  false-positive problem, not a rot problem.
- The identifiers are already in the data as URL substrings. Ten PMIDs, and DOIs recoverable for
  fourteen of the sixteen studies via free unkeyed APIs.
- The October 2024 PMC domain migration is a worked example of URL-as-identifier costing hand edits
  that ID-as-identifier would not have.

---

## 6. What does not transfer, collected

Stated plainly, because the ticket asked for it explicitly.

| Thing | Why not |
| --- | --- |
| **Crossref Plus** | Paid subscription for production integrations. The free polite pool clears this 16-row corpus in under two seconds. |
| **Perma.cc** | Free tier is a one-time 10-link trial, not recurring. Paid from $10/mo. Free unlimited only for courts and library-sponsored academics. |
| **SciScore** | Hosted commercial SaaS, $19–$399 per batch, publishes no reusable vocabulary. It would grade papers the human is reading anyway. |
| **Hypothes.is** | A multi-service Python web application. Self-hosting needs Docker, pyenv, Node, Yarn — to hold one athlete's ~100 claims. |
| **W3C Web Annotation *Protocol*** | Requires an HTTP annotation server with LDP containers. (The *data model* is a file format and does transfer.) |
| **Nanopublication network** | RSA keypair + ORCID + trusty URIs + a registry network holding <70k documents. The value proposition is third-party verifiability; there is no third party here. |
| **Wikidata as a platform** | Hosted triplestore with a SPARQL endpoint. (The P248/P854 convention and the deprecated rank do transfer.) |
| **archive.today** | No submission API, ~10–20 MB/day per-IP cap, deliberately breaks against Cloudflare DNS. Fragile in CI. |
| **`archive.org/wayback/available`** | Returned 429 on first call and every retry from this machine. Use the CDX API instead. |
| **`citeproc-plus`** | 20.5 MB unpacked, designed around lazy network fetches of style chunks — which for a server-free app just become part of the static deployment. |
| **`@citeproc-rs/wasm`** | 25 MB unpacked with a ~5 MB WASM binary, ~50× citeproc-js gzipped, still v0.2.0 and self-described as work-in-progress. |
| **Scheduled GitHub Actions link checks, as usually configured** | Auto-disabled after 60 days of repo inactivity on public repos, with no notification; and file an issue on every transient 403 under the documented pattern. |

And two things that are *free* but still do not answer the question they appear to:

- **Unpaywall's `is_oa`** is a free-to-read flag. It reported `is_oa: true, license: null` for a paper
  that PMC refuses as `idIsNotOpenAccess`, and reported `cc-by` for a paper that both Crossref and
  PMC call CC BY-NC-ND (§3.4).
- **A JSON Schema over the corpus** validates shape, not truth. All four errors in §0.1 are
  schema-valid records pointing at the wrong paper.

---

## 7. Open questions and things not established

Stated rather than papered over.

1. **No independent audit of DOI resolution failure exists.** The 2–3% figure traces to Crossref's own
   blog and its members-only resolution reports. Credible, but interested.
2. **No published figure for "% of URLs dead at exactly five years".** Every five-year number in §5.1
   is interpolated between published anchors.
3. **No link-rot study covers sports-science or coaching literature**, and none covers the
   coaching-website class of source — which is the corpus's most fragile class.
4. **GRADE's licence could not be verified as open.** No licence statement was found on
   gradeworkinggroup.org; the handbook directs reproduction requests to the editors. SORT/AAFP
   likewise. Only CEBM (CC BY 4.0) and ECO (CC0) are unambiguously reusable.
5. **Mendeley's CSL-JSON export is unverified.** No primary documentation was found confirming a
   user-facing export; secondary sources say it cannot.
6. **CSL-JSON's EDTF string form is documented but not schema-valid.** The description calls it
   "preferred"; the `anyOf` has one branch. No changelog explains the mismatch.
7. **Whether `custom` round-trips through third-party tools is not guaranteed** — `csl-data.json` is
   self-described as "not yet fully normative". Irrelevant for a corpus that never leaves this repo.
8. **The `probe` correction in §0.1 was not applied.** PMID 27765661 → 27663764,
   DOI `10.1016/j.jsams.2016.08.011`. Fixing it is a content change on the rebuild, not research, and
   this document does not touch `studies.ts`.
9. **The PeerJ 403 is non-deterministic.** A Chrome user-agent flipped it to 200 for one article and
   not for another during this session. Cloudflare behaviour varies by IP reputation and time.
10. **Whether a public GitHub repo hosting a private non-monetised app counts as "non-commercial"**
    under CC BY-NC is a legal judgement, not an API call, and is not settled by anything found here.
    GitHub's terms grant other users the right to view and fork public repo contents, which is a
    redistribution the NC clause has to tolerate.

