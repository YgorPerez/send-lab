---
target: "Week (#121)"
total_score: 23
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 1
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-5b3a13db/src/routes/week.tsx"
target_fingerprint: "sha256:3cf1c8c161554dc0f50a67676e2f91277d932c2f2c926be407ac0fcf673e0ded"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-5b3a13db/src/routes/week.tsx
timestamp: 2026-11-07T15-00-31Z
slug: src-routes-week-tsx
---
# Critique: Week (#121), src/routes/week.tsx

Method: dual-agent (A: affa23bb0453e0f42 · B: ab061ed32d641af3b). Assessed at 69df876; fixes in e5c71cb.

## Design health (Nielsen, Operate): 23/36
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | "1 of 6 trained" had no trained slot to point at (Thu's tick under the today mark) |
| 2 | Match with the real world | 3 | Rest day's load chip "OFF" / "FOLGA", the glossary's avoided *off day* |
| 3 | User control and freedom | 3 | Selection free, today one tap back |
| 4 | Consistency and standards | 2 | Day drawn differently from Today's plan card; Today still says "Week 5 / 8"; gold = today here, warn elsewhere |
| 5 | Error prevention | 3 | `hasStarted` guard keeps "missed" honest |
| 6 | Recognition rather than recall | 2 | Day type only after a tap |
| 7 | Flexibility and efficiency | 2 | No arrow keys over the seven cells; no way from today's slot into Train |
| 8 | Aesthetic and minimalist design | 3 | Quiet, state-only colour; the day says "Pull" four times |
| 9 | Error recovery | n/a | No input or failing operation on the screen |
| 10 | Help and documentation | 2 | Legend helps; "MOD", "OAP" unexplained (library content) |

## Design specificity
Grounded in the product: 4+3 slot grid, state as shape and colour, the honest-missed rule, the day accent only on the day's name. Weak spots: cells cannot say what a day runs, the day panel's flat type, empty desktop canvas.

Deterministic scan: CLI `detect` clean (exit 0, also with `--no-config`). In-page detector, 8 runs (360/1280 × en/pt × seeded/empty), the same 10 hits: 9px `.microlabel` ×7, 10px chip, 10px wordmark, 11px meta line, all DESIGN.md ranks (false positives). Probes: no clipping or overflow; marks ≥3:1 on both cell surfaces (lowest missed on panel-3, 3.86); cells 79.5×64 / 62×64; Enter and Space select, focus ring unclipped; outline h1 → h2 → h2; the day follows the grid with nothing between, 28px under it; both panes inside 900px at 1280.

## Priority issues
- [P1] Rest day's chip "OFF" / "FOLGA" is an avoided glossary term. Fix: drop the chip on a rest day; test reads text node by text node.
- [P2] Adherence count disagrees with the grid (no teal anywhere). Fix: a slot's count is teal once any work is ticked.
- [P2] Flat hierarchy in the day panel. Fix: Today's plan-card recipe (13px medium over 11px dim).
- [P2] Week and Today draw the same day and week differently; gold for today. Answer: Today's reading is #125's; gold-for-today kept (chalk is the selection, and today is selected by default).
- [P2] Cells do not name the day type. Answer: 57px inside a 320px pt-BR cell cannot hold "Resistência" / "Limite / Potência" at 11px; the day is one tap.

## Persona red flags
Athlete: no trained slot to point at (fixed); FOLGA (fixed); planning means a tap per day; missed days do not say where the work went. Screen reader: seven `aria-pressed` toggles acting as one single-select, no arrow keys. Laptop: half-width grid strip, empty canvas.

## Minor observations
Unticked task "·" faint; section heads differ (the day's hairline is its Bare rule); "MOD" unexplained; accent bar vs Train's card edge; held work not shown on Week; pt legend wraps "Descanso" alone; focus ring vermilion like the missed cross.
