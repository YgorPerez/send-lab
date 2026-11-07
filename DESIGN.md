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
  body-large:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.25
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
  meta:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
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
  row: "6px"
  group: "10px"
  inset: "12px"
  sections: "28px"
  gutter: "12px"
  gutter-lg: "20px"
  card-md: "14px"
  strip: "44px"
  rail: "200px"
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
  button-clock:
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "{spacing.touch-clock}"
    padding: "8px 16px"
  button-clock-active:
    backgroundColor: "{colors.panel-inset}"
    textColor: "{colors.ink}"
  screen-header:
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    padding: "6px 0 0"
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
- **Section, mono** (600, 11.5px, 0.12em, uppercase, `ink-dim`): section heads on the other screens today. **Retiring:** the overhaul sets every section head in Inter (the rank above), and each screen ticket of #113 moves its own (#116–#124). It sits right under every header, so two ranks there is the first inconsistency an athlete meets.
- **Body, large** (500, 15px, 1.25): the large and `touch` buttons, the editor's rows, a preset group's head, menu items: words a thumb lands on mid-set.
- **Body** (400–500, 13px, 1.375): prose, buttons, options, control rows.
- **Meta** (400, 11px, `ink-faint`): the one line under a screen's title (the date, the phase), truncated rather than wrapped. Mono only when it is all digits (a count, a ratio); a date with a month name is a phrase and stays in Inter.
- **Data** (400, mono, tabular, mostly 11px): every reading on the dense screens, via `.num`.
- **Label** (400, mono, 10px, 0.14em, uppercase, `ink-faint`): furniture only: a field label, a unit, a meta reading.
- **Microlabel** (400, mono, 9px, 0.04em, uppercase, `ink-faint`): column labels in a four-column grid at 360px. Measured, not chosen: at the label's 10px and 0.14em, "DESCANSO (S)" clips in a 73px column. It stands against any generic 11px floor.

### Named Rules
**The Numbers-Only Rule.** Barlow Condensed sets numbers, and the segment names read with them, on the clock and its strip. Never a heading, never a word anywhere else. Every word is Inter.

**The Three-Axis Rank Rule.** Ranks differ in size, weight and colour at once. At this density any one axis alone is too quiet, and one rank doing two jobs made a screen read as one long list.

**The Tabular Rule.** Every number that changes is tabular, so a count crossing ten or a minute never moves what sits beside it.

## Layout

The phone at 360px is the design width. There is one breakpoint, `lg` at 1024px; a tablet gets the phone layout (ADR 0018). Nothing in the shell reads the viewport: both layouts are CSS under one DOM, because the shell is baked before any window exists.

### The grid

