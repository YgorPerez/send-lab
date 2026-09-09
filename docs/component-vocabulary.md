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
| `Empty` | `primitives.tsx` | What a group says when it has nothing to list: a `Bare`, one line of `Prose`, and the one affordance that fills it |
| `Prose` | `primitives.tsx` | Training copy with its inline `<b>` rendered |
| `Meter` | `primitives.tsx` | A 0–10 reading against a track |
| `Stat` | `primitives.tsx` | One reading in a divider-separated strip |
| `Pane` | `primitives.tsx` | A page's single pane, capped near the phone measure |
| `Panes` | `primitives.tsx` | A page's two panes from `lg`, stacked below it |
| `Picker` | `Picker.tsx` | The one select — variant, add-exercise, per-set grip |
| `RowGroup` / `Row` | `Rows.tsx` | The expanding row; the Log screen's whole structure |
| `Sparkline` | `Sparkline.tsx` | The one chart the rebuild still has data for |
| `Switch` | `Switch.tsx` | On or off — a preference in force or not. Base UI, so it announces as a switch; state is the chalk fill, never opacity |
| `AlertDialog` | `AlertDialog.tsx` | A question that must be answered before something irreversible. Base UI; modal, not dismissable by clicking outside, its confirm the one `primary` on its surface |
| `Segmented` | `Segmented.tsx` | A small closed set of choices, all on one line — short fixed tokens only (`kg`, `Yes`, `4`). Promoted out of Settings by #64 when a second screen needed it |
| `Stepper` | `Stepper.tsx` | The stepper shell: a progress rail, one step's content, and the two controls. It owns where the screen's one `primary` goes |

## The domain pieces — `src/components/`

| Name | Owns |
|---|---|
| `AppShell` | The chrome: top strip, locale switch, the menu, the view-transition names |
| `Menu` | The app's whole navigation — every destination, behind one control in the strip |
| `SyncStatus` | Whether work is still on this device: nothing at all, `Offline`, `Sending…`, or the refusal notice |
| `Timer` | The tick, the wake lock, and the two faces of the clock |
| `SetEditor` / `SetTable` | How seven loggable fields fit 360px, and how a past set differs from a live one |
| `TaskCard` | One task mid-session: header, prescription, sets |
| `ReadinessCheck` | Nine questions, their rationale, and the study behind each |
| `SelfCheckSheet` / `RehabStarter` | The injury self-check and the rehab switch |
| `WorkingLoadAsk` | The ladder put at first contact with a weighted exercise, and what the athlete is told about the two numbers under its third rung |

