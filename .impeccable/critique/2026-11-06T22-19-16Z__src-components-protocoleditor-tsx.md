---
target: "protocol editor (#112)"
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-ea4a388e/src/components/ProtocolEditor.tsx"
target_fingerprint: "sha256:c34ca8adec7863b1c3f92e0241f63b34aac3505f290eee3e688259b709c72ae5"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-ea4a388e/src/components/ProtocolEditor.tsx
timestamp: 2026-11-06T22-19-16Z
slug: src-components-protocoleditor-tsx
---
Method: dual-agent (A: affd828c64ea97eaf · B: afec9c0346d7b2f46)

Target: the protocol editor (#112): `src/components/ProtocolEditor.tsx`, `src/components/ProtocolRows.tsx`, and Train's Adjust in `src/components/Timer.tsx`. Mode: Operate. Captured at 360×800 on the built app, seeded account, both locales.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | A − / + press was silent to a screen reader |
| 2 | Match System / Real World | 3 | "Block" heading shares a word with the glossary's 8-week Block |
| 3 | User Control and Freedom | 3 | Enter on the numeric keypad saved and closed the editor |
| 4 | Consistency and Standards | 3 | Train's ready summary says "Set rest", the Adjust row "Rest between" |
| 5 | Error Prevention | 3 | Train's Adjust could show a value the clock would not run |
| 6 | Recognition Rather Than Recall | 4 | Labels, segment dots, "= 3:00" while typing |
| 7 | Flexibility and Efficiency | 3 | No arrow keys on the value; no hold-to-repeat |
| 8 | Aesthetic and Minimalist Design | 3 | Doubled rule above Adjust; zero not dimmed |
| 9 | Error Recovery | 3 | Total collapsed to a bare dash |
| 10 | Help and Documentation | 3 | Placeholder shows the shape an unnamed protocol is listed under |
| **Total** | | **31/40** | **Good** |

## Design Specificity Verdict

Specific: run order, segment-coloured dots on the time rows, Barlow values, the total said the way the ready state says it. Matches the approved mockup; the unit is not set smaller because the value is a real input.

Deterministic scan: CLI 0 findings (regex-only on .tsx). Overlay: editor clean in both locales; Train's findings all outside Adjust. Browser: no text contrast failures, no undersized targets, no overflow. Non-text: the value fields' bottom rule (`--line`) 2.31:1 against 3:1.

## Priority Issues

- [P1] Value field had no number semantics; presses silent to a screen reader → spinbutton with valuenow/min/valuetext, arrow keys, a polite live region. Fixed.
- [P2] Train's Adjust could show a value the clock would not run → a value left unreadable reverts to the clock's. Fixed.
- [P2] Enter on the numeric keypad submitted the editor's form → Enter moves to the next value; enterKeyHint next/done. Fixed.
- [P2] Value field's rule 2.31:1 and no focus ring → rule raised to `--ink-faint` (7.14:1), focus steps to `--ink`. Fixed; the project-wide ring/layer issue answered in writing.
- [P3] "Warm-up" spaced out by tabular figures in the name field → normal-nums. Fixed.

## Persona Red Flags

Athlete: stale value in Adjust (fixed); ~42 taps from 10s to 3:00 (tap-to-type is the path). Sam: silent presses, "10s"/"1:00" read ambiguously (fixed); dash total (fixed). Casey: Android Go submitted (fixed); ✕ discards without asking (answered).

## Minor Observations

Doubled rule above Adjust (fixed); zero not dimmed (fixed); last row's rule (fixed); dash total given words (fixed); title off-centre (fixed); silent save failure, no upper bound past 99:59, "Block" vs glossary, "Set rest" vs "Rest between" (answered).
