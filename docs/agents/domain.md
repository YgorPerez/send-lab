# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is **single-context**: one `CONTEXT.md` and one `docs/adr/` at the root. `pnpm-workspace.yaml`
exists for dependency policy (`overrides`, `allowBuilds`) and has no `packages:` key, so despite the
workspace file this is not a monorepo.

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-per-task-completion-is-the-source-of-truth.md
│   ├── 0002-day-types-have-identity-independent-of-weekdays.md
│   ├── 0003-identity-is-never-a-display-string.md
│   └── 0004-permissive-cors-and-redirect-handling-on-the-oauth-endpoints.md
└── src/
```

Multi-context repos (signalled by a root `CONTEXT-MAP.md`) instead put a `CONTEXT.md` and `docs/adr/`
under each `src/<context>/`, with system-wide decisions staying at the root. This repo is not one.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

`CONTEXT.md` here is opinionated about words to avoid — an **athlete** is never a "user", "client" or
"patient". Use its terms exactly.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

**The ADR most likely to catch you here is 0003 (identity is never a display string).** The app is
bilingual, so a user-facing label is locale-dependent and must never be an identifier. This bug class is
invisible in the base locale, because the English weekday labels are byte-identical to the stable keys
(`Mon`, `Tue`, …) — so if you touch anything that stores or matches a label, check it in `pt-BR`.
