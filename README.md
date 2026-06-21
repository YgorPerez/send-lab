# SEND LAB

> climb harder

An 8-week climbing training console for an advanced, tissue-limited athlete.
Ported from a single-file HTML prototype to **SvelteKit + TypeScript**.

## Features

- **Today** — a four-question day recommender that weighs recovery, finger
  condition, schedule slot, and skin/CNS state, then prescribes the right
  session (or tells you to rest).
- **Week** — the microcycle with phase periodization (Phase 1 / Phase 2 /
  deload), per-day completion tracking, and a progress bar.
- **Exercises** — the full prescription library with a tap-to-swap engine;
  swaps feed back into the week view.
- **Metrics** — performance markers (RFD, contact, critical force, pinch,
  pull, max hang, density) with inline sparkline trends.
- **Log** — newest-first history of recommended sessions, completed days, and
  marker tests.

All state persists to `localStorage` — it is a pure client-side app.

The UI is fully bilingual (**English / Português-BR**) via a header language
switcher; the choice persists across reloads.

## Stack

- [SvelteKit 2](https://svelte.dev/docs/kit) with Svelte 5 runes, on Vite 8
- TypeScript (strict)
- [**Tailwind CSS v4**](https://tailwindcss.com) via `@tailwindcss/vite`
- [**shadcn-svelte**](https://www.shadcn-svelte.com) components (Button, Card,
  Accordion, Input, Badge, Progress, Select, Separator, Sonner), themed with the
  climbing palette mapped into shadcn's token system (dark only)
- [**Paraglide JS**](https://paraglidejs.com) i18n — UI strings as compiled
  messages (`messages/en-US.json`, `messages/pt-BR.json`); the bulk training
  content lives in locale modules under `src/lib/content/` selected by the
  active locale
- `@lucide/svelte` icons
- `@sveltejs/adapter-static` — prerendered SPA, deployable to any static host
- **pnpm** as the package manager
- **Biome** for linting + formatting
- **TypeScript 6** for the Svelte toolchain, plus **TypeScript 7** (`tsgo`, via
  `@typescript/native-preview`) as an additional native typecheck gate

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

## Build

```bash
pnpm build        # outputs to ./build
pnpm preview      # serve the production build locally
```

## Internationalization

- Locales: `en-US` (base) and `pt-BR`, configured in `project.inlang/settings.json`.
- Edit UI strings in `messages/en-US.json` / `messages/pt-BR.json`.
- The Vite plugin compiles messages on dev/build; `pnpm paraglide` compiles them
  manually (the `check`/`typecheck` scripts run it first so the generated
  `src/lib/paraglide/` exists). That folder is generated and git-ignored.
- Domain content (exercises, days, quiz, verdicts, phases) is translated in
  `src/lib/content/en-US.ts` and `pt-BR.ts`, selected at runtime by the locale.

## Quality gates

`pnpm verify` runs the full gate chain; each is also runnable on its own:

```bash
pnpm verify           # lint → check → typecheck:ts7 → doctor → fallow
pnpm lint             # Biome (check); `pnpm lint:fix` to auto-fix
pnpm format           # Biome formatter (write)
pnpm check            # svelte-check (TypeScript 6)
pnpm typecheck:ts7    # tsgo — TypeScript 7 native, scoped to .ts via tsconfig.gate.json
pnpm doctor           # svelte-doctor — Svelte correctness/perf/a11y health
pnpm fallow           # fallow — dead code, cycles, dependency hygiene
pnpm fallow:health    # fallow — complexity / maintainability hotspots
```

> Why TS 6 *and* TS 7: `svelte-check` requires the legacy `typescript` package
> API, which the native TS 7 preview no longer exposes — so the Svelte toolchain
> stays on TS 6 while `tsgo` provides a forward-looking TS 7 typecheck over the
> plain `.ts` sources (`tsgo` can't parse `.svelte`; `svelte-check` covers those).

## Notes

Not medical advice. Stop on any sharp or lingering finger pain. Training
content calibrated from López-Rivera, Tyler Nelson / Camp4, Keith Baar,
Eric Hörst / Lattice, and Ferrer-Uris 2023.
