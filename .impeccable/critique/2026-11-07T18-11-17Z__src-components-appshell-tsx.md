---
target: "the eight screens together (#125 sweep)"
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-67471a84/src/components/AppShell.tsx"
target_fingerprint: "sha256:18bd59d8b1967872f908056c6b524bff3d5b144d294afa5c8d992121e7576854"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-67471a84/src/components/AppShell.tsx
timestamp: 2026-11-07T18-11-17Z
slug: src-components-appshell-tsx
---
Method: dual-agent (A: design review over the contact sheet · B: detector, in-page overlay and cross-screen probes). Assessed at cd385c9..d9b62fd (after the first round of #125 fixes, before the critique's answers in 51c9807).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Week's not-done task mark was an 11px faint dot |
| 2 | Match System / Real World | 3 | "Target" (Train) and "Deeper assessment" (Today) are glossary-avoided words |
| 3 | User Control and Freedom | 3 | Today's ticks vanish on reload (#126) |
| 4 | Consistency and Standards | 2 | One day's task list drawn three ways (Today, Week, Train); set columns labelled differently on Train and Log |
| 5 | Error Prevention | 3 | The set tick reads "done" ticked or not; the state is the fill |
| 6 | Recognition Rather Than Recall | 3 | Log's set table had no units |
| 7 | Flexibility and Efficiency | 2 | Train and Timer use 560 of 1000px at 1280 (capped by decision) |
| 8 | Aesthetic and Minimalist Design | 3 | Seeded Today is 2.5k px with three rehab-type actions |
| 9 | Error Recovery | 3 | From code only: one Notice family |
| 10 | Help and Documentation | 3 | Ledes, Why we ask and study links share one sentence pattern |
| **Total** | | **28/40** | **Good** |

## Design Specificity Verdict
LLM: authored for this product (the task card's category edge, the 9px set grid, Week's shape marks, counts shown at zero). The shell is one system: one title x and y, one header rhythm, one section rank, one selection mark. What still read as separate tickets was how the same domain objects are drawn: a day, a task, a set, a verdict tag.
Deterministic: CLI 19 findings, 18 `design-system-font-size` (all documented clock sizes, the 17px dialog title and 25px ready title, because DESIGN.md's frontmatter omitted them) and 1 `side-tab` (TaskCard's documented category edge). In-page on 7 views: `undersized-ui-text` on the documented 9–10px microlabel, label and chip ranks; two stragglers (welcome lede, rehab line); two unbalanced headings (Today's verdict); `repeated-container-text` on Train (library content). Probes: nothing clipped; h1 at y=58 (360) and y=66 (1280) on every route; header-to-content 28px everywhere; Today's large mono numbers and their bold units not named in DESIGN.md.

## Priority Issues
- [P1] One day's task list drawn three ways (Today plan card, Week day panel, Train cards): done marks, held marks, the day accent differ. Fix: one recipe; marks that clear 3:1, the held chip on Week, the accent on Today.
- [P1] Today and Week contradict each other on a new account (carry-forward from Wed vs Week's "To come" for past days). Resolver rule, domain.
- [P2] Glossary slips: "Target" heads Train's prescription; "Deeper assessment" opens the self-check; "Rehab plan" is a dead button beside "Start a rehab plan".
- [P2] Set columns labelled differently on Train and Log; Log has no units; Train's rest has none; grip runs into reps at 1280.
- [P2] Bodyweight hidden on a new account while Train says to log one; inline field labels vs `Field`.
- [P3] Same words in different type: the verdict tag mono caps on Today, Inter on Log; chip case mixed.

## Persona Red Flags
- Chalked athlete: unticked set reads "✓ done" like a ticked one; units hard-coded kg.
- Screen reader: Week's not-done dot decorative; held work unannounced on Week; Log's weights with no unit.
- New account: day one says Wednesday is unfinished, Week says it is to come; "Deeper assessment" vs "self-check".
- Desk at 1280: capped Train and Timer; the strip's screen action far right of a one-pane page.

## Minor Observations
Today's empty primary not full width; Picker chevron 14px default stroke; Add exercise the only dashed border; Train's clock-to-first-card gap 37px; headless Empty groups on Log and Today; disabled button border drifted from DESIGN.md; the self-check's last result in mono with a month name; pt-BR stats labels wrap unevenly.

## Questions to Consider
- Should Today's plan card and Week's day panel be one component before Program (#65) needs a third?
- Is today on Week a state (gold) or a position (chalk)?
- Should Today's plan rows be read-only, with Go to Train the only way in?
