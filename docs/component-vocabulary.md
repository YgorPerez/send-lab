# The component vocabulary

What the nine page tickets compose from, and how to write one. Settled by
[#53](https://github.com/YgorPerez/send-lab/issues/53), re-cutting
[Direction A](https://github.com/YgorPerez/send-lab/issues/47) after the athlete
picked it on [#51](https://github.com/YgorPerez/send-lab/issues/51).

The decisions behind it are [ADR 0010](adr/0010-a-component-is-a-primitive-a-domain-piece-or-page-composition.md)
(the three tiers) and [ADR 0011](adr/0011-reduced-motion-means-everything-finishes-in-one-frame.md)
(what reduced motion means). This file is the reference: the list, the idiom, the
rules, and the estimate.

---

## Where a thing goes

**The test is whether it owns a decision or only an arrangement.** Not whether it
is reused, and not whether it is long.

| Tier | Lives in | Test | Example |
|---|---|---|---|
| Primitive | `src/components/ui/` | Its props name nothing from the training domain | `Section`, `card`, `Picker` |
| Domain piece | `src/components/` | Names the domain **and** owns a decision | `Timer`, `SetRows`, `TaskCard` |
| Page composition | `src/routes/*.tsx` | Used once, arranges primitives | `PlanCard`, `WatchOuts` |

Promotion is a real event with a reason: a second screen needs it, or it grew a
decision. Demotion is allowed and cheaper than it looks.

---

## The primitives

Domain-blind, so any page can use them. Five are `tailwind-variants` recipes
rather than components, because the same button has to be able to be a `<label>`,
an `<input>`, an `<a>` and a `<Dialog.Close>` — a component that owns its element
cannot do that without an `asChild` hatch nobody remembers to reach for.

### Recipes — `ui/variants.ts`

| Name | Variants | Notes |
|---|---|---|
| `card` | `pad` none/sm/md · `tone` plain/inset/ok/warn/stop | The one surface. It has to **earn itself**: it carries state colour, or it holds a list whose rows need a shared edge. Everything else uses `Bare`. |
| `chip` | `tone` neutral/ok/warn/stop/ghost | Small state token. Colour always reports state, never decoration. |
| `input` | `align` left/center | `text-base` is not a style choice — under 16px iOS zooms on focus, and it sets the floor for how narrow a set-row column can get. |
| `button` | `kind` primary/quiet/bare · `size` sm/md/lg/touch | `quiet` is the default; `primary` is rationed to one per screen. `touch` is 48px. |
| `option` | `on` · `width` auto/full | A choice in a picker. `full` is Direction B's finding, kept though its direction lost. |

### Components — `ui/`

| Name | File | What it is |
|---|---|---|
| `Eyebrow` | `primitives.tsx` | The furniture rank of the type scale |
| `Section` | `primitives.tsx` | Heading, optional right-hand meta, body |
| `Bare` | `primitives.tsx` | A group with a rule above it and no box |
| `Prose` | `primitives.tsx` | Training copy with its inline `<b>` rendered |
| `Meter` | `primitives.tsx` | A 0–10 reading against a track |
| `Stat` | `primitives.tsx` | One reading in a divider-separated strip |
| `Picker` | `Picker.tsx` | The one select — variant, add-exercise, per-set grip |
| `RowGroup` / `Row` | `Rows.tsx` | The expanding row; the Log screen's whole structure |
| `Sparkline` | `Sparkline.tsx` | The one chart the rebuild still has data for |

## The domain pieces — `src/components/`

| Name | Owns |
|---|---|
| `AppShell` | The chrome: top strip, three tabs, locale switch, the view-transition names |
| `Timer` | The tick, the wake lock, and the two faces of the clock |
| `SetEditor` / `SetTable` | How seven loggable fields fit 360px, and how a past set differs from a live one |
| `TaskCard` | One task mid-session: header, prescription, sets |
| `ReadinessCheck` | Nine questions, their rationale, and the study behind each |
| `SelfCheckSheet` / `RehabStarter` | The injury self-check and the rehab switch |

Supporting modules, all pure and all in `src/lib/`: `format.ts` (display strings),
`ids.ts` (identity), `intervalProtocol.ts` (the timer's arithmetic), `cues.ts`
(its beeps and haptics), `loggedSet.ts` (which of the seven per-set fields an
exercise shows, and what a fresh row is prefilled with), and `prescription.ts`
(what a slot runs, and at what numbers).

## Where a screen's data comes from

Added by [#56](https://github.com/YgorPerez/send-lab/issues/56), which replaced the
prototypes' frozen snapshot with the store. A page composes from the vocabulary
above and reads from exactly two things:

| Layer | Lives in | What it is |
|---|---|---|
| The store | `src/lib/store/` | Fifteen keyed row sets (ADR 0007), and `useTrainingRecord()`, which assembles them into one `TrainingRecord` |
| The screen resolver | `src/lib/screens/` | `resolveToday` / `resolveTrain` / `resolveLog` — pure functions of `(content, record, now)` |

What the three built screens do with it, which is idiom 2 and idiom 3 one layer
down: **each holds `useState` over what a resolver returned, never over what it
fetched.** The resolver re-runs when the record changes; the route's own state is
the athlete's edits on top of it. Two decisions #56 made along the way:

- **`getContent(locale)` takes the locale.** It used to read `getLocale()` itself,
  which made every consumer implicitly locale-aware and a pure resolver impossible
  to write. Routes pass `getLocale()`; tests pass the one they mean. The same rule
  binds the resolvers — `resolveLog` takes a locale for its clock face rather than
  reading the ambient one.
- **A resolver returns inputs, not answers, where the screen decides live.** Today
  hands over `load` and `insights` rather than a verdict, because `computeReadiness`
  re-runs against whatever the check currently says.

---

## The idiom

Svelte 5 runes have no direct React equivalent and naive translation produces bad
React. Three patterns recur; `react-doctor` fails the gate on the naive form of
the first.

### 1. Something that advances on a clock — the rest timer

All four direction prototypes had to rewrite theirs. The obvious translation
keeps four `useState`s, advances them from inside a `setInterval` closure, and
reaches for a ref when that closure goes stale — which trips both *impure state
updater* and *ref mutated during render*.

- **The protocol is a pure reducer, in `lib/`, with no React in it.** One second
  is `step(run, config)`, unit-tested without rendering anything. The arithmetic
  is where the bugs are and a component test cannot reach it — this one found the
  prototype over-reporting a session by six seconds.
- **The component owns the tick and nothing else.** `setInterval(() =>
  setRun(step))` over *one* state object, so there is no stale closure and no ref.
- **Everything derivable is derived.** Elapsed and remaining are computed from
  `(run, config)` each render, so editing a field mid-session cannot let the
  progress bar drift from the clock.
- **Side effects come from the transition, not from the updater.** Cues fire in
  an effect that compares the previous run against the current one.

### 2. A draft that persists — the readiness check

- **Storage is a named `lib/` module** with a `load` and a `save`, both pure and
  both guarded for a missing `window`.
- **A lazy initialiser reads once**, at mount. Reading during render without the
  lazy form re-reads storage on every keystroke; reading in an effect renders one
  frame of the wrong answers first.
- **One effect writes**, keyed on the value — not a call at each setter, which is
  how a save gets forgotten at the third call site.

The mechanism itself is [#18](https://github.com/YgorPerez/send-lab/issues/18)'s:
`use-local-storage-state` with `storageSync: false` for the timer. This is the
component-side shape, which is the same either way.

### 3. A derived prescription

`$derived` becomes `useMemo` **over the inputs**, never a second piece of state
kept in step by an effect. The verdict is a function of the answers and the
history; storing it lets it disagree with them.

---

## Rules that came out of measurement

Every one of these was found the hard way, and each is now enforced rather than
remembered.

- **Never mark state by dimming small text with `opacity`.** A completed set row
  at `opacity-55` took its 9px column labels from 5.13:1 to **2.57:1** — twenty
  of twenty-four measured contrast failures were that one line, and Direction B
  hit the identical wall independently. At 9–11px there is no gap between
  de-emphasised and unreadable. **Mark state with colour.**
- **A saturated warm accent bright enough to be a signature cannot carry white
  text.** White on the vermilion is **3.11:1**; the ground colour on it is 6.44:1
  and reads as more emphatic, not less.
- **A disabled control drops its fill, not its opacity.** `opacity-40` put a
  disabled label at 2.46:1 — WCAG exempts inactive controls, so it was not a
  violation, but at that ratio a control reads as *broken* rather than as
  unavailable.
- **Every text colour on a panel clears 4.5:1**, enforced by `pnpm check:contrast`
  rather than by convention. It drives a browser over the built app in both
  locales, because a palette test cannot see opacity, compositing, or which
  surface the text landed on.
- **Three ranks of type, differing on size, weight *and* colour at once.**
  `.h-screen-title` / `.h-section` / `.eyebrow`, with `.microlabel` below them for
  a four-column grid. One rank doing two jobs is what made Today read as one long
  list.
- **44px for anything touched mid-set, 48px for the timer.** The timer is
  operated without looking at it; the set grid cannot afford 48px without pushing
  the last card off a second screenful.
- **pt-BR runs 1.4–2× longer and breaks a layout first.** Buttons use `min-h` and
  wrap rather than `h` with `nowrap`. A full-width option list costs the same in
  both languages where a chip grid reflows into ragged rows.
- **An icon-only affordance attached to a much larger element does not read as a
  control.** A 13px expand icon beside a 46px digit was invisible to the athlete.
  It needs its own border and its own row.

---

## Identity in props

[#20](https://github.com/YgorPerez/send-lab/issues/20) made branded ids mandatory,
key-side only. `src/lib/ids.ts` is the only module that mints one, and
`tests/ids.test.ts` asserts nobody asserts their way around it.

| Type | Shape | Notes |
|---|---|---|
| `AthleteId` | opaque | The boundary between two athletes' records on a shared device |
| `WeekId` | `w5` | Training week within the block, numbered from 1 |
| `WeekdayKey` | `Thu` | Calendar position. **Never** a localized label |
| `ExerciseId` | library key | Vouched for; the library lookup is the validation |
| `TaskKey` | `w5-Thu:pinch` | What completion is recorded against (ADR-0001) |

Two things differ from #20's sketch, both deliberate:

- **The brand is a private `unique symbol`, not `{ __brand: '…' }`.** `__brand` is
  a spellable property, so any object literal elsewhere can satisfy it and quietly
  mint an identity. A symbol that cannot be named outside the module leaves the
  constructors as the only door.
- **`WeekdayKey`, not `DayKey`.** `DayTypeId` already exists as a closed union in
  the content library, and a `DayKey` sitting beside it reads as "the key of a day
  type" — which reopens the exact overload [ADR-0002](adr/0002-day-types-have-identity-independent-of-weekdays.md)
  closed. A weekday alone is calendar position; the pairing of a weekday with a
  training week is a **slot**.

---

## Animation

Animation lives in the **variant** (#46), never as a Motion prop, and there is
deliberately very little of it. View transitions live in `app.css`, keyed to the
`view-transition-name`s `AppShell` sets. Motion is installed and pinned but not
entered; ADR 0011 says what has to be true when it is.

The accordion keyframe is this app's own. `tw-animate-css` resolves accordion
height from `--radix-`, `--bits-`, `--reka-`, `--kb-` or `--ngp-` and falls back
to `auto`, and there is no Base UI variable among them — so its classes would
open every row with a jump. Base UI publishes `--accordion-panel-height`, which
makes `.a-panel` a plain CSS height transition with no measure pass in JS and
nothing to keep in sync when pt-BR makes the content taller.

---

## The honest estimate

[#19](https://github.com/YgorPerez/send-lab/issues/19) asked how much of the 90
existing files is reusable, and #53 asks what the nine pages cost now that the
vocabulary exists. Both answers below are grounded in line counts of the
SvelteKit source and of what was actually built here, not in a guess.

### What happened to the 40 feature components

- **4 are deleted with their features** — `MetricCard`, `TrendChart`, `Bars`,
  `CustomExerciseEditor` (579 lines). Markers and athlete-authored exercises are
  gone from the rebuild (`CONTEXT.md` marks Marker and Probe `_Leaving_`), and
  three whole pages go with them: `stats`, `metrics`, `exercises`. **The nine
  pages are not twelve.**
- **2 are replaced by the base library** — `Modal` and most of `VariantPicker`
  become Base UI.
- **~9 became primitives or domain pieces** — `SetRows`, `Sparkline`,
  `OptionCards`, `SectionHeading`, `Prose`, `Timer` + `TimerBar`,
  `PrescriptionView`, `TrainExerciseCard`, `ReadinessQuiz`.
- **The rest is page composition** and does not survive as components:
  `Rehab`, `Periodization`, `SavedPrograms`, `TodayPlan`, `DailyFlags`,
  `ReadinessVerdict`, `ProgramSummary`, `BodyweightNudge`, `AccountSettings`,
  `LanguageSwitcher`, and the onboarding steps.

### What the nine pages cost

Three of them are built. The sizes below are relative to those, which is the only
unit that means anything here.

| Page | State | New primitives it needs | Size |
|---|---|---|---|
| `/` Today | **built** | — | finishing: store, empty states, device pass |
| `train` | **built** | — | finishing |
| `log` | **built** | — | finishing |
| `login` | moved, undesigned | — | small: first-run and error states |
| `settings` | blank | `Switch`, `AlertDialog` (both Base UI) | ≈ 1 × `log` |
| `week` | blank | a slot grid | ≈ 1 × `train` |
| `program` | blank | an override field, a phase editor | ≈ 1.5 × `train` |
| `welcome` | blank | a stepper shell | ≈ 1.5 × `train` |
| `studies` | **blocked** by [#37](https://github.com/YgorPerez/send-lab/issues/37) | an evidence badge, which #37 owns | ≈ 1 × `log`, after #37 |

**Roughly five new screens' worth of build, plus four finishing tickets.**

Two things that ordering should account for, both of which the page count hides:

- **`program` and `welcome` are the heavy ones, and their page files are the
  smallest.** `program/+page.svelte` is 109 lines and drags 540 more behind it in
  components; `welcome/+page.svelte` is 64 and drags 604. Sizing either from its
  route file will be wrong by a factor of six.
- **`week` is the one page with no prototype at any fidelity.** The four
  directions covered `/`, `train` and `log`; `week` is the second-densest screen
  in the old app (303 lines) and nobody has drawn it in this direction yet.

The vocabulary itself is about **70% complete after three screens** — five or six
additions serve the remaining six pages, against fourteen primitives already
built. That ratio is the useful number: the next screen is much cheaper than the
last three were.
