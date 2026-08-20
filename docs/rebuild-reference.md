# Rebuild reference — what left `development`, and where to find it

The TanStack Start scaffold ([#21](https://github.com/YgorPerez/send-lab/issues/21)) stripped SvelteKit
from `development`. Nothing was lost: **`main` still serves the production SvelteKit app**, so every file
below is one `git show` away.

```sh
git show main:src/lib/plan.ts
```

## Domain logic that did not come across

These modules read the Svelte-5-runes store (`src/lib/state.svelte.ts`), which ADR 0007 and ADR 0008
replace with collections and an offline write queue. Porting them meant either pre-empting the state
model or authoring a fake store, so they stayed on `main` until the ticket that owns their replacement
runs.

| Module on `main` | Lines | Store coupling | Re-authored by |
|---|---:|---|---|
| `src/lib/plan.ts` | 700 | 82 `appState` reads | **its pure half is ported** — `src/lib/prescription.ts` ([#69](https://github.com/YgorPerez/send-lab/issues/69)); the mutations belong to [#57](https://github.com/YgorPerez/send-lab/issues/57) |
| `src/lib/stats.ts` | — | *(none — survived, see below)* | — |
| `src/lib/units.ts` | 74 | 12 (`prefs.weight` / `prefs.length`) | the state-model ticket |
| `src/lib/assessment.ts` | 101 | 9 | the state-model ticket |
| `src/lib/dayLog.ts` | 101 | 6 | the state-model ticket |
| `src/lib/backup.ts` | 103 | 3 | the state-model ticket |
| `src/lib/programStats.ts` | — | via `plan.ts` (6 functions) | the Program page (its `plan.ts` half is ported) |
| `src/lib/trainColumns.ts` | — | via `units.ts` (`edgeLabel`, `weightLabel`) | the Train page |
| `src/lib/state.svelte.ts` | 563 | *is* the store | ADR 0007 / ADR 0008 |
| `src/lib/timerStore.svelte.ts` | — | Svelte runes | the Train page |

Also gone, by decision rather than by coupling:

- **Every `.svelte` file** — 44 components and 17 routes. They are *reference for behaviour and content,
  never for structure* (redesign map [#42](https://github.com/YgorPerez/send-lab/issues/42)).
- **`src/lib/components/ui/**`** — shadcn-**svelte**. The React vocabulary is
  [#53](https://github.com/YgorPerez/send-lab/issues/53), on Base UI.
- **`customExercise.ts`, `mcpClient.ts`, the 11 `/api/v1` routes, `restApi.ts`, and the `metrics` /
  `stats` / `exercises` pages** — dropped outright by the keep/drop audit
  ([#12](https://github.com/YgorPerez/send-lab/issues/12)). `customExercises` was also removed from the
  server-side sanitizer and from `getContent()`.

## What survived, and how

| Kept | Note |
|---|---|
| `src/lib/content/**` (3,483 lines) | The bilingual training library and readiness logic. Became **fully framework-agnostic** once `customExercises` left `getContent()`. |
| `src/lib/stats.ts`, `presets.ts`, `programGen.ts`, `progression.ts`, `rehab.ts`, `readinessPlan.ts` | Imported **only types** from the store, so a one-line import swap saved all six. |
| `src/lib/types.ts` | **New.** The domain entity types, lifted out of `state.svelte.ts`. Holds entities, never the store — `AppState` deliberately did not come across. |
| `src/lib/displayDate.ts` | **New.** `today()`, `displayDate()`, `isTodayEntry()`. Kept out of `dates.ts`, which documents itself as dependency-free. |
| `src/lib/server/**` | Almost entirely framework-clean already; only `restApi.ts` imported `@sveltejs/kit`. `oauth.ts` / `oauthCleanup.ts` stay readable as reference while `@better-auth/oauth-provider` is wired. |
| `messages/`, `project.inlang`, `scripts/` | Paraglide compiles through the Vite plugin, which **works on Start** — it was Next's Turbopack that blocked it. |
| `src/app.css` | Ported verbatim, minus `@plugin 'tailwindcss-motion'`. Note #42 **reopened the palette**: these 110 lines are prior art to beat, not a floor. |
| `tests/` | All 8 files, 67 tests, migrated from `node:test` to Vitest by swapping one import. |

## Standing exceptions in the gate

`.fallowrc.json` currently ignores more than it should, because a scaffold with no pages necessarily
orphans its domain logic:

- **`unused-files`, `unused-exports` and `unused-types` are off.** 27 files and 34 exported symbols have
  no consumer yet: the domain layer is staged for the page tickets, and the content library is consumed
  within days by the redesign prototypes. Everything else fallow owns stays **on** — unused and unlisted
  dependencies, unresolved imports, circular dependencies, re-export cycles, boundary violations — which
  is the half that matters most while porting a tree across frameworks. **Turn these three back on as
  the page tickets land**; leaving them off permanently is exactly the orphan-hiding
  [#20](https://github.com/YgorPerez/send-lab/issues/20) warned a from-scratch rebuild would produce.
- **`ignoreDependencies`** for `@base-ui/react`, `motion`, `tailwind-variants`, `lucide-react` — the
  component stack settled by [#46](https://github.com/YgorPerez/send-lab/issues/46), installed and pinned
  but not yet imported because there are no components. Remove each entry as it gains a real import.
- **`@tanstack/react-start`** — a genuine production dependency; fallow reads it as test-only because the
  only direct import is the type-only reference in `src/start.d.ts`.
