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

Login is required — each user's training state persists server-side in SQLite
(no localStorage). The pages are still client-rendered; a Node server backs
authentication and the per-user data API.

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
- [**better-auth**](https://better-auth.com) email+password authentication
- [**Drizzle ORM**](https://orm.drizzle.team) over **SQLite** (`better-sqlite3`)
  for auth tables + per-user state
- `@sveltejs/adapter-node` — runs as a Node server (auth + data API are dynamic)
- **pnpm** as the package manager
- **Biome** for linting + formatting
- **TypeScript 6** for the Svelte toolchain, plus **TypeScript 7** (`tsgo`, via
  `@typescript/native-preview`) as an additional native typecheck gate

## Develop

```bash
pnpm install
cp .env.example .env      # then set BETTER_AUTH_SECRET (openssl rand -base64 33)
pnpm exec drizzle-kit push # create the SQLite tables in ./local.db
pnpm dev                   # http://localhost:5173
```

## Auth & data

- Email + password via **better-auth**; sign up / sign in at `/login`. Every
  other route requires a session (client guard in the root layout).
- Server pieces: `src/lib/server/auth.ts` (better-auth + Drizzle adapter),
  `src/lib/server/db/` (schema + client), `src/hooks.server.ts` (mounts
  `/api/auth/*` and resolves the session into `locals`).
- Per-user training state is one JSON document in the `app_state` table, read
  and written through `/api/state` (`src/routes/api/state/+server.ts`); the
  client store hydrates on login and debounce-saves on change.
- Env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL` (see `.env.example`).
  The `.env` and `*.db` files are git-ignored.

## AI / MCP access

The account is editable by an AI client over MCP at `/mcp` (`src/routes/mcp/`).
Two ways to authenticate, both resolving to the same account:

- **Personal token** — a permanent `sl_…` Bearer token shown in Settings. Paste it
  into a header-auth client (Claude Code, Cursor, VS Code). Same token also drives
  the REST API under `/api/v1`.
- **OAuth 2.1** — for clients that require it (e.g. a claude.ai custom connector),
  the server is its own authorization server: discovery metadata at
  `/.well-known/oauth-protected-resource` + `/.well-known/oauth-authorization-server`,
  dynamic client registration at `/oauth/register`, a consent screen at
  `/oauth/authorize`, and the token endpoint at `/oauth/token`. It's PKCE-only
  (S256) with rotating refresh tokens; the user signs in and approves instead of
  pasting a secret. Add the connector with just the `/mcp` URL — no token. Core
  logic lives in `src/lib/server/oauth.ts`.

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

## Semantic code search (Serena)

[Serena](https://github.com/oraios/serena) is registered as an MCP server so an AI
client can navigate this repo by symbol instead of by grep. `.mcp.json`,
`.serena/project.yml` and `.claude/settings.json` are committed; the tooling itself
is a one-time local install:

```bash
uv tool install -p 3.13 serena-agent    # needs `uv` and `~/.local/bin` on PATH
pnpm install                            # svelte-language-server comes from node_modules
serena project index .                  # ~140s here, 173 files; optional but makes the first query fast
```

`languages: [svelte]` is deliberately the only entry. Serena measured `svelte` at 100%
of the source files — it subsumes `.ts` — and adding `typescript` alongside it makes
things *worse*: whichever server is listed first claims `.ts`, and
`typescript-language-server` cannot read `.svelte` at all, so every component consumer
disappears from reference results.

Two limitations, both measured on this workspace rather than assumed:

- **`find_referencing_symbols` over-reports for `.ts` exports.** It answers with every
  file that imports *anything* from that module: asking who uses `weekdayLabel`
  (genuinely used in one file) returns 19. Recall is intact — the real caller is always
  in the list — so treat the result as a candidate set to narrow, not a usage count.
  References *within* one file are exact.
- **Components have no referenceable symbol.** A `.svelte` file's only file-level symbol
  is of kind `File`, which `find_referencing_symbols` rejects. To find where a component
  is used, search the text for `<ComponentName` or its import path.

`find_symbol` and `get_symbols_overview` are accurate for both file types, and the first
semantic query of a session spends 13–30s warming the language server before answering.

> Unlike a Rust workspace, there is no readiness cliff here: the Svelte server answers
> correctly as soon as it answers at all, so no timeout tuning is needed.

## Notes

Not medical advice. Stop on any sharp or lingering finger pain. Training
content calibrated from López-Rivera, Tyler Nelson / Camp4, Keith Baar,
Eric Hörst / Lattice, and Ferrer-Uris 2023.
