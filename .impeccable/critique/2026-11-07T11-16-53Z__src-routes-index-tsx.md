---
target: "Today (#117)"
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-52d16b4a/src/routes/index.tsx"
target_fingerprint: "sha256:7aa2c6afeef71d3b7f614eeee342d4340fa1586da225074e7f4c0dce9963be85"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-52d16b4a/src/routes/index.tsx
timestamp: 2026-11-07T11-16-53Z
slug: src-routes-index-tsx
---
Method: dual-agent (A: design review · B: detector + CDP browser evidence)

Target: Today (`src/routes/index.tsx`) and the injury self-check sheet (`src/components/SelfCheck.tsx`), ticket #117, at a78bf7b.

## Design Health Score: 24/40 (Acceptable)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Outcome "Logged" and bodyweight Save are page state only |
| 2 | Match system / real world | 3 | Load codes (MOD) in the plan heading |
| 3 | User control and freedom | 2 | "Do it today" only hides the offer |
| 4 | Consistency and standards | 2 | Two sheet bodies; teal selection; vermilion as decoration |
| 5 | Error prevention | 2 | Primary before the flags, primary on a rest day |
| 6 | Recognition rather than recall | 3 | Held work on the task, check state on the read |
| 7 | Flexibility and efficiency | 2 | Primary ~1.4 screens down on a phone |
| 8 | Aesthetic and minimalist design | 3 | Read card fills the first screen |
| 9 | Error recovery | 2 | Six controls do nothing |
| 10 | Help and documentation | 3 | Why-we-ask, sources |

## Priority issues
- [P1] Primary before the flags and on a rest day. Fixed: moved after the watch-outs (6a5c2fa); rest day kept by the spec's rule.
- [P1] Dead controls and a false "Logged" (pre-existing); second primary in the rehab starter. Rehab apply made quiet, outcome ask gated on the record (6a5c2fa); the rest answered on #117 as out of scope.
- [P2] Colour as decoration (stop focus chip, vermilion streak, teal selection). Fixed (6a5c2fa).
- [P2] Phase outranks today's headline in the plan card. Fixed (6a5c2fa).
- [P2] Self-check sheet body differs from the check's. Fixed in place (6a5c2fa); stepping it is left for a follow-up.

## Detector
CLI: 0 findings (regex-only on .tsx). In page: undersized-ui-text / tiny-text on the 9–11px ranks DESIGN.md defines (measured rules stand), wide-tracking on the trend meta (fixed), stragglers (flag advice text-pretty), self-check row 43.5px in the empty pass (fixed).
