---
name: Send Lab
description: climb harder. A dark, dense training console for one athlete, whose clock becomes a coloured field read from the wall.
colors:
  vermilion: "#ff5a2c"
  vermilion-pressed: "#c93b14"
  teal: "#3fd0c9"
  gold: "#e9b445"
  violet: "#9b8cff"
  ground: "#07080a"
  panel: "#232629"
  panel-inset: "#2b2f32"
  panel-raised: "#33373b"
  line: "#474c51"
  line-soft: "#34383c"
  ink: "#f1f2f2"
  ink-dim: "#b6bbc0"
  ink-faint: "#959ba1"
  chalk: "#e9e6dc"
typography:
  clock-face:
    fontFamily: "Barlow Condensed, Roboto Mono Variable, ui-sans-serif, sans-serif"
    fontSize: "min(88vw, 46dvh)"
    fontWeight: 700
    lineHeight: 0.8
    letterSpacing: "0em"
    fontFeature: "\"tnum\" 1"
  clock-segment:
    fontFamily: "Barlow Condensed, Roboto Mono Variable, ui-sans-serif, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
    fontFeature: "\"tnum\" 1"
  count:
    fontFamily: "Barlow Condensed, Roboto Mono Variable, ui-sans-serif, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0em"
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
  section:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
  section-mono:
    fontFamily: "Roboto Mono Variable, Roboto Mono, SFMono-Regular, ui-monospace, Menlo, monospace"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
  body:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.375
  data:
    fontFamily: "Roboto Mono Variable, Roboto Mono, SFMono-Regular, ui-monospace, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 400
    fontFeature: "\"tnum\" 1"
  label:
    fontFamily: "Roboto Mono Variable, Roboto Mono, SFMono-Regular, ui-monospace, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.14em"
  microlabel:
    fontFamily: "Roboto Mono Variable, Roboto Mono, SFMono-Regular, ui-monospace, Menlo, monospace"
    fontSize: "9px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "16px"
  clock-side: "18px"
  clock-main: "22px"
  full: "9999px"
spacing:
  row-gap: "6px"
  heading-gap: "10px"
  gutter: "12px"
  card-md: "14px"
  screen-gap: "24px"
  section-gap: "28px"
  touch: "44px"
  touch-clock: "48px"
  clock-side: "64px"
  clock-main: "84px"
  pane: "560px"
components:
  button-primary:
    backgroundColor: "{colors.vermilion}"
    textColor: "{colors.ground}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
    typography: "{typography.body}"
  button-primary-active:
    backgroundColor: "{colors.vermilion-pressed}"
    textColor: "{colors.ground}"
  button-quiet:
    backgroundColor: "{colors.panel-inset}"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  button-quiet-hover:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
  button-bare:
    textColor: "{colors.ink-faint}"
    rounded: "{rounded.md}"
  button-touch:
    height: "{spacing.touch-clock}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-md}"
  card-inset:
    backgroundColor: "{colors.panel-inset}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-md}"
  chip-neutral:
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.md}"
    padding: "2px 6px"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.panel-inset}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  option-on:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  option-off:
    backgroundColor: "{colors.panel-inset}"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  list-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "10px 14px"
    height: "56px"
  list-row-hover:
    backgroundColor: "{colors.panel-inset}"
  clock-field-work:
    backgroundColor: "{colors.vermilion}"
    textColor: "{colors.ground}"
  clock-control-main:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.clock-main}"
    height: "{spacing.clock-main}"
  clock-control-side:
    rounded: "{rounded.clock-side}"
    size: "{spacing.clock-side}"
  strip-stopped:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    height: "72px"
---

# Design System: Send Lab

## Overview

**Creative North Star: "The Chalk-Dusted Console"**

Send Lab is a console for one athlete, and it has two registers that share one material. At home or at a desk it is dense and calm: a neutral near-black ground, a tight ramp of graphite panels, many numbers on one screen, and almost no colour. On the board it becomes something else. The clock stops being a widget and turns into a coloured field: the running segment's colour fills the whole screen, the number fills its width, and the ink is the ground colour. The athlete, 1–3 m away with chalk on one hand, reads the segment by colour, the seconds by the number, and where they are by Round · Set. A screen with no colour is a clock that is stopped.

