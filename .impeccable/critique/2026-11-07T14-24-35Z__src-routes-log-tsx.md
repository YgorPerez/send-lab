---
target: "Log timeline (#120)"
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-7bc603b3/src/routes/log.tsx"
target_fingerprint: "sha256:ed9c93f344e4812b774bd42db7f751355b4b2a47e1a26346a39f3d192a4f1bb9"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-7bc603b3/src/routes/log.tsx
timestamp: 2026-11-07T14-24-35Z
slug: src-routes-log-tsx
---
# Critique: Log as one timeline (#120), src/routes/log.tsx

Two isolated assessments: A (design review, sub-agent) and B (detector + in-page overlay + CDP probes, sub-agent).

## Design health (Nielsen, Operate): 26/40
| # | Heuristic | Score |
|---|---|---|
| 1 | Visibility of system status | 3 |
| 2 | Match with the real world | 3 |
| 3 | User control and freedom | 3 |
| 4 | Consistency and standards | 2 |
| 5 | Error prevention | 3 |
| 6 | Recognition rather than recall | 2 |
| 7 | Flexibility and efficiency | 2 |
| 8 | Aesthetic and minimalist design | 3 |
| 9 | Error recognition and recovery | 3 |
| 10 | Help and documentation | 2 |

Design specificity: specific in content (date, verdict-toned score, the recorded day type, sets), generic in structure (a stock accordion, no training-week structure).

## Detector
CLI on log.tsx, Rows.tsx, primitives.tsx: 0 findings. In-page overlay: 17 seeded (skipped-heading h1→h3, introduced by #120; 14 undersized 10px labels and chips and one 11px meta, all on DESIGN.md's ramp; em-dash count from verdict content), 2 empty.

## Priority issues (status after d9146fe)
- [P1] Phone opened on one day (~650px) instead of the timeline. Fixed: nothing open on arrival; pane shows the last day opened.
- [P1] Heading jump h1→h3 (overlay). Fixed: hidden h2 over the rows.
- [P2] Row-head focus ring clipped by the card's overflow. Fixed: ring drawn inside.
- [P2] Sticky pane pushed under the strip at the page's end on a tall day. Fixed: cap at 100dvh-116px.
- [P2] Flag severity flattened to warn. Fixed.
- [P2] pt-BR day type truncated at 360/320px. Fixed: wraps at spaces, count drops under.
- [P2] Row's set count disagreed with the detail (an exercise with no numbers). Fixed: "1 set, no numbers recorded".
- [P2] Dot tone vs number reads as score bands, no legend. Answered: the tone is the verdict by spec decision; the verdict is spoken and one tap away; a legend is a cross-screen pattern for Week (#121) and the sweep (#125).
- Desktop pane not a keyboard stop / unnamed: fixed (focusable section named by date).
