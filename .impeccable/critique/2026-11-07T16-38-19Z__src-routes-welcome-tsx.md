---
target: "the intake on /welcome (#123)"
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-6868cd1d/src/routes/welcome.tsx"
target_fingerprint: "sha256:fa014feffe8c70acf0553d4db383874642143623bd4276a7c4716dabe212350a"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-6868cd1d/src/routes/welcome.tsx
timestamp: 2026-11-07T16-38-19Z
slug: src-routes-welcome-tsx
---
Method: dual-agent (A: ad69b3616c92a8e0b · B: a9a856cdfd36d011a)

Target: the intake on `/welcome` (`src/routes/welcome.tsx`, `src/components/ui/Stepper.tsx`), ticket #123, assessed at 370662d (before the critique fixes in ebd3ca5).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Last step: all four segments chalk, current step not marked; Start keeps its label while saving |
| 2 | Match System / Real World | 3 | "Four questions" undercounts; proposal notes read as orders to a coach |
| 3 | User Control and Freedom | 3 | ✕ on every step; what leaving costs is said only at the bottom |
| 4 | Consistency and Standards | 3 | Option line 44px/13px here, 48px/15px in the readiness sheet; multi-select drawn like single-select |
| 5 | Error Prevention | 4 | No defaults; last step gated on the whole draft |
| 6 | Recognition Rather Than Recall | 3 | Equipment does not say it takes several |
| 7 | Flexibility and Efficiency | 3 | Redo prefilled, draft resumable |
| 8 | Aesthetic and Minimalist Design | 3 | Lede, help line and head repeat each other |
| 9 | Error Recovery | 3 | Failed save keeps answers; offline vs server not told apart |
| 10 | Help and Documentation | 3 | Synovitis self-test in 4 lines of 11px faint |
| **Total** | | **31/40** | **Good** |

## Design Specificity Verdict

LLM: specific everywhere except the payoff (the proposal's trains/rest chips are generic). Detector: CLI clean (0 findings). Overlay: undersized-ui-text (10px rail labels, day chips, wordmark: DESIGN.md's Label rank, false positive), tiny-text (11px, on the ramp, false positive), line-length (desktop help line), stragglers.

## Priority Issues

- [P1] Focus fell to body on the move to the proposal and on the way back. Fixed in ebd3ca5.
- [P2] Week step does not say which answer is multiple (equipment) or optional (session length). Fixed in ebd3ca5.
- [P2] Copy: "Four questions"; niggle line points at a program "below"; proposal notes imperative. First two fixed; notes are training content (spec: not touched).
- [P2] New spacing pushed the advance below the fold at 360px pt-BR (repeated lede). Lede now on step 1 only (ebd3ca5).
- [P3] Body step's "Fingers" head quieter than the questions under it. Head dropped; questions head themselves (ebd3ca5).

## Persona Red Flags

Chalky thumb in glare: selected option is a chalk edge + brighter text (the #119 measured selection language). Keyboard/screen reader: focus to body on the proposal (fixed). Niggle reporter: "below" pointed at nothing (fixed); self-test small (now 13px dim).

## Minor Observations

Birth date shows the browser's date format; rail labels mono; ✕ at the strip's right edge on desktop; proposal lede split "Força de / dedo" (fixed, nowrap); blank pending state; no focus ring on the programmatically focused line (deliberate, as the sheet's question); unreached rail segment 1.75:1 on the sheet's panel (state carried in text).

## Questions to Consider

Should the proposal draw the week as the Week screen does? Should the waiting line be gold before anything is touched? Would a worded exit in the strip read better than ✕?
