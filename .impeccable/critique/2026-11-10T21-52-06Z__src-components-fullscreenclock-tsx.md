---
target: "the armed Close on the full-screen clock (#132)"
total_score: 24
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\Administrator\\send-lab-wt\\132\\src\\components\\FullScreenClock.tsx"
target_fingerprint: "sha256:2ef35039923461625f1b231d7b102fd46bdd44cda778ab7db44a60d26394743a"
target_path: "C:\\Users\\Administrator\\send-lab-wt\\132\\src\\components\\FullScreenClock.tsx"
timestamp: 2026-11-10T21-52-06Z
slug: src-components-fullscreenclock-tsx
---
Method: dual-agent (A: a5f1d0f6d1774acde · B: a4b0b43455003c387). Skill v4.8.0, engine 0.1.18. Target: the armed Close on the full-screen clock (#132).

## Design Health Score (Assessment A, before fixes)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | The ring shows on and off a field (10.57:1, 10.36:1); keyboard focus covered the sweep |
| 2 | Match with the real world | 2 | A sweep reads as time running out; nothing says what is armed (no text, pinned) |
| 3 | User control and freedom | 3 | Any other tap disarms and does its job; the window times out; no undo after the reset |
| 4 | Consistency and standards | 3 | Built from the clock's line vocabulary; at t0 it resembles a focus ring |
| 5 | Error prevention | 3 | A single stray tap is harmless now; a bounced double tap is not stopped |
| 6 | Recognition rather than recall | 2 | The ring's meaning has to be remembered |
| 7 | Flexibility and efficiency | 3 | A deliberate double tap is quick; Done takes one |
| 8 | Aesthetic and minimalist design | 3 | No new chrome; the last third hooked round the time left |
| 9 | Error recovery | 2 | A stray first tap fixes itself; the reset cannot be undone |
| 10 | Help and documentation | n/a | One-athlete tool, no help surface |
| **Total** | | **24/36** | 67%, Acceptable (20/36 on #131) |

Audit (Assessment B): 17/20 before fixes. Accessibility 3, performance 4, theming 3, responsive 4, implementation integrity 3.

## Design specificity verdict

Authored: the ring follows each button's own corner, runs at constant speed with `pathLength`, is drawn in `currentColor` so it adds no state colour, and the header does not move. Borrowed: at t0 on a field the doubled outline reads like a focus ring. The surface brief's "refuses the ring-timer template" is about the face; a 3-second ring on a 48px control is a control's state, so the thesis holds, provided the ring stays small and short-lived.

Deterministic scan: `impeccable detect --json` on FullScreenClock.tsx, Timer.tsx, Stopwatch.tsx and app.css: 0 findings, exit 0 (regex scan only for .tsx). In-page detect.js, injected over CDP with a planted-defect control: 8 armed-state scans (on a field and off, 360x800 and 640x360, en-US and pt-BR), 0 findings, no console errors.

## Priority issues and outcomes

1. [P1] Keyboard focus covered the armed ring (A and B agree). The focus outline sits 2-4px outside the button, the ring 2-5px; on a field both are the ink. Fixed: while armed, Close draws focus 7px inside its edge.
2. [P2] Arming was not announced reliably. Only the focused control's name changed. Fixed: an assertive live region says the armed name once. The 3-second limit (WCAG 2.2.1) is answered: running out loses nothing, and Reset in the control row then Back is the untimed path.
3. [P2] A bounced double tap confirms. Answered: a dead zone would swallow a deliberate fast double tap, and the spec pins a second tap inside the window. Put to the athlete.
4. [P3] The last third of the ring hooked round the "LEFT m:ss" readout. Fixed: the ring's end draws back to the top, so what is left is on the screen's edge.
5. [P3] A tap on the drawn ring, outside the 48px box, disarmed. Fixed: the ring is part of Close while armed.

## Persona red flags

- Casey: Close is top right, two stretched taps; the thumb covers the ring while tapping.
- Sam: focus masked the sweep (fixed); name change unreliable (fixed with a live region); "Tap again" is the wrong verb for a keyboard (pinned).
- The athlete at the board: no new hazard at the wall; at 2 m, armed reads as "Close got bolder"; a chalky bounce is the one real risk.

## Minor observations

- On Done inside the window the ring changes corner and ink with the field; it follows the button it rings.
- Off a field the ring is the brightest line in the header; it is the state.
- Held Enter's auto-repeat can confirm; a held key on Close is a repeated press.
- Ring geometry mirrors `headerControl`'s corners and borders by literal values in the same file.

## Questions

1. One short vibration on arming, eyes-free and under the thumb?
2. Press-and-hold instead of a second tap, to rule out the bounce?
3. Confirm only while running, one tap when paused?
