# Deploy (Vercel + Turso, free)

The app is a TanStack Start SPA — client-only with one server seam (ADR 0006) — deployed to
Vercel Functions with its data in Turso (libSQL, SQLite-compatible). Locally it falls back to a
`file:local.db` file, so `pnpm dev` needs no Turso account.

## 1. Create the database (Turso)

```bash
# one-time: install + log in
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login

turso db create send-lab
turso db show send-lab --url          # → TURSO_DATABASE_URL  (libsql://…)
turso db tokens create send-lab       # → TURSO_AUTH_TOKEN
```

## 2. Create the tables in it

```bash
TURSO_DATABASE_URL='libsql://…' TURSO_AUTH_TOKEN='…' pnpm run db:push
```

`drizzle-kit push` needs a TTY. In a non-interactive session, apply the DDL directly through
`@libsql/client` instead — the schema is `src/lib/server/db/schema.ts`.

## 3. Deploy on Vercel

Import the repo at vercel.com. Add these environment variables **for Production *and* Preview**,
then deploy:

| Variable | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | the `libsql://…` URL from step 1 |
| `TURSO_AUTH_TOKEN` | the token from step 1 |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 33` |
| `BETTER_AUTH_URL` | the deployed origin, e.g. `https://send-lab.vercel.app` |

`BETTER_AUTH_URL` must match the real origin (it's the trusted origin for auth cookies). If you add
a custom domain later, update it.

**Preview deployments need their own values.** A preview with no `TURSO_DATABASE_URL` silently falls
back to `file:local.db` on an ephemeral filesystem, and one with no `BETTER_AUTH_SECRET` fails on the
first request rather than at build time — deliberately, so the shell stays buildable without
credentials (see below).

### How the build reaches Vercel

`vite build` runs the TanStack Start plugin and then **Nitro** (`nitro/vite`), which detects the host
and emits Build Output API v3 into `.vercel/output`. **Nitro is what makes the deploy work**: without
it the build still succeeds and produces `dist/`, and every route 404s — the deployment is green and
the site is empty. Nitro's only npm dist-tag is a beta; ADR 0005 accepted that knowingly, because a
Nitro failure is a deploy-time failure: loud, immediate, reversible.

`pnpm build` then generates the service worker and checks it. The check is part of the build on
purpose (ADR 0005): PWA tooling fails silently behind a green build, and a worker that precaches
nothing is indistinguishable from a working one until the device goes offline.

### Things that are deliberate, not oversights

- **The build needs no secrets.** `getAuth()` constructs better-auth on first request and the
  production-secret assertion is a runtime check. The build prerenders `/_shell.html` by fetching `/`
  from the built server bundle, so a module-level throw would make the shell unbuildable in CI and in
  previews — and the shell is user-independent by construction, so it must never need a credential.
- **`pnpm routes` and `pnpm build` used to disagree about `routeTree.gen.ts`, and
  now do not.** The file ends with a `declare module '@tanstack/react-start'`
  block registering the router's type and `ssr: true`. The Start vite plugin
  writes it; `tsr generate` strips it. Because `pnpm verify` runs `pnpm run
  routes`, *verify stripped it* — and a file committed after a green verify
  shipped without it. Nothing went red on the way: it is a type augmentation, so
  `tsgo` passes either way and the app builds and runs, losing only the router's
  type inside every `@tanstack/react-start` API. It cost two commits before
  `pnpm routes` was made idempotent (`tsr generate &&
  tsx scripts/restore-route-registration.ts`), with
  `tests/routeRegistration.test.ts` asserting the committed file still carries it.
- **`/_shell.html` is the deploy artefact that matters.** It is what the service worker precaches and
  what an installed app cold-starts from. `pnpm check:sw` asserts it exists, is precached, and
  contains nothing account-specific.

## Local development

Leave `TURSO_*` unset in `.env` to use `file:local.db`. Create its tables once with `pnpm run db:push`.
