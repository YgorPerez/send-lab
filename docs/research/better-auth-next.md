---
status: research
ticket: .scratch/nextjs-rebuild/issues/03-better-auth-on-next.md
---

# better-auth on Next.js App Router

Research for the Next.js rebuild: how much of Send Lab's `better-auth` setup
transfers to the App Router, and what has to be rebuilt.

**Verdict up front.** The `betterAuth()` config object transfers essentially
verbatim — two lines change. What does not transfer is `hooks.server.ts`: both of
its jobs (session-on-locals, and the CSRF guard) have no App Router equivalent
and must be rebuilt as a Data Access Layer and a hand-written origin check
respectively. The biggest win is §7: the hand-rolled OAuth server can become
configuration via `@better-auth/oauth-provider`, which is installable at the
repo's current better-auth version. The biggest loss is §5: better-auth's API-key
plugin cannot re-reveal a token, so the Settings "show my token" behaviour has to
change or `apiToken.ts` has to stay.

## Versions, and a discrepancy worth fixing first

| Thing | Version | Source |
| --- | --- | --- |
| `better-auth` — committed manifest | `^1.6.25` | `package.json` at this branch's HEAD |
| `better-auth` — committed lockfile | `1.6.25` | `pnpm-lock.yaml`, `better-auth@1.6.25` |
| `better-auth` — **actually in `node_modules`** | **`1.6.20`** | `node_modules/better-auth/package.json` |
| `@better-auth/core` (committed) | `1.6.25` | `pnpm-lock.yaml` |
| `better-call` (committed) | `1.3.7` | `pnpm-lock.yaml` |
| `@better-auth/utils` (committed) | `0.4.2` | `pnpm-lock.yaml` |
| latest published `better-auth` | `1.6.29` | npm `dist-tags.latest` |
| Next.js docs | `16.3.1` | `version:` frontmatter on fetched doc pages |

**The install is stale.** The committed manifest and lockfile both say 1.6.25,
but the on-disk `node_modules` is 1.6.20 — a leftover from before the bump. Worth
a `pnpm install` regardless of the rebuild. (The ticket says `^1.6.20`, which
matches the stale install rather than the committed manifest.)

Because of that, **every source-level claim below was re-verified against the
published `better-auth@1.6.25` tarball**, not the stale install. Where a claim
was originally read at 1.6.20 and confirmed at 1.6.25, it is marked as such.

### How to read the evidence tags

- `[docs]` — a live better-auth or Next.js documentation page, cited by URL.
- `[1.6.25]` — read directly out of the published `better-auth@1.6.25` package
  (`.d.mts` declarations or compiled `.mjs`). This is the stronger source for API
  shapes, because the published docs track `main`, not 1.6.25.
- **unverified** — the docs don't show it and the source didn't settle it. Not
  guessed at.

One useful stability result: `@better-auth/core`'s `dist/db/get-tables.mjs` — the
file that defines the canonical schema — is **byte-identical across 1.6.25 and
1.6.29**, and differs from 1.6.20 only in plugin `disableMigrations` propagation
and a foreign-key `model:` literal. **No field definitions changed anywhere in
1.6.20 → 1.6.29.** So §4's schema conclusions hold across that whole band.

---

## 1. Mounting the handler

### The catch-all route handler

One file replaces the `svelteKitHandler` call in `src/hooks.server.ts`:

```ts
// app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
```

[docs] <https://www.better-auth.com/docs/integrations/next>, which adds: *"You can
change the path on your better-auth configuration but it's recommended to keep it
as `/api/auth/[...all]`"*.

Two things the docs example understates — [1.6.25]
`dist/integrations/next-js.d.mts`:

```ts
declare function toNextJsHandler(auth: {
  handler: (request: Request) => Promise<Response>;
} | ((request: Request) => Promise<Response>)): {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  PATCH: (request: Request) => Promise<Response>;
  PUT: (request: Request) => Promise<Response>;
  DELETE: (request: Request) => Promise<Response>;
};
```

1. It returns **five** verbs; the docs destructure two. Export all five if any
   plugin needs `PATCH`/`PUT`/`DELETE`. For Send Lab's current plugin set,
   `GET`/`POST` suffices.
2. It accepts the whole `auth` object *or* a bare handler —
   `"handler" in auth ? auth.handler(request) : auth(request)`.

### The `nextCookies` plugin — not a like-for-like swap

`sveltekitCookies(getRequestEvent)` becomes `nextCookies()` (note: no argument).
It must be **last** in the `plugins` array. [docs] same page — *"make sure this is
the last plugin in the array"*, and its purpose is that server-side helpers like
`signInEmail` called from a Server Action otherwise fail to set cookies, because
"server actions need to use the `cookies` helper from Next.js".

Placement is now enforced at runtime — [1.6.25]
`dist/integrations/cookie-plugin-guard.mjs`, `warnIfCookiePluginNotLast`, emits:

> `[better-auth] Cookie integration plugin "next-cookies" should be placed last
> in the plugins array. Plugins with hooks.after running after it may set cookies
> that are not forwarded to the framework cookie store.`

But it does **more** than the SvelteKit plugin, and the difference has a
behavioural consequence:

| | `sveltekitCookies(getRequestEvent)` | `nextCookies()` |
| --- | --- | --- |
| id | `"sveltekit-cookies"` | `"next-cookies"` |
| hooks | `after` only | **`before` and `after`** |
| args | takes `getRequestEvent` | none — dynamically imports `next/headers.js` |

The extra `before` hook matches `ctx.path === "/get-session"` and exists purely
for RSC. Verbatim comment, [1.6.25] `dist/integrations/next-js.mjs`:

```
* Detect RSC via headers, NOT by probing cookies().set().
* In Next.js, cookies().set() unconditionally triggers router
* cache invalidation -- even if the value is unchanged.
*
* RSC sends `RSC: 1` without `next-action`. Only in that
* context cookies cannot be written -- skip session refresh
* to avoid DB/cookie mismatch.
```

It calls `setShouldSkipSessionRefresh(true)` in that case. **Consequence for Send
Lab:** the repo's `session.updateAge: 60 * 60 * 24` sliding renewal will not fire
during RSC renders — only via Server Actions and Route Handlers. On a purely
read-and-navigate usage pattern the 30-day session no longer slides. Worth a
thought given the app's whole point is a returning athlete opening it most days;
in practice any workout logged is a mutation, so the session will slide. But an
athlete who only *reads* their plan for 30 days would be logged out, where today
they would not.

### There is no `hooks.server.ts` equivalent — and this is the real work

The current hook does two things:

1. runs the CSRF guard (§6), and
2. resolves the session once per request onto `event.locals.session` /
   `event.locals.user`, so every `+page.server.ts` and `+server.ts` downstream
   reads it for free.

Neither transfers. App Router has no global server hook with a mutable
per-request `locals`. better-auth's Next page has no section on this at all; it
only shows the per-call form. And `proxy.ts` is explicitly not a substitute —
[docs] <https://nextjs.org/docs/app/api-reference/file-conventions/proxy>: *"To
pass information from Proxy to your application, use headers, cookies, rewrites,
redirects, or the URL"* and *"you should not attempt relying on shared modules or
globals."*

The replacement comes from Next.js's docs, not better-auth's: a **Data Access
Layer** memoised with React's `cache()`. [docs]
<https://nextjs.org/docs/app/guides/authentication> — *"We recommend creating a
DAL to centralize your data requests and authorization logic. The DAL should
include a function that verifies the user's session as they interact with your
application. … Then use React's `cache` API to memoize the return value of the
function during a React render pass."* And [docs]
<https://nextjs.org/docs/app/guides/data-security> — *"Cached helper methods makes
it easy to get the same value in many places without manually passing it around.
This discourages passing it from Server Component to Server Component which
minimizes risk of passing it to a Client Component."*

```ts
// app/lib/dal.ts
import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export const requireSession = cache(async () => {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
});
```

**Marked as inference:** no better-auth doc page endorses the
`cache()`-wrapped-`getSession` pattern by name. It is Next.js's prescription
applied to better-auth's API. Low risk, but it is composition, not documentation.