Both registers rest on one doctrine: **colour reports state, never decoration.** The four accents are the only chroma in the system. Each one means something everywhere it appears, so a screen with nothing to report is grey, and that is how it should look. Density comes from grouping by space and hairlines rather than by boxes; a bordered surface has to carry state colour or hold a list whose rows share an edge.

This system is measured as much as designed. Every text pair clears 4.5:1 in both locales (`check:contrast`), reduced motion finishes every animation in one frame (`check:motion`), nothing overflows 360px (`check:overflow`), and `docs/component-vocabulary.md` is the authority on components and on the rules that came out of measurement. Where this file and that one seem to disagree, that one wins and this one is stale.

**Key Characteristics:**
- Dark only, on a hue-free ground, so the four accents are the only colour on any screen.
- Colour is state: gold prepare, vermilion work, teal for both rests, violet cooldown, and ok / warn / stop on every other screen.
- The clock is a whole-screen field with ground-coloured ink, not a ring with readouts under it.
- Barlow Condensed for the numbers read from the wall, Inter for every word, Roboto Mono for data and furniture on the dense screens.
- Hierarchy is carried by size, weight and colour at once, and by space: sections sit further apart than their contents.
- Touch targets are 44px for anything touched mid-set and 48px or more on the clock, where controls are found by direction.

## Colors

A hue-free graphite ramp under four saturated accents, each of which names a state.

### Primary
- **Signature Vermilion** (`vermilion`): the app's signature and the `work` segment's field. It marks the limit, effort and stop states, the one `primary` action per screen, the focus ring, and the refused-work announcement in the strip. Text on it is always the ground colour, never white.
- **Pressed Vermilion** (`vermilion-pressed`): the primary button's press only. It lasts as long as a finger is down. The ground on it measures 3.91:1, so it is never a hover state or a resting surface for text.

