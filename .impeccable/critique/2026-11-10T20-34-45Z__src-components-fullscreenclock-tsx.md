---
target: "#131 Back and Close in the full-screen clock header"
total_score: 20
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Administrator\\send-lab-wt\\131\\src\\components\\FullScreenClock.tsx"
target_fingerprint: "sha256:2a4741b08ca12652769762745d7b6f783ba66ef9f214e86cb69ea16939308c38"
target_path: "C:\\Users\\Administrator\\send-lab-wt\\131\\src\\components\\FullScreenClock.tsx"
timestamp: 2026-11-10T20-34-45Z
slug: src-components-fullscreenclock-tsx
---
Method: dual-agent (A: a70f8a402f638a80b · B: a1a07aa38b8097ac2)
Scope: #131 only. The full-screen clock's header: Back (‹) on the left, Close (✕) on the right that resets and closes, Close absent where there is nothing to reset, Escape and the system back gesture as Back, and the title's fit between them.

## Design Health Score (scored before fixes)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | after Back the strip or bar shows the run counting; nothing in the clock says Back keeps it |
| 2 | Match System / Real World | 2 | ‹ leaves as expected; ✕ usually dismisses and here it resets |
| 3 | User Control and Freedom | 2 | Escape, gesture and Back are safe; Close has no undo |
| 4 | Consistency and Standards | 2 | the app's other ✕s dismiss |
| 5 | Error Prevention | 1 | one tap until #132's second tap lands |
| 6 | Recognition Rather Than Recall | 3 | both exits visible |
| 7 | Flexibility and Efficiency | 3 | reset-and-leave in one move |
| 8 | Aesthetic and Minimalist Design | 3 | clean; title fell to 17.5px on narrow columns |
| 9 | Error Recovery | 1 | no undo after Close |
| 10 | Help and Documentation | n/a | one-athlete tool with no help surface |
| **Total** | | **20/36** | Acceptable |

## Design Specificity
LLM: built from the clock's own parts (48px squares, 14px corners, ink outlines on a field, quiet control off one); the weak point is meaning, not style. Detector: `impeccable detect --json` on FullScreenClock.tsx, Timer.tsx, Stopwatch.tsx: 0 findings. In-page detector over CDP and injected detect.js: 0 findings in 20 runs (360x800 and 640x360, en-US and pt-BR, five clock states). Names, tab order, focus rings (6.44:1 off a field, ink on a field) and icon contrast (≥6.44:1) checked in the page.

## Priority Issues
1. [P1] ✕ changed from safe to destructive with no visual change. ANSWERED: spec #130 pins Close as the ✕ ("no icon swap"); its guard is #132's second tap, on the same spec branch, so #131 does not reach main alone. Its accessible name is "Reset and close" / "Zerar e fechar".
2. [P1] Back drew fainter than Close (22px chevron, half the X's ink). FIXED: chevron 26px, X 22px.
3. [P2] No undo after Close. ANSWERED: spec #130 chooses the armed second tap (#132) with no overlay; an undo toast is a different design for the athlete to choose.
4. [P2] Title size jumps per segment; ENTRE SÉRIES at 17.5px under the 24px time left on a 320px column. FIXED in part: a two-word title takes two lines of up to 24px (never taller than the 48px controls); a space counts half a glyph. Remaining step-down (PREPARAR 26px at 320px, pt-BR) ANSWERED: it happens with the segment change, which repaints the whole screen, and only where the column is short.
5. [P3] Off-field outline 1px at 2.31:1. ANSWERED: the shared `quiet` recipe (and the ⋯ beside it); the glyph carries 1.4.11 at 10.36:1; changing the recipe is app-wide, not this ticket's.

## Minor
"Back" next to "Back a segment" for voice control: the spec pins "Back"/"Voltar"; the names differ and ⏮ is never in the header. Double tap on ✕ lands on whatever is under it after the close: as before #131, and #132 changes it. Sideways ready state scrolls Start below the fold: pre-existing (the ready state is outside the sideways grid), header height unchanged by #131; worth its own ticket.
