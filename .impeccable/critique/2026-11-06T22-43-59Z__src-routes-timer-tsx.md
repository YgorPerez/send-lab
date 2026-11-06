---
target: "Timer list (#111)"
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-16ab706f/src/routes/timer.tsx"
target_fingerprint: "sha256:a06349583ab8e84f45947c42e95099e076bf5baf741b37d739d8a2103345520e"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-16ab706f/src/routes/timer.tsx
timestamp: 2026-11-06T22-43-59Z
slug: src-routes-timer-tsx
---
Method: dual-agent (A: a3635d0495348cb94 · B: a658de1e170d782a9). Run as an implementation sub-agent: questions skipped, every finding fixed or answered on issue #111.

# Critique: Timer list (#111) — 28/40 Good

## Heuristics
1 Status 3 (paused bar carries no word) · 2 Real world 3 · 3 Control 2 (a row tap mid-run stopped the run) · 4 Consistency 2 (mono caps heads against the mockup; stopwatch bar in segment colours) · 5 Error prevention 3 (taps passed through the gap under the bar) · 6 Recognition 3 · 7 Flexibility 3 · 8 Minimalism 3 · 9 Recovery 3 · 10 Help 3.

## Specificity
The list is generic panel rows plus an accordion; the mini bar is the authored part. Detector: CLI clean (regex rules only on .tsx); in-page via --cdp, 3 × undersized-ui-text, all in the app shell (eyebrow wordmark, EN/PT switch), none in main or the bar.

## Priority issues
- [P1] Peeking at another row stopped the running clock (Timer remounted on the new key).
- [P2] Stopwatch bar coloured teal running / gold paused; reads as rest / prepare from 2 m.
- [P2] Section heads in mono caps against the approved mockup's Inter; laps in mono.
- [P2] Pointer-events-none band under the bar let taps reach the rows behind it.
- [P3] Recent's empty state shows a hairline the filled state lacks.

## Minor
⋯ column height follows the row (60/80px); #110's ready-header ⋯ was unbuilt; lap region gives no cue past the third lap; reload screenshot did not prove Recent (harness clears storage); row button names ran together for a screen reader; 8 group heads visible at once.
