# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Repo-specific notes

- **Repo:** `YgorPerez/send-lab`. `gh` infers it from `git remote -v` when run inside the clone.
- **The active `gh` account is not the repo owner.** `gh auth status` shows `ygor-infotera` as active while
  the repo is owned by `YgorPerez`. This works — `ygor-infotera` has `push` and `triage` permissions — but
  if an issue operation 403s, check which account is active before assuming the command is wrong.
- **The repo is public.** Issue titles, bodies and comments are world-readable the moment they're created.
  Don't put an unfixed security finding, a credential, or a production hostname paired with a weakness into
  an issue body. Fix first, then describe it — or keep the detail in a local note and link to it obliquely.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Existing label vocabulary

`/triage` is **not installed**, so this repo has no configured triage-label mapping and there is no
`docs/agents/triage-labels.md`. Note that the repo's existing issues already use `bug`, `enhancement`,
`ready-for-agent` and `ready-for-human` — the last two are exact matches for canonical triage roles, so if
`/triage` is installed later its defaults will apply the labels already in use rather than create duplicates.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
  **Decisions-so-far may outgrow the body**, which caps at 65,536 bytes: #11's reached 58,681 across
  twenty-two entries at ~3,500 bytes each, leaving room for one more ticket. When that happens the log
  moves to `docs/maps/<n>-<slug>.md` and the body keeps a link to it — see
  `docs/maps/11-tanstack-start-rebuild.md`, the first one moved. The other two maps are still under the
  cap and still hold theirs inline.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far — **in `docs/maps/<n>-<slug>.md` where the map has one**, otherwise in the map body. Entries go in landing order and end with the branch and commit the work landed at.
  Closing by commit message does **not** work here: GitHub auto-closes only from the default branch, and this repo builds on `development`, so a `Closes #n` line in a commit pushed there leaves the ticket open. Close it explicitly.

### Live maps

- **Map: TanStack Start rebuild** — [#11](https://github.com/YgorPerez/send-lab/issues/11), with tickets
  #12–#28 as sub-issues. Named for Next.js until 2026-08-15, when the framework decision resolved in
  TanStack Start's favour; anything on it written before that date saying "Next.js" is stale phrasing,
  not a live decision. Resolve it with `/wayfinder https://github.com/YgorPerez/send-lab/issues/11`.
- **Map: Every claim traceable and graded** — [#29](https://github.com/YgorPerez/send-lab/issues/29),
  with tickets #30–#37 as sub-issues. Charted 2026-08-16. Every number the app shows must resolve to a
  cited, evidence-graded claim. It **supplies** the rebuild map rather than duplicating it: this map
  specifies the model, grades, workflows and page design; the rebuild map builds the pages. Resolve it
  with `/wayfinder https://github.com/YgorPerez/send-lab/issues/29`.
- **Map: Redesign — a visual identity and a phone-native shell** —
  [#42](https://github.com/YgorPerez/send-lab/issues/42), with tickets #43–#53 as sub-issues. Charted
  2026-08-16. The app *"looks generic / unfinished"* and *"is not really a phone app"*; this map decides
  the visual identity, the navigation architecture for phone and desktop, and the component vocabulary.
  Like the evidence map it **supplies** the rebuild map: it decides, #11 builds. It closed
  [#19](https://github.com/YgorPerez/send-lab/issues/19) as superseded and it owns the design of all nine
  pages, sharing `/studies` with #37 by concern. Resolve it with
  `/wayfinder https://github.com/YgorPerez/send-lab/issues/42`.

All three maps express blocking as native dependencies, so each frontier is visible in GitHub's own UI
without opening the map. They are worked independently and may be edited by concurrent sessions.

This map was charted as local markdown under `.scratch/` before the repo was configured, and has since been
migrated. **`.scratch/` is no longer in use as a tracker** — don't reintroduce it, or the two copies will
drift. GitHub is the single source of truth.
