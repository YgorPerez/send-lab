# TanStack Start as a host for the rebuild — research findings

Resolves ticket [#25](https://github.com/YgorPerez/send-lab/issues/25) of the Next.js rebuild map
([#11](https://github.com/YgorPerez/send-lab/issues/11)). **Research only. This document does not
recommend a framework** — the weighing happens in
[#26](https://github.com/YgorPerez/send-lab/issues/26). Where a fact has a consequence, the
consequence is stated as a consequence, not as advice.

**Researched 2026-08-15.** Every claim carries a URL and a version or a date. Where a fact could
not be established from a primary source it is marked **UNKNOWN** and the sources checked are
named. TanStack Start moves fast; several answers below were different six months ago and are
flagged where that is true.

Mid-flight the athlete promoted two requirements to first-class: **the app must be mobile-first,
and the PWA must be genuinely good.** Part 5 is therefore the longest part of this document, and
Part 5 is where the sharpest finding sits.

---

## Versions this document describes

| Thing | Version | Established from |
| --- | --- | --- |
| `@tanstack/react-start` | **1.168.46**, published 2026-08-14 | npm registry `dist-tags.latest` |
| `@tanstack/react-router` | **1.170.29**, published 2026-08-14 | npm registry `dist-tags.latest` |
| TanStack Start docs | **v0 / "Release Candidate"** | <https://tanstack.com/start/latest/docs/framework/react/overview> |
| `nitro` (the Vercel path) | **`3.0.260610-beta`**, published 2026-06-10 — the *only* dist-tag | npm registry |
| `vite-plugin-pwa` | **1.3.0**, published 2026-05-05 | npm registry |
| `serwist`, `@serwist/vite`, `@serwist/next`, `@serwist/turbopack` | **9.5.12**, all published 2026-07-22 (`preview` is `10.0.0-preview.14` from 2025-09-03) | npm registry |
| `unplugin-pwa` (announced successor) | **not published** — `404 Not found` on the npm registry | npm registry, checked 2026-08-15 |
| `next` (the comparison baseline) | **16.3.1**, published 2026-08-13 | npm registry |
| `next-pwa` / `@ducanh2912/next-pwa` | **5.6.0** (2022-08-23) / **10.2.9** (2024-09-18) | npm registry |
| `better-auth` | **1.6.29**, published 2026-08-14 | npm registry |
| `@better-auth/oauth-provider` | **1.6.29**, published 2026-08-14 | npm registry |
| `@modelcontextprotocol/server` | **2.0.0**, published 2026-07-27 | npm registry |
| Vite (used by the first-party Start examples) | **^8.0.14** | `examples/react/start-i18n-paraglide/package.json` |
| Vercel Node.js runtimes | 24.x (default), 22.x, 20.x | <https://vercel.com/docs/functions/runtimes/node-js/node-js-versions> (`last_updated: 2026-02-27`) |

npm registry figures were read directly from `https://registry.npmjs.org/<package>` on 2026-08-15.

---

## 1. Maturity and trajectory

### 1.1 It has not shipped 1.0. The docs still say Release Candidate.

This is the single most load-bearing fact in the document, and the npm version number actively
disguises it. The overview page carries this note at the top, today:

> **Note**
> TanStack Start is currently in the **Release Candidate** stage! This means it is considered
> feature-complete and its API is considered stable. This does not mean it is bug-free or without
> issues, which is why we invite you to try it out and provide feedback! The road to v1 will
> likely be a quick one, so don't wait too long to try it out!
> — <https://tanstack.com/start/latest/docs/framework/react/overview>, read 2026-08-15

The documentation site's own version selector reads **"React v0 Latest"**, and `/start/latest/…`
and `/start/v0/…` serve the same page — TanStack's own docs are versioned `v0` for Start.

Meanwhile `npm view @tanstack/react-start version` returns **`1.168.46`**. The two are not in
conflict; they are just measuring different things. `@tanstack/react-start`'s first non-prerelease
publish was **`1.111.10` on 2025-02-25** — it never published a `1.0.0`. It jumped straight from
`0.0.1-beta.204` into the `1.1xx` line to sit alongside `@tanstack/react-router`, which *is* a real
1.x (its `1.0.0` shipped 2023-12-23). **The leading `1` on `react-start` is version alignment with
the router, not a stability declaration.** Anyone reading the package version alone will conclude
this is a mature 1.x product. The docs say otherwise.

The v1 Release Candidate was announced on **2025-09-23** — eleven months ago:

> "TanStack Start has officially reached a **v1.0 Release Candidate**." … "This is the build we
> expect to ship as 1.0, pending your final feedback." … "React Server Components support is in
> active development and will land as a non-breaking v1.x addition."
> — <https://tanstack.com/blog/announcing-tanstack-start-v1>, 2025-09-23

The announcement promised "a few small RC iterations" before cutting 1.0. Eleven months later the
RC banner is still up.

### 1.2 There is no published date for stable, and the question has gone unanswered

GitHub Discussion [TanStack/router#5999](https://github.com/TanStack/router/discussions/5999),
"When is the Tanstack start stable release planned?", contains only questions. A second
participant re-asked on **2026-02-04**, tagging `@tannerlinsley` and `@schiller-manuel` for "a
rough approximate ETA for the stable release of Tanstack Start". **No maintainer has replied.**
As of 2026-08-15 there is no primary-source timeline for 1.0. Treat "the road to v1 will likely be
a quick one" as a statement from September 2025 that has not been renewed.

### 1.3 What is explicitly blocking stable — three issues, and two of them touch this app

The repository maintains a label, `needed-for-start-stable`, which is the closest thing to a
public release checklist. As of 2026-08-15: **25 closed, 3 open.** The three open ones:

| Issue | Opened | Title |
| --- | --- | --- |
| [#5407](https://github.com/TanStack/router/issues/5407) | 2025-10-08 | `setResponseHeaders` and `setResponseStatus` don't work in global middleware |
| [#5464](https://github.com/TanStack/router/issues/5464) | 2025-10-13 | Only the last `setCookie` takes effect on the server route |
| [#6200](https://github.com/TanStack/router/issues/6200) | 2025-12-23 | Throwing error in route loader with SSR streaming crashes dev server |

Two of the three are directly in this app's path, and are covered where they bite:

- **#5407** is a response-status-and-header bug in *global* middleware — the exact primitive an MCP
  endpoint needs for "reject before you stream" (Part 3). A workaround is posted in-thread
  (`getResponseHeaders()` first, mutate, then `setResponseHeaders()`), attributed to the author of
  [PR #5537](https://github.com/TanStack/router/pull/5537). Open for ten months.
- **#5464** is a `Set-Cookie` bug — better-auth's whole session mechanism is cookies (Part 2). The
  reporter narrowed the root cause on 2025-10-16: *"The issue **only occurs when using Node.js
  v20.19.2**. After upgrading to Node.js v22.2.0, the problem no longer occurs — both cookies are
  properly set."* **Send Lab runs `runtime: 'nodejs20.x'` today.** Carrying that pin across would
  land on the broken side of this bug.

There are also four open issues under `needs-upstream-fix`, one of which is the PWA blocker that
Part 5 is about ([#4988](https://github.com/TanStack/router/issues/4988)).

### 1.4 Release cadence: extremely high, recently slowing

`@tanstack/react-start` has published **656 non-prerelease versions** between 2025-02-25 and
2026-08-14, across **58 distinct minor lines** (`1.111` → `1.168`) and **zero majors**. Per month:

| 2025 | | 2026 | |
| --- | ---: | --- | ---: |
| Feb | 6 | Jan | 69 |
| Mar | 41 | Feb | 41 |
| Apr | 16 | Mar | 40 |
| May | 14 | Apr | 40 |
| Jun | 49 | May | 30 |
| Jul | 50 | **Jun** | **8** |
| Aug | 34 | **Jul** | **8** |
| Sep | 44 | **Aug (to 14th)** | **12** |
| Oct | 59 | | |
| Nov | 46 | | |
| Dec | 49 | | |

The drop from ~40/month to ~8–12/month across June–August 2026 is the clearest signal in the data
that the project is settling. It is not a stability *guarantee*; it is an observation about the
last ten weeks.

### 1.5 Breaking-change history: not marked as breaking, because there is no major line

The changesets in `packages/react-start/CHANGELOG.md` and
`packages/start-plugin-core/CHANGELOG.md` contain **no `BREAKING`, `feat!`, or major-bump entries
at all** (grepped 2026-08-15). Everything is `Patch Changes` or `Minor Changes`. But minors have
carried API-surface changes; from `start-plugin-core`'s changelog:

> "Split Start plugin core bundler APIs into explicit Vite and Rsbuild subpaths so projects only
> need the bundler they use." ([#7249](https://github.com/TanStack/router/pull/7249))

> "Support both Vite 7 (`rollupOptions`) and Vite 8 (`rolldownOptions`) by detecting the Vite
> version at runtime" ([#6955](https://github.com/TanStack/router/pull/6955))

> "Clean minor bump, fresh start" ([#7395](https://github.com/TanStack/router/pull/7395))

So the honest statement is: **there is no breaking-change history to read, because breaking
changes are not labelled, and the project has never cut a major.** The RC announcement said RC
iterations would have "clearly documented breaking changes"; the changelog format in use
(changesets, patch/minor only) has no slot for that marking. What a consumer actually gets is a
minor bump every few days and no machine-readable signal about which ones move the API.

Compare: this is a materially different upgrade-risk profile from Next.js, which cuts majors,
publishes codemods, and documents removals per release. It is not necessarily *worse* — 58 minors
with no major is also a claim about not breaking people — but it is unverifiable from the changelog
alone.

### 1.6 Who maintains it

- Repository: **[TanStack/router](https://github.com/TanStack/router)**, MIT licensed, **14,941
  stars**, **546 open issues**, last push 2026-08-16. Start lives in this monorepo — there is no
  separate Start repository.
- Top contributors by commit count: `tannerlinsley` (3,262), `schiller-manuel` (780),
  `SeanCassiere` (320), `birkskyum` (280), `Sheraff` (232), `chorobin` (91), `lachlancollins` (59).
- Funding is `github: tannerlinsley` (`.github/FUNDING.yml`) — an individual sponsorship target,
  plus the TanStack partner/sponsor programme advertised on tanstack.com. There is no corporate
  owner in the sense that Vercel owns Next.js.
- For scale contrast, from the same GitHub API on the same day: `vercel/next.js` has **141,790
  stars** and **4,202 open issues**, also MIT.

The monorepo also ships Solid and Vue variants of Start (`@tanstack/solid-start`,
`@tanstack/vue-start`), plus router packages for both — i.e. maintenance attention is split across
three frameworks, not concentrated on React.

### 1.7 The RSC caveat

React Server Components are *not* part of the RC. The announcement says RSC "is in active
development and will land as a non-breaking v1.x addition". A `start-basic-rsc` and a `start-rscs`
example exist in the repo, and a `@tanstack/react-start-rsc` package is published at **`0.1.45`** —
a `0.x` version inside a `1.x` product. This is only relevant here as a negative: ticket
[#17](https://github.com/YgorPerez/send-lab/issues/17) already declined RSC, so a framework where
RSC is unfinished costs this app nothing.

---

## 2. better-auth integration

### 2.1 Yes — there is a first-class, documented TanStack Start integration

better-auth ships an official integration page,
<https://www.better-auth.com/docs/integrations/tanstack> (docs marked v1.6), and the package
exports a dedicated subpath. Reading `better-auth@1.6.29`'s published `exports` map from the npm
registry, the framework subpaths are:

```
./solid  ./svelte  ./next-js  ./svelte-kit  ./solid-start  ./tanstack-start  ./tanstack-start/solid
```

`./tanstack-start` sits alongside `./next-js` and `./svelte-kit` — the same tier as the two hosts
this repo has already used or researched. It is not a community package.

There is also a scaffolding path: `npm create @tanstack/start` offers **Better Auth** as an
add-on, which "sets up a project with an auth instance configured with the plugin and mounted
handlers" (same page).

### 2.2 Mounting the handler — a two-method server route, quoted verbatim

> ```ts
> // src/routes/api/auth/$.ts
> import { auth } from '@/lib/auth'
> import { createFileRoute } from '@tanstack/react-router'
>
> export const Route = createFileRoute('/api/auth/$')({
>     server: {
>         handlers: {
>             GET: async ({ request }:{ request: Request }) => {
>                 return await auth.handler(request)
>             },
>             POST: async ({ request }:{ request: Request }) => {
>                 return await auth.handler(request)
>             },
>         },
>     },
> })
> ```
> — <https://www.better-auth.com/docs/integrations/tanstack>

`auth.handler` takes a web-standard `Request` and returns a `Response`, exactly as it does on the
Next catch-all route handler that
[`better-auth-next`](https://github.com/YgorPerez/send-lab/issues/14) documented. The splat route
`$` is TanStack Router's wildcard, the analogue of `[...all]`.

### 2.3 The cookie plugin — `tanstackStartCookies`, and it has the same placement rule

> "When you call functions that need to set cookies (like `signInEmail` or `signUpEmail`), you'll
> need to handle cookie setting for TanStack Start. Better Auth provides a `tanstackStartCookies`
> plugin to automatically handle this for you."
>
> ```ts
> import { tanstackStartCookies } from "better-auth/tanstack-start";
>
> export const auth = betterAuth({
>     //...your config
>     plugins: [tanstackStartCookies()] // make sure this is the last plugin in the array
> })
> ```
> — same page

This is the structural counterpart of `nextCookies()`. **What it does not carry is the RSC
special-case.** `better-auth-next` §1 documented that `nextCookies()` contains a `before` hook
matching `ctx.path === '/get-session'` that calls `setShouldSkipSessionRefresh(true)`, because RSC
renders send `RSC: 1` and cannot write cookies — with the consequence that sliding session renewal
does not fire during RSC renders. There is no RSC render path in a TanStack Start app configured
per Part 6, so that failure mode has no place to occur. **The `tanstackStartCookies` source was
not read for this document** — whether it contains its own equivalent skip logic, and whether it
emits the `warnIfCookiePluginNotLast` warning, is **UNKNOWN** and would need a source read.

### 2.4 The server-side session primitive is unchanged, and it works in server routes

The session read is `auth.api.getSession({ headers })` — byte-for-byte the same primitive as on
Next, because it is a better-auth API, not a framework API. What changes is only how you obtain
the headers:

> ```ts
> // src/lib/auth.functions.ts
> import { createServerFn } from "@tanstack/react-start";
> import { getRequestHeaders } from "@tanstack/react-start/server";
> import { auth } from "@/lib/auth";
>
> export const getSession = createServerFn({ method: "GET" }).handler(async () => {
>     const headers = getRequestHeaders();
>     const session = await auth.api.getSession({ headers });
>     return session;
> });
>
> export const ensureSession = createServerFn({ method: "GET" }).handler(async () => {
>     const headers = getRequestHeaders();
>     const session = await auth.api.getSession({ headers });
>     if (!session) { throw new Error("Unauthorized"); }
>     return session;
> });
> ```
> — <https://www.better-auth.com/docs/integrations/tanstack>

`getRequestHeaders()` is **synchronous**. Next 16 made `headers()` and `cookies()` mandatorily
async (`nextjs-today` §3.6) — the exact change that broke Paraglide's synchronous locale
resolution. Part 7 picks that thread up.

Inside a plain server route the headers are on the `request` object already
(`handlers.POST: async ({ request }) => …`), so `auth.api.getSession({ headers: request.headers })`
needs no helper at all. **So yes: the server-side session primitive works in server routes.**

### 2.5 Route protection: `beforeLoad`, which runs on every navigation

> "To protect resources that require authentication, use `beforeLoad` with a server function. This
> ensures authentication is checked on every navigation, **including client-side navigation via
> `<Link>` components**."

The documented pattern for a whole protected area is a pathless layout route:

> ```tsx
> // src/routes/_protected.tsx
> export const Route = createFileRoute('/_protected')({
>   beforeLoad: async ({ location }) => {
>     const session = await getSession();
>     if (!session) {
>       throw redirect({ to: "/login", search: { redirect: location.href } });
>     }
>     return { user: session.user };
>   },
>   component: () => <Outlet />,
> })
> ```

Two things follow, both facts rather than advice:

1. This is a **single composable choke point**, which `better-auth-next` §1 established Next does
   not have ("App Router has no global server hook with a mutable per-request `locals`"; "the
   safety comes from repetition, not from a single choke point"). `_protected.tsx` is closer in
   shape to `hooks.server.ts` than anything the App Router offers.
2. It is still **advisory, not authorization** — `beforeLoad` runs on the client during
   client-side navigation, so it is a UX gate. The same doctrine `better-auth-next` §3 recorded
   for `proxy.ts` applies verbatim: the security check belongs next to the data. better-auth's own
   docs make the same split, prescribing `ensureSession` inside each server function.

### 2.6 `@better-auth/oauth-provider` — framework-independent, and it stays in scope

`@better-auth/oauth-provider@1.6.29`'s published `exports` map contains **no framework subpaths at
all** (checked against the npm registry, 2026-08-15). It is mounted as a plugin on the
`betterAuth()` instance:

```ts
import { oauthProvider } from "@better-auth/oauth-provider";
const auth = betterAuth({ plugins: [jwt(), oauthProvider({ loginPage: "/sign-in", consentPage: "/consent" })] });
```

— <https://www.better-auth.com/docs/plugins/oauth-provider>

Everything it serves comes out of `auth.handler`, which is already mounted on one server route.
So **the plugin is host-agnostic and the `better-auth-next` §7 analysis transfers untouched**,
including the caution that matters most:

> OAuth Authorization Server metadata is available at both `{issuer}/.well-known/oauth-authorization-server`
> and `/.well-known/oauth-authorization-server/[issuer-path]`. … "If you are using the resource
> server (for example, for MCP), add the OAuth Protected Resource metadata endpoint to the API that
> receives access tokens."

`better-auth-next` §7 already flagged the path-inserted RFC 9728 form
(`/.well-known/oauth-protected-resource/mcp`) as "the single most likely place for the migration to
break". On TanStack Start that endpoint is a file route whose name has to escape the leading dot —
the documented escape is square brackets: *"`[x]` Escaping — Square brackets escape special
characters in filenames that would otherwise have routing meaning. For example, `script[.]js.tsx`
becomes `/script.js`"*
(<https://github.com/TanStack/router/blob/main/docs/router/routing/file-naming-conventions.md>).
Applying that rule gives `routes/[.]well-known.oauth-protected-resource.mcp.ts`. **This exact
construction is not demonstrated anywhere in the TanStack docs or examples** — it is derived from
the stated rule, and is the kind of thing that wants a five-minute spike rather than a citation.

### 2.7 What Part 2 does not settle

- Whether `tanstackStartCookies()` warns when it is not last, and what it does on a request that
  cannot write cookies. **UNKNOWN — source not read.**
- Whether better-auth's `trustedOrigins` interacts with Start's own CSRF middleware (Part 3.4) in
  any surprising way. The two are independent layers on paper; not verified.

---

## 3. Plain HTTP server routes

### 3.1 The answer is yes, with fewer moving parts than the App Router

A TanStack Start server route is a `Request` in, a `Response` out, with nothing layered on top.
From <https://tanstack.com/start/latest/docs/framework/react/guide/server-routes> (read 2026-08-15;
source at `docs/start/framework/react/guide/server-routes.md`):

> ```ts
> // routes/hello.ts
> import { createFileRoute } from '@tanstack/react-router'
>
> export const Route = createFileRoute('/hello')({
>   server: {
>     handlers: {
>       GET: async ({ request }) => {
>         return new Response('Hello, World!')
>       },
>     },
>   },
> })
> ```

> "Each HTTP method handler receives an object with the following properties: `request`: The
> incoming request object … `params` … `context`. … Once you've processed the request, you can
> return a `Response` object or `Promise<Response>`."

Status and headers are the standard `Response` constructor arguments, documented explicitly:

> "You can set the status code of the response by passing it as a property of the second argument
> to the `Response` constructor … In this example, we're returning a `404` status code if the user
> is not found. **You can set any valid HTTP status code using this method.**"

> "Sometimes you may need to set headers in the response. You can do this by passing an object as
> the second argument to the `Response` constructor."

**There is nothing between the handler and the response.** Notably absent, by comparison with
`nextjs-today` §3.5: no `export const dynamic`, no `revalidate`, no `fetchCache`, no route-segment
config of any kind, and therefore none of the caching-default hazards that section catalogued.
`nextjs-today` §3.5's sharpest warning — that under Cache Components a `GET` handler which forgets
to read the session can be *baked into the build output* — has no analogue here, because there is
no build-time route cache to be baked into.

### 3.2 Mounting the MCP server

[`mcp-next`](https://github.com/YgorPerez/send-lab/issues/16) §3 established the decisive fact
about `@modelcontextprotocol/server` v2: **`handler.fetch` is a web-standard
`(Request) => Promise<Response>`**. The SDK v2 docs confirm `createMcpHandler` produces exactly
that, and list Node.js, Bun, Deno and web-standard runtimes as targets, with framework packages
(`@modelcontextprotocol/express`, `/hono`, `/fastify`, `/node`) as conveniences rather than
requirements (<https://ts.sdk.modelcontextprotocol.io/v2/>). `@modelcontextprotocol/server@2.0.0`
was published 2026-07-27; `@modelcontextprotocol/sdk@1.30.0` the same day.

So the Next form —

```ts
// app/api/mcp/route.ts
export const POST = handler.fetch
```

— becomes:

```ts
// src/routes/mcp.ts
export const Route = createFileRoute('/mcp')({
  server: { handlers: { POST: ({ request }) => handler.fetch(request) } },
})
```

Two consequences of the file-route convention, both from the server-routes doc:

- The endpoint can live at `/mcp` rather than under `/api/…`, because there is no structural rule
  forcing endpoints into a separate segment. `nextjs-today` §3.1's constraint — *"There **cannot**
  be a `route.js` file at the same route as `page.js`"* — is inverted here: *"Because server routes
  can be defined in the same directory as your app routes, **you can even use the same file for
  both!**"* The current SvelteKit path `/mcp` can be kept exactly.
- Only the methods you declare exist. Declaring `POST` alone means `GET` and `DELETE` are not
  handled — which is what the `2026-07-28` revision wants (`mcp-next` §1: "the single endpoint is
  **POST-only**"). Whether the unhandled-method response is the spec's preferred `405` was **not
  verified**; the docs do not say. **UNKNOWN.**

### 3.3 Reject-before-stream: the constraint holds, and the primitive is the standard one

`mcp-next` and `nextjs-today` §3.3 both turn on the same HTTP-level rule — you cannot change status
or headers once a response body has started, so an auth rejection must be emitted *before* any
stream is returned. On a Start server route this is trivially satisfiable in the handler body:
check the bearer token, `return new Response(…, { status: 401, headers: { 'WWW-Authenticate': … } })`,
and only otherwise construct a streaming `Response`. Nothing in the framework forces the response
to begin early.

The caveat is where you put the check. **If the auth check lives in *global request middleware*,
issue [#5407](https://github.com/TanStack/router/issues/5407) is live**: `setResponseHeaders` and
`setResponseStatus` do not take effect there. It is one of the three open
`needed-for-start-stable` issues, open since 2025-10-08. The in-thread workaround is to read the
headers object first and mutate it:

```ts
const headers = getResponseHeaders()   // not: new Headers()
headers.set("X-Hello", "World")
setResponseHeaders(headers)
setResponseStatus(404)
```

Returning a `Response` directly from the route handler sidesteps the bug entirely. The bug is a
reason not to build the MCP auth gate as global middleware; it is not a reason the gate cannot be
built.

### 3.4 CSRF: server functions are guarded by default, server routes are not

This matters because this repo has already been bitten once by a framework's CSRF guard — commit
`1ff5bc7`, "Fix OAuth token exchange blocked by SvelteKit's CSRF guard". TanStack Start's rule is
the opposite of SvelteKit's, and it is documented:

> "Server functions are same-origin RPC endpoints and should be protected from cross-site requests.
> **If your app does not define `src/start.ts`, TanStack Start installs its CSRF middleware
> automatically for server functions.**"
> — <https://tanstack.com/start/latest/docs/framework/react/guide/middleware>

> "It verifies same-origin browser request metadata with `Sec-Fetch-Site`, `Origin`, or `Referer`
> headers and rejects requests that cannot be proven same-origin."

Server routes get nothing by default; CSRF is opt-in per route:

> ```tsx
> export const Route = createFileRoute('/api/foo')({
>   server: {
>     middleware: [createCsrfMiddleware()],
>     handlers: { GET: () => {...} }
>   }
> })
> ```

So a cross-origin `POST /mcp` from an MCP client, and a cross-origin OAuth token exchange, are
**not** blocked out of the box — the SvelteKit trap does not reproduce. There is a symmetrical
trap, though, and it is worth naming: if you *do* create `src/start.ts` (which Part 6 requires, for
`defaultSsr: false`) and add `createCsrfMiddleware()` globally **without** the documented filter,
the docs say it "validates every request handled by the middleware" — which would break MCP and
OAuth. The documented shape that avoids it is
`createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })`.

Separately, `mcp-next` §1 recorded that the spec *requires* `Origin` validation with a `403`, and
that the current SvelteKit server does not do it. Nothing in Start does it for you either — the
SDK "validates neither `Host` nor `Origin`" (`mcp-next` §6). That work is the same on both hosts.

### 3.5 The `/api/state` sync endpoint

Nothing above is MCP-specific; the same shape hosts `/api/state`. One dev-time wrinkle is worth
recording because it is open and unresolved:
[TanStack/router#7403](https://github.com/TanStack/router/issues/7403) (opened 2026-05-15,
`needs-upstream-fix`) — a server route returns `404` in the Vite dev server when the request
carries `Sec-Fetch-Dest: image`, or when a search param value ends in a file extension. A
maintainer's first response: *"i suspect this is a nitro issue"*, confirmed by the reporter
(*"Indeed it works without nitro plugin"*), and Nitro's author replied *"I have to investigate it
properly since it is 3rd time we are regressing on patches in this area."* A later commenter traced
it precisely: Nitro's dev middleware only scans `<srcDir>/api/` and `<srcDir>/routes/` to build
`nitro.routing.routes`, but *"TanStack API routes live at `src/routes/api/**` and register via
`viteDevServer.middlewares.use(...)`"*, so every API request falls through to a `Sec-Fetch-Dest`
classifier. It is reported as **dev-server only**. It does not touch JSON `fetch` calls, which is
what `/api/state` and `/mcp` are.

---

## 4. Deployment on Vercel

### 4.1 Supported, on the Node runtime, via Nitro — but Vercel is not a TanStack hosting partner

Both sides document it, and both route through Nitro.

TanStack's hosting guide names its **Official Hosting Partners** as *"[Cloudflare], [Netlify], or
[Railway]"*. Vercel is not among them. Its entire entry in that guide is two sentences:

> ### Vercel
> Follow the [`Nitro`](#nitro) deployment instructions.
> Deploy your application to Vercel using their one-click deployment process, and you're ready to go!
> — <https://tanstack.com/start/latest/docs/framework/react/guide/hosting>

Cloudflare and Netlify get bespoke plugins and step-by-step setup on that same page. Vercel gets a
pointer to the generic adapter.

Vercel's own documentation is more substantial. `https://vercel.com/docs/frameworks/full-stack/tanstack-start`
(`last_updated: 2026-07-10`):

> "TanStack Start is a fullstack framework powered by TanStack Router for React and Solid. … **TanStack
> Start works great on Vercel when paired with [Nitro](https://v3.nitro.build/).**"

> "TanStack Start apps on Vercel benefit from the advantages of Vercel Functions and use **Fluid
> Compute by default**."

And the deployment guide, `https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel`
(published 2026-06-04, `last_updated: 2026-07-16`):

> "Because Vercel ships **zero-configuration detection for both TanStack Start and Nitro**, you
> don't need to set a build command or output directory."

> "Confirm the framework preset reads **TanStack Start**, then select **Deploy**."

There is a named framework preset, settable three ways: the dashboard, `{"framework": "tanstack-start"}`
in `vercel.json`, or `vercel project update <project-name> --framework tanstack-start` (CLI
v54.21.1+).

The only configuration is one plugin in `vite.config.ts`:

```ts
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';
export default defineConfig({ plugins: [tanstackStart(), nitro(), viteReact()] });
```

### 4.2 What replaces `@sveltejs/adapter-vercel`'s `runtime: 'nodejs20.x'`

There is no per-app runtime option in the Start plugin. The Node.js major is a **Vercel project
setting**, overridable from `package.json`:

> "By default, a new project uses the latest Node.js LTS version available on Vercel. Current
> available versions are: **24.x** (default), **22.x**, **20.x**." … "You can define the major
> Node.js version in the `engines#node` section of the `package.json` to override the one you have
> selected in the Project Settings."
> — <https://vercel.com/docs/functions/runtimes/node-js/node-js-versions> (`last_updated: 2026-02-27`)

So `runtime: 'nodejs20.x'` becomes `"engines": { "node": "20.x" }` or a dashboard selection. **20.x
is still available.** Recall §1.3: the open `setCookie` bug #5464 reproduces on Node 20.19.2 and
does not on Node 22. Those two facts are in tension and the tension is a fact, not a
recommendation.

Vercel platform limits are unchanged by the framework choice, so `nextjs-today` §6.2/§6.3 carry
over verbatim: 300 s default `maxDuration` on every plan, the **4.5 MB request-or-response body
cap**, 250 MB / 5 GB bundle limits, Fluid compute's 1,024 shared file descriptors, and the
45-minute build cap. `mcp-next` §2 already flagged the 4.5 MB cap as the one that could bite a
whole-document `get_state` return.

### 4.3 The maturity problem in this path is Nitro, not Start

`npm view nitro dist-tags` returns exactly one tag:

```
{ "latest": "3.0.260610-beta" }
```

published **2026-06-10**. There is no non-beta `latest`. The registry's version history shows
`3.0.0` (2025-10-10), then alphas, then a run of date-stamped betas: `3.0.260311-beta`,
`3.0.260415-beta`, `3.0.260429-beta`, `3.0.260522-beta`, `3.0.260603-beta`, `3.0.260610-beta`.
**`npm install nitro`, exactly as both TanStack's and Vercel's guides instruct, installs a beta
build that is two months old.** (Nitro v2 lives under a different package name, `nitropack`, whose
`latest` is `2.13.4`, published 2026-04-29; TanStack also ships `@tanstack/nitro-v2-vite-plugin`
at `1.155.0`, last published 2026-05-15.)

TanStack's own hosting guide is candid about it:

> "**⚠️ The [`nitro/vite`](https://nitro.build/) plugin natively integrates with Vite Environments
> API as the underlying build tool for TanStack Start. It is still under active development and
> receives regular updates. Please report any issues you encounter with reproduction so they can be
> investigated.**"
> — <https://tanstack.com/start/latest/docs/framework/react/guide/hosting>

Nitro is also implicated in two of the open issues above — the dev-server `Sec-Fetch-Dest` 404
(#7403, "i suspect this is a nitro issue", confirmed) and, in Part 5, the service-worker
double-generation bug. So **the Vercel deployment path specifically inherits a beta dependency that
the Cloudflare and Netlify paths do not** (those use `@cloudflare/vite-plugin` and
`@netlify/vite-plugin-tanstack-start` respectively).

For Nitro-specific Vercel features — ISR, per-route function rules — the surface is
`vercel.functions`, `vercel.functionRules`, `vercel.config` and `vercel.queues` in the Nitro Vercel
preset (<https://nitro.build/deploy/providers/vercel>, preset name `vercel`, "Integration with this
provider is possible with zero configuration"). None of those are needed by this app as scoped.

### 4.4 Env vars

Vercel's TanStack guide states the Vite rule directly:

> "Since TanStack Start apps are built with Vite, the `VITE_` prefix determines where a variable is
> available: Variables prefixed with `VITE_` are bundled into your client-side code and readable in
> the browser through `import.meta.env`."

TanStack's own guide adds a hazard worth carrying over regardless of host:

> "**Read env per-request, not at module scope.** … module-level `process.env.X` reads run before
> the env exists and evaluate to `undefined` even on the server. … Reading at module scope also
> risks inlining secrets into the client bundle."
> — <https://tanstack.com/start/latest/docs/framework/react/guide/environment-variables>

`nextjs-today` §6.4's two "honest losses versus SvelteKit" survive the switch unchanged: there is
no `$env/dynamic/public` equivalent, and no build-time validation of required variables — a zod
`env.ts` is still yours to write.

---

## 5. Offline and PWA

The athlete has made this decisive, so this part is the longest and is organised as six questions.
Read §5.1 first: it contains the one finding in this document that is unambiguously bad news for
TanStack Start.

### 5.0 The baseline this replaces, so the comparison is fair

Today's app is already a working PWA, and the mechanism matters because it is the thing being given
up. SvelteKit exposes a **first-party `$service-worker` virtual module** that hands the
service-worker author the build's asset list directly:

```ts
// src/service-worker.ts (61 lines, today)
import { build, files, version } from '$service-worker';
const CACHE = `sendlab-${version}`;
const ASSETS = [...build, ...files];
```

The current worker precaches `ASSETS` plus `cache.add('/')` — with the comment *"Precache the SPA
shell so **any** route works offline after first load (ssr=false, so the document is
route-agnostic)"* — excludes `/api`, and is cache-first for immutable build assets, network-first
for everything else. It calls `skipWaiting()` in `install` and `clients.claim()` in `activate`,
both unconditionally. `static/manifest.webmanifest` declares `display: standalone`,
`orientation: portrait`, and 192/512/maskable/SVG icons.

Two things follow. **First, the bar is not "can it do a PWA at all" — the bar is a first-party
build-asset manifest and a 61-line worker.** Second, the unconditional `skipWaiting()` +
`clients.claim()` is the exact pattern §5.4 shows the platform warns against, so it is a latent
defect being carried, not a standard to preserve.

Also worth recording precisely, because the amendment framed it as a live surface: `prefs.notify`
(`src/lib/state.svelte.ts:158`) drives **local notifications only**. `settings/+page.svelte` calls
`Notification.requestPermission()`, and `timerStore.svelte.ts:99` fires
`registration.showNotification()` from the rest timer. **There is no push subscription, no VAPID
key, and no server-side push anywhere in the tree.** Web Push (§5.5) is a *new build* on either
host, not a migration.

### 5.1 Service-worker generation — the sharpest finding in this document

**`vite-plugin-pwa` does not work with a TanStack Start production build, this is a known and open
bug, and it has been open for a year.**

[TanStack/router#4988](https://github.com/TanStack/router/issues/4988), *"vite-plugin-pwa
incompatible with tanstack start production builds"*, opened **2025-08-17**, still open on
2026-08-15, labelled **`needs-upstream-fix`**:

> "vite-plugin-pwa's build steps (generate assets, generate serviceworker bundle) are seemingly not
> executed when running `vite build` with `VitePWA()` and `tanstackStart()` both present. This is
> likely because to vite-plugin-pwa not having proper support for the Vite 6 environment API."

It works in `vite dev` and silently produces nothing in `vite build` — which is the worst possible
failure shape, because a green build ships a PWA with no service worker.

A TanStack maintainer's most recent comment, **2026-07-15**:

> "`vite-plugin-pwa`'s Vite Environment API support is still open in
> [vite-pwa/vite-plugin-pwa#786](https://github.com/vite-pwa/vite-plugin-pwa/pull/786). Its current
> build plugin runs service-worker generation from a non-SSR `closeBundle` hook rather than
> selecting the Start client environment. … **Keeping this open as an upstream integration issue for
> now.**"

That upstream PR, *"feat!: add Vite 6 Environment API support"*, was opened **2024-11-15** and last
updated **2025-02-11** — **eighteen months stale, still open**.

The root cause is stated precisely in the upstream issue,
[vite-pwa/vite-plugin-pwa#902](https://github.com/vite-pwa/vite-plugin-pwa/issues/902) (opened
2025-11-04, open):

> "The plugin currently skips service worker generation when `viteConfig.build.ssr === true` … This
> works for most SSR frameworks (Next.js, Remix, SvelteKit) which set: Client build: `ssr: false`,
> Server build: `ssr: true`. But **TanStack Start/Vinxi sets: Client build: `ssr: true`, Server
> build: `ssr: true`.**"

The maintainer's first reply, same day: **"We need an integration."** On **2026-03-29** he set out
the plan:

> "We want to make vite pwa modular and pluggeable with vite env. api support, adding some new
> subpackage exports for integrations (the existing integrations will use the new modules; we want
> to add new integrations like **tan start**, solid start and react-router-v7)."

**Serwist, the obvious alternative, has the same bug.** `@serwist/vite@9.5.12` (published
2026-07-22) is a fork of `vite-plugin-pwa`, and
[serwist/serwist#300](https://github.com/serwist/serwist/issues/300), *"`sw.js` is not built in vite
with Tanstack Start production build"*, opened **2025-11-05**, is still open. A commenter in #4988
tried it and reported: *"I tried serwist… doesn't work, kinda make sense as it's a fork of VITE
pwa."*

**`vite-plugin-pwa` does not list TanStack Start as a supported framework.** Its Frameworks section
lists Vue, React, Svelte, SolidJS, Preact, îles, SvelteKit, VitePress, Astro, Nuxt 3, Qwik, Remix
and Laravel (<https://vite-pwa-org.netlify.app/frameworks/>). The React entry is the generic
`virtual:pwa-register/react` hook, not a Start integration. There is an open request to add one:
[vite-pwa/vite-plugin-pwa#917](https://github.com/vite-pwa/vite-plugin-pwa/issues/917), *"Add
TanStack Router and Start examples"*, opened 2026-03-11, no comments.

**TanStack Start's own documentation never mentions PWAs.** All **34** pages of
`docs/start/framework/react/guide/` — 12,619 lines — were concatenated and grepped for `service
worker`, `serviceworker`, `pwa`, `webmanifest`, `progressive web` and `offline`. **Zero matches**
(checked 2026-08-15). There is no offline guide, no service-worker guide, no manifest guide. There
*is* a documented `public/` directory (Vite's default) and a documented client entry point
(`src/client.tsx`, which is where the SW registration has to go), but nothing about workers.

#### 5.1.1 The second bug, which is worse than the first because it ships silently

Even once generation is made to run, the Nitro path — i.e. **the Vercel path** — has a distinct,
open defect. [vite-pwa/vite-plugin-pwa#940](https://github.com/vite-pwa/vite-plugin-pwa/issues/940),
opened **2026-07-28**:

> "When the Vite builder runs with `builder.sharedConfigBuild: true`, the service worker is
> generated **once per build environment**, and every generation writes to the same `outDir`."

> "`sharedConfigBuild: true` is not exotic — **Nitro sets it** (`nitro/dist/vite.mjs`,
> `builder: { sharedConfigBuild: true }`), so every Nitro-based setup hits this, **including
> TanStack Start apps** that build `client` + `ssr` + `nitro` into a shared public directory. That
> is three generations of the same file per build."

And the consequence, in the reporter's words:

> "**In our app this shipped a broken PWA to production for six days.** The passes do not produce
> identical bytes — a later pass globs assets that the earlier ones could not see, so the file
> grows. Nitro records each public asset's size and etag into the server bundle when it generates
> its public directory, which happens *between* two of these passes, and then serves the file at
> the recorded length."

A truncated `sw.js` served at a stale content length is a failure that a build log will not show
and a smoke test may not catch.

#### 5.1.2 What actually works today, and what it costs

Two workarounds are documented in-thread by users, not by either project.

**(a) The `closeBundleOrder: 'pre'` configuration**, posted **2026-05-09** against TanStack Start
`^1.167` and `vite-plugin-pwa@^1.3.0`, in SPA mode:

```ts
VitePWA({
  integration: { closeBundleOrder: 'pre' }, // must run before Nitro collects public assets
  outDir: '.output/public',                 // Nitro serves from here, not dist/
  workbox: {
    navigateFallback: '/_shell.html',
    navigateFallbackDenylist: [/^\/api\//, /^\/_serverFn\//],
    globPatterns: ['**/*.{js,css}'],
    additionalManifestEntries: [
      { url: '/_shell.html', revision: new Date().toISOString() },
    ],
  },
})
```

with registration from the client entry point:

```tsx
// src/client.tsx
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })
```

The author's own annotations are the interesting part: *"VitePWA runs in the client Vite
environment, but TanStack Start wraps Vite with multiple environments (client, SSR, Nitro). Without
this option, the PWA build steps never execute."* And: *"`_shell.html` is created by Nitro **after**
VitePWA has already run its glob, so `globPatterns: ['**/*.html']` won't pick it up — add it via
`additionalManifestEntries` instead. … Without this, Workbox throws a `non-precached-url` error at
runtime."* That is four separate order-of-operations facts that exist nowhere in either project's
documentation, and any of which changing would silently break the build.

**(b) Bypass the plugin entirely** — the workaround posted 2025-08-24 runs `workbox-build`'s
`injectManifest` from a hand-written Vite plugin scoped to the `ssr` environment:

```ts
{
  name: "workbox",
  applyToEnvironment: (e) => e.name === "ssr", // after client output, before nitro copies publicAssets[]
  buildStart: () => workboxGenerate(),
}
```

This is roughly 40 lines of build glue that you own, on top of the worker itself.

#### 5.1.3 The announced fix exists and is not released

The `vite-plugin-pwa` maintainer posted on **2026-07-28**:

> "With the new **unplugin-pwa** all vite env api issues should be fixed, I'm finishing some
> examples. The sw build wont be at any vite plugin in any integration: … **tanstack: will use nitro
> `vite:before:compile` hook when using nitro v3 vite plugin** via custom plugin with nitro setup
> hook ([nitrojs/nitro#4440](https://github.com/nitrojs/nitro/pull/4440)). Without nitro, will use
> similar vite plugin we have here."

> "I will try to release the workbox fork packages and unplugin-pwa releases this weekend or next
> week, integrations will require more time, I need to prepare the repos and release stuff."

Status as of 2026-08-15, three weeks later:

- **`unplugin-pwa` is not on npm.** `https://registry.npmjs.org/unplugin-pwa` returns
  `{"error":"Not found"}`.
- **`nitrojs/nitro#4440`** (`feat(vite): add vite:before:compile hook`), opened 2026-07-16, last
  updated 2026-07-21, is **open and unmerged**.

So the fix is designed, announced by the person who will write it, and shipped by nobody. The
schedule slipped from "this weekend" by at least three weeks, and the TanStack integration is
explicitly downstream of it (*"integrations will require more time"*).

#### 5.1.4 Summary of §5.1

| | Today (SvelteKit) | TanStack Start (RC) | Next.js 16 |
| --- | --- | --- | --- |
| First-party SW support | **`$service-worker` module** (`build`, `files`, `version`) | **none — zero mentions in the docs** | see §5.1.5 |
| `vite-plugin-pwa` / equivalent | n/a | **broken in production builds; open bug since 2025-08-17** | n/a (not a Vite host) |
| Documented integration | first-party | **no** — an open request for examples | see §5.1.5 |
| What works today | shipping | a user-posted 4-fact config, or ~40 lines of own build glue | see §5.1.5 |
| Announced fix | — | `unplugin-pwa`, **unpublished**; blocked on an unmerged Nitro PR | see §5.1.5 |

#### 5.1.5 The Next.js 16 side — the premise in the ticket is out of date

The amendment asked whether anything beyond a hand-written `public/sw.js` exists on Next, *"given
Next has no first-party PWA plugin and Turbopack has no plugin API"*. Both halves of that premise
are still true, and the conclusion nonetheless changed **twelve days ago**.

**Turbopack still has no plugin API, and this is stated outright.** From
<https://nextjs.org/docs/app/api-reference/turbopack> (`version: 16.3.1`, `lastUpdated: 2026-08-11`):

> ### Webpack plugins
> **Turbopack does not support webpack plugins.** … If you depend on webpack plugins, you'll need to
> find Turbopack-compatible alternatives or continue using webpack until equivalent functionality is
> available.

The entire `turbopack` config surface is five keys — `root`, `rules`, `resolveAlias`,
`resolveExtensions`, `debugIds` — with no plugin concept. Loaders are the only extension point,
*"Only loaders that return JavaScript code are supported"*, and the loader context omits
`emitFile` — precisely what a precache-manifest emitter needs. Vercel's own roadmap post
([Turbopack updates: Moving homes](https://vercel.com/blog/turbopack-moving-homes), 2024-07-23)
does not discuss a plugin API at all, and
[vercel/next.js#86533](https://github.com/vercel/next.js/discussions/86533) asking for a timeline
(opened 2025-11-26) is **unanswered**.

**There is still no first-party PWA plugin.** `@next/pwa`, `@next/service-worker` and
`@next/workbox` all 404 on the npm registry. None of the ~70 documented `next.config.js` options
touches service workers or precaching.

**But Next 16.3.0 (2026-08-03) shipped first-party service-worker *compilation*, in Turbopack, and
did not announce it.** The file `crates/next-api/src/service_worker.rs` exists at tags `v16.3.0` and
`v16.3.1` and 404s at `v16.2.0`. Its doc comment:

> "Discovers every `navigator.serviceWorker.register(new URL(...), { scope })` registration
> reachable from `module_graph` … and compiles each registered worker into a single self-contained
> bundle. Each is emitted under `node_root/static/service-worker/<scope-derived name>` (e.g.
> `static/service-worker/sw.js`) and served at the matching `/_next/static/service-worker/` URL via
> the existing static pipeline (with a `Service-Worker-Allowed` header so it keeps its scope).
> **Only one service worker is supported per scope.**"

Landed via `#94921`, `#94923`, `#95554` (June–July 2026). Next.js writes the
`Service-Worker-Allowed` header itself, serves the worker `public, max-age=0, must-revalidate` with
an ETag and a `304` on conditional refetch, and the filename derives from **scope, not content**, so
the URL is stable across builds. The e2e suite asserts all of it and notes:

> ```ts
> // Compiling `navigator.serviceWorker.register(new URL(...))` is a Turbopack-only feature.
> ```

The [Next.js 16.3 blog post](https://nextjs.org/blog/next-16-3) does not mention service workers
anywhere. So: **on Next you can write `lib/sw.ts` in TypeScript, `import` from it, and the bundler
emits one self-contained worker at a stable URL with correct headers.** That is materially better
than a hand-copied `public/sw.js` — and it is the direct counterpart of the thing TanStack Start
does not have.

**Next's own PWA guide now points there, and admits it has no precache story.** From
<https://nextjs.org/docs/app/guides/progressive-web-apps> (`version: 16.3.1`,
`lastUpdated: 2026-07-30`): the worker goes in `lib/service-worker.js`, registered with
`new URL('../lib/service-worker.js', import.meta.url)` and `updateViaCache: 'none'`. The sample
worker is **push listeners only** — no `install`, no `fetch`, no cache. And:

> "**For full service-worker-based offline caching, one option is
> [Serwist](https://github.com/serwist/serwist)**, which provides Next.js integration examples for
> both Turbopack and webpack."

That sentence is Next.js's own admission that first-party precaching does not exist.

**Beware `useOffline`.** Next 16.3 ships an experimental `useOffline` hook, listed under "Network
resilience" in the blog post. It is **not** offline support. From
<https://nextjs.org/docs/app/guides/offline-support> (`lastUpdated: 2026-08-10`):

> "This feature only applies to soft navigations into prefetched routes and Server Action calls from
> the current page. **A full page reload while offline still fails because the browser needs the
> network to deliver the HTML; full offline loads would need a service worker.**"

**The webpack escape hatch is narrower than usually stated.** The upgrade guide says a `webpack`
config makes `next build` fail, and names three fixes (`--turbopack`, migrate, `--webpack`). The
source is more precise — `packages/next/src/lib/turbopack-warning.ts` exits only when the bundler
was *defaulted*, a `webpack` config exists, **and no `turbopack` config exists**:

```ts
if (process.env.TURBOPACK === 'auto' && hasWebpackConfig && !hasTurboConfig) { … process.exit(1) }
```

So there are four outs, the fourth being `turbopack: {}` — undocumented, and it silences a real
warning. `next build --webpack` and `next dev --webpack` are documented, stable CLI flags.

#### 5.1.6 Serwist, which is the live option on both sides

`serwist`, `@serwist/next`, `@serwist/vite` and `@serwist/turbopack` are all **9.5.12, published
2026-07-22**, from an active monorepo (1,467 stars, 11 open issues). So the SW *library* is
like-for-like across the two candidates; the difference is the *integration*.

- **`@serwist/vite`** is a real Vite plugin — and §5.1 established it inherits the same TanStack
  Start production-build bug ([serwist#300](https://github.com/serwist/serwist/issues/300), open
  since 2025-11-05).
- **`@serwist/next`** is webpack-only: it depends on `@serwist/webpack-plugin`, which
  peer-depends on `webpack`. Next.js's own linked example runs `"build": "next build --webpack"`.
  [serwist#54](https://github.com/serwist/serwist/issues/54), *"next dev --turbo support"*, has been
  **open since 2024-01-27** and never landed.
- **`@serwist/turbopack`** is the Turbopack path, and its source file opens by calling itself a
  workaround:

  > ```ts
  > // Workaround for Next.js + Turbopack, while plugins are still
  > // not supported. This relies on Next.js Route Handlers and file
  > // name determinism.
  > ```

  It compiles the worker with esbuild at prerender time behind an App Router route handler with
  `dynamic = "force-static"`.

**And it has an open production bug on exactly this deploy target.**
[serwist#360](https://github.com/serwist/serwist/issues/360), opened **2026-07-21**, still open:
`createSerwistRoute` crashes at runtime on **Vercel + Turbopack + Node runtime** with
`ERR_MODULE_NOT_FOUND`. The reporter's analysis:

> "**Even if the module were traced, a request-time rebuild can't produce a correct service
> worker.** … so a runtime invocation of the route would at best emit a service worker with an
> **empty precache manifest, silently breaking offline support for every client that picks it up.**
> … Because installed PWAs re-poll the SW URL, **every installed client hits this once the cache
> entry is gone.**"

Corroborated by a second reporter on 2026-08-04. The maintainer's reply (2026-07-22): *"I don't
really use Vercel these days… That behavior isn't intended under any circumstance."* Two further
open issues: [#363](https://github.com/serwist/serwist/issues/363) (`register()` throws in real
production traffic; fix PR #364 unmerged) and
[#366](https://github.com/serwist/serwist/issues/366) (`assetPrefix` causes 404s during precache
install). **Serwist 10 is stalled** — `dist-tags.preview` is `10.0.0-preview.14`, published
2025-09-03, nearly a year without a bump while 9.5.x ships monthly.

Nobody has adapted Serwist to Next 16.3's native SW compilation yet — 9.5.12 predates 16.3.0 by
twelve days.

**The other Next PWA plugins are dead.** `next-pwa@5.6.0` was published **2022-08-23**; its repo's
last substantive commit is 2022-08-23 with 138 open issues; it pins Workbox 6; it is not marked
deprecated on npm, so nothing warns you. `@ducanh2912/next-pwa@10.2.9` (2024-09-18) declares
`peerDependencies: { "webpack": ">=5.9.0" }` and its own README says: *"consider migrating to
`@serwist/next`."*

#### 5.1.7 Side-by-side, restated

| | SvelteKit (today) | TanStack Start (RC) | Next.js 16.3.1 |
| --- | --- | --- | --- |
| First-party SW **compilation** | n/a (plain file) | **no** | **yes, since 16.3.0 (2026-08-03), Turbopack-only** |
| First-party **asset manifest** for the SW author | **yes — `$service-worker`** | **no** | **no** (see §5.2) |
| Bundler plugin ecosystem for PWA | n/a | Vite plugins exist — **but broken with Start in production builds** | **none — Turbopack has no plugin API** |
| Maintained library integration | n/a | `@serwist/vite` (blocked by serwist#300) / `vite-plugin-pwa` (blocked by #4988) | `@serwist/next` (webpack only) / `@serwist/turbopack` (self-described workaround, open Vercel bug #360) |
| Framework docs mention PWA | first-party guide | **zero mentions across 34 guide pages** | **a dedicated guide**, which points at Serwist for caching |
| Net | working | needs user-posted config or own build glue | needs `--webpack`, or a workaround package with an open bug on this exact target |

### 5.2 Precaching a client-rendered app shell

**TanStack Start emits exactly the artefact you want, and it is the one clear PWA advantage on this
side.** SPA mode's build step is documented as producing a single static shell:

> "After enabling the SPA mode, running a Start build will have an additional prerendering step
> afterwards to generate the shell. This is done by: **Prerendering** your application's **root
> route only**; Where your application would normally render your matched routes, your router's
> configured **pending fallback component is rendered instead**; **The resulting HTML is stored to a
> static HTML page called `/_shell.html`** (configurable); Default rewrites are configured to
> redirect all 404 requests to the SPA mode shell."
> — <https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode>

Three properties of that artefact matter for a PWA:

1. **It is user-independent by construction** — the root route only, with the pending fallback in
   place of any matched route. Nothing per-athlete can leak into it.
2. **It has a stable, configurable path** (`outputPath`, default `/_shell.html`), so it can be named
   in `additionalManifestEntries` and given a build-stamped `revision`.
3. **It is the same component that renders the splash**, which is what the architecture wanted:
   `shellComponent` SSRs the `<html>` wrapper, `pendingComponent` fills the body.

The routing rules the docs prescribe map directly onto Workbox's `navigateFallback` /
`navigateFallbackDenylist`:

> "1. Ensure that static assets will always be served if they exist … 2. (Optional) Allow-list
> specific subpaths to be routed through to any dynamic server handlers, e.g. `/api/**` … 3. Ensure
> that all 404 requests are rewritten to the SPA shell, e.g. a catch-all redirect to
> `/_shell.html`."

The documented server-function base path is `/_serverFn` — which is why the working config above
denylists both `/^\/api\//` and `/^\/_serverFn\//`.

One caveat the docs raise themselves, and it is a PWA-visible one:

> "keep in mind that after hydrating the shell, the router will immediately navigate to the first
> route and `isShell()` will return `false`. **This could produce flashes of unstyled content if not
> handled properly.**"

And one ordering trap, from §5.1.2: **Nitro writes `_shell.html` after `vite-plugin-pwa` globs**, so
a `**/*.html` glob pattern silently misses it and Workbox throws `non-precached-url` at runtime.
The shell has to be registered by hand.

#### 5.2.1 Next.js emits per-route HTML, deliberately, and has no stable asset manifest

**Next 16 does not emit a single stable HTML document, and the docs argue against wanting one.**
From <https://nextjs.org/docs/app/guides/single-page-applications> (`lastUpdated: 2026-08-14`),
which defines a "strict SPA" as *"served by one HTML file"* and then:

> "Next.js can automatically code split your JavaScript bundles, and **generate multiple HTML entry
> points into different routes.**"

and from <https://nextjs.org/docs/app/guides/static-exports> (`lastUpdated: 2026-08-09`):

> "**Instead of shipping a single `index.html`, Next.js will generate an HTML file per route.**"

"App Shell" is a Next term, and it does not mean what a PWA means by it. From the
[glossary](https://nextjs.org/docs/app/glossary) (`lastUpdated: 2026-08-10`):

> "**App Shell** — **A per-route prerender** containing the parts of a page that don't depend on URL
> data. … Used as the **default prefetch payload during client navigations**."

So Cache Components / PPR gives a per-route static shell with dynamic holes streamed in — a
server-side streaming optimisation delivered as an RSC payload, not a cacheable HTML file. **An
`ssr: false` tree does not collapse that**: the seam is a `next/dynamic` option that only works
*inside* a Client Component (*"`ssr: false` option is **not supported in Server Components**"*,
<https://nextjs.org/docs/app/guides/lazy-loading>), so the Server Component shell above it is still
prerendered per route. `/a` and `/b` each get their own document even though the app tree behind the
seam is identical. `output: 'export'` would collapse it, but its unsupported list includes Server
Actions, cookies, headers, rewrites, redirects, proxy, ISR and `Request`-dependent Route Handlers —
a rewrite, not a flag.

**The precache-manifest question has a clear negative answer.** `.next/app-build-manifest.json` was
removed in 16.0 — `APP_BUILD_MANIFEST` is present at tag `v15.5.23` and **absent at every 16.x
tag**, with zero code-search hits repo-wide; the removal appears in neither the Next 16 blog's
removals table nor the upgrade guide. `.next/build-manifest.json` still exists but is **incomplete
for the App Router**: on a real `16.3.1` build of a minimal App Router app, `.next/static/chunks/`
held 7 chunks and the manifest referenced 5 — the two missing ones were client-component page
chunks, which appear only in server-side
`.next/server/app/**/page_client-reference-manifest.js`. Neither file is documented anywhere
(`llms.txt`, sitemap and a docs-path code search all return zero matches), and neither is
browser-reachable — *"**Do not upload the rest of your `.next/` folder**"*
(<https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix>). The one
browser-reachable manifest, `/_next/static/<buildId>/_buildManifest.js`, is Pages-Router-only and
contains no asset paths.

The corroborating evidence is what Serwist does instead — it **walks the filesystem**:

```ts
export const generateGlobPatterns = (distDir: string) => [
  `${distDir}static/**/*.{js,css,html,ico,...}`,
  "public/**/*",
];
```

A mature library resorting to a directory walk is the strongest available signal that no manifest
API exists. The sanctioned stable enumeration is build-time only, via the **Build Adapters API**
(`adapterPath`, stable since 16.2.0): `onBuildComplete({ outputs })` yields `outputs.staticFiles`
with `filePath`, `pathname` and `immutableHash`
(<https://nextjs.org/docs/app/api-reference/adapters/output-types>, `lastUpdated: 2026-07-24`) — and
an empirical probe confirmed it contains all 7 chunks, including the two `build-manifest.json`
omits, because internally it is a `recursiveReadDir` of `.next/static`.

Cache-first over `/_next/static/*` is safe either way: Next sets
`public, max-age=31536000, immutable` and the self-hosting docs state *"It cannot be overridden.
These immutable files contain a SHA-hash in the file name."*

#### 5.2.2 The comparison, stated as a fact and its consequence

| | TanStack Start | Next.js 16.3.1 |
| --- | --- | --- |
| Single user-independent HTML shell emitted at build | **yes — `/_shell.html`**, documented, path configurable | **no** — HTML per route, by design |
| Splash baked into that shell | **yes** — `pendingComponent` | hand-assembled Server Component tree, per route |
| Asset list available to the SW author | **no** — glob the client output dir | **no** — glob `.next/static`, or use the Build Adapters API |
| Known ordering trap | `_shell.html` is written by Nitro *after* the PWA glob runs | — |
| Navigation-fallback shape | `navigateFallback: '/_shell.html'` | pick one route's HTML, or a purpose-built `/~offline` document |

**The consequence, not a recommendation:** both hosts end up serving one document as a navigation
fallback. On TanStack Start that document is a first-class build artefact with a documented name.
On Next it is a document you nominate, and doing so means routing around the per-route HTML that is
Next's stated reason for generating multiple entry points. **Neither host gives the SW author an
asset manifest — which is the one capability the current SvelteKit app has and both candidates
lose.**

### 5.3 Installability and standalone display

This subsection is **framework-independent** — it is browser and OS policy, and neither candidate
changes any of it. It is included because it determines what "genuinely good PWA" can mean, and
because one of its findings changes the offline architecture.

#### 5.3.1 There is no spec-level installability

> "A manifest can have any of the following members at its root, **all of which are optional**."
> — [W3C Web Application Manifest, Working Draft 13 August 2026](https://www.w3.org/TR/appmanifest/)

Installability is per-engine policy, and the two engines have diverged into opposites.

**Chromium** requires `name` or `short_name`; `icons` containing a 192px **and** a 512px icon;
`start_url`; `display` and/or `display_override`; `prefer_related_applications` false or absent;
and HTTPS (or `localhost`)
([MDN, Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable),
last modified 2025-11-30). Today's `manifest.webmanifest` already satisfies all of it.

**Safari, since iOS 26, requires nothing at all:**

> "Simply put, **there are now zero requirements for 'installability' in Safari.** Users can add any
> site to their Home Screen and open it as a web app on iOS26 and iPadOS26." … "By default, every
> website added to the Home Screen opens as a web app."
> — [WebKit, WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/),
> published 2025-09-15

Safari 26.0 also added SVG icon support "everyplace there are icons in the interface" — which the
existing manifest's `icon.svg` entry anticipates.

#### 5.3.2 `display` — ship `standalone`, `display_override` is inert on iOS

Per MDN browser-compat-data (fetched 2026-08-15): Safari iOS supports the `display` member from
**11.3** but only the `browser` and `standalone` modes — `minimal-ui` and `fullscreen` are
unsupported, and **`display_override` is unsupported in its entirety** (Chrome 89, Safari ✗, Safari
iOS ✗). Because Chromium requires `display` *and/or* `display_override`, `display` is the portable
one. Apple's own WWDC23 guidance: *"If you want your site to be able to use Web Push and badging on
iOS, then you should use the standalone display mode."* Today's manifest already says
`"display": "standalone"`.

Manifest members Safari iOS reads, with first-supported version: `display` 11.3, `scope` 11.3,
`theme_color` 15, `icons` 15.4, `id` 16.4. Members it ignores: `display_override`, `orientation`,
`shortcuts`, `share_target`, `launch_handler`. **`orientation: portrait` in today's manifest is a
no-op on iOS.**

One precedence rule that is easy to get wrong, quoted from MDN's compat data note on `icons`:

> "Only used when no `apple-touch-icon` is present and either `"purpose"` is set to `"any"` or
> `"purpose"` is not specified."

So on iOS a `<link rel="apple-touch-icon">` beats the manifest, and `purpose: "maskable"` icons are
ignored. Today's `static/icon-180.png` exists; whether it is linked as `apple-touch-icon` in the
head is a detail that carries to either host, since on TanStack Start the head is authored in
`shellComponent` / route `head` rather than an `index.html`.

#### 5.3.3 iOS install is Share-sheet only, and always will be as far as any source says

`BeforeInstallPromptEvent` is **`false` for Safari, Safari iOS, WebView iOS and Firefox** in MDN's
compat data, and is annotated *"remains experimental and is not on the standards track"*. MDN is
blunt: *"This is not supported on iOS."* Since iOS 16.4, third-party browsers (Chrome, Edge,
Firefox, Orion) can also offer "Add to Home Screen" from the Share sheet
([WebKit, Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/), 2023-03-27);
before 16.4 it was Safari only.

**Consequence: an iOS-specific onboarding card teaching the Share-sheet gesture is a required build
item, on either host.** There is no API to prompt and no API to detect installability.

#### 5.3.4 The storage finding that changes the offline architecture

This is the load-bearing platform fact for "offline including writes".

WebKit's ITP applies a **7-day cap on all script-writable storage** — IndexedDB, LocalStorage,
SessionStorage, media keys, **and service worker registrations and cache**:

> "Now ITP has aligned the remaining script-writable storage forms with the existing client-side
> cookie restriction, **deleting all of a website's script-writable storage after seven days of
> Safari use without user interaction on the site.**"
> — [WebKit, Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/),
> John Wilander, 2020-03-24

**Home Screen web apps are exempt**, from the same post:

> "**Web applications added to the home screen are not part of Safari and thus have their own
> counter of days of use.** Their days of use will match actual use of the web application which
> resets the timer. We do not expect the first-party in such a web application to have its website
> data deleted. … If your web application does experience website data deletion, please let us know
> since we would consider it a serious bug."

WebKit's living tracking-prevention policy states the exemption directly: *"the first-party domain
of home screen web applications is exempt from ITP's 7-day cap on all script-writable storage"*
(<https://webkit.org/tracking-prevention/>). MDN confirms the policy is still live, last modified
**2026-01-05**.

Quota, from [WebKit, Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
(Sihui Liu, 2023-08-10, applying from Safari 17 / iOS 17):

> "For a browser app, the origin quota is up to 60% of the total disk space." … "When a web app is
> running standalone (as Home Screen Web App on iOS or Web App added to dock on macOS), it has the
> same origin quota and overall quota as when it is opened in a browser app."

And persistence:

> "WebKit currently grants a request based on heuristics like **whether the website is opened as a
> Home Screen Web App**."

**So, stated plainly and for the record: on iOS, in a Safari tab, offline writes are not durable —
seven days without a tap and IndexedDB, the Cache API *and the service worker registration itself*
are deleted. As a Home Screen web app, none of that applies, the quota is ~60% of disk per origin,
and `navigator.storage.persist()` is likely to be granted.** Installation is therefore the
precondition for durable offline writes on iOS, not a nice-to-have. `persist()` never prompts on
Chromium or WebKit (MDN, 2026-01-05: both *"automatically approve or deny based on the user's
interaction history"*), so it is safe to call unconditionally at first run. Quota is a non-issue for
~28 KB of state; **eviction and durability are the only real risks.**

#### 5.3.5 What iOS refuses that Chromium allows

From MDN compat data, fetched 2026-08-15. Every row is `Safari iOS: false`:

| Capability | Chromium |
| --- | --- |
| `beforeinstallprompt` / programmatic install | Chrome 44 |
| Background Sync (`SyncManager`) | Chrome 49 |
| Periodic Background Sync | Chrome 80 |
| Background Fetch | Chrome 74 |
| `manifest.share_target` | Chrome 89 |
| `manifest.shortcuts` | Chrome 96 (macOS Safari 17.4 only) |
| `manifest.display_override` | Chrome 89 |
| `manifest.orientation` | Chrome 39 |
| `manifest.launch_handler` | Chrome 110 |
| `display: minimal-ui` / `fullscreen` | Chrome 39 |
| Notification `actions`, `image`, `renotify`, `vibrate` | Chrome 50–56 |
| **Service workers inside a WebView** | Chromium yes; `webview_ios: false` |

The last row is operationally relevant: if a link to the console is opened inside another app's
in-app browser on iOS, **there is no service worker at all**.

WebKit has published **no position** on Background Sync or Background Fetch — both sit at "Needs
position" in [WebKit/standards-positions#14](https://github.com/WebKit/standards-positions/issues/14)
(2022-06-29) and [#149](https://github.com/WebKit/standards-positions/issues/149) (2023-03-15),
labelled `concerns: power` / `concerns: privacy`. There is no roadmap signal that they are coming.

**Consequence for the largest new build in this effort
([#24](https://github.com/YgorPerez/send-lab/issues/24)): on iOS, sync must be foreground-only.**
IndexedDB as a write-ahead outbox; flush on launch, `visibilitychange → visible`, and `online`;
feature-detect Background Sync as a Chromium-only latency improvement, never as a correctness
requirement. This is framework-independent and true on both candidates.

**EU/DMA:** a non-issue today. Apple removed Home Screen web apps in the iOS 17.4 EU beta and then
reversed: *"We have received requests to continue to offer support for Home Screen web apps in iOS
and iPadOS, therefore we will continue to offer the existing Home Screen web apps capability in the
EU. This support means Home Screen web apps continue to be built directly on WebKit"*
(<https://developer.apple.com/support/dma-and-apps-in-the-eu/>).

### 5.4 Update strategy

#### 5.4.1 The standard, which both candidates inherit unchanged

The W3C Service Workers spec (Editor's Draft, **2026-08-12**) defines the states `parsed`,
`installing`, `installed`, `activating`, `activated`, `redundant`, and the rule that matters:

> "After it's successfully installed, the updated service worker delays activating until the
> existing service worker is no longer controlling clients."
> — [web.dev, The service worker lifecycle](https://web.dev/articles/service-worker-lifecycle)

`skipWaiting()` breaks that on purpose, and the breakage is documented:

> "your new service worker is likely controlling pages that were loaded with an older version. This
> means some of your page's fetches will have been handled by your old service worker, but your new
> service worker will be handling subsequent fetches."

That is the classic failure: a page loaded from build `A` lazy-loads a route chunk twenty minutes
later, while a worker precaching only build `B` has claimed the client — and the chunk 404s. **This
is precisely what today's `src/service-worker.ts` does**, calling `skipWaiting()` in `install` and
`clients.claim()` in `activate` unconditionally. With TanStack Router's `autoCodeSplitting` on
(§6.4), route chunks are exactly the class of asset that gets fetched late.

Staleness bound, from the spec: a registration is *stale* when `current time − last update check
time > 86400` seconds, and the update check happens on in-scope navigation or on an event when the
script has not been downloaded in 24 hours. Chrome 68+ ignores caching headers for the SW script
itself, but `updateViaCache` defaults to `"imports"` — so `importScripts()` dependencies still obey
HTTP caching. Serving `sw.js` with `Cache-Control: max-age=0, must-revalidate` is the belt-and-braces
answer, and is exactly what `vite-plugin-pwa`'s own Vercel deployment guide prescribes in
`vercel.json` (<https://vite-pwa-org.netlify.app/deployment/vercel.html>), alongside
`Content-Type: application/manifest+json` for `/manifest.webmanifest`.

#### 5.4.2 What `vite-plugin-pwa` gives you on top — assuming §5.1 is solved

Two `registerType` modes, both documented:

- **`prompt` (the default).** `registerSW({ onNeedRefresh(), onOfflineReady() })`; on accept, call
  `updateSW()` and *"the page will reload and the up-to-date content will be served"*
  (<https://vite-pwa-org.netlify.app/guide/prompt-for-update.html>).
- **`autoUpdate`.** *"the plugin will force `workbox.clientsClaim` and `workbox.skipWaiting` to
  `true`"*, and the docs' own warning: *"The disadvantage of using this behavior is that the user
  can lose data in any browser windows/tabs in which the application is open and is filling in a
  form. If your application has forms, we recommend you to change the behavior to use default
  `prompt` option."* Plus: *"**Before you put your application into production, you need to be sure
  of the behavior you want for the service worker. Changing the behavior of the service worker from
  `autoUpdate` to `prompt` can be a pain.**"*
  (<https://vite-pwa-org.netlify.app/guide/auto-update.html>)

For React there is a typed virtual module, `virtual:pwa-register/react`, exposing
`useRegisterSW()` → `{ needRefresh, offlineReady, updateServiceWorker }` — framework-level, not
Start-level, so it works wherever `vite-plugin-pwa` works
(<https://vite-pwa-org.netlify.app/frameworks/react.html>). Note `workbox-window` must be added as
a dev dependency.

A training console *is* a forms app — sets, reps, weights, timers — so the docs' own guidance points
at `prompt`, which is the opposite of what today's worker does.

#### 5.4.3 Stale clients against a changed API contract — the platform gives you nothing

The Service Workers spec has no notion of an application version, no contract negotiation, and no
way to invalidate a running client. The only signals are `registration.update()`, `updatefound` /
`statechange` / `registration.waiting`, `controllerchange`, and the 24-hour staleness ceiling.
Everything else is application-layer: version-stamp requests with a build id and answer stale
clients with a distinguishable status, or poll a small unversioned `/version.json` on
`visibilitychange`.

This bites harder here than in most apps because of §5.3.4: **an installed iOS Home Screen web app
opened for thirty seconds a day can sit on an old build indefinitely.** And because writes are
queued offline, a mutation serialised by build `A` may be flushed by build `B` days later — so the
outbox payload needs its own version field and a migrate-on-read step. None of that is
framework-dependent.

#### 5.4.4 The Next.js side, and the one genuinely uncovered design gap

**Next documents almost nothing about the service-worker update lifecycle.** The whole of its
first-party guidance is `updateViaCache: 'none'` in the registration example, plus a
`Cache-Control: no-cache, no-store, must-revalidate` header block that is now **path-stale** — it
targets `/sw.js`, while a worker registered via `new URL(...)` is served at
`/_next/static/service-worker/sw.js`, where Next already sets its own headers. There is no mention
of `skipWaiting`, `clients.claim()`, the waiting worker, or update prompts anywhere in the docs.
What Next *does* supply silently is a correct default, with the reasoning in the e2e test comment:
*"it must be served as a mutable asset (never immutable) that is revalidated on every use, so a new
worker ships immediately rather than being pinned by a long-lived cache entry."*

**Version skew is documented, and it is Pro/Enterprise with a 24-hour default.** From
<https://vercel.com/docs/skew-protection> (`last_updated: 2026-07-15`):

> "**Skew Protection is available for all deployment environments for Pro and Enterprise teams.**"

> "**The default maximum age is one day from deployment creation.**"

> "Deployments that have been deleted either manually or automatically using a retention policy
> **will not be accessible through Skew Protection.**"

And the sentence that decides its relevance here:

> "The framework attaches the deployment ID as a `?dpl=` query parameter or `x-deployment-id`
> header… **The framework doesn't automatically pin custom `fetch()` calls you make from client
> components.**"

An offline-first console flushes its write queue through its own `fetch()`, not through
framework-managed requests. **Those are not pinned.** Skew Protection does not solve the stale-write
problem; the write contract has to carry its own version. Document navigations are also unpinned by
default, with a `__vdpl` cookie escape whose documented use cases (*"Live assessments and exams"*,
*"Multi-step workflows"*) do describe a training session.

The self-hosted equivalent is `deploymentId`
(<https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId>, stable since
14.1.4), which appends `?dpl=`, adds `x-deployment-id` / `x-nextjs-deployment-id`, and *"triggers a
hard navigation (full page reload)"* on mismatch — with the self-hosting docs' warning that
*"there may be a loss of application state if it's not designed to persist between page
navigations… component state like `useState` would be lost."*

**The uncovered gap, stated as such.** A service worker that precaches an app shell *deliberately*
creates stale clients; Skew Protection's entire design is to force stale clients to hard-reload.
A hard reload against a precached shell is answered **from the service worker**, so the reload does
not refresh the client — the two mechanisms can deadlock unless the SW explicitly bypasses its
precache for document requests on a deployment-ID mismatch. **No primary source addresses this
interaction** — not Next.js's docs, not Vercel's Skew Protection docs, not Serwist's. One partial
mitigation exists on Next's side: the compiled worker is deliberately excluded from skew tokens
(*"Service workers are served at a fixed, stable URL … so they don't carry a `?dpl` token"*,
`packages/next/src/server/lib/router-utils/resolve-routes.js`).

TanStack Start has no equivalent skew mechanism at all — the question does not arise, which is
neither better nor worse, only different: the versioning burden sits entirely in application code
on that side, and partially in the platform on Next's.

### 5.5 Push notifications

Framework-independent, and a **new build on either host** — §5.0 established there is no push
subscription in the tree today.

**Web Push works on installed iOS PWAs, and only on installed iOS PWAs.** It shipped in
**iOS/iPadOS 16.4**:

> "iOS and iPadOS 16.4 add support for Web Push to web apps added to the Home Screen."
> — [WebKit, WebKit Features in Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/), 2023-03-27

announced in [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
(2023-02-16), which describes it as *"the same W3C standards-based Web Push"* built on *"Push API,
Notifications API, and Service Workers"*, with no Apple Developer Program membership required.

**Still Home-Screen-only in 2026.** MDN's compat data annotates every push surface — `PushManager`,
`PushSubscription`, `Notification`, `ServiceWorkerRegistration.showNotification` — as Safari iOS
16.4 with the note *"Notifications are supported in web apps saved to the home screen"*, and
`Notification` / `requestPermission` additionally as **`partial_implementation: true`** with
*"Interface undefined unless page is web app saved to home screen"*. **That is the practical trap:
in an iOS Safari tab, `window.Notification` is `undefined`, not merely denied — so feature-detect
with `'Notification' in window`, never with a permission check.** Today's
`timerStore.svelte.ts:101` already does `typeof Notification === 'undefined'`, which is the correct
shape and carries over.

Requirements for the server, from
<https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers>:
standard VAPID JWT plus public key in `Authorization`, matching the key passed to
`PushManager.subscribe`; `sub` must be a URL or `mailto:`; `aud` must be the push service origin;
`exp` at most 24 h out and *"Don't refresh your JWT more frequently than once per hour"*; payload
cap **4 KB**; required headers `TTL`, `Authorization`, `Content-Encoding`, `Topic`, `Urgency`;
allowlist `https://*.push.apple.com`; treat **410** as "delete the subscription". Apple cites RFC
8030 explicitly; RFC 8291/8292 semantics apply by behaviour. A standard `web-push` library works
unmodified.

**Silent push is forbidden and the penalty is losing the subscription:**

> "Safari doesn't support invisible push notifications. Present push notifications to the user
> immediately after your service worker receives them. **If you don't, Safari revokes the push
> notification permission for your site.**" — Apple, same page

> "The Web Push API is not an invitation for silent background runtime, as that would both violate
> a user's trust and impact a user's battery life."
> — [WebKit, Meet Web Push](https://webkit.org/blog/12945/meet-web-push/), 2022-06-07

**So push cannot be used as a background-sync substitute on iOS.** Combined with §5.3.5, there is no
mechanism at all to run code on iOS while the app is closed.

`Notification.requestPermission()` requires a user gesture. Notification `actions`, `image`,
`renotify` and `vibrate` are unsupported on iOS. **Badging (`navigator.setAppBadge`) works** — Safari
iOS 16.4, home-screen web apps only; Safari 17 on macOS; Chrome 81 on Windows/macOS, Chrome 91 on
ChromeOS, and **no badge at all on Linux Chromium**.

**Declarative Web Push (iOS 18.4+)** is a newer path worth knowing about: a standardised JSON
payload (`web_push: 8030`, `notification: { title, body, navigate, app_badge, … }`) that displays a
notification *"without requiring an installed service worker"*, and — importantly — removes the
silent-push penalty because a fallback always displays
([WebKit, Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/),
2025-03-27; shipped per [Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/),
2025-03-31). It is **still Home-Screen-only on iOS.**

### 5.6 Mobile-first as a build concern

Only where the framework is actually the cause; generic content-site performance advice is excluded
by the ticket's own scoping, and where a source's claim is scoped that way it is flagged.

**Route code-splitting.** TanStack Router's is opt-in with `autoCodeSplitting: true` and splits
`component`, `errorComponent` and `notFoundComponent` by default, leaving `pendingComponent` and
`loader` in the parent chunk (§6.4). The consequence for a PWA is favourable: **the splash that the
SPA shell renders is in the initial chunk**, so a cold offline start paints without a second
network-or-cache round trip.

**Baseline framework JS.** There is **no primary-source figure for either candidate**, and the one
vendor page that addresses it disclaims exactly this kind of number:

> "**A note on benchmarks:** If someone quotes performance numbers comparing Start and Next without
> methodology, app complexity, hosting details, and configuration specifics — those numbers are
> meaningless. Comparisons must assume best practices on both sides."
> — <https://tanstack.com/start/latest/docs/framework/react/start-vs-nextjs>

The same page then claims *"TanStack Start ships a minimal runtime… Much of Next's bundle weight is
architectural tax, not feature weight"* — a vendor claim, on a vendor comparison page, with no
figures. **Byte-level comparison: UNKNOWN.** It would need two builds of the same app.

**Next.js no longer publishes the number either — it removed the tooling.** From the
[upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16):

> "**Next.js 16** removes the `size` and `First Load JS` metrics from the `next build` output. We
> found these to be inaccurate in server-driven architectures using React Server Components. **Both
> our Turbopack and Webpack implementations had issues, and disagreed on how to account for Client
> Components payload.**"

So the baseline figure is **UNKNOWN and unknowable from primary sources on both sides**, and would
have to come from a spike. Next does ship a replacement analyser —
`npx next experimental-analyze`, added in 16.1, Turbopack-integrated, *"Does not produce build
artifacts"* — while the older `@next/bundle-analyzer` is webpack-only and, note, injects a
`webpack` key into the config, which is exactly what hard-fails a default `next build` (§5.1.5).

**Does an `ssr: false` tree still ship the RSC runtime on Next? Yes — necessarily.** The documented
first-load pipeline is HTML → *"**RSC Payload** is used to reconcile the Client and Server Component
trees"* → JavaScript hydration, and *"The **RSC Payload** is prefetched and cached for instant
navigation"* on subsequent navigations
(<https://nextjs.org/docs/app/getting-started/server-and-client-components>,
`lastUpdated: 2026-08-11`). `ssr: false` operates below that boundary — it suppresses prerendering
of one Client Component subtree; the root layout is still a Server Component rendered to an RSC
payload, so the client still needs the flight client to reconcile it. **No primary source states
this in those words** — it is an inference from the documented pipeline, and is flagged as such.

On the Start side the symmetric question has a cleaner answer: with `defaultSsr: false` there is no
RSC payload on the wire at all, because Start's RSC support is an unshipped `0.x` package (§1.7)
that would not be enabled.

One Next-specific splitting caveat that lands on exactly the `ssr: false` seam, from
<https://nextjs.org/docs/app/guides/lazy-loading> (`lastUpdated: 2026-03-10`): *"When a Server
Component dynamically imports a Client Component, automatic code splitting is currently **not**
supported."* The documented fix is to move the dynamic import inside a Client Component — which is
also where `ssr: false` is required to live.

**Source-scoping flag, as the ticket asked for.** Next's "Optimizing large bundles" guidance
(<https://nextjs.org/docs/app/guides/package-bundling>) is illustrated entirely with a **content-site**
example — a syntax highlighter on a blog post, fixed by moving work into a Server Component. That
advice does not transfer to a browser-only app tree, which is `'use client'` by construction and has
no Server Component to push work into. `optimizePackageImports` and `serverExternalPackages` from
the same page are likewise mostly inapplicable. Discount that section.

---

## 6. Client-only rendering

### 6.1 Two mechanisms, both first-class, and they compose

TanStack Start documents *two* separate ways to turn server rendering off, and both are ordinary
documented features rather than escape hatches.

**(a) Selective SSR — `ssr: false`, per route or as the default.**

> "TanStack Start's Selective SSR feature lets you configure: Which routes should execute
> `beforeLoad` or `loader` on the server. Which route components should be rendered on the server."
>
> "You can control how a route is handled during the initial server request using the `ssr`
> property. If this property is not set, it defaults to `true`. **You can change this default using
> the `defaultSsr` option in `createStart`**:"
>
> ```tsx
> // src/start.ts
> export const startInstance = createStart(() => ({
>   defaultSsr: false,
> }))
> ```
> — <https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr>

`ssr` takes `true`, `false`, `'data-only'`, or a function evaluated per request. Inheritance is
one-directional: *"the inherited value can only be changed to be more restrictive"* — a child
cannot re-enable SSR under an `ssr: false` parent. That is a useful property: one setting at the
root cannot be silently undone deeper in the tree.

**(b) SPA mode — a build-time prerendered shell.**

> "For applications that do not require SSR for either SEO, crawlers, or performance reasons, it
> may be desirable to ship static HTML to your users containing the 'shell' of your application …
> that contain the necessary `html`, `head`, and `body` tags to bootstrap your application only on
> the client."
>
> "**No SSR doesn't mean giving up server-side features!** SPA modes actually pair very nicely with
> server-side features like server functions and/or server routes."
> — <https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode>

Enabled with three lines:

```ts
tanstackStart({ spa: { enabled: true } })
```

### 6.2 The shape the architecture already chose is a first-party documented pattern

Ticket [#17](https://github.com/YgorPerez/send-lab/issues/17) settled on "a server root shell plus a
browser-only app tree behind one `ssr: false`". TanStack Start documents that exact arrangement,
under the heading *"How to disable SSR of the root route?"*:

> "You can disable server side rendering of the root route component, however the `<html>` shell
> still needs to be rendered on the server. This shell is configured via the `shellComponent`
> property and takes a single property `children`. **The `shellComponent` is always SSRed** and is
> wrapping around the root `component`, the root `errorComponent` or the root `notFound` component
> respectively."
>
> ```tsx
> export const Route = createRootRoute({
>   shellComponent: RootShell,
>   component: RootComponent,
>   ssr: false, // or `defaultSsr: false` on the router
> })
>
> function RootShell({ children }: { children: React.ReactNode }) {
>   return (
>     <html><head><HeadContent /></head><body>{children}<Scripts /></body></html>
>   )
> }
> ```
> — <https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr>

And the hand-authored splash has a named slot:

> "For the first route with `ssr: false` or `ssr: 'data-only'`, the server will render the route's
> `pendingComponent` as a fallback. If `pendingComponent` isn't configured, the
> `defaultPendingComponent` will be rendered. … On the client during hydration, this fallback will
> be displayed for at least `minPendingMs`."

In SPA mode the same component is what gets baked into the static shell: *"Where your application
would normally render your matched routes, your router's configured **pending fallback component is
rendered instead**."*

### 6.3 Against the Next answer

| | Next.js 16 | TanStack Start (RC) |
| --- | --- | --- |
| Mechanism | `dynamic(() => import('./x'), { ssr: false })` inside a Client Component | `ssr: false` route option, or `defaultSsr: false` |
| Granularity | per dynamic import | per route, with enforced one-way inheritance |
| Status | documented pattern on the SPA guide | documented framework feature with its own guide |
| Restriction | since v15, `ssr: false` is **disallowed inside Server Components** (`nextjs-today` §2.3) | none of that class — there are no Server Components in play |
| Static shell emitted at build | see Part 5 | **yes** — `/_shell.html` |
| Server shell + splash | hand-assembled | `shellComponent` + `pendingComponent`, both named API |

The functional destination is the same. The difference is that on Start it is one option with a
guide, and on Next it is a composition of three separate features plus a v15-era restriction to
route around. Neither is an escape hatch.

### 6.4 Route code-splitting

Not a differentiator in kind — both frameworks split per route — but the mechanism is worth
recording because Part 5 depends on what lands in the initial chunk. TanStack Router's automatic
code splitting is opt-in with one flag:

```ts
tanstackRouter({ autoCodeSplitting: true })
```

> "The available properties to split are: `component`, `errorComponent`, `pendingComponent`,
> `notFoundComponent`, `loader`." … Default split groupings:
> `[ ['component'], ['errorComponent'], ['notFoundComponent'] ]`
> — <https://tanstack.com/router/latest/docs/framework/react/guide/automatic-code-splitting>

`pendingComponent` and `loader` are **not** split by default — so the splash stays in the initial
chunk, which is what you want for a cold offline start.

**No primary-source number exists for TanStack Start's baseline client JS payload.** The vendor's
own comparison page claims *"TanStack Start ships a minimal runtime… Much of Next's bundle weight
is architectural tax, not feature weight"*
(<https://tanstack.com/start/latest/docs/framework/react/start-vs-nextjs>) — that is a vendor claim
on a vendor comparison page, with no methodology and no figures, and the same page opens by warning
against exactly that kind of number: *"If someone quotes performance numbers comparing Start and
Next without methodology, app complexity, hosting details, and configuration specifics — those
numbers are meaningless."* Taking the page at its own word, **the byte-level comparison is
UNKNOWN** and would require building both.

---

## 7. Routing and locale

### 7.1 Yes — the answer to "does locale enter the URL?" changes, in two independent ways

Ticket [#23](https://github.com/YgorPerez/send-lab/issues/23) and question 6 of
[#17](https://github.com/YgorPerez/send-lab/issues/17) are waiting on whether locale must be a URL
segment. On the App Router the answer was effectively forced: `app/[lang]/…`, with `next/root-params`
requiring a segment above the root layout, and the documented warning that reading a cookie in the
root layout to avoid the prefix "opts the entire app out of static prerendering" (`i18n-next`
Part 2). TanStack Router removes both halves of that pressure.

**(a) Optional path parameters make the prefix genuinely optional.** From the router's own i18n
guide (<https://github.com/TanStack/router/blob/main/docs/router/guide/internationalization-i18n.md>):

> "Optional path parameters are ideal for implementing locale-aware routing without duplicating
> routes.
>
> ```
> /{-$locale}/about
> ```
>
> This single route matches:
> - `/about` (default locale)
> - `/en/about`
> - `/fr/about`
> - `/es/about`"

One route file, `createFileRoute('/{-$locale}/about')`, and `Route.useParams()` returns
`locale: string | undefined`. The App Router has no equivalent — `[lang]` is required, and the
"unprefixed default locale" case is what drives you to middleware rewrites.

**(b) Router-level URL rewriting removes locale from the route tree entirely.** This is the option
that has no App Router counterpart at all:

> ```ts
> const router = createRouter({
>   routeTree,
>   rewrite: {
>     input: ({ url }) => deLocalizeUrl(url),
>     output: ({ url }) => localizeUrl(url),
>   },
> })
> ```
> — same guide, and the `start-i18n-paraglide` example README

`input` de-localizes the incoming URL before matching; `output` re-localizes on the way out. The
route tree never sees a locale segment, so **every route path stays locale-free and fully typed,
while the address bar shows `/de/ueber`.** On the App Router the equivalent is a `proxy.ts` rewrite
plus a `[lang]` segment — two mechanisms, one of which `nextjs-today` §4 documents as advisory and
non-composable.

### 7.2 Paraglide runs as a Vite plugin, and there is a first-party TanStack Start example

This is the concrete constraint the ticket was built on. `i18n-next` line 675 recorded Paraglide's
maintainer explaining why Next support is stuck — *"As long as Turbopack has no plugins and
Unplugin can't offer a plugin, Turbopack support is out of scope. The CLI in watch mode is the way
to go in the meantime (**or switching to TanStack Start :P**)"*.

The repository contains **`examples/react/start-i18n-paraglide`**, maintained in-tree at
<https://github.com/TanStack/router/tree/main/examples/react/start-i18n-paraglide>, and its
`vite.config.ts` runs `paraglideVitePlugin` — the exact plugin `vite.config.ts:18` runs today —
directly beside `tanstackStart()`:

```ts
import { paraglideVitePlugin } from '@inlang/paraglide-js'
export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      outputStructure: 'message-modules',
      cookieName: 'PARAGLIDE_LOCALE',
      strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
      urlPatterns: [ /* … */ ],
    }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
})
```

The example pins `@inlang/paraglide-js@^2.4.0`, `vite@^8.0.14`, `react@^19.1.1`,
`@tailwindcss/vite@^4.2.2` and `@tanstack/react-start@^1.168.46`. There is a matching
`examples/react/i18n-paraglide` for router-without-Start, and a Solid pair.

Three further things the example's README documents, all of them relevant here:

- **`<html lang>`** — `<html lang={getLocale()}>` in `__root.tsx`. `i18n-next`'s recommendation
  accepted `<html lang>` staying in the base locale as a cost of the client-only approach; that
  cost is not forced here.
- **Server-side locale resolution** — `paraglideMiddleware(req, () => handler.fetch(req))` wrapping
  the Start handler in `src/server.ts`. This is `AsyncLocalStorage`-shaped and is precisely what
  `i18n-next` recorded as not working on Next (*"AsyncLocalStorage, which works in any other meta
  framework I have built an adapter for, does not work in NextJS"* — vercel/next.js#69298).
- **An "Offline redirect" section**, which matters given Part 5:
  > "If you have an application that needs to work offline, you will need to handle the redirect in
  > the client like this."
  > ```ts
  > beforeLoad: async () => {
  >   const decision = await shouldRedirect({ url: window.location.href })
  >   if (decision.redirectUrl) throw redirect({ href: decision.redirectUrl.href })
  > }
  > ```
  Locale redirects that would normally be a server concern have a documented client-side form —
  which is what an offline PWA needs.

### 7.3 Typed translated pathnames

The router's typed route tree can be used to prove every route has a translation, using the
generated `FileRoutesByTo` type:

```ts
import { FileRoutesByTo } from '../routeTree.gen'
type RoutePath = keyof FileRoutesByTo
```

The README derives `urlPatterns` from that union, so a route added without a translated pathname is
a compile error. `i18n-next` Part 4 weighted type safety on message ids heavily and found Paraglide
"fail-safe" against next-intl's "fail-open"; this extends the same guarantee to *paths*. There is
no App Router analogue, because there is no generated union of route paths to key off.

### 7.4 What this does **not** settle

Whether locale *should* enter the URL is still a product decision, and this document does not make
it. What changes is that on TanStack Start the three plausible answers — no prefix, optional
prefix, always prefix — are all first-class, none of them force a route-tree duplication, and none
of them cost a prerendering opt-out. Paraglide's own no-prefix mode remains available and is still
described as *"useful for authenticated areas like dashboards where the URL stays the same but
content is localized based on user preferences stored in cookies or headers"* (`i18n-next` Part 2)
— which is Send Lab exactly.

Also unchanged: `i18n-next`'s SSR warning still binds if any localized route is server-rendered
(*"`localStorage` is not available during the initial SSR document request, so use a server-visible
strategy such as `cookie`"*), and its four host-independent actions still stand — move the
persisted locale to a cookie, make `getContent(locale)` take its locale as a parameter, brand the
identity types, add a locale-parity check to the gate.

---

## 8. What the existing research invalidates

All four resolved research documents were re-read in full against a Vite/TanStack Router host —
4,702 lines. Verdicts are one of:

- **SURVIVES** — framework-independent fact, true verbatim on a Vite host.
- **TRANSLATES** — the fact holds; the mechanism is renamed or reshaped.
- **DEAD** — only true of Next.js.
- **NEW-QUESTION** — the section's question must be re-researched from scratch.

### 8.0 The sunk-cost figure

| Document | Lines | SURVIVES | TRANSLATES | DEAD | NEW-QUESTION |
| --- | ---: | ---: | ---: | ---: | ---: |
| `mcp-next.md` | 692 | ~551 (80%) | ~141 (20%) | ~5 (<1%) | 0 |
| `better-auth-next.md` | 1,303 | ~762 (58%) | ~331 (25%) | ~93 (7%) | ~117 (9%) |
| `i18n-next.md` | 951 | ~547 (58%) | ~119 (13%) | ~260 (27%) | ~25 (3%) |
| `nextjs-today.md` | 1,756 | ~399 (23%) | ~342 (19%) | ~944 (54%) | ~72 (4%) |
| **Total** | **4,702** | **~2,259 (48%)** | **~933 (20%)** | **~1,302 (28%)** | **~214 (5%)** |

Line counts are approximate section-level attributions, not a token-exact diff. The ticket's
stated expectation — *"`nextjs-today` is largely dead while the spec-level findings in `mcp-next`
and the schema finding in `better-auth-next` survive untouched"* — is confirmed, with one addition
the ticket did not anticipate: **`i18n-next`'s facts survive but its recommendation inverts.**

### 8.1 `mcp-next.md` (692 lines) — essentially free

**~551 survive, ~141 translate, ~5 die, 0 new questions.**

Surviving untouched, in full: the spec-revision table and the `2026-07-28` breaking-rewrite
analysis; §1 transport (POST-only endpoint, `202` for notifications, `Origin`→`403`, session ids
abolished, `initialize` removed, `MCP-Protocol-Version`/`Mcp-Method`/`Mcp-Name` required, the
dual-era compatibility matrix); §2 statelessness *"The Model Context Protocol (MCP) is a **stateless
protocol**"* and the Vercel limit numbers; §4 in its entirety (bearer tokens are first-class,
authorization is OPTIONAL, `static_headers` beta gating, Claude Code's `--header`, DCR deprecated,
the OAuth-server-is-not-required verdict); §5 (Zod v4 / Standard Schema derivation, which
hand-written validation goes away, *"keep `sanitizeState` unconditionally"*); and §6's testing
findings including the Inspector's `legacy` era default and the in-process `handler.fetch` harness.

What translates: §3's code samples (`app/api/mcp/route.ts` → `src/routes/mcp.ts`) and §6's dev
URL. §3's decisive fact is what makes the document portable — **`handler.fetch` is a web-standard
`(Request) => Promise<Response>`** — and Part 3 above shows it mounting on a Start server route
unchanged.

What dies: the literal export shapes (`export const POST = handler.fetch`,
`export { handler as GET, handler as POST }`), `mcp-handler`'s `./next` entry point becoming
irrelevant, and `http://localhost:3000/api/mcp` in the manual test commands. Note the middle one
*strengthens* the document's existing "take the SDK directly, skip `mcp-handler`" position.

### 8.2 `better-auth-next.md` (1,303 lines) — 83% intact

**~762 survive, ~331 translate, ~93 die, ~117 become new questions.**

The document contains zero mentions of Vite or TanStack — it is a pure Next↔SvelteKit comparison —
and yet most of it is library-level.

**Survives untouched, and this is the load-bearing block: §4, §5 and §7 in their entirety (~480
lines).**

- §4, the schema finding the ticket singled out: *"the column sets are already exactly right. All
  four core tables, all 34 columns — no missing columns, no extra columns, no type mismatches"*,
  proven by `@better-auth/core`'s `dist/db/get-tables.mjs` being byte-identical across 1.6.25 and
  1.6.29. Both drifts survive as latent-today findings: `verification.createdAt`/`updatedAt`
  nullable where upstream is `required: true`, and all three recommended indexes missing
  (`session.userId`, `account.userId`, `verification.identifier`) — *"A `REFERENCES` clause does not
  create an index on the child column in SQLite."*
- §5: *"There is no `api-key` plugin in core better-auth 1.6.25"*; the `bearer` plugin *"is **not**
  an opaque-API-token plugin"*; and the definitive crux *"All four read paths strip it
  unconditionally … with defaults, plaintext retrieval is **impossible**"*, which is what keeps the
  hand-rolled `sl_…` token alive.
- §7: the plugin-deprecation status (*"will be deprecated in favor of the OAuth Provider Plugin"*;
  OIDC provider *"may not be suitable for production use"*; the proof that *"The MCP plugin **is**
  the OIDC provider with MCP-shaped defaults and paths"*), CVE-2026-53512 and the note that Send
  Lab's hand-rolled server never had that bug, `@better-auth/oauth-provider@1.6.25`'s peers
  matching the committed lockfile exactly, and the RFC 9728 path-insertion warning — *"This is the
  single most likely place for the migration to break."* Part 2.6 above confirms the plugin has no
  framework subpaths, so none of this moves.
- Also surviving: §2's three-tier read model and the DB-hit table, cookie naming defaults, the
  `cookieCache` encodings and the fact Send Lab does not enable it; §6's `trustedOrigins` source
  read including *"a request with no `Cookie` header is not origin-checked at all. This is the exact
  opposite of SvelteKit's unconditional rule"*, the scope limit (*"Your own Route Handlers, Server
  Actions and pages get **no** coverage"*), and the `csrf.ts` verdict that the file is
  dependency-free and moves to any host as-is.

**Dies (~93 lines):**

1. **The entire `nextCookies()` analysis (§1, 46 lines)** — including its most interesting derived
   finding, which dies *in Send Lab's favour*: the `before` hook matching `ctx.path === '/get-session'`
   that calls `setShouldSkipSessionRefresh(true)` because RSC renders cannot write cookies, and the
   consequence *"an athlete who only reads their plan for 30 days would be logged out."* No RSC
   render path, no failure mode. Replaced by §2.3 above.
2. **"RSCs cannot refresh the cookie cache"** — the row that made cookie-cache *"a mitigation, not
   an elimination."*
3. **Points 4–6 of "What this implies for ticket 06"** — don't read the session in a layout,
   `<Suspense>` push-down, Client Components can't import the DAL / `taintUniqueValue`.
4. **§1 runtime constraints** (`proxy.ts` Node runtime, the codemod, the stale-docs trap) and **§3's
   `middleware`→`proxy` terminology and CVE-2025-29927**. The defence-in-depth *doctrine* survives;
   the file it applies to does not.
5. The two "one-line swaps" in the summary table.

**New questions (~117 lines):**

- **"There is no `hooks.server.ts` equivalent — and this is the real work" (§1, 55 lines).** Its
  premise is a Next fact. Part 2.5 above shows `_protected.tsx` + `beforeLoad` + global request
  middleware is much closer to `locals`, so the `cache()`-wrapped-DAL prescription — including its
  honest caveat that *"`cache()` dedupes within one React render pass only … the rebuild will make
  more `getSession` calls than the app makes today, not fewer"* — must be re-derived. **This is the
  section most likely to reverse.**
- **"The pattern to build" (§3, 22 lines)** — the `proxy.ts`-for-UX + `dal.ts`-for-security split
  has no direct analogue as written.
- **"Next.js: Server Actions are protected, Route Handlers are not" (§6, 42 lines).** Part 3.4
  above answers the re-asked version: Start guards **server functions** by default and leaves
  **server routes** open, which is the inverse of SvelteKit and different again from Next. §6's
  independent second leg — *"better-auth's rule is the inverse … better-auth would not have produced
  this bug in the first place"* — survives, so the "the SvelteKit bug won't recur" conclusion holds
  on both legs now.

### 8.3 `i18n-next.md` (951 lines) — the facts survive; the recommendation inverts

**~547 survive, ~119 translate, ~260 die, ~25 become new questions.** The ~260 dead lines are,
almost exactly, the entire case *against* Paraglide.

**Survives:** all of Part 0 (the measurement of the working tree — 533 flat message ids,
`en-US.json` 31,162 bytes / `pt-BR.json` 33,398 bytes, 464 call sites over 372 distinct message
functions across 57 files, 43 `getContent()` call sites across 23 files, and the ICU-hostility
audit finding *"**zero** contain an apostrophe immediately followed by `{`, `}` or `<`"*). All of
Part 4 (200 lines of type-safety comparison, ending *"Paraglide's guarantee is fail-safe;
next-intl's is fail-open"*, plus the blind spot neither vendor closes — the non-default locale is
not type-checked, so a parity check belongs in `pnpm verify` on either host). All of Part 6 (the
locale-content split is ours to design and already is; *"Putting `LocaleContent` into the catalogue
would be actively worse than what send-lab does now"*). Part 2's Paraglide subsection, which is
explicitly headed *"(config-level, framework-independent)"*, including the documented no-prefix
mode. And the TS7 caveat about Paraglide invoking the `tsc` CLI in a child process, which is live
for the `tsgo` gate regardless of host.

Part 0's line *"`vite.config.ts` **also installs `paraglideVitePlugin` for the dev/build path**"*
does not migrate on this host — it is **kept**.

**Dies (~260 lines), and this is where the conclusion changes:**

1. **"What the official Next.js guide actually is" (19 lines).** It carries the two first-party
   warnings doing most of the work in the Q1 verdict — *"**TIP** If you start from scratch, we
   recommend using a Vite-based framework"* and *"**WARNING** The setup has been reported as fragile
   for advanced use-cases … Use next-intl if you need a more stable setup."* On a Vite host the
   first is not a warning but an endorsement of the chosen architecture, and the second does not
   apply.
2. **"The Next 16 breakage, item by item" (40 lines).** All four incompatibilities are Next-16
   artefacts: the `webpack:` plugin vs Turbopack conflict, `middleware.ts`→`proxy.ts`, sync
   `headers()` removal, sync `params` removal. With them goes *"the `cache()`-plus-`overwriteGetLocale`
   trick in the example was the workaround, and Next 16 closed it. **Paraglide has not published a
   replacement.**"* Part 2.4 above notes `getRequestHeaders()` is synchronous on Start, and Part 7.2
   shows the first-party `paraglideMiddleware` wrapping pattern that Next's `AsyncLocalStorage` gap
   made impossible.
3. **Verdict on Q1** — *"the locale-resolution glue for server rendering is unsupported,
   undocumented for Next 16, and disclaimed by the maintainer"* is void as written.
4. **"What Next.js itself wants" (29 lines)** — `app/[lang]/`, `next/root-params` needing a segment
   above the root layout, the `cacheComponents` + `generateStaticParams` build failure, and the
   root-layout cookie read that *"opts the entire app out of static prerendering."* Part 7.1
   replaces all of it.
5. **All next-intl content (~100 lines across Parts 2, 3 and 5).** next-intl is a Next-only library;
   on a Vite host it is not a candidate, so Part 3's whole migration-cost analysis becomes
   decision-moot. The ICU-cleanliness result it produced is independently recorded in Part 0 and
   survives.
6. **Half of Part 5** — the Turbopack triage, i.e. both build options it enumerates
   (CLI-as-separate-step, or `next build --webpack`). The maintainer quote there contains the
   corpus's **only explicit mention of TanStack Start**, and Part 7.2 above closes it with a
   first-party in-tree example.
7. **"What would change my mind", row 3** — *"**Turbopack does not tree-shake Paraglide's
   per-message exports** in a production build … I could find **no first-party statement** either
   way — Paraglide's tree-shaking claims name Vite and Rollup, never Turbopack. Verify with a spike
   before committing."* On Vite this open risk closes without a spike, because Vite and Rollup are
   exactly the bundlers the claim names. Row 2 becomes moot; rows 4 and 5 survive.

**Net effect.** The document frames its own tension as *"Q4 favours Paraglide … Q1, Q2 and Q5
favour next-intl on Next 16."* Every Q1/Q2/Q5 objection is a Next-16 artefact. On this host the
tension collapses and the contingency the document flags — *"This needs a follow-up decision
session"* — no longer has a Next-shaped obstacle to resolve.

**The one genuine new question (~25 lines):** the recommendation's prescription to keep localized
rendering *on the client* was chosen to route around Next 16. Start server-renders by default (Part
6 turns that off, but `shellComponent` still SSRs), and Paraglide has a documented SSR story here.
So *whether to server-render localized UI* must be re-asked — and the ceiling the document accepted
(`<html lang>`, page titles and error copy staying in the base locale) may not need to be accepted.

### 8.4 `nextjs-today.md` (1,756 lines) — 54% write-off

**~399 survive, ~342 translate, ~944 die, ~72 become new questions.** This document needs a
*replacement*, not an edit.

**Survives, and is directly liftable into a replacement document (~340 lines):**

- **§5.3–§5.6, the Tailwind 4 and UI-primitive layer (~195 lines).** *"`src/app.css` is 110 lines of
  pure CSS and carries over verbatim … None of that is framework-coupled."* The per-package
  carry-over table (`tailwind-merge@3.6.0`, `tailwind-variants@3.3.1`, `tw-animate-css`,
  `@lucide/svelte`→`lucide-react` at exact version parity, `svelte-sonner`→`sonner@2.0.8`) is a
  Svelte→React finding, not a SvelteKit→Next one. The `tailwindcss-motion` risk survives verbatim
  (*"last published 2025-06-10 … the GitHub issue 'Tailwind v4 support?' still open"*). §5.5's
  primitive-layer research survives whole: `radix-ui@1.6.7`, `@base-ui/react@1.7.0` vs the
  **deprecated** `@base-ui-components/react@1.0.0-rc.0` (*"Do not install this name"*),
  `shadcn@4.18.0`, *"New projects now use Base UI by default"*, and the `cva` vs `tailwind-variants`
  conflict (*"two variant systems in one tree. Pick one."*).
- **§6.2, §6.3, §6.7 — Vercel platform facts (~143 lines).** Node 24 default with `engines.node`
  override; *"Edge runtime: dead for new work"*; Fluid compute default since 2025-04-23 and the
  1,024 shared file descriptors; the duration table; the **4.5 MB request-or-response body cap**;
  250 MB / 5 GB bundle limits; 45-minute build cap; and all of Deployment Protection including
  *"better-auth remains the only gate"* on Hobby, `VERCEL_AUTOMATION_BYPASS_SECRET`, and the OPTIONS
  Allowlist for the MCP `.well-known` CORS handler. Part 4 above confirms none of this is
  framework-dependent.
- **§3.3 Streaming** — web-standard `ReadableStream` into `new Response`, and the rule Part 3.3
  turns on: *"You cannot change the status code or headers after streaming starts … So auth must be
  verified and a 401 emitted before the stream is returned."* Plus the buffering hazards (Nginx
  `X-Accel-Buffering`, CDN buffering, gzip, *"Safari/WebKit buffers streaming responses until 1024
  bytes"*) — all HTTP-level.
- **§7.6 items 8 and 9** — the Vercel CDN will not cache authenticated responses, function
  `Cache-Control` overrides `vercel.json`, the `Vary: Cookie` anti-pattern, and *"On Hobby and Pro
  the Data Cache is shared across all projects in your team."*
- **The Vercel half of §6.4**, plus both honest losses versus SvelteKit (no `$env/dynamic/public`,
  no build-time env validation) — Part 4.4 above confirms both carry.

**Dies (~944 lines) — named:**

1. **§7 in almost its entirety (~240 of 268 lines).** Two caching models, the four-cache table,
   `cacheComponents`/`use cache`/`use cache: private`/`use cache: remote`, `cacheLife`/`cacheTag`/
   `revalidateTag`/`updateTag`/`refresh`, PPR-folded-into-Cache-Components, the *"`cookies()` does
   not mean dynamic"* semantic trap, the Full Route Cache static-optimising an authenticated page,
   `unstable_cache` keyParts leakage, `force-static` returning empty `cookies()`, bots taking a
   different code path, and the §7.7 recommendation. **None of these caches exist on this host** —
   the whole "what could serve one athlete another's data" hazard class collapses to the two Vercel
   CDN items above, plus browser back/forward reuse, which TanStack Router re-introduces in its own
   form via loader `staleTime`/`gcTime` and must be re-examined there rather than deleted.
2. **§4 in almost its entirety (~161 of 190 lines).** `proxy.ts` naming and `middleware.ts`
   deprecation, *"One proxy per project — there is no `sequence()` composition helper"*,
   runtime-not-configurable, matcher rules, the can/cannot table, `skipProxyUrlNormalize`,
   `unstable_doesProxyMatch`, CVE-2025-29927. The doctrine in §4.5 survives (*"it should not be your
   only line of defense … as close as possible to your data source"*); the file does not.
3. **§2.1 + §2.2 + §2.4 (99 lines) — the whole RSC / `'use client'` / Server Actions core.** The
   serialization boundary table, *"React context is not supported in Server Components"*, the
   compound-component breakage, viral `'use client'`. Most consequentially the document's loudest
   warning dies: *"**Actions are dispatched one at a time, per client.** … A training console where
   an athlete ticks off six sets in five seconds would serialize six round trips. **This is the
   single biggest ergonomic hazard for Send Lab.**"* Also dead: the 1 MB
   `serverActions.bodySizeLimit`, encrypted action IDs, and deployment-skew *"Failed to find Server
   Action"*. One principle survives, as a principle: *"the route is reachable to anyone who can send
   the same POST. Treat every action as an untrusted entry point"* — true of any RPC-over-POST.
4. **§3.5 and §3.6.** `export const dynamic`/`revalidate`/`fetchCache`, *"`GET` Route Handlers are
   not cached by default"*, the Cache Components edge where a `GET` handler that forgets to read the
   session is baked into the build output, *"Never use `force-static`"*. And §3.6, the exact removal
   that broke Paraglide: *"Starting with **Next.js 16**, synchronous access is fully removed."*
5. **§3.1** — *"There **cannot** be a `route.js` file at the same route as `page.js`."* Part 3.2
   above quotes Start's inverse.
6. **§1.4** — *"the App Router uses React canary releases built-in … your `react@19.2.8` dependency
   is a type/tooling declaration; the runtime is a vendored canary"*, and the derived third-party
   risk. On Vite you run the React you install; the risk vanishes, and so do the canary-only
   features (`<ViewTransition>`, `<Activity>`) it credits.
7. **§5.1 (53 lines) — the sharpest inversion.** *"**`@tailwindcss/vite` must be dropped. There is
   no Vite path in Next.js.**"* On this host `@tailwindcss/vite` is kept — it is what the
   first-party `start-i18n-paraglide` and `start-tailwind-v4` examples use. The entire
   `@tailwindcss/postcss` vs `@tailwindcss/webpack` (2.17× benchmark) vs `@tailwindcss/turbopack`
   triage is deleted.
8. **§1.1–§1.3, §1.5 (145 lines)** — Next's release train, LTS policy, v15/v16 change lists,
   Turbopack-by-default, App-Router-vs-Pages-Router. Part 1 above is the replacement, and it is a
   much less comfortable read.
9. **§6.6 MCP on Vercel + Next** — already superseded by `mcp-next` §3.

**New questions (~72 lines):**

- **§6.1 "No adapter. Zero-config framework detection."** This is the one place the switch is a
  *regression*. *"deploying to Vercel is zero-configuration"* was a Next-on-Vercel property; Part 4
  above shows Vercel does ship a `tanstack-start` preset with zero-config detection, but the path
  runs through **Nitro at `3.0.260610-beta`**, i.e. an adapter-shaped dependency of exactly the kind
  the rebuild was going to shed with `@sveltejs/adapter-vercel`. The document's own contradiction
  row becomes live again — *"`@sveltejs/adapter-vercel`'s docs still quote `maxDuration` defaults of
  10 s Hobby / 15 s Pro / 900 s Enterprise. Those contradict Vercel's current 300 s/800 s"* — and
  whether the Nitro Vercel preset carries the same stale defaults was **not established**.
- **§4.6 "What this means for the `hooks.server.ts` migration."** Its central claim — *"The Next.js
  equivalent is **not** one file — it is a split"*, *"the safety comes from repetition, not from a
  single choke point"* — is the thing most likely to reverse, given Start's global request
  middleware. Pairs with the `better-auth-next` new question above.

**Two TRANSLATES worth naming, because one of them is a loss:**

- **§6.4 environment variables** maps 1:1 — `NEXT_PUBLIC_` → `VITE_`, identical build-time inlining
  and freeze semantics, identically no runtime escape.
- **§8, the bilingual trap.** The ADR-0003 rule survives absolutely — *"actions and route handlers
  accept stable keys only, never rendered strings"* — but both stated *mechanisms* die.
  `next/root-params` came with a protective restriction (*"Root parameter getters run in Server
  Components and server-side utilities, but **not** in Client Components, Server Actions, or Route
  Handlers"*), and cache keys being plain text was the other tripwire. On TanStack Router typed
  route params are available to loaders, components and server functions alike, so **the accidental
  protection §8 credited Next with is lost**, and the guard has to come entirely from branded types.

### 8.5 Re-research cost, if the switch happens

| Document | What needs redoing |
| --- | --- |
| `mcp-next.md` | §3 code samples and §6's dev URL. **~1 hour.** |
| `better-auth-next.md` | §1 mounting + cookie plugin, §2's per-context table, §3's proxy/DAL split, §6's "does the host protect server functions" question. §4, §5, §7 need nothing. **~1 day** — and Parts 2 and 3 above already cover most of it. |
| `i18n-next.md` | Replace Part 1 and half of Part 5 with a Paraglide-on-Vite section; delete Part 2's Next subsections and all of Part 3; Parts 0, 4 and 6 stand. **~1 day** — Part 7 above already covers most of it. |
| `nextjs-today.md` | A **replacement document**. §5 (~195 lines) and the Vercel-platform parts of §6 (~143 lines) lift almost verbatim; the remaining 900+ lines are research about a framework that would no longer be the host. |

---

## Where the sources contradict each other

1. **"TanStack Start hit v1.0"** is asserted by several secondary write-ups and by search summaries.
   It is **not supported by any primary source.** The docs say Release Candidate, the docs site
   versions Start as `v0`, `@tanstack/react-start` has never published a `1.0.0`, and the only
   maintainer statement about timing is the September 2025 RC post. Secondary sources were not used
   for any claim in this document.
2. **The npm version vs the stability claim.** `@tanstack/react-start@1.168.46` reads as a mature
   1.x; the documentation says otherwise. Both are true statements about different things (§1.1).
3. **`nitro`'s npm `latest` is a beta**, while both TanStack's and Vercel's guides say `npm install
   nitro` without qualification. Neither guide mentions that the resolved version is
   `3.0.260610-beta`.
4. **`display: fullscreen` on iOS.** MDN's compat data records it as unsupported in Safari; WebKit's
   own posts have described `standalone` *or* `fullscreen` as qualifying a site as a web app. The
   most plausible reconciliation is the spec's fallback chain (`fullscreen` → `standalone`), but no
   WebKit source states it. **UNKNOWN**; `standalone` is unambiguous and is what the app already
   ships.
5. **Chrome's `beforeinstallprompt` fetch-handler requirement.** Chrome's blog (2023-12-05) says the
   prompt *"still requires the presence of a `fetch()` handler"*; `web.dev` (2024-09-19) and MDN
   (2025-11-30) enumerate the criteria without it. **UNKNOWN.** Moot here — this app has a real
   fetch handler.
6. **Next's PWA guide contradicts itself across two steps.** Step 5 registers the worker with
   `new URL('../lib/service-worker.js', import.meta.url)`, which 16.3 serves at
   `/_next/static/service-worker/sw.js` with its own headers; step 8 still prescribes a
   `Cache-Control` header block scoped to `/sw.js`. The two steps describe different mechanisms;
   step 8 is stale.
7. **Next 16.3's service-worker compilation is in the source and the release notes but not in the
   16.3 blog post**, which announces six other things under "Network resilience" and omits this one.
   Cited from `crates/next-api/src/service_worker.rs` at tag `v16.3.1` rather than from marketing.
8. **The `webpack`-config build failure is documented as unconditional and is not.** The upgrade
   guide lists three fixes; `turbopack-warning.ts` shows the exit fires only when the bundler was
   *defaulted* and no `turbopack` config exists, giving a fourth (`turbopack: {}`).

## Staleness warnings on load-bearing facts

- **§1's RC status is the fact most likely to change**, and it would change the shape of the whole
  document. Re-check <https://tanstack.com/start/latest/docs/framework/react/overview> and the
  `needed-for-start-stable` label before any decision meeting.
- **§5.1's PWA blocker is also live.** Three things to re-check together: whether `unplugin-pwa` has
  been published to npm, whether [nitrojs/nitro#4440](https://github.com/nitrojs/nitro/pull/4440)
  has merged, and whether [TanStack/router#4988](https://github.com/TanStack/router/issues/4988) has
  closed. The maintainer's own schedule was "this weekend or next week" as of 2026-07-28.
- **§4.3's `nitro` dist-tag.** If `latest` becomes a non-beta, the strongest maturity objection to
  the Vercel path disappears.
- **§5.1.5's Next-side finding is twelve days old.** Turbopack service-worker compilation shipped in
  `next@16.3.0` on 2026-08-03; `@serwist/turbopack@9.5.12` shipped 2026-07-22 and has not adapted to
  it. Both sides of that will move. Re-check whether Serwist has taken a dependency on the native
  compiler, and whether [serwist#360](https://github.com/serwist/serwist/issues/360) (the Vercel
  runtime crash) has closed.
- Vercel's Node.js versions page is stamped `last_updated: 2026-02-27`; the TanStack Start page
  `2026-07-10`; the deployment guide `2026-07-16`.
- Apple's "Configuring Web Applications" reference is an **archive document last updated
  2016-12-12** and was used only for the `apple-mobile-web-app-*` tag list, cross-checked against
  MDN compat data and WebKit posts.

## Open questions this research could not settle

1. **What `@tanstack/react-start`'s minor bumps actually break.** The changelog has no breaking
   marker and the project has no major line, so upgrade risk is unmeasurable from published
   artefacts (§1.5). The only way to know is to run it.
2. **Baseline client JS for each candidate.** No primary figure exists for either; the one vendor
   page that discusses it disclaims exactly that number (§5.6). Two builds of the same app would
   settle it.
3. **Whether `tanstackStartCookies()` has its own skip logic or last-plugin warning** (§2.3) —
   source not read.
4. **What a Start server route returns for an undeclared HTTP method** (§3.2). The spec prefers
   `405`; the docs do not say.
5. **Whether `routes/[.]well-known.oauth-protected-resource.mcp.ts` actually produces
   `/.well-known/oauth-protected-resource/mcp`** (§2.6). Derived from the documented `[x]` escaping
   rule, not demonstrated anywhere.
6. **Whether the Nitro Vercel preset carries the stale `maxDuration` defaults** that
   `nextjs-today`'s contradiction note found in `@sveltejs/adapter-vercel`'s docs (§8.4).
7. **Whether TanStack Router's loader `staleTime` / `gcTime` re-introduce any of the
   cross-account-leak hazard class** that `nextjs-today` §7 catalogued for Next's caches. §8.4 flags
   it as needing re-examination rather than deletion; it was not examined here.
8. **How a precaching service worker and Vercel Skew Protection interact** (§5.4.4). A precached
   shell deliberately creates stale clients; skew protection forces stale clients to hard-reload;
   the reload is answered from the precache. **No primary source anywhere addresses this** — not
   Next.js, not Vercel, not Serwist, not `vite-plugin-pwa`. It is a design problem this project
   would own on either host.
9. **Whether `cacheComponents: true` changes the set of `.html` files Next writes to
   `.next/server/app/`** versus leaving shells as RSC-payload-only artefacts. The glossary and PPR
   docs describe runtime behaviour, not on-disk emission. Not established.
10. **Whether Next's Build-Adapters `staticFiles[].immutableHash` and `pathname` are correct on
    Windows.** A probe on Windows 11 / `16.3.1` returned `immutableHash: undefined` and `pathname`
    values containing backslashes, apparently because `build-complete.js` posix-joins a
    `recursiveReadDir` result without normalising separators on the non-`output: 'export'` branch.
    Unverified on Linux and macOS — relevant only because this project develops on Windows.

## Sources

All read 2026-08-15 unless a different date is given.

### TanStack Start / Router

- Overview, carrying the Release Candidate banner — <https://tanstack.com/start/latest/docs/framework/react/overview>
- v1 Release Candidate announcement, 2025-09-23 — <https://tanstack.com/blog/announcing-tanstack-start-v1>
- Server Routes — <https://tanstack.com/start/latest/docs/framework/react/guide/server-routes>
- SPA mode — <https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode>
- Selective SSR — <https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr>
- Middleware, including the CSRF section — <https://tanstack.com/start/latest/docs/framework/react/guide/middleware>
- Hosting — <https://tanstack.com/start/latest/docs/framework/react/guide/hosting>
- Environment variables — <https://tanstack.com/start/latest/docs/framework/react/guide/environment-variables>
- Client entry point — <https://tanstack.com/start/latest/docs/framework/react/guide/client-entry-point>
- TanStack Start vs Next.js, a vendor comparison page and cited as such — <https://tanstack.com/start/latest/docs/framework/react/start-vs-nextjs>
- Router i18n guide — <https://github.com/TanStack/router/blob/main/docs/router/guide/internationalization-i18n.md>
- Router URL rewrites — <https://github.com/TanStack/router/blob/main/docs/router/guide/url-rewrites.md>
- Automatic code splitting — <https://tanstack.com/router/latest/docs/framework/react/guide/automatic-code-splitting>
- File naming conventions, the `[x]` escaping rule — <https://github.com/TanStack/router/blob/main/docs/router/routing/file-naming-conventions.md>
- `examples/react/start-i18n-paraglide` — <https://github.com/TanStack/router/tree/main/examples/react/start-i18n-paraglide>
- Repository, MIT, 14,941 stars, 546 open issues — <https://github.com/TanStack/router>
- Discussion 5999, stable-release timing, unanswered — <https://github.com/TanStack/router/discussions/5999>
- Issue 4988, `vite-plugin-pwa` incompatible with Start production builds, open, `needs-upstream-fix` — <https://github.com/TanStack/router/issues/4988>
- Issue 5407, `setResponseHeaders` / `setResponseStatus` in global middleware, open, `needed-for-start-stable` — <https://github.com/TanStack/router/issues/5407>
- Issue 5464, only the last `setCookie` takes effect, open, `needed-for-start-stable` — <https://github.com/TanStack/router/issues/5464>
- Issue 6200, loader error under SSR streaming crashes the dev server, open, `needed-for-start-stable` — <https://github.com/TanStack/router/issues/6200>
- Issue 7403, server route 404 under `Sec-Fetch-Dest: image`, open, `needs-upstream-fix` — <https://github.com/TanStack/router/issues/7403>
- `packages/react-start/CHANGELOG.md` and `packages/start-plugin-core/CHANGELOG.md`

### PWA tooling

- `vite-plugin-pwa` frameworks list — <https://vite-pwa-org.netlify.app/frameworks/>
- Prompt for update — <https://vite-pwa-org.netlify.app/guide/prompt-for-update.html>
- Automatic reload — <https://vite-pwa-org.netlify.app/guide/auto-update.html>
- Service worker precache — <https://vite-pwa-org.netlify.app/guide/service-worker-precache.html>
- PWA minimal requirements — <https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements.html>
- React integration — <https://vite-pwa-org.netlify.app/frameworks/react.html>
- Vercel deployment headers — <https://vite-pwa-org.netlify.app/deployment/vercel.html>
- Issue 902, service worker skipped when `build.ssr === true` — <https://github.com/vite-pwa/vite-plugin-pwa/issues/902>
- Issue 917, add TanStack Router and Start examples — <https://github.com/vite-pwa/vite-plugin-pwa/issues/917>
- Issue 940, service worker generated once per build environment under Nitro — <https://github.com/vite-pwa/vite-plugin-pwa/issues/940>
- PR 786, Vite Environment API support, open since 2024-11-15 — <https://github.com/vite-pwa/vite-plugin-pwa/pull/786>
- `serwist/serwist` issue 300, the same bug in the fork — <https://github.com/serwist/serwist/issues/300>
- `serwist/serwist` issue 54, Turbopack support, open since 2024-01-27 — <https://github.com/serwist/serwist/issues/54>
- `serwist/serwist` issue 360, `createSerwistRoute` crashes on Vercel — <https://github.com/serwist/serwist/issues/360>
- `serwist/serwist` issues 363 and 366 — <https://github.com/serwist/serwist/issues/363>, <https://github.com/serwist/serwist/issues/366>
- `packages/turbo/src/index.ts` and `packages/turbo/src/lib/utils.ts` in `serwist/serwist`
- `nitrojs/nitro` PR 4440, `vite:before:compile` hook, open — <https://github.com/nitrojs/nitro/pull/4440>

### Platform, browser and OS

- W3C Web Application Manifest, Working Draft 2026-08-13 — <https://www.w3.org/TR/appmanifest/>
- W3C Service Workers, Editor's Draft 2026-08-12 — <https://w3c.github.io/ServiceWorker/>
- WHATWG Storage Standard, 2026-03-15 — <https://storage.spec.whatwg.org/>
- MDN, Making PWAs installable, 2025-11-30 — <https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable>
- MDN, Storage quotas and eviction criteria, 2026-01-05 — <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>
- MDN browser-compat-data, `api/` and `manifests/webapp/` — <https://github.com/mdn/browser-compat-data>
- WebKit, WebKit Features in Safari 26.0, zero installability requirements, 2025-09-15 — <https://webkit.org/blog/17333/webkit-features-in-safari-26-0/>
- WebKit, Updates to Storage Policy, 2023-08-10 — <https://webkit.org/blog/14403/updates-to-storage-policy/>
- WebKit, Full Third-Party Cookie Blocking and More, the 7-day cap and its Home Screen exemption, 2020-03-24 — <https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/>
- WebKit, Tracking Prevention policy — <https://webkit.org/tracking-prevention/>
- WebKit, WebKit Features in Safari 16.4, Web Push on Home Screen web apps, 2023-03-27 — <https://webkit.org/blog/13966/webkit-features-in-safari-16-4/>
- WebKit, Web Push for Web Apps on iOS and iPadOS, 2023-02-16 — <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/>
- WebKit, Meet Web Push, 2022-06-07 — <https://webkit.org/blog/12945/meet-web-push/>
- WebKit, Meet Declarative Web Push, 2025-03-27 — <https://webkit.org/blog/16535/meet-declarative-web-push/>
- WebKit, WebKit Features in Safari 18.4, 2025-03-31 — <https://webkit.org/blog/16574/webkit-features-in-safari-18-4/>
- WebKit standards-positions 14, Background Sync, and 149, Background Fetch, both at "Needs position"
- Apple, Sending web push notifications in web apps and browsers — <https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers>
- Apple, Configuring Web Applications, archive document last updated 2016-12-12 — <https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html>
- Apple, Update on apps distributed in the European Union — <https://developer.apple.com/support/dma-and-apps-in-the-eu/>
- web.dev, The service worker lifecycle — <https://web.dev/articles/service-worker-lifecycle>
- Chrome for Developers, Revisiting Chrome's installability criteria, 2023-12-05 — <https://developer.chrome.com/blog/update-install-criteria>

### better-auth

- TanStack Start integration, docs v1.6 — <https://www.better-auth.com/docs/integrations/tanstack>, source at `docs/content/docs/integrations/tanstack.mdx`
- OAuth 2.1 Provider plugin — <https://www.better-auth.com/docs/plugins/oauth-provider>
- Published `exports` maps for `better-auth@1.6.29` and `@better-auth/oauth-provider@1.6.29`

### Next.js 16, for the comparison

- Progressive Web Apps guide, `lastUpdated: 2026-07-30` — <https://nextjs.org/docs/app/guides/progressive-web-apps>
- Offline support guide, `lastUpdated: 2026-08-10` — <https://nextjs.org/docs/app/guides/offline-support>
- Turbopack reference, `lastUpdated: 2026-08-11` — <https://nextjs.org/docs/app/api-reference/turbopack>
- Upgrading to version 16, `lastUpdated: 2026-08-03` — <https://nextjs.org/docs/app/guides/upgrading/version-16>
- Single-page applications, `lastUpdated: 2026-08-14` — <https://nextjs.org/docs/app/guides/single-page-applications>
- Static exports, `lastUpdated: 2026-08-09` — <https://nextjs.org/docs/app/guides/static-exports>
- Glossary, App Shell and Static Shell, `lastUpdated: 2026-08-10` — <https://nextjs.org/docs/app/glossary>
- Lazy loading, `lastUpdated: 2026-03-10` — <https://nextjs.org/docs/app/guides/lazy-loading>
- Server and Client Components, `lastUpdated: 2026-08-11` — <https://nextjs.org/docs/app/getting-started/server-and-client-components>
- Build Adapters output types, `lastUpdated: 2026-07-24` — <https://nextjs.org/docs/app/api-reference/adapters/output-types>
- `public` folder, `lastUpdated: 2025-06-16` — <https://nextjs.org/docs/app/api-reference/file-conventions/public-folder>
- `deploymentId`, `lastUpdated: 2026-06-08` — <https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId>
- Package bundling, `lastUpdated: 2026-06-01` — <https://nextjs.org/docs/app/guides/package-bundling>
- Next.js 16.3 release post, 2026-08-03 — <https://nextjs.org/blog/next-16-3>
- Source at tag `v16.3.1`: `crates/next-api/src/service_worker.rs`, `turbopack/crates/turbopack-ecmascript/src/references/service_worker.rs`, `packages/next/src/lib/turbopack-warning.ts`, `packages/next/src/build/index.ts`, `packages/next/src/server/lib/router-server.ts`
- `test/e2e/app-dir/service-worker/service-worker-register.test.ts` — <https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/service-worker/service-worker-register.test.ts>
- Discussion 86533, Turbopack standalone timeline, unanswered — <https://github.com/vercel/next.js/discussions/86533>

### Vercel, Nitro and MCP

- TanStack Start on Vercel, `last_updated: 2026-07-10` — <https://vercel.com/docs/frameworks/full-stack/tanstack-start>
- Deploy a TanStack Start app to Vercel, published 2026-06-04, `last_updated: 2026-07-16` — <https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel>
- Supported Node.js versions, `last_updated: 2026-02-27` — <https://vercel.com/docs/functions/runtimes/node-js/node-js-versions>
- Skew Protection, `last_updated: 2026-07-15` — <https://vercel.com/docs/skew-protection>
- Nitro Vercel provider — <https://nitro.build/deploy/providers/vercel>
- MCP TypeScript SDK v2 — <https://ts.sdk.modelcontextprotocol.io/v2/>
- npm registry metadata for `@tanstack/react-start`, `@tanstack/react-router`, `nitro`, `nitropack`, `@tanstack/nitro-v2-vite-plugin`, `vite-plugin-pwa`, `serwist`, `@serwist/vite`, `@serwist/next`, `@serwist/turbopack`, `unplugin-pwa`, `next`, `next-pwa`, `@ducanh2912/next-pwa`, `better-auth`, `@better-auth/oauth-provider`, `@modelcontextprotocol/server`, `@modelcontextprotocol/sdk` — read from `https://registry.npmjs.org/`

### This repository

- `CONTEXT.md`; `src/service-worker.ts`; `static/manifest.webmanifest`; `src/lib/state.svelte.ts:158`; `src/lib/timerStore.svelte.ts:99-104`; `src/routes/settings/+page.svelte:27-34`
- `docs/research/nextjs-today.md`, `better-auth-next.md`, `i18n-next.md`, `mcp-next.md`, each on its own `research/*` branch
