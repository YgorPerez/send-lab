---
target: "the shell navigation (#115)"
total_score: 26
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 1
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-0e4eacaa/src/components/AppShell.tsx"
target_fingerprint: "sha256:18bd59d8b1967872f908056c6b524bff3d5b144d294afa5c8d992121e7576854"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-0e4eacaa/src/components/AppShell.tsx
timestamp: 2026-11-07T09-43-55Z
slug: src-components-appshell-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

# Critique: the navigation (#115): bottom bar with More, lg rail, top strip

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | /login marked nothing; nothing marked before hydration (by design) |
| 2 | Match System / Real World | 3 | Labels are the athlete's words; house/dumbbell icons generic |
| 3 | User Control and Freedom | 3 | Sheet open across lg became an invisible modal |
| 4 | Consistency and Standards | 3 | Screen action has two homes until #119 (strip slot, header action) |
| 5 | Error Prevention | 3 | Update notice covered More's Week row |
| 6 | Recognition Rather Than Recall | 3 | Week behind More on a phone |
| 7 | Flexibility and Efficiency | 2 | Rail after main in tab order |
| 8 | Aesthetic and Minimalist Design | 3 | Strip + bar ~100px on a phone |
| 9 | Error Recovery | 3 | Sync states unchanged |
| 10 | Help and Documentation | n/a | Navigation chrome; labelled five-item bar |
| **Total** | | **26/36** | **Good** |

## Design Specificity Verdict

Structure is specific to the training day (four places a session moves between, More for the rest, the bar
standing down for the keyboard, the mini bar on the bar, the intake opting out by route). Visual vocabulary is the
category's (pill behind the active icon, SaaS sidebar at lg), acceptable for Operate inside the locked identity.
Deterministic scan: `impeccable detect` on the six changed files, 0 findings. Overlay on /, /timer, /week (360) and
/ (1280): only shell hit is `undersized-ui-text` on the 10px strip wordmark, pre-existing; the rest is page content
owned by later tickets.

## Priority Issues

- [P1] Rail 217px against 200px reserved (box-content): border 3px from titles between 1024 and ~1215px. Fix: border-box, bar height var(--nav-clear).
- [P2] More's sheet `lg:hidden` while open: invisible modal holding focus. Fix: hide only the trigger.
- [P2] Update notice z-60 over the sheet's Week row. Fix: under the backdrop.
- [P2] <nav> after <main>: keyboard tabs the whole screen before the rail. Fix: nav first in the DOM.
- [P3] /login marks nothing. Fix: Settings holds /login.

## Persona Red Flags

- One-handed mid-session: Week is two taps; no swipe-down on the sheet; notice over the Week row.
- Keyboard / screen reader: rail last in tab order; no aria-current before hydration.
- Stress tester: rotate with the sheet open; 1024–1215px gutter; /login unmarked.

## Minor Observations

Strip slot has no tenant yet; rail has no head (empty strip corner at lg); wide monitors centre the measure far
from the rail; the sheet's title repeats "More"; the stand-down leaves --nav-clear set.

## Questions to Consider

Should the rail carry a head at lg (would revise story 16's shared left edge)? Could the phone strip shrink while
ADR 0008 keeps sync state on every screen?