- **Phone.** One column. A 12px gutter each side leaves 336px at 360px; the column stops growing at 520px and centres. The top strip is 44px and fixed. The navigation bar is fixed to the bottom edge: 56px, plus `env(safe-area-inset-bottom)` under it. `main` reserves both (`--nav-clear`) so the last row scrolls clear, and anything else fixed to the bottom (the update notice, the Timer's mini bar) sits on top of the bar.
- **`lg`.** The bar becomes a 200px rail down the left edge, under the strip. Right of it, the strip's content and `main` share one 1000px measure, centred in what the rail leaves, with a 20px gutter. **Every page starts on the measure's left edge:** a two-pane page fills it, and a one-pane page keeps its 560px cap but aligns left instead of centring. So the strip's wordmark and every screen's title share one left edge (spec #113, story 16; x=253 at 1280px on every screen), and the title does not jump sideways between screens. For the same reason the window reserves the scrollbar's gutter from `lg` (`scrollbar-gutter: stable`), so a page that scrolls is as wide as one that does not. The arithmetic is ADR 0018's: a 200px rail beside two 360px columns and their gutters first fits at about 992px, and `lg` is the next stop.
- **The intake** has no bar and no rail (story 72); nothing reserves room for them there.
- A page is a `Pane` (one column) or `Panes` (two from `lg`, stacked below it with `display: contents`, so the phone order is the reading order). Today, Log and Week take two panes; Train, Timer, Settings, Welcome and Login stay capped.

### The spacing scale

Five named steps, as tokens in `app.css` and Tailwind utilities (`gap-sections`, `gap-group`, `gap-row`, `p-inset`, `px-gutter`). They are for the space between things on a page; the inside of a component still uses the plain 4px steps.

- **Sections** (28px): between the sections of a screen, and below its header. Spacing between sections is what makes eight things read as eight rather than as one column.
- **Group** (10px): a section heading to its body, and the groups inside one section.
- **Row** (6px): rows in one list, when they are separate surfaces (protocol rows, task cards).
- **Inset** (12px): padding inside a group's surface: the space under a `Bare` rule, a small card's padding.
- **Gutter** (12px, 20px from `lg`): the page's side margin and the gap between two panes. One variable that changes at `lg`, so `px-gutter` is right at both widths.

**The Inside-Smaller Rule.** Each gap between siblings is larger than the gap between the siblings inside them: sections (28) > group (10) > row (6). A screen whose section gap equals its row gap reads as one long list. `inset` (12) is not on this ladder: it is padding between a surface's edge and its content, not a gap between siblings.

Train and the Timer list still sit their sections 24px apart; that is drift, and their tickets (#118, #119) move them to `sections`.

### The screen header

Every screen opens with `ScreenHeader`, and nothing the page draws comes before it.

- **Title:** the headline rank (21px, 600), the only `<h1>` on the screen. A screen's name, or the name and the day ("Train · Thu").
- **Meta:** at most one line under the title, 4px below it, in the meta rank: the date, the phase. It truncates; a second line of meta is a section.
- **Lede:** a sentence under the title, 6px below, in 13px dim ink, only for a screen that has to explain itself before it asks (the intake).
- **Right side, one thing or nothing:** a short reading about the whole screen (`3/12 sets`, `Week 5 / 8`), 11px mono faint and baseline-aligned with the title; or one icon control, centred on the title row. The top strip has a slot for one screen action since #115 (a route's `staticData.screenAction`); moving a screen's action there is that screen's ticket (the Timer's cue settings, #119). The header keeps readings.
- **Space:** the title's line starts 14px under the 44px strip on a phone (`main`'s 8px plus the header's 6px) and 22px under it from `lg` (16px plus 6px), and the sections gap follows the header. #115 left both numbers where they were.
- **Height:** the title sets the header's height and nothing on the right does. A 44px control in the right-hand slot overhangs the title's 24px line by 10px each way, so the title sits at the same height on every screen.
- **What is not the header:** a notice about the whole screen (Settings' offline line, sign-in's notices) is the first group after the header, a sections gap below it, never a second meta line pulled up with a negative margin.

### The group pattern

A section is a `Section`: its heading in the section rank, an optional meta reading on the right, and its body one group gap below. The body is one of two things:

- **A card** when it carries state colour (a tone wash and border: ok, warn, stop), or when it holds rows that share an edge: a list of controls (`ControlRow`s, one or many), an accordion (`RowGroup`), a set grid. Rows inside a card are divided by `line-soft` hairlines and carry their own 12px side padding. A card is never inside another card.
- **A `Bare`** for everything else: prose, a single action, a lone reading, an empty state. A `line-soft` hairline above and the inset below it.

A list of separate surfaces (protocol rows, task cards) is neither: each row is its own surface, and the rows sit a row gap apart.

### The full-screen clock

The clock has its own layout. Upright, the header is at the top (segment name left, 48px close right), the face is centred with Round · Set under it, and back · pause · skip sit in the thumb zone. A short landscape viewport (`sideways`: landscape and at most 32rem tall) turns the same DOM into two columns: the face down the left at the screen's full height, the header, detail and controls on the right, every control above the fold.

Persistent clocks ride the page: the `StickyStrip` holds the Train clock under the top strip, and the `BottomBar` holds the Timer list's mini bar on top of the navigation bar (above the home indicator where there is no bar), leaving its own height at the end of the page so the last row scrolls clear. From `lg` the mini bar starts right of the rail, on the list's left edge.

## Elevation & Depth

The system is flat and tonal. Depth is the panel ramp (ground, panel, inset, raised), a 1px `line` border where a surface has to be seen, and a `line-soft` hairline where it only has to be grouped. Blur, not shadow, separates the pinned strips and the navigation bar from the content scrolling under them. Shadows exist only on things that float over content: menus, popovers, the select popup and the mini bar.

### Shadow Vocabulary
- **Floating menu** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): a row's ⋯ menu, the cue-settings popover.
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
- **Clock control:** the start, pause and resume of a clock off its coloured field: a 2px `ink-dim` outline (at least 7:1 on the ground and on a panel), no fill, `ink` glyph and label. Hover takes the border to chalk; a press fills the control with inset graphite, whatever it sits on (the ground in the full-screen clock, a panel in the stopped strip). At least 48px, and larger by role: the strip's 52px square at 14px corners, the clock row's 84px main control at 22px, the ready state's 60px full-width Start at 16px. It is the same control on Train, on the Timer list's mini bar and in the full-screen clock, and off the field it is every control in the clock's row, the side ones too (back, skip, reset), so a paused row speaks one language. It is never filled vermilion: the clock is a tool on the screen, not what the screen is for, and on Train the one primary is "finish and log the session". On a coloured field the clock keeps its own shapes (a ground-filled main control, outlines in the ground ink). The recipe is `button({ kind: 'clock' })`; #118 moves the clocks onto it.
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
Decided by spec #113, built in #115 (`Navigation.tsx`).
- **Phone:** a bottom bar, 56px plus the home indicator, with the four places a training day moves between (Today, Train, Timer, Log) and a fifth item, More, that opens a sheet from the bottom edge holding Week and Settings, and later Program and Studies. Each item is a 22px line icon over an 11px Inter label in the locale that wraps rather than clips, at least 48px tall. The current destination is marked by colour, weight and a surface together: chalk and semibold, on a 48 × 28px raised-panel pill behind the icon, where the others are faint ink at regular weight with no surface. More shows as current on any destination it holds. The sheet has its title and a 44px close on one line, then 48px rows: a 20px icon, the 15px label, an 18px faint chevron; the current row is a raised panel, chalk, semibold. The bar stands down while a field that opens the keyboard has focus, so it never sits on the field being typed in.
- **`lg`:** the same element becomes the 200px rail under the strip, listing every destination as 44px rows (22px icon beside a 13.5px label); More is hidden there. The current row is a raised panel, chalk, semibold.
- **One selection language.** Anything else in the app marked as the current choice in a list (the selected protocol on the Timer) uses the bar's mark: chalk, semibold, a raised panel (`panel-raised`). An option in a picker keeps its own chalk border on top of that, because nine of them can stack on one screen and the border is what separates them.
- **Top strip:** 44px, ground at 95% with a blur, the wordmark and the sync state on the left, and at most one action for the current screen on the right (a 44px icon control the route names). Refused work replaces the wordmark with a filled vermilion sentence. The locale switch lives in Settings. From `lg` its content sits in `main`'s measure, right of the rail.

### Icons
One family: Lucide line icons, never filled, except the clock's glyphs. An icon takes its control's ink (`currentColor`); a decorative one is dim ink and a chevron is faint ink. An icon never carries a state on its own; the word or a mark beside it does. One size and stroke per context:
- **Bar and rail:** 22px, stroke 1.75.
- **Row:** a leading icon at 20px, stroke 1.75; a trailing chevron at 18px, stroke 2, in faint ink.
- **Icon-only control** (a 44px ⋯, the cue settings, a sheet's close): 20px, stroke 1.75.
- **Inline control** (an icon beside a button's label: add, copy, repeat): 16px, stroke 2.
- **In text** (the external-link mark after a citation): 12px, stroke 2.
- **The clock:** solid glyphs (play, pause, skip; `strokeWidth` 0 and a fill), 24px on the side controls, 34px on the main one, 22px in the strip; the close is a 22px line X at stroke 2.

Lucide draws on a 24px grid and scales the stroke with the icon, so the drawn line is `stroke × size / 24`. These pairs keep it between 1.33px and 1.6px from 16px up (22 at 1.75 draws 1.6px, 16 at 2 draws 1.33px), which is why the stroke steps up as the icon gets smaller. At 12px it draws 1px, so an in-text icon always sits beside its text, never alone.

### The Clock Field (signature)
The full-screen clock both clocks run in. Running, the popup's background is the segment's colour and its ink the ground: the segment name top left in condensed caps, a 48px outlined close top right, the face centred and stepped to fill the width, Round · Set under it, and back · pause · skip in the thumb zone. Paused, the field drops to the ground, the number turns solid in the segment colour, PAUSED and Round · Set sit under it, the main control reads Resume, and Reset takes skip's place. The whole face is a tap target that starts and pauses; the buttons are its tappable equivalent. Before the start, a ready state titled with the protocol's name shows its shape and one full-width 60px Start. A segment change washes the screen and fades out (40% at the peak, ink on a field), timed by the cue planner and never drawn under reduced motion. The stopwatch uses the same dialog on the ground and says running or paused in words and in the weight of its ink, never with a segment colour.

### The Strip and the Mini Bar
One 72px line. Running, it is the segment's colour, as the full-screen clock is, with a 52px ground square for Pause. Stopped, it is a bordered panel with a 52px Resume. Today that Resume is filled vermilion; #118 makes it the clock control (outlined, never filled), because on Train the screen's one primary is finish-and-log. The number sits in a fixed right-aligned slot so neither the labels nor the button move as it crosses ten or a minute. The number is the way into the full-screen clock and says so: underlined on Train, the whole line on the Timer list's mini bar.

### Protocol rows
A list row is a 56px panel at 14px corners: the name in 16px semibold, the shape under it in 13px dim ink, the length in a 22px Barlow count on the right. Its ⋯ is a separate 44px bordered control beside it, never inside it. A tap opens the ready state, so a stray tap never starts anything. A preset group's head is a 48px disclosure row in the rows' 15px, not a heading rank.

## Do's and Don'ts

### Do:
- **Do** use the four accents only to report state, and the semantic names (`--ok`, `--warn`, `--stop`, `--cooldown`) to reach them.
- **Do** set text on any accent fill in the ground colour.
- **Do** mark state with colour or with a mark beside the text; re-measure any colour moved onto a new surface.
- **Do** group with space and a `line-soft` hairline (`Bare`) first, and reach for a card only when it carries state or a shared list edge. A list of controls is a card of rows, one row or many.
- **Do** open every screen with `ScreenHeader`, and space a page with the named steps (`gap-sections`, `gap-group`, `gap-row`, `p-inset`, `px-gutter`) rather than a number picked for one screen.
- **Do** size icons by context: 22px in the bar, 20px leading a row or alone in a control, 18px for a row's chevron, 16px beside a label, 12px in text.
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
- **Don't** fill a clock's start or pause with vermilion; it is a clock control, and the screen's one primary is elsewhere.
- **Don't** put a card inside a card, or a single sentence in a card.
- **Don't** call a clock segment a "phase"; a phase spans weeks (`CONTEXT.md`).
- **Don't** animate anything that outlives one frame under `prefers-reduced-motion`, and don't enter Motion without a `reducedMotion="user"` provider.
