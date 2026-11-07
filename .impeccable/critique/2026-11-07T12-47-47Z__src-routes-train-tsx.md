---
target: "Train screen (#118)"
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-281f3c9a/src/routes/train.tsx"
target_fingerprint: "sha256:02572d9fe1637b6535b559ffc118572218775b3152af9c248172cc855e70514a"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-281f3c9a/src/routes/train.tsx
timestamp: 2026-11-07T12-47-47Z
slug: src-routes-train-tsx
---
Method: dual-agent (A: a9826c29506ee9f5d · B: a13d6496108221383)

# Critique: Train after #118 (src/routes/train.tsx, TaskCard, WorkingLoadAsk, the clock controls)

## Design health

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Finish records nothing (no handler, predates #118); the fold-and-advance was silent |
| 2 | Match with the real world | 3 | "0/1" on a task prescribed 4–6 sets; title "Session" against the bar's "Train" |
| 3 | User control and freedom | 3 | Any task opens or folds with a tap; the load ask reopens in place |
| 4 | Consistency and standards | 2 | Title vs bar; Today's and Train's "done" differ; set rows are cards inside a card |
| 5 | Error prevention | 2 | Auto-fold after one row of a multi-set task invited skipped sets |
| 6 | Recognition rather than recall | 3 | The folded line is strong; the clock's task button is icon-only |
| 7 | Flexibility and efficiency | 2 | The clock does not follow the open task (deliberate, pinned by the athlete's rule) |
| 8 | Aesthetic and minimalist design | 3 | 3,909px → 1,614px; an open task with the ask is still ~840px |
| 9 | Error recovery | 2 | Disabled controls say why; nothing recovers an inert Finish |
| 10 | Help and documentation | 3 | Short reasons on the ask and the disabled controls |
| **Total** | | **25/40** | **Acceptable** |

## Design specificity
Specific to this product: the clock strip in the segment's colour, held work marked as Today marks it, the working-load rungs with provenance, a set grid measured to 360px. The session-tools group is the generic part.

Detector: CLI 16 findings (1 side-tab on the task card's category edge, 15 design-system-font-size on clock sizes DESIGN.md's prose names; all pre-existing values). In-page over 32 states: undersized-ui-text / tiny-text on the measured 9–11px ranks, side-tab ×4, nested-cards on the set rows (pre-existing), straggler in pt-BR at 360 (wl_later_builtin, a #118 line; the prescription note, pre-existing). Text-occlusion and a docOverflow seen only with the overlay injected are overlay artefacts. Targets: smallest 44px in main, 48px in the clock dialog. Contrast: the grade line on the pressed option 6.2:1; faint 11px lines 5.42:1. No clipping at 360px in either locale.

## Priority issues
1. [P0] Finish and Repeat last session have no handler (train.tsx). Predates #118.
2. [P1] "Done" and the auto-advance counted rows, not prescribed sets.
3. [P1] The advance landed the next task under the sticky clock and dropped focus.
4. [P2] Title "Session" against the bar's "Train"; Today and Train disagree on done.
5. [P3] The open card's band labels are mono eyebrows while section heads moved to Inter.

## Persona red flags
- Mid-set climber: the 11px count does not read at 2m; the next task opened under the clock; the running strip does not name its task; Finish is ~1,450px down.
- Screen reader / keyboard: focus fell to the page after a folding tick; Finish announced as enabled and does nothing.
- Stress tester: "done" after one of 4–6 sets; Finish and Repeat inert; "per day" is per slot.

## Minor observations
- Set rows bordered inside the task card (pre-existing).
- Violet pull edge above a strip that turns violet in cooldown; teal tissue edge beside the teal done chip.
- The grade line "high confidence · … · no evidence — our judgment" reads as self-contradicting.
- Abrahangs (40%) offers "We predict +25kg".
- The ask is ~340px on first contact; three trailing 11px lines.
- `<html lang>` is "en" in pt-BR (app-wide, __root.tsx).

## Questions
- Should an idle clock follow the open task?
- Is a task done at its prescribed sets or at its rows? (Train now uses the prescription; Today keeps any set in the record.)
- Should Finish close the task list, with the tools after it?