And it is strictly weaker than `locals`: `cache()` dedupes **within one React
render pass only** — not across a Server Action and the render that follows it,
and not for Route Handlers. So the rebuild will make more `getSession` calls than
the app makes today, not fewer. §2 covers the mitigation.

### Runtime constraints

- **The route handler.** better-auth's docs set no `runtime`, `dynamic`, or
  `revalidate` directive on `app/api/auth/[...all]/route.ts`. Whether this repo
  needs `export const runtime = 'nodejs'` there is **unverified** — no primary
  source addresses it. Practically the Drizzle/libSQL client needs Node, and
  Route Handlers default to Node, but that is not stated in either vendor's docs.
  Open item for ticket 11.
- **`proxy.ts` runs on Node.** [docs]
  <https://nextjs.org/docs/app/api-reference/file-conventions/proxy>: *"Proxy
  defaults to using the Node.js runtime. The `runtime` config option is not
  available in Proxy files. **Setting the `runtime` config option in Proxy will
  throw an error.**"* Version history: `v16.0.0` renamed middleware to proxy and
  defaulted it to Node; `v15.5.0` made Node-runtime middleware stable; `v15.2.0`
  was experimental.
- **A live docs trap.** better-auth's Next page still shows `export const config =
  { runtime: "nodejs", ... }` for the Next 15.2+ band. On Next 16 that **throws**.
  better-auth's docs are mid-migration on this — its own Next-16 proxy example
  still calls the exported config `middleware` in a comment. Do not copy those
  snippets verbatim.
- Migration codemod, per better-auth's own docs:
  `npx @next/codemod@canary middleware-to-proxy .`

### What transfers

| Current | Next | Verdict |
| --- | --- | --- |
| `betterAuth({...})` config object | identical | **transfers unchanged** |
| `drizzleAdapter(db, { provider: 'sqlite', schema })` | identical | **transfers unchanged** |
| `emailAndPassword: { enabled: true }` | identical | **transfers unchanged** |
| `session: { expiresIn, updateAge }` | identical | transfers; see `nextCookies` RSC caveat |
| `user: { deleteUser: { enabled: true } }` | identical | **transfers unchanged** |
| `databaseHooks.user.create.after` (mints API token) | identical | **transfers unchanged** |
| `trustedOrigins` | identical, ports change | transfers, edit values |
| `BETTER_AUTH_SECRET` guard, `baseURL` slash trim | identical | **transfers unchanged** |
| `sveltekitCookies(getRequestEvent)` | `nextCookies()` | one-line swap |
| `svelteKitHandler({ event, resolve, auth, building })` | `toNextJsHandler(auth)` | one-line swap |
| `hooks.server.ts` session-on-locals | **no equivalent** | **rebuild as a DAL** |
| `hooks.server.ts` CSRF guard | **no equivalent** | **rebuild, see §6** |

---

## 2. Reading the session per context — and which reads hit the database

This is the question that shapes ticket 06, so precision matters more here than
anywhere else in this document.

### One server-side primitive, four contexts

There is exactly one server-side read: `auth.api.getSession({ headers })`. It
takes a `Headers`, so the call is *identical* in Server Components, Route
Handlers, Server Actions and `proxy.ts`. [docs]
<https://www.better-auth.com/docs/integrations/next> shows the same snippet for
each:

```ts
const session = await auth.api.getSession({ headers: await headers() });
```

### Does it hit the database? By default, yes — on every call

better-auth's default session strategy is a database `session` table; the cookie
holds a token that must be looked up. [docs]
<https://www.better-auth.com/docs/concepts/session-management>.

The escape hatch is the **cookie cache** — a short-lived signed cookie carrying
the session payload, so the server "checks session validity from the cookie
itself instead of hitting the database each time". [docs] same page.

```ts
session: {
  cookieCache: { enabled: true, maxAge: 5 * 60 },
}
```

Three encodings: `compact` (default, base64url + HMAC-SHA256), `jwt` (*"Signed
but not encrypted - readable by anyone but tamper-proof"*), `jwe` (*"A256CBC-HS512
and HKDF… Fully encrypted"*). [docs] same page. Present in 1.6.25 — [1.6.25]
`dist/cookies/index.d.mts` carries the `strategy` union on `getCookieCache`.

`disableCookieCache: true` on an individual call *"will force the server to fetch
the session from the database and also refresh the cookie cache."*

**Send Lab does not enable `cookieCache` today.** So the current app costs one
Turso round-trip per request for the session — but exactly one, in
`hooks.server.ts`. That "exactly one" is what the rebuild loses by default.

The performance guide is candid this is the intended fix: *"Calling your database
every time `useSession` or `getSession` is invoked isn't ideal, especially if
sessions don't change frequently."* [docs]
<https://www.better-auth.com/docs/guides/optimizing-for-performance>.

Neither page states how many queries one uncached `getSession` makes.
**Unverified** — at least one, possibly more for user + session.

### The per-context table

| Context | Call | DB hit (no cookieCache) | DB hit (cookieCache on) | Can refresh cache cookie? |
| --- | --- | --- | --- | --- |
| Server Component / page | `auth.api.getSession({ headers: await headers() })` | yes, **per call** | no, while fresh | **no** |
| Route Handler | same | yes, per call | no, while fresh | yes |
| Server Action | same | yes, per call | no, while fresh | yes (needs `nextCookies()`) |
| `proxy.ts` (Next 16, Node runtime) | `getSession(...)` **or** `getSessionCookie(req)` / `getCookieCache(req)` | yes for `getSession`; **no** for either cookie helper | no | yes |
| Client Component | `authClient.useSession()` | yes — plus a network hop to `/api/auth/get-session` | no | n/a |

Three rows in that table are load-bearing.

**"Per call" is the trap.** `getSession` is not request-memoised by better-auth.
Three Server Components each reading the session is three database reads. The
Next.js docs prescribe the fix directly: *"Use React's `cache` function to avoid
unnecessary duplicate requests to the database during a render pass."* [docs]
<https://nextjs.org/docs/app/guides/authentication>. **For Send Lab this is not
optional** — one hook that ran once is being replaced by N call sites, and without
`cache()` request cost scales with component count.

**RSCs cannot refresh the cookie cache.** Verbatim: *"As RSCs cannot set cookies,
the cookie cache will not be refreshed until the server is interacted with from
the client via Server Actions or Route Handlers."* [docs]
<https://www.better-auth.com/docs/integrations/next>. So on a read-only session
the cache expires after `maxAge` and reads fall back to the database until the
next Server Action or Route Handler. Cookie cache is a mitigation, not an
elimination.

**Client reads are never cheaper.** `createAuthClient` from `better-auth/react`
gives `useSession()`, backed by nanostores and better-fetch. Every client read is
an HTTP call into the mounted handler, which then does whatever a server read
would do — a server read plus a network hop. Documented mitigation: *"pre-fetch
the user session on the server and use it as a fallback on the client"*. [docs]
<https://www.better-auth.com/docs/guides/optimizing-for-performance>.

### Three tiers of read, only one of which touches the database

[1.6.25] `dist/cookies/index.d.mts` lines 98–116 — exact signatures:

```ts
declare const getSessionCookie: (request: Request | Headers, config?: {
  cookiePrefix?: string;
  cookieName?: string;
  path?: string;
} | undefined) => string | null;

