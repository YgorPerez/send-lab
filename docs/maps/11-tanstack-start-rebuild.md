# Map #11 — Decisions so far

The decision log for [Map: TanStack Start rebuild](https://github.com/YgorPerez/send-lab/issues/11).

**Why it is a file and not the map's body.** A GitHub issue body caps at 65,536 bytes. This log reached
58,681 of them across twenty-two entries, and each new one costs roughly 3,500 — so the map had room for a
single further ticket, and the two entries waiting for it (`Finish login` and `Build week`) could not both
be saved. Trimming entries to fit would have bought one ticket of runway and made the record thinner than
the thing it records, so the log moved here instead. The map keeps the Destination, the Notes, what is not
yet specified, what is out of scope, and a link to this file.

**The convention it serves**, from `docs/agents/issue-tracker.md`: a wayfinder ticket resolves by
commenting the answer, closing, and appending a context pointer here. One entry per resolved ticket, in
landing order, each ending with the branch and commit the work landed at — so a reader can go from a
decision to the code that carries it in one step.

**Entries are append-only in spirit.** An earlier entry that later became wrong is corrected by the entry
that superseded it, not by editing the original: this is a record of what was decided when, and rewriting
it loses the sequence that makes it worth keeping.

---

## The decisions

<!-- one line per closed ticket: gist + link -->

- [What survives the rebuild](https://github.com/YgorPerez/send-lab/issues/12) — **9 of 12 pages** (`metrics`,
  `stats`, `exercises` dropped, along with `metrics[]`/`probeLog[]`/`customExercises` and the three
  exercise-authoring MCP tools). **`/api/v1` dropped entirely**; `/api/state` survives because offline
  needs it. **OAuth kept** (via `@better-auth/oauth-provider`), **MCP kept** on SDK v2 targeting
  `2026-07-28` only, API tokens kept hand-rolled. **Full offline including writes** — new functionality,
  graduated to [13](https://github.com/YgorPerez/send-lab/issues/24). One addition: localized MCP output.
  **Refined 2026-08-16:** `log[]` is dropped as well — the `log` page survives but renders sessions only.
  Two of its three entry kinds die with `metrics[]`, `'rec'` is written nowhere, and the survivor is a
  denormalized copy of `taskDone` that already drifts (nothing removes it on untick). An athlete-written
  training journal was considered and **declined as new scope**.
- [Next.js today](https://github.com/YgorPerez/send-lab/issues/13) — Next **16.3.1** / React 19.2.8 / Tailwind 4.3.3; App
  Router is the only sane greenfield choice, but **RSC's benefits don't apply to a private console** and
  **Server Actions dispatch one at a time per client**; `app.css` ports verbatim; no adapter needed; leave
  `cacheComponents` off. Asset: `research/nextjs-today` @ `8fa4553`.
- [better-auth on Next](https://github.com/YgorPerez/send-lab/issues/14) — cleanest transfer on the map: **zero schema
  drift** across all 34 columns, one `getSession` primitive everywhere (but a DB hit per call, needs React
  `cache()`). The old CSRF bug won't recur. **`@better-auth/oauth-provider` could delete ~470 of the 712
  hand-rolled OAuth lines** — moot if 01 drops OAuth. Asset: `research/better-auth-next` @ `616d2f3`.
- [i18n replacement](https://github.com/YgorPerez/send-lab/issues/15) — **contingent on 06, so it graduated a decision
  ticket ([12](https://github.com/YgorPerez/send-lab/issues/23))**. Both libraries type-check message ids, so the framing was
  wrong; **neither catches a missing pt-BR key**. Paraglide-with-RSC is a dead end the maintainer warns
  against, but the app is client-rendered, so Paraglide survives if rendering stays client-side. Measured
  cost of the alternative: 464 call sites. Asset: `research/i18n-next` @ `a9ea601`.
- [MCP server on Next](https://github.com/YgorPerez/send-lab/issues/16) — **the OAuth server is NOT required for MCP**:
  authorization is OPTIONAL per spec and Claude accepts bearer tokens on every surface. Spec is now
  `2026-07-28` (sessionless, breaking); SDK v2 is `@modelcontextprotocol/server`; today's server is
  already stateless and compliant, but legacy-era-only. Asset: `research/mcp-next` @ `9cfd9b1`.
- [Framework research: TanStack Start](https://github.com/YgorPerez/send-lab/issues/25) — **facts only; the
  choice is [26](https://github.com/YgorPerez/send-lab/issues/26)**. Start has **never shipped 1.0** (RC
  since 2025-09-23, no timeline; two of three `needed-for-start-stable` blockers sit in our path,
  including a `setCookie` bug specific to Node 20.19.2 — *we pin `nodejs20.x`*). better-auth is
  **first-class** (`./tanstack-start`, synchronous `getRequestHeaders`, one composable `beforeLoad`
  choke point the App Router lacks); server routes are plain `Request`→`Response` with **no route-segment
  caching hazards**; `/mcp` mounts trivially. **PWA is the reversal**: `vite-plugin-pwa` silently emits
  nothing in a Start production build (router#4988, open) and Serwist inherits it, while `next@16.3.0`
  shipped first-party service-worker compilation — though Next's Serwist path has its own open production
  bug on Vercel+Turbopack+Node. Start's SPA mode does emit a real **`/_shell.html`**. Vercel works but
  via **beta Nitro**. Paraglide's constraint is **closed by a first-party example**. **~48% of the 4700
  lines of prior research survives; `nextjs-today` is 54% dead.** Asset:
  `research/framework-tanstack-start` @ `48dfcd4`.
- [Framework: Next.js or TanStack Start?](https://github.com/YgorPerez/send-lab/issues/26) —
  **TanStack Start.** The four opt-outs stop being opt-outs. Pre-1.0 accepted **on condition versions
  are pinned exactly and upgrades are deliberate work**; the two `needed-for-start-stable` blockers said
  to be in our path both dissolve (one needs global middleware we already declined, the other is a Node
  20.19.2 bug — **pin Node 22**). PWA priced as a **wash**, with a mandatory service-worker integrity
  gate. **Vercel stays fixed**, beta `nitro` accepted as a loud, reversible deploy-time risk. Decided by:
  first-class better-auth with one composable `beforeLoad` choke point; plain `Request`→`Response`
  server routes with no route-segment caching hazard; `/_shell.html`; a first-party Paraglide example;
  better locale routing. **The one cost incurred:** ADR-0003's accidental protection is gone — typed
  params are available everywhere, so the bilingual guard must now come from **branded identity types**,
  mandatory rather than optional.
- [Rendering architecture](https://github.com/YgorPerez/send-lab/issues/17) — **client-heavy everywhere,
  no exceptions.** One `ssr: false` seam at the root (`shellComponent` + `pendingComponent`,
  `defaultSsr: false`), so the app tree never prerenders and the build emits **`/_shell.html`** — the
  user-independent artefact the PWA precaches. Mutations are **replayable plain HTTP through a shared
  `server/state/*` module** that the sync endpoint and the MCP tools both import; **zero Server
  Actions**. **No middleware** — auth is a per-handler `withAthlete` wrapper composed with
  `assertSameOrigin()`, wrapper coverage enforced as a gate check (also why TanStack Router #5407 cannot
  reach this design). **Localized rendering is client-side and locale does not enter the URL** — decided
  on the PWA requirement, since a locale in the URL forces either two shells to keep in sync or a
  cold-start redirect; `prefs.locale` is the source of truth (a schema change) with a localStorage boot
  mirror, and Paraglide's strategy is unchanged from today. **Question 5 — what holds the interactive
  state — moved** to [the state model](https://github.com/YgorPerez/send-lab/issues/18).
- [Research: is TanStack DB the right local-first substrate?](https://github.com/YgorPerez/send-lab/issues/28)
  — **facts only; the choice is [18](https://github.com/YgorPerez/send-lab/issues/18) and
  [24](https://github.com/YgorPerez/send-lab/issues/24).** It owns **two of #24's seven items** outright
  (source-of-truth-while-running, most of the outbox), the local store's mechanism but not its policy,
  and **none of the merge strategy — which #24 itself calls the crux**. There is no merge engine at all:
  not CRDT, not per-field LWW, not an op log, but a server-authoritative optimistic overlay. So the
  largest new build is **redistributed, not deleted**. BETA, 17 months old, **1.0 target missed by nine
  months and never renewed**, no named production user, ~one breaking change per minor line for fourteen
  months, and the maintainers' own RFC #1659 carries two `it.fails` data-loss defects in the SQLite
  layer — *"Offline writes die on reload."* Level 3's WASM is **500–775 KB gzipped against ~28 KB of
  account state**; level 2 (`localStorage`) costs zero extra bytes. Two findings cut in its favour: its
  online detector is already **foreground-only** by construction, and its lack of SSR support costs us
  nothing. iOS eviction is **unchanged** by adoption — OPFS is inside WebKit's 7-day policy too. Asset:
  `research/tanstack-db` @ `a20ad95`.
- [Does the single-JSON-document state model survive?](https://github.com/YgorPerez/send-lab/issues/18) —
  **No. The account document explodes into collections.** TanStack DB is adopted despite the recorded
  risks; its collections are keyed row sets with no document primitive, so a one-row shape would leave the
  engine inert and preserve today's whole-document LWW. **`/api/state` grows a per-key write path.** Three
  parts: account data on **level 2** (`localStorageCollectionOptions`, ~28 KB of state versus level 3's
  500–775 KB of WASM; the spike confirmed level 2 is a separate code path from RFC #1659's defects, 45
  tests, no `it.fails`); offline writes via **`@tanstack/offline-transactions`**, because level 2 writes
  to storage *after* the network call and so loses a mutation made in a gym basement — a passing test
  asserts it, and the maintainers deferred fixing it; ephemeral state (timer, two drafts) on
  **`use-local-storage-state`** at 680 B, with `storageSync: false` on the timer. **Not settled here: the
  merge strategy** — TanStack DB has no merge engine, only a server-authoritative optimistic overlay, so
  it changes write *granularity*, not merge *policy*. That stays the crux of
  [24](https://github.com/YgorPerez/send-lab/issues/24). Asset: `research/local-state-options` @ `0b16820`.
- [Offline-first architecture](https://github.com/YgorPerez/send-lab/issues/24) — **local-first reads,
  outbox writes, last-write-wins per _row_ key.** The persistence rule is deliberately rewritten: Turso
  stays canonical, but **the client now holds a complete replica of account data** in `localStorage`;
  ephemeral UI stays local-only and never syncs. The merge rule is safe because collections are keyed by
  entry id — two devices appending produce two keys, so **append-only history cannot lose an entry**; the
  genuine conflicts reduce to tick-vs-untick, the same day's plan edited twice, and the same `prefs`
  field, all latest-wins with one side silently discarded (accepted knowingly). Outbox is
  **foreground-only** — the only shape iOS permits — with a **dead-letter**, because FIFO replay means one
  permanently-rejected write would otherwise stall every session behind it, silently. **All pages work
  offline except `login`**; `settings` splits (prefs offline, account actions online). Auth: **trust the
  local store offline, verify online; expiry never clears the store or the queue** — only an explicit
  online sign-out after the queue drains. Five named assertions go to
  [20](https://github.com/YgorPerez/send-lab/issues/20), one of which must run in `pt-BR`.

- [Quality gates for the new stack](https://github.com/YgorPerez/send-lab/issues/20) — **seven local
  steps, a build-time plugin, and CI as the actual gate.** `verify` = `lint` (biome) -> `lint:hooks`
  (eslint, **`rules-of-hooks` only**) -> `check` (paraglide -> route-tree gen -> `tsgo`) -> `check:env`
  -> `doctor` (**`react-doctor --no-telemetry`**) -> `fallow dead-code` -> `test` (**Vitest**, jsdom).
  **`tsconfig.gate.json` is deleted** — it was never a second strictness level, only a scope hack because
  `tsgo` could not parse `.svelte`, and `.tsx` is plain TypeScript. `react-doctor`'s **diff-scoped CI
  mode replaces `.svelte-doctor/baseline.json`** with nothing hand-maintained — but it only runs in CI,
  which is why the gate moved there. **Service-worker integrity is a Vite `closeBundle` hook, not a
  `verify` step** (`verify` never builds, and a plugin cannot be bypassed the way `postbuild` can): worker
  exists, clears a byte floor, manifest parses non-empty, **and contains `/_shell.html`** — the assertion
  that catches a populated manifest which still breaks cold start. **Branding is key-side only**
  (`DayKey`, `WeekId`, `ExerciseId`, `TaskKey`, `AthleteId`); a literal union was rejected because
  `'Mon'` is a member of its own union, so the bug stays invisible in English. **`withAthlete` is made
  unsayable, not scanned for** — `createAuthedRoute`/`createPublicRoute`/`createTokenRoute` are the only
  route factories, and the test asserts the public set *matches an expected list* (five or six entries:
  OAuth discovery is public by spec, `/mcp` is bearer). Env via **`@t3-oss/env-core` + Zod**, whose
  explicit `runtimeEnv` is the defence against a dynamic lookup escaping Vite's build-time inlining.
  #24's five offline assertions land in jsdom except "survives a reload", which needs the separate
  **`test:browser`** suite (Vitest browser mode, Playwright provider) — jsdom has no service worker at
  all. **Middleware stays declined, for a newly recorded reason: no page in this app is auth-blocked, it
  is usable without an account.**

- [Scaffold the branch](https://github.com/YgorPerez/send-lab/issues/21) — **the rebuild has a running
  app.** TanStack Start `1.168.46` / Router `1.170.29` / React `19.2.8` / Nitro `3.0.260610-beta` on
  **`development`** (not a side branch — the athlete's call; `main` still serves production), deploying
  to a preview that **round-trips to Turso**. ADR 0006 realised: `spa.enabled` prerenders a root-only
  `/_shell.html` verified to contain nothing account-specific, and `withAthlete()` replaces middleware.
  This ticket's body predated ADR 0005, so its Next.js phrasing was **translated, not re-decided** —
  and two of its concrete corrections turned out to be Next-only and are now moot: the
  `@tailwindcss/vite` → postcss swap (Start *is* Vite) and Paraglide being Turbopack-blocked (it is
  not). #20's gate is implemented and green, including three checks that guard silent failures —
  locale parity across 533 keys, the auth wrapper, and a service worker asserted post-build. **#20's
  two open questions are answered: `tsgo` handles `.tsx` cleanly, and `react-doctor` runs alongside
  TS 7.** Tests moved `node:test` → Vitest, 8 files / 67 tests, one import changed. **Four things
  fought back, all deploy-time and all recorded**: the `server: { handlers }` type augmentation needs
  an ambient reference; the build must run with **no secrets**, because prerendering the shell executes
  the server bundle; **without Nitro the deploy is green and 404s everything**; and constructing the DB
  client at module scope killed the function at **cold start** (every route 500s, including ones that
  don't exist). Hence `getAuth()` and `db` are both lazy. Two pre-existing defects fixed in passing:
  **#45's reduced-motion rule reached neither `::view-transition-*` nor WAAPI**, and the webfonts were
  named but never loaded. The Vercel project was still on the **`sveltekit-1` preset**, Preview had
  **no environment variables at all**, and Node was `24.x` by inheritance — all three corrected. Domain
  logic that reads the Svelte runes store stayed on `main` rather than pre-empting ADR 0007/0008;
  `docs/rebuild-reference.md` maps every file, and records the two standing `fallow` exceptions to
  narrow as pages land.

- [Entity types: the glossary, the brands, and the culled shapes](https://github.com/YgorPerez/send-lab/issues/55)
  — **the entities are bare glossary nouns, and branded on what they key.** Eight of eleven declarations in
  `types.ts` were at odds with `CONTEXT.md`, three using an explicit `_Avoid_` word: `WorkoutEntry`→`Session`,
  `Assessment`→`Baseline`, `ProgramTarget`→`Override`, `ProgramDayCfg`→`WeekdayTemplate`,
  `DeepEntry`→`SelfCheck`, plus `Phase` and `Rehab`. Three take a `Logged` prefix because the bare noun is
  held elsewhere — `LoggedSet` (JavaScript's `Set`), `LoggedExercise` (the library movement),
  `LoggedReadinessCheck` (the ADR-0010 component). **`MetricEntry` and `LogEntry` deleted** — Marker is
  *Leaving* (bodyweight survives as `BodyweightReading`, ADR 0009's divisor) and `log[]` was dropped by
  #12, **which removes the Log screen's Activity section** so that page renders sessions only, as #12
  specified. **No entity stores a formatted date**: five did, two paths compared it against a fresh
  `today()` — unmatchable across a language switch — and nothing wrote the field, so it went along with
  `today()` and `isTodayEntry()`. **Two live defects fell out of the renaming, neither found by reading.**
  `programGen.ts` read `d.k` where a day type belongs, so `d.k === REST_DAY_TYPE` could never be true and
  every customized day was written with a weekday key as its day type — the legacy shape `migrate.ts`
  repairs, still being freshly generated; `rehab.ts` had it right. And `Program.targets`'s composite key was
  concatenated by hand at three sites, now **`OverrideKey` / `overrideKey(weekday, exercise)`**, distinct
  from `TaskKey` because an override carries no week. `template` and `targets` are branded Records, so
  **plain-string indexing is now a compile error.** `CONTEXT.md` **lost a sentence** — Block's "its length
  is the sum of its phases" is false, since `phaseForWeek` holds the last phase past the defined span, and a
  behavioural claim does not belong in a glossary — and **gained Weekday template and Logged exercise**.
  Flagged not fixed: `migrate.ts` may be wholly dead and now writes a field nobody reads, and
  `LoggedExercise.name` stores a localized label needing the unported resolver. `development` @ `dd19cb1`.

- [Port the prescription resolver](https://github.com/YgorPerez/send-lab/issues/69)
  — **`plan.ts`'s pure half is `src/lib/prescription.ts`, and it takes state as an argument.** 700 lines was
  the largest domain module on `main` and had no counterpart here; the resolving half (fifteen functions) is
  ported, the mutations stay for #57, and `taskKey` is not ported because `ids.ts` brands it. Not named
  `plan.ts`: the glossary puts "plan" on Program's avoid-list. Every function was a reader of the runes store,
  which is why none could be tested without rendering; they are now pure functions of `(content, state, …)`
  over one named **`ResolverState`** — the interface #56's collections have to satisfy — whose sparse records
  are `Partial`, since `noUncheckedIndexedAccess` is off and the whole resolver is fallback chains over
  misses. `Program.template`/`targets` became `Partial` for the same reason, which found `applyEditDay` able
  to write a `WeekdayTemplate` with no `dayType`. **The open layering decision is settled as ADR 0013**: a
  closed set shared across the content/app boundary is declared **once, in `content/types.ts`**, and
  `lib/types.ts` re-exports it — never an import upward (it type-checks, which is the problem), never twice.
  `FlagArea`/`RehabArea` are gone; `BodyArea` and `RehabStage` are the one declaration, which **deleted a cast
  between two identical unions** in `index.tsx` and, by typing `Content.selfChecks` on it, found that **there
  is no wrist self-check** while the comment claimed all four areas. **`LoggedExercise.name` is gone, closing
  ADR 0012's last violation** — replaced by `variant`, an index, deliberately not a re-resolution of the
  current swap, because swapping a variant must not relabel the sessions that used the old one.
  **Three defects the port exposed, none of which looked like one.** The fixtures filtered `id !== 'restSec'`
  — a set *field* — where they meant the `rest` placeholder, and `rest` is a real library entry, so every
  Sunday resolved as trainable work and **five rest days were logged as sessions**, inflating the streak, the
  session count and the weekly load. The fixtures' prescriptions **were** the library defaults
  (`variantIndex: 0`, `prescription: ex.variants[0]`, hardcoded) — which is exactly why a 700-line gap stayed
  invisible across three "built" screens; they now resolve through `effectiveVariant` and expose
  `resolverState`. And `prefillLoadKg` counted **prefilled-but-untrained sets**, so one prefill seeded the
  next and the load climbed with nobody lifting anything, and it ignored the variant, so a swap prefilled from
  different work; its marker table had no data source left (Marker is *Leaving*) and now reads completed sets
  of the same variant from the athlete's own history. `SlotKey` minted for the `w1-Thu` composite;
  `format.ts` gains `weekdayLabel`, `exerciseLabel`, `regionLabel`, `qualityLabel` — the last two had twelve
  already-translated messages sitting orphaned. **181 tests, was 120**, and the browser tier ran for the first
  time in three commits: contrast over 1008 elements × 4 routes × 2 locales, motion with its control run,
  both green. Flagged not fixed: **React #418 hydration errors** on `/` and pt-BR `/log`/`/login`/`/train`,
  confirmed pre-existing by rebuilding the baseline, and wanting their own ticket; `Program.phases` is read by
  `phaseForWeek` but consumed by no screen yet (the prototype scenario has no athlete-authored phases and
  adding them would move all four #42 prototypes' numbers); `migrate.ts` still writes `dayKey`.
  `development` @ `183d06d`.

- [Rename the day-named slot collections, and Program.targets](https://github.com/YgorPerez/send-lab/issues/72)
  — **all four renamed, all three layers at once, and `migrate.ts` deleted.** `dayPlan`→`slotDayType`,
  `dayExercises`→`slotExercises`, `daySwaps`→`taskSwaps`, `Program.targets`→`Program.overrides`, moving the
  TypeScript field, the `localStorage` key segment and the `record_row.collection` value on the wire
  together, per ADR 0014. **Verified free rather than assumed free**: `record_row` on production returns
  zero rows across every collection, so no back-fill, no read-both-keys shim, no offline-across-the-change
  plan — the ticket's whole argument for doing it before #58, and it held. `targets` was the worst of the
  four (the values are `Override` objects, and *target* is what the glossary reserves for what a
  prescription resolves to *after* overrides apply), so the rename carried to `programOverride`,
  `applySetOverride` and `OVERRIDE_FIELDS`. **`migrate.ts` deleted, not rewritten** — it upgraded *legacy*
  documents that *Out of scope* guarantees never arrive, and nothing in `src/` imported it; this
  discharges the domain-doc carry-over item that asked for a ruling on it. It was **not** what blocked
  `unused-files`: the rule still reports 11 files after the deletion, of which `store/seed.ts` and
  `scripts/backfill-tokens.ts` are not pending ports at all, so it stays off with both counts re-measured
  (11 files, 45 exports). `CONTEXT.md` unchanged, as the ticket predicted. `development` @ `be56310`.

- **Two follow-ons landed off-ticket, both flagged by #69 and neither worth a ticket of its own.**
  **ADR 0016 — a day type is not a weekday** (`development` @ `7e2847b`). #72 found `resolveDay` and
  `applyEditDay` saying `day` for a day type and a weekday template and declined them as "that family's
  rename"; the real reason the rename kept being deferred is that **no name worked**, because one `Day`
  record carried the protocol *and* `k`/`label`, and `content.days` was searched by both keys for two
  different jobs. Split into `DayType` + `BuiltInWeekday`, `content.days` → `content.dayTypes` +
  `content.builtInWeek`; `CONTEXT.md` gains **Built-in week**, a term that was in the code and in no
  glossary. What hid it is that the built-in week is 1:1 — seven day types, seven weekdays, one array, in
  order — so every lookup returned the right answer: the same shape as the trap at the top of `CONTEXT.md`,
  with the two *sets* lining up instead of the two *strings*. It had already bitten once at #55. No storage
  change: nothing persisted a `Day`. Two things deliberately left — `BuiltInWeekday.k` stays `string`
  because narrowing it means moving the weekday key set down into `content/types.ts`, which is ADR 0013's
  own prescription and a decision of its own; and ADR 0014's rename is now unblocked but not taken.
  It also made a live approximation visible: **a `Session` records no day type at all**, so the Log row
  resolves one from the built-in week and will show the built-in day type once the athlete edits a weekday's.
  **[#70](https://github.com/YgorPerez/send-lab/issues/70) fixed and gated** (`development` @ `35ce1aa`).
  One bug reported two ways, and it is ADR 0006's own shape: the shell prerenders with no `window`, so it
  bakes `en-US` and an empty Outlet, while the client resolves locale from `localStorage` synchronously and
  fills the Outlet as soon as the route module is ready — either can beat React to the comparison. The
  render that hydrates now matches the shell on purpose, with the truth one render later. **`pnpm
  check:hydration` is a new browser-tier gate**, the third beside `check:contrast` and `check:motion`,
  carrying three control assertions because *"no hydration error was logged"* is equally true of a page that
  never loaded, never hydrated, or a console channel that was never wired. Verified by reverting the fix and
  rebuilding rather than by reasoning; element counts identical either way (548). One recorded limit: the
  `en-US /` variant is a race, caught about one run in three, while the whole pt-BR class fails every run.

- [i18n: locale in the URL, locale as account data, and the key-parity gate](https://github.com/YgorPerez/send-lab/issues/23)
  — **closed as redistributed, not worked**, per this map's own standing instruction once
  [#56](https://github.com/YgorPerez/send-lab/issues/56) and [#57](https://github.com/YgorPerez/send-lab/issues/57)
  landed. All four items verified rather than taken on trust: the parity gate is green (530 message + 194
  content + 6 fixture keys), the resolution order is implemented in `store/locale.ts`, `NO_PREFS` declares
  `locale: null`, and `getContent(locale)` is explicit at all **three** call sites — not the 43 this map
  inherited from the SvelteKit app. Locale-in-the-URL was decided against by ADR 0006 on the PWA
  requirement. One consequence surfaced later and is this ticket's own subject matter: locale resolving
  client-side is why every pt-BR route threw a hydration mismatch until #70.

- [The outbox and the dead-letter](https://github.com/YgorPerez/send-lab/issues/58) — **unsynced work now
  outlives the tab, and the glossary changed the shape rather than only the names.** `sync.ts` held its
  unsent writes in memory, so a reload while offline lost *the fact that a row had not been sent* even
  though the row survived inside its collection. They now live in `store/unsynced.ts` under
  `sendlab:<account>:unsynced`, and a sync that finds work there sends immediately — nothing else would,
  since `push` is what arms the debounce. **`outbox` is on **Unsynced work**'s `_Avoid_` list**, along with
  *pending* and *queued*, which the ticket title said twice and `sync.ts` used throughout; ADR 0014 settles
  that, and #72 had just priced what skipping it costs. The same glossary entry then decided the structure:
  *"work that can never be sent is unsynced work in its final state, not a separate thing"*, so there is
  **no dead-letter store beside a queue** — one sequence, and a refusal is a field on an entry. It leaves
  the replay (so FIFO cannot stall behind a permanently-refused row) and stays **counted** (so an indicator
  cannot tell the athlete their training is safe when it never will be). **Foreground-only was re-taken,
  not inherited**: #24 chose it as "the only shape iOS permits", that premise died with the Android
  measurement, and the athlete was asked again — it stands on one implementation living beside the data it
  guards, making a basement write a *delay* rather than a loss now that the sequence is durable. Written
  test-first and then attacked: eight mutations, each caught by exactly the test that names it, and one of
  them **corrected the reasoning** — the divergence assertion survives a broken `holds` guard, because
  what saves it there is absence-is-not-deletion. **Four of #24's five assertions land**, the fifth in
  `pt-BR`. **Flagged not delivered:** #24's "survives a *real* reload" needs a service worker, a live
  server and an authenticated account, and this repo's browser tier serves the built client statically with
  no backend — handed to [PWA shell](https://github.com/YgorPerez/send-lab/issues/27), which owns the
  worker. 293 tests, was 271. `development` @ `c7440f0`.

- [Ephemeral state onto use-local-storage-state](https://github.com/YgorPerez/send-lab/issues/59)
  — **the timer and the two drafts survive a reload, and one scope rule holds all three.**
  `use-local-storage-state` 20.0.0 pinned; ADR 0008's line holds throughout — none of it is account data,
  none of it syncs. **The third store did not exist**: #18 named the timer, the Train draft and the
  assessment draft, the assessment page is unbuilt (#64), and the *Train* draft had never been written, so
  a reload mid-session threw away every set the athlete had logged — not rare on Android, where
  pull-to-refresh fires a real reload (#54). All three had the same bug waiting, so it is written once:
  each store is only meaningful while the thing it belongs to is still on screen (a **day**, a **slot**, a
  **protocol**), and `inScope` in `lib/ephemeral.ts` is deliberately dull because every interesting version
  is wrong — the scope decides and never the value, `===` not `==`, and a value with no scope is refused.
  That is the bug this file had already carried once, in #55's localized-date branch. **The versioning
  scheme is `sendlab:<name>:v<n>`** — version last and per key, closing `react-doctor`'s
  `client-localstorage-no-version` — and it earns its keep at once, because the session draft stores the
  *resolved* working copy and `:v1` is what turns a future `PrescribedTask` change into an ignored draft
  rather than a crashed screen. **The timer restores paused, never running**: wall-clock time passed and
  nothing on the device knows how much, so the tap to resume is the athlete's correction to make;
  `storageSync: false` there and only there. Verified in a real browser, not only jsdom. **Four review
  findings fixed**, two of which the change itself created: `SEGMENTS` and the protocol field list were
  hand-written second copies of their own types and are now derived from them (adding a field breaks twelve
  sites, measured); and `protocolKey` was promoted by this very change from a React remount key to a
  *persisted identity compared with `===`*, so it is now branded `ProtocolKey` in `ids.ts` — ADR 0003's
  case exactly. **Flagged not fixed:** the ephemeral keys are **not account-scoped**, unlike the
  collections (#56) and unsynced work (#58), so two athletes sharing one device mid-day would share a
  draft; cheap to add, recorded where someone would look. 312 tests, was 293. `development` @ `12a7c80`.
- [Empty states](https://github.com/YgorPerez/send-lab/issues/61) — **an empty state is copy, not
  furniture**: `Empty` is a `Bare`, one line of localized `Prose`, and the one affordance that fills it,
  never a `card` and never an empty `RowGroup`. The finding underneath it is bigger than the furniture:
  `computeReadiness` **scores each wellness question's fallback**, so an empty check produced a score near
  80, a verdict and work held off the plan — from nothing, and indistinguishable from a full check. Today
  gates the read, the held work, today's mark and every baseline comparison on `hasWellnessAnswer` — one of
  the *five wellness* questions, not any question, because answering "how much time do you have" alone
  unlocked a score made entirely of fallbacks. **Zero is honest** (`0 · 0`, `0/12 sets` stay), and **an
  absence is not always an empty state** — a rest day is the answer the athlete opened the app for and
  keeps its line in the plan. Gated against the deployed preview. `development` @ `8013e59`.
- [Build settings](https://github.com/YgorPerez/send-lab/issues/62) — the fourth page, first of the unbuilt
  five and deliberately the cheap one: it yielded `Switch` and `AlertDialog`, both Base UI, for the heavier
  pages to compose against. **#24's split is drawn on the page** — preferences save locally and sync, while
  sign-out and the API token need the server and say so (a warn chip, one line, controls dropping their
  fill); sign-out flushes first and is **held with the reason on screen** if anything is unsent. **The
  one-primary ration held by moving the primary into the dialog**: every button on a settings page is
  `quiet`, and the one `primary` is the confirm guarding token regeneration. `store/locale.ts` became an
  external store so a route three levels down can switch the locale with no prop path. **Keyed on the
  store's active account, not the session** — offline the session reports nobody, and the page must not
  tell a signed-in athlete in a basement that they are signed out. Four review findings remain, filed as
  [#82](https://github.com/YgorPerez/send-lab/issues/82); one is real — a permanently refused write holds
  sign-out **forever**, under copy promising it will be sent. `development` @ `3144435`.
- [Build welcome](https://github.com/YgorPerez/send-lab/issues/64) — four steps named for what each
  *decides*, then the generated program offered before it is stored. **A step is a screen, so the advance
  is its `primary`** — the ration's hardest case, owned once by `ui/Stepper.tsx` rather than four times.
  The rule the page added is [ADR 0019](https://github.com/YgorPerez/send-lab/blob/development/docs/adr/0019-an-intake-question-has-no-default.md),
  **an intake question has no default**: the SvelteKit form opened with a goal, a focus, a level, four days
  and all four pieces of equipment selected, and `niggle`/`synovitis` at `false` — which is not "no
  niggle", it is *nobody asked*, and a niggle caps finger RPE at 8 and softens every phase. #61's finding
  pointed at input instead of output. **The proposal reads the generated `Program`, not the answers** —
  gear rests out a weekday it cannot support, so a four-day answer showed two training days, where the
  SvelteKit proposal showed four. **Skippable and resumable, with no gate**: a gate over account data
  bounces a returning athlete offline, so the whole entry path is one line on Today under the plan it
  describes. New `useRecordSettled()`, because `record.baseline === null` means both "no baseline" and
  "`/api/state` has not answered", and reading the second as the first offers a redo that overwrites a real
  one. **The baseline draft is the first ephemeral store scoped to the account**, which discharges the
  "flagged not fixed" item #59 left above. A domain pass followed: **`Baseline` was described as a "one-off
  intake" and a retake is a supported path**, so `Intake` is now its own term alongside `Equipment`,
  `Niggle` and `Synovitis`, `Draft`'s three-scope rule is rewritten, and **`onboarding` is banned
  outright**. Cost **≈3 × `train` against ≈1.5 costed** — *a page that writes brings a store module and a
  resolver with it*, and `week` and `program` both write. Gated against the deployed preview.
  `development` @ `cd1e8dc`.
- [Finish login](https://github.com/YgorPerez/send-lab/issues/66) — the last of the nine page tickets and
  the cheapest, yielding no primitives and composing entirely from what #53 built. It replaces the
  scaffold's proof of life: a form and a debug readout of `stateUpdatedAt`. **A destination, never a
  gate** — the copy says the app works without an account because it does, `AppShell` keeps its three tabs
  here like anywhere else, and there is therefore nothing to "continue without an account" *from*; the four
  `guest_*` keys are gone, one of which promised a guest's data would follow them into a new account, which
  this rebuild does not do. **Most of the ticket is what expiry did not delete.** #24 decided expiry clears
  neither the local store nor the queue — only an explicit online sign-out, after the queue drains — so an
  athlete arriving here still holds every set they logged while looking at an app that appears empty,
  because the root points the store at the signed-out namespace the moment a session resolves to absent.
  The session cannot tell that athlete from a first run: it is absent for both. `heldAccounts()` can, by
  reading the `sendlab:<account>:<collection>` keys, and **offline is said *as well as* that, not instead
  of it** — offline is a fact about the form, who is reading is a fact about the device, and letting the
  first suppress the second dropped the reassurance in the state that most needs it. **Two failures are
  opposite instructions**, split in `classifyAuthFailure`: anything the server answered returns an `error`,
  a request that never landed throws (better-auth's client does not set better-fetch's `catchAllError`),
  and a `5xx` is a *third* case rather than the second, because `unreachable` promises nothing was sent and
  a sign-up that 500s after the row is written makes that false. **Sign-out is not offered here**: it lives
  on Settings where it flushes first and is held if anything is unsent, and a second one without that hold
  is a one-tap path to losing training. `/api/me` went with the readout it fed — its only caller, and an
  authenticated endpoint nobody calls is not a proof of life. A domain pass followed, in ADR 0014's second
  direction: **`session` was doing two jobs**, told about ten times in login's prose in the sense that is
  *not* `CONTEXT.md`'s "the training actually done in one slot on one calendar date", next door to a
  `sessionDraft` that means the training one — the Segment-vs-Phase overload again, and the glossary had
  simply never named the second concept. It does now: **Sign-in**, the standing proof that a device is
  acting as an account, which lapses on its own and which a **sign-out** ends deliberately, with `Session`
  gaining the cross-reference the way `Segment` carries "never a phase". `first-run` went too — *first run*
  is on **Intake**'s `_Avoid_` list and sat one button from the control that opens an intake, while its
  partner *returning* was already a rehab stage — and **both halves claimed more than the app knows**:
  they describe a *person* where `heldAccounts()` answers about a *device*, so the pair is
  `has-record` / `no-record` and the copy says "the account's own record comes back" rather than promising
  the reader their own. No ADR, since 0014 already binds the direction; its audit list gains the rename as
  its first entry caught *before* shipping. Cost **≈1 × `log`, costed small — the overrun is copy.**
  Gated at both widths in both locales against the built app; **the deployed-preview run this ticket asks
  for is still owed**. `development` @ `b936f35`.
- [Settings: a refused write holds sign-out forever](https://github.com/YgorPerez/send-lab/issues/82) — the
  four findings the Settings review left open, and the first is the one that mattered. `SignedIn.leave()`
  flushed and then held the sign-out while `sync.unsynced() > 0`, but that count is `work.size()`,
  **refusals included** — and a refusal is unsynced work in its *final* state, so no flush can ever bring
  it down. One write the server declined, which arrives as a **200** and has no other symptom, and the
  athlete **could never sign out on that device again**, under copy promising the sign-out would be sent.
  The gate moves to `RecordSync.sendable()`, the same partition `flush` already sends and the half a flush
  can still empty, and the refusals get **said instead of waited for** — `set_refused_note`, which is a
  different claim from `set_unsynced_holds_signout` because "waits until it has been sent" is never true
  of a refused write. Said whether or not the athlete tries to leave, and therefore **live**: the first
  pass read the count once at mount on the reasoning that `leave()` was the only flush this screen causes,
  which was wrong — the debounce fires 250ms after any write including the units and language switches on
  this very page, the `online` listener fires on reconnect, and a fresh sync replays what the last tab
  left behind, so a refusal lands while Settings sits open and untouched. `RecordSync.subscribe` reports a
  settle and `useRefusedWork` reads it through `useSyncExternalStore`, the shape `record.ts` already uses,
  as a **boolean and not the list**, because `refused()` builds a new array per call and would re-render
  forever. Three smaller ones, all in shipped code: a **dismissed** permission prompt resolves `'default'`
  and was reported as a browser block, sending the athlete to site settings to fix nothing, so `'default'`
  now says nothing at all; `ApiToken.regenerate()` closed its confirm dialog on the success path only, so
  a failure rendered its one piece of feedback *under* the backdrop, now closed in `finally`; and
  `useRef(fromAccount)` in `store/locale.ts` seeded the guard from the first render's value, so a first
  render that yielded the prefs row would seed it with the very value the effect exists to apply and the
  account's locale would never reach a new device — it works today only because `useLiveQuery().data`
  happens to be `undefined` on that render, which is exactly the library behaviour the fix stops depending
  on. **Only the first has a test**, and that is a limit rather than an oversight: the other three are
  component branches this suite cannot reach, since it renders through `renderToString`, which runs no
  effects and has no events. This entry supersedes the `Build settings` line above recording these four as
  outstanding. `development` @ `c94cc77`.
- [Build week](https://github.com/YgorPerez/send-lab/issues/63) — the fifth page, drawn first as four
  variants under [#60](https://github.com/YgorPerez/send-lab/issues/60) because it was the one page with no
  prototype at any fidelity. The athlete picked **C's day and B's week**, and the splice is what shipped:
  **a grid selects and a panel shows**. The two halves answer different questions and one control cannot do
  both — a strip of seven 44px targets says *how a day stands* and has nowhere to put *how much is left in
  it*, which is what the page gets opened for. Two colour findings came out of measuring rather than
  drawing, and both are now in the vocabulary's measurement rules. **One cell carries one colour system**:
  with the day type's accent in the dot, `Sáb` (performance, `--flag`) came out the same red as `Ter`
  (missed, also `--flag`) and the week could not tell "still to come" from "you missed it". And **a
  colour's contrast is a property of the pair, not of the palette** — `--flag` at 10px measures **4.34:1 on
  `--panel-2`** and clears the floor on `--panel`, so a token moved onto an inset surface has to be
  re-measured there; `check:contrast` only failed once the fixture grew a `missed` slot. The build added a
  third: **`aria-label` replaces a control's content rather than adding to it**, so a labelled grid cell
  said *less* to a screen reader than an unlabelled one. `screens/week.ts` carries the `WeekdayKey` and the
  localized label as two fields and matches only on the key, asserted by resolving the same record in
  pt-BR — in en-US that test passes either way, which is the whole point. **Five slot states, not three**,
  because `missed` and `ahead` are both "scheduled and not trained"; a fresh account reads neither, since
  there is no block start date to say the athlete had the chance (ADR-0001 records the same absence), so
  the proxy is whether the record holds any evidence of training at all. Cost **≈0.85 × `train`, as
  costed** — the first page in a while to come in under, because it reads and never writes: ADR-0001's "the
  Week tab's tick writes it" is **not built**. Two things outlived the ticket. `pnpm check:overflow` is now
  a **fourth permanent browser check** — `scrollWidth` against the viewport on every route in both locales,
  with a page that rendered too little failing as *unmeasured* rather than passing as narrow, which is #52's
  "partly green-because-empty" turned into a gate. And `pnpm routes` is **idempotent**: `tsr generate`
  stripped the Start type registration from `routeTree.gen.ts` while `pnpm build` emitted it, and since
  `pnpm verify` runs the stripping one, a file committed after a green verify shipped without it — losing
  the router's type inside every `@tanstack/react-start` API with nothing going red. It had already cost
  two commits. A check could not fix it (verify is what strips), so generation restores the block instead,
  with `tests/routeRegistration.test.ts` behind it. The four variants stay as a primary source on
  [`proto/week-slot-grid`](https://github.com/YgorPerez/send-lab/tree/proto/week-slot-grid) @ `19b42e3`,
  out of `development` and never merged. Gated locally at both viewports in both locales; **the deployed-preview
  run this ticket asks for is still owed**, which is why #63 stays open. `development` @ `d597c92`.
