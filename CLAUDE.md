# Send Lab

An 8-week climbing training console for a single athlete. See `CONTEXT.md` for the domain vocabulary
and `docs/adr/` for the accepted decisions and the traps that produced them.

Before writing any UI, read `docs/component-vocabulary.md` — the named components every page composes
from, the React idiom for the three patterns that recur here, and the rules that came out of
measuring rather than arguing.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `YgorPerez/send-lab`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Design review

`/impeccable` is a project skill (`.claude/skills/impeccable/`). **A ticket that ships UI closes only
after an `/impeccable` pass on what it changed**, with each finding fixed or answered in writing on the
ticket. The measuring gates still apply. See `docs/agents/impeccable.md` for the rule, the pinned
version, and why the engine binary and the edit hooks are not committed.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
