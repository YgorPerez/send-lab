---
target: Timer screens (picker, full-screen clock, protocol editor)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/servidor-azul/send-lab/src/routes/timer.tsx"
target_fingerprint: "sha256:0cc548c71bd56e9eea9fc0fa6f6295accc6e77a75828a06f8cefd3c6a457fb56"
target_path: /home/servidor-azul/send-lab/src/routes/timer.tsx
timestamp: 2026-11-06T17-56-13Z
slug: src-routes-timer-tsx
---
Method: dual-agent (A: design review agent · B: detector agent, isolated)

# Critique: Timer screens (picker, full-screen clock, protocol editor) — 24/40 Acceptable

## Heuristics
1 Status 2 (paused == running on full screen; unlabelled 1/3) · 2 Real world 3 (resume says "Iniciar") · 3 Control 3 (Reset unguarded, 8px from Skip) · 4 Consistency 2 (strip digit tinted vs white full-screen; 0:04 vs 4s; opposite action alignments) · 5 Error prevention 3 · 6 Recognition 3 · 7 Flexibility 2 (no steppers; dup→edit→keyboard) · 8 Minimalism 1 · 9 Recovery 3 · 10 Help 2. Total 24/40.

## Specificity
Behaviour is athlete-specific (row anchoring, wake lock, face as 343x389 target, paused restore); visuals are generic dense-dark-dashboard + ring-timer template. Detector: CLI 0 findings; browser 4x undersized-ui-text (AppShell.tsx:89,140 EN/PT + brand eyebrow; FullScreenClock.tsx:158 protocol name) — conflicts with the measured 10px .eyebrow house rule, to be answered in writing. Detector missed other 10px text (Timer.tsx:654,677).

## Priority issues
- [P1] Full-screen clock does not spend the screen on number + segment: ~80px cap height for 2 glyphs, ~52px for 2:30; ~150px dead above/below the ring; segment only in a 9px ring stroke + 13px title; Roboto Mono wide with slashed zero. Fix: full-bleed segment colour, width-filling condensed tabular digits, large up-next band.
- [P1] Paused invisible from 2m; resume labelled "Iniciar". Fix: PAUSADO on the face; "Retomar".
- [P1] Redundant info: total duration up to 4x; Decorrido+Falta+Total; strip name truncates; study links on an Operate screen.
- [P2] Crooked buttons: row actions right-aligned vs Novo protocolo left; Start jumps 28px/changes width when countdown crosses 10s; 38 vs 44px icon boxes; 8/8/16 control gaps; PT study link wraps left.
- [P2] Flat type scale: 9 sizes, 4 within 10-12px; mono for labels and data; protocol name weaker than the eyebrow above it.

## Persona red flags
Hanging athlete 2m: paused vs running, 14px up-next, rest vs cooldown only by ring stroke, Skip→Reset slip. Casey: Start moves; strip Start out of thumb reach when scrolled; 38px menu. Alex: 3 steps to tweak a preset; 54-char copy names; no recents.

## Minor
h1 under top bar after Duplicar; editor field order != run order; editor backdrop blanks context; desktop 376px Start bar; stopwatch strip layout differs; repeated citation; ~130px chrome before clock.

## Questions
Does the ring earn its place on a segment-coloured field? Has Decorrido/Falta/Total changed a decision mid-hang? Default view: 23 presets or recents?
