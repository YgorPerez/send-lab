---
target: "Settings (#122)"
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-4c4ea380/src/routes/settings.tsx"
target_fingerprint: "sha256:a6d7ff79d2ad2f78fee82a1dbcffcc37bfa3f3a794efc128147b080c0f09da91"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-4c4ea380/src/routes/settings.tsx
timestamp: 2026-11-07T15-59-56Z
slug: src-routes-settings-tsx
---
Method: dual-agent (A: a4c7602be2c8ea5cf · B: a327519ee8ec1f57e), run as the implementer of #122 (subagent brief, no user to ask; questions skipped, answers go on the ticket).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Choosing lb/in shows as selected but nothing converts (pre-existing) |
| 2 | Match System / Real World | 3 | pt-BR "Conectado" read as online; AI access is developer jargon |
| 3 | User Control and Freedom | 4 | Every preference reverses in one tap; Regenerate guarded |
| 4 | Consistency and Standards | 3 | One list now; token group explained its disabled controls, Account did not |
| 5 | Error Prevention | 3 | Held sign-out and confirmed regenerate; units invite a wrong belief |
| 6 | Recognition Rather Than Recall | 3 | Offline at 360px the reason for a disabled Sign out was two screens up |
| 7 | Flexibility and Efficiency | 3 | Cue rows also one tap away in the Timer popover |
| 8 | Aesthetic and Minimalist Design | 3 | AI access is the tallest group and ends the page |
| 9 | Error Recovery | 3 | Token note said "couldn't reach the server" offline, when nothing was asked |
| 10 | Help and Documentation | 3 | Inline notes where needed |
| **Total** | | **31/40** | **Good** |

## Design Specificity Verdict

LLM: the generic grouped-list pattern, correct for a page opened rarely; the product shows in the copy (cue labels in the domain's words, held sign-out, a cue the device cannot deliver kept switchable and saying so). Consistent with Timer, Week and Log: Inter section heads, card of rows, Bare for prose, one left edge at 1280.

Deterministic scan: CLI `detect --json` on settings.tsx, CueSettings.tsx, primitives.tsx: 0 findings. In page (360/1280, en/pt, signed in, popover): tiny-text on the two AI-access notes (changed 12→11px by this ticket), 10px config eyebrow and shell eyebrow/badge (pre-existing furniture rank), stragglers on gold notes, text-occlusion under the open popover (false positive), viewport-edge on Timer prose at the 12px gutter (outside diff).

## Priority Issues

1. [P1, pre-existing] Weight and Length record a preference nothing converts (format.ts). Out of #113's scope (no new domain behaviour); belongs with the dead-controls domain ticket.
2. [P2] Offline, Sign out disabled with its reason two screens up. Fix: ControlNote under the row, as its description.
3. [P2] pt-BR "Conectado"/"não está conectado" reads as network state beside the offline line. Fix: "Você entrou"/"Você não entrou".
4. [P2] Held and refused sign-out notes not tied to Sign out nor announced. Fix: ids + aria-describedby, role=status on notes that answer a tap.
5. [P3] AI access dominates the page end, config always open. Answer: content unchanged by #122; disclosure is #125's sweep or a ticket.

## Persona Red Flags

Casey (gym, offline): Sign out dimmed with no reason in view; "Conectado" while offline; token says the server failed. Sam (screen reader): held sign-out silent; locale switch remount drops focus (pre-existing). Riley: long email truncated with no way to see it; lb with kg everywhere.

## Minor Observations

Segmented rows measure 57px (the divide-y hairline inside the box; pitch 56+1 everywhere). Control widths 132/184/156 stagger left edges; right edges align. Notifications label was a sentence with a period. AI-access icons 14px against DESIGN's 16px inline. Popover 320px at lg wraps two labels. Config eyebrow is the page's last mono caps (field label rank).

## Questions to Consider

Does Units deserve first place while it converts nothing? Would the notifications switch be more honest in the Timer popover where it is needed? Does AI access belong behind one row?