declare const getCookieCache: <S extends {
  session: Session & Record<string, any>;
  user: User & Record<string, any>;
  updatedAt: number;
  version?: string;
}>(request: Request | Headers, config?: {
  cookiePrefix?: string;
  cookieName?: string;
  isSecure?: boolean;
  secret?: string;
  strategy?: "compact" | "jwt" | "jwe";
  version?: string | ((session, user) => string) | ((session, user) => Promise<string>);
} | undefined) => Promise<S | null>;
```

| Helper | DB? | Verifies? | Import |
| --- | --- | --- | --- |
| `getSessionCookie(request)` | no | **no** — existence only | `better-auth/cookies` |
| `getCookieCache(request)` | no | yes, signature-verifies the cached blob | `better-auth/cookies` |
| `auth.api.getSession({ headers })` | **yes** | full | your `@/lib/auth` |

`getCookieCache` is strictly more useful than `getSessionCookie` once
`cookieCache` is on: same zero-DB cost, but it verifies and returns a real
`{ session, user }`. Both live in `better-auth/cookies`, not
`better-auth/next-js`.

Gotcha, [docs] same page: *"The `getSessionCookie()` function does not
automatically reference the auth config specified in `auth.ts`. Therefore, if you
customized the cookie name or prefix, you need to ensure that the configuration
in `getSessionCookie()` matches"*. Send Lab uses defaults, so this is a non-issue
today — but it is a silent-failure mode if the cookie prefix is ever customised.

Default cookie naming, [docs]
<https://www.better-auth.com/docs/concepts/cookies>: prefix `better-auth`, format
`${prefix}.${cookie_name}`, cookies `session_token`, `session_data` (the cache),
`dont_remember`. [1.6.25] also declares a fourth, `accountData`, plus
`HOST_COOKIE_PREFIX` / `SECURE_COOKIE_PREFIX` / `stripSecureCookiePrefix` — none
of which the docs mention. Treat those as source-only.

Revocation caveat, [docs]
<https://www.better-auth.com/docs/concepts/session-management>: *"When
`cookieCache` is enabled, revoked sessions may remain active on other devices
until the cookie cache expires (`maxAge`)."*

### What this implies for ticket 06

1. **One DAL module.** Every session read goes through it; nothing calls
   `auth.api.getSession` directly.
2. **Wrap it in React `cache()`.** Non-negotiable, per the reasoning above.
3. **Turn on `session.cookieCache`** (5 min is the docs' own example). Send Lab is
   single-athlete-per-account with 30-day sliding sessions and already tolerates a
   full day of staleness via `updateAge: 60 * 60 * 24`; a 5-minute revocation
   window is cheap by comparison.
4. **Do not read the session in a layout.** [docs]
   <https://nextjs.org/docs/app/guides/authentication>: layouts *"don't re-render
   on navigation, meaning the user session won't be checked on every route
   change"*, and *"a layout also does not control whether the rest of the route
   renders. Route segments and parallel route slots are rendered by the router, so
   a layout that hides or swaps them does not stop them from running or from
   appearing in the RSC Payload."* Returning `null` in a layout for unauthorised
   users is called out as *"**not recommended** since Next.js applications have
   multiple entry points."* This is a direct behavioural difference from today's
   `src/routes/+layout.ts`.
5. **Push the read down, wrap in `<Suspense>`** where only part of the shell needs
   it, so the page still streams. [docs] same page, "Auth and streaming": a
   top-level `await` on the DAL in a layout *"delays the first streamed chunk for
   that segment and holds `{children}` behind that work."*
6. **Client Components cannot import the DAL.** Read in a parent Server Component
   and pass down as props or via a context provider; `taintUniqueValue` keeps
   sensitive fields from reaching the client. [docs] same page.

---

## 3. Route protection, and whether the proxy can be trusted

### Terminology: middleware is now `proxy`

Next.js 16 renamed `middleware.ts` → `proxy.ts` and the exported function
`middleware` → `proxy`. [docs]
<https://nextjs.org/docs/messages/middleware-to-proxy>,
<https://nextjs.org/docs/app/getting-started/proxy> (v16.3.1). *"The functionality
remains the same."* Anything written about "better-auth middleware in Next.js"
predates this and needs translating.

### The recommended pattern

[docs] <https://www.better-auth.com/docs/integrations/next> has a section titled
"How to handle auth checks in each page/route":

```tsx
export default async function DashboardPage() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) { redirect("/sign-in") }
    return <h1>Welcome {session.user.name}</h1>
}
```

And for the proxy: *"In Next.js proxy/middleware, it's recommended to only check
for the existence of a session cookie to handle redirection to avoid blocking
requests by making API or database calls."*

### The proxy is advisory. It is not authorization.

Both vendors say so, unprompted, in their own words.

**better-auth**, as a comment inside its own middleware sample:

> ```
> // THIS IS NOT SECURE!
> // This is the recommended approach to optimistically redirect users
> // We recommend handling auth checks in each page/route
> ```

and its security callout: *"The `getSessionCookie` function only checks for the
existence of a session cookie; it does **not** validate it. Relying solely on this
check for security is dangerous, as anyone can manually create a cookie to bypass
it. You must always validate the session on your server for any protected actions
or pages."* [docs] <https://www.better-auth.com/docs/integrations/next>

**Next.js**: *"While Proxy can be helpful for optimistic checks such as
permission-based redirects, it should not be used as a full session management or
authorization solution."* [docs]
<https://nextjs.org/docs/app/getting-started/proxy>

*"since Proxy runs on every route, including prefetched routes, it's important to
only read the session from the cookie (optimistic checks), and avoid database
checks to prevent performance issues."* — and — *"While Proxy can be useful for
initial checks, **it should not be your only line of defense in protecting your
data.** The majority of security checks should be performed as close as possible
to your data source."* [docs]
<https://nextjs.org/docs/app/guides/authentication>

*"[Server Functions] are handled as POST requests to the route where they are
used, so a Proxy matcher that excludes a path will also skip Server Function
coverage on that path. A matcher change or a refactor that moves a Server
Function to a different route can silently remove Proxy coverage. **Always verify
authentication and authorization inside each Server Function rather than relying
on Proxy alone.**"* — and — *"We recommend users avoid relying on Middleware unless
no other options exist."* [docs]
<https://nextjs.org/docs/app/api-reference/file-conventions/proxy>

*"A page-level authentication check does not extend to the Server Actions defined
within it. Always re-verify inside the action… The page-level redirect controls
which UI is rendered, but the Server Action is a separate entry point and must
verify the caller on its own."* [docs]
<https://nextjs.org/docs/app/guides/data-security>

So: **advisory only.** Unambiguous, from both primary sources.

### The architectural proof, not just the advice

CVE-2025-29927, "Authorization Bypass in Next.js Middleware" — **Critical, CVSS
9.1**. A crafted `x-middleware-subrequest` request header caused middleware to be
skipped entirely, making any middleware-implemented authorization a no-op.
Affected `>=12.0.0 <12.3.5`, `>=13.0.0 <13.5.9`, `>=14.0.0 <14.2.25`,
`>=15.0.0 <15.2.3`; patched in 12.3.5 / 13.5.9 / 14.2.25 / 15.2.3. Vercel-hosted
apps were auto-protected. [docs]
<https://github.com/advisories/GHSA-f82v-jwr5-mffw>

This is why "advisory" is not a stylistic preference: a single header made every
middleware-only gate a no-op across four major versions.

### The pattern to build

- **`proxy.ts`** — `getSessionCookie(request)` (or `getCookieCache`) for the
  redirect-to-login UX only. No database. Runs on all routes for auth (Next's own
  tip), matcher excluding `/api`, `_next/static`, `_next/image`.
- **`app/lib/dal.ts`** — `requireSession()`, `cache()`-wrapped,
  `redirect('/login')` on failure. **This is the actual gate.**
- **Every page, Server Action and Route Handler calls it.** Next.js says to treat
  Server Actions and Route Handlers *"with the same security considerations as
  public-facing API endpoints."* Its audit checklist singles them out: *"`proxy.ts`
  and `route.ts`: Have a lot of power. Spend extra time auditing these using
  traditional techniques."*
- **Not in layouts.** See §2 point 4.

One structural note for ticket 06: the current app runs `ssr: false`, so today's
protection is client-side plus per-endpoint server checks. The rebuild inverts
that — protection becomes server-side by default. Net improvement, but it changes
the login-bounce feel, and it removes the stated reason `/oauth/authorize` exists
as a plain server-rendered page (*"none of which the app's client-only rendering
(ssr=false) would handle reliably"*).

---

## 4. The Drizzle adapter and schema drift

**Headline: the column sets are already exactly right. All four core tables, all
34 columns — no missing columns, no extra columns, no type mismatches. Nothing
added in 1.6.21–1.6.29 that the repo lacks.** That last part is proven, not
assumed: `@better-auth/core`'s `dist/db/get-tables.mjs` is byte-identical between
1.6.25 and 1.6.29, and differs from 1.6.20 only in `disableMigrations`
propagation and one FK `model:` literal — no field definitions changed.

So `src/lib/server/db/schema.ts`'s better-auth half **transfers unchanged**, and
so does the `drizzleAdapter(db, { provider: 'sqlite', schema })` line. Two pieces
of genuine drift exist, and neither is caused by the framework change — they are
latent today.

### Import path

The docs page now shows `import { drizzleAdapter } from "@better-auth/drizzle-adapter"`
with a separate install. [docs] <https://www.better-auth.com/docs/adapters/drizzle>.
The repo's `better-auth/adapters/drizzle` still works and is not deprecated —
[1.6.25] `dist/adapters/drizzle-adapter/index.d.mts` is literally
`export * from "@better-auth/drizzle-adapter";`, a pure re-export of an
already-installed transitive dep. Same code either way. No action needed.

### Adapter options

`interface DrizzleAdapterConfig`, from the installed
`@better-auth/drizzle-adapter` declarations (identical at 1.6.25):

| Option | Type | Default | Doc comment (verbatim from source) |
| --- | --- | --- | --- |
| `provider` | `"pg" \| "mysql" \| "sqlite"` | **required** | "The database provider" |
| `schema` | `Record<string, any>` | optional | "The schema object that defines the tables and fields" |
| `usePlural` | `boolean` | optional | "If the table names in the schema are plural set this to true" |
| `debugLogs` | `DBAdapterDebugLogOption` | `false` | "Enable debug logs for the adapter" |
| `camelCase` | `boolean` | `false` | "By default snake case is used… **when the CLI is used to generate the schema.** If you want to use camel case, set this to true." |
| `transaction` | `boolean` | `false` | "Whether to execute multiple operations in a transaction. If the database doesn't support transactions, set this to `false`…" |

Answering the ticket's specific asks: `usePlural` exists; `debugLogs` exists but
is typed `DBAdapterDebugLogOption`, not a plain boolean; `camelCase` exists but
**governs CLI output, not runtime column mapping**; there is **no `snake_case`
option**. Runtime renaming lives on the `betterAuth()` root config instead —
`user: { fields: { email: "email_address" } }` and `user: { modelName: "users" }`.

`transaction` is **not documented** on the adapter page — source-only. Relevant
for Turso/libSQL, where transaction support is worth confirming before relying on
it.

Also on that page and not currently set here: `experimental: { joins: true }`,
described as *"2x-3x depending on database latency."* On Turso, where latency
dominates, that is worth evaluating during the rebuild.

### The canonical schema (1.6.25)

From `getAuthTables` in `@better-auth/core`'s `dist/db/get-tables.mjs`, agreeing
with [docs] <https://www.better-auth.com/docs/concepts/database>:

- **`user`** — `id` PK · `name` req · `email` req **unique** · `emailVerified`
  boolean req default `false` · `image` opt · `createdAt` req · `updatedAt` req
- **`session`** — `id` PK · `expiresAt` req · `token` req **unique** · `createdAt`
  req · `updatedAt` req · `ipAddress` opt · `userAgent` opt · `userId` req
  **`index: true`** FK → `user.id` cascade
- **`account`** — `id` PK · `accountId` req · `providerId` req · `userId` req
  **`index: true`** FK cascade · `accessToken` opt · `refreshToken` opt · `idToken`
  opt · `accessTokenExpiresAt` opt · `refreshTokenExpiresAt` opt · `scope` opt ·
  `password` opt · `createdAt` req · `updatedAt` req
- **`verification`** — `id` PK · `identifier` req **`index: true`** · `value` req ·
  `expiresAt` req · `createdAt` **req** · `updatedAt` **req**

Conditional tables, none applicable: `session`/`verification` are omitted when
`secondaryStorage` is set; `rateLimit` is added only when
`options.rateLimit.storage === "database"`. The repo sets neither, so four tables
is correct.

### Drift 1 — `verification.createdAt` / `updatedAt` are nullable, should not be

```ts
// src/lib/server/db/schema.ts:57-58 — as written
createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
```

`get-tables.mjs` marks both `required: true`, and the docs table says Required =
Yes. Every other `createdAt`/`updatedAt` in this schema carries `.notNull()`;
these two do not. Impact is low — the adapter always supplies a value — but
Drizzle infers `Date | null` and the DB permits NULL, diverging from what
`auth generate` would emit.

This is the cheapest fix in the report: `verification` holds only transient
email-verification / reset rows, so per the repo's `no-backwards-compat` memory
this is the one table where a rebuild is genuinely low-risk. Still apply it as
explicit DDL through `@libsql/client`, not a blind `db:push`.

### Drift 2 — all three recommended indexes are missing

`get-tables.mjs` marks `index: true` on `session.userId`, `account.userId` and
`verification.identifier`. `schema.ts` declares **zero** indexes. Corroborated by
[docs] <https://www.better-auth.com/docs/guides/optimizing-for-performance>, which
recommends indexing `user.email`, `account.userId`, `session.userId`,
`session.token`, `verification.identifier`.

SQLite gives two of those five for free via UNIQUE constraints (`user.email`,
`session.token`). The three genuinely missing are `session.userId`,
`account.userId`, `verification.identifier`. **A `REFERENCES` clause does not
create an index on the child column in SQLite**, so `session.userId` and
`account.userId` are unindexed today — hit on every session-adjacent lookup and
on cascade deletes, which matters for the repo's `deleteUser` flow on Turso where
round-trip latency dominates.

The CLI will not fix this — same docs page: *"We intend to add indexing support in
our schema generation tool in the future."* `auth generate` emits no indexes;
hand-writing them is expected.

### Non-drift, recorded so it isn't mistaken for drift later

- `session.createdAt` and the `updatedAt` columns lack `$defaultFn`/`$onUpdate`.
  Fine — `get-tables.mjs` owns `defaultValue`/`onUpdate` and the adapter writes
  explicit values. Drizzle-level defaults are belt-and-braces.
- `user.emailVerified` as `integer(..., { mode: 'boolean' })` is correct for
  `type: "boolean"` on SQLite.
- Every date field uses `integer(..., { mode: 'timestamp' })`, consistent with
  `provider: 'sqlite'`.
- The adapter is handed the **whole** schema module including the seven app tables.
  Harmless: it only looks up keys it needs, and the singular names match defaults,
  so no `usePlural` and no `schema:` remapping.

### CLI generation

[docs] <https://www.better-auth.com/docs/concepts/cli>. The package is invoked as
**`auth`**, not `@better-auth/cli`: *"For Drizzle, it goes to `schema.ts` in your
project root."*

```bash
pnpm dlx auth@latest generate    # better-auth -> schema.ts
pnpm dlx drizzle-kit generate    # schema.ts -> SQL migration
pnpm dlx drizzle-kit migrate     # apply
```

Flags: `--output`, `--config`, `--yes`. **`migrate` will not work here** — *"This
is available if you're using the built-in Kysely adapter. For other adapters,
you'll need to apply the schema using your ORM's migration tool."*

**Caution:** `generate` writes `schema.ts` to the **project root** and emits only
better-auth's four tables. This repo's `src/lib/server/db/schema.ts` also holds
seven app-owned tables with FKs into `user`. Point `--output` somewhere disposable
and diff by hand; never let it overwrite the real file.

**Unverified:** whether `@better-auth/cli` exists as an installable name
alongside the `auth` alias. Docs only ever show `auth@latest`.

---

## 5. Bearer-token and API-key auth

Two plugins, and the ticket's framing conflates them. Neither is a drop-in
replacement for `src/lib/server/apiToken.ts`, for different reasons.

### The `bearer` plugin is not what its name suggests

It is **not** an opaque-API-token plugin. It takes better-auth's own **session
token** from `Authorization: Bearer <session-token>`, HMAC-verifies it against
`ctx.context.secret`, and injects it into the request as the session cookie. It
never consults a token table. [1.6.25] `dist/plugins/bearer/index.mjs` — the
export's own JSDoc is literally `Converts bearer token to session cookie`, and the
`before` hook ends with:

```js
setRequestCookie(headers, c.context.authCookies.sessionToken.name, decodedToken);
```

So a string like `sl_abc123` fails HMAC verification and the hook simply returns
— no session. Confirmed at 1.6.25.

You obtain the token from an `after` hook that copies the outgoing session cookie
into a `set-auth-token` response header; [docs]
<https://www.better-auth.com/docs/plugins/bearer> shows the client reading
`ctx.response.headers.get("set-auth-token")`. Its own caveat: *"Use this
cautiously; it is intended only for APIs that don't support cookies or require
Bearer tokens for authentication. Improper implementation could easily lead to
security vulnerabilities."*

One option, `requireSignature` (default `false`) — [1.6.25]
`dist/plugins/bearer/index.d.mts`. With the default, an unsigned token (no `.`) is
signed by better-auth on the fly before verification; with `true`, the signed
`<token>.<hmac>` form is demanded.

**Conclusion:** the bearer plugin is useful only if you want MCP/REST clients to
authenticate with a real better-auth session token instead of a cookie. It does
not replace `apiToken.ts`.

### The API-key plugin is a separate package

**There is no `api-key` plugin in core better-auth 1.6.25.** Verified three ways:
no `api-key` directory in [1.6.25] `dist/plugins/`; no `apiKey` export in
[1.6.25] `dist/plugins/index.d.mts`; no `./plugins/api-key` entry in the package
`exports` map. It was split out in the 1.5 line into **`@better-auth/api-key`**.

```ts
import { apiKey } from '@better-auth/api-key';
import { apiKeyClient } from '@better-auth/api-key/client';
```

[docs] <https://www.better-auth.com/docs/plugins/api-key>

`@better-auth/api-key@1.6.25` peer deps, from the npm registry:

```json
{ "better-auth": "^1.6.25", "better-call": "1.3.7",
  "@better-auth/core": "^1.6.25", "@better-auth/utils": "0.4.2" }
