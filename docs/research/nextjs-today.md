# Next.js today: current release, App Router state of play, Tailwind 4, Vercel shape

Research for Wayfinder ticket `02-nextjs-today` (map: Next.js rebuild).
Researched 2026-08-15. Every version number below was checked against a live primary source on that
date — do not trust it after a few months without re-checking.

**Method and trust order.** Official Next.js docs (`nextjs.org/docs`) first, then Vercel docs, then
official release blog posts, then the npm registry for version numbers. Where a blog post and the
docs disagree, the docs win and the disagreement is called out inline. Every Next.js docs page now
carries a `version:` and `lastUpdated:` field in its markdown front-matter, so each docs citation
below states the version the page was published for.

**Reading this against the map's constraints.**

- Send Lab is bilingual (en / pt-BR) and ADR 0003 forbids user-facing labels as identifiers. Nothing
  in Next.js makes that trap better or worse by itself, but §8 notes the two places the rebuild would
  reintroduce it.
- The driver is React ecosystem access, so the client rewrite is the value and server-side churn is
  cost. §2 is the section where that trade-off is decided: RSC/App Router is a server-first model,
  and Send Lab is a stateful private console. That mismatch is real and is stated plainly, not
  argued away.
- Send Lab is private, per-account and always-dynamic. §7 is the section to read before writing any
  page.

---

## Verified versions (2026-08-15)

| Package | Version | Source |
| --- | --- | --- |
| `next` | **16.3.1** | `https://registry.npmjs.org/next/latest` |
| `react` / `react-dom` (stable) | **19.2.8** | `https://registry.npmjs.org/react/latest` |
| `tailwindcss` | **4.3.3** | `https://registry.npmjs.org/tailwindcss/latest` |

`next@16.3.1` declares peer deps `react: ^18.2.0 || ^19.0.0` and the same for `react-dom`
(`https://registry.npmjs.org/next/latest`). That peer range is misleading for the App Router — see
§1.4.

---

## 1. Current stable Next.js release, and the last two majors

### 1.1 The release train

- **Next.js 16.3.1 is the current stable release** (npm `latest`, 2026-08-15).
- **16.3** shipped **2026-08-03** — <https://nextjs.org/blog/next-16-3>. The post calls it "our
  biggest update to the framework since Next.js 16.0".
- **16.2** shipped **2026-03-18** — <https://nextjs.org/blog/next-16-2>.
- **16.1** shipped **2025-12-18** — <https://nextjs.org/blog/next-16-1>.
- **16.0** shipped **2025-10-21** — <https://nextjs.org/blog/next-16>.
- **15.0** shipped **2024-10-21** — <https://nextjs.org/blog/next-15>.

> **Docs/blog discrepancy.** The 16.3 blog post says "Next.js 16.0 came out last November", but the
> Next.js 16 post is dated October 21st 2025 and the support policy page also dates 16.x to
> Oct 21 2025. Prefer the dated release post and the support policy.

**Support policy** (<https://nextjs.org/support-policy>): 16.x is **Active LTS** (new features, bug
fixes, security). 15.x is **Maintenance LTS** — critical bug fixes and essential security only —
**until 2026-10-21**, two years from its release. The policy explicitly warns that maintenance
updates "may be released as semver-minor releases, even if they contain breaking changes".

Consequence for a greenfield build: start on 16.3.x. 15.x has roughly two months of maintenance left
and there is no reason to adopt it.

### 1.2 What changed in v15 that matters to a greenfield app

From <https://nextjs.org/blog/next-15> (2024-10-21):

- **Async request APIs (breaking).** `cookies`, `headers`, `draftMode`, `params`, `searchParams` all
  became async. You always `await` them. In 15 a sync read still worked with a warning; in 16 the
  sync path was removed outright.
- **Caching defaults reversed.** "With Next.js 15, we're changing the caching default for `GET` Route
  Handlers and the Client Router Cache from cached by default to uncached by default." Specifically:
  `fetch` requests, `GET` Route Handlers and client navigations are no longer cached by default, and
  the Client Router Cache uses `staleTime: 0` for Page segments. This is the single most important
  v14→v15 change for a private per-account app; see §7.
- `next.config.ts` (TypeScript config) supported.
- Server Actions gained encrypted, non-deterministic action IDs plus dead-code elimination of unused
  actions.
- `instrumentation.js` stable, `<Form>` component added, `unstable_after` introduced.
- `runtime = "experimental-edge"` deprecated in favour of `runtime = "edge"` in the App Router.

### 1.3 What changed in v16 that matters to a greenfield app

From <https://nextjs.org/blog/next-16> (2025-10-21), plus the 16.1/16.2/16.3 posts:

**Requirements (hard gates).**

| Requirement | Value |
| --- | --- |
| Node.js | **≥ 20.9.0**; Node 18 unsupported |
| TypeScript | **≥ 5.1.0** |
| Browsers | Chrome/Edge/Firefox 111+, Safari 16.4+ |

Send Lab's `package.json` currently declares `"node": ">=20"` — that needs tightening to `>=20.9`.

**Structural changes.**