Supporting modules, all pure and all in `src/lib/`: `format.ts` (display strings),
`ids.ts` (identity), `protocol.ts` (the timer's arithmetic), `cues.ts`
(its beeps and haptics), `loggedSet.ts` (which of the seven per-set fields an
exercise shows, and what a fresh row is prefilled with), `prescription.ts`
(what a slot runs, and at what numbers), `workingLoad.ts` (which exercises carry
a working load and what to start one at), `strength.ts` (the size→20mm
conversion, run backwards to predict a load), and `syncState.ts` (which of ADR
0008's visible states the strip is in, and — nearly always — that it is in none
of them).

### Page and screen are the same thing

Worth saying once, because the type names imply otherwise and someone will
eventually try to "fix" it into a distinction. `TodayScreen`, `TrainScreen` and
`LogScreen` name **what a page reads**, not a second concept — `screens/today.ts`
opens with "What Today reads", and three lines later says "the screen decides
whether to train", meaning the page. Both words are in use throughout this file
and in ADR 0010's tiers, and nothing in the codebase tells them apart.

So: they are synonyms, the `*Screen` suffix is a convention for resolver output,
and no rule is being broken by either word. The one genuinely different sense is
`view-transition-name: 'screen'` on `<main>` — a CSS name for the region that
gets replaced on a navigation, kept because #54 measured that transition on the
device and `tests/motion.test.ts` asserts exactly three such names.

## Where a screen's data comes from

Added by [#56](https://github.com/YgorPerez/send-lab/issues/56), which replaced the
prototypes' frozen snapshot with the store. A page composes from the vocabulary
above and reads from exactly two things:

| Layer | Lives in | What it is |
|---|---|---|
| The store | `src/lib/store/` | Sixteen keyed row sets (ADR 0007), and `useTrainingRecord()`, which assembles them into one `TrainingRecord` |
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

## Empty states

Settled by [#61](https://github.com/YgorPerez/send-lab/issues/61), the first time
an empty account was a real case — until the store landed, all three screens
rendered a frozen snapshot in which nothing was ever empty. One question, answered
once against the vocabulary rather than three times against three screens.

**An empty state is copy, not furniture.** It is `Empty`: a `Bare`, one line of
localized training copy with its `<b>` rendered, and — where one exists — the
single affordance that fills it. Never a `card` and never an empty `RowGroup`: a
bordered box with a sentence in it is the empty box the sentence exists to
replace, and Log rendered two of them. The copy says what the group is waiting
for and where that comes from, in the glossary's words — *session*, *readiness
check*, *scheduled work* — which is exactly where "workout" and "day recommender"
crept back in the first time; the stale keys that carried them are gone.

Three rules came out of it, and the first is the one that bites:

- **A screen that computes an answer from defaults must say it has no answer.**
  `computeReadiness` scores each wellness question's *fallback* when it is
  unanswered, so an empty check still produces a score and a verdict — and on a
  fresh account that verdict looked exactly like one from a full check: a title,
  a number, work held off the plan, "about your usual" under a score with no
  usual behind it. Today gates the read, the held work, today's mark on the
  trend and every baseline comparison on `hasWellnessAnswer` — one of the five
  wellness questions, not *any* question, because "how much time do you have" is
  core too and answering it alone would unlock a score made of fallbacks. The
  load and trend flags stay, because they are read off the history. The check
  itself stays live, so the first wellness tap turns them all on.
- **Zero is honest; hiding it is not.** The counts stay — `0 · 0` in Log's
  header, `0/12 sets` in Train's — and the empty copy goes where the *list*
  would have been, under the same heading.
- **An absence is not always an empty state.** A rest day on Today keeps its own
  line inside the plan card, because a day type that prescribes nothing is the
  answer the athlete opened the app for. Train says "no scheduled work" rather
  than "rest day" because it cannot tell a rest day from a slot the athlete
  emptied, and Today already names the day type.

Train has no start button, so the ticket's "no session started" is *no scheduled
work*: nothing in today's slot, the add-exercise picker as the way in. Its second
empty state is the one that is easy to forget: a slot *with* tasks
and no set ticked off. A session is trained once one set is (`CONTEXT.md`,
**Trained**), so the primary is disabled with the line that says what it needs —
disabled, not hidden, because a hidden button leaves the athlete looking for it.

`tests/emptyStates.test.ts` renders the three screens over a store that was reset
and not seeded, on a training weekday and on the rest weekday, in both locales.

## Settings

Settled by [#62](https://github.com/YgorPerez/send-lab/issues/62), the first page
built after the three training screens, and the one where two rules got tested
first.

**The split the offline ticket decided is drawn on the page.** Preferences are
part of the training record and already in the local store, so units, language and notifications
save on the device and sync when they can — through `store/prefs.ts`'s
`writePrefs`, which is the one update-or-insert the locale switch also goes
through. Signing out and the API token need the server. Offline, one line says
which half needs a connection and the account controls drop their fill rather than
failing silently — the warn `chip` that used to head the page as well is in the
top strip since [#83](https://github.com/YgorPerez/send-lab/issues/83), on every
screen instead of this one. Sign-out flushes
unsynced work first and is *held* — with the reason on screen — if anything is
still unsent, because signing out with training on the device is how it is lost.
`lib/online.ts` is the read half of the `online` event `store/sync.ts` already
retries on. The account half is keyed on the store's active account rather than
on the session, for the same reason `__root.tsx` keeps the remembered account
when the session fetch fails: offline, a signed-in athlete must not be told they
are signed out.

**The ration held by moving the primary into the dialog.** A settings page has a
button in every section and none of them is the thing the athlete came to do, so
every one is `quiet`. The one `primary` is the confirm inside the `AlertDialog`
that guards token regeneration — the only action on its surface.

**The locale is a live value, not a component's state.** `useResolvedLocale` sits
at the root and Settings switches the locale from three routes down with no prop
path between them, so `store/locale.ts` holds the current locale with
subscribers (`currentLocale` / `subscribeLocale`) and the hook is
`useSyncExternalStore` over them — the shape `record.ts` already uses for the
active account. The strip's `EN` / `PT` switch and the page's full-name one are
the same call.

**Settings is reached from the top strip, not from a tab.** A gear beside the
locale switch: the two are the same kind of thing — about the app, not about a
screen — and the rail still carries the same three destinations and no more.

Two things the page deliberately does not do. **One switch, for two fields.**
[#75](https://github.com/YgorPerez/send-lab/issues/75) split `notify` into
`cueNotices` and `dailyNotice`, and the page renders only the first: permission is
asked for at the tap, the stored boolean is the switch, and the daily half has no
push path behind it until
[#81](https://github.com/YgorPerez/send-lab/issues/81), which also builds the
reconciliation against the browser's permission. A switch that turns on nothing is
the dishonesty the split was made to end, so the second one waits for the
machinery it needs. And the unit preferences are
recorded but nothing yet converts for display: `format.ts` is the seam that
grows the conversion back, and it says so.

---

## Welcome

Settled by [#64](https://github.com/YgorPerez/send-lab/issues/64), the second of
the five unbuilt pages and the first one that writes something other than a
preference. It answered the ration's hardest case and added the rule that a form
on this app obeys.

**A step is a screen, so the advance is its `primary`.** A stepper wants a primary
on every step, which reads as a conflict with the one-per-screen ration until you
notice that only one step is ever in the tree. So `ui/Stepper.tsx` owns that
decision — the advance is `primary`, back is `quiet`, and the count is kept by
construction rather than by remembering. It is a primitive rather than page
composition for exactly that reason: it owns a decision, not an arrangement
(ADR 0010). Settings answered the same question the other way, and consistently:
the primary marks the action the screen exists for, and a list of controls has
none. `tests/welcome.test.ts` counts the primaries in the rendered `<main>`.

**An intake question has no default** (ADR 0019). This is [#61](https://github.com/YgorPerez/send-lab/issues/61)'s
rule pointed at *input* instead of output, and the page it replaces broke it: the
SvelteKit form opened with a goal, a focus, a level, four days a week and all four
pieces of gear already selected, and with `niggle` and `synovitis` at `false` —
which is not "no niggle", it is *nobody asked*. Both of those feed training
(`niggle` caps finger RPE at 8 and softens every phase; `synovitis` routes to the
fingers self-check), so a default there is a training decision nobody made. The
draft therefore types every required answer as nullable, `toBaseline` returns
`null` while any is missing, and each step's advance is **disabled with the line
that says what it is waiting for** — Train's rule, and this is where an athlete
most needs it, because the missing answer is above the fold.

**Four steps, each named for what it decides**: goal and limiter; level, with the
two grades beside it because the hardest boulder *recalibrates* the level rather
than merely informing it; the week — days, session length and gear, the three
answers that decide what can be prescribed at all; and the body, where the two
finger questions come first under their own heading and the birth date and
bodyweight sit below them marked optional. `STEP_ANSWERS` in
`lib/screens/welcome.ts` is both the sequence and the gate, so a step cannot be
added to the rail without saying what it asks for.

**The proposal is not a fifth step**, and it reads the generated `Program` rather
than re-deriving the week from the baseline. The two come apart on purpose: the
generator rests out a weekday whose exercises the athlete's gear cannot support,
so a six-day answer can produce a one-day week — and the SvelteKit proposal, which
called `trainingDays(content, assessment)` directly, showed the six. What a
reported niggle *did* is stated there too, instead of the old offer to switch to
rehab: the rehab switch lives on Today's injury entry, and the program on screen
has already been softened.

**Skippable, and resumable.** There is no gate and no redirect: an account with no
baseline runs the built-in week, which is a real program, and a gate would have to
be an effect-driven redirect over account data — which offline, before the store
has hydrated, bounces a returning athlete *with* a baseline into an intake
(ADR 0006 excludes loaders for account data for the neighbouring reason). The
whole entry path is one line on Today under the plan it describes: an `Empty` — the
one group on that page that genuinely has nothing in it — saying the week is the
built-in one, or how far a half-finished baseline got, with the one affordance that
fills it. `quiet`, because Today's one primary is the bodyweight nudge.

The draft is the fourth ephemeral store (`lib/baselineDraft.ts`) and the first one
**scoped to the account** rather than to something shorter-lived.
`lib/ephemeral.ts` named the case that would justify it — two athletes sharing a
device — and this is that case: the intake is what a second account opens first,
and its answers are a training history in miniature. It is also the right expiry.
A baseline draft must not die with the day the way the readiness draft does; an
athlete who starts on Monday night has not changed their goals by Tuesday. It
expires when the baseline is written, and when the account changes.

Two things this page deliberately does not do. It writes no bodyweight *reading* —
`CONTEXT.md` says the baseline captures the first one and every later one is
logged from Today — and it converts no units: the field says `kg` out loud, because
`prefs.weight` is recorded and nothing reads it yet. And one thing it inherits
rather than fixes: `generateProgram` names its phases from `m.prog_phase_*()`, so
a stored `Program`'s phase names are frozen in whatever language generated it.
`Phase.name` is typed as athlete-authored free text, which is the category
ADR 0012 distinguishes a stored *label* from — but a generated name is not
athlete-authored, and giving it an id is an entity decision that belongs to the
Program page ([#65](https://github.com/YgorPerez/send-lab/issues/65)).

---

## Login

Settled by [#66](https://github.com/YgorPerez/send-lab/issues/66), last of the
nine and deliberately so: it is cheap and it yields no primitives, so building it
earlier would have bought the pages after it nothing. It composes entirely from
what was already here — `Pane`, `Bare`, `Eyebrow`, and the `input` and `button`
recipes — which is the ratio #53 predicted holding at the end of the list. (`chip`
was a fourth until [#83](https://github.com/YgorPerez/send-lab/issues/83) took the
page's `Offline` token into the strip; the page's own three notices carry what is
left, and they were never chips.)

**A destination, never a gate.** No page in this app is auth-blocked, and this
page is the reason middleware stays declined: offline the service worker serves
the shell and middleware never runs, so the client has to handle the
unauthenticated case correctly anyway — an optimistic redirect is the same
decision implemented twice, and the copy that runs less often is the one that
rots. `AppShell` keeps its three tabs here like anywhere else, so there is also
nothing to "continue without an account" *from*; the guest strings the SvelteKit
page used are gone, along with the one that promised a guest's data would come
with them into a new account, which the rebuild does not do.

**The page is keyed on the store's active account, not on the sign-in** — the
same call Settings makes, for the same reason: offline the sign-in cannot be
checked and reports nobody, and telling a signed-in athlete in a gym basement
that they are signed out is worse here than anywhere. It also means the page
never renders a pending placeholder: with no account remembered, the form *is*
the honest answer.

**A sign-in is not a session**, and this page is where the two words met.
`CONTEXT.md` now carries **Sign-in** — the standing proof that a device is acting
as an account, which lapses on its own, and which a **sign-out** ends
deliberately — because *session* in this app is training, and the app has a
`sessionDraft` next door to prove it. `useSession` survives only where
better-auth's own API spells it that way.

**Three athletes look at this page and need three sentences**, and the hardest
one is the middle. `#24` decided **a lapsed sign-in never clears the local store
or the queue** — only an explicit sign-out, made online and after the queue has
drained. So an athlete whose sign-in lapsed still holds every set they logged and
every write not yet sent, while seeing an app that looks empty, because
`__root.tsx` points the store at the signed-out namespace the moment a sign-in
resolves to absent. The sign-in cannot tell that athlete from a first run: it is
absent for both. What tells them apart is whether this device is still holding a
record, which is `heldAccounts()` in `store/collections.ts` — a read of the
`sendlab:<account>:<collection>` keys, since the only pointer to who was here is
cleared by the same lapse. `resolveLogin` in `lib/screens/login.ts` picks the
line; `tests/login.test.ts` asserts both, in both locales.

Three things that line got wrong on the first pass — two caught in review, one in
the domain pass after it — and all three are the same mistake in different
clothes: **a notice claiming more than the app knows.**

- It **said why** the athlete was signed out. The records also survive a
  deliberate sign-out from Settings, which is the same device state reached on
  purpose, and "your session ended" is false there.
- **Offline replaced the other notice** instead of joining it. Offline is a fact
  about the form, what is held is a fact about the device, and suppressing the
  second dropped the reassurance in the one state that most needs it.
- The pair was named **`returning` and `first-run`**, which are claims about a
  *person*. A record on this device says *someone* signed in here — the glossary
  keeps **Account** as the boundary between two athletes on a shared device
  precisely because that someone need not be the one now reading. They are
  `has-record` and `no-record`, named for what `heldAccounts()` actually answers,
  and the copy says "the account's own record comes back" rather than "yours".
  `first-run` was the worse half twice over: it is a word **Intake**'s `_Avoid_`
  list names (ADR 0014), sitting one button away from the control that opens an
  intake, and *returning* was already the name of a rehab stage.

**Failures are split on the instruction they carry, not on the status code.**
Wrong credentials means *type something else*; a server that could not be reached
means *change nothing and try again*, and saying "check your details" to the
second is a lie about whose problem it is. They arrive through two channels:
anything the server answered comes back as a returned `error`, and a request that
never landed **throws**, because better-auth's client does not set better-fetch's
`catchAllError` — so `classifyAuthFailure(null)` is the throw. A `5xx` is a third
case and not the second: `unreachable`'s copy promises **nothing was sent**, and a
sign-up that 500s after the row is written makes that false.

**Signing out is not on this page.** It lives on Settings, where it flushes the
queue first and is *held* — with the reason on screen — if anything is still
unsent. A second sign-out button here without that hold would be a one-tap path
to losing training, which is the rule's whole point. The signed-in view spends
its one `primary` on the way back to Today instead.

Two smaller things. The scaffold's `/api/me` went with the debug readout it fed —
it was the only caller, and an authenticated endpoint nobody calls is not a proof
of life. And sign-up asks for no name: better-auth requires one, no screen shows a
display name, and a field with no reader is a question with no answer to give it,
so the address stands in.

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
- **A colour's contrast is a property of the pair, not of the palette.** `--flag`
  at 10px measures **4.34:1 on `--panel-2`** — under the floor — and clears it on
  `--panel`. Same colour, same size, different surface, different answer. So
  "`--flag` is a text colour" is not a fact the palette can state once: a token
  moved onto an inset surface has to be re-measured there. Found by
  [#63](https://github.com/YgorPerez/send-lab/issues/63)'s slot grid, where
  `check:contrast` failed the moment a `missed` slot existed.
- **A mark can carry a colour a label cannot.** The corollary of the rule above,
  and the way out of it: non-text contrast wants 3:1 where text wants 4.5:1, so a
  state that will not clear the floor as a 10px number clears it as a dot beside
  one. At this density, state belongs on a mark.
- **One cell carries one colour system.** A slot grid wants to show both what a
  day *is* (the day type's accent) and how it *stands* (its state), and at 44px
  there is room for one. #60's prototype put the accent in the dot and `Sat`
  (performance, `--flag`) came out the same red as `Tue` (missed, also `--flag`)
  — the week could not tell "still to come" from "you missed it". State won,
  because it is the question the page is opened for; the accent moved to the panel
  below, attached to the day type's own name.
- **`aria-label` replaces a control's content, it does not add to it.** A grid
  cell reading `Thu 1/4` labelled `"Thu · Pinch / Wrist · Today"` says *less* to a
  screen reader than the unlabelled button did — the count is gone. Whatever the
  cell shows has to be in the label too.

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

## What the strip says about unsent work

Settled by [#83](https://github.com/YgorPerez/send-lab/issues/83), which is the
first time [ADR 0008](adr/0008-offline-writes-are-a-queue-not-a-sync.md)'s visible
states got a surface, and completed by
[#84](https://github.com/YgorPerez/send-lab/issues/84), which built the third of
them. All three are now here, and they are three **severities** rather than three
labels — which is why the last one is not a chip. ADR 0008 carries the same
correction, since its own sentence reads as three labels sharing a surface.

Measuring the third one on the built app is also what turned up **#96**: the
unsynced work had been running in memory on every healthy browser, so refused work
did not survive a reload and an *unmissable* notice vanished on the next app open.
`collections.ts`'s `deviceStorage()` is the fix and `tests/recordSync.test.ts`
holds it.

| refused work | device | work waiting | the strip says | weight |
|---|---|---|---|---|
| none | online | none | nothing at all | — |
| none | online | some | `Sending…` | neutral chip |
| none | offline | none | `Offline` | warn chip |
| none | offline | some | `Offline · not sent` | warn chip |
| **some** | either | either | `sync_refused_work`, a whole sentence | filled `--flag`, and the wordmark stands down |

**Offline has two labels, and that is the ticket's first sentence rather than a
fourth state.** "The athlete can tell whether the training they just recorded has
left the device" — under a single `Offline`, logging a set in a gym basement
changed nothing on screen, so the one question the strip exists to answer went
unanswered in the one place it is asked. Both labels are one indicator at one
severity, which is what the ADR's three states are about: its third is
*unmissable*, and a chip is not that — see below for what it is instead.
`offline-unsent` needs both a dead connection and work that has not gone, and
stands down to plain `Offline` the moment the work drains.

**The strip is the slot, and the reason is the requirement.** The ADR asks the
athlete to be able to tell from *any* screen that training has not left the
device, and the top strip is the only surface every screen has. It already carried
the two things that belong to the app rather than to a page; this is a third of
that kind, and it is the last one that qualifies — anything else that wants to
live here is a page's business.

**The third state is escalated out of that slot, not given one beside it.** ADR
0008's states differ in severity — silent, an indicator, "an unmissable message
when a write has permanently failed" — so refused work gets *the same slot at a
different weight*: a filled vermilion bar carrying a real sentence, taking the
strip's whole left side, with the wordmark standing down for it. Five consequences,
each of which was the alternative:

- **Not a chip.** A 10px token is not the third severity, and this file said so
  before the state was built. At 360px a token beside the wordmark has ~138px,
  which is not a sentence in either locale; without the wordmark the notice has
  214px, and both locales fit in two lines inside the 44px strip (measured).
- **Not a second surface.** Two tokens competing in one strip is what the ticket
  ruled out in its first paragraph, so `resolveSyncState` returns one state and
  refused work outranks the other two. The price is real and recorded there: while
  refused work stands, the strip is not also reporting the connection. Exactly one
  thing ends it and it is not something the athlete can be asked to do —
  `unsynced.ts`'s `add()` drops a refusal when the *same row* is written again, so
  for an appended session the notice never stands down. The right trade only
  because refused work is the app's most serious state and essentially never
  happens.
- **The one exception to the rationed accent fill.** `button`'s `primary` is
  otherwise the only filled vermilion on a screen, and this is the app's second
  use of it. What is reused is the *measured pair* — `text-bg` on `bg-flag` at
  6.44:1, where white would be 3.11:1 — and not the recipe: `button` owns a
  control's shape and the notice is not a control.
- **Not dismissible, and not a link.** A control in the shell is a control on every
  screen, and there is nothing at the other end of it the athlete can do about
  refused work yet. Settings keeps the detail (`set_refused_note`) — what it stops
  being is the *only* place refused work is said, which was the whole complaint: a
  gold line on a screen nobody opens mid-set is not a surface.
- **It does not say what did not send.** Refused work is identified by collection
  and row key, which mean nothing to the athlete; mapping those to domain nouns
  ("Thursday's session") is its own ticket. The ADR asks only that the athlete be
  told something did not send.

**The copy promises nothing, and the name says both words.** It names the server —
*"The server refused some training. It will never be sent."* — because the one
thing it must not do is read as a connectivity problem the athlete can fix by
finding a signal. That is the confusion #82 fixed on the sign-out path, where copy
promising "sign-out waits until it has been sent" was attached to work that was
never going to be sent. And the name is `sync_refused_work` / `'refused-work'`,
never the bare word: `CONTEXT.md` requires both words of that term and
`screens/login.ts` already has a bare `'refused'` for a refused *sign-in*, which is
a different event — ADR 0014 binds the glossary name at the key and the type member
as much as at the copy.

**The region persists; its politeness escalates.** One `role="status"` lives in the
strip whether or not there is anything to say, because a live region inserted with
its content is one the screen reader was not watching. Its `aria-live` is `polite`
for the three chips and `assertive` for refused work — "unmissable" is not only a
visual claim, and swapping the element instead of the attribute would cost the
announcement it is asking for.

**Beside the wordmark, not beside the controls.** The strip is
`justify-between`, so the left group is anchored left and the right group right. A
token that appears and disappears on the left moves nothing; the same token on the
right would slide the locale switch and the menu sideways every time a task is
ticked. `tests/desktop.test.ts` holds the order.

**Nothing on screen is the normal state, and it is the part that is easy to
lose.** The ADR is explicit that the old app's always-on saved/saving status is
"noise on a phone used mid-set", so the rule is a pure function
(`lib/syncState.ts`) with its own suite, and the assertion that matters is the
negative one. Two consequences that look like details and are not:

- **It counts `sendable()`, never `unsynced()`.** They differ by the refused work,
  which can never be delivered — so a count including it never returns to zero and
  "Sending…" becomes the permanent furniture the ADR refused. Refused work is the
  third state's problem, not this one's.
- **A dead connection is never reported as `Sending…`** Both are true at once in a
  gym basement, and "Sending…" over a dead connection reads as *it is on its way* —
  which is the reading that gets an athlete to close the app on work that has not
  gone. It is `Offline · not sent` instead, which says both.
- **Sent, never saved.** `sync_sending` read "Saving…" until the 2026-09-08
  domain-modeling pass, which is the register five other strings had already
  settled: the noun is *unsynced work* and the verb is *send*
  (`set_unsynced_holds_signout` uses both in one sentence). *Saved* was not
  available for it — a **saved program** is a different thing, and so is a draft
  the app saves as it is typed — and #83 was what made the clash visible, by
  putting `Saving…` eight pixels from `Offline · not sent`. `CONTEXT.md`'s
  **Unsynced work** carries the rule; the dead `sync_saved` ("Synced") went with
  it, since the settled state is deliberately blank and nothing rendered it.

**A page no longer says it for itself.** Settings and sign-in each carried their
own `Offline` chip, which was the same shape as the Settings gear before `Menu`
existed: a one-off invented because there was nowhere for it to live. Both are
gone; what each page keeps is its own half of the answer — not *that* the device
is offline, but which of that page's controls stops working.

**It renders nothing on the server**, by construction rather than by care, because
`AppShell` is baked into `/_shell.html` (ADR 0006). All three readings are
`useSyncExternalStore` with a server snapshot meaning "all is well", which is also
the snapshot React uses for the render that hydrates — so the baked artefact is the
ordinary strip, wordmark and all. `UpdatePrompt` reaches the same place a different
way.

**One reading, read once.** `useSyncState` lives beside the component and
`AppShell` calls it, because two things are decided from one answer: what the strip
says, and whether the wordmark is still what the strip is for. Two calls would be
two subscriptions to the same store deciding one strip, which is how the wordmark
and the notice come to disagree; `tests/desktop.test.ts` holds it to one.

---

## The desktop layout

Settled by [#52](https://github.com/YgorPerez/send-lab/issues/52) and recorded as
[ADR 0018](adr/0018-the-desktop-layout-is-css-below-the-shell.md). The athlete
asked for a real desktop layout, not a centred column, so a second layout exists —
and this is the part of it every page ticket has to know.

**One breakpoint, `lg` (1024px). Tablet is not a case.** It resolves downward: it
gets the phone layout at a comfortable width. The number is derived rather than
picked — a rail (200px) beside two columns of the 360px measure these screens were
designed against, plus gutters, first fits at ≈992px, and `lg` is the next stop up.

**The chrome.** `main` goes from `max-w-[520px]` to `max-w-[1000px]`, centred at
both widths, and that is now the whole of it — see the ADR for why keeping the
difference in CSS is a constraint rather than a style, and `tests/desktop.test.ts`
for what enforces it.

> **Amended 2026-09-08.** This paragraph used to read "the three tabs move from the
> bottom edge to a 200px left rail". **There is no tab bar and no rail.** #52's
> claim that the app has exactly three destinations held while it had three pages
> and produced one-offs as the rest arrived — a lone Settings gear in the strip, a
> `week` chip in Today's header — until the athlete went looking for `week`, could
> not find it, and asked for a menu and for the bar to go. Every destination now
> lives in `Menu`, one control in the top strip, at both widths. The rail went with
> the bar because it *was* the bar restyled. See
> [ADR 0018](adr/0018-the-desktop-layout-is-css-below-the-shell.md)'s own
> amendment; the decision that ADR records is unaffected.

**`Panes` is the only place a page's desktop width is decided.** Every page
composes through it, including the ones that stay one column:

```tsx
<Panes primary={<>…</>} secondary={<>…</>} />  // two panes from lg, stacked below
<Pane>…</Pane>                                 // one pane, capped at 560px
```

Two shapes rather than one component with an optional prop: `<Panes>` with one
pane renders no panes, and a name that is only true half the time is the thing
this repo spends most of its effort not doing. **`Pane`, not `Column`**: "column"
already means one of the four cells a set row wraps into, which is the
measurement that floors how narrow an input can get on the app's most-used
screen — one word at two scales, with the small one load-bearing. A page's own header goes *outside*
`Panes`, in the page's wrapper, so it spans both columns.

**The split has to be contiguous in the phone order.** `Panes` puts
`display: contents` on its two wrappers below `lg`, so they vanish and their
children stack in DOM order — adopting it costs the phone screen nothing, measured
to the pixel. The price is that the columns cannot interleave: `secondary` is
everything after one cut point. So a screen gets a second column only if it
already reads as two halves. **A page that has to be reordered to fit two columns
does not get two columns.**

### Which pages spend the width

| Page | Desktop | Why |
|---|---|---|
| `/` Today | **two columns** | Cut at the screen's own ordering rule: *decision + evidence* left, *input* right. Measured 3222 → 2019px (en-US), 3367 → 2035px (pt-BR) |
| `log` | **two columns** | Two independent lists. Side by side the page is as tall as the longer one instead of their sum, and the summary line — which truncates first in pt-BR — gets a column wider than the whole phone |
| `week` | **two columns** | Built ([#63](https://github.com/YgorPerez/send-lab/issues/63)) through `Panes` as expected: the slot grid and the day it selects are two halves, and the cut is already the phone order. The grid also goes `grid-cols-4` → `lg:grid-cols-7` — four columns is what 360px forces, seven is the shape |
| `program` | **two columns, expected** | Unbuilt ([#65](https://github.com/YgorPerez/send-lab/issues/65)). A phase editor is the other shape that obviously wants a second column beside it |
| `train` | **capped** | Defined by the posture it is used in. Seven loggable fields laid out against 360px, stretched to twice that, put the number being typed an inch from its label. Measured: the wide layout saves it 128px, which is the bottom bar |
| `login`, `welcome` | **capped** | A form and a stepper. A stepper is one thing at a time by design. Both are built ([#66](https://github.com/YgorPerez/send-lab/issues/66), [#64](https://github.com/YgorPerez/send-lab/issues/64)) and both went through `Pane` as expected |
| `settings` | **capped** | A list of controls; width adds nothing. Built ([#62](https://github.com/YgorPerez/send-lab/issues/62)) through `Pane` as expected |
| `studies` | **open** | [#37](https://github.com/YgorPerez/send-lab/issues/37) owns its affordances first |

**Four of nine diverge, and five reuse the phone design unchanged.** That ratio is
the point: the desktop layout is cheap because most of it is the phone layout with
a cap on it, and the page tickets carry two answers only where the second one pays.

### Hover, focus and hit areas

Desktop brings a pointer and a keyboard; the phone design accounted for neither.
Both are answered once, and both are free on touch.

- **Hover moves a surface or a border, never a measured text/background pair.**
  `check:contrast` measures a page nobody is hovering, so a hover state is the one
  place a contrast regression cannot be caught — and `--flag-deep`, already used
  as the primary button's *press*, carries the ground at **3.91:1**. Fine for as
  long as a finger is down, not fine for as long as a pointer rests. So the
  primary's hover is its border; `quiet` and `bare` raise the panel a step and take
  their text *lighter*, which can only improve a ratio.
- **`hover:` costs touch nothing.** Tailwind 4 emits every one of them inside
  `@media (hover: hover)` — verified in the built stylesheet, not assumed. That is
  what rules out sticky hover on a tap.
- **Focus is a real ring, on `:focus-visible`.** Every input carries `outline-none`
  and replaces the UA outline with a border step, which reads fine under a finger
  already on the control and tells a keyboard nothing about which of a set row's
  four columns has the caret. `app.css` puts a 2px `--ring` outline back, offset so
  it survives on `bg-panel-2`. `:focus-visible` and not `:focus`, so a control the
  athlete just tapped does not keep a ring around it.
- **Hit areas do not shrink.** 48px in the tab bar, 44px in the rail, 44px
  everywhere touched mid-set. A pointer is precise enough for less; a second set of
  sizes is a second thing to keep in step, and the athlete gains nothing from it.
- **The hover rule is a gate, not a convention.** `tests/desktop.test.ts` scans
  every `hover:` utility in the tree against an allow-list — a background within
  the panel ramp, text taken *lighter*, or any border — and refuses everything
  else. It carries its own control (the scan must find the hover states the app
  has) because a scanner that stopped matching would report the same clean run as
  a compliant tree.

### Measuring it

The **four** browser checks take `--desktop`, which picks a 1280×900 viewport
*and* emulates `hover`/`pointer` — width alone is not enough, because under mobile
emulation Chrome reports `hover: none` and every hover rule is inert.

```
pnpm build
pnpm check:hydration --desktop   # the check that catches a layout chosen in JS
pnpm check:contrast --desktop
pnpm check:motion --desktop
pnpm check:overflow --desktop
```

Run them at the phone viewport too — the same four commands without `--desktop`,
which is where `check:overflow` earns its keep.

`check:hydration --desktop` is the load-bearing one for the *layout*: a shell that
branched on the viewport bakes one answer and mismatches at the other width, and
nothing else reports it.

**What they measure it on** ([#73](https://github.com/YgorPerez/send-lab/issues/73)).
`check:contrast`, `check:hydration` and `check:motion` each run **twice**: once on
the seeded training record — `store/seed.ts`, the same scenario
`tests/screens.test.ts` asserts against — and once on the empty account a new
athlete sees. Both passes boot on one pinned instant, `2026-08-13T09:30`, a
Thursday in week 5 of that block, printed at the top of every run so a number is
reproducible from the output that carried it. Until #73 they ran the empty account
only, on whatever day the machine thought it was, and both halves of that mattered:
signed out, `/log` renders **13** text elements against the seeded account's 170,
and the same commit measured 548 elements one day and 426 the next. So a route now
carries its own floor (`scripts/floors.ts`, measured and re-derivable from the
summary line each run prints) instead of one global minimum low enough for
`/login`, and each run's summary also prints how tall every route laid out, which
is what finally answers #52's open question with a reading: seeded `/log` is
**2179px** at 360px and **1459px** at 1280px, so the second pane does take about a
third off the longest list in the app. The seeded record is installed from the
harness side —
`Page.addScriptToEvaluateOnNewDocument`, before the app's own script — because ADR
0006 keeps the precached shell user-independent and a boot-time branch on a query
parameter would ship an account-shaped decision inside it. `check:overflow` still
measures the empty account only; the seam is shared, so giving it the same two
passes is a small, separate change.

**`check:overflow` is the fourth, and it is new** ([#63](https://github.com/YgorPerez/send-lab/issues/63)).
Until it landed, "no horizontal overflow at 360px" was measured by hand once, with
a throwaway script, and went stale the moment the next page shipped — which is why
both [#60](https://github.com/YgorPerez/send-lab/issues/60) and #63 asked for it to
become real. It asserts `documentElement.scrollWidth` against the viewport on every
discovered route in **both locales**, and it refuses to pass a page that rendered
too little: a route whose `main` holds under eight elements fails as *unmeasured*
rather than passing as narrow, because a page that rendered nothing fits every
screen. That control exists because [#52](https://github.com/YgorPerez/send-lab/issues/52)
closed on the opposite lesson — 426 elements where #69 had recorded 1008, "partly
green-because-empty".

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
  `LanguageSwitcher`, and the intake steps.

### What the nine pages cost

Three of them are built. The sizes below are relative to those, which is the only
unit that means anything here.

| Page | State | New primitives it needs | Size |
|---|---|---|---|
| `/` Today | **built** | — | finishing: device pass ([#53](https://github.com/YgorPerez/send-lab/issues/53)) |
| `train` | **built** | — | finishing: device pass |
| `log` | **built** | — | finishing: device pass |
| `login` | **built** ([#66](https://github.com/YgorPerez/send-lab/issues/66)) | — | costed small; came in at ≈ 1 × `log`, and the overrun is copy |
| `settings` | **built** ([#62](https://github.com/YgorPerez/send-lab/issues/62)) | `Switch`, `AlertDialog` — both landed, both Base UI | came in at ≈ 1 × `log`, as costed |
| `week` | **built** ([#63](https://github.com/YgorPerez/send-lab/issues/63)), **read-only** | a slot grid — composed from `Panes`/`Section`/`Bare`/`card`/`chip`, so **no new primitive** | came in at ≈ 0.85 × `train` (269 route + 164 resolver against train's 297 + 203), as costed. ADR-0001 says "the Week tab's tick writes it" and that half is **not built**: the page reads `taskDone` and never writes it |
| `program` | blank | an override field, a phase editor | ≈ 1.5 × `train` |
| `welcome` | **built** ([#64](https://github.com/YgorPerez/send-lab/issues/64)) | `Stepper` — and `Segmented`, promoted out of Settings | came in at ≈ 3 × `train`, against ≈ 1.5 costed |
| `studies` | **blocked** by [#37](https://github.com/YgorPerez/send-lab/issues/37) | an evidence badge, which #37 owns | ≈ 1 × `log`, after #37 |

**Roughly five new screens' worth of build, plus four finishing tickets.**
Settings was first of the five deliberately — cheap, and it yielded the two
primitives above — so `welcome`'s stepper and `program`'s editors compose against
sixteen primitives rather than fourteen.

That sentence is the estimate as it was made, kept for the record. **Four of the
five have since landed** — `settings` ([#62](https://github.com/YgorPerez/send-lab/issues/62)),
`welcome` ([#64](https://github.com/YgorPerez/send-lab/issues/64)),
`week` ([#63](https://github.com/YgorPerez/send-lab/issues/63)) and
`login` ([#66](https://github.com/YgorPerez/send-lab/issues/66)) — leaving
`program` ([#65](https://github.com/YgorPerez/send-lab/issues/65)) as the last
one to build and `studies` behind [#37](https://github.com/YgorPerez/send-lab/issues/37).

**#64 came in at twice its estimate, and the miss is instructive.** `welcome`
was costed at ≈ 1.5 × `train` against `train`'s 500 lines (297 in the route, 203
in its resolver). It landed at ≈ 1,500: 727 in the route, 344 in
`screens/welcome.ts`, 130 in `store/baseline.ts`, 115 in `lib/baselineDraft.ts`
and 190 in the two new primitives. Sizing it from the old *components* rather than
the old route was right and still not enough, because the estimate was counting
screens. **A page that writes brings a store module and a resolver with it**, and
`welcome` is the first of the nine to write anything but a preference — so it paid
for `store/baseline.ts` and for the fourth ephemeral store as well as for its own
markup. `week` and `program` both write, and both should be read as carrying that
same third module. The five-screen headline is unchanged; what moves is which of
the five are cheap.

**The desktop layout does not change these numbers**, which is the whole point of
how #52 answered it. Two of the five unbuilt pages get a second column (`week`,
`program`); the other three compose through `Panes` with a single argument and are
done. The one line the estimate gains is that a page ticket now has to say which
of the two it is — see [the desktop layout](#the-desktop-layout) above.

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
