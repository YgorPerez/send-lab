---
status: accepted
---

# The rebuild targets TanStack Start, not Next.js

The Next.js rebuild was already under way — four research tickets resolved, ~4700
lines of findings, a keep/drop audit fixing the scope — when the rendering
architecture was grilled and produced four answers in a row: no React Server
Components, no server rendering, no Server Actions, no middleware. Those are the
four features Next.js is designed around. What remained in use was file-based
routing, route handlers and a Vercel deploy target, which is close to TanStack
Start's entire design centre. Four opt-outs is not a run of local trade-offs; it
is a statement about fit, and it was cheaper to act on it one ticket before the
scaffold than to discover it afterwards.

React itself was never in question. React ecosystem access is the reason the
rebuild exists at all, and both candidates are React, so the library pool is
identical. This decision is about the host, not the runtime.

**The architecture is what chose the framework, not the other way round.** The
app has been a client-rendered SPA since long before this rebuild —
`src/routes/+layout.ts` sets `ssr = false` — and full offline *including writes*
means a page must render from a server the device cannot reach. Start supports
that as a first-class mode (`defaultSsr: false`, plus `shellComponent` and
`pendingComponent`) and emits `/_shell.html`: root route only, user-independent by
construction, at a stable path. That artefact *is* the app shell an offline-first
PWA precaches. Next emits HTML per route by design and `ssr: false` does not
collapse it, so the equivalent shell has to be hand-assembled and kept
user-independent by discipline rather than by construction.

Three further things fell out in the same direction. `better-auth` publishes a
`./tanstack-start` export at the same tier as `./next-js`, with a *synchronous*
header read and a single composable `beforeLoad` choke point that the App Router
demonstrably lacks — and without the `nextCookies()` RSC hazard that would log out
an athlete who spent thirty days only reading their plan. Server routes are plain
`Request` in, `Response` out, with no route-segment config, which deletes what our
own Next research named "the single biggest ergonomic hazard for Send Lab":
authenticated `GET`s silently baked into build output. And Paraglide, which the
app already compiles through `paraglideVitePlugin`, has a first-party TanStack
Start example — where on Next 16 it is blocked by Turbopack having no plugin API,
a gap the Paraglide maintainer has ruled permanently out of scope.

## Why the objections did not hold

**TanStack Start has never shipped 1.0.** It has been a release candidate since
September 2025 with no published timeline, and its breaking-change history is
unreadable: 58 minor lines, zero majors, no `BREAKING` markers, yet minors that
carry API changes. This is accepted, conditionally — *versions are pinned exactly
and upgrades are deliberate work, never routine*. Note that "breakage is cheap"
was a decision about athlete data, of which there is ~28 KB across five alpha
accounts; it does not transfer to developer time, which is the scarce resource.

Two of the three `needed-for-start-stable` blockers were described as sitting in
our path. Both dissolve. `setResponseHeaders` and `setResponseStatus` not working
in global middleware cannot reach a design that already decided against global
middleware in favour of a per-handler wrapper. And the `setCookie` clobbering bug
was narrowed, in the issue thread, to Node 20.19.2 specifically and is absent on
Node 22 — we pinned `nodejs20.x` only by inheritance, so the rebuild pins **Node
22**.

**The PWA tooling gap is a wash, not a differentiator.** It looked decisive:
`vite-plugin-pwa` silently generates nothing in a Start production build, and
Serwist inherits the bug as a fork. But neither host gives the service-worker
author an asset manifest — Next removed `app-build-manifest.json` in 16.0 and
`build-manifest.json` is incomplete for the App Router, which is why Serwist
resorts to globbing the filesystem. So the glue is hand-rolled either way. Next
gives worker *compilation* and you bring precaching; Start gives the shell and you
bring ~40 lines of `workbox-build`. Compiling a worker is a solved problem;
producing a stable user-independent shell is not. Start holds the better half.

**Vercel is not a TanStack hosting partner**, and both deployment guides route
through `nitro`, whose only npm dist-tag is a beta. Accepted rather than dodged:
Turso is host-agnostic, production already runs on Vercel, Vercel ships a named
`tanstack-start` preset with zero-config detection, and a beta-Nitro failure is a
*deploy-time* failure — loud, immediate, reversible. Moving to Cloudflare to reach
a supported path would put `better-auth` and the MCP server on a non-Node runtime,
an unexamined compatibility surface, to escape a risk that announces itself.

The ~1300 lines of research this invalidates were deliberately not weighed. Sunk
cost is not a reason, and most of that reading would happen again during the build
regardless.

## Consequences

**ADR 0003 loses an accidental safeguard, and the guard becomes mandatory.** On
Next, `next/root-params` was unavailable in Client Components and Route Handlers,
which quietly made label-as-identifier bugs harder to write. TanStack Router's
typed params are available everywhere, so that accident is gone. Branded identity
types were declined as *product scope* during the keep/drop audit and allowed back
only as a type-level gate technique — this is that return, and it is no longer
optional. The bug class stays invisible in the base locale, because the English
weekday labels are byte-identical to the stable keys, so any test proving the
guard must run in `pt-BR`.

**The build gate must fail on a broken service worker.** Both ecosystems' PWA
tooling fails silently behind a green build; one reported case shipped a truncated
worker to production for six days. The gate asserts the worker exists, is
non-empty, and has a populated precache manifest. Alongside it: locale key parity
between `messages/en-US.json` and `messages/pt-BR.json`, which neither i18n
library catches, and a check that every server route's exported methods go through
the `withAthlete` wrapper, since per-handler auth makes a forgotten wrapper a
silent, exploitable hole.

**The rebuild pins Node 22 and exact framework versions.** Upgrades are scheduled
work with a changeset read, not a routine bump.

**Two open questions were unblocked rather than answered**, and stay with the
rendering-architecture ticket: what holds the interactive state, and whether locale
enters the URL. The second is materially easier here — optional path params match
prefixed and unprefixed routes from one file, and a router-level `rewrite` can lift
locale out of the route tree entirely, neither of which the App Router offers.
