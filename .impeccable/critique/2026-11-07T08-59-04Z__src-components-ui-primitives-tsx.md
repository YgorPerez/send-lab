---
target: "the #114 overhaul foundation"
total_score: 14
max_score: 20
na_heuristics: 3,5,7,9,10
p0_count: 0
p1_count: 3
target_identity: "file:/home/servidor-azul/.t3/worktrees/send-lab/t3-acf1e88d/src/components/ui/primitives.tsx"
target_fingerprint: "sha256:a98ce8ba083c11cf79ff365a5096ef7fac5f4164255be5429bfb339206bc96cb"
target_path: /home/servidor-azul/.t3/worktrees/send-lab/t3-acf1e88d/src/components/ui/primitives.tsx
timestamp: 2026-11-07T08-59-04Z
slug: src-components-ui-primitives-tsx
---
Method: dual-agent (A: design review · B: detector + CDP measurement of the built app)

Target: the #114 foundation: spacing tokens (src/app.css), ScreenHeader (src/components/ui/primitives.tsx) on all eight routes, the `clock` button kind (src/components/ui/variants.ts), tailwind-merge config (src/lib/utils.ts), and PRODUCT.md / DESIGN.md.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Header readings carry status; Log's `28 · 15` does not say what it counts (Log ticket) |
| 2 | Match System / Real World | 3 | Domain words; "Microciclo" left to Week ticket |
| 3 | User Control and Freedom | n/a | No flow changed |
| 4 | Consistency and Standards | 2 | Title at 3 heights (58 / 64.75 / 67.92px) and 2 left edges at lg; two section ranks under the header |
| 5 | Error Prevention | n/a | No inputs changed |
| 6 | Recognition Rather Than Recall | 3 | `Week 5 / 8` is a button on Today, text on Week |
| 7 | Flexibility and Efficiency | n/a | Foundation only |
| 8 | Aesthetic and Minimalist Design | 3 | Lean header |
| 9 | Error Recovery | n/a | — |
| 10 | Help and Documentation | n/a | — |
| **Total** | | **14/20** | Good |

## Design Specificity Verdict
Specific to this product: rules derive from measured constraints (contrast pairs, 48px clock, pt-BR wrap, icon stroke arithmetic). Detector: 4 `design-system-font-size` advisories, all on pre-existing lines (clock 20px x2, ready title 25px documented in prose, Today 18px); five 15px hits cleared by adding `body-large` to the ramp.

## Priority Issues
- [P1] Title at three heights (right-hand 44px control set the row height). Fixed in bd12316: slot overhangs, 58px everywhere.
- [P1] Two left edges at lg; grid rule claimed alignment that only #115 can deliver. Answered in DESIGN.md: current vs target, one-pane pages align left, scrollbar gutter reserved (#115).
- [P1] DESIGN.md said the stopped strip's Resume is vermilion while the clock control is never vermilion; side controls unspecified. Fixed in DESIGN.md; #118 applies.
- [P2] Login lede and Settings offline note outside the header with negative margins; Today's reading is a control. Rule written; Login (#124) and Settings (#122) move theirs.
- [P2] Ambiguities: section rank, selection mark, Inside-Smaller vs inset, header offsets, mono meta. All decided in DESIGN.md.

## Persona Red Flags
Athlete mid-set: title jumping between Train and Timer on navigation (fixed).

## Minor Observations
Close X stroke unspecified (fixed); Do-list missing 18px chevron (fixed); Week title and reading both say "Week" (Week ticket); cue-settings icon 16px/1.8 against the 20px/1.75 rule (Timer ticket); "Session History" in title case (Log ticket); Train/Timer 24px section gap (their tickets).

## Questions to Consider
- Will a bright 2px outlined Pause outweigh the filled finish-and-log on Train? (#118 to check on the device.)
- Should ScreenHeader drop `action` once #115 gives the strip a slot?
