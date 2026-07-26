# Send Lab plugin

Connects Claude Code to your [Send Lab](https://send-lab-sable.vercel.app) account
over MCP, so you can read and edit your training from any project.

## Install

```shell
/plugin marketplace add YgorPerez/send-lab
/plugin install send-lab@ygorperez
```

Then authenticate — run `/mcp`, pick **send-lab**, and approve in the browser. The
server runs its own OAuth flow, so there is no token to paste; the access token it
issues is short-lived and refreshes itself.

## What it can do

`get_state`, `get_program`, `list_exercises`, `update_state`, `replace_state`,
`set_periodization`, `set_auto_progress`, `edit_day`, `set_target`,
`create_exercise`, `update_exercise`, `delete_exercise`, `assess_baseline`,
`daily_readiness`, `assess_injury`, `start_rehab`, `rehab_today`.

Everything is scoped to the account you sign in as. Canonical units throughout:
kg, mm, seconds.

## Notes

This is a Claude Code plugin — it works in the CLI, the desktop app, and the IDE
extensions. Adding Send Lab to **claude.ai chat** is separate: that uses a custom
connector (Customize → Connectors → **+**) with the same URL,
`https://send-lab-sable.vercel.app/mcp`. On Team and Enterprise plans only an
Owner can add one.

Working inside the send-lab repo itself? The server is already declared in the
repo's root `.mcp.json`, so you don't need this plugin there.