- **Turbopack is the default bundler** for `next dev` and `next build`. Webpack is still available
  via `next dev --webpack` / `next build --webpack`. Confirmed in the docs, not just the blog:
  "Turbopack is now the default bundler. To use Webpack run `next dev --webpack`"
  (<https://nextjs.org/docs/app/getting-started/installation>, v16.3.1, updated 2026-07-21).
- **`middleware.ts` → `proxy.ts`.** See §4. `middleware.ts` still works but is **deprecated and
  "will be removed in a future version"**.
- **Cache Components (`cacheComponents: true`, `'use cache'`)** replaces the old implicit caching
  model. Opt-in. See §7. The old `experimental.dynamicIO` flag was renamed to `cacheComponents`, and
  `experimental.ppr` / `export const experimental_ppr` were **removed** — PPR is now folded into
  Cache Components.
- **`next lint` removed.** `next build` no longer runs a linter. You wire ESLint or Biome up yourself
  as an npm script. Good news for Send Lab, which already lints with Biome and has its own `verify`
  gate — the framework no longer fights it. `create-next-app` will offer Biome as a first-class
  choice (§1.5).
- **`revalidateTag()` signature changed**: it now takes a `cacheLife` profile as a second argument.
  The single-argument form is deprecated. New siblings `updateTag()` (read-your-writes, Server
  Actions only) and `refresh()` (refetch uncached data only, Server Actions only).
- **Removed:** AMP, `serverRuntimeConfig` / `publicRuntimeConfig` (use env vars), sync `params` /
  `searchParams` / `cookies()` / `headers()` / `draftMode()`, `unstable_rootParams()`.
- **Behaviour changes worth knowing:** all parallel-route slots now require an explicit `default.js`
  or the build fails; `next/image` defaults tightened (`qualities` now `[75]`, `minimumCacheTTL` now
  4 h, local IP optimization blocked, max 3 redirects); prefetch cache fully rewritten with layout
  deduplication and incremental prefetching.

**16.1 → 16.3 additions relevant to a rebuild.**

- **16.1**: Turbopack filesystem caching stable for `next dev`; `next upgrade` command;
  `next dev --inspect`; `serverExternalPackages` now resolves transitive deps correctly (relevant if
  a libSQL/Turso driver needs externalizing).
- **16.2**: Adapters API stable; ~50% faster RSC payload deserialization; `next start --inspect`;
  `postcss.config.ts` support in Turbopack.
- **16.3**: up to 90% less dev-server RAM; Turbopack filesystem cache for `next build` on by
  default; **`next build` can type-check with TypeScript 7** via a local `typescript@^7` dependency
  (<https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli>) — directly
  relevant, Send Lab already runs `tsgo`; **`next/root-params`** for reading `[lang]` from any Server
  Component (§8); `catchError` custom error boundaries with a `retry()`; `import.meta.glob`;
  **Instant Navigations** (opt-in `partialPrefetching`).

The 16.3 post states the direction of travel explicitly, and it is worth quoting because it is the
opposite of the App Router's 2023 reputation:

> "The behaviors behind Instant Navigations will become the default in a future major version, as
> they're part of our work over the last year to simplify Next.js back to its roots: dynamic by
> default, with no hidden or implicit caching."

That is a good sign for Send Lab specifically: the framework is moving toward the shape an
always-dynamic private app wants. It also means **the defaults will change again in v17**, and a
rebuild started now on 16.3 will face a migration.

### 1.4 React version: the App Router does not use the React you install

<https://nextjs.org/docs/app/getting-started/installation> (v16.3.1) says:

> "The `App Router` uses React canary releases built-in, which include all the stable React 19
> changes, as well as newer features being validated in frameworks, but you should still declare
> react and react-dom in package.json for tooling and ecosystem compatibility."
>
> "The `Pages Router` uses the React version from your `package.json`."

So on the App Router your `react@19.2.8` dependency is a type/tooling declaration; the runtime is a
vendored canary. Practical consequences:

- Features like `<ViewTransition>`, `useEffectEvent` and `<Activity>` are available because of the
  canary, per <https://nextjs.org/blog/next-16>.
- A third-party React library that pins an exact React version, or that depends on React internals,
  is a risk you cannot fully control from `package.json`. Weigh this when picking UI libraries (§5).
- React Compiler support is **stable but off by default** in 16 (`reactCompiler: true`), and 16.3
  adds an experimental Rust implementation inside Turbopack
  (`experimental.turbopackRustReactCompiler`). Off by default because Vercel is "still gathering
  build performance data"; enabling it via Babel measurably slows builds.

### 1.5 Is the App Router unambiguously the default? Is Pages Router legacy?

**App Router: yes, it is the default.** From
<https://nextjs.org/docs/app/getting-started/installation> (v16.3.1):

- `create-next-app --yes` "default setup enables TypeScript, Tailwind CSS, ESLint, App Router, and
  Turbopack, with import alias `@/*`, and includes `AGENTS.md`".
- The interactive prompt reads `Would you like to use App Router? (recommended) No / Yes`.

So the word the docs use is **"recommended"**, and the zero-prompt path gives you App Router. There
is no ambiguity for a greenfield project.

**Pages Router: not deprecated, but plainly deprioritised.** Be honest about the distinction:

- The Pages Router still has a full documentation tree
  (<https://nextjs.org/docs/pages/getting-started>) and is a top-level section of the docs sitemap
  (<https://nextjs.org/docs/sitemap.md>).
- But that landing page's own front-matter reads `lastUpdated: 2024-11-07` — nearly two years stale
  as of this research, while App Router pages carry `lastUpdated` dates in the past few weeks.
- New features are App-Router-only. `proxy.ts`, Route Handlers, Cache Components, `use cache`,
  `next/root-params`, View Transitions and `transitionTypes` on `<Link>` are all App Router. The
  16.2 post says `transitionTypes` "is only supported in the App Router, since the Pages Router does
  not use React Transitions for navigation".
- `https://nextjs.org/docs/pages` (the bare section root) now 404s and redirects readers to the
  sitemap; only the subpages resolve.
- Vercel's public position, in the maintainers' own words in
  <https://github.com/vercel/next.js/discussions/56655> ("The Future of Next.js Pages Router"), is a
  commitment to support `pages/` — bug fixes, improvements, security patches — across multiple major
  versions, so that teams can adopt the App Router incrementally.

**Verdict for this ticket.** Treat the App Router as the only option for a 2026 greenfield build.
Do not read "Pages Router is supported" as "Pages Router is a live alternative" — it is a migration
runway for existing apps, and choosing it would mean building on a surface that gets no new features
and whose docs are two years stale. It is also *not* a way to dodge RSC ergonomics without cost: you
would be giving up Route Handlers, `proxy.ts` and the whole current API surface.

---

## 2. RSC and Server Actions as they actually stand — the constraints, not the pitch

This is the section that decides whether the rebuild is worth it. Send Lab is a stateful private
console: a single athlete's account, one JSON-ish document of state, timers, drafts, editable day
plans, sliders and toggles. That is close to the *worst* shape for a server-first rendering model and
close to the *best* shape for a plain client app. The honest reading is below.

### 2.1 What the boundary actually is

From <https://nextjs.org/docs/app/guides/server-and-client-boundary> (v16.3.1, updated 2026-08-11) —
the clearest statement of the rules in the docs:

> "You mark a Client Component with the `'use client'` directive. The directive draws a boundary in
> the module graph, and two rules determine what crosses it:
>
> - **Code** crosses through imports. Whatever a Client Component imports is pulled into the client
>   bundle.
> - **Data** crosses through props, and it must be serializable, so functions like event handlers
>   cannot cross."

Concretely:

| Thing | Crosses server → client? |
| --- | --- |
| Serializable data (objects, arrays, strings, numbers, `Date`, `Map`, `Set`, promises) | Yes |
| A rendered React element (including as `children`) | Yes — it is serialized data |
| A plain function / event handler like `onClick` | **No — throws** |
| A Server Function marked `'use server'` | Yes, as a *reference* |
| A class instance | No (blocked by default) |
| React Context | **No** — "React context is not supported in Server Components" |

Two sharp edges the docs call out that bite in a component-library-heavy console:

- **Compound components break across the boundary.** "A Server Component that imports a Client
  Component receives a client reference instead of the function. As a result, `Menu.Item` is
  `undefined`, and React throws 'Element type is invalid.'" The fix is named exports rather than
  static properties — which matters because `Menu.Item` / `Tabs.Panel` is exactly the idiom
  shadcn-style kits use.
- **A Server Function is not type-distinguishable from a plain function.** "The TypeScript plugin
  allows a Client Component prop typed as a function when its name is `action` or ends in `Action`.
  The plugin flags other function props." So the boundary is partly enforced by a *naming
  convention*, not by the type system.

### 2.2 `'use client'` is viral downward, and that is the actual ergonomic cost

From <https://nextjs.org/docs/app/getting-started/server-and-client-components> (v16.3.1, updated
2026-08-11):

> "Once a file is marked with `'use client'`, **all of its imports and the components it directly
> renders are included in the client bundle**. This means you don't need to add the directive to
> every component that is intended for the client."

The escape hatch is that Server Components passed *as props* (typically `children`) are not in the
client module graph — they are rendered on the server and the Client Component only ever sees their
output. The docs call this "interleaving", and it is the pattern that makes RSC usable at all in an
interactive app: a `'use client'` shell with server-rendered content slotted in.

For a console like Send Lab, the practical outcome is that most leaf UI is `'use client'` anyway.
The RSC benefit collapses to: (a) data reads happen in Server Components close to the DB with no API
layer, (b) secrets never enter the bundle, (c) the initial payload of a page can be server-rendered.
Those are real, but they are not "the client rewrite gets easier".

**Say it plainly:** for a stateful private console, RSC's headline benefits — smaller JS bundles,
static shells, streaming content pages, SEO — mostly do not apply. There is no SEO surface (private
app), there is no static content to prerender (everything is per-account), and the bundle is
dominated by interactive widgets that must ship anyway. What you get is a *co-location* benefit for
data access, plus a `Suspense`-shaped streaming story. What you pay is the boundary discipline in
§2.1 and the mutation model in §2.4.

### 2.3 Next.js's own answer for client-heavy apps

Next.js maintains an explicit guide for this shape, which is the strongest evidence about what is
supported rather than merely possible:
<https://nextjs.org/docs/app/guides/single-page-applications> (v16.3.1, updated 2026-08-14).

> "Build Single-Page Applications (SPAs) with client-side navigation and data fetching. Next.js
> supports client and server patterns in the same app… Next.js can start as a static site or even a
> strict SPA where everything is rendered client-side."

The sanctioned patterns for a stateful console:

1. **Start the promise on the server, unwrap it on the client.** A Server Component (often the
   layout) calls a data function *without awaiting*, passes the promise into a `'use client'` context
   provider, and Client Components read it with `use()` inside a `<Suspense>` boundary. This is the
   documented way to get server data into a client-state-heavy tree without a fetch waterfall.
   Caveat the docs give: "Refetching a Promise set high in the tree re-runs the Server Component that
   set it, so for data only part of the app needs, place the provider on that subtree instead of the
   root layout."
2. **Browser-only components** via `dynamic(() => import('./component'), { ssr: false })` — note
   that since v15, `ssr: false` with `next/dynamic` is disallowed inside Server Components, so this
   lives in a Client Component.
3. **Shallow routing** with native `window.history.pushState` / `replaceState`, which "integrate
   into the Next.js Router, allowing you to sync with `usePathname` and `useSearchParams`". This is
   how you keep ephemeral view state in the URL without a server round trip.
4. **A client data-fetching library when you need more.**
   <https://nextjs.org/docs/app/guides/client-side-data-fetching> (v16.3.1, updated 2026-08-11):
   "Use a client data-fetching library such as SWR, TanStack Query, or Apollo Client when Client
   Components need a shared browser cache… focus revalidation, interval polling, request
   deduplication, or optimistic updates across components." There are dedicated official sub-guides
   for SWR and TanStack Query. This is a *documented, supported* path, not a workaround — which
   matters because it is the closest analogue to how the current Svelte app manages state.

   The same page is candid about the cost: with Cache Components on, **three** cache layers can hold
   the same data (Next server cache, Next client cache, the library's own cache) and "cache
   identities and mutation invalidation must stay coordinated across layers".

### 2.4 Server Actions: the real constraints

From <https://nextjs.org/docs/app/guides/server-actions> (v16.3.1, updated 2026-06-17). These are
the constraints that matter for a console with many small mutations, and they are not in the pitch:

- **Actions are dispatched one at a time, per client.** Verbatim: "Next.js dispatches Server Actions
  one at a time per client. If a user triggers three actions in quick succession, the second waits
  for the first to finish, then the third waits for the second." And: "do not rely on `Promise.all`
  to parallelize Server Actions from the client. If you need parallel work, do it inside a single
  Server Action… or use a Route Handler for non-mutation requests."

  **This is the single biggest ergonomic hazard for Send Lab.** A training console where an athlete
  ticks off six sets in five seconds would serialize six round trips. The mitigations are all real
  but all work: batch mutations into one action, use `useOptimistic` so the UI does not wait, or move
  writes to a Route Handler and do your own client-side coordination.
- **Every action is a public POST endpoint.** "the route is reachable to anyone who can send the same
  POST. Treat every action as an untrusted entry point." Framework protections: an `Origin` vs
  `Host` CSRF check, a **1 MB default body-size limit** (`serverActions.bodySizeLimit`), encrypted
  non-deterministic action IDs, dead-code elimination of unused actions, and encryption of
  closed-over variables.
- **Page-level auth does not protect an action.** From
  <https://nextjs.org/docs/app/guides/data-security> (v16.3.1, updated 2026-08-10): "A page-level
  authentication check does not extend to the Server Actions defined within it. Always re-verify
  inside the action." And "Render-time gating (only rendering a form on an authenticated page) is not
  a security boundary."
- **Deployment skew breaks in-flight actions.** "New deployments typically generate new IDs
  (Next.js rotates them at most every 14 days, even when the source is unchanged), so a client still
  running the previous build may invoke an action ID that no longer exists. The error surfaces as
  'Failed to find Server Action'." Mitigations the docs give: rolling deploys, a stable
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, and surfacing the error as a retry in the UI. For a 5-account
  alpha this is cosmetic; note it so it is not a surprise later.
- **What you gain:** one round trip carries both the action's return value and a freshly rendered RSC
  payload for the current route, when the action calls `updateTag`, `revalidatePath`, `refresh`,
  `redirect`, or mutates cookies. "The mutation, the cache invalidation, and the page re-render all
  complete in a single roundtrip." `revalidateTag` with an SWR profile is the exception and does
  *not* include a re-render.

### 2.5 The interaction toolkit, and its documented rough edges

<https://nextjs.org/docs/app/guides/interactive-apps> (v16.3.1, updated 2026-08-11) is the official
worked example of a stateful board app, and it is unusually honest. The primitives are `<Suspense>`,
`useOptimistic`, `useTransition`, `useActionState`, and a `data-pending` CSS attribute. Rough edges
it documents:

- **`useState` setters are deferred inside a transition**, while `useOptimistic` setters and direct
  DOM calls apply on the current frame. This is a genuine footgun: the naive "call the action, then
  `setIsOpen(false)`" version closes a dialog a frame before the data lands.
- **State updates after `await` are not part of the transition.** Quoted from the guide: "This
  limitation is documented in React under 'React doesn't treat my state update after `await` as a
  transition'. Until it's fixed, wrapping post-`await` state updates in `startTransition` is the
  recommended workaround."
- Every optimistic interaction is hand-written per widget. There is no framework-level "the client
  owns this state" — you write a reducer, share it between the client (`useOptimistic`) and the
  Server Action, and keep them in sync. The SPA guide shows exactly this: a `todosReducer` imported
  by both sides "so the client and server compute the next state identically."

**The comparison that matters.** In today's SvelteKit app, a rest timer or a Train draft is a rune
plus `localStorage`, and a mutation is a direct store write. In the App Router equivalent, the same
widget is a `'use client'` component with `useOptimistic`, a `'use server'` action, a shared
reducer, and a tag to invalidate. That is more machinery for the same behaviour. It buys you
server-authoritative state and read-your-writes semantics — which the current app achieves by
different means. Do not pretend this is free.

**Recommended posture for the rebuild** (a recommendation, not a Next.js requirement): treat the App
Router as a *router plus a backend*, keep pages thin Server Components that read via a Data Access
Layer and hand promises into a client tree, and let the interactive console live in Client Components
with a client-side state library. This uses the parts of the App Router that are strong for this app
(routing, colocated server data access, `proxy.ts`, Route Handlers) and does not fight the parts that
are weak for it (server-authoritative mutation of high-frequency local state). Ticket 06 owns the
actual decision; this is the shape the primary sources support.

---

## 3. Route Handlers (the `+server.ts` analogue)

### 3.1 Convention and the one hard structural rule

`route.ts` (or `.js`) anywhere inside `app/`. Exported function names are the HTTP methods: `GET`,
`POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. An unsupported method returns `405 Method Not
Allowed`; if you do not export `OPTIONS`, Next.js implements it and sets the `Allow` header
(<https://nextjs.org/docs/app/api-reference/file-conventions/route>, v16.3.1).

**Required, and different from SvelteKit:** "There **cannot** be a `route.js` file at the same route
as `page.js`" — "Each `route.js` or `page.js` file takes over all HTTP verbs for that route"
(<https://nextjs.org/docs/app/getting-started/route-handlers>, v16.3.1, updated 2026-03-03).
SvelteKit happily colocates `+page.svelte` and `+server.ts` in one directory; Next.js does not. Route
Handlers also "do **not** participate in layouts or client-side navigations like `page`". So the
rebuild's endpoints need their own path segments (`app/api/...`) rather than sitting next to the page
they serve.

`context.params` is a **Promise** and must be awaited. There is a globally available generated type,
no import needed:

```ts
export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
  const { id } = await ctx.params
}
```

Types are generated by `next dev`, `next build`, or `next typegen` — worth knowing for the quality
gate in ticket 09, since a clean checkout has no types until one of those runs (much like
`svelte-kit sync` today).

### 3.2 Request/Response types: Web standard, and `NextRequest` is optional

The docs lead with plain Web APIs: "Route Handlers allow you to create custom request handlers for a
given route using the Web `Request` and `Response` APIs", and the first example is
`export async function GET() { return Response.json({...}) }` with no Next.js imports.

What Next.js actually passes in is a `NextRequest` — "an extension of the Web `Request` API" that adds
`cookies` and a parsed `nextUrl`. You can type the parameter as plain `Request` and it still works;
the docs do this in several examples on the same page. `NextResponse` similarly adds `redirect`,
`rewrite`, `next` and `cookies` helpers.

**Verdict: `NextRequest`/`NextResponse` are conveniences, not requirements.** Endpoints can be written
against Web standards, which keeps them portable and testable — relevant for the MCP endpoint, and
for ticket 09's test strategy.

One removal to note: `NextRequest.geo` and `.ip` were **removed in v15**. On Vercel, use
`geolocation` / `ipAddress` from `@vercel/functions`
(<https://nextjs.org/docs/app/guides/upgrading/version-15>).

### 3.3 Streaming

Streaming is a plain `ReadableStream` handed to `new Response(...)`. From
<https://nextjs.org/docs/app/guides/streaming> (v16.3.1): "Outside of React rendering, Route Handlers
can stream raw responses using the Web Streams API. This is useful for Server-Sent Events, large file
generation, or any response where you want data to arrive progressively."

```ts
export async function GET() {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        controller.enqueue(encoder.encode(`Chunk ${i + 1}\n`))
        await new Promise((r) => setTimeout(r, 200))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  })
}
```

**Documented caveats that matter for an MCP endpoint:**

- **You cannot change the status or headers once streaming starts.** Verbatim: "Once streaming begins,
  the HTTP response headers (including the status code) have already been sent to the client. **You
  cannot change the status code or headers after streaming starts.**" So auth must be verified and a
  401 emitted *before* the stream is returned.
- "**Vercel supports streaming natively**" (unlike AWS Lambda, which needs response streaming mode
  enabled explicitly).
- Buffering hazards the docs list: Nginx-class reverse proxies buffer by default (set
  `X-Accel-Buffering: no`), CDNs may buffer whole responses, gzip/Brotli buffer chunks internally,
  and "Safari/WebKit buffers streaming responses until 1024 bytes have been received".
- Vercel's function duration ceiling applies to streams: see §6.

> **Stale doc warning.** The `route.js` API reference's streaming example still imports
> `StreamingTextResponse` from `ai`, an export removed from the AI SDK some time ago. The Streaming
> guide's raw `ReadableStream` form is the one to copy. Both pages are stamped v16.3.1 — a reminder
> that "it's in the docs" is not the same as "it currently works".

### 3.4 Runtime selection: don't. The edge runtime is deprecated.

- Default is **`'nodejs'`**
  (<https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config>, v16.3.1). The
  options table reads `runtime: 'nodejs' | 'edge' (deprecated)`.
- The dedicated page is blunt: "**The Edge Runtime is deprecated. Remove the `runtime` export from
  your route files.**"
  (<https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime>). The
  error page adds: "The Node.js runtime is the default, so no replacement is needed. This applies to
  all route files that support the `runtime` segment config: `page.ts`, `layout.ts`, `route.ts`, and
  API routes." (<https://nextjs.org/docs/messages/edge-runtime-deprecated>)
- Cache Components requires Node: "Cache Components requires the Node.js runtime. Migrate any routes
  that set the deprecated `runtime = 'edge'` export, and note that other server-side JavaScript
  runtimes are not guaranteed to work."
  (<https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents>)

This is a simplification versus `@sveltejs/adapter-vercel`, where you pick `runtime: 'nodejs22.x'` or
`'edge'` per route. In Next 16 there is one answer: Node, by omission.

### 3.5 Caching defaults for Route Handlers

**Without Cache Components (the default in 16):** "Route Handlers are not cached by default. You can,
however, opt into caching for `GET` methods. Other supported HTTP methods are **not** cached… **Good
to know**: Other supported HTTP methods are **not** cached, even if they are placed alongside a `GET`
method that is cached, in the same file."
(<https://nextjs.org/docs/app/getting-started/route-handlers>, v16.3.1)

This is the v15 change: `route.js`'s own version history records `v15.0.0-RC` — "The default caching
for `GET` handlers was changed from static to dynamic." In Next 14 a `GET` handler was cached unless
it touched something dynamic, which is exactly the default that would have leaked athlete data.

**Is `dynamic = 'force-dynamic'` still needed?** No, not for correctness. Handlers are already
uncached. It remains available (and is what forces `fetchCache = 'force-no-store'`), so it is
reasonable as a defensive assertion — but it is belt-and-braces, not a requirement.

**With `cacheComponents: true`, the default changes and this is a sharp edge.** "`GET` Route Handlers
follow the same model as normal UI routes in your application. They run at request time by default,
**can be prerendered when they don't access uncached or runtime data**, and you can use `use cache` to
include uncached data in the static response." Prerendering "stops if the `GET` handler accesses
network requests, database queries, async file system operations, request object properties (like
`req.url`, `request.headers`, `request.cookies`, `request.body`), runtime APIs like `cookies()`,
`headers()`, `connection()`, or non-deterministic operations."

So under Cache Components, a `GET` handler that forgets to read the session gets **baked into the
build output**. Also: "`use cache` cannot be used directly inside a Route Handler body; extract it to a
helper function."

**Segment config that applies to `route.ts`** (from
<https://nextjs.org/docs/app/guides/caching-without-cache-components>, v16.3.1; these three are
**removed** when Cache Components is enabled):

- `dynamic`: `'auto'` (default) | `'force-dynamic'` | `'error'` | `'force-static'`.
  ⚠️ **`'force-static'` is dangerous on an authenticated route**: it forces "`cookies`, `headers()` and
  `useSearchParams()` to return **empty values**". An auth check written against `cookies()` silently
  becomes "no session". Never use it in Send Lab.
- `revalidate`: `false` (default, ≈ `Infinity`) | `0` | number. Must be statically analyzable —
  `60 * 10` is invalid. "The lowest `revalidate` across each layout and page of a single route will
  determine the revalidation frequency of the *entire* route."
- `fetchCache`: advanced; the docs say it "should only be used if you specifically need to override
  the default behavior".
- Still live in both models: `runtime`, `maxDuration` ("Set by deployment platform"), `dynamicParams`.
  `preferredRegion` is **deprecated**. New in 16: `instant` and `prefetch`.

> **Doc inconsistency.** The route-segment-config index table in v16.3.1 lists only `dynamicParams`,
> `runtime`, `preferredRegion`, `maxDuration`, having moved `dynamic` / `revalidate` / `fetchCache` out
> to the "caching without Cache Components" guide — but the `route.js` API reference still shows all of
> them. Prefer the guide.

### 3.6 `cookies()` and `headers()` are async, mandatorily

Next 15 made them async with a temporary sync escape hatch. Next 16 removed it: "Starting with
**Next.js 16**, synchronous access is fully removed. These APIs can only be accessed asynchronously."
(<https://nextjs.org/docs/app/guides/upgrading/version-16>). Applies to `cookies`, `headers`,
`draftMode`, `params`, `searchParams`.

In a handler: `const cookieStore = await cookies()` gives `.get/.set/.delete`. `await headers()` is
**read-only** — "To set headers, you need to return a new `Response` with new `headers`." Or read off
the request directly: `request.cookies.get('token')`.

---

## 4. `proxy.ts` — the `hooks.server.ts` analogue

**Read this section carefully: it is the one area where almost everything written before October 2025
is wrong.** Middleware was renamed, moved to Node.js, and the docs now actively discourage using it.
Any tutorial, StackOverflow answer or LLM recollection that says `middleware.ts` predates Next 16.

### 4.1 It is called `proxy.ts` now, and `middleware.ts` is deprecated

> "**Note**: The `middleware` file convention is deprecated and has been renamed to `proxy`."
> Version history: `v16.0.0` — "Middleware is deprecated and renamed to Proxy. Proxy defaults to the
> Node.js runtime"
> — <https://nextjs.org/docs/app/api-reference/file-conventions/proxy> (v16.3.1, updated 2026-08-04)

The v16 release post adds: "The `middleware.ts` file is still available for Edge runtime use cases, but
it is deprecated and will be removed in a future version." Codemod:
`npx @next/codemod@canary middleware-to-proxy .`

Mechanics (all required):

- One file, `proxy.ts|js`, at project root or in `src/`, at the same level as `app/`.
- "The file must export a single function, either as a default export or named `proxy`. Note that
  multiple proxy from the same file are not supported." **One proxy per project** — there is no
  `sequence()` composition helper the way SvelteKit's `hooks.server.ts` has for `handle`.
- Signature `proxy(request: NextRequest, event: NextFetchEvent)`; a `NextProxy` type is exported.
- Renamed config flags: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`.

