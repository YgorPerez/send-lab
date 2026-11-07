# Impeccable: the design review every UI ticket closes on

`/impeccable` is a project skill, committed under `.claude/skills/impeccable/`. A fresh Claude Code
session in this repo has it with no setup. Codex and other agents read
`.claude/skills/impeccable/SKILL.md` and follow it.

## The rule

**A ticket that ships UI closes only after an `/impeccable` pass on what it changed.** Run it on the
screens and components the ticket touched (`/impeccable critique <path>` for a review,
`/impeccable audit <path>` for the technical checks). Then post one comment on the ticket listing each
finding and what happened to it: fixed, or answered in writing. A finding nobody answered keeps the
ticket open.

It sits on top of the measuring gates, not in place of them. `check:contrast`, `check:motion`,
`check:overflow` and `check:hydration` still apply, and `pnpm verify` still has to be green after the
fixes. When the skill's advice and a measured rule in `docs/component-vocabulary.md` disagree (its
11px text floor against the 9px `.microlabel`, say), the measurement stands. Answer the finding by
pointing at it rather than silently skipping it.

`PRODUCT.md`, at the repo root, holds the product context the skill reads first (written for the
Timer redesign, #110, and widened to the whole app by #114). `DESIGN.md`, beside it, records the
visual system as built, written from the finished Timer redesign (#110–#112) and extended by #114
with the grid, the spacing scale, the screen header, the group pattern, icon sizes and the clock
control; its sidecar is `.impeccable/design.json`. Each surface brief under `.impeccable/surfaces/`
holds one surface's mode and direction; the overhaul's (#113) is `src-components-appshell-tsx.md`. It describes the
system and does not outrank `docs/component-vocabulary.md`: where the two disagree, the vocabulary
wins and `DESIGN.md` is stale. A refinement does not need `/impeccable init` first. Starting a new
surface or redesign does: the skill routes that through `init`.

## What is installed

| | |
|---|---|
| Upstream | [pbakaus/impeccable](https://github.com/pbakaus/impeccable), by Paul Bakaus, Apache-2.0 ([impeccable.style](https://impeccable.style)) |
| Skill | `skill-v4.8.0`, commit `414603bf14c7a344edb466bb1f85690c77ce8b7d` |
| Engine | `0.1.18` (`scripts/VERSION`), checksums in `scripts/engine-checksums.txt` |
| Files | `.claude/skills/impeccable/` (the skill) and `.claude/agents/impeccable-*.md` (the four subagents it dispatches) |

The files are byte-identical to what `npx impeccable@4.8.0 install --providers=claude --scope=project
--no-hooks` writes, except for one file left out: the engine binary.

**The engine is not committed.** It is a ~20 MB binary per platform. On first run,
`scripts/impeccable` downloads the one `scripts/VERSION` names from the upstream GitHub release,
refuses it unless its sha256 matches `engine-checksums.txt`, and caches it in
`~/.impeccable/bin/<version>/`. So the first run needs network. In a sandbox without it, set
`IMPECCABLE_BIN` to a preinstalled engine. `.gitignore` keeps a locally installed
`scripts/bin/` out of the repo.

**The launcher is pre-approved.** `.claude/settings.json` allows
`Bash(.claude/skills/impeccable/scripts/impeccable:*)`, so the skill's first step
(`scripts/impeccable context`) does not stop at a permission prompt. Claude Code ignores a project's
allow rules until the folder has been trusted once, interactively. Before that, the skill falls back
to reading the project files and says so. It still works, just without the engine's signals.

**The edit hooks are not installed.** Upstream can add `SessionStart` / `PostToolUse` / `Stop` hooks
that run the detector after every UI edit. They would sit next to the Serena hooks in
`.claude/settings.json` and fire on every edit in every session. Instead, the skill tells you to run
`scripts/impeccable detect --json <targets>` once the UI work is done. To try the hooks in your own
session, run `/impeccable hooks on`. Commit them only by decision.

**Not linted.** `biome.json` excludes `.claude/skills/impeccable`, because vendored upstream code is
not ours to restyle.

## Updating

1. Pick a `skill-v*` release from the upstream releases page.
2. In an empty scratch directory: `git init && npx impeccable@<version> install --providers=claude
   --scope=project --no-hooks -y`.
3. Replace `.claude/skills/impeccable/` and `.claude/agents/impeccable-*.md` with what it wrote, minus
   `scripts/bin/`.
4. Update the table above (tag, commit, engine version) and run `pnpm verify`.