```

All four match the repo's committed lockfile exactly, so it drops in cleanly at
the targeted version.

### What it offers

Server API — `auth.api.createApiKey`, `getApiKey`, `listApiKeys`,
`updateApiKey`, `deleteApiKey`, `verifyApiKey`, `deleteAllExpiredApiKeys`. HTTP
paths exist for the first five (`POST /api-key/create`, `/api-key/get`,
`/api-key/list`, `/api-key/update`, `/api-key/delete`). **`verifyApiKey` is
declared `serverOnly` — deliberately not exposed over HTTP**, called as
`auth.api.verifyApiKey({ body: { key, permissions?, configId? } })`, returning
`{ valid, error, key }`.

**One new table: `apikey`.** No changes to `user` or `session`. Columns: `id`,
`configId`, `name`, `start`, `prefix` (plaintext), `key` (**hashed**),
`referenceId` (owner), `refillInterval`, `refillAmount`, `lastRefillAt`,
`enabled`, `rateLimitEnabled`, `rateLimitTimeWindow`, `rateLimitMax`,
`requestCount`, `remaining`, `lastRequest`, `expiresAt`, `createdAt`,
`updatedAt`, `permissions`, `metadata`. Note the 1.6 rename `userId` →
`referenceId`, because keys can be user- or org-owned.

Notable defaults: `apiKeyHeaders: "x-api-key"`, `defaultKeyLength: 64`,
`disableKeyHashing: false`, `rateLimit: { enabled: true, timeWindow: 86400000,
maxRequests: 10 }`, `keyExpiration.defaultExpiresIn: null`,
`startingCharactersConfig: { shouldStore: true, charactersLength: 6 }`,
`enableSessionForAPIKeys: false`. Plus `customAPIKeyGetter`,
`customAPIKeyValidator`, `customKeyGenerator`, `permissions.defaultPermissions`.

Two useful compatibility facts: the create-body prefix regex is
`/^[a-zA-Z0-9_-]+$/`, so **`sl_` is a legal prefix**; and `expiresIn` defaults to
`null`, so **non-expiring keys are supported** — matching current behaviour.

It can also produce a session. [docs]
<https://www.better-auth.com/docs/plugins/api-key/advanced#sessions-from-api-keys>
— with `enableSessionForAPIKeys: true`, *"Any time an endpoint in Better Auth is
called that has a valid API key in the headers, you can automatically create a
mock session"*, readable via
`auth.api.getSession({ headers: new Headers({ 'x-api-key': apiKey }) })`. The
session is synthesised in memory; no `session` row is written. Documented limit:
*"Session mocking only works with user-owned API keys (where `references:
"user"`). Organization-owned keys cannot mock user sessions."*

### The crux: it cannot re-reveal the token. This is definitive.

`src/lib/server/apiToken.ts` stores the token in **plaintext, deliberately**, so
Settings can re-reveal it — that is stated in the file's own header comment. The
plugin cannot do this.

Keys are SHA-256 hashed at rest by default — [1.6.25] `@better-auth/api-key`
`dist/index.mjs`: `const defaultKeyHasher = async (key) => ...` and, at create
time, `opts.disableKeyHashing ? key : await defaultKeyHasher(key)`.

The plaintext is returned **exactly once**, from `createApiKey`. **All four read
paths strip it unconditionally** — verified at 1.6.25:

```js
const { key: _key, ...returningApiKey } = apiKey     // getApiKey
const { key: _key, ...rest }            = apiKey     // listApiKeys
const { key: _key, ...returningApiKey } = newApiKey  // updateApiKey
const { key: _,    ...returningApiKey } = apiKey     // verifyApiKey
```

So with defaults, plaintext retrieval is **impossible** — the plaintext is not in
the database at all, only its digest. What the plugin offers instead is the
industry-standard partial reveal: `prefix` (stored plaintext) + `start` (first six
characters). The docs describe `start` as *"Shows the first few characters of the
API key, including the prefix. This allows you to show those few characters in the
UI to make it easier for users to identify the API key."* That gives Settings
`sl_abc…`, not the full token.

`disableKeyHashing: true` stores the key verbatim — but **the four destructures
above are unconditional and do not consult that flag**, so `auth.api.*` still will
not return it. You would have to query the `apikey` table directly with Drizzle,
bypassing the plugin's API. And [docs]
<https://www.better-auth.com/docs/plugins/api-key/reference> warns: *"It's strongly
recommended to not disable hashing. Storing API keys in plaintext makes them
vulnerable to database breaches, potentially exposing all your users' API keys."*

### Side-by-side

| Requirement | `apiToken.ts` (current) | `@better-auth/api-key` |
| --- | --- | --- |
| Exactly one token per athlete | **enforced structurally** (`user_id` is PK) | not enforced — N keys per `referenceId`; app-level only |
| **Re-reveal full token in Settings** | **yes**, plaintext read | **no** — hashed, and reads strip `key` even with hashing off |
| Prefix `sl_` | hardcoded in `mint()` | supported; regex permits `sl_` |
| No expiry | inherent | supported (`expiresIn` defaults `null`) |
| Regenerate swaps in place | `onConflictDoUpdate` on `user_id` | delete + create; new `id` |
| `Authorization: Bearer` header | `bearerFromRequest()` | `x-api-key` default; needs `apiKeyHeaders` or `customAPIKeyGetter` |
| Resolve token → userId | `userIdFromToken()` | `verifyApiKey()` → `key.referenceId`, or mock session |
| Rate limit / metadata / scopes / multiple named keys / expiry | none | all built in |

On the header: `getApiKeyFromConfig` is just
`ctx.headers?.get(config.apiKeyHeaders)`, so setting `apiKeyHeaders:
"authorization"` would include the literal `"Bearer "` in the key value.
`customAPIKeyGetter` is the clean route if the `Authorization: Bearer sl_…`
contract must be preserved.

### Verdict

The plugin is strictly more capable on every axis **except** the one deliberate
design choice this repo made. There is no configuration that gives you both the
plugin and full-token re-reveal through the supported API.

Two honest options for the rebuild:

1. **Adopt the plugin and change the UX** to "shown once on creation, `sl_abc…`
   thereafter." This is the correct security posture and what every other API-key
   UI does. It costs one new `apikey` table and buys expiry, rate limiting,
   scopes, and multiple named keys — the last of which is genuinely useful if an
   athlete ever connects more than one AI client.
2. **Keep `apiToken.ts`.** It is 56 lines, it transfers unchanged (it is plain
   Drizzle with no SvelteKit coupling beyond the `$lib` alias), and it satisfies a
   requirement the plugin structurally cannot.

Given the map's "breakage is cheap, spend that freedom" framing and only five
accounts, option 1 is the better trade — but it is a product decision about the
Settings screen, not a technical blocker, and it should be made deliberately.

Note the interaction with §1: `databaseHooks.user.create.after` currently mints
the token at signup so it is ready when Settings first opens. Under option 1 that
hook would mint a key whose plaintext is discarded immediately — pointless. The
hook would be dropped and key creation moved to an explicit user action.

---

## 6. CSRF and origin checking

### Next.js: Server Actions are protected, Route Handlers are not

**Server Actions have a built-in Origin↔Host check.** [docs]
<https://nextjs.org/docs/app/guides/data-security>, verbatim:

> Behind the scenes, Server Actions use the `POST` method, and only this HTTP
> method is allowed to invoke them. This prevents most CSRF vulnerabilities in
> modern browsers, particularly with SameSite cookies being the default.
>
> As an additional protection, Server Actions in Next.js also compare the Origin
> header to the Host header (or `X-Forwarded-Host`). If these don't match, the
> request will be aborted. In other words, Server Actions can only be invoked on
> the same host as the page that hosts it.

`serverActions.allowedOrigins` is confirmed as the escape hatch and supports
wildcards. [docs]
<https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions>:
*"A list of extra safe origin domains from which Server Actions can be invoked…
If not provided, only the same origin is allowed."*

```js
experimental: { serverActions: { allowedOrigins: ['my-proxy.com', '*.my-proxy.com'] } }
```

**Route Handlers get nothing.** The complete `route.js` reference documents
methods, params, cookies, headers, body, `formData()`, webhooks, streaming,
segment config, and CORS — the last of which you hand-write yourself. There is
**zero** mention of CSRF, origin validation, or request rejection. [docs]
<https://nextjs.org/docs/app/api-reference/file-conventions/route>. The
data-security guide scopes its whole CSRF discussion under Server Actions, and
mentions Route Handlers only in its audit checklist: *"`proxy.ts` and `route.ts`:
Have a lot of power. Spend extra time auditing these using traditional
techniques."* Proxy likewise has no built-in origin behaviour — it hands you
`request.headers.get('origin')` and you write the check.

**Stated as unverified:** no Next.js page affirmatively says "Route Handlers have
no CSRF protection." The conclusion rests on the absence of any such claim across
the three most relevant pages plus the explicit instruction to audit them
yourself. No behavioural test was run.

### better-auth: `trustedOrigins`, and a rule that is the inverse of SvelteKit's

[docs] <https://www.better-auth.com/docs/reference/options>: defaults to trusting
`baseURL`; accepts a static array, a function returning origins dynamically, or
wildcard patterns (`*` matches non-`/` chars, `?` one char, `**` crosses `/`).
Caveat: *"the `request` parameter is `undefined` during initialization and when
calling `auth.api` directly."* Related escape hatches, both flagged with warnings:
`advanced.disableOriginCheck` and `advanced.disableCSRFCheck` (*"Disable all CSRF
protection including origin header validation and Fetch Metadata checks"*).

The mechanism — [1.6.25] `dist/api/middlewares/origin-check.mjs`, `validateOrigin`:

```js
const originHeader = headers.get("origin") || headers.get("referer") || "";
const useCookies = headers.has("cookie");
if (ctx.context.skipCSRFCheck) return;
if (shouldSkipCSRFForBackwardCompat(ctx)) { ...; return; }
if (shouldSkipOriginCheck(ctx)) return;
if (!(forceValidate || useCookies)) return;                 // <- THE KEY LINE
if (!originHeader || originHeader === "null")
  throw APIError.from("FORBIDDEN", BASE_ERROR_CODES.MISSING_OR_NULL_ORIGIN);
