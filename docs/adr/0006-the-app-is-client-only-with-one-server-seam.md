---
status: accepted
---

# The app is client-only, with one server seam and no locale in the URL

Send Lab has been a client-rendered SPA since long before this rebuild —
`src/routes/+layout.ts` sets `ssr = false` with the note that data and auth
resolve on the client through the app's own REST API. The rebuild keeps that
shape deliberately, and this records the four decisions that make it concrete
plus the one they force about locale, so a build session can follow them without
re-deciding and a later reader doesn't mistake them for accidents.

**Client-heavy everywhere, no exceptions.** Not "client-heavy by default with a
list of exceptions": `login`, `welcome` and `studies` were each considered as
server-rendered pages and rejected, because a split idiom costs more in drift
than the three pages save. React Server Components are declined outright. Their
payoffs — smaller bundles, static shells, SEO, content streaming — have no
purchase on a private per-account console, and full offline including writes
settles it independently, because a page cannot render from a server the device
cannot reach.

**One `ssr: false` seam, at the root.** The app tree never prerenders. On
TanStack Start this is the documented `shellComponent` plus `pendingComponent`
pattern with `defaultSsr: false`, and it emits `/_shell.html`: root route only,
user-independent by construction, at a stable configurable path. That artefact is
what an offline-first PWA precaches, so an installed app cold-starts from the
service worker rather than the network — which is what makes a client-only tree
acceptable on a phone rather than a liability. The alternative considered was
letting the tree prerender and gating every browser-state read behind a `mounted`
flag; it was rejected because it pays a recurring discipline tax forever, for a
static shell this app has no use for.

**Mutations are replayable plain HTTP through a shared module.** Server routes
are plain `Request` in, `Response` out; `server/state/*` holds the rules, and both
the sync endpoint and the MCP tools import it rather than one calling the other.
`sanitizeState` is already exactly this kind of shared rule. Server-function-style
RPC is declined: such calls dispatch one at a time per client, which would
serialize the Train page's task-ticking, and their responses are opaque payload
streams a service worker can intercept but cannot queue as replayable JSON. The
granularity of what crosses the wire is not settled here.

**No middleware; authorization is per handler.** `hooks.server.ts` today is
twenty-seven lines and performs no authorization at all — it runs an origin guard,
resolves one session into `event.locals`, and mounts the auth handler, while every
endpoint checks for itself. Its replacement is a `withAthlete(handler)` wrapper
composed with `assertSameOrigin()`, and the reason is offline: when the device has
no network the service worker serves the shell and middleware never runs, so the
client must handle the unauthenticated case correctly regardless. An optimistic
middleware redirect would be the same decision implemented twice, and the copy
that runs less often is the one that rots. The known weakness — a forgotten
wrapper is a silent, exploitable hole — is answered by a build-time check that
every server route's exported methods go through it.

## Why locale does not enter the URL

Localized rendering is client-side, necessarily: nothing renders localized output
on a server for the browser, so Paraglide compiles through the Vite plugin exactly
as it does today and its server-side resolution is unused.

Whether locale enters the *URL* was a real choice — TanStack Router offers
optional path params that match `/train` and `/pt-BR/train` from one file, and a
router-level rewrite that keeps locale out of the route tree entirely. Both were
declined on merit rather than capability, and the PWA requirement decided it: the
precached shell is user-independent by construction, and a locale in the URL
yields either two shells to keep in sync or a single shell that must client-side
redirect on every cold start — precisely the moment an installed app is supposed
to feel instant. The usual reasons to want it, shareable localized links and SEO,
are worth nothing to a private single-athlete console.

The athlete's locale is therefore **account data**. It has to be: `/mcp`
authenticates by bearer token and never reads cookies (ADR 0004), so localized MCP
output cannot be served from anything the browser sets. A cookie has no consumer
here at all, and the earlier "move locale to a cookie" item is retired.

## Consequences

**`prefs` gains a `locale` field.** It is `{ weight, length, notify }` today. This
is the schema change the decision requires, and it is also what carries the
athlete's choice to a second device.

**Locale resolves in a fixed order:** localStorage on boot — instant, available
offline, and available before login, none of which the account document manages —
then overridden by `prefs.locale` once the account hydrates. Changing locale writes
both. Paraglide's strategy stays as configured today.

**Three checks become build-time requirements**, because each guards something
that fails silently: every server route's methods go through the auth wrapper;
every key in the base locale exists in `pt-BR`; and the service worker exists, is
non-empty, and has a populated precache manifest.

**What holds the interactive state is deliberately not decided here.** It moved to
the state-model ticket, because "what holds the state" and "does the single JSON
document survive" are one question seen from two sides. Two exclusions are proposed
there and remain open: no client data-fetching library, since one server resource
under one key would make its cache a third copy of the truth beside the store and
the localStorage mirror; and no route loaders for account data, which is what keeps
router loader caching from re-introducing back/forward reuse.