### Secondary
- **Recovery Teal** (`teal`): both rest segments on the clock (`rest`, `setRest`), the `ok` state, recovery and tissue content.
- **Signal Gold** (`gold`): the `prepare` segment, the `warn` state (Offline in the strip, a step's waiting-for line), endurance content.

### Tertiary
- **Cooldown Violet** (`violet`): the clock's `cooldown` segment, and the pull/power category on content screens. The two uses never share a screen, and on the clock it always comes with the segment's name.

### Neutral
- **Unlit Ground** (`ground`): the page, the paused and stopped clock, and the ink on every coloured field and every vermilion fill. Hue-free on purpose: a blue-cast ground tinted every grey and made teal read as background.
- **Graphite Panel** (`panel`): the one surface: cards, list rows, the stopped strip, menus and popovers.
- **Inset Graphite** (`panel-inset`): the recessed step for inputs, quiet buttons, unselected options and the row hover.
- **Raised Graphite** (`panel-raised`): a selected option, an open menu trigger, a highlighted menu item, the select popup.
- **Slate Rule** (`line`): borders on cards, inputs, chips and buttons.
- **Hairline Slate** (`line-soft`): rules inside a panel and the rule above a `Bare` group, where `line` is too loud.
- **Bright Ink** (`ink`): primary text and the numbers on the ground.
- **Dim Ink** (`ink-dim`): secondary text, section heads, a paused or stopped reading.
- **Faint Ink** (`ink-faint`): furniture (labels, units, microlabels, chevrons), disabled labels, and the bottom rule of a typed field. 5.42:1 on a panel; it was raised from 3.73:1 after the athlete found the labels unreadable.
- **Climbing Chalk** (`chalk`): emphasis inside training prose, the selected option and switch fill, the running stopwatch's face.

The semantic names alias these and are what components should reach for: `--ok` is teal, `--warn` gold, `--stop` vermilion, `--cooldown` violet. The accent names `--flag`, `--teal`, `--gold` and `--violet` are load-bearing: training content stores `var(--flag)` and `--violet` in its data, so renaming one silently blanks the day accents.

### Named Rules
**The State-Only Rule.** Colour reports state, never decoration. Nothing is coloured to look nice; a screen with nothing to report is grey.

**The Ground-Ink Rule.** Text on any accent fill is the ground colour. White on vermilion measures 3.11:1; the ground gives 6.44:1 and reads as more emphatic. Every accent clears ≥6.4:1 against the ground, which is why a coloured field can carry ground ink at any size.

**The Rationed Fill Rule.** Filled vermilion appears once per screen: the `primary` button. The refused-work announcement is the one recorded exception, and it reuses the measured pair, not the button.

**The Pair, Not the Palette Rule.** A colour's contrast belongs to the pair. Vermilion at 10px clears 4.5:1 on `panel` and fails on `panel-inset`, so a token moved onto another surface is re-measured there. When a state cannot clear 4.5:1 as text, it goes on a mark (a dot clears at 3:1) beside the text.

## Typography

**Display Font:** Barlow Condensed (600, 700; with Roboto Mono Variable)
**Body Font:** Inter Variable (with -apple-system, Segoe UI)
**Label/Mono Font:** Roboto Mono Variable (with SFMono-Regular, Menlo)

**Character:** A condensed road-sign face for the numbers read from across the room, set against a neutral grotesque for every word. Mono stays the face for data and furniture on the dense screens, so a column of readings never jitters as its digits change.

### Hierarchy
- **Clock face** (700, `min(88vw, 46dvh)` for a two-glyph reading, line-height 0.8): the full-screen number. It is stepped down by glyph count against one `--face` value (0.58 for `2:30`, 0.47 for `10:00`, a stopwatch tenth counting as a glyph and a half), so seconds fill the width. On a phone held sideways `--face` is `min(40vw, 78dvh)`; on a desktop `min(60vw, 100dvh − 16rem)`.
- **Clock segment** (700, 30px, 0.04em, uppercase): the segment name at the top left of the clock. The same face carries PAUSED (34px, 0.12em) and Round · Set (28px, 600, 0.03em) under the number.
- **Count** (600, 22px; up to 36px and 56px, 700, in the strip): totals and counts that sit beside words: a protocol row's length, the editor's total, the strip's reading in a fixed right-aligned slot.
- **Headline** (600, 21px, 1.15, −0.01em): the screen title, one per screen. The ready state's title is the same rank at 25px.
- **Title** (600, 16px, 1.25): a list row's name. The editor's dialog title is 17px.
- **Section** (600, 14px, 1.2, `ink-dim`): section heads on the Timer screens, in Inter and sentence case.
- **Section, mono** (600, 11.5px, 0.12em, uppercase, `ink-dim`): section heads on the other screens, until a ticket moves them to Inter.
- **Body** (400–500, 13px, 1.375): prose, buttons, options, control rows. The editor's rows, a preset group's head and menu items run at 15px.
- **Data** (400, mono, tabular, mostly 11px): every reading on the dense screens, via `.num`.
- **Label** (400, mono, 10px, 0.14em, uppercase, `ink-faint`): furniture only: a field label, a unit, a meta reading.
- **Microlabel** (400, mono, 9px, 0.04em, uppercase, `ink-faint`): column labels in a four-column grid at 360px. Measured, not chosen: at the label's 10px and 0.14em, "DESCANSO (S)" clips in a 73px column. It stands against any generic 11px floor.

### Named Rules
**The Numbers-Only Rule.** Barlow Condensed sets numbers, and the segment names read with them, on the clock and its strip. Never a heading, never a word anywhere else. Every word is Inter.

**The Three-Axis Rank Rule.** Ranks differ in size, weight and colour at once. At this density any one axis alone is too quiet, and one rank doing two jobs made a screen read as one long list.

**The Tabular Rule.** Every number that changes is tabular, so a count crossing ten or a minute never moves what sits beside it.

## Layout

The phone at 360px is the design width. Pages sit in a column capped at 520px (1000px from `lg`), with a 12px gutter and a fixed 44px top strip. A page is a `Pane` (one column, capped at 560px from `lg`) or `Panes` (two columns from `lg`, stacked below it with `display: contents`, so the phone order is unchanged). There is one breakpoint, `lg` at 1024px; tablet gets the phone layout. Today, Log and Week take two columns; Train, Timer, Settings, Welcome and Login stay capped.

Rhythm is carried by space. Sections sit 28px apart (24px on the Timer list), a heading sits 10px above its body, and rows in a list sit 6px apart. The space between things is always larger than the space inside them.

The full-screen clock has its own layout. Upright, the header is at the top (segment name left, 48px close right), the face is centred with Round · Set under it, and back · pause · skip sit in the thumb zone. A short landscape viewport (`sideways`: landscape and at most 32rem tall) turns the same DOM into two columns: the face down the left at the screen's full height, the header, detail and controls on the right, every control above the fold. Both layouts are CSS only, because the shell is baked before any window exists.

Persistent clocks ride the page: the `StickyStrip` holds the Train clock under the top strip, and the `BottomBar` holds the Timer list's mini bar above the home indicator, leaving its own height at the end of the page so the last row scrolls clear.

## Elevation & Depth

The system is flat and tonal. Depth is the panel ramp (ground, panel, inset, raised), a 1px `line` border where a surface has to be seen, and a `line-soft` hairline where it only has to be grouped. Blur, not shadow, separates the two pinned strips from the content scrolling under them. Shadows exist only on things that float over content: menus, popovers, the select popup and the mini bar.

### Shadow Vocabulary
- **Floating menu** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): the app menu, a row's ⋯ menu, the cue-settings popover.
- **Select popup** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.4)`): `Picker`'s list, on `panel-raised`.
- **Mini bar** (`box-shadow: 0 10px 30px -8px rgb(0 0 0 / 0.8)`): the Timer list's bottom bar, over a ground gradient that takes the taps beneath it.

### Named Rules
**The Earned Box Rule.** A card has to earn its border: it carries state colour, or it holds a list whose rows share an edge. Everything else is a `Bare` group, a hairline and whitespace. An empty state is copy in a `Bare`, never a box with a sentence in it.

**The Float-Only Shadow Rule.** A shadow means "this is over the page". Nothing that sits in the page's flow has one.

## Shapes

Corners are gently rounded and grow with the element's size and with how far it is read from. Panels, cards and menus use 10px; buttons, inputs, chips and options 8px; list rows 14px. The clock's controls are softer because they are bigger and found by feel: the strip and mini bar 16px, the strip toggle and the clock's close 14px, the side controls 18px, the main control 22px. Dots (the segment mark beside a row) and the switch are fully round.

A typed number in the protocol editor has no box at all, only a 2px bottom rule in `ink-faint`, the shape that says "a field the keyboard opens on". A refused value turns that rule `stop`.

On a coloured field, shapes are drawn in the field's own terms: the main control is a ground-filled pill with the field colour as its icon, and the side controls and close are 2px outlines in the ground ink. They need no colour of their own.

## Components

### Buttons
Quiet by default; a dense screen with loud buttons is not calm.
- **Shape:** gently rounded (8px), `min-h` with wrapping labels, never a fixed height with `nowrap`, because pt-BR runs 1.4–2× longer.
- **Primary:** vermilion fill, ground text, rationed to one per screen. Its hover is a chalk border. Its press is pressed vermilion. A stepper's advance is its step's primary; a settings page has none outside its confirm dialog.
- **Quiet:** inset graphite, dim ink, slate border. Hover raises the panel a step and lightens the text.
- **Bare:** no fill, no border, faint ink that lightens on hover.
- **Sizes:** 32 / 36 / 44px, and `touch` at 48px for anything operated mid-set.
- **Disabled:** drops its fill and border and keeps a faint label (7.14:1). Never opacity. Disabled, not hidden, with the line that says what it waits for.
- **Hover / Focus:** hover moves a surface or a border, never a measured text/background pair, and only under `(hover: hover)`. Focus is a 2px vermilion outline 2px off the control on `:focus-visible`; on a coloured field it is drawn in the ink.

### Chips
- **Style:** 10px mono, 8px corners, a 1px border tinted by tone (neutral, ok, warn, stop) or a ghost fill. Small state tokens only.
- **State:** a chip reports state; it is never decoration and never carries opacity.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** graphite panel; `inset` steps to inset graphite with a soft rule; state tones wash 6–7% of the accent under a 35–40% accent border.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px slate.
- **Internal Padding:** 12px or 14px, or none when the card owns its internal rules.

### Inputs / Fields
- **Style:** inset graphite, slate border, 8px corners, 16px text (under 16px iOS zooms on focus), tabular figures; proportional figures for a name.
- **Focus:** the border steps to faint ink for a finger; the vermilion ring for a keyboard.
- **Typed numbers on the Timer screens:** a 30px Barlow value over a 2px bottom rule, flanked by 48px − and + buttons; the numeric keyboard opens on tap.

### Options and choices
- **Option:** a full-width ruled line or a flex-shared one. Selected is weight, a chalk border and a raised panel, not a fill, because nine of them can stack on one screen.
- **Segmented:** a short closed set on one line (`kg`, `Yes`, `4`), built from options at 44px.
- **Switch:** 48 × 28px; on is a chalk fill with a ground thumb. State is the fill, never opacity.

### Navigation
- **Style:** one control in the top strip opens `Menu`, which holds every destination: 44px rows of 13.5px Inter with a 17px line icon. The current page is a raised panel, semibold, in chalk. Hover steps the panel. The same menu at every width; there is no tab bar and no rail.
- **Top strip:** 44px, ground at 95% with a blur, wordmark left, sync state beside it, locale switch and menu right. Refused work replaces the wordmark with a filled vermilion sentence.

### The Clock Field (signature)
The full-screen clock both clocks run in. Running, the popup's background is the segment's colour and its ink the ground: the segment name top left in condensed caps, a 48px outlined close top right, the face centred and stepped to fill the width, Round · Set under it, and back · pause · skip in the thumb zone. Paused, the field drops to the ground, the number turns solid in the segment colour, PAUSED and Round · Set sit under it, the main control reads Resume, and Reset takes skip's place. The whole face is a tap target that starts and pauses; the buttons are its tappable equivalent. Before the start, a ready state titled with the protocol's name shows its shape and one full-width 60px Start. A segment change washes the screen and fades out (40% at the peak, ink on a field), timed by the cue planner and never drawn under reduced motion. The stopwatch uses the same dialog on the ground and says running or paused in words and in the weight of its ink, never with a segment colour.

### The Strip and the Mini Bar
One 72px line. Running, it is the segment's colour, as the full-screen clock is, with a 52px ground square for Pause. Stopped, it is a bordered panel with a 52px vermilion Resume. The number sits in a fixed right-aligned slot so neither the labels nor the button move as it crosses ten or a minute. The number is the way into the full-screen clock and says so: underlined on Train, the whole line on the Timer list's mini bar.

### Protocol rows
A list row is a 56px panel at 14px corners: the name in 16px semibold, the shape under it in 13px dim ink, the length in a 22px Barlow count on the right. Its ⋯ is a separate 44px bordered control beside it, never inside it. A tap opens the ready state, so a stray tap never starts anything. A preset group's head is a 48px disclosure row in the rows' 15px, not a heading rank.

## Do's and Don'ts

### Do:
- **Do** use the four accents only to report state, and the semantic names (`--ok`, `--warn`, `--stop`, `--cooldown`) to reach them.
- **Do** set text on any accent fill in the ground colour.
- **Do** mark state with colour or with a mark beside the text; re-measure any colour moved onto a new surface.
- **Do** group with space and a `line-soft` hairline (`Bare`) first, and reach for a card only when it carries state or a shared list edge.
- **Do** keep one `primary` per screen, and give a disabled control the line that says what it is waiting for.
- **Do** set numbers that change in a tabular face: Barlow Condensed on the clock and its strip, Roboto Mono for data elsewhere.
- **Do** size touch targets at 44px for anything touched mid-set and 48px or more on the clock (64px side and 84px main controls on its row).
- **Do** let labels wrap and buttons grow; pt-BR runs 1.4–2× longer.
- **Do** run `check:contrast`, `check:motion`, `check:overflow` and `check:hydration` at 360px and with `--desktop` before calling a surface done.

### Don't:
- **Don't** mark state by dimming text with `opacity`; at 9–11px there is no gap between de-emphasised and unreadable.
- **Don't** put white text on vermilion (3.11:1).
- **Don't** use pressed vermilion as a hover or a resting surface for text (3.91:1 with the ground).
- **Don't** colour anything to look nice, including a destructive menu item; its confirmation question is what guards it.
- **Don't** give the stopwatch a segment colour; teal running and gold paused read as rest and prepare from 2 m.
- **Don't** set a word in Barlow Condensed, or stack readouts under a ring timer; the clock is a field.
- **Don't** draw paused digits as transparent outlined text; it measures 1:1 in `check:contrast`.
- **Don't** add a shadow to anything that sits in the page's flow.
- **Don't** call a clock segment a "phase"; a phase spans weeks (`CONTEXT.md`).
- **Don't** animate anything that outlives one frame under `prefers-reduced-motion`, and don't enter Motion without a `reducedMotion="user"` provider.