**Why they renamed it — worth quoting, because it is a statement of intent about how much to lean on
this file:**

> "The reason behind the renaming of `middleware` is that the term 'middleware' can often be confused
> with Express.js middleware… Also, Middleware is highly capable, so it may encourage the usage;
> however, **this feature is recommended to be used as a last resort**."
>
> "**We recommend users avoid relying on Middleware unless no other options exist.**"

This is a direct mismatch with how `hooks.server.ts` is used in Send Lab today — as the natural home
for auth and CSRF on every request. Next.js's position is that this file should do as little as
possible.

### 4.2 Runtime: Node.js, stable, and not configurable

Timeline from the proxy reference's own version history: `v15.2.0` Node.js runtime experimental →
`v15.5.0` stable → `v16.0.0` "Proxy defaults to the Node.js runtime".

In v16.3.1: "Proxy defaults to using the Node.js runtime. The `runtime` config option is **not
available** in Proxy. **Setting the `runtime` config option in Proxy will throw an error.**"

The auth guide reinforces the practical consequence: "Proxy uses the Node.js runtime, check if your
Auth library and session management library are compatible."
(<https://nextjs.org/docs/app/guides/authentication>, v16.3.1). This is *good news* for the rebuild —
better-auth and a libSQL client are Node libraries, and the old edge-middleware constraint (no Node
APIs, no DB drivers) is gone.

> **Doc conflict, flagged.** The v16 upgrade guide says: "The `edge` runtime is **NOT** supported in
> `proxy`. The `proxy` runtime is `nodejs`, and it cannot be configured. **If you want to continue
> using the `edge` runtime, keep using `middleware`.** We will follow up on a minor release with
> further `edge` runtime instructions."
> (<https://nextjs.org/docs/app/guides/upgrading/version-16>). The proxy reference page presents
> Node-only as settled and says nothing about an escape hatch, and the promised minor-release guidance
> is not present in the 16.3.1 docs. Prefer the reference page: write `proxy.ts`, Node runtime, and do
> not build on `middleware.ts`. Irrelevant for Send Lab either way — we want Node.

### 4.3 Matcher, and the defaults that bite

- **With no `matcher`, proxy runs on every request** — "including static files (`_next/static`), image
  optimizations (`_next/image`), and assets in the `public/` folder. Consider using a negative match
  pattern to exclude these paths, **otherwise auth logic or redirects can unintentionally block CSS,
  JS, or images from loading**."
- Matcher values "need to be constants so they can be statically analyzed at build-time. Dynamic
  values such as variables will be ignored." So you cannot build the matcher from a config object.
- Object form supports `source`, `locale`, `has`, `missing`.
- A deliberate safety default: "Even when `_next/data` is excluded in a negative matcher pattern, proxy
  will still be invoked for `_next/data` routes. This is intentional behavior to prevent accidental
  security issues where you might protect a page but forget to protect the corresponding data route."

**The Server Function gap is the most dangerous documented behaviour here:**

> "Server Functions are not separate routes in this chain. They are handled as POST requests to the
> route where they are used, so a Proxy matcher that excludes a path will also skip Proxy coverage on
> that path. A matcher change or a refactor that moves a Server Function to a different route can
> silently remove Proxy coverage. **Always verify authentication and authorization inside each Server
> Function rather than relying on Proxy alone.**"

### 4.4 What it can and cannot do

| Can | Cannot |
| --- | --- |
| Redirect (`NextResponse.redirect`) | Set `runtime` (throws) |
| Rewrite (`NextResponse.rewrite`) | Be used with `output: 'export'` |
| Respond directly (return a `Response`, since 13.1) | Rely on shared modules or globals |
| Read/set cookies (`request.cookies`, `response.cookies`) | Cache `fetch` results |
| Forward request headers upstream via `NextResponse.next({ request: { headers } })` | Read the request body (undocumented) |
| Background work via `event.waitUntil(promise)` | Do slow data fetching |

The constraints, in the docs' own words:

- "Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your
  CDN for fast redirect/rewrite handling, **you should not attempt relying on shared modules or
  globals**." Pass data via headers, cookies, rewrites, redirects or the URL.
- "Using fetch with `options.cache`, `options.next.revalidate`, or `options.next.tags`, **has no effect
  in Proxy**." (<https://nextjs.org/docs/app/getting-started/proxy>)
- "Proxy is *not* intended for slow data fetching."
- **Request body reading is not documented.** `NextRequest` is a Web `Request`, so `.json()`/`.text()`
  exist mechanically, but there is no documented support and the "network boundary / CDN-deployable /
  no shared modules" framing argues against it. Treat it as unsupported. (Note: the old edge-era
  **1 MB bundle-size limit no longer appears anywhere in the v16.3.1 docs** — it seems to have gone
  with the move to Node, but there is no positive statement replacing it, so no new number can be
  quoted.)
- RSC subtlety: "During RSC requests, Next.js strips internal Flight headers from the `request`
  instance in Proxy. For example, headers like `rsc`, `next-router-state-tree`, and
  `next-router-prefetch` are not exposed through `request.headers`."
- "Avoid setting large headers as it might cause 431 Request Header Fields Too Large."
- Execution order: `next.config` headers → `next.config` redirects → **Proxy** → `beforeFiles`
  rewrites → filesystem routes → `afterFiles` → dynamic routes → `fallback`.
- Testing helpers exist: `unstable_doesProxyMatch`, `isRewrite`, `getRewrittenUrl` from
  `next/experimental/testing/server` (experimental since 15.1) — relevant to ticket 09.
- On Vercel: "Deployment Protection requires authentication for all requests, **including those to
  Routing Middleware**" (<https://vercel.com/docs/deployment-protection>) — i.e. a
  protection-blocked request never reaches `proxy.ts`.

### 4.5 Auth in proxy: the official guidance, and it is a caution

This is the passage that should drive the rebuild's auth architecture. From
<https://nextjs.org/docs/app/guides/authentication> (v16.3.1, updated 2026-08-13), in a section
literally titled "Optimistic checks with Proxy (Optional)":

> "**Optimistic**: Checks if the user is authorized… using the session data stored in the cookie.
> These checks are useful for quick operations, such as showing/hiding UI elements or redirecting
> users based on permissions or roles.
> **Secure**: Checks if the user is authorized… using the session data stored in the database."

> "However, since Proxy runs on every route, including prefetched routes, it's important to **only read
> the session from the cookie (optimistic checks), and avoid database checks** to prevent performance
> issues."

> "**While Proxy can be useful for initial checks, it should not be your only line of defense in
> protecting your data. The majority of security checks should be performed as close as possible to
> your data source.**"

And from <https://nextjs.org/docs/app/getting-started/proxy>: "While Proxy can be helpful for
optimistic checks such as permission-based redirects, **it should not be used as a full session
management or authorization solution**."

The data-security guide's audit checklist adds: "**`proxy.ts` and `route.ts`:** Have a lot of power.
Spend extra time auditing these using traditional techniques."

**On CVE-2025-29927 (the middleware bypass).** The v16.3.1 docs never name the CVE — the
"optimistic-only" guidance is presented as doctrine, not as a post-incident patch. The primary source
is Vercel's postmortem, <https://vercel.com/blog/postmortem-on-next-js-middleware-bypass>:

- Mechanism: "Next.js uses an internal `x-middleware-subrequest` header to detect and prevent
  recursion—and bypass the execution of Middleware." An attacker-supplied header caused middleware to
  be skipped entirely, i.e. total authorization bypass. CVSS 9.1.
- Fixed in 15.2.3, 14.2.25, 13.5.9, 12.3.5. Vercel-hosted apps were incidentally unaffected because
  "The Next.js routing logic is decoupled and runs in a separate system".
- Explicit recommendation: "**We do not recommend Middleware to be the sole method of protecting routes
  in your application.**"

Send Lab is on Vercel and would have been unaffected, but the lesson stands and it is now baked into
the docs.

### 4.6 What this means for the `hooks.server.ts` migration

`hooks.server.ts` today does auth and CSRF for every request in one place. The Next.js equivalent is
**not** one file — it is a split, and the docs are prescriptive about it:

| Today (`hooks.server.ts`) | Next 16.3 |
| --- | --- |
| Session resolution on every request | `proxy.ts` reads the **cookie only** for optimistic redirects; real resolution lives in a `server-only` Data Access Layer memoized with `React.cache` |
| Authorization | Inside the DAL, re-verified in **every** Server Action and **every** Route Handler |
| CSRF | Built in for Server Actions (`Origin` vs `Host`, configurable via `serverActions.allowedOrigins`). Route Handlers get **nothing** — you write your own if a handler mutates state |
| One composable chain | One non-composable `proxy` function |

Two further documented traps for anyone reaching for a layout instead:

- "Due to Partial Rendering, be cautious when doing checks in Layouts as these don't re-render on
  navigation, meaning the user session won't be checked on every route change."
- "A layout also does not control whether the rest of the route renders. Route segments and parallel
  route slots are rendered by the router, so a layout that hides or swaps them does not stop them from
  running or from appearing in the RSC Payload."
- "A common pattern in SPAs is to `return null` in a layout or a top-level component if a user is not
  authorized. This pattern is **not recommended**."

**Honest cost.** Auth becomes more diffuse than it is today: one hook becomes a proxy + a DAL + a
per-action/per-handler check. That is more surface, and the docs' own framing is that the safety comes
from repetition, not from a single choke point. Ticket 03 owns the better-auth decision; this is the
shape it has to fit.

---

## 5. Tailwind CSS 4 with Next.js, and what carries over

Verified Tailwind CSS stable: **4.3.3** (`https://registry.npmjs.org/tailwindcss/latest`, 2026-08-15).
Send Lab is on `^4.3.1`, so this is a patch bump, not a migration.

### 5.1 The required setup change: PostCSS, not the Vite plugin

**`@tailwindcss/vite` must be dropped. There is no Vite path in Next.js.**

- Tailwind's Vite guide: "Installing Tailwind CSS as a Vite plugin is the most seamless way to integrate
  it with frameworks like **Laravel, SvelteKit, React Router, Nuxt, and SolidJS**"
  (<https://tailwindcss.com/docs/installation/using-vite>). Next.js is not in that list.
  `@tailwindcss/vite@4.3.3` peer-depends on Vite, and Next 16 has no Vite mode.
- Tailwind's PostCSS guide: "Installing Tailwind CSS as a PostCSS plugin is the most seamless way to
  integrate it with frameworks like **Next.js** and Angular"
  (<https://tailwindcss.com/docs/installation/using-postcss>).

The documented Next.js setup (<https://tailwindcss.com/docs/installation/framework-guides/nextjs>,
page labelled v4.3):

```
npm install tailwindcss @tailwindcss/postcss postcss
```

```js
// postcss.config.mjs
const config = { plugins: { '@tailwindcss/postcss': {} } }
export default config
```

```css
/* app/globals.css */
@import 'tailwindcss';
```

Next.js's own CSS page agrees and is the more current source (`version: 16.3.1`,
`lastUpdated: 2026-03-20`): `pnpm add -D tailwindcss @tailwindcss/postcss`
(<https://nextjs.org/docs/app/getting-started/css>).

> **Minor docs disagreement.** tailwindcss.com installs three packages as runtime deps
> (`tailwindcss @tailwindcss/postcss postcss`); Next.js's page installs two as **dev** deps and omits
> the standalone `postcss` package. Prefer the Next.js page — it is newer, and Next bundles its own
> PostCSS. Send Lab already keeps Tailwind in `devDependencies`, which matches.

**Does Turbopack change the story? No.** PostCSS works under Turbopack, and Turbopack explicitly
supports it: PostCSS configs "run in a Node.js worker pool. Useful for Tailwind, Autoprefixer, etc."
(<https://nextjs.org/docs/app/api-reference/turbopack>, v16.3.1). 16.2 added `postcss.config.ts`
support (<https://nextjs.org/blog/next-16-2-turbopack>); 16.3 added experimental
`turbopackLocalPostcssConfig` for monorepos.

**Two faster paths exist; neither is the documented one yet.**

| Package | Version | Status |
| --- | --- | --- |
| `@tailwindcss/postcss` | 4.3.3 | **The documented path for Next.** Use this. |
| `@tailwindcss/webpack` | 4.3.3 | Added in Tailwind 4.2. Tailwind's blog (2026-05-08, <https://tailwindcss.com/blog/tailwindcss-v4-3>): "Because Turbopack supports webpack loaders through its compatibility layer, these improvements carry over there too, which is a big deal for frameworks like Next.js where Turbopack is becoming the default." Benchmarked on Tailwind's own docs site with Next + Turbopack: 932 ms → 429 ms (**2.17×**). |
| `@tailwindcss/turbopack` | 4.3.3 | Published, "A Turbopack loader for Tailwind CSS v4." Wired via `next.config.js` → `turbopack.rules['*.css']`. **Not in any Tailwind install guide and not in stable `create-next-app`** — but `create-next-app` on `canary` already selects it when the bundler is Turbopack. Treat as "coming"; ship on PostCSS. |

### 5.2 `create-next-app` scaffolds Tailwind 4, CSS-first, by default

<https://nextjs.org/docs/app/api-reference/cli/create-next-app> (v16.3.1, updated 2026-08-10):
`--tailwind` is documented as "Initialize with Tailwind CSS config (**default**)", and the recommended
defaults prompt reads "TypeScript, ESLint, Tailwind CSS, App Router, AGENTS.md".

What it generates: `"tailwindcss": "^4"` + `"@tailwindcss/postcss": "^4"`, a `postcss.config.mjs`, and
**no `tailwind.config.js`/`.ts` at all**. `app/globals.css` is `@import "tailwindcss";` followed by
`:root` custom properties and an `@theme inline { --color-background: var(--background); … }` block,
plus a `prefers-color-scheme: dark` override.

**That is structurally the same pattern `src/app.css` already uses.**

### 5.3 The config model is unchanged 4.0 → 4.3, and it is framework-agnostic

- CSS-first is the model. From <https://tailwindcss.com/docs/theme>: "Theme variables aren't just CSS
  variables — they also instruct Tailwind to create new utility classes"; "Use `@theme` when you want a
  design token to map directly to a utility class, and use `:root` for defining regular CSS variables
  that shouldn't have corresponding utility classes." No JS config appears on that page.
- **`@config` and `@plugin` still work but are explicitly legacy.** They live under a "Compatibility"
  section of <https://tailwindcss.com/docs/functions-and-directives> that exists "solely for
  compatibility with Tailwind CSS v3.x": `@config` loads "a legacy JavaScript-based configuration
  file", `@plugin` loads "a legacy JavaScript-based plugin". Caveat quoted there: "The `corePlugins`,
  `safelist`, and `separator` options from the JavaScript-based config are not supported in v4.0."

**Concretely, for Send Lab: `src/app.css` is 110 lines of pure CSS and carries over verbatim.** Its
contents are `@import 'tailwindcss'`, `@import 'tw-animate-css'`, `@plugin 'tailwindcss-motion'`,
`@custom-variant dark (&:is(.dark *))`, a `:root` block of raw palette values mapped to shadcn semantic
tokens, and an `@theme inline` block. None of that is framework-coupled. The only two changes are:

1. **How it is compiled** — `@tailwindcss/vite` in `vite.config.ts` becomes `@tailwindcss/postcss` in
   `postcss.config.mjs`.
2. **How it is imported** — `+layout.svelte` becomes `app/layout.tsx`.

### 5.4 Per-package carry-over verdict

| Current (Svelte) | Installed | React target | Current version | Verdict |
| --- | --- | --- | --- | --- |
| `tailwindcss` | ^4.3.1 | same | **4.3.3** | ✅ Carries over. Swap the build plugin (§5.1). |
| `tailwind-merge` | ^3.6.0 | same | **3.6.0** | ✅ Framework-agnostic, zero runtime deps, already current. |
| `tailwind-variants` | ^3.2.2 | same | **3.3.1** | ✅ Works in React. Docs say "Framework agnostic" and "Tailwind CSS v4 support"; quick-start shows `className={button({ color: 'primary' })}`. ⚠️ Not a React issue, but note: "Tailwind CSS v4 no longer supports `config.content.transform`, so responsive variants were removed." Also `tailwind-merge` is now bundled — "Conflict resolution is included in the default build." |
| `tw-animate-css` | ^1.4.0 | same | **1.4.0** | ✅ **Pure CSS**, no deps, exports only two `.css` files. Used by shadcn/ui itself. Carries over unchanged. |
| `tailwindcss-motion` | ^1.1.1 | same | **1.1.1** | ⚠️ **The weakest link — see below.** |
| `clsx` | ^2.1.1 | same | **2.1.1** | ✅ Trivial, already current. |
| `@lucide/svelte` | 1.31.0 | `lucide-react` | **1.31.0** | ✅ Exact version parity (same monorepo). Peer allows React 19. Icon names identical; only the import path changes. |
| `mode-watcher` | 1.1.0 | `next-themes` | **0.4.6** | ⚠️ Works, but **worse ergonomics** — see below. |
| `svelte-sonner` | 1.2.1 | `sonner` | **2.0.8** | ✅ Upstream original, ahead of the Svelte port. Peers `react ^18 \|\| ^19`. |
| `bits-ui` | 2.18.1 | Base UI / Radix | see §5.5 | ⚠️ **No code-level carry-over. Genuine rewrite work.** |
| — | — | `class-variance-authority` | **0.7.1** | Needed if you consume shadcn/ui React components verbatim (§5.5). |

**`tailwindcss-motion` — the one dependency that is a real risk.** It is framework-agnostic (so React is
not the problem), and it *does* still resolve on Tailwind 4.3.3: the shipped code imports
`tailwindcss/plugin.js` and `tailwindcss/lib/util/flattenColorPalette.js`, and both paths remain in
`tailwindcss@4.3.3`'s `exports` map. But it is a **legacy JS plugin** loaded through the v3-compat
`@plugin` directive, last published **2025-06-10** (14 months stale), with no v4 section in its README
and the GitHub issue "Tailwind v4 support?" (<https://github.com/romboHQ/tailwindcss-motion/issues/40>,
opened 2025-01-29) **still open**. The risk is Tailwind-version drift, not the rebuild. Options:
replace its usages with `tw-animate-css` plus hand-written `@theme`/`@utility` keyframes, or carry it
as a pinned, documented risk. A greenfield rebuild is the cheapest moment to drop it.

**`next-themes` is a downgrade from `mode-watcher`.** It works with the App Router but needs a client
boundary you own. Its README states "Note that `ThemeProvider` is a client component, not a server
component", and `suppressHydrationWarning` is required on `<html>` because "next-themes updates that
element". shadcn's canonical wiring (<https://ui.shadcn.com/docs/dark-mode/next>) is a
`components/theme-provider.tsx` that starts with `'use client'` and re-exports `NextThemesProvider`,
then `<html lang="en" suppressHydrationWarning>` in the root layout. It is also still a 0.x package
(0.4.6). This is a small, concrete example of the RSC boundary tax from §2.

### 5.5 The primitive layer is where the real work is

**`bits-ui` → Base UI or Radix is a rewrite, not a swap.** shadcn-svelte components are not
code-compatible with shadcn/ui React components; the primitive APIs differ, which is exactly why
shadcn maintains separate registries per backend.

Current state of the React primitive libraries:

| Package | Version | Notes |
| --- | --- | --- |
| `radix-ui` (unified) | **1.6.7** | The current shape. shadcn changelog 2026-02 (<https://ui.shadcn.com/docs/changelog/2026-02-radix-ui>): the style "now uses the unified `radix-ui` package instead of individual `@radix-ui/react-*` packages"; `import * as DialogPrimitive from '@radix-ui/react-dialog'` → `import { Dialog as DialogPrimitive } from 'radix-ui'`. Migration: `pnpm dlx shadcn@latest migrate radix`. |
| `@radix-ui/react-*` (scoped) | e.g. `@radix-ui/react-dialog` **1.1.23** | Still published, **not deprecated**, but the old style. |
| `@base-ui/react` | **1.7.0** | ✅ The correct, current package (<https://base-ui.com/react/overview/quick-start>). |
| `@base-ui-components/react` | **1.0.0-rc.0** | 🚩 **Deprecated — renamed to `@base-ui/react`.** The npm registry carries the deprecation notice. Do not install this name; older tutorials still use it. |

**shadcn/ui (React) status.** The CLI is `shadcn@4.18.0`, with changelog entries as recent as
**August 2026** (<https://ui.shadcn.com/docs/changelog>). Tailwind 4 + React 19 have been supported
since Feb 2025 (<https://ui.shadcn.com/docs/tailwind-v4>): every primitive gained a `data-slot`
attribute, `React.forwardRef` was dropped for plain function components, `tailwindcss-animate` was
deprecated in favour of `tw-animate-css`, and "HSL colors are now converted to OKLCH". No Next 16
version gate is documented; `shadcn init -t next` is a first-class template.

**Which primitives it ships on today: Base UI is now the default.** From
<https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default>: "New projects now use Base UI by
default. Radix is still fully supported." Opt back into Radix with `shadcn init -b radix`. Radix "is
not deprecated"; React Aria is a third option added July 2026.

**`components.json` has changed shape.** The authority is <https://ui.shadcn.com/schema.json>; the prose
page (<https://ui.shadcn.com/docs/components-json>) is behind — it still shows
`"tailwind": { "config": "tailwind.config.js" }`. Current properties: `style`, `tailwind{config, css,
baseColor, cssVariables, prefix}`, `rsc`, `tsx`, `iconLibrary`, `aliases{utils, components, ui, lib,
hooks}`, `menuColor`, `menuAccent`, `rtl`, `registries`. `style` is now `{base}-{theme}` —
`radix-|base-|aria-` × `vega|nova|maia|lyra|mira|luma|sera|rhea`, where "Vega – The classic shadcn/ui
look". For Tailwind 4, the docs say of `tailwind.config`: "For Tailwind CSS v4, leave this blank."
Send Lab's existing `components.json` (shadcn-svelte schema, `baseColor: slate`, `$lib` aliases) is
replaced, not ported.

**`cva` vs `tailwind-variants`.** shadcn/ui React generates code using **`cva`**, not
`tailwind-variants` — both `base-vega/button.json` and `new-york/button.json` in the live registry
contain `import { cva, type VariantProps } from 'class-variance-authority'`. So if you adopt shadcn/ui
components verbatim you inherit `cva@0.7.1`, and keeping `tailwind-variants@3.3.1` for hand-written
components means **two variant systems in one tree**. Pick one. Both are framework-agnostic; `tv` is the
more capable, `cva` is what the generated code uses. Ticket 08 owns this.

**Theming carries over near-verbatim.** <https://ui.shadcn.com/docs/theming>: "We use and recommend CSS
variables for theming", with `:root` + `.dark` blocks in oklch mapped through `@theme inline`. The token
names are the same ones shadcn-svelte uses — `background/foreground`, `card`, `popover`, `primary`,
`secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1..5`, `sidebar*`,
`radius` (+ `radius-sm..4xl`). Send Lab's token file transfers with additions at most.

### 5.6 Summary of §5

**Carries over unchanged (pure CSS or framework-agnostic JS):** the whole of `src/app.css`,
`tailwindcss`, `tailwind-merge`, `tailwind-variants`, `tw-animate-css`, `clsx`.

**Required changes:** `@tailwindcss/vite` → `@tailwindcss/postcss` + `postcss.config.mjs`;
`@lucide/svelte` → `lucide-react`; `svelte-sonner` → `sonner`; `mode-watcher` → `next-themes` plus a
`'use client'` wrapper; `components.json` replaced.

**Real work:** `bits-ui` → Base UI (or Radix) is a component rewrite. That is also *the point of the
rebuild* — it is the React ecosystem access the map names as the driver — so it is cost that buys the
thing being bought, not incidental churn.

**Two things to fix before anyone installs:** do not install `@base-ui-components/react` (deprecated,
renamed to `@base-ui/react@1.7.0`); and decide `tailwindcss-motion`'s fate rather than carrying an
unmaintained v3-era plugin into a clean slate.

---

## 6. Vercel deployment shape

**Caveat on this whole section.** Vercel's limits are plan-dependent and drift. Every number below was
read on 2026-08-15 and is tagged with the source page's own `last_updated` field. Re-check before
anything depends on a specific figure.

### 6.1 No adapter. Zero-config framework detection.

> "While Next.js works when self-hosting, deploying to Vercel is zero-configuration and provides
> additional enhancements for scalability, availability, and performance globally."
> — <https://vercel.com/docs/frameworks/full-stack/nextjs> (updated 2026-06-26)

Framework detection is automatic; for Next.js, "Vercel checks for the `build` command in `scripts` and
uses this to build the project; if not, `next build` will be triggered as the default Build Command"
(<https://vercel.com/docs/builds/configure-a-build>, 2026-07-15). You can pin it with
`"framework": "nextjs"` in `vercel.json`.

The **Build Output API** (`.vercel/output`) is the filesystem spec adapters target: "It is primarily
targeted toward authors of web frameworks who would like to utilize all of the Vercel platform
features" (<https://vercel.com/docs/build-output-api>, 2026-07-27). `@sveltejs/adapter-vercel` exists
to emit that; for Next.js the build integration is first-party and you install nothing.

Next 16 *does* now have a public adapter API (`experimental.adapterPath`, stable as of 16.2). Next's
deploying page lists Vercel and Bun as "Verified Adapters" and notes Cloudflare and Netlify are
building on it (<https://nextjs.org/docs/app/getting-started/deploying>, v16.3.1, updated 2026-08-06).
Relevant only as an exit option; on Vercel you never touch it.

**Where per-route config moved:**

| Concern | `@sveltejs/adapter-vercel` (today) | Next 16.3 |
| --- | --- | --- |
| Runtime per route | `export const config = { runtime: 'nodejs22.x' }` | **Not selectable.** Node.js only (§3.4) |
| Max duration per route | adapter option / `config.maxDuration` | `export const maxDuration = 5` (route segment config) |
| ISR per route | `config.isr = { expiration, bypassToken, allowQuery }` | No `isr` object. `revalidate` in the pre-Cache-Components model, or `use cache` + `cacheLife`/`cacheTag` |
| Regions, function sizing | adapter options | `vercel.json` (`functions`, `fluid`, `regions`) or dashboard |
| Bundler / build | `svelte.config.js` + `vite.config.ts` | `next.config.ts` |

Settings precedence is documented: **function code > `vercel.json` > dashboard > Fluid defaults**
(<https://vercel.com/docs/fluid-compute>, 2026-07-01).

ISR is the biggest conceptual difference. There is no declarative per-route ISR object; caching is
expressed in code (`revalidate`, or `use cache` + `cacheLife`). For an always-dynamic app that is a
simplification — nothing to configure.

**Gotcha:** `includeFiles` / `excludeFiles` in `vercel.json` are "Not supported in Next.js, instead use
`outputFileTracingIncludes`/`Excludes` in `next.config.js`"
(<https://vercel.com/docs/project-configuration/vercel-json>, 2026-06-17). These are keyed by route
globs and are the fix if a native dependency goes missing from a function bundle.

### 6.2 Function runtimes

Supported Node versions (<https://vercel.com/docs/functions/runtimes/node-js/node-js-versions>,
updated **2026-02-27** — the stalest page behind a load-bearing fact here):

- **24.x (default)**, 22.x, 20.x. "By default, a new project uses the latest Node.js LTS version
  available on Vercel." Only majors are selectable.

Selection is two-tier: the dashboard setting, and **`engines.node` in `package.json` overrides it** —
"when you set the Node.js version to 20.x in the Project Settings and you specify a valid semver range
for Node.js 24 (e.g. `24.x`) in `package.json`, your project will be deployed with the latest 24.x
version."

Note `@sveltejs/adapter-vercel` only offers `'nodejs20.x'` / `'nodejs22.x'`, and its own docs mark the
`runtime` option deprecated. Both ecosystems are converging on "let the platform choose"
(<https://svelte.dev/docs/kit/adapter-vercel>).

**Edge runtime: dead for new work.** From <https://vercel.com/docs/functions/runtimes/edge> (updated
2026-08-03):

> "We recommend migrating from edge to Node.js for improved performance and reliability. Both runtimes
> run on Fluid compute with Active CPU pricing."
>
> "Starting in Next.js 16.3, setting `runtime = 'edge'` is no longer supported. Routes and pages run on
> Node.js."

> **Doc conflict, flagged.** Vercel says "no longer supported" as of 16.3; the Next.js reference says
> "deprecated" and tells you to remove the export. Same practical outcome — never write
> `runtime = 'edge'`. Prefer the Next.js docs' wording, since they own the framework's behaviour.

**Fluid compute is the default.** "As of April 23, 2025, fluid compute is enabled by default for new
projects" (<https://vercel.com/docs/fluid-compute>, 2026-07-01). It gives optimized concurrency
(multiple invocations sharing one instance), `waitUntil` background work, bytecode caching on Node 20+
(production only), cross-AZ/region failover, and error isolation. For a Turso/libSQL-over-HTTP app this
means module-scope clients are genuinely reused across requests — and that the **1,024 file-descriptor
cap is shared across concurrent executions on an instance**, with the docs explicitly calling out
database connections and recommending pooling and cleanup.

### 6.3 Function limits

With Fluid compute enabled (the default). Sources:
<https://vercel.com/docs/functions/limitations> and
<https://vercel.com/docs/functions/configuring-functions/duration>, both updated 2026-07-01.

**Duration:**

| Plan | Default | Maximum | Extended max |
| --- | --- | --- | --- |
| Hobby | 300 s | 300 s | — |
| Pro | 300 s | 800 s | 1800 s (**beta**) |
| Enterprise | 300 s | 800 s | 1800 s (**beta**) |

The 1800 s tier is beta, needs per-function config (project-level defaults above 800 s unsupported),
requires `nodejs20.x`/`22.x`/`24.x`, and is unsupported with Secure Compute / Static IPs. Timeout
returns 504 `FUNCTION_INVOCATION_TIMEOUT`.

**Streaming does *not* bypass the duration limit on Node.js.** Verbatim: max duration "refers to the
longest time a function invocation can run before Vercel terminates it. For request handlers, this
includes time spent processing the request and sending the response, **including streamed
responses**." (The 25-second "must start responding" rule is Edge-only.) For genuinely unbounded work
the docs point at Vercel Workflows, not Functions. **This is the hard ceiling on a long-lived MCP
stream: 300 s on Hobby.**

**Memory / CPU:** Hobby 2 GB / 1 vCPU (also the max). Pro/Enterprise default 2 GB / 1 vCPU, max
4 GB / 2 vCPU. **Memory cannot be set in `vercel.json` when Fluid is enabled** — dashboard only.
`maxDuration` still works in `vercel.json`.

**Body sizes:** "The maximum payload size for the **request body or the response body** of a Vercel
Function is **4.5 MB**." Exceeding it returns 413 `FUNCTION_PAYLOAD_TOO_LARGE`. Note this is separate
from, and larger than, the Server Actions **1 MB** default body limit (§2.4) — the tighter of the two
wins for actions.

**Bundle size:** 250 MB uncompressed; "Large functions" up to 5 GB (needs Fluid + Active CPU,
default-eligible for new projects, gated by `VERCEL_SUPPORT_LARGE_FUNCTIONS`).

**Other:** single region by default (`iad1`), Pro up to 3. Concurrency auto-scales to 30,000
(Hobby/Pro). Build limits: 45-minute max build, container fixed at 8192 MB / 4 CPUs / 32 GB disk
(<https://vercel.com/docs/deployments/troubleshoot-a-build>, 2026-06-15).

**`maxDuration` in Next** is the route segment export, and Vercel documents it directly:
`export const maxDuration = 5` in `app/api/.../route.ts`. Next's reference adds: "for Server Actions,
set the `maxDuration` at the page level to change the default timeout of all Server Actions used on the
page" (<https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration>,
v16.3.1). Project-wide alternative: `vercel.json` globs, e.g.
`{"functions": {"app/api/**/*": {"maxDuration": 5}}}`.

> **Do not carry SvelteKit's numbers across.** `@sveltejs/adapter-vercel`'s docs still quote
> `maxDuration` defaults of "10 s Hobby, 15 s Pro, 900 s Enterprise". Those contradict Vercel's current
> 300 s/800 s under Fluid. The SvelteKit page is the stale one.

### 6.4 Environment variables

**Vercel side** (<https://vercel.com/docs/environment-variables>, updated 2026-06-16). Environments:
Production, Preview, Custom, Development (used by `vercel dev` / `vercel env pull`). Preview vars can be
scoped per branch, and branch-specific values override generic preview values.

The platform rule that matters most: "**Any change you make to environment variables are not applied to
previous deployments, they only apply to new deployments.**" A redeploy is required for *any* var
change, independent of Next's inlining.

Limits: 64 KB total per deployment across all variables; no single variable over 64 KB (5 KB for edge
functions).

**Sensitive environment variables**
(<https://vercel.com/docs/environment-variables/sensitive-environment-variables>, 2026-06-03): values
are "non-readable once created"; only creatable in Production and Preview (not Development); you can
edit the value and environments but **not the key**; making an existing var sensitive means delete and
re-add. Build logs redact sensitive values of ≥32 characters as `[REDACTED]`. Relevant for the Turso
auth token and better-auth secret.

**Next.js side** (<https://nextjs.org/docs/app/guides/environment-variables>, v16.3.1, updated
2026-03-03):

- "Non-`NEXT_PUBLIC_` environment variables are only available in the Node.js environment, meaning they
  aren't accessible to the browser."
- `NEXT_PUBLIC_` is **inlined at build time** — Next "can 'inline' a value, at build time, into the js
  bundle… replacing all references to `process.env.[variable]` with a hard-coded value."
- **The freeze, verbatim:** "After being built, your app will no longer respond to changes to these
  environment variables… all `NEXT_PUBLIC_` variables will be frozen with the value evaluated at build
  time, so these values need to be set appropriately when the project is built. If you need access to
  runtime environment values, you'll have to setup your own API to provide them to the client."
- **Dynamic lookups silently escape inlining:** `process.env[varName]` and
  `const env = process.env; env.NEXT_PUBLIC_X` are both documented as NOT inlined. Destructuring
  `process.env` is the classic footgun.
- **Runtime server reads:** "You can safely read environment variables on the server during dynamic
  rendering." The documented pattern is `await connection()` from `next/server` before reading
  `process.env.MY_VALUE`; reading `cookies()`/`headers()` also opts into dynamic rendering and has the
  same effect.
- Load order: `process.env` → `.env.$(NODE_ENV).local` → `.env.local` (skipped when `NODE_ENV=test`) →
  `.env.$(NODE_ENV)` → `.env`. `.env.*` stays at project root even with `/src`.
- `@next/env`'s `loadEnvConfig` is the sanctioned way to load env outside the Next runtime — needed for
  Drizzle config and test runners, which Send Lab already has.

**Answering the SvelteKit comparison directly:**

| SvelteKit | Next 16.3 equivalent |
| --- | --- |
| `$env/static/private` | plain `process.env.FOO` in server code |
| `$env/static/public` | `NEXT_PUBLIC_FOO` — build-time inlined, frozen |
| `$env/dynamic/private` | plain `process.env.FOO` read in a dynamically-rendered server context. **Genuinely runtime-read** — it is just the Node process env Vercel populates per invocation |
| `$env/dynamic/public` | **no equivalent.** Client-visible values are inlined at build or must be fetched from your own route handler |

Two honest losses versus SvelteKit:

1. **No `$env/dynamic/public`.** If any client-side value must change without a rebuild, you write an
   endpoint for it.
2. **No build-time validation.** `$env/static/*` fails the build on a missing variable. Next.js does
   not; `process.env.FOO` is `string | undefined` and a typo compiles. You add this yourself (a zod
   `env.ts`, or `@t3-oss/env-nextjs`) — worth putting in ticket 09's gate.

### 6.5 Build config

- **`next.config.ts` is supported and stable**, not experimental
  (<https://nextjs.org/docs/app/api-reference/config/next-config-js>, v16.3.1, updated 2025-11-04).
  Supported extensions: `.js`, `.mjs`, `.ts`. **`.cjs` and `.cts` are not supported.** Config may be a
  sync or async function of `(phase, { defaultConfig })`. Caveat: "Avoid using new JavaScript features
  not available in your target Node.js version. `next.config.js` will not be parsed by Webpack or
  Babel."
- **Turbopack is the default bundler for both dev and build**
  (<https://nextjs.org/docs/app/api-reference/turbopack>, v16.3.1, updated 2026-08-11): "Turbopack is
  now the **default bundler** in Next.js. No configuration is needed to use Turbopack." Version
  history: `v16.0.0` default; `v15.5.0` build beta; `v15.0.0` dev stable.
- **Webpack remains available** via `next dev --webpack` / `next build --webpack`, and is required on
  platforms without native bindings. Not deprecated in wording, clearly secondary. Migration gaps worth
  knowing for a greenfield build (so you do not accidentally need webpack):
  - `webpack()` config in `next.config` is **not recognised** by Turbopack; use the `turbopack` key.
    **Webpack plugins are unsupported**; webpack *loaders* are supported.
  - Lightning CSS rounds to 5 decimal digits vs webpack's 10 — small visual diffs are possible.
  - CSS Module ordering follows JS import order, which can change cascade outcomes.
  - Sass `~pkg/...` tilde imports unsupported.
  - Unsupported/unplanned: Yarn PnP, `experimental.urlImports`, `experimental.esmExternals`,
    `sassOptions.functions`, standalone `:local`/`:global`, `@value`.
  - `turbopackFileSystemCacheForBuild` defaults to **`true`**; set it `false` if the build environment
    does not preserve `.next/cache`.
  - **PostCSS configs are auto-detected and run "in a Node.js worker pool. Useful for Tailwind,
    Autoprefixer, etc."** — this is the mechanism §5 depends on.
  - Turbopack adds Vite-style `import.meta.env` and `import.meta.glob` (Turbopack-only).
- **Output modes: you need neither on Vercel.** `output: 'standalone'` is the Docker/self-host path;
  `output: 'export'` is the static path (and is incompatible with `proxy.ts`, Route Handlers, and
  everything else Send Lab needs). The genuinely useful exports on that page are
  `outputFileTracingIncludes` / `outputFileTracingExcludes`
  (<https://nextjs.org/docs/app/api-reference/config/next-config-js/output>, v16.3.1).
- **Build cache** (<https://vercel.com/docs/deployments/troubleshoot-a-build>, 2026-06-15): 1 GB max,
  retained one month per cache key, "**It is not possible to manually configure which files are cached at
  this time.**" Caches `node_modules/**` plus framework-preset-chosen files. Cache key includes
  account/team, project, **framework preset**, root directory, **Node.js version**, package manager and
  **git branch** — so bumping `engines.node` cold-starts the cache. Invalidate via redeploy without
  cache, `vercel --force`, or `VERCEL_FORCE_NO_BUILD_CACHE=1`.
- **`.vercelignore`** (<https://vercel.com/docs/deployments/vercel-ignore>, updated **2025-03-12** — the
  stalest page found) behaves like `.gitignore` and controls what is uploaded, with allowlist inversion
  (`/*` then `!api`). A project-root file takes precedence over a repo-root one in monorepos.

### 6.6 MCP server on Vercel + Next

There is first-party guidance and a Vercel-maintained package
(<https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel>, updated 2026-03-19). The recommended
package is **`mcp-handler`** (not the older `@vercel/mcp-adapter`, which the current docs no longer
reference):

```ts
// app/api/mcp/route.ts
import { createMcpHandler } from 'mcp-handler'

const handler = createMcpHandler(
  (server) => { server.tool('roll_dice', '…', { sides: z.number().int().min(2) }, async ({ sides }) => { /* … */ }) },
  {},
  { basePath: '/api' },
)

export { handler as GET, handler as POST, handler as DELETE }
```

- Transport is **Streamable HTTP**. Note `DELETE` is exported alongside `GET`/`POST` for session
  teardown.
- **OAuth is built in.** `withMcpAuth(handler, verifyToken, { required: true, requiredScopes, resourceMetadataPath: '/.well-known/oauth-protected-resource' })`,
  plus a discovery route using `protectedResourceHandler({ authServerUrls })` and
  `metadataCorsOptionsRequestHandler()` exported as `OPTIONS`, per RFC 9728. This maps onto what Send
  Lab already does with better-auth as the authorization server: the two pieces to port are the
  protected-resource metadata route and the token-verification callback. (Ticket 05 owns this; ticket 01
  decides whether the OAuth server survives at all.)
- Vercel's rationale: "Vercel Functions with Fluid compute handle MCP servers' irregular usage patterns
  (long idle times, quick message bursts, heavy AI workloads) through optimized concurrency, dynamic
  scaling, and instance sharing." No specific `maxDuration` recommendation is given — inherit §6.3.
- Ecosystem alternative: `xmcp`, which has its own Vercel framework preset and a guide for adding an MCP
  server to an existing Next app.
- Unrelated but easy to confuse: `/docs/app/guides/mcp` is the Next.js **DevTools** MCP for coding
  agents, not for shipping an MCP endpoint.

### 6.7 Preview deployments and Deployment Protection

<https://vercel.com/docs/deployment-protection> (updated 2026-07-30). Relevant because Send Lab is a
private app.

| Method | Availability |
| --- | --- |
| Vercel Authentication | All plans |
| Password Protection | Enterprise, or paid add-on for Pro |
| Passport (IdP) | Enterprise |
| Trusted IPs | Enterprise |

Scopes: **Standard Protection** protects all deployments *except* production domains — all plans.
**All Deployments** includes production domains — Pro and Enterprise.

**The line that matters most:**

> "On the Hobby plan, Vercel Authentication with Standard Protection is available. This protects your
> preview deployments and deployment URLs, but your production domain remains publicly accessible. To
> protect production domains, you need a Pro or Enterprise plan."

So on Hobby, previews can be locked to the Vercel account for free, but the production domain cannot be
gated at the platform layer — **better-auth remains the only gate there**. The Pro "Advanced Deployment
Protection" add-on that unlocks Password Protection is $150/month with a 30-day minimum.

**Migration gotcha when enabling Standard Protection:** the production generated deployment URL becomes
restricted, so "Update any fetch requests that use `VERCEL_URL` or `VERCEL_BRANCH_URL`… to target the
same domain the user requested." Note the prefix difference: "`VERCEL_URL` for Next.js is
`NEXT_PUBLIC_VERCEL_URL`".

**Machine access** (<https://vercel.com/docs/deployment-protection/automated-agent-access>, 2026-07-15)
explicitly names MCP: "AI agents, CI/CD pipelines, MCP servers, and end-to-end testing tools can't
complete browser-based authentication challenges… these automated systems receive a login page or a
`403` response instead of your deployment content."

- **Protection Bypass for Automation — all plans.** Secrets exposed as
  `VERCEL_AUTOMATION_BYPASS_SECRET`; pass via header `x-vercel-protection-bypass` (recommended) or
  query param (for webhook senders that cannot set headers). `x-vercel-set-bypass-cookie: true`
  persists it across in-browser navigation. Regenerating a secret needs a redeploy.
- **OPTIONS Allowlist** — exempts path prefixes for CORS preflight only, "as browsers do not send
  authentication on preflight requests." Directly relevant to the MCP `.well-known` CORS handler.
- Useful for ticket 09/11: `vercel curl /api/hello` "handles bypass tokens automatically."

> **Inference, not documented.** Vercel's guidance covers an MCP server *calling* protected
> deployments. For the inverse — an MCP endpoint *hosted on* a protected preview — the same bypass
> mechanism applies, but the burden shifts to the MCP client, and most MCP hosts do not let you attach
> arbitrary headers to a remote server URL. Practically: test the MCP endpoint on previews via the
> `?x-vercel-protection-bypass=` query form, or accept that on Hobby the production domain is
> unprotected at the platform layer and the route's own OAuth is the gate. **Verify before designing
> around this.**

---

## 7. Caching and revalidation defaults: what could leak or go stale

This is the section to read before writing a single page.

### 7.1 There are two caching models in 16, and one flag decides which docs apply

<https://nextjs.org/docs/app/getting-started/caching> (v16.3.1) opens with:

> "This page covers caching with Cache Components, enabled by setting `cacheComponents: true` in your
> `next.config.ts` file. If you're not using Cache Components, see the Caching and Revalidating
> (Previous Model) guide."

So:

- **Model A — `cacheComponents: false` (the default).** The classic four-cache model. Documented at
  <https://nextjs.org/docs/app/guides/caching-without-cache-components>.
- **Model B — `cacheComponents: true`.** `use cache` + PPR by default. Documented at
  <https://nextjs.org/docs/app/getting-started/caching>.

Getting these confused is the most likely way to reach a wrong conclusion, because **`cookies()` means
something different in each** (§7.5).

### 7.2 The four caches and their v16.3.1 defaults (Model A)

| Cache | Where | Cached by default? | Duration | How to opt out |
| --- | --- | --- | --- | --- |
| **Request Memoization** | React render pass, per request | **Yes**, automatic for `fetch` GET | one render pass | n/a. Note: memoization applies "across Server Components, layouts, pages, and `generateMetadata`/`generateStaticParams` (**but not Route Handlers since they are not part of the React component tree**)". For non-`fetch` reads use `React.cache` |
| **Data Cache** | Server/platform; persists across requests **and deploys** | **No.** "By default, `fetch` requests are **not** cached." | n/a | Already off. Opt *in* with `{ cache: 'force-cache' }` or `next: { revalidate: n }` |
| **Full Route Cache** | Build output / ISR store | **Yes for any prerenderable route.** `dynamic: 'auto'` = "cache as much as possible without preventing any components from opting into dynamic behavior"; `revalidate: false` ≈ `Infinity` | indefinite until revalidated | Touch a Request-time API, or `dynamic = 'force-dynamic'` / `revalidate = 0` |
| **Client Router Cache** | Browser memory | **Page segments: no. Layouts and `loading.js`: yes. Back/forward: yes** | `staleTimes.dynamic` default **0 s**; `staleTimes.static` default **5 min**; cleared on page refresh | `staleTimes` (experimental), or invalidate via `revalidateTag`/`revalidatePath`/`updateTag`/`router.refresh`/`cookies.set`/`cookies.delete` |

Sources: <https://nextjs.org/docs/app/guides/caching-without-cache-components>,
<https://nextjs.org/docs/app/glossary>,
<https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes> (all v16.3.1).

### 7.3 What v15 changed, and what v16 added on top

From <https://nextjs.org/docs/app/guides/upgrading/version-15>, verbatim:

- "**`fetch` requests are no longer cached by default.**"
- "**`GET` functions in Route Handlers are no longer cached by default.**"
- "When navigating between pages via `<Link>` or `useRouter`, **page segments are no longer reused from
  the Client Cache**. However, they are still reused during browser backward and forward navigation and
  for shared layouts." The `staleTimes` version history confirms: `v15.0.0` — "The `dynamic`
  `staleTimes` default changed from 30s to 0s."

**v16 on top of that:**

1. Sync `cookies`/`headers`/`draftMode`/`params`/`searchParams` **fully removed**.
2. `cacheComponents: true` introduced — one flag replacing `experimental.ppr` + `experimental.useCache`
   + `experimental.dynamicIO`. When on, `dynamic`/`dynamicParams`/`revalidate`/`fetchCache` are
   **removed**, and PPR is the default.
3. `cacheLife` and `cacheTag` **stabilised** — the `unstable_` prefix is gone.
4. `revalidateTag` now **requires a `cacheLife` profile as a second argument**:
   `revalidateTag('posts', 'max')`. Single-argument form deprecated.
5. New `updateTag(tag)` — Server-Actions-only, **read-your-writes**. New `refresh()` — refreshes
   uncached data / the client router from a Server Action without touching the cache.
6. **`unstable_cache` is gone in spirit:** "This API has been replaced by `use cache` in Next.js 16."
7. Prefetching rewritten: layout deduplication + incremental prefetching ("you may see more individual
   prefetch requests, but with much lower total transfer sizes").
8. `images.minimumCacheTTL` default 60 s → **4 hours**.

### 7.4 Cache Components / `use cache` status — opt-in, and stable-flagged

- **`cacheComponents` is a stable, top-level (non-`experimental`) config option, and default off.**
  Version history: `16.0.0` — "`cacheComponents` introduced. This flag controls the `ppr`, `useCache`,
  and `dynamicIO` flags as a single, unified configuration."
  (<https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents>)
- **`use cache` requires the flag.** Version history: `v16.0.0` "enabled with the Cache Components
  feature"; `v15.0.0` "introduced as an experimental feature."
  (<https://nextjs.org/docs/app/api-reference/directives/use-cache>)
- `use cache: private` — new in `v16.0.0`. Reads `cookies()`, `headers()`, `searchParams`; **not**
  `connection()`. "Results are **never stored on the server**, they're cached only in the browser's
  memory and do not persist across page reloads."
- `use cache: remote` — durable, shared storage via a cache handler; on Vercel this is the Runtime
  Cache.
- **`dynamicIO` → `cacheComponents`: yes, a rename plus more.** The upgrade guide warns: "Enabling
  `cacheComponents` is not a rename-only change: it can surface build errors for uncached data outside
  of `<Suspense>` and requires adopting the Cache Components model."
- **The implicit default lifetime, if you omit `cacheLife`:** stale 5 min (client), revalidate 15 min
  (server), expire never. "We recommend pairing every cache directive with a `cacheLife`. Without one,
  the implicit `default` profile applies."
- The client router enforces a **minimum 30-second stale time regardless of configuration**;
  `stale` ≥ 30 s is needed for per-link prefetching, ≥ 5 min for App Shell inclusion.
- **Cache keys** = Build ID (or `deploymentId`) + a Function ID hash + serializable arguments +
  **automatically captured closure variables**. That last one is easy to miss.

**PPR is no longer separately toggleable.** From the same pages:

> "`cacheComponents` implements **Partial Prerendering (PPR) as the default behavior in the App
> Router**. This means the `experimental.ppr` configuration flag and the `experimental_ppr` route
> segment configuration are no longer necessary and **have been removed**."
>
> ⚠️ "**PPR in Next.js 16 works differently than in Next.js 15 canaries. If you are using PPR today,
> stay in the current Next.js 15 canary you are using.**"

### 7.5 The semantic trap: `cookies()` does not mean "dynamic" under Cache Components

**Model A:** Request-time APIs force dynamic rendering, and that is the whole safety mechanism.
The glossary defines Request-time APIs as "Functions that access request-specific data, **causing a
component to opt into dynamic rendering**": `cookies()`, `headers()`, `searchParams`, `draftMode()`.
`connection()` covers the case where output must differ per request without touching one of those —
it "replaces `unstable_noStore`", stabilised in v15.0.0. One `await cookies()` in a Data Access Layer
makes a route safe.

**Model B: no, and this is the biggest change in intuition.** From
<https://nextjs.org/docs/app/getting-started/caching> (v16.3.1):

> "**Reading `cookies()` here doesn't opt-in the whole route into dynamic rendering, the way the
> previous rendering model did.** The Suspense boundary provides fallback UI where the runtime access
> streams, while static and cached content still ship in the initial HTML."

Consequences:

- Reading `cookies()` **outside** a `<Suspense>` boundary is a **build error**: "With Cache Components,
  reading `cookies()` outside a boundary is a build error."
  (<https://nextjs.org/docs/app/guides/authentication-with-cache-components>)
- Session reads must be pushed out of layout top-level: "A top-level `await` on the session in a layout
  holds the whole segment, including `{children}`, behind that request."
- Escape hatch for incremental adoption: `export const instant = false` on a page or layout "to let it
  keep blocking on the server, then adopt the patterns below one route at a time."
- `connection()` is allowed in neither `use cache` nor `use cache: private` — "it provides
  connection-specific information that cannot be safely cached."
- **A SQLite-shaped trap that is directly relevant to Send Lab's current stack:** synchronous DB reads
  *complete during prerendering*. The docs name the libraries: "This includes queries to embedded
  databases with synchronous APIs, such as `better-sqlite3` or Node.js's built-in `node:sqlite`.
  **If you need per-request data from a synchronous source, call `connection()` before the query.**"
  Send Lab uses `@libsql/client` over HTTP (async), so this does not bite today — but it would if
  anyone reached for a sync driver in local dev.

### 7.6 Danger list: every default that could serve one athlete another's data, or stale state

Ordered by likelihood of biting a private, per-account, always-dynamic app.

**1. Full Route Cache static-optimising an authenticated page.**
`dynamic: 'auto'` caches as much as it can. A page that renders without touching a Request-time API is
prerendered at build and served identically to everyone. The auth guide states the consequence plainly:
"A DAL can be used to protect data fetched at request time. **However, for static routes that share
data between users, data will be fetched at build time and not at request time. Use Proxy to protect
static routes.**"
*Safe configuration:* route every authenticated read through a DAL that does `await cookies()`. That
alone forces request-time rendering. `export const dynamic = 'force-dynamic'` is a reasonable
defensive assertion in Model A. **Never `dynamic = 'force-static'`** — it forces "`cookies`,
`headers()` and `useSearchParams()` to return **empty values**", silently turning an auth check into
"no session".

**2. `GET` Route Handlers prerendered at build (Model B only).** Handlers that read a session are
automatically request-time. The risk is the handler that *forgets* to — a health, config or manifest
endpoint gets frozen into the build output. *Safe configuration:* read the session in every handler via
the DAL; the docs enumerate exactly what stops prerendering (§3.5).

**3. `fetch` caching. Already safe by default — the risk is re-enabling it.**
`export const fetchCache = 'default-cache'` or `'force-cache'` in a root layout would make every
unannotated fetch cached, including per-athlete ones, and the Data Cache "persists across requests
**and deployments**." *Safe configuration:* never set `fetchCache` globally. If forced,
`'force-no-store'` / `'only-no-store'`.

**4. `unstable_cache` on a per-user query.** Its key derives from arguments + stringified function +
`keyParts`. Omit the user id from `keyParts` and one athlete's rows are served to another; the entry
persists "across requests and deployments". *Safe configuration:* don't use it — it is replaced by
`use cache` in 16.

**5. `use cache` on per-user data (Model B).** A plain `use cache` scope **throws** if it reads
`cookies()`/`headers()` — that part is safe. The danger is the sanctioned workaround: extract the user
id and pass it in. Two explicit warnings from
<https://nextjs.org/docs/app/guides/authentication-with-cache-components>:

> "**cache keys and tags are stored in plain text.** A cached function's arguments and captured
> variables are serialized into its cache key, and `cacheTag` values are stored as written. **Neither
> is hashed**… Key and tag on a stable identifier like the user id, and keep secrets and sensitive
> personal data (tokens, passwords, raw emails) out of arguments and tags."

> "Keep `getNotesByUserId` **unexported** so a caller can't request another user's notes by passing a
> different id. Resolving the user inside the exported getter is what makes that safe."

*Safe configuration:* exported wrapper resolves the session → calls an **unexported** `use cache`
function keyed on the user id → ``cacheTag(`notes:${userId}`)`` → `updateTag()` on mutation. Beware the
timing: a violation "can pass `next build` and fail under `next start`".

**6. Client Router Cache + back/forward navigation. The most under-appreciated one.**
Page segments are not reused on `<Link>` navigation (staleTime 0), **but** "they are still reused during
browser backward and forward navigation," and `staleTimes` "doesn't change back/forward caching
behavior to prevent layout shift and to prevent losing the browser scroll position." So after logout, a
back-button press can repaint the previous athlete's rendered data straight from browser memory. Under
Cache Components this is amplified: React `<Activity>` keeps recent routes mounted with state intact.
*Safe configuration:* the cache "is cleared on page refresh," and `cookies.set`/`cookies.delete`
invalidate it. So **log out via a Server Action that deletes the session cookie**, and follow with a
hard navigation rather than a client transition. Do not rely on `staleTimes` — its own page says it "is
currently experimental… not recommended for production."

**7. Prefetching of authenticated links.** `<Link>` defaults to `prefetch="auto"`, prefetching on
viewport entry, in production only. Under Cache Components + Partial Prefetching the prefetched payload
is the App Shell, and "Routes that read `cookies()` or `headers()` produce one that also includes
**session data, cached per session on the client**" — "cached per session on the client rather than in
the shared server cache." That per-session client-only behaviour is the documented safe design; don't
fight it. Do set `prefetch={false}` on links whose target is expensive. And if `proxy.ts` rewrites a
path based on auth, you **must** use `<Link as="/dashboard" href={authedPath}>` or prefetch resolves the
wrong route.

**8. The Vercel CDN.** Vercel will not cache authenticated responses by default; cacheability requires
an explicit `s-maxage` / `CDN-Cache-Control` / `Vercel-CDN-Cache-Control`, and the criteria exclude
everything relevant here: "Request doesn't contain `Authorization` header… Response doesn't contain the
`set-cookie` header. Response doesn't contain the `private`, `no-cache` or `no-store` directives…
Response doesn't contain `Vary: *`."
*Safe configuration:* never set `s-maxage`/`CDN-Cache-Control` on an authenticated route — not in the
handler, and not in `next.config.js` `headers()`. Note the precedence: "if you return `Cache-Control`
headers in a Vercel Function, it will override the headers defined for the same route in `vercel.json`
or `next.config.js`." Belt-and-braces: `Cache-Control: private, no-store`. **Do not** try to make it
safe with `Vary: Cookie` — that is a popular pattern, not a Vercel recommendation, and Vercel lists
"Responses include sensitive user data" and "You need user-specific content without the `Vary` header"
as CDN-cache anti-fits.

**9. Vercel Data Cache / Runtime Cache.** Both are automatic infrastructure and both explicitly list
"**User-specific data that differs for each request**" as *not* a good fit. Both are regional, persist
across deployments, LRU-evicted, item size 2 MB, 128 tags/item, 256-byte tags. **On Hobby and Pro the
Data Cache is shared across all projects in your team** (Runtime Cache: shared on Hobby, per-project on
Pro/Enterprise). Production and preview environments never share.
*Safe configuration:* don't opt in. With `fetch` uncached by default and no `unstable_cache`, nothing
lands there. Only `use cache: remote` writes to Runtime Cache, and that is explicit.

> **Vercel doc conflict.** The Data Cache page says "Data cache is for Next.js 14 and below" / "not a
> good fit for: Next.js 15 and above", while the Runtime Cache page's own table maps Next.js 16 `fetch`
> with `force-cache` → **Data cache**.
> (<https://vercel.com/docs/caching/runtime-cache/data-cache> vs
> <https://vercel.com/docs/caching/runtime-cache>.) Moot if you never opt in.

**10. Bots and crawlers take a different code path (Model B).** "Bots and crawlers are detected by their
user agent and handled differently: because they need a complete document, Next.js **skips the shell and
renders the entire page dynamically at request time**." Consequence the docs state: "a page that loads
for a person can fail to render for a crawler." Not a leak, but a private app with a bot-shaped uptime
checker exercises a path you never see in a browser.

**11. Stale-state footgun specific to a training log.** `revalidateTag(tag, profile)` gives
**stale-while-revalidate** semantics — an athlete who just logged a set would see the old value. The
docs give the fix directly: "If you need immediate expiration rather than stale-while-revalidate, use
`updateTag` in Server Actions instead"; `updateTag` "provides **read-your-writes** semantics." Use
`refresh()` for uncached data.

### 7.7 Recommendation for Send Lab

**Leave `cacheComponents` off.** This is a recommendation, not a docs requirement, but the reasoning is
straightforward and follows from the sources above:

- The v15/v16 defaults are already conservative for a private always-dynamic app: `fetch` uncached,
  `GET` handlers uncached, router page-segment `staleTime: 0`, CDN refuses to cache responses carrying
  `Authorization` or `set-cookie`.
- Cache Components' entire payoff is prerendering a static shell and prefetching cached content. Send
  Lab has no static content to prerender — every page is one athlete's state.
- Turning it on costs: a `<Suspense>` boundary around every session read (enforced as a build error),
  `use cache: private` discipline for session-derived data, unexported id-keyed cached functions,
  plain-text cache-key hygiene, and the loss of `dynamic`/`revalidate`/`fetchCache` as safety
  assertions.
- The residual leak vectors in Model A are **all opt-in**: `fetchCache`, `unstable_cache`, `s-maxage`,
  `force-static`, `use cache` with a bad key. Not enabling them is a cheap, auditable rule.

Two risks remain regardless of the flag, and both need explicit handling:

1. **Back/forward Router Cache reuse after logout** — fix with a cookie-deleting Server Action plus a
   hard navigation.
2. **Vercel's function duration ceiling on the MCP stream** — 300 s on Hobby, and a 401 cannot be
   emitted once streaming has begun (§3.3, §6.3).

One forward-looking caveat: the 16.3 post says the Instant Navigations behaviours "will become the
default in a future major version." Choosing Model A now is choosing the model that v17 is likely to
change. That is a known, dated migration cost, not a surprise.

---

## 8. Cross-cutting: the bilingual trap in a Next.js rebuild

Ticket 04 owns the i18n replacement decision. This section only records the facts from the Next.js
docs that bear on ADR 0003 — "a user-facing label is locale-dependent and must never be an
identifier" — so that the rebuild does not reintroduce the bug class on a clean slate.

**There is no built-in i18n routing in the App Router.** The Pages Router had an `i18n` key in
`next.config.js`; the App Router has nothing equivalent. The official guide
(<https://nextjs.org/docs/app/guides/internationalization>, v16.3.1, updated 2026-06-10) tells you to
build it yourself: nest everything under `app/[lang]/`, detect the locale in `proxy.ts` from
`Accept-Language` and redirect, and load your own dictionary modules per locale. Locale is therefore
a **route parameter**, i.e. a stable identifier in the URL — which is structurally the right shape
for ADR 0003.

**`next/root-params` (new in 16.3) is the piece that removes the prop-drilling pressure.** Because
`[lang]` sits above the root layout, any Server Component or server-side utility can read it:

```ts
import { lang } from 'next/root-params'
const locale = await lang()
```

Documented limits, from the same guide: "Root parameter getters run in Server Components and
server-side utilities, but **not in Client Components, Server Actions, or Route Handlers**." So the
locale is freely available on the server render path, and must be passed explicitly (as a prop, or
via a client context) into Client Components, Server Actions and Route Handlers. That restriction is
actually protective: it makes it awkward to accidentally resolve a *label* on a write path.

**The two places the rebuild would reintroduce the bug class.**

1. **Server Actions and Route Handlers cannot read the root param.** So anything they persist must
   receive a stable key from the client. This is exactly the `Mon`/`Tue` weekday-key situation: if a
   Client Component sends the *rendered* weekday label to an action, it works in English and silently
   corrupts data in pt-BR. The rule to carry into the rebuild: **actions and route handlers accept
   stable keys only, never rendered strings**, and the boundary types should make that visible
   (`day: WeekdayKey`, not `day: string`).
2. **Cache keys and tags are plain text and are part of correctness.** From
   <https://nextjs.org/docs/app/guides/authentication-with-cache-components> (v16.3.1, updated
   2026-08-11): "A cached function's arguments and captured variables are serialized into its cache
   key… Neither is hashed". If a locale-dependent label ever ends up in a `cacheTag` or in a cached
   function's arguments, you get two cache entries for one logical thing, and invalidation from the
   other locale misses. Tag on stable identifiers.

**This is a real change of shape, not a port.** Today `src/app.css`'s sibling `vite.config.ts`
configures Paraglide with `strategy: ['localStorage', 'preferredLanguage', 'baseLocale']` and the
comment "Pure client-side SPA … No URL/cookie/server strategy." The Next.js documented approach puts
the locale **in the URL** (`app/[lang]/...`) and resolves it on the server. Those are different
models: the current app's locale is client state, the Next.js one is a route parameter. Moving to the
route-parameter model is arguably better for ADR 0003 (the locale becomes a stable identifier in a
stable position) but it is a behaviour change — deep links become locale-scoped — and it is ticket
04's to decide, along with whether to keep a client-only strategy instead.

**Library note for ticket 04.** The Next.js i18n guide's own "Resources" list includes
`paraglide-next` (<https://inlang.com/m/osslbuzt/paraglide-next-i18n>) alongside `next-intl`,
`next-international`, `lingui` and others. Send Lab already uses `@inlang/paraglide-js` with a
compile step, so there is a documented continuity path — but whether to take it is ticket 04's call,
not this ticket's.

**One thing to check in pt-BR, per the map's warning:** locale codes. The guide's examples use
`en-US` / `nl-NL` style tags and match them with `@formatjs/intl-localematcher`. `pt-BR` is a
region-qualified tag, so any place that compares a locale must compare the full tag, not a truncated
language subtag, or `pt-BR` and `pt` will diverge.

---

## Where the docs contradict each other

Recorded because these are the places a future reader will get a wrong answer depending on which page
they land on. In each case the preferred source is named.

| Topic | Conflict | Prefer |
| --- | --- | --- |
| Next 16.0 release date | 16.3 blog says "last November"; the 16 post is dated Oct 21 2025, as is the support policy | The dated release post |
| Edge runtime status | Vercel: "no longer supported" as of 16.3. Next.js: "deprecated, remove the export" | Next.js docs (they own the behaviour). Outcome identical: never use it |
| Proxy + edge runtime | v16 upgrade guide says keep `middleware.ts` for edge and promises later guidance; the proxy reference says Node-only, non-configurable, and mentions no escape hatch | The proxy reference. The promised guidance is not in 16.3.1 |
| Route segment config surface | The index table omits `dynamic`/`revalidate`/`fetchCache`; the `route.js` reference still lists them | The "caching without Cache Components" guide |
| Vercel Data Cache and Next 15/16 | Data Cache page says it is "for Next.js 14 and below"; the Runtime Cache page's table maps Next 16 `force-cache` fetches to the Data cache | Moot if you never opt in; treat as unresolved |
| Route Handler streaming example | The `route.js` reference imports `StreamingTextResponse` from `ai`, an export removed from the AI SDK | The Streaming guide's raw `ReadableStream` form |
| Tailwind install command | tailwindcss.com installs 3 packages as runtime deps; Next.js docs install 2 as dev deps | The Next.js CSS page (newer) |
| `components.json` shape | The prose page still shows `tailwind.config: tailwind.config.js` and only `new-york` | `https://ui.shadcn.com/schema.json` |
| Vercel function `maxDuration` | `@sveltejs/adapter-vercel` docs quote 10 s Hobby / 15 s Pro / 900 s Enterprise | Vercel's current pages: 300 s default, 800 s Pro max. The SvelteKit page is stale |

## Staleness warnings on load-bearing facts

Pages whose own `last_updated` is old enough that the fact should be rechecked before it is depended on:

- <https://vercel.com/docs/functions/runtimes/node-js/node-js-versions> — **2026-02-27**. Source of
  "Node 24 is the default". Recheck before setting `engines.node`.
- <https://vercel.com/docs/deployments/vercel-ignore> — **2025-03-12**.
- <https://nextjs.org/docs/pages/getting-started> — `lastUpdated: 2024-11-07`. Cited only as *evidence
  of staleness*, which is itself the finding.
- Every Vercel plan limit in §6.3. The 1800 s duration tier is explicitly **beta**.

## Sources

Next.js docs (each stamped `version: 16.3.1` in its front-matter unless noted):

- Installation — <https://nextjs.org/docs/app/getting-started/installation> (updated 2026-07-21)
- Server and Client Components —
  <https://nextjs.org/docs/app/getting-started/server-and-client-components> (2026-08-11)
- The Server and Client Boundary — <https://nextjs.org/docs/app/guides/server-and-client-boundary>
  (2026-08-11)
- Single-page applications — <https://nextjs.org/docs/app/guides/single-page-applications> (2026-08-14)
- Building interactive apps — <https://nextjs.org/docs/app/guides/interactive-apps> (2026-08-11)
- Client-side data fetching — <https://nextjs.org/docs/app/guides/client-side-data-fetching>
  (2026-08-11)
- Server Actions and Mutations — <https://nextjs.org/docs/app/guides/server-actions> (2026-06-17)
- Route Handlers — <https://nextjs.org/docs/app/getting-started/route-handlers> (2026-03-03)
- `route.js` reference — <https://nextjs.org/docs/app/api-reference/file-conventions/route>
- Route segment config — <https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config>
  and `.../runtime`, `.../maxDuration`
- `proxy.ts` reference — <https://nextjs.org/docs/app/api-reference/file-conventions/proxy> (2026-08-04)
- Proxy (getting started) — <https://nextjs.org/docs/app/getting-started/proxy>
- Authentication — <https://nextjs.org/docs/app/guides/authentication> (2026-08-13)
- Authentication with Cache Components —
  <https://nextjs.org/docs/app/guides/authentication-with-cache-components> (2026-08-11)
- Data security — <https://nextjs.org/docs/app/guides/data-security> (2026-08-10)
- Caching (Cache Components model) — <https://nextjs.org/docs/app/getting-started/caching>
- Caching and Revalidating (previous model) —
  <https://nextjs.org/docs/app/guides/caching-without-cache-components>
- `cacheComponents` — <https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents>
- `use cache` — <https://nextjs.org/docs/app/api-reference/directives/use-cache>, and
  `.../use-cache-private`, `.../use-cache-remote`
- `staleTimes` — <https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes>
- Streaming — <https://nextjs.org/docs/app/guides/streaming>
- Internationalization — <https://nextjs.org/docs/app/guides/internationalization> (2026-06-10)
- `next/root-params` — <https://nextjs.org/docs/app/api-reference/functions/next-root-params>
- Environment variables — <https://nextjs.org/docs/app/guides/environment-variables> (2026-03-03)
- `next.config.js` — <https://nextjs.org/docs/app/api-reference/config/next-config-js> (2025-11-04),
  and `.../output`
- Turbopack — <https://nextjs.org/docs/app/api-reference/turbopack> (2026-08-11)
- `create-next-app` — <https://nextjs.org/docs/app/api-reference/cli/create-next-app> (2026-08-10)
- CSS — <https://nextjs.org/docs/app/getting-started/css> (2026-03-20)
- Deploying — <https://nextjs.org/docs/app/getting-started/deploying> (2026-08-06)
- Upgrade guides — <https://nextjs.org/docs/app/guides/upgrading/version-15> and `.../version-16`
- Glossary — <https://nextjs.org/docs/app/glossary>
- Docs sitemap — <https://nextjs.org/docs/sitemap.md>
- `edge-runtime-deprecated` — <https://nextjs.org/docs/messages/edge-runtime-deprecated>
- Pages Router landing — <https://nextjs.org/docs/pages/getting-started> (lastUpdated 2024-11-07)
- Support policy — <https://nextjs.org/support-policy>

Next.js release posts:

- Next.js 16.3 — <https://nextjs.org/blog/next-16-3> (2026-08-03)
- Turbopack in 16.3 — <https://nextjs.org/blog/next-16-3-turbopack>
- Next.js 16.2 — <https://nextjs.org/blog/next-16-2> (2026-03-18); Turbopack in 16.2 —
  <https://nextjs.org/blog/next-16-2-turbopack>
- Next.js 16.1 — <https://nextjs.org/blog/next-16-1> (2025-12-18)
- Next.js 16 — <https://nextjs.org/blog/next-16> (2025-10-21)
- Next.js 15 — <https://nextjs.org/blog/next-15> (2024-10-21)
- Middleware bypass postmortem (CVE-2025-29927) —
  <https://vercel.com/blog/postmortem-on-next-js-middleware-bypass>

Vercel docs (with each page's own `last_updated`):

- Next.js on Vercel — <https://vercel.com/docs/frameworks/full-stack/nextjs> (2026-06-26)
- Configure a build — <https://vercel.com/docs/builds/configure-a-build> (2026-07-15)
- Build Output API — <https://vercel.com/docs/build-output-api> (2026-07-27)
- `vercel.json` — <https://vercel.com/docs/project-configuration/vercel-json> (2026-06-17)
- Node.js versions — <https://vercel.com/docs/functions/runtimes/node-js/node-js-versions> (2026-02-27)
- Edge runtime — <https://vercel.com/docs/functions/runtimes/edge> (2026-08-03)
- Fluid compute — <https://vercel.com/docs/fluid-compute> (2026-07-01)
- Function limitations — <https://vercel.com/docs/functions/limitations> (2026-07-01)
- Function duration — <https://vercel.com/docs/functions/configuring-functions/duration> (2026-07-01)
- Environment variables — <https://vercel.com/docs/environment-variables> (2026-06-16), and
  `.../sensitive-environment-variables` (2026-06-03)
- Build troubleshooting / build cache — <https://vercel.com/docs/deployments/troubleshoot-a-build>
  (2026-06-15)
- `.vercelignore` — <https://vercel.com/docs/deployments/vercel-ignore> (2025-03-12)
- Runtime Cache — <https://vercel.com/docs/caching/runtime-cache> and `.../data-cache`
- Deploy MCP servers to Vercel — <https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel> (2026-03-19)
- Deployment Protection — <https://vercel.com/docs/deployment-protection> (2026-07-30),
  `.../methods-to-bypass-deployment-protection` (2026-07-01),
  `.../automated-agent-access` (2026-07-15)

Tailwind CSS and UI ecosystem:

- Next.js framework guide — <https://tailwindcss.com/docs/installation/framework-guides/nextjs>
- Using PostCSS — <https://tailwindcss.com/docs/installation/using-postcss>; Using Vite —
  <https://tailwindcss.com/docs/installation/using-vite>
- Theme — <https://tailwindcss.com/docs/theme>; Functions and directives —
  <https://tailwindcss.com/docs/functions-and-directives>
- Tailwind CSS v4.3 release — <https://tailwindcss.com/blog/tailwindcss-v4-3> (2026-05-08)
- shadcn/ui: <https://ui.shadcn.com/docs/tailwind-v4>, <https://ui.shadcn.com/docs/theming>,
  <https://ui.shadcn.com/docs/dark-mode/next>, <https://ui.shadcn.com/docs/changelog>,
  <https://ui.shadcn.com/docs/changelog/2026-02-radix-ui>,
  <https://ui.shadcn.com/docs/changelog/2026-03-cli-v4>,
  <https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default>, <https://ui.shadcn.com/schema.json>
- Base UI — <https://base-ui.com/react/overview/quick-start>
- `tailwind-variants` — <https://www.tailwind-variants.org/docs/getting-started>
- `tailwindcss-motion` v4 support issue —
  <https://github.com/romboHQ/tailwindcss-motion/issues/40>
- `next-themes` — <https://github.com/pacocoursey/next-themes>
- Pages Router future — <https://github.com/vercel/next.js/discussions/56655>

Version numbers were read from `https://registry.npmjs.org/<package>/latest` on 2026-08-15.

Local files inspected for the carry-over analysis: `src/app.css`, `vite.config.ts`, `package.json`,
`components.json`.

## Open questions this ticket did not settle

These belong to other tickets; listed so they are not mistaken for gaps in the research.

- **Whether to enable Cache Components.** §7.7 recommends no, with reasons. Ticket 06 decides.
- **Where the console's state actually lives.** §2.5 recommends a posture; tickets 06 and 07 decide.
- **`cva` vs `tailwind-variants`.** §5.5 states the conflict; ticket 08 decides.
- **`tailwindcss-motion`: replace or pin.** §5.4 states the risk; ticket 08 decides.
- **i18n library and whether locale moves into the URL.** §8 states the facts; ticket 04 decides.
- **better-auth's fit with `proxy.ts` + a Data Access Layer.** §4.6 states the shape; ticket 03 decides.
- **Whether the MCP endpoint can be exercised on protected previews.** §6.7 flags this as an inference
  needing verification; tickets 05 and 11.
- **Node version pin.** Next 16 requires ≥ 20.9; Vercel defaults to Node 24. §6.2's source page is six
  months old. Ticket 10 or 11 should verify and pin.
