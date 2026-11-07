---
target: "Timer list (#119)"
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-3131b3f4/src/routes/timer.tsx"
target_fingerprint: "sha256:86dbc073ea7073b7856b23fd13117a29229a514ff631aea4270612388f59840d"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-3131b3f4/src/routes/timer.tsx
timestamp: 2026-11-07T13-13-33Z
slug: src-routes-timer-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector + browser sub-agent)

Target: the Timer list, `src/routes/timer.tsx`, as #119 changed it (with `ui/Menu.tsx`, `ui/Rows.tsx`, `CueSettings.tsx`, `StudyLink` in `Timer.tsx`). Assessed on 786a8ee's build; fixes followed in the next commit.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Selected protocol marked at 1.27:1 surface / 1.11:1 text; the mini bar does not name the protocol |
| 2 | Match System / Real World | 3 | Domain words and exercise grouping fit; sliders glyph can read as "filter" |
| 3 | User Control and Freedom | 3 | A tap never starts a clock; delete confirms; closing a group keeps place |
| 4 | Consistency and Standards | 2 | Three shapes of icon control beside a row (Timer row ⋯, ready-state ⋯, Train clock button) |
| 5 | Error Prevention | 3 | No accidental starts; menu refuses taps while closing |
| 6 | Recognition Rather Than Recall | 2 | Nothing says why two groups are open; Duplicate behind a ⋯ of one item |
| 7 | Flexibility and Efficiency | 3 | Saved first and Recent help; today's presets below the fold |
| 8 | Aesthetic and Minimalist Design | 2 | Bordered ⋯ capsules out-shout the names and force wrapping |
| 9 | Error Recovery | 2 | Offline delete waits with a disabled Delete and no line (pre-existing) |
| 10 | Help and Documentation | 3 | Empty states explain; study links in context |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

LLM: the content is Send Lab's own (shape lines in the domain's words, Barlow lengths, presets by exercise with today's open, every group ending on its study, the mini bar in the segment's colour); the containers are generic list furniture. The selection borrowed the bar's recipe, which loses most of its signal on a panel row.

Deterministic scan: `impeccable detect` on the five files: 8 findings, all `design-system-font-size` in `Timer.tsx` (64, 24, 34, 28, 28, 18, 17, 56px), all pre-existing on the base branch; 34/28/56 are documented in DESIGN.md prose and flagged only because the frontmatter ramp lacks them. In-page detector, 16 states (360/1280, en/pt, list, selected, menu open, cue popover open): only pre-existing 10px eyebrows ("Send Lab", the popover title) and false positives (a popup occluding what it covers; Base UI's clip-path backdrop; a 12px edge that is the popover's padding). No clipped overflow, no target under 44px, selected row text 9.61:1.

## Priority Issues

- [P1] Selection mark too weak (panel → panel-3 1.27:1, ink → chalk 1.11:1). Fix: a non-text mark over 3:1 (chalk edge, as Train's clock button and picked options carry). /impeccable colorize
- [P1] Every preset carries a ⋯ menu with one item, Duplicate: the loudest outline in the card, 50px off every name. Fix: drop it from preset rows; Duplicate stays in the ready state's ⋯. /impeccable distill
- [P2] RowMenu's row trigger is a stretched hollow capsule (44×60–80) unlike the header variant and Train's 44px filled clock button. Fix: one fixed 44×44 filled bordered square. /impeccable polish
- [P2] Today's groups are open but unmarked and sit after four closed heads, below the fold. Fix: lift them to the top, label "Today". /impeccable layout
- [P2] Hierarchy inverted in the card: 15px head over 16px children. Fix: in-group names at 15px. /impeccable typeset

## Persona Red Flags

- Power user: duplicate-then-edit is four taps and a jump; tab order walks every group head.
- One-handed mid-session: today's preset below the fold; which protocol runs is not visible; offline delete stalls silently.
- Keyboard / screen reader: aria-current and labels good; strip action's focus ring clipped at the window top.

## Minor Observations

Saved menu order (Edit should lead); Stopwatch row has a chevron where protocol rows have a length; group count without a unit; cue popover still mono; dead ground at page end; at 1280 the strip action sits far from the list; "you run" copy; rejected delete has no message (no catch); same protocol marked twice (Recent and group).

## Questions to Consider

Is Duplicate a row action at all? Should the selected row wear the running segment's colour? Is Presets one list or "Today" and "Library"? Should the mini bar name its protocol? Does a sliders glyph say "cues"?
