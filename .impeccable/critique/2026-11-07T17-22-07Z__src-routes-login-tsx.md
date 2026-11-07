---
target: "src/routes/login.tsx (sign-in, #124)"
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-7d08beed/src/routes/login.tsx"
target_fingerprint: "sha256:7985a375de9f3fc10d3fb6bb5ced5b70631c7708cbfb55730fd3af02a2213765"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-7d08beed/src/routes/login.tsx
timestamp: 2026-11-07T17-22-07Z
slug: src-routes-login-tsx
---
Method: dual-agent (A: af8c184a267970b0f · B: ad79e9c537d1d41bd). Assessed commit afc8693 (sign-in on the shared rhythm); fixes landed in 8912e94.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | In flight, Sign in looked exactly like the offline-disabled button |
| 2 | Match System / Real World | 3 | pt-BR auth_unreachable first person and calqued |
| 3 | User Control and Freedom | 4 | No gate, mode switch clears the failure |
| 4 | Consistency and Standards | 3 | Offline-disabled primary's reason far from it (Stepper and Settings keep them together) |
| 5 | Error Prevention | 3 | required/type/minLength/autocomplete right; no password reveal |
| 6 | Recognition Rather Than Recall | 3 | Offline reason must be remembered from the top |
| 7 | Flexibility and Efficiency | 3 | Enter submits, password-manager tokens |
| 8 | Aesthetic and Minimalist Design | 3 | Offline line repeated the strip chip and the device line |
| 9 | Error Recovery | 3 | Failure split excellent; failure stays after the field is edited |
| 10 | Help and Documentation | 3 | Lines are contextual help; no password recovery |
| **Total** | | **31/40** | **Good** |

## Design Specificity Verdict

LLM: the form skeleton is generic by right (a tool screen); the specificity is in the notices split by what the device holds, offline said as well as that, failures split by the instruction they carry, tones from the app's state colours, and the signed-in view refusing to offer sign-out. Glossary holds in visible copy.

Deterministic scan: `impeccable detect --json` on login.tsx, primitives.tsx, welcome.tsx, settings.tsx: 0 findings (regex mode). In-page detector on /login, 32 views (360/1280 × en/pt × 8 states): only `undersized-ui-text` on the shared strip's 10px wordmark and chips (global chrome, the measured label rank), one `line-length` warning on the has-record Notice at 1280 en-US (~90 chars across the 560px pane), one `text-occlusion` false positive (the detector's own label). Measured: notices 6.44–10.57:1, every target ≥44px, no clipping, and text inputs showed no keyboard ring (`outline: none` from the recipe's `outline-none` beating the base-layer `:focus-visible`).

## Priority Issues

- [P2] Offline-disabled primary's reason far from the button (login.tsx). Fix: a gold Notice under it, its aria-describedby.
- [P2] In-flight state identical to offline-disabled. Fix: "Signing in…" label, aria-busy.
- [P2] Offline copy repeats the strip chip and the device line. Fix: trim to "every other screen keeps working".
- [P3] Failure stays after the athlete edits the field it names. Fix: clear on change (behaviour).
- [P3] pt-BR auth_unreachable voice. Fix: "Não foi possível conectar ao servidor."
- (Assessment B) Text inputs have no keyboard ring (variants.ts input recipe, pre-existing).

## Persona Red Flags

Casey (gym signal): grey button with no reason offline once the keyboard is up; grey button with no word while a slow request is out. Sam (keyboard/screen reader): disabled Sign in skipped with no reason linked; no aria-invalid on a refused field; no visible ring on the fields. Riley (stress): stale unreachable line under a newly offline button; stale "email taken" after editing the email; no password recovery.

## Minor Observations

login_no_record promises sync of signed-out training (#97 open). Signed-in Bare hairline reads as an underline under the title. Vermilion stop line 10px above the vermilion fill. Failure line moves the primary down. auth_email_taken points at the mode switch below.

## Questions to Consider

One home for "the line about the primary" across Stepper, sign-in and Settings? Should the lapsed-sign-in reassurance lead? Does no-record earn three lines on every visit before #97? Is "forgot password" a feature or a sentence for a one-athlete server?
