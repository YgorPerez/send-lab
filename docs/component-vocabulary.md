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
| `button` | `kind` primary/quiet/bare/clock · `size` sm/md/lg/touch | `quiet` is the default; `primary` is rationed to one per screen. `touch` is 48px. `clock` is a clock's start, pause and resume off its field: a 2px dim-ink outline, no fill, never vermilion (#114); pair it with `touch` or larger |
| `option` | `on` · `width` auto/full | A choice in a picker. `full` is Direction B's finding, kept though its direction lost. |

### Components — `ui/`

| Name | File | What it is |
|---|---|---|
| `Eyebrow` | `primitives.tsx` | The furniture rank of the type scale |
| `ScreenHeader` | `primitives.tsx` | How every screen opens (#114): the title in the top rank and the screen's only `<h1>`, an optional meta line, an optional lede, and one `reading` *or* one `action` on the right. Nothing the page draws comes before it |
| `Section` | `primitives.tsx` | Heading, optional right-hand meta, body. `face` picks the heading's face: `sans` (`.h-section-sans`, the overhaul's) or the retiring `mono` default; each screen ticket moves its own (Today since #117, Train since #118) |
| `Bare` | `primitives.tsx` | A group with a rule above it and no box |
| `Empty` | `primitives.tsx` | What a group says when it has nothing to list: a `Bare`, one line of `Prose`, and the one affordance that fills it |
| `Prose` | `primitives.tsx` | Training copy with its inline `<b>` rendered |
| `Meter` | `primitives.tsx` | A 0–10 reading against a track |
| `Stat` | `primitives.tsx` | One reading in a divider-separated strip |
| `Pane` | `primitives.tsx` | A page's single pane, capped near the phone measure: `max-w-pane` (560px, `app.css`), the one width every surface in the page's column shares — the full-screen clock's rows, the editor, the mini bar. From `lg` it starts on the measure's left edge rather than centring (#115) |
| `Panes` | `primitives.tsx` | A page's two panes from `lg`, stacked below it. `stickySecondary` holds the second pane in view while the first scrolls, 16px under the strip, scrolling inside itself when taller than the window (Log's open day, #120) |
| `StickyStrip` | `primitives.tsx` | A strip held under the 44px app bar while the page scrolls beneath it — the clock on Train. Its `backdrop-blur` traps a fixed descendant, which is why the full-screen clock is a portalled dialog |
| `BottomBar` | `primitives.tsx` | A bar held at the bottom of the screen while the page scrolls above it — the Timer screen's mini bar (#111), a clock running behind the list. Fixed, so no ancestor may carry a `backdrop-filter`; it leaves its own height at the end of the page so the last row scrolls clear of it. It sits on the navigation bar (`--nav-clear`, #115), and from `lg` right of the rail on the measure's left edge, capped at `max-w-pane` as `Pane` is |
| `Picker` | `Picker.tsx` | The one select — variant, add-exercise, per-set grip. `wrap` lets the label take a second line instead of truncating, and `chevron={false}` gives a set-grid cell its 18px back: the pt-BR grips clipped to "Slop…" and "Half…" in a 68px cell (#118) |
| `RowGroup` / `Row` | `Rows.tsx` | The expanding row, in one card; Log's timeline and the Timer's preset groups. `multiple` lets several rows stay open; `value` / `onValueChange` hand the open rows to the caller (the change arrives before it renders, with the press that made it). `touch` gives a row a 48px head in the rows' 15px semibold, for a list worked through mid-set. `aside` is for a list whose detail the page shows beside it from `lg` (Log, #120): there the panel and chevron are hidden, and `current` marks the row being shown with the selection language. A head's focus ring is drawn inside, since the card's `overflow-hidden` cut the outside one to a line or two. The trailing chevron is the row icon (18px, stroke 2, faint). `useRowsInPlace` and `RowsEnd` keep the tapped head under the finger as rows close (below, *Log as one timeline*) |
| `RowMenu` | `Menu.tsx` | A row's ⋯ (#119): Base UI's menu behind a separate, bordered, filled 44px square centred beside the row, Train's clock-button shape, never stretched to the row's height (or the 48px square in a dialog's header), labelled with what it acts on. A row with one action does not get one: put that action where the row leads. Takes `{ label, onSelect }` actions in order; nothing in it is coloured apart, and a destructive item's guard is the `AlertDialog` the caller opens next |
| `Sparkline` | `Sparkline.tsx` | The one chart the rebuild still has data for |
| `Switch` | `Switch.tsx` | On or off — a preference in force or not. Base UI, so it announces as a switch; state is the chalk fill, never opacity |
| `AlertDialog` | `AlertDialog.tsx` | A question that must be answered before something irreversible. Base UI; modal, not dismissable by clicking outside, its confirm the one `primary` on its surface |
| `Segmented` | `Segmented.tsx` | A small closed set of choices, all on one line — short fixed tokens only (`kg`, `Yes`, `4`). Promoted out of Settings by #64 when a second screen needed it. A `fieldset`; `labelledBy` names the group after the row that asks it |
| `ControlRow` | `primitives.tsx` | One control on its own 44px line: what it is on the left, the control on the right. Promoted out of Settings by #105 when the cue settings needed it on a second screen |
| `Stepper` | `Stepper.tsx` | The stepper shell: a progress rail, one step's content, and the two controls. It owns where the screen's one `primary` goes. A step's rail label is optional (the readiness check's six to nine segments have no room for words at 360px), and in a container taller than it the controls settle at the bottom (#116) |

## The domain pieces — `src/components/`

| Name | Owns |
|---|---|
| `AppShell` | The chrome: the top strip (wordmark, sync state, one screen action), the frame `main` sits in, the view-transition names (#115) |
| `Navigation` | Every destination: a bar on a phone's bottom edge (Today, Train, Timer, Log, More), the same `<nav>` as a 200px rail from `lg`, and More's sheet. Marks the current destination from the matched route, never from the router's own link state (#115) |
| `SyncStatus` | Whether work is still on this device: nothing at all, `Offline`, `Sending…`, or the refused-work announcement |
| `Timer` | The protocol clock: its tick, the cues it asks the planner for, its setup, and its two faces — the strip and its run in the full-screen clock. Which screen's draft it keeps is its `home` (`ClockHome`, `'train' \| 'timer'`), never a "slot"; where its strip goes is its `strip` — in the page on Train, the mini bar on the Timer screen's list |
| `FullScreenClock` | The one full-screen dialog both clocks run in (spec #98: it "takes either a protocol run or a stopwatch run"): the header, the face as a tap target, the detail, the readout and the 56px control row, and the layout on a phone held sideways. Each clock hands in its status, reading and controls; `Face` draws the number for both, and sizes it by its glyph count against the one `--face` it sets from the screen. It also owns the two things both clocks draw with: `SEGMENT_COLOR`, the colour each segment runs in (the field, and the dot beside a segment in the ready state and in `ProtocolRows`), and `clockControl`, the control row's three shapes on a field and off one. Not `ui/variants.ts` recipes: both know the clock's field, which makes them this piece's decisions (ADR 0010) |
| `ProtocolEditor` | How a saved protocol is typed in: an optional name (its placeholder the shape an unnamed one is listed under) over `ProtocolRows`, and when to say a field cannot run (`readProtocolForm` decides that it cannot). Its own screen since #112 — a full-viewport dialog with ✕ and Save at the top — not a sheet over a blacked-out list |
| `ProtocolRows` | The seven numbers as rows in the order a run goes (prepare; rounds: work, rest, how many; sets: how many, rest between; cooldown — the first group headed **Rounds**, never "Block", which is the glossary's run of weeks), each a label, a value the numeric keyboard opens on, and 48px − / + (#112). The editor's body and `/train`'s Adjust. A time reads m:ss from a minute up and is typed in seconds; the step (`nudged`) and the reading (`shownOf`) are `screens/timer.ts`'s |
| `Stopwatch` | The count-up's tick, its laps, and the same two faces — the mini bar and full-screen — in the clock's type and controls, through the same `FullScreenClock`, on a neutral field: running or paused is said in the word and the weight of ink, never a segment's colour (#110). Every lap is listed under its number |
| `CueSettings` | Which cue preferences exist and how each is asked — the countdown as a choice of lengths, the rest as switches. Mounted in Settings and behind `CueSettingsShortcut`, the Timer's screen action in the top strip (#119) |
| `SetEditor` / `SetTable` | How seven loggable fields fit 360px, and how a past set differs from a live one |
| `TaskCard` | One task mid-session: header, prescription, sets. Open or folded to its header (#118), which the page decides; held and done marks on the header; the sets counted against `setTarget` |
| `ReadinessCheck` | The readiness check as a sheet, one question per step (#116): the step `lib/readinessFlow.ts` names, its rationale and study collapsed under it, its options with nothing preselected. Full height from a phone's bottom edge, a 400px dialog centred from `lg`. Today holds the answers; the sheet holds only which step is showing |
| `SelfCheckSheet` / `RehabStarter` | The injury self-check and the rehab switch. The sheet has the readiness check sheet's shape since #117 (title row, 44px close, 200ms, a 400px dialog from `lg`), as tall as its content |
| `WorkingLoadAsk` | The ladder put at first contact with a weighted exercise, and what the athlete is told about the two numbers under its third rung. One step since #118: four rungs, then what the chosen one needs, then one `quiet` Set load; folded to one line once the task has a set ticked |

Supporting modules, all pure and all in `src/lib/`: `format.ts` (display strings),
`ids.ts` (identity), `readinessFlow.ts` (which question the readiness check asks
next, and where a reopened one resumes), `protocol.ts` (the timer's arithmetic, and which cue
each transition fires), `stopwatch.ts` (the stopwatch's, and its laps), `cues.ts` (playing those cues: its beeps, haptics and voice), `timerSetup.ts` (the clock's draft: restored paused, one per screen, and on the Timer screen one per protocol), `stopwatchDraft.ts` (the stopwatch's draft, paused and unscoped), `recentProtocols.ts` (the Timer screen's Recent: the last protocols run, as keys, on this device), `wakeLock.ts` (keeping the screen on while either clock counts), `loggedSet.ts` (which of the seven per-set fields an
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
device and `tests/motion.test.ts` asserts exactly three such names (`topbar`,
`navigation`, `screen`).

## Where a screen's data comes from

Added by [#56](https://github.com/YgorPerez/send-lab/issues/56), which replaced the
prototypes' frozen snapshot with the store. A page composes from the vocabulary
above and reads from exactly two things:

| Layer | Lives in | What it is |
|---|---|---|
| The store | `src/lib/store/` | Seventeen keyed row sets (ADR 0007), and `useTrainingRecord()`, which assembles them into one `TrainingRecord` |
| The screen resolver | `src/lib/screens/` | `resolveToday` / `resolveTrain` / `resolveLog` — pure functions of `(content, record, now)` — and `resolveTimer(content, record, locale)`, which lists the presets and saved protocols as `ProtocolListing`s, names each the way the clock's strip does, and orders what the clock can run |

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
active account. The page's full-name switch is the only one since #115 took the
strip's `EN` / `PT` switch out (spec story 12).

**Settings is reached from More** on a phone and from the rail at `lg` (#115). It
was a gear in the strip, then a row in the menu.

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
fills it. `quiet`, because an intake is not what Today is opened for (its one
primary is the readiness check's invitation since #116).

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

## The overhaul's foundation

Settled by [#114](https://github.com/YgorPerez/send-lab/issues/114), the first
ticket of the UI/UX overhaul ([#113](https://github.com/YgorPerez/send-lab/issues/113)).
`DESIGN.md` carries the full patterns (the grid, the header, the group pattern,
icon sizes, the clock control); this is what landed in code and how a screen
ticket uses it.

**Spacing is named, not picked.** `app.css` adds five steps to Tailwind's
spacing scale, so they work under every spacing prefix:

| Token | Value | Use it for |
|---|---|---|
| `sections` | 28px | Between a screen's sections, and below its header (`gap-sections`) |
| `group` | 10px | A section heading to its body; groups inside a section |
| `row` | 6px | Rows of one list that are each their own surface |
| `inset` | 12px | Inside a group's surface: under a `Bare` rule, a `card({ pad: 'sm' })` |
| `gutter` | 12px, 20px from `lg` | The page's side margin and the gap between two panes; one variable, so `px-gutter` is right at both widths |

`Pane`, `Panes`, `Section`, `Bare`, `Empty`, the small `card` and the shell use
them already. Every screen ticket moves its own literal steps to them (Train in #118, the
Timer in #119). The inside of a
component keeps the plain 4px steps.

**Every screen sets its title through `ScreenHeader`.** The right-hand side is a
`reading` (a count or reading about the whole screen, baseline-aligned) or an
`action` (one icon control, centred, because an icon has no baseline), never
both, and the types refuse both. Neither sets the title's height: the slot
overhangs the title's 24px line by up to 10px each way, so a 44px control beside
it leaves the title where every other screen has it (before that, the title sat at
61.5, 69 and 71.5px across the screens and jumped on navigation). Today's week
reading is a link and goes in `reading`. A screen action goes in the top
strip's slot since #115 (below), and the header keeps readings: the Timer's cue
settings moved there in #119, so no screen uses the header's `action` today. `tests/screens.test.ts` asserts
every screen opens with it.

**Two decisions for later tickets, written in DESIGN.md.** From `lg`, every
page starts on the measure's left edge: a one-pane page keeps its 560px cap but
stops centring, so the wordmark and every title share one left edge (#115 does
it with the rail). And off the coloured field, every control in the clock's row
takes `kind: 'clock'`, the side ones included, so a paused row is one language
(#118).

## The navigation

Built by [#115](https://github.com/YgorPerez/send-lab/issues/115) from spec #113's
navigation decisions; [ADR 0018](adr/0018-the-desktop-layout-is-css-below-the-shell.md)'s
2026-11-07 amendment carries why the bar came back.

**One `<nav>`, two stylesheets.** `Navigation.tsx` is a bar fixed to a phone's
bottom edge (Today, Train, Timer, Log, More) and, from `lg`, the same element as a
200px rail under the strip listing every destination. Week and Settings are in the
`<nav>` as `hidden lg:flex`; More is `lg:hidden`. A new page is a row in
`DESTINATIONS` with `place: 'more'`: it lands in More's sheet and in the rail, and
the bar stays four plus More.

| | Bar (phone) | Rail (`lg`) | More's sheet |
|---|---|---|---|
| Height | 56px plus the home indicator; items ≥ 48px | rows 44px | rows 48px |
| Item | 22px icon (stroke 1.75) over an 11px label that wraps | 22px icon beside a 13.5px label | 20px icon, 15px label, 18px chevron |
| Current | chalk, semibold, a `panel-3` pill behind the icon | chalk, semibold, a `panel-3` row | chalk, semibold, a `panel-3` row |

More is marked current (`aria-current="true"`, same look) on any destination it
holds, so the bar never shows the athlete as nowhere. A destination can hold a
route it has no row for: Settings holds `/login`, which is reached from it
(`holds` in `DESTINATIONS`).

**The bar's box is exactly what the page reserves.** `h-[var(--nav-clear)]`,
border-box, so its border and the home indicator's padding are inside the 56px and
the inset; the rail is `w-50`, border-box, so it is the 200px of `--nav-rail`. The
first build had `box-content`: the rail measured 217px and its border sat 3px
from every title between 1024px and about 1215px, where the centred measure has
no margin to hide it. The screenshots at 1280px did not show it; the critique's
box arithmetic and a measurement at 1024px did (#115).

**The `<nav>` comes before `main` in the document**, though a phone draws it
below: a keyboard reaches the rail without tabbing through the whole screen, and
a screen reader meets the landmark first. **More's sheet is never hidden by
width**, only its trigger: a sheet left open as the window crosses `lg` stays
visible and closable instead of a hidden modal holding focus. **The update notice
sits under the sheet** (`z-[35]`, below the backdrop), because the sheet opens over
the place the notice sits and the notice on top hid its first row.

**The current mark comes from `here`, never from the router's link state.** The
shell is baked once, at `/`. With `Link`'s own active state the baked bar marked
Today, a cold start on `/timer` hydrated over it, and React does not patch an
attribute that differs on hydration: Today stayed marked on every screen. Every
test passed and `check:hydration` stayed green (production React does not report
an attribute mismatch); a screenshot found it. So each item is an `<a>` from
`useLinkProps` with the router's `aria-current` and `data-status` dropped, marked
from `here`, which `__root.tsx` hands down only once the app has hydrated.
`tests/navigation.test.ts` renders the navigation with `here: null` on three URLs
and asserts nothing is marked.

**What the page clears is two CSS variables, not a height read in the shell.**
`--nav-clear` (56px plus `env(safe-area-inset-bottom)` on a phone, 0 from `lg`)
and `--nav-rail` (200px from `lg`, 0 below), both 0 on the intake through
`:root:has([data-navigation='none'])`. `main` pads its bottom by `--nav-clear`;
the update notice and the Timer's mini bar (`BottomBar`) sit on it; the frame and
the strip pad left by `--nav-rail`. Anything else fixed to the bottom of a screen
sits on `--nav-clear` too, and pads for the home indicator only by what the bar
does not already cover (`max(0px, env(safe-area-inset-bottom) - var(--nav-clear))`).

**The keyboard never sits the bar on a field.** The viewport meta says
`interactive-widget=resizes-visual`, so where it is honoured the bar stays under
the keyboard. Where a browser resizes the page instead, `app.css` hides the bar
below `lg` while a field that opens the keyboard has focus (`html:has(…:focus)`).
Measured on the built app: Train's RPE input focused, the bar is `display: none` at
360px and the rail is unchanged at 1280px. `scroll-padding-bottom: var(--nav-clear)`
keeps a control reached by Tab clear of the bar.

**The route decides the rest, through `staticData`.** `lib/chrome.ts`'s `chromeFor`
reads two keys: `navigation: false` (the intake: no bar, no rail, nothing reserved)
and `screenAction`, a component the strip renders on its right as the screen's one
action. Read in `__root.tsx` and held at the baked answer (navigation, no action)
until the app has hydrated, the same deferral the locale gets. The Timer names one,
its cue settings (#119); the strip renders it in the strip's locale, so a screen
action takes `locale` as a prop rather than reading the ambient one.

**From `lg` a page starts on the measure's left edge.** `Pane` no longer centres
in the 1000px measure, so a one-pane page's title, a two-pane page's title and the
strip's wordmark share x=252.5 at 1280px (x=220 at 1024px, 20px right of the rail). The window reserves the scrollbar's gutter
from `lg` (`scrollbar-gutter: stable` on `html`), so a long page and a short one
are the same width and nothing moves sideways between them.

**A new spacing token is two edits, and the second is easy to miss.** Add it to
`app.css` and to `twMergeConfig` in `lib/utils.ts`; `tests/spacingTokens.test.ts`
fails until both agree. The reasons are the next two rules.

## The readiness check sheet

Built by [#116](https://github.com/YgorPerez/send-lab/issues/116) from spec
#113's readiness check decisions.

**What comes next is a pure function, and it is "the next step", not "the next
unanswered one".** `lib/readinessFlow.ts` takes the answers and nothing else:
`checkSteps` (the six core questions, each follow-up straight after the question
that revealed it), `openingStep` (the first unanswered step, or the first step
when all are answered), `stepAfter` and `stepBefore`. The list is recomputed on
every call, because a pick can add a follow-up (poor sleep adds stress and drive)
or withdraw one. A pick moves to `stepAfter` the answers *with* the pick, so the
follow-up it calls for comes next and the rail grows by a segment while the
athlete watches. Moving to the next unanswered step instead would close a
finished check on the first changed answer, so editing would cost a reopen per
question.

**Every pick advances except the last.** On the last step the pick stays on
screen and the advance reads Done and closes the sheet. The advance is the
`Stepper`'s, so it is the sheet's one `primary`, disabled with "Pick an answer to
go on" until the step is answered (ADR 0021: nothing is preselected, and the
advance does not skip). Closing with ✕ is always there and keeps every answer: the
draft is still idiom 2's `readinessDraft`, written on each pick.

**The step is the sheet's state, and it starts fresh on every open.** It lives in
a component inside the popup, so the lazy `useState(() => openingStep(answers))`
runs when the sheet opens and no effect keeps it in step. A step the answers have
since withdrawn falls back to `openingStep`. Each step's question is an `h3`
focused as it arrives, so a keyboard or a screen reader lands on the new question
instead of on the option that just unmounted. When the sheet closes, focus goes to
the verdict's heading (the invitation while there is no verdict) through the
popup's `finalFocus`: the button that opened the sheet is usually gone by then,
and the critique measured focus falling to `body`.

**A pick that lands as a question arrives is not an answer.** The next question's
options sit where the last one's were, so a double tap or a bounce answered a
question the athlete never read, which is ADR 0021's fabrication by another
route. A pointer pick within 350ms of the question's arrival is dropped; a
keyboard press (`detail` 0) never is.

**"Why we ask" is a `<details>` under the question**, closed. The old inline list
clamped it to two 11px lines on every question; in a step it is one tap away and
costs 44px. The study link is the in-text 12px icon beside its word. The only
motion in the sheet is the sheet itself (200ms, Base UI's `data-starting-style`
and `data-ending-style`) and the disclosure's chevron, both finished in one frame
under reduced motion by `app.css`'s rule.

**A follow-up says what it asks about, when it asks about one answer.** "How does
it feel?" is about the answer one step back, which is off screen, so the step
carries "Anything hurting today? · Elbow" in a faint line above its own.
`followsFrom` in `readinessFlow.ts` names that answer, and only the severity
question has one: stress and drive join on poor sleep *or* low recovery, skin on
the whole wellness read. The first build took the question displayed above each
follow-up, which is where it sits rather than why it is asked, and read "How
recovered do you feel? · Fresh" over a stress question that poor sleep had called
for.

**Today has one way in for each state.** No wellness answer (`hasWellnessAnswer`,
unchanged): the read's place holds the invitation, and it is Today's one
`primary`, which is why the bodyweight nudge's Save dropped to `quiet`. With a
read: the read's card ends in a summary row, "Readiness check" over "6 of 7
answered". While a step the answers call for is open, the verdict above it is
computed without that answer, so the row carries a gold mark and a bordered
(`quiet`) Continue; once none is, a `bare` Edit. Continue opens on the first
unanswered step and Edit on the first. The
summary is inside the read's card rather than a row of its own, because a row one
section gap (28px) below the read looked like a separate thing. #117 kept it there.

**The sheet is More's sheet, taller.** Same backdrop, panel, title row and 44px
close, same 520px cap and 200ms rise. It runs from the bottom edge to 12px under
the status bar, so the controls sit at the thumb whatever the question's length.
From `lg` it is a 400px dialog, 42rem tall or the window less 4rem, centred, and
it fades instead of rising, since there is no edge for it to come from. The
height is fixed so the controls do not move between steps.

**Today got shorter, and its floor came down with a measurement.** Seeded, Today
measured 4361px at 360px and 2476px at 1280px with the questions listed; with the
sheet it is 2521px and 1776px. `check:contrast` counted 103 text elements seeded
and 52 empty where it counted 154 and 99, so `scripts/floors.ts` holds `/` at 75,
the same quarter under the measurement as before.

## Today as a summary

Built by [#117](https://github.com/YgorPerez/send-lab/issues/117) from spec #113's
Today decisions.

**The order is the decision, then what comes after it.** On a phone: the read (or
the invitation), today's plan, the flags; then the outcome ask, the counters, the
trend, bodyweight and the injury entry. The plan carries the held work on its tasks
and the carry-forward inside its card, and the baseline line (#64) stays directly
under it. Before #117 the counters and the trend sat between the plan and the flags,
so the flags were the seventh thing down. The desktop cut is the same line: `Panes`
takes everything up to the flags as the primary pane and everything from the
outcome ask as the secondary, so the phone order is the reading order at both widths.
`tests/today.test.ts` asserts the order as the order the text appears in `<main>`,
seeded and empty, on a training day and the rest day, in both locales.

**One primary in every state, and it moves with the check.** Unanswered, it is the
invitation in the read's place (#116). Answered, it is "Go to Train", a full-width
`lg` link after the watch-outs: the last thing the decision pane says, so a problem
is read before the athlete starts (story 36). The first build put it at the foot of
the plan, ahead of the flags; the critique caught it. It replaced two weaker ways in:
the plan heading's "View today's session →" and a 44px "Train ›" link on every task
row, which pointed at the same screen five times. A rest day with a read keeps it:
Train is where an unplanned session is logged, and the spec's rule is one primary in
every state. The rehab starter's "Switch to rehab program" was a second filled
primary whenever it was opened on Today; it is `quiet` now.

**The outcome ask waits for something to rate.** An **outcome** is how a session
went, said afterwards (`CONTEXT.md`), and the ask used to sit under the verdict
every morning, four buttons about a session that had not happened. It shows once
today's session is trained (a set ticked in the record, which `resolveToday`
returns as `sessionToRate`) and names it by the day type it recorded: "How did
today's Pull session go?". A tick on Today does not count: ticks there are the
page's own state, gone on reload, and a stray one summoned a question about a
session the record never held. Its picks use `option`, the app's one selection
language; selected was teal, the ok colour, which made a picked "Bailed" read as
fine. Where the outcome is kept is not this ticket's: it is still the page's own
state, as it was.

**A flag says its severity twice, in colour and in the locale.** The card's tone
and a dot beside the title carry the colour (a mark can carry a colour a label
cannot); the chip carries the word. It printed the raw id, `stop` or `warn`, in both
locales until #117.

**The header's right side is a reading again.** "Week 5 / 8" was a link to Week
while nothing else led there. The navigation carries Week since #115, and a faint
11px link that looked exactly like the other screens' readings was a control
nobody could see, so it is text. The date under the title is Inter: it has a month
name in it, and DESIGN.md keeps mono for meta that is all digits.

**Colour on Today reports state only.** Three things wore an accent without one:
the verdict's first focus chip was always `stop` (the recommended "repeaters" in the
stop colour), the streak was vermilion (a red **0** on the rest day that reset it),
and the bodyweight change was teal for a loss and gold for a gain, on a violet line.
The chips are neutral, `Stat` lost its `accent` prop, and bodyweight is in ink.

**The plan card leads with today.** Today's headline (13px ink) and the day's
supporting work come first, and the block phase follows in one faint line. It was
the other way round, the phase in chalk and today's headline in the faintest line,
though the phase's banner is the same text for weeks.

**Heights.** Seeded at 360px, Today measures 2487px in en-US and 2527px in pt-BR
(4361px before #116, 2521px after it); at 1280px, 1490px and 1507px. The floor of 75
elements still sits a quarter under the 104 `check:contrast` counts.

## Train with one task open

Built by [#118](https://github.com/YgorPerez/send-lab/issues/118) from spec #113's
Train decisions.

**One primary, and the clock is a tool.** "Finish and log the session" is the only
`primary`. Every control in a clock's row off its field is `button({ kind: 'clock' })`,
on Train's strip, on the Timer list's mini bar, in the full-screen clock's ready Start
and its paused row (back, resume, reset), and on the stopwatch, so the Timer screen has
no primary at all. The task card's clock button, which says which task the clock runs,
takes the selection mark (chalk on `panel-3`); it was vermilion, a second one next to
the primary.

**One task open, chosen by the page.** `train.tsx` holds `chosen`: `null` means "the
task being worked on", re-derived each render by `currentTask` (`lib/screens/train.ts`):
the first with a set left that today's verdict did not hold, then held work. A tap pins
another task or folds the open one. A tick that finishes the open task hands the choice
back to the default, so the next opens without anything having to notice. Before this,
every task drew everything and seeded Train ran to 3,909px; it is 1,614px now (360px,
seeded), 1,796px empty.

**A set left is counted against the prescription.** A task opens with one row, and the
athlete adds the rest with Add set. Counting rows, ticking that one row finished a task
prescribed four to six sets and folded it away from its own Add set. `setTarget` is the
larger of the rows and the prescription's lower bound; the folded line, the header's
reading and the advance all use it. Today's done (any set in the record) is a different
rule and was left alone: changing it is domain behaviour.

**A tick that moves on moves focus.** Folding the card unmounts the tick that did it, so
focus fell to the page, and the next card could open under the sticky clock. The handler
leaves a note in a ref, and an effect keyed on the open task scrolls the new card clear
of the clock and focuses its header. Scroll the card, not the header: the card's
`overflow-hidden` makes it a scroll container, and `scrollIntoView` on the header moved
nothing (measured in the browser; jsdom has no `scrollIntoView` at all).

**Held work is marked as Today marks it.** `heldToday` (`lib/screens/today.ts`) reads the
same readiness draft Today writes, at mount, so a task does not become held mid-session.
The warn chip sits at the end of the header line; pt-BR's reads "retido · prontidão" on
both screens ("segurado" means insured).

**The working-load ask is one step.** The ladder as one choice with nothing pressed (ADR
0019), the chosen rung's field (labelled, not placeholdered: "Kg adici") or reason, one
`quiet` Set load and the line saying what it waits for. It folds to "Not set yet" once a
set is ticked on the task, since the athlete has trained past it.

**Session tools after the tasks**, one `Section` in Inter: add exercise, repeat last
session (its reason on the line, not in a `title`), the note with a visible label,
minutes, the autosave line. Then the finish, disabled with its reason.

**Not done here, and why.** Finish and Repeat last session have no handler; that predates
#118, and wiring them is new behaviour. The set rows are bordered boxes inside the card,
and the open card's band labels are mono eyebrows; both predate #118 and are #125's.

## The Timer list

Built by [#119](https://github.com/YgorPerez/send-lab/issues/119) from spec #113's
Timer decisions.

**Saved first.** Saved, then the stopwatch's row, Recent, Presets. The stopwatch
stays one row with no heading of its own (a "Stopwatch" head over a "Stopwatch" row
says it twice); its leading icon is what sets it apart from the protocol rows above.
The sections sit `gap-sections` apart and their heads are `Section face="sans"`.

**Presets are one `RowGroup`**, a `touch` row per exercise (its name and a count),
`multiple`. Today's groups lead it, open, each head saying "Today": `todaysPresetGroups`
(`lib/screens/timer.ts`) reads the plan's exercises for today and keeps those with
presets, in list order, read once at mount. Seeded Thursday leads with Sloper Density
and Abrahangs; a rest day opens none and keeps the library's order. Inside a group the
presets are lines in the card, not surfaces of their own (a card is never inside a
card), their names in the head's 15px so a child does not outrank its head.

**Only a saved protocol has a ⋯ on the list** (Edit, Duplicate, Delete, Edit first).
A preset's one action is a copy, and it is in the preset's ready state: on the list it
was a menu of one item beside every preset, the loudest outline in the card, and it
took 50px off every name (the critique's finding).

**Each open group ends on its study**, through `StudyLink` (`Timer.tsx`): "Study:
<title>" and the 12px external mark, on the rows' left edge, the same component the
clock's ready state uses, so every citation on the Timer is one sentence shape. An
exercise with no study (Wrist / Sloper Strength) has no line.

**The selection is the bar's, plus Train's edge.** The protocol the clock is on (the
row last opened, or the one the clock was left in) carries `aria-current="true"`, a
`panel-3` surface, a `chalk/60` border and chalk on every line, with its shape line in
semibold, since the name is semibold on every row. The border is not in the bar's mark
and is needed here: the bar starts from faint ink on the ground, a row from ink on a
panel, and the surface step (1.27:1) and chalk against ink (1.11:1) alone did not show
which protocol the mini bar runs. Train's clock button and a picked option carry the
same edge. A fresh visit marks nothing rather than whatever is listed first. The same
protocol listed twice (Recent and its group) is marked twice.

**Closing a group keeps the page as long as it was.** Presets is the end of the page,
so a close near the end would clamp the scroll and slide the list under the finger.
The page measures at the press, before the change renders (the panel takes 190ms to
close, so nothing has moved when the render lands), and holds back at its end what
the closing panel takes that the room below the screen cannot absorb; an open hands
it back. The #111 version scrolled by what the head moved after the render, which
reads zero once the panel animates.

**The cue settings are the strip's screen action**, a 44px ghost square (no border:
alone on the strip's right it is attached to nothing larger, and a border would sit
on the strip's edges), its icon 20px at stroke 1.75. Its focus ring is drawn inside
(`-outline-offset-2`): the control is the strip's full height and the global ring, 2px
outside, fell off the top of the window.

**Heights.** Seeded `/timer` at 360px: 1,747px (en-US), 1,807px (pt-BR), with
today's two groups open; 1,685px at 1280px. Empty (the built-in week, same two groups):
1,698px at 360px as `check:contrast` prints it. The spec's starting point was 2,192px.

## Log as one timeline

Built by [#120](https://github.com/YgorPerez/send-lab/issues/120) from spec #113's
Log decisions.

**One row per date.** `resolveLog` returns `days`, newest first, each a date with
an optional `check` and an optional `session`, and `counts`. Reading a day used to
mean matching two lists by date. A date with two checks keeps the later one (the
athlete can re-check within a day, and the later answer set that day's verdict),
so `counts.checks` counts what the timeline shows. The closed row is one line on a
common grid: the date (11px mono), the score, the day type the session recorded
(13px; "No session" in faint ink when there is none), and its sets, counted
("5 sets", never a bare number). The day type wraps at its spaces and the count
drops under it when the two do not fit: pt-BR's "Limite / Potência" was cut at
360px, and wrapping anywhere split "Performance" at 320px. An exercise logged
with no numbers says "1 set, no numbers recorded" (`SetTable`'s `empty`), so the
row's count matches what it opens to.

**The score's colour is its verdict's state, on a mark.** `VERDICT_TONE` in
`screens/log.ts`: `green` and `short` are ok, `moderate` and `tissue` warn, `rest`
stop. The library paints `green` and `short` in vermilion, so a good day's score
was red (spec story 61). The tone is an 8px dot beside the number, which stays
ink: a dot needs 3:1 on whatever surface the row takes (the selected row is
`panel-3`), where the accents as 11px text do not clear 4.5:1 there. Today's
verdict dot still reads the library colour; that is the sweep's (#125).

**The header says what it counts.** "28 sessions · 15 readiness checks" is the
meta line, Inter, singular at one (the message format has no plurals, so each
count has a `_one` and an `_other` key). The title is the bar's word, "Log" /
"Registro", as Train's is.

**A phone opens on the timeline; the pane beside it always shows a day.** The
open row (`open`, a phone's accordion) and the day the pane shows (`picked`, from
`lg`) are two pieces of state. Nothing is open on arrival: the first build opened
the newest day, about 650px of detail repeating what its row already said, and
the critique found the phone's first screen spent on it. The pane shows the last
day opened, the newest until one is, and closing a row leaves it there, so a wide
screen never shows an empty second pane. A day opens to its check (the score
and verdict, its flags in their severity's tone as on Today, each question against its answer, the outcome) and its
session (each exercise's sets, the note), each under an Inter head with its time
or length on the right. "Conclusion" and "Your responses" are gone: the glossary
rules out *conclusion* for the verdict, and the answers need no label under the
check's head.

**From `lg` the open day sits beside the timeline**, in `Panes`' second pane, held
in view (`stickySecondary`). The pane is a `section` named by its date and a tab
stop, capped at the window less 116px and scrolling inside itself: any taller and
at the page's end the grid's bottom pushed it under the strip. The rows are
`aside`: from `lg` their panels and chevrons are hidden and the `current` row is
marked with the selection language plus the chalk edge (`panel-3`, a `chalk/60`
inset ring, chalk on every line). The timeline is headed by a visually hidden h2,
because each row is an `h3`. The detail is rendered twice, once in the row's panel and once in
the pane, and CSS shows one: the pane is not on a phone at all, so the split stays
contiguous in the phone order. Nothing reads the viewport (ADR 0018).

**The tapped head stays under the finger** (`useRowsInPlace`, promoted from the
Timer's preset groups now a second list needs it). Two things move it. A list at
the page's end that closes a row shortens the page under the scroll position:
`RowsEnd`, put last on the page, takes what the room below the screen cannot
absorb. And with one row open at a time, opening a row below the open one closes
the one above, so the head rises by that row's height: the page follows it,
scrolling by what it moved each frame for as long as the panel takes to close.
Measured in Chrome at 360px: a head at y=500 stays at 500 on every frame while a
632px day above it closes, animated and under reduced motion; closing the last
open day at the page's end holds 375px and hands it back on the next open. A
closed panel has no `aria-controls` in Base UI, so the head is found by
`aria-expanded`.

**Heights.** Seeded `/log` at 360px: 1,713px (2,235px before #120); at 1280px,
1,636px. Empty: the viewport at both widths.

## Week: the training week and the day under it

Built by [#121](https://github.com/YgorPerez/send-lab/issues/121) from spec #113's
Week decisions (stories 65–68).

**The grid is headed in the glossary's words.** The section head is "Training week
5 of 8" / "Semana de treino 5 de 8" (`wk_training_week`, the total from
`record.program.weeks` through `WeekScreen.weekCount`), in Inter, with the
adherence on the right as a phrase ("1 of 6 trained"). "Microcycle" is gone, and so
is the header's "Week 5 / 8" reading, which said "Week" a second time beside the
title. The title stays the bar's word, "Week" / "Semana", as on every screen: it is
the page's name (spec story 3), and every place the page names the thing it shows
says *training week*. `tests/week.test.ts` asserts no other bare "week" in either
locale, aria-labels included.

**A slot's state is a shape and a colour** (`SLOT_MARK` in `routes/week.tsx`), 12px:
trained a filled teal disc, missed a vermilion cross, today a gold ring with a
centre, to come an empty faint ring, rest a faint dash. #63's 6px dots were told
apart by hue alone, and teal and gold have the same luminance (1.00:1 against
each other), so for the athlete they differed only in hue; rest was a `--line` ring
at 1.56:1 on the cell. Every mark now clears 3:1 on both cell surfaces, the lowest
being vermilion on the selected `panel-3` at 3.86:1; the test reads the tokens from
`app.css` and measures it. One cell still carries one colour system: the marks are
the cell's only colour, and the day type's accent stays on the day below.

**A legend over the grid, not under it,** so nothing sits between the grid and the
day it selects. It draws the same marks, in the order trained, missed, today, to
come, rest, as a list a screen reader can read (named "Key"), so `check:contrast`
measures its words. It wraps to two lines in pt-BR at 360px.

**The selected day sits directly under the grid** on a phone, and beside it from
`lg` (`Panes`, as before; `lg:grid-cols-7` kept). Its head names the weekday and
the day type ("Thu · Pull"), so it says which cell it answers; the state is on the
right as the legend draws it, then the load as a neutral chip. #63 tinted the load
chip by the slot's state, which painted a missed day's "HIGH" vermilion as if the
load were the alarm. A rest day's head already says rest, so its state word and
its load chip are left out there: the library's load for rest is "OFF", and the
glossary rules out *off day* (#121's critique). The headline and subhead take
Today's plan-card recipe (13px medium ink over 11px dim), so the same day reads at
one rank on both screens. Every cell `aria-controls` the day. A done task says so to a
screen reader (its ✓ is hidden).

**The selected cell** is the selection language with the chalk edge: `panel-3`, a
`chalk/60` border, the weekday chalk and semibold. A rest cell has no count (its
mark says rest; #63's faint "—" measured 4.27:1 on the selected surface), and the
other counts went from 10px to the ramp's 11px. A count is teal once any of the
slot's work is ticked, chalk until then: today's slot keeps its today mark when it
is trained, so its count is where the head's "1 of 6 trained" finds its slot. A rest cell's name says rest once
("Sun · Rest", not "Sun · Rest · Rest · Rest").

**Ready to fold into Program (#65).** The grid section names its own week, so the
header carries nothing a second week would contradict: Program can stack one such
section per training week, each with its own head, legend and grid, and keep the
day panel as the one place a slot is read in full. Nothing in it reads the page.
`Row`'s `aside`/`current` and `Panes`' `stickySecondary` (#120) were not needed: the
day is short enough that the window shows both panes whole at 1280px.

**Heights.** `/week` is the viewport at 360px and 1280px, seeded and empty, as it
was. `check:contrast` 38 elements seeded / 37 empty at 360px (39 / 38 at 1280px).

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
  an effect that compares the previous run against the current one. The previous
  run starts as the one the clock opened on, not idle: a clock restored paused
  has not moved, and counted from idle its mount was an arrival that beeped,
  buzzed and spoke.

**The one ref: a clock that hands in elapsed time.** The stopwatch shows tenths,
so its tick cannot be "one more step": `tick(watch, ms)` takes the milliseconds
since the watch was last brought up to date, read off `performance.now()`. The
instant last accounted for is a ref (`accountedAt` in `Stopwatch.tsx`), because
a lap and a pause bring the watch up to date between ticks, and that instant
must not re-render anything. It is written in the interval and in the handlers,
never during render, and every updater is still handed a plain number and stays
pure. The exception is for wall-clock time only; a clock that steps in whole
units, like the protocol, needs no ref.

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
  list. **The Timer screens set the section rank in Inter** (`.h-section-sans`,
  14px semibold `--ink-dim`): #110 decided that Roboto Mono leaves their headings
  and labels, so the list's group heads, the editor's group heads and its name
  label, and the clock's Adjust share that one class rather than a size each. Same
  rank and job as `.h-section`; the other screens keep the mono one until a ticket
  moves them. A preset group's head is not a rank but a row: a disclosure as
  tall as the rows it opens, set in the row's 15px.
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
- **tailwind-merge only drops a class it knows conflicts.** With the spacing
  tokens unknown to it, `cn('gap-sections', 'gap-6')` kept both, the
  stylesheet's order picked the winner, and Train and the Timer each grew 28px.
  `cn` and the `ui/variants.ts` recipes merge with `twMergeConfig`, which names
  the tokens. Found by screenshotting all eight routes against the base build
  (#114).
- **A spacing token's name becomes a utility under every spacing prefix.** The
  section token was first called `section`, which made `h-section` a 28px
  height on top of the type rank of the same name and doubled every section
  heading's box on five screens. It is `sections`, and
  `tests/spacingTokens.test.ts` refuses a token name that turns a class
  `app.css` defines into a spacing utility (#114).
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
did not survive a reload and an *unmissable* announcement vanished on the next app
open.
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
  which is not a sentence in either locale; without the wordmark the announcement has
  214px, and both locales fit in two lines inside the 44px strip (measured).
- **Not a second surface.** Two tokens competing in one strip is what the ticket
  ruled out in its first paragraph, so `resolveSyncState` returns one state and
  refused work outranks the other two. The price is real and recorded there: while
  refused work stands, the strip is not also reporting the connection. Exactly one
  thing ends it and it is not something the athlete can be asked to do —
  `unsynced.ts`'s `add()` drops a refusal when the *same row* is written again, so
  for an appended session the announcement never stands down. The right trade only
  because refused work is the app's most serious state and essentially never
  happens.
- **The one exception to the rationed accent fill.** `button`'s `primary` is
  otherwise the only filled vermilion on a screen, and this is the app's second
  use of it. What is reused is the *measured pair* — `text-bg` on `bg-flag` at
  6.44:1, where white would be 3.11:1 — and not the recipe: `button` owns a
  control's shape and the announcement is not a control.
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
right would slide the screen action sideways every time a task is ticked.
`tests/desktop.test.ts` holds the order.

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
ordinary strip, wordmark and all. `UpdateAnnouncement` reaches the same place a different
way.

**One reading, read once.** `useSyncState` lives beside the component and
`AppShell` calls it, because two things are decided from one answer: what the strip
says, and whether the wordmark is still what the strip is for. Two calls would be
two subscriptions to the same store deciding one strip, which is how the wordmark
and the announcement come to disagree; `tests/desktop.test.ts` holds it to one.

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

**The chrome.** `main` goes from `max-w-[520px]` to `max-w-[1000px]`, and the bar
on the bottom edge becomes a 200px rail down the left (#115). From `lg` the measure
is centred in what the rail leaves, and the strip's content sits in the same
measure, so the wordmark and every title share a left edge. See the ADR for why
keeping the difference in CSS is a constraint rather than a style, and
`tests/desktop.test.ts` for what enforces it.

> **Superseded 2026-11-07 by #115, which brought the bar back with More; kept as
> the record of why it went.** Amended 2026-09-08. This paragraph used to read "the three tabs move from the
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
| `/` Today | **two columns** | Cut at the screen's own ordering rule: *decision + evidence* left (the read, the plan, the flags), *input + secondary* right (the outcome ask, counters, trend, bodyweight, injury; #117). Measured 3222 → 2019px (en-US), 3367 → 2035px (pt-BR) before the check sheet; 1452 / 1500px since #117 |
| `log` | **two columns** | One timeline and the open day's detail beside it (#120). Until #120 the two columns were two independent lists, checks and sessions; the spec made them one list, and the second column holds what a row opens to. Seeded, 1,636px at 1280px against 1,459px as two lists, with the detail held in view; 1,713px at 360px against 2,235px |
| `week` | **two columns** | Built ([#63](https://github.com/YgorPerez/send-lab/issues/63)) through `Panes` as expected: the slot grid and the day it selects are two halves, and the cut is already the phone order. The grid also goes `grid-cols-4` → `lg:grid-cols-7` — four columns is what 360px forces, seven is the shape |
| `program` | **two columns, expected** | Unbuilt ([#65](https://github.com/YgorPerez/send-lab/issues/65)). A phase editor is the other shape that obviously wants a second column beside it |
| `train` | **capped** | Defined by the posture it is used in. Seven loggable fields laid out against 360px, stretched to twice that, put the number being typed an inch from its label. Measured: the wide layout saves it 128px, which is the bottom bar |
| `timer` | **capped** | Built ([#101](https://github.com/YgorPerez/send-lab/issues/101)) through `Pane`, for Train's reason: one list, picked one-handed, each row opening its clock full-screen (#111). Wider, a row says nothing more about a protocol |
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
- **Hit areas do not shrink.** 48px in the bar, 44px in the rail, 44px
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
`tests/screens.test.ts` asserts against — and once with no record at all, which is what a new
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
