---
target: "#129 time left in the running full-screen clock"
total_score: 25
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 3
target_identity: "file:/home/servidor-azul/send-lab/src/components/FullScreenClock.tsx"
target_fingerprint: "sha256:497522dc275d4c0ffda4918759f422265a6eee94403824a165236690d7a8d97c"
target_path: /home/servidor-azul/send-lab/src/components/FullScreenClock.tsx
timestamp: 2026-11-09T04-50-58Z
slug: src-components-fullscreenclock-tsx
---
Method: dual-agent (A: a114fd3b11ec26d3c · B: ad9d74949d5dba05a)
Scope: #129 only — the session's time left stacked beside Close in the running full-screen clock, and the title's step to 24px when it is present.

## Design Health Score (scored before fixes)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 4 | answers "how long is this" without leaving the clock |
| 2 | Match System / Real World | 3 | spoken `6:03` as digits |
| 3 | User Control and Freedom | 3 | unchanged; Close keeps 48px |
| 4 | Consistency and Standards | 2 | 12px off the type ramp (typeRamp gate red) |
| 5 | Error Prevention | 3 | always m:ss, never reads as segment seconds |
| 6 | Recognition Rather Than Recall | 3 | label unreadable at 2 m; position learned fast |
| 7 | Flexibility and Efficiency | n/a | single fixed reading, no expert path applies |
| 8 | Aesthetic and Minimalist Design | 2 | duplicates the face in the last segment |
| 9 | Error Recovery | 2 | 640x360 sideways header overflows |
| 10 | Help and Documentation | 3 | consistent running and paused |
| **Total** | | **25/36** | Good |

## Design Specificity
LLM: authored for this clock (field ink, dim when paused, stacked road-sign label). Detector: 1 finding, design-system-font-size, Timer.tsx:472 text-[12px] — true issue (tests/typeRamp.test.ts failed on it). Browser overlay skipped: the UI lives in a started dialog; the four measured gates passed.

## Priority Issues
1. [P1] Sideways 640x360 phone: 320px column, title overflows; viewport query never fires. FIXED: container query on the header content box (@max-[319px]), measured 320/360/640x360/780x360 pt-BR.
2. [P1] Last segment repeats the face. FIXED: hidden (and unspoken) when next is Done; test pins it.
3. [P1] 12px off ramp; number off the title baseline. FIXED size → 13px (screen ramp). Baseline: answered — the stacked reading is centred on the 48px Close like the close itself, not a ScreenHeader right-hand reading; the header rule is for ScreenHeader.
4. [P2] Spoken `6:03` as digits. ANSWERED: secondsSpoken already speaks ≥60s as clock(), so this matches how the face itself is spoken; changing it is a separate, clock-wide decision.

## Minor
pt-BR FALTA label / "Faltam" spoken is fine. 62:00 for hour-long protocols acceptable. lg fine. DESIGN.md updated (Clock Field).
