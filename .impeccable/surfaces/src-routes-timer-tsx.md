---
version: 1
slug: "src-routes-timer-tsx"
primary_target: "src/routes/timer.tsx"
related_targets: ["src/components/Timer.tsx","src/components/FullScreenClock.tsx","src/components/ProtocolEditor.tsx"]
---

# Timer surfaces: the clock, the Train strip, the list, the editor

Mode: Operate. Scope: `/timer`, the clock shared with `/train` (`Timer.tsx`, `FullScreenClock.tsx`), the protocol editor. Issues #110 (clock), #111 (list), #112 (editor). Decided in a grill on 2026-11-06; HTML mockups approved by the athlete the same day.

Audience and task: one athlete, hanging from a board, phone 1–3 m away, one chalky hand. Reads the segment and the seconds; touches pause, skip, back.

## Direction contract

THESIS: the clock is a coloured field, not a widget. The segment fills the screen and the number fills its width; it refuses the ring-timer template with readouts stacked under it.

OWN-WORLD: the app's dark ground and its four segment accents (gold prepare, vermilion work, teal both rests, violet cooldown) used as whole-screen fields with ground-coloured ink; Barlow Condensed, tabular, for numbers only; Inter for every word.

STORY: from 2 m the athlete knows the segment by colour, the seconds by the number and where they are by Round · Set. No colour means stopped.

FIRST VIEWPORT: segment name top-left in condensed caps, 48px close top-right; the number centred at ~88% of the width; Round · Set under it; back · large pause · skip in the thumb zone. Paused: ground field, outlined number in the segment colour, PAUSED, Resume, Reset in skip's place.

FORM: pinned by the athlete — a grill session and HTML mockups approved on 2026-11-06 (`.impeccable/mocks/timer-redesign/`). No concept roll was run: a user-pinned direction beats the roll. seed: not rolled (direction pinned by the athlete)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
