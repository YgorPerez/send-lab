# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One athlete per account: an advanced, tissue-limited climber running an 8-week block. The same person owns the
product and trains with it. They open it at home to see what today asks, and in the gym or at the hangboard to run
and record the work.

## Product Purpose

Send Lab decides what to train today from how the athlete reports feeling, prescribes the work, runs the clock for
it, records what was actually done, and lets the prescription drift with the evidence. Success is an athlete who
trains the right dose on the right day and never has to do arithmetic or bookkeeping mid-session.

## Positioning

A training console for one athlete, not a coaching platform or a generic workout app. Every number it shows
resolves to a claim with an evidence grade and the studies behind it, and the program reacts to readiness checks
instead of running a fixed plan.

## Operating Context

- **Phone first, mid-set.** One hand, chalk on the fingers, often hanging from a board while the phone sits on the
  floor or a shelf 1–3 m away. The clock is read peripherally and operated without looking.
- **A training day moves between four places.** Today before training (answer the readiness check, read the
  verdict and the plan), then Train and the Timer during the session, then Log afterwards. Week and Settings are
  opened far less often; Program and Studies will join them. Every screen is a tool the athlete uses to get
  something done, read in seconds, never browsed.
- **Home or desk.** Planning the week, reviewing the log, editing protocols: a phone or a laptop, with
  attention to spare. The laptop gets its own layout from 1024px (ADR 0018); a tablet gets the phone's.
- **Offline is normal.** Gyms have poor signal. Writes queue on the device and sync later; the app is a precached
  PWA.
- **Bilingual.** English and Brazilian Portuguese; pt-BR runs 1.4–2× longer and breaks layouts first.

## Capabilities and Constraints

- Screens: Today, Week, Train, Timer, Log, Settings, Welcome (the intake) and Login, eight in all. Program (#65) and
  Studies (#67) are not built; the navigation keeps a place for them.
- Today decides from the readiness check: a verdict and a score, the plan they produce, and the flags. With no
  wellness answer it says it has no answer rather than scoring defaults (#61).
- Train records the session: one task at a time, a set grid of up to seven fields per set, and one action that
  finishes and logs it. Log is the history of checks and sessions.
- The intake (`welcome`) is skippable. With no baseline the athlete runs the built-in week.
- One account per athlete; two athletes can share a device, and the account is the boundary between them.
- The Timer runs protocols (presets from the library, and saved protocols the athlete makes) and a stopwatch. A
  protocol is a fixed shape — prepare, work/rest rounds, sets with rest between, optional cooldown — and that model
  is deliberate: hangboard protocols do not need free-form intervals.
- Running a protocol on the Timer screen records nothing; Train is where training is recorded.
- Domain vocabulary is binding (`CONTEXT.md`): segment, round, set, protocol, preset, saved protocol. A phase spans
  weeks and is never a segment.
- Dark only.
- Measured gates in the repo (`check:contrast`, `check:motion`, `check:overflow`, `check:hydration`) and the rules in
  `docs/component-vocabulary.md` outrank taste.

## Brand Commitments

- Name: **Send Lab**. Tagline: "climb harder".
- **Direction A is the incumbent identity** (#47, picked by the athlete on #51), and the UI/UX overhaul (#113)
  keeps it: the dark ground, the palette and its token names, Inter for words and Roboto Mono for data, with
  Barlow Condensed for the clock's numbers (#110). The token names are stored in the training content, so a
  rename blanks the day accents. Type sizes, spacing, radii, icons, component shapes and placement stay open.
- Segment colours already carry meaning and only report state: gold prepare, vermilion work, teal rest, violet
  cooldown.

## Evidence on Hand

Real studies cited by the content library (e.g. critical-force and repeater research on PubMed, coaching resources
for recruitment and pinch work). No testimonials, users, or metrics exist and none may be invented.

## Product Principles

1. **Readable from the wall.** Anything used mid-set must work at 2 m, one-handed, without looking.
2. **One screen, one job.** Show what changes the next decision; everything else waits behind a tap. One primary
   action per screen.
3. **Colour reports state.** Never decoration.
4. **Nothing the athlete has to compute.** Durations, counts and next steps are stated, not implied.
5. **Evidence is reachable, not in the way.** Claims and studies are one tap from the number they back.
6. **Learn it once.** A header, a group, an empty or offline state, an icon look the same on every screen, so the
   athlete learns each one on the first screen and reads it everywhere after.

## Accessibility & Inclusion

- Every text colour clears 4.5:1 on the surface it lands on, measured in both locales.
- Touch targets: 44 px for anything touched mid-set, 48 px for the clock's controls.
- Reduced motion means every animation finishes in one frame (ADR 0011).
- Screen-reader labels carry everything a control shows.
- On a laptop, every control is reachable by keyboard with a visible focus ring, and the navigation is one
  landmark with the current destination marked.