if (!trustedOrigins.some((origin) => matchesOriginPattern(originHeader, origin)))
  throw APIError.from("FORBIDDEN", BASE_ERROR_CODES.INVALID_ORIGIN);
```

Behaviours that matter:

- `originCheckMiddleware` returns immediately for `GET`/`OPTIONS`/`HEAD`.
- Origin falls back to `Referer`.
- **`if (!(forceValidate || useCookies)) return;` — a request with no `Cookie`
  header is not origin-checked at all.** This is the exact opposite of SvelteKit's
  unconditional rule.
- Errors are `403` with `MISSING_OR_NULL_ORIGIN` (only reachable when cookies are
  present) or `INVALID_ORIGIN`.

There is a second layer for first-login, applied only to sign-in and sign-up
(`formCsrfMiddleware`). [docs]
<https://www.better-auth.com/docs/reference/security>:

> Better Auth uses Fetch Metadata headers (`Sec-Fetch-Site`, `Sec-Fetch-Mode`,
> `Sec-Fetch-Dest`) to provide additional CSRF protection specifically for
> **first-login scenarios**, where the client does not yet have any cookies.
> - Cross-site navigation requests (e.g. `Sec-Fetch-Site: cross-site`) are blocked
> - If `Origin` or `Referer` headers are present, they're validated against
>   `trustedOrigins`
> - **Only when the request carries neither Fetch Metadata headers nor an
>   `Origin`/`Referer`** are non-browser clients permitted

So a server-to-server POST with no `Cookie`, no `Origin`, no `Referer` and no
`Sec-Fetch-*` passes better-auth's gate — **by deliberate policy**, per its own
docs.

### Would the SvelteKit bug reappear? No — for two independent reasons

Restating the bug from `src/lib/server/csrf.ts`: SvelteKit's `csrf.checkOrigin`
403s any form-content-type POST with a **missing** `Origin`, before the handler
runs, and `csrf.trustedOrigins` is only consulted when an Origin *is* present.
That killed the RFC 6749 §4.1.3 token endpoint (form-encoded, server-to-server, no
Origin). The asymmetry — JSON registration passed, form-encoded token exchange did
not — is why the symptom was a pile of orphaned client registrations rather than
an obvious auth failure.

**Reason 1: Next.js has no equivalent gate on Route Handlers.** An OAuth token
endpoint would be `app/oauth/token/route.ts`. Next's Origin↔Host comparison is a
Server Actions feature; nothing applies it to Route Handlers. There is no
`csrf.checkOrigin` to disable and no content-type-based rule at all. (Subject to
the unverified-negative caveat above.)

**Reason 2: better-auth's rule is the inverse.** Missing-Origin-plus-no-cookie is
the *permitted* case, not the rejected one. better-auth would not have produced
this bug in the first place.

**But the trade-off flips, and this is the part to plan for.** On Next.js you do
not fight a framework guard to ship an RFC-compliant token endpoint — and you also
get **nothing for free** on your Route Handlers. Every state-changing,
cookie-authenticated Route Handler needs its own origin check. That is
substantially the module already written in `csrf.ts`, minus the `EXEMPT_PATHS`
hack that only existed to work around SvelteKit.

So `src/lib/server/csrf.ts` **mostly transfers**, with its purpose inverted: today
it is a workaround re-implementing a framework guard so one path can opt out;
on Next.js it becomes the primary protection, applied deliberately. Its
`FORM_CONTENT_TYPES` reasoning stays valuable — including the `text/plain` note,
which is a real cross-site-submittable content type whose `name=value` encoding
can be crafted to parse as JSON. The file is dependency-free by design and its
tests (`tests/csrf.test.ts`) import it directly with no SvelteKit runtime, so both
move across as-is.

Apply it in `proxy.ts` (Node runtime, runs before route handlers) or as a shared
helper each handler calls. Prefer the shared helper for the same reason §3 says
not to trust the proxy: a matcher change can silently remove proxy coverage.

### Scope: `trustedOrigins` does not cover app routes

`originCheckMiddleware` is registered inside better-auth's own router only —
[1.6.25] `dist/api/index.mjs`:

```js
return createRouter(api, {
  routerContext: ctx,
  basePath,
  routerMiddleware: [{ path: "/**", middleware: originCheckMiddleware }, ...middlewares],
  allowedMediaTypes: ["application/json"],
```

`path: "/**"` is relative to better-auth's `basePath` (`/api/auth`). Your own
Route Handlers, Server Actions and pages get **no** coverage from
`trustedOrigins`. Note also `allowedMediaTypes: ["application/json"]` —
better-auth's own endpoints are JSON-only by default, a second reason form-encoded
POSTs were never a scenario its guard was built for.

`trustedOrigins` in `src/lib/server/auth.ts` still transfers verbatim; just change
`5173` to `3000`.

---

## 7. Could the MCP or OIDC-provider plugin replace the hand-rolled OAuth server?

**Yes in principle — but not via either plugin the ticket names.** The target is
`@better-auth/oauth-provider`, and the good news is it is installable at the
repo's currently-targeted better-auth version with no core upgrade.

### What is being replaced

712 lines across eight files, not ~600:

| File | Lines |
| --- | --- |
| `src/lib/server/oauth.ts` | 339 |
| `src/routes/oauth/authorize/+server.ts` | 189 |
| `src/routes/oauth/token/+server.ts` | 79 |
| `src/lib/server/oauthCleanup.ts` | 42 |
| `src/routes/oauth/register/+server.ts` | 21 |
| `src/routes/.well-known/oauth-protected-resource/[...resource]/+server.ts` | 20 |
| `src/routes/.well-known/oauth-authorization-server/+server.ts` | 11 |
| `src/routes/.well-known/oauth-protected-resource/+server.ts` | 11 |
| **total** | **712** |

Plus four schema tables (`oauth_client`, `oauth_code`, `oauth_access_token`,
`oauth_refresh_token`), `tests/oauthCleanup.test.ts`, and ADR-0004.

### Both named plugins are deprecated

[1.6.25] `dist/plugins/index.d.mts` exports `mcp`, `oidcProvider`, `withMcpAuth`,
`getMCPProviderMetadata`, `getMCPProtectedResourceMetadata`,
`oAuthDiscoveryMetadata`, `oAuthProtectedResourceMetadata`. Both plugins exist and
are importable from `better-auth/plugins`.

But:

- MCP plugin: it *"will be deprecated in favor of the OAuth Provider Plugin"* and
  is *"based on OIDC Provider plugin."* [docs]
  <https://www.better-auth.com/docs/plugins/mcp>
- OIDC provider carries two warnings: *"This plugin will soon be deprecated in
  favor of the OAuth Provider Plugin"* and *"This plugin is in active development
  and **may not be suitable for production use**."* [docs]
  <https://www.better-auth.com/docs/plugins/oidc-provider>

The dependency is literal, not marketing — [1.6.25] `dist/plugins/mcp/index.mjs`
constructs `oidcProvider({ ...opts, __skipDeprecationWarning: true })`. **The MCP
plugin *is* the OIDC provider with MCP-shaped defaults and paths.**

### And they had the bug this repo did not

CVE-2026-53512, moderate: the `oidcProvider` and `mcp` token endpoints failed to
authenticate confidential clients on the refresh-token grant — *"Neither plugin
verifies the registered confidential client's `client_secret` on the refresh
path."* An attacker with a refresh token and a public client ID could mint access
tokens indefinitely. Affected `better-auth < 1.6.11`, patched in `1.6.11`. The
newer `@better-auth/oauth-provider` is unaffected. [docs]
<https://github.com/better-auth/better-auth/security/advisories/GHSA-pw9m-5jxm-xr6h>

Two things follow. The repo at 1.6.25 (or even the stale 1.6.20) is **not
affected**. And Send Lab's hand-rolled server **never had this bug** —
`exchangeRefreshToken` in `src/lib/server/oauth.ts` calls
`authenticateClient(clientId, clientSecret)` before touching the token. Worth
knowing before assuming the library is automatically the safer option: the
hand-rolled code was correct exactly where the library was not.

### The actual target: `@better-auth/oauth-provider`

```ts
import { oauthProvider } from '@better-auth/oauth-provider';
```

[docs] <https://better-auth.com/docs/plugins/oauth-provider>

**Version compatibility is the key finding.** The package versions in lockstep
with core and pins its peers exactly. `@better-auth/oauth-provider@1.6.25`:

```json
{ "better-auth": "^1.6.25", "better-call": "1.3.7",
  "@better-auth/core": "^1.6.25", "@better-auth/utils": "0.4.2",
  "@better-fetch/fetch": "1.3.1" }
```

**Every one matches the repo's committed `pnpm-lock.yaml`.** So this is a drop-in
add at the targeted version — no core upgrade. Versions 1.6.20 through 1.6.29 are
published; `1.6.29` is `latest`.

Coverage against what Send Lab hand-rolled, [docs] same page:

| Send Lab needs | Plugin |
| --- | --- |
| RFC 8414 AS metadata | `GET /.well-known/oauth-authorization-server` + path-prefixed alias |
| RFC 7591 dynamic client registration | `POST /oauth2/register`, gated by `allowDynamicClientRegistration` |
| PKCE S256 authorization-code grant | required by default, S256 only, `plain` rejected |
| refresh-token grant with rotation | *"new refresh token for every refresh request"* |
| token endpoint | `POST /oauth2/token` |
| authorize endpoint | `GET/POST /oauth2/authorize` |
| RFC 9728 protected-resource metadata | via `mcpHandler()`; the bare `/.well-known/oauth-protected-resource` helper is described as deprecated in its favour |
| expired-token cleanup (`oauthCleanup.ts`) | token lifecycle is the plugin's; **unverified** whether it purges rows or merely expires them |

And a long list of things Send Lab hand-rolled nothing for: RFC 7662
introspection, RFC 7009 revocation, RFC 9207 issuer validation, client CRUD,
consent CRUD, client-secret rotation, per-endpoint rate limiting,
`storeClientSecret: "hashed" | "encrypted"` (Send Lab stores client secrets in
**plaintext** today — see `oauthClient.secret`), and pairwise subject identifiers.

MCP migration is a path rename: `/mcp/authorize` → `/oauth2/authorize`,
`/mcp/token` → `/oauth2/token`, `/mcp/register` → `/oauth2/register`,
`/mcp/get-session` removed in favour of `/oauth2/introspect`, with an
`mcpHandler()` helper for MCP-compliant error handling.

**RFC 8707 resource indicators are not documented** on that page. Send Lab stores
a `resource` column on `oauth_code`; whether the new plugin carries it is
**unverified**.

### If you use the 1.6.25 `mcp` plugin instead

Worth documenting because it needs no new package, and because its defaults are
startlingly close to the repo's own constants — [1.6.25]
`dist/plugins/mcp/index.mjs`, all re-verified against the 1.6.25 tarball:

| Setting | `mcp()` default | Send Lab | Match |
| --- | --- | --- | --- |
| `codeExpiresIn` | 600 s | `CODE_TTL_SEC = 60 * 10` | exact |
| `accessTokenExpiresIn` | 3600 s | `ACCESS_TTL_SEC = 60 * 60` | exact |
| `refreshTokenExpiresIn` | 604800 s | never expires | differs |
| `allowPlainCodeChallengeMethod` | `false` | S256 only | exact |
| `code_challenge_methods_supported` | `["S256"]` | `["S256"]` | exact |
| `grant_types_supported` | `["authorization_code", "refresh_token"]` | same | exact |
| `token_endpoint_auth_methods_supported` | `client_secret_basic`, `client_secret_post`, `none` | `none`, `client_secret_post` | superset |
| `scopes_supported` | `openid profile email offline_access` | `["mcp"]` | differs |

Tables: `oauthApplication`, `oauthAccessToken`, `oauthConsent` — [1.6.25]
`dist/plugins/oidc-provider/index.mjs`; `mcp` remaps model names onto those three.
That is **three** where Send Lab has four: better-auth keeps access and refresh
token on one row (`oauthAccessToken` carries both tokens and both expiries) and
stores authorization codes in the shared `verification` table rather than a
dedicated one ([1.6.25] the authorize handler writes the code via
`identifier: code`).

**A real gotcha on paths.** [1.6.25] the endpoints are `/mcp/authorize`,
`/mcp/token`, `/mcp/register`, `/mcp/get-session`, mounted under better-auth's
base path — so `https://host/api/auth/mcp/token`, not `https://host/oauth/token`.
Meanwhile `getMCPProtectedResourceMetadata` advertises
`authorization_servers: [origin]` — the **bare origin**, not `${origin}/api/auth`.
That is why the docs tell you to re-expose discovery at the root yourself. The
exported helpers exist for it — [1.6.25] `dist/plugins/mcp/index.d.mts`:

```ts
declare const oAuthDiscoveryMetadata: <Auth extends {
  api: { getMcpOAuthConfig: (...args: any) => any };
}>(auth: Auth) => (request: Request) => Promise<Response>;

declare const oAuthProtectedResourceMetadata: <Auth extends {
  api: { getMCPProtectedResource: (...args: any) => any };
}>(auth: Auth) => (request: Request) => Promise<Response>;
```

Both return `(request: Request) => Promise<Response>`, so they drop straight into
`app/.well-known/oauth-authorization-server/route.ts` as the `GET` export.

**The RFC 9728 path-insertion problem does not go away.** Send Lab learned the
hard way — see the comment in
`src/routes/.well-known/oauth-protected-resource/[...resource]/+server.ts` — that
MCP clients including claude.ai fetch the *path-inserted* form
`/.well-known/oauth-protected-resource/mcp`, not the bare path. Mounting
better-auth's helper at
`app/.well-known/oauth-protected-resource/[[...resource]]/route.ts` would serve
both forms, but that is **inferred**, not documented. And the default `resource`
value is the bare origin ([1.6.25] `resource: options?.resource ?? origin`) where
Send Lab advertises `${origin}/mcp` — the `mcp({ resource })` option covers that.
**This is the single most likely place for the migration to break, and it must be
tested against a real claude.ai connector rather than assumed.**

### Resource-server side

[1.6.25] `dist/plugins/mcp/index.d.mts`, exact:

```ts
declare const withMcpAuth: <Auth extends {
  api: { getMcpSession: (...args: any) => Promise<OAuthAccessToken | null> };
  options: BetterAuthOptions;
}>(auth: Auth, handler: (req: Request, session: OAuthAccessToken) => Response | Promise<Response>) => (req: Request) => Promise<Response>;
```

That replaces the OAuth half of `resolveMcpUser` — but only that half.
`resolveMcpUser` deliberately accepts **either** a personal `sl_` token **or** an
OAuth access token, and `withMcpAuth` only knows the latter. Preserving the dual
path means not using `withMcpAuth` as-is: resolve the `sl_` token first, fall back
to `auth.api.getMcpSession({ headers })`. A handful of lines, and it is the shape
`resolveMcpUser` already has. (Note this interacts with §5: if the api-key plugin
is adopted, the first branch becomes `auth.api.verifyApiKey` instead.)

### Consent — a behaviour change hiding in a default

[1.6.25] `dist/plugins/mcp/authorize.mjs`: consent is reached **only** when the
client sends `prompt=consent` **and** `consentPage` is configured. Otherwise the
handler redirects straight back with the code:

```js
if (query.prompt !== "consent") {
  const redirectURIWithCode = new URL(redirectURI);
  redirectURIWithCode.searchParams.set("code", code);
  if (ctx.query.state) redirectURIWithCode.searchParams.set("state", ctx.query.state);
  throw ctx.redirect(redirectURIWithCode.toString());
}
if (options?.consentPage) { /* redirect to consentPage?consent_code=... */ }
```

Good: no consent UI is *required*, so the plugin works out of the box. Bad: Send
Lab **always** shows a consent page today — 189 lines of
`/oauth/authorize/+server.ts` including a hand-written HTML consent screen with
its own `escapeHtml`, a same-origin guard on the consent POST (with a `Referer`
fallback), and a `redirectAllowed` check on every redirect path including errors,
which ADR-0004 calls *"load-bearing, not stylistic."*

Keeping that means building a React `consentPage` route **and** relying on clients
to send `prompt=consent`. Whether claude.ai does is **unverified**. If it does
not, adopting the plugin **silently drops the consent step** — the athlete would
no longer see or approve anything. Given zero registered OAuth clients that may be
acceptable, but it must be a decision, not an accident.

Notably, `@better-auth/oauth-provider` makes `consentPage` **required** per its
options table, suggesting this consent-optional behaviour is being tightened.

### Verdict for ticket 07 / ticket 01

If the OAuth server survives ticket 01's keep/drop audit, adopt
**`@better-auth/oauth-provider@1.6.25`** — not `mcp()` and not `oidcProvider()`.
The first is deprecated-on-arrival; the second additionally says it "may not be
suitable for production use."

Realistic accounting of the 712 lines:

- **Deleted outright (~470):** `oauth.ts`'s token/code/client machinery,
  `oauthCleanup.ts`, `oauth/token`, `oauth/register`, the metadata builders.
- **Deleted, functionality lost unless rebuilt (~190):** the `oauth/authorize`
  consent page. Becomes a React `consentPage` route if consent is kept.
- **Survives as configuration plus glue (~50):** root-level `.well-known`
  re-exposure including the RFC 9728 path-inserted form, the `resource` value,
  ADR-0004's CORS headers, and the dual `sl_`-or-OAuth token resolution.
- **Schema:** four bespoke tables become better-auth's three, plus authorization
  codes moving into `verification`. Since ticket 01 puts account and history
  migration out of scope and there are zero registered OAuth clients, this is a
  clean drop, not a migration.

Net: **the ticket's framing is correct.** This is the one place in the rebuild
where several hundred lines of security-sensitive code genuinely become
configuration, and it also closes real gaps (hashed client secrets, revocation,
introspection, rate limiting). Three specific risks to test rather than assume:

1. the RFC 9728 discovery path (`/.well-known/oauth-protected-resource/mcp`),
2. whether consent still happens at all,
3. whether a real claude.ai connector completes the flow end to end.

ADR-0004 becomes partly obsolete — `redirect_uri` allowlisting moves inside the
plugin — but its wildcard-CORS reasoning still applies to whatever discovery
routes stay hand-written.

---

## Summary: transfers unchanged vs must be rebuilt

**Transfers unchanged.** The `betterAuth()` config object (secret, `baseURL`,
`emailAndPassword`, `session`, `deleteUser`, `databaseHooks`, `trustedOrigins`);
`drizzleAdapter(db, { provider: 'sqlite', schema })` and the import path; all four
core tables in `schema.ts`, column-for-column; `src/lib/server/apiToken.ts` (plain
Drizzle, no framework coupling); `src/lib/server/csrf.ts` and its tests, though
with an inverted purpose.

**One-line swaps.** `sveltekitCookies(getRequestEvent)` → `nextCookies()`;
`svelteKitHandler(...)` → `toNextJsHandler(auth)` in
`app/api/auth/[...all]/route.ts`.

**Must be rebuilt.** `hooks.server.ts` in both its jobs: session-on-locals becomes
a `cache()`-wrapped DAL called from every page, action and route handler (§1, §2);
the CSRF guard becomes a deliberately-applied origin check because Route Handlers
get nothing for free (§6). Route protection moves from client-side plus
per-endpoint checks to a proxy-for-UX plus DAL-for-security split (§3). Layout
auth checks must not be ported (§2).

**Decisions this research surfaces, for other tickets.** Whether to enable
`session.cookieCache` (§2, affects 06). Whether Settings keeps full-token
re-reveal, which decides whether `apiToken.ts` survives (§5). Whether the OAuth
server survives at all, and if so on `@better-auth/oauth-provider` (§7, blocked on
01). Two latent schema fixes worth doing regardless of the rebuild —
`verification` timestamp nullability and three missing indexes (§4). And a stale
`node_modules` at 1.6.20 against a manifest targeting 1.6.25.
