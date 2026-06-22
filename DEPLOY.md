# Deploy (Vercel + Turso, free)

The app runs on Vercel serverless (Node runtime) with its data in Turso (libSQL,
SQLite-compatible). Locally it falls back to a `file:local.db` file, so `pnpm dev`
needs no Turso account.

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

## 3. Deploy on Vercel

Import the repo at vercel.com (it auto-detects SvelteKit). Add these environment
variables (Production), then deploy:

| Variable | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | the `libsql://…` URL from step 1 |
| `TURSO_AUTH_TOKEN` | the token from step 1 |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 33` |
| `BETTER_AUTH_URL` | your deployed origin, e.g. `https://send-lab.vercel.app` |

`BETTER_AUTH_URL` must match the real origin (it's the trusted origin for auth
cookies). If you add a custom domain later, update it.

## Local development

Leave `TURSO_*` unset in `.env` to use `file:local.db`. Create its tables once
with `pnpm run db:push`.
