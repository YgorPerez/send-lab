# i18n on the Next.js rebuild: Paraglide JS vs next-intl

Research for [ticket 04 — i18n replacement](../../.scratch/nextjs-rebuild/issues/04-i18n-replacement.md).
Constraint that outranks convenience: [ADR 0003 — identity is never a display string](../adr/0003-identity-is-never-a-display-string.md).

Researched 2026-08-15 against primary sources only (official docs, package registries,
maintainer statements in the projects' own issue trackers).

## Versions this document describes

| Package | Version | Source |
| --- | --- | --- |
| `next` | **16.3.1** (stable) | `https://registry.npmjs.org/next` |
| `@inlang/paraglide-js` | **2.24.0** (repo pins `^2.20.1`) | `https://registry.npmjs.org/@inlang/paraglide-js` |
| `next-intl` | **4.13.6** | `https://registry.npmjs.org/next-intl` |
| `@inlang/paraglide-next` | **0.8.1 — deprecated**, last published 2025-03-13 | `https://registry.npmjs.org/@inlang/paraglide-next` |
| `@inlang/paraglide-js-react` | 1.0.3 — *markup rendering only*, not a Next adapter | `https://registry.npmjs.org/@inlang/paraglide-js-react` |

Two version traps to hold onto while reading:

1. **Paraglide 2.x is not Paraglide 1.x.** The dedicated Next.js adapter belonged to 1.x. Its
   npm deprecation notice reads: *"use the paraglide-js package directly with v2 or above
   … a nextjs adapter is not needed anymore"*. The old adapter docs URL
   (`inlang.com/m/osslbuzt/paraglide-next-i18n`) now 301-redirects to the generic
   `paraglidejs.com/next-js` page. Any 1.x-era Next tutorial describes software that no
   longer exists.
2. **The Paraglide docs moved.** `inlang.com/m/gerre34r/library-inlang-paraglideJs/*` now
   301-redirects to `paraglidejs.com/*`, and the source repo is `github.com/opral/paraglide-js`
   (formerly a subdirectory of `opral/monorepo`). Some third-party guidance still points at the
   old paths.

---

## Part 0 — What send-lab actually has today

Facts, measured in the working tree, not recalled.

### The catalogue

- `project.inlang/settings.json`: `baseLocale: "en-US"`, `locales: ["en-US", "pt-BR"]`, modules
  `@inlang/plugin-message-format@4` and `@inlang/plugin-m-function-matcher@2`, `pathPattern:
  "./messages/{locale}.json"`.
- **Two message files, 533 message ids each, completely flat** — no nesting, no namespaces.
  `messages/en-US.json` is 31 162 bytes; `messages/pt-BR.json` is 33 398 bytes. Ids are
  semantic snake_case (`nav_today`, `sec_settings`, `study_baar_summary`, `prog_warn_region`).
- **23 messages take placeholders**, all simple named `{arg}` substitutions
  (`"Last week {pct}% — progression eased to match"`, `"{region} is {pct}% of your volume —
  consider balancing."`). No plurals, no selects, no nested ICU.
- **4 messages contain inline `<b>` markup** (`lede_today`, `lede_week`, `lede_exercises`,
  `lede_metrics`, in both locales).
- ICU-hostility audit, since one option parses these strings as ICU (measured, not assumed):
  25 en-US and 1 pt-BR message contain a literal apostrophe; **zero** contain an apostrophe
  immediately followed by `{`, `}` or `<` (the only positions where ICU treats `'` as an
  escape); **zero** contain a literal `{`, `}` or `#` outside a placeholder — the 23 messages
  with braces are exactly the 23 with placeholders; and the only 8 messages containing `<` or
  `>` at all are the 4 `<b>` pairs above. **No bare angle brackets anywhere.**

### How messages are called

- `import * as m from '$lib/paraglide/messages'` in **51 files**; the runtime
  (`getLocale`/`setLocale`/`locales`) in 7.
- **464 call sites over 372 distinct message functions across 57 files.** Called as plain
  functions — `m.sec_settings()`, `m.week_label({ n: 3 })` — from `.svelte` components *and*
  from plain `.ts` modules (`src/lib/assessment.ts`, `src/lib/programStats.ts`). Nothing is
  hook-bound or context-bound.

### The build step

- `pnpm paraglide` → `tsx scripts/compile-messages.ts`, which calls `compile()` from
  `@inlang/paraglide-js` in-process, outputs to `src/lib/paraglide`, then **fails the build if
  the base locale has messages but zero exports were emitted**. That guard exists because a
  silent empty compile once produced 629 `Property 'foo' does not exist` errors from
  `svelte-check` — which is, incidentally, the empirical proof that Paraglide's message ids are
  checked by the type checker in this repo today.
- `src/lib/paraglide` is **gitignored**, regenerated from `messages/` + `project.inlang/`.
- `vite.config.ts` also installs `paraglideVitePlugin` for the dev/build path.
- `scripts/inlang-local-plugins.ts` patches `fetch` so the CDN plugin URLs in
  `settings.json` resolve out of `node_modules` — the compile works with no network.
- `pnpm paraglide` is the **first step of both `check` and `typecheck:ts7`**, and both are in
  `pnpm verify`.

### How locale is detected and switched

This is the part most likely to surprise anyone planning the migration:

- `strategy: ['localStorage', 'preferredLanguage', 'baseLocale']` (in `vite.config.ts`).
  **No URL strategy. No cookie. No server involvement.** There is no locale path prefix and no
  locale in any URL.
- `src/routes/+layout.ts` sets `export const ssr = false` and `export const prerender = false`.
  **The whole app is a client-rendered SPA.** There is no server/client locale boundary today,
  because there is no server render.
- `src/hooks.server.ts` handles CSRF and better-auth session only. It never touches locale.
- Switching: `src/lib/LanguageSwitcher.svelte` calls `setLocale(value)` from the Paraglide
  runtime, which performs a full document reload; the component therefore reads `getLocale()`
  once and does not need reactivity.
- One server-side exception: `src/routes/mcp/+server.ts` calls `getContent()`, and
  `src/lib/server/programOps.ts` imports `src/lib/content/en-US` directly. On the server no
  strategy resolves, so `baseLocale` wins — **MCP output is effectively English-only**, by
  accident rather than by design.

### The locale-content split

`src/lib/content/` holds the prose too large or too structured for a flat message catalogue:

| File | Bytes | Contents |
| --- | --- | --- |
| `types.ts` | 7 556 | shapes: `LocaleContent`, `Content`, `Day`, `VariantParams`, `VariantProse`, … |
| `exercises.ts` | 13 045 | `exerciseParams` — **language-neutral** numeric targets (kg / mm / sec / % / RPE ranges), grip, qualities, region, CNS cost, metric ids, accent colour |
| `en-US.ts` | 39 419 | `LocaleContent` — the English half |
| `pt-BR.ts` | 42 570 | `LocaleContent` — the Portuguese half |
| `logic.ts` | 13 247 | language-neutral scoring (readiness, deep-assessment bands, phases) |
| `index.ts` | 1 713 | the merge + selection |

`LocaleContent` carries `days[]`, exercise prose (`name`, `cat`, and per-variant
`what` / `why[]` / `note` / `tool` / `speed`), `metrics[]`, `quiz[]`, `verdicts`, `flags`,
`deep` (per-area injury self-checks with `source`/`url`/`questions`), `phases` and `glossary`.
Some of that prose contains inline `<b>` markup.

`index.ts` is the whole mechanism:

- `merge(locale)` joins `exerciseParams` onto the localized prose **by exercise id and variant
  index**, at module load, once per locale, memoised into a `CONTENT` record.
- `getContent()` returns `CONTENT[getLocale()] ?? CONTENT['en-US']`, then spreads the athlete's
  `customExercises` over `exercises` (user-authored exercises extend or override built-ins by id).
- **43 `getContent()` call sites across 23 files.**

So: ~82 KB of structured localized prose living in TypeScript modules, keyed by stable ids,
selected at *runtime* by the Paraglide locale — plus ~64 KB in the message catalogue. A third
pattern exists in `src/lib/studies.ts`: language-neutral study metadata (authors, year, url) in
TS, with the prose in the catalogue under `study_<id>_title` / `_summary` / `_applies`.

The important property, and the reason ADR 0003 is survivable at all: **`Day` separates `id`
(stable `DayTypeId`), `k` (stable weekday key `Mon`..`Sun`) and `label` (localized, display
only)**, and `types.ts` says so in comments at each field. `REST_DAY_TYPE` is an exported id
constant precisely so the rest day is never found by matching a localized load label.

---

## Part 1 — Does Paraglide JS support Next.js / App Router?

**Formally yes; practically it is the least-supported target Paraglide has, and its published
Next.js setup does not survive Next 16.**

### What the compiled output gives you

The message functions themselves port cleanly. Paraglide compiles to plain typed ESM functions
with no framework coupling and no React hooks:

> "The compiler turns your messages into typed ESM functions. Vite, Rollup, and other modern
> bundlers can tree-shake unused translations before they reach the browser."
> — https://paraglidejs.com/ (retrieved 2026-08-15)

`m.foo()` is callable in a server component and in a client component, because it is a function
call, not a hook. **But calling it is not the hard part — resolving the locale is.** From the
strategy doc:

> "Because the client and server have separate Paraglide runtimes, you will need to define these
> behaviours separately on the client and server."
> — https://paraglidejs.com/strategy (`docs/strategy.md`, `opral/paraglide-js@main`)

That is the actual boundary problem: a server component's `m.foo()` reads the *server* runtime's
locale, a client component's `m.foo()` reads the *client* runtime's, and nothing makes them agree
unless both can see the same source. Paraglide's own SSR doc names the failure mode:

> "Server and client must agree on the locale source. If the server reads locale from the URL but
> the client reads from `localStorage`, hydration mismatches can occur. `localStorage` is not
> available during the initial SSR document request, so use a server-visible strategy such as
> `cookie` when the persisted locale must affect the first response."
> — https://paraglidejs.com/server-side-rendering

**This directly invalidates send-lab's current strategy for any server-rendered build.** Today's
`['localStorage', 'preferredLanguage', 'baseLocale']` works only because `ssr = false`. Server
rendering requires moving the persisted locale to a cookie.

### What the official Next.js guide actually is

`https://paraglidejs.com/next-js` is a stub: two headings, three sentences, **zero code blocks**.
It embeds two example READMEs. Those examples are the real guidance, and both carry first-party
warnings:

> "**TIP** If you start from scratch, we recommend using a Vite-based framework."
>
> "**WARNING** The setup has been reported as fragile for advanced use-cases
> [#407](https://github.com/opral/inlang-paraglide-js/issues/407). **Use
> [next-intl](https://next-intl.dev/) if you need a more stable setup.**"
> — `examples/next-js-ssr/README.md`, `opral/paraglide-js@main`

Paraglide's own documentation recommends next-intl for Next.js. That is not a competitor's claim;
it is the maintainer's.

(For accuracy: issue #407 — *"get http://fallback.com instead of origin"*, a `localizeHref`
origin-resolution bug — was **closed as not planned** on 2025-02-24. The warning survives.)

### The Next 16 breakage, item by item

`examples/next-js-ssr/package.json` pins **`"next": "15.1.5"`**. It has not been updated for
Next 16. Four independent incompatibilities:

| Paraglide example does | Next 16.3.1 says | Source |
| --- | --- | --- |
| `webpack: (config) => config.plugins.push(paraglideWebpackPlugin(...))` in `next.config.mjs` | *"Turbopack does not support webpack plugins."* / *"`webpack()` configs are not recognized."* And: *"If your project has a custom `webpack` configuration and you run `next build` … the build will **fail** to prevent misconfiguration issues."* | https://nextjs.org/docs/app/api-reference/turbopack · https://nextjs.org/docs/app/guides/upgrading/version-16 |
| `src/middleware.ts` exporting `middleware` | *"The `middleware` filename is deprecated, and has been renamed to `proxy`."* | version-16 upgrade guide |
| `headers().get('x-paraglide-locale')` **synchronously**, with two `@ts-expect-error` comments | *"Starting with **Next.js 16**, synchronous access is fully removed. These APIs can only be accessed asynchronously."* (`cookies`, `headers`, `draftMode`, `params`, `searchParams`) | version-16 upgrade guide |
| SSG example reads `params.locale` synchronously, commented *"can't use async params because the execution order get's screwed up"* | same removal — `params` in `layout.js` is now a Promise | version-16 upgrade guide |

The sync-access hack is not incidental sloppiness; it is load-bearing. The maintainer explains
why, in the comment the docs themselves link to:

> "By making the `cookie(), header()` etc APIs async in Next JS 15, despite them being sync under
> the hood, all message functions would need to be async because the internally used
> `getLocale()` function is async. That is a no-go. Paraglide JS is simple because it does not
> have any async code by leveraging bundlers to tree-shake messages that are not needed.
>
> AsyncLocalStorage, which works in any other meta framework I have built an adapter for, does not
> work in NextJS (vercel/next.js#69298). …
>
> For anyone starting a new project, I highly recommend choosing a meta framework other than
> NextJS."
> — Samuel Stroschein (inlang/Paraglide lead), 2025-01-23,
> https://github.com/opral/paraglide-js/issues/245#issuecomment-2608727658

So the architectural conflict is: Paraglide's whole design is synchronous locale resolution;
Next 16 removed the last synchronous door into request state. The `cache()`-plus-`overwriteGetLocale`
trick in the example was the workaround, and Next 16 closed it. Paraglide has not published a
replacement.

`vercel/next.js#69298` (*"AsyncLocalStorage From middleware to server component"*) was closed as
completed on 2025-02-27, but that does not rescue the pattern: `proxy.ts` is documented as
*"meant to be invoked separately of your render code and in optimized cases deployed to your CDN…
you should not attempt relying on shared modules or globals"*
(https://nextjs.org/docs/app/api-reference/file-conventions/proxy), so an ALS context opened in
the proxy cannot wrap the RSC render regardless.

### Verdict on Q1

Compiled message functions port fine and are callable on both sides of the boundary. The
**locale-resolution glue for server rendering is unsupported, undocumented for Next 16, and
disclaimed by the maintainer.** If the rebuild renders localized UI on the server, this is a
build-your-own problem with no first-party recipe and an upstream author who suggests you use
something else.

---

## Part 2 — Locale routing options

### What Paraglide supports (config-level, framework-independent)

`strategy` is an ordered fallback chain, evaluated first-match-wins
(https://paraglidejs.com/strategy):

| Strategy | Reads from |
| --- | --- |
| `url` | pathname / domain via the standard `URLPattern` API and `urlPatterns` |
| `cookie` | a cookie |
| `localStorage` | browser only; *skipped on the server* |
| `preferredLanguage` | `navigator.languages` on the client, `Accept-Language` on the server |
| `baseLocale` | the configured base — always resolves, so it belongs last |
| `globalVariable` | testing only; documented as unsafe on servers (cross-request bleed) |
| `custom-<name>` | `defineCustomClientStrategy()` / `defineCustomServerStrategy()`; server-side ones may be async |

Plus `routeStrategies` for per-route overrides, with a use case that is almost exactly
send-lab's shape:

> "Public pages use URL prefixes (`/de/...`) … Private routes like `/dashboard` are never
> prefixed and should read locale from cookie. API/RPC routes should skip i18n middleware
> behavior entirely."
> — https://paraglidejs.com/strategy

`urlPatterns` covers prefix-non-default (`/about`, `/de/about`), prefix-all
(`/en/about`, `/de/about`), translated pathnames (`/about` / `/ueber-uns`), subdomains, and an
explicitly documented **no-prefix mode**:

> "*No prefix (cookie/header)* … `/dashboard` … is useful for authenticated areas like dashboards
> where the URL stays the same but content is localized based on user preferences stored in
> cookies or headers."
> — https://paraglidejs.com/i18n-routing

**So Paraglide does not force a locale path prefix.** Good — the ticket's worry that changing to
prefixes "changes every URL" is avoidable on the Paraglide side.

### What a Next adapter supports

There is no Next adapter. `@inlang/paraglide-next` is deprecated (see version table).
`@inlang/paraglide-js-react@1.0.3` is *"React component for rendering Paraglide JS messages that
contain markup"* — a `<Message>` component for the 4 messages with `<b>` tags, nothing more.
Everything routing-related is hand-rolled: a `proxy.ts` calling `paraglideMiddleware`, plus the
locale-injection shim in the root layout.

### What Next.js itself wants

Next's own App Router i18n guide (https://nextjs.org/docs/app/guides/internationalization,
docs version 16.3.1) offers exactly two options — **sub-path (`/fr/products`) or domain
(`my-site.fr/products`)** — and instructs:

> "Finally, ensure all special files inside `app/` are nested under `app/[lang]`."

It recommends `negotiator` + `@formatjs/intl-localematcher` in `proxy.js` to redirect, and
`generateStaticParams` in `app/[lang]/layout.tsx`. **There is no official Next.js guidance for
unprefixed URLs with a cookie-selected locale in the App Router.** Supporting details:

- The Pages Router `i18n` config (`locales`, `defaultLocale`, `localeDetection`, `NEXT_LOCALE`
  cookie) is not an App Router feature. The 16.3.1 docs no longer say so explicitly — the
  migration guide only says built-in i18n is *"no longer necessary in the `app` directory"* — but
  `packages/next/src/server/config.ts` on canary emits a deprecation warning reading *"i18n
  configuration in next.config.js is unsupported in App Router"* when an `app/` directory exists.
  It warns; it does not error.
- **`next/root-params`** — new in 16.3.0 and the headline i18n ergonomics win (`import { lang }
  from 'next/root-params'`, no prop drilling) — *requires* a dynamic segment above the root
  layout: *"Root parameters are the dynamic segments that appear before the root layout."*
  Unprefixed URLs make it unavailable.
- With `cacheComponents: true`, each root parameter must have at least one
  `generateStaticParams` value **or the build fails**.
- And Next explicitly warns against the cookie-in-root-layout shape, in the closest official
  analogue (https://nextjs.org/docs/app/guides/preventing-flash-before-hydration): *"reading it
  in the root layout **opts the entire app out of static prerendering** (and under Cache
  Components, forces blocking every segment under the layout)."*

### What next-intl supports

`localePrefix` has four modes (https://next-intl.dev/docs/routing/configuration#locale-prefix):
`'always'` (default, `/en/about`), `'as-needed'` (default locale unprefixed), `'never'`, plus
per-locale custom `prefixes` (`'en-US': '/us'`) and `domains`. Two distinct ways to get
unprefixed URLs, and the difference between them matters:

1. **No i18n routing at all** — the default getting-started path. No `[locale]` folder, no
   `routing.ts`, no proxy; locale comes from a cookie in `i18n/request.ts`. Gives up the whole
   navigation layer (`createNavigation`'s `Link`, `redirect`, `usePathname`, `useRouter`), plus
   `accept-language` negotiation and `pathnames`.
2. **`localePrefix: 'never'`** — keeps the proxy and rewrites internally. Explicitly motivated by
   *"You want to use a cookie to determine the locale while enabling static rendering."* But note:
   *"**You still need to place all your pages inside a `[locale]` folder** for the routes to be
   able to receive the `locale` param."* So the segment exists in the filesystem, just not in the
   URL — which means `next/root-params` and per-locale `generateStaticParams` remain available.
   Cost: *"Alternate links are disabled in this mode since URLs might not be unique per locale"*,
   so `hreflang` is on you.

Cookie details: the proxy sets a session cookie `NEXT_LOCALE` (`sameSite: 'lax'`, no `max-age` —
*"To be compliant out of the box… making it a session cookie that expires when a browser is
closed"*), configurable name/`maxAge` or `localeCookie: false`. For a persisted athlete preference
you would raise `maxAge`; the docs say so.

Option 2 is the interesting one for send-lab: unprefixed URLs *and* static rendering *and*
`next/root-params`, which is a combination Paraglide cannot offer on Next 16 at all.

### Verdict on Q2

Both libraries can do prefix, domain, or cookie-only. **Next.js itself is the component that
pushes hardest toward a `/[locale]/` prefix** — it is the only documented path, and it is what
`next/root-params` and per-locale prerendering are built around. Cookie-only is available in both
libraries and undocumented in Next, and it costs static prerendering of anything that reads it
server-side.

Whether URLs change is therefore **not an i18n-library decision** — it is a rendering-architecture
decision (ticket 06). Note that today's SPA has no prerendering to lose, so "cookie-only costs you
static rendering" is a cost measured against a Next-ish future, not against the status quo.

---

## Part 3 — next-intl as the alternative

`next-intl` 4.13.6, docs at https://next-intl.dev/docs (docs are versioned v3/v4; all pages read
here describe v4).

### Cost of migrating `messages/`

Low, and the catalogue itself needs no edits. next-intl reads per-locale JSON, and nesting is
*optional*: *"Optionally, you can structure your messages as nested objects."* The only key-shape
constraint is the separator:

> "Namespace keys cannot contain the character `.` as this is used to express nesting—all other
> characters are fine to use."
> — https://next-intl.dev/docs/usage/translations

None of the 533 snake_case ids contain a period, so all are valid. **One nuance that matters:**
with a fully flat catalogue there are *no valid namespaces*, so `useTranslations()` must be
called bare and `useTranslations('nav_today')` is itself a type error. That is enforced at the
type level, not by convention — `useTranslations`' parameter is
`NamespaceKeys<Messages, NestedKeyOf<Messages>>`, and `NamespaceKeys` admits only paths whose
value is *not* a string (`packages/use-intl/src/core/MessageKeys.tsx`). This also means
namespace-based client-bundle splitting (`pick(messages, 'SomeNamespace')`, see below) has
nothing to grab — a flat catalogue is all-or-nothing on that axis.

Per-item, for send-lab's catalogue:

- **Placeholders:** unchanged. `{pct}`, `{region}`, `{n}` are ICU named arguments. Argument names
  must be alphanumeric or underscore — all 23 are.
- **Escaping:** *"Since curly braces are used for interpolating arguments, you can wrap them in
  single quotes (`'`) to use the actual symbol in messages"*
  (https://next-intl.dev/docs/usage/translations). Per the audit in Part 0, **the catalogue is
  already ICU-clean**: no bare braces, no `'` before `{`/`}`/`<`, no bare angle brackets. `%` and
  `—` are not ICU metacharacters. So the migration is a file copy, not a rewrite.
  - Worth knowing anyway, because it is *not* on the escaping docs page: **`<tag>` sequences are
    parsed as rich-text tags even by plain `t()`.** Evidenced by next-intl's own test suite
    (`packages/use-intl/src/core/createTranslator.test.tsx`, "strips ICU escape quotes from `<`")
    and changelog 4.13.6 (#2352, *"Handle ICU escape sequences around `<` consistently in dev
    and production"*). send-lab has zero bare angle brackets, so this is a trap it happens to
    dodge — but it would bite the moment someone writes `"under <5 min"`.
- **Inline `<b>`:** next-intl has `t.rich()` (tags → React components), `t.markup()` and
  `t.raw()`. The 4 affected messages need touching either way, since Svelte's `{@html}` doesn't
  exist in React.

Rough cost: a mechanical rewrite of 464 call sites from `m.foo()` / `m.foo({x})` to
`t('foo')` / `t('foo', {x})`. Codemoddable, but 464 of them, and every one is a place a typo can
be introduced during a rebuild that is *already* rewriting the whole UI.

### What next-intl gives that Paraglide doesn't

- **First-class App Router integration, demonstrably maintained against Next 16.** Three
  independent tells: its peer range is `next: ^12 || ^13 || ^14 || ^15 || ^16`; its docs say
  *"`proxy.ts` was called `middleware.ts` up until Next.js 16"*; and it has already made
  `next/root-params` (Next 16.3) the recommended static-rendering path, demoting its own older
  API — *"`setRequestLocale` is a legacy API that was added until `next/root-params` was
  introduced… it is recommended to use `next/root-params` instead"*
  (https://next-intl.dev/docs/routing/setup#static-rendering). Compare Paraglide's Next example,
  pinned to `next@15.1.5`. This is the difference between "supported" and "you own the glue".
- **A documented no-i18n-routing setup**, and it is the *default* getting-started path in v4, not
  a footnote: read the locale from a cookie in `i18n/request.ts`
  (`const store = await cookies(); const locale = store.get('locale')?.value || 'en'`), wrap in
  `NextIntlClientProvider`, no `[locale]` folder and no proxy at all. Exactly send-lab's URL
  shape — and note it uses `await cookies()`, i.e. it is *built for* Next 16's async request APIs
  rather than hacking around them.
  https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing
- **Messages can stay on the server entirely.** Translating in server components means *"your
  messages never leave the server and don't need to be passed to the client side… No runtime cost
  on the client side"* (https://next-intl.dev/docs/environments/server-client-components). For
  prose-heavy read-only surfaces (the studies page, assessment copy) that is a better bundle
  outcome than Paraglide's tree-shaking, not a worse one.
- **It is what Paraglide's own docs tell you to use for Next.**

### What we'd lose

- **Tree-shaking — but the gap is narrower than the marketing.** Paraglide claims *"up to 70%
  smaller i18n bundle sizes compared to runtime based libraries"* and its comparison table marks
  itself ✅ tree-shaking, i18next and React-Intl ❌ *"Ships all messages"*
  (https://paraglidejs.com/comparison). next-intl has no message tree-shaking and says so:
  *"An automatic, compiler-driven approach is being evaluated in next-intl#1"* — an issue still
  open (verified via the GitHub API, last updated 2026-05-15). Whatever you hand
  `NextIntlClientProvider` ships, and *"Providing all messages to the client side is the easiest
  way to get started, therefore next-intl automatically does this."* Four documented mitigations
  exist (translate on the server; move state server-side; `pick(messages, …)`; ship everything),
  but `pick` needs namespaces, which a flat catalogue doesn't have.
  - **Countervailing: ahead-of-time ICU precompilation landed in 4.8.0** (2026-01-28),
    `experimental.messages.precompile: true` — ICU parsing moves to build time, *"reduces bundle
    size by approximately 9KB of compressed JavaScript"*, the runtime formatter drops to
    *"~650 bytes (compressed)"*, no code changes required. Tradeoff: `t.raw` is unsupported with
    precompiled messages. https://next-intl.dev/blog/precompilation
  - Net at send-lab's size (64 KB of JSON, two locales, an authenticated console with no SEO
    stake): **not decisive.**
- **Argument type-checking by default** (see Part 4).
- **The `LocalizedString` branded type** (see Part 4 — this is the ADR-0003-relevant loss).
- **The inlang tooling**: the Sherlock IDE extension (inline message previews, extract-to-key),
  the `project.inlang` ecosystem, `plugin-m-function-matcher`. next-intl's answers are
  `useExtracted` (4.5.0, experimental — key-less authoring, keys extracted by an SWC plugin at
  build time) and, for cross-locale completeness, a **third-party** CLI: the docs dedicate a page
  to `@eloqnt/cli` (`npx eloqnt lint`, flags `missing-translation` and `inconsistent-args`).
  There is no first-party `next-intl lint`. Several next-intl docs pages also carry commercial
  partner links — worth knowing when weighing their recommendations.
- **The local-plugin/offline compile work** in `scripts/inlang-local-plugins.ts` becomes moot —
  arguably a gain, since that file exists only to work around inlang loading plugins from a CDN.

---

## Part 4 — Type safety on message ids *(weighted heavily)*

### Paraglide

Intrinsic and unavoidable. Each message compiles to a **named export**; a call to a message that
does not exist is a reference to an export that does not exist.

> "Autocomplete for message keys and parameters. Typos become compile errors."
> — https://paraglidejs.com/

The generated layout (https://paraglidejs.com/compiling-messages) is one module per message
re-exported through `messages.js`, with `emitTsDeclarations: true` producing `.d.ts` files.
Arguments are typed too, because each function has its own parameter object type — `m.week_label()`
with `{n}` missing is an error without any extra opt-in.

**This repo has already proven it empirically.** The comment at the top of
`scripts/compile-messages.ts` records that when a plugin failed to load and the compiler emitted
zero messages, `svelte-check` produced **629 `Property 'foo' does not exist`** errors. That is the
guarantee firing. It is *fail-safe*: if the catalogue is missing, the build stops. You cannot end
up with a green build and a stringless UI — which is exactly the guard the repo added.

Additionally, Paraglide brands its output:

```ts
import type { LocalizedString } from "./paraglide/runtime.js";

function PageTitle(props: { title: LocalizedString }) { … }

<PageTitle title={m.welcome_title()} />  // ✅
<PageTitle title="Welcome" />            // ❌ Type error
```
— https://paraglidejs.com/basics

**Read against ADR 0003, this is the interesting one.** `LocalizedString` is a nominal marker on
*translated output*. On its own it stops a raw literal being passed where a translation is
required — the opposite direction from the ADR's bug. But paired with branded identity types
(`type WeekdayKey = string & { readonly __brand: 'WeekdayKey' }`), it makes the ADR-0003 mistake a
**type error rather than a pt-BR-only runtime bug**: a `LocalizedString` is not assignable to
`WeekdayKey`, so `workout.day = content.days[i].label` stops compiling. Today `label` is plain
`string` (`src/lib/content/types.ts`) and only a comment — *"Display only — never stored, never
matched on"* — enforces the rule.

That upgrade is available under either library (you can always brand your own ids), but Paraglide
hands you the localized-side brand for free and next-intl does not: `t()` returns `string`
(https://next-intl.dev/docs/usage/translations).

### next-intl

Real `tsc` errors, but **derived and opt-in**. The docs are explicit that nothing is checked by
default: *"`next-intl` integrates seamlessly with TypeScript right out of the box, requiring no
additional setup. However, you can **optionally** provide supplemental definitions to augment the
types…"* And the library's own source shows what "no setup" resolves to:

```ts
// packages/use-intl/src/core/AppConfig.tsx
export default interface AppConfig {
  // Locale
  // Formats
  // Messages
}
export type Messages = AppConfig extends {Messages: infer AppMessages}
  ? AppMessages
  : Record<string, any>;
```

`Record<string, any>` — **every key accepted, no error, no warning.** To get checking you augment
`AppConfig` with the shape of your own JSON:

```ts
// global.d.ts
import {routing} from '@/i18n/routing';
import {formats} from '@/i18n/request';
import messages from './messages/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
    Formats: typeof formats;
  }
}
```
— https://next-intl.dev/docs/workflows/typescript

With that in place, a misspelled key is a compiler error:

```tsx
const t = useTranslations('About');
t('description'); // ✖️ Unknown message key
t('title');       // ✅ Valid message key
```

Namespaces and format names are checked too. Because it is a pure type-level check, `tsc --noEmit`
catches it — and `next build` type-checks by default, so it fails the build as well (unless
`typescript.ignoreBuildErrors` is set).

**Stale-guidance warning:** the `declare global { interface IntlMessages … }` form is the **v3**
API and was replaced in 4.0 — *"both `Messages` as well as `Formats` can now be registered under a
single type that is scoped to `next-intl` and no longer affects the global scope"*
(https://next-intl.dev/blog/next-intl-4-0). Any tutorial showing `IntlMessages` or `declare
global` predates 4.0.

**Argument type-checking is a separate, still-experimental opt-in**, new in 4.0. The blocker is a
TypeScript limitation, quoted from the docs:

> "TypeScript currently has a limitation where it infers values of imported JSON modules as loose
> types like `string` instead of the actual value. To bridge this gap for the time being,
> `next-intl` can generate an accompanying `.d.json.ts` file for the messages that you're
> assigning to your `AppConfig`."

So you set `allowArbitraryExtensions: true` in `tsconfig.json` and
`createNextIntlPlugin({experimental: {createMessagesDeclaration: './messages/en.json'}})`, which
emits `messages/en.d.json.ts` on `next dev` / `next build` / `next typegen` (docs recommend
gitignoring `messages/*.d.json.ts`). Inference then works off the literal string —
`"Hello {name}"` → `{name: string}`, `"{count, plural, …}"` → `{count: number}`, and so on, via
`@schummar/icu-type-parser`.

**Crucially, this degrades silently rather than loudly.** From the library source:

```ts
// packages/use-intl/src/core/ICUArgs.tsx
string extends Message ? {} : GetICUArgs<Message, Options>
// packages/use-intl/src/core/createTranslator.tsx
// If an unknown string is passed, allow any values
```

Without `createMessagesDeclaration`, keys are still checked but **arguments accept anything**, with
no error to tell you the guarantee isn't running. This option has been under `experimental` since
the 4.0 line and still is in 4.13.6.

**Runtime behaviour on a missing key** — neither throw nor default-locale fallback:

> "By default, when a message fails to resolve or when the formatting failed, an error will be
> printed on the console. In this case `${namespace}.${key}` will be rendered instead to keep your
> app running."
> — https://next-intl.dev/docs/usage/configuration#error-handling

Configurable via `onError` / `getMessageFallback`, with a footgun: *"`onError` and
`getMessageFallback` are not automatically inherited by Client Components"* — they're functions,
so non-serializable, and must be set inside your own `'use client'` wrapper around
`NextIntlClientProvider`. Falling back to the default locale is explicitly **not** what
`getMessageFallback` is for; the docs say merge the locales yourself in `getRequestConfig`.
`t.has('key')` exists for genuinely optional messages.

**Type-checking cost**, from the docs' own benchmark (340 messages, MacBook Pro 2019 Intel):
~2.20s with no augmentation, ~2.82s with type-safe keys, ~2.85s with type-safe arguments. 533 flat
keys should be the same order of magnitude; that is extrapolation, the docs publish only the
340-message figure.

### The difference that matters

Both give a compile error on a misspelled id. The gap is in **failure mode**:

| | Paraglide | next-intl |
| --- | --- | --- |
| Missing/typo'd id | Export doesn't exist → error, always | Error *if* the `AppConfig` augmentation is present and correct |
| Delete the type plumbing | Impossible — the functions *are* the types | `Messages` falls back to `Record<string, any>` → every key accepted, **build still green** |
| Empty/failed catalogue | Every call site errors (proven: 629 errors) | depends on how it broke; `Record<string, any>` accepts everything |
| Argument checking | Default | Experimental opt-in (`createMessagesDeclaration`); silently permissive without it |
| Missing key at runtime | falls back to `baseLocale` text | logs an error, renders `namespace.key` |
| Untranslated key in the *other* locale | falls back to base-locale text, no build error | not type-checked at all (only the default locale is) |
| Branded localized output | `LocalizedString` | none — `t()` returns `string` |

Paraglide's guarantee is **fail-safe**; next-intl's is **fail-open**. For a codebase whose
documented worst bug class is *invisible in the base locale* (ADR 0003), fail-open type safety is
a materially weaker instrument — it is exactly the kind of protection that rots silently.

**One thing neither library gives you, and it should be said plainly because it is the closest
thing to an ADR-0003 blind spot in both:** *the non-default locale is not type-checked.*
next-intl's augmentation reads one statically imported catalogue (`typeof messages` from
`en.json`); other locales are loaded dynamically at runtime and `tsc` never sees them, which is why
the docs delegate cross-locale completeness to `@eloqnt/cli`. Paraglide compiles from all locales
but resolves a missing translation by falling back — its changelog describes `baseLocale` as
*"the exhaustive branch in generated message functions"* and records removing an older
message-id fallback (https://paraglidejs.com/changelog) — so a key present in `en-US.json` and
absent from `pt-BR.json` yields English text, not a build failure. I could not find an explicit
docs statement that Paraglide errors on an untranslated message, and the fallback design implies
it does not.

**So "a missing pt-BR string" is a runtime-silent condition under both options.** Today the only
thing preventing it is that both files happen to have exactly 533 keys. A parity check belongs in
`pnpm verify` regardless of which library wins — it is three lines of script and it closes a real
hole that neither vendor closes for you.

**But it is not absent, and it is CI-gateable.** A `pnpm verify` equivalent (ticket 09) can pin
next-intl's guarantee down hard: keep `global.d.ts` under test (a deliberately-misspelled key in a
`// @ts-expect-error` fixture fails the gate if the augmentation stops working), enable
`createMessagesDeclaration`, and run `next typegen && tsc --noEmit` before anything ships. That
converts fail-open into fail-noisy. It is engineering work Paraglide would not require, and it is
the compensating argument the ticket asks for.

### Verdict on Q4

**Paraglide is stronger, clearly, and next-intl is not disqualified.** The honest framing: this
question does not settle the ticket on its own, because next-intl's key checking is genuine tsc
checking rather than a runtime fallback. What Q4 does establish is a **precondition**: if
next-intl is chosen, the `AppConfig` augmentation, `createMessagesDeclaration`, and a
regression test for both must be treated as gate infrastructure, not as optional polish.

---

## Part 5 — The build step

### Paraglide

Three invocation modes (https://paraglidejs.com/compiling-messages): CLI, bundler plugin,
programmatic. Bundler plugins are recommended *"because they automatically recompile when
translation files change"*. The exported plugins are Vite, Webpack, Rollup, Rspack, Rolldown,
esbuild + unplugin — **no Turbopack**, and none is coming:

> "As long as Turbopack has no plugins and Unplugin can't offer a plugin
> (unjs/unplugin#302), **Turbopack support is out of scope.** The CLI in watch mode is the way to
> go in the meantime (or switching to TanStack Start :P)"
> — Samuel Stroschein, 2026-05-09, on
> https://github.com/opral/paraglide-js/issues/675 (*"Docs: Next.js integration guide is
> incompatible with Turbopack"*, closed 2026-07-08 as completed)

Since Next 16 makes Turbopack the default and *fails* `next build` when a custom `webpack` config
is present, the Paraglide-on-Next build options are:

1. **`paraglide-js compile` (+ `--watch` in dev) as a separate step** — the maintainer's
   recommendation, and near-identical to what send-lab already does via
   `scripts/compile-messages.ts`. Fully Turbopack-compatible because it never touches the bundler.
2. `next build --webpack` — opt out of Next 16's default bundler to keep the plugin. Gives up
   Turbopack's speed and filesystem caching; a strange thing to do in a from-scratch rebuild.

Option 1 is the answer, and it is a good one: `pnpm paraglide` already exists, already runs first
in `check` and `typecheck:ts7`, and already has the zero-messages guard. It would port with a
changed `outdir` and nothing else. The `--emit-ts-declarations` flag matters here — and note a
detail relevant to this repo's `tsgo` gate:

> "With TypeScript 5 and 6, declarations are generated with the in-process compiler API.
> TypeScript 7+ no longer provides that API, so Paraglide invokes its `tsc` CLI in a child
> process instead. The output is semantically equivalent, but differs cosmetically … expect
> `.d.ts` churn when switching TypeScript majors."
> — https://paraglidejs.com/compiling-messages

### next-intl

Runtime-first at baseline: `createNextIntlPlugin()` in `next.config.ts` wires `i18n/request.ts`,
generates nothing, and ICU is parsed at runtime. But every feature you'd actually want adds a
build-time step, and **all of them are still under `experimental` in 4.13.6**:

| Option | What it does | Writes | Since |
| --- | --- | --- | --- |
| `createMessagesDeclaration: './messages/en.json'` | typed ICU arguments (Part 4) | `messages/en.d.json.ts` on `next dev` / `next build` / `next typegen`; gitignore it | 4.x |
| `messages: {path, format, locales, …}` | Turbopack **or** Webpack loader so catalogues import as plain JS; `json`, `po`, or a custom codec | — | 4.5+ |
| `messages.precompile: true` | ICU → AST at build time; ~9 KB less client JS | — | 4.8.0 |
| `extract: true` + `srcPath` | `useExtracted` key-less authoring via an SWC plugin | **rewrites your catalogues** | 4.5.0 |

So **next-intl also acquires a codegen step the moment you want full type safety**, and it must run
before `tsc`. Q5 is therefore not much of a differentiator: either way the gate looks like
`<generate> && next typegen && tsc --noEmit`.

One asymmetry in next-intl's favour: it ships **Turbopack loaders**, not webpack plugins — *"Extraction
integrates automatically with `next dev` and `next build` via a Turbo- or Webpack loader, you don't
need to manually trigger it."* That is precisely the integration surface Paraglide cannot reach
(Turbopack supports loaders, not plugins). One in Paraglide's: its compile step is a plain CLI that
depends on no bundler at all, which is the most durable arrangement of the three.

### Does generated-and-gitignored still work?

**Yes, and it is Next's own sanctioned pattern.** Paraglide writes a `.gitignore` into its own
`outdir` by default. Next does the same thing for its own generated types:

> "`next-env.d.ts` is managed by Next.js. Its contents are an implementation detail and may change
> over time. **Add it to `.gitignore`.** If your project already tracks the file, remove it from Git."
> — https://nextjs.org/docs/app/api-reference/config/typescript

> "To ensure `next-env.d.ts` is present before type-checking run `next typegen`. The commands
> `next dev` and `next build` also generate the `next-env.d.ts` file, but it is often undesirable
> to run these just to type-check, for example in CI/CD environments."
> — https://nextjs.org/docs/app/api-reference/cli/next

Generated route types live in `.next/types` and are pulled in via `tsconfig.json`'s `include`.
So the shape send-lab already uses — generate → gitignore → include → regenerate before
type-check — is precisely what Next.js documents for itself. **No change needed to that
arrangement under either option.**

One caveat worth carrying into ticket 09: there is **no Next-specific pre-build hook**. npm/pnpm
`prebuild` is the only generic option and Next doesn't document it; `next.config.js` side effects
became less reliable in v16 (*"when running `next dev` checking if `process.argv` includes
`'dev'` … will return `false`"*). Explicit script chaining (`pnpm paraglide && next build`) is the
honest mechanism, which is what `pnpm verify` already does.

---

## Part 6 — The locale-content split

### Neither library has a recommended pattern for this. It is ours to design — and it already is.

Paraglide's position: messages are strings; anything structured is an escape hatch you own.

> "Store the array as a JSON string in your messages file and parse it at runtime with
> `JSON.parse()`" … "Using `JSON.parse()` is a deliberate escape hatch that you, the developer,
> choose to use. You're explicitly opting into the risk rather than having it be a default feature
> of the library."
> — https://paraglidejs.com/objects-and-arrays

Objects need brace-escaping (`\{`, `\}`, double-escaped in JSON), *"you cannot use message-format
features like interpolation inside the JSON blob"*, and the doc's own worked example of why
`returnObjects`-style APIs are bad is a translator breaking the JSON and crashing the app at
runtime. **Putting `LocaleContent` into the catalogue would be actively worse than what send-lab
does now** — it would convert 82 KB of type-checked structured prose into unvalidated strings.

next-intl allows arbitrarily nested message objects, plus `useMessages()` to read structures and
`t.rich()` for markup (https://next-intl.dev/docs/usage/messages). So `LocaleContent` *could* live
in next-intl's JSON. That trade is worth stating plainly:

| | `src/lib/content/*.ts` (today) | next-intl nested JSON |
| --- | --- | --- |
| Shape checked by `tsc` | ✅ `LocaleContent` interface, per-field | ❌ JSON has no interface; `Messages: typeof messages` types *access*, not *conformance* |
| A missing `deep.fingers.questions[3].a` in pt-BR | compile error | silent at build, breaks at render |
| Translator-editable | ❌ needs a developer | ✅ standard tooling |
| `<b>` inside prose | plain string, rendered as HTML | `t.rich()` / `t.markup()` |
| Params/prose separation (`exerciseParams` merge) | ✅ explicit, index-matched | would need re-inventing |

Given ADR 0003 and the fact that pt-BR is where the invisible bugs live, **the existing split is
the stronger design and should survive the rebuild essentially unchanged.** `index.ts` is 1 713
bytes of merge-and-select logic; only one line is library-coupled:

```ts
import { getLocale } from '$lib/paraglide/runtime';
```

Under Paraglide that import survives verbatim. Under next-intl, `getContent()` needs a locale
passed in or read from next-intl's request config (`getLocale()` from `next-intl/server` in server
code, `useLocale()` in client components) — and because `useLocale()` is a hook, the 43
`getContent()` call sites split into server and client variants, or `getContent(locale)` becomes
an explicit parameter. **That parameterisation is the real Q6 migration cost of next-intl, and it
is worth doing regardless** — an implicit ambient locale read is precisely the coupling that makes
ADR-0003-class bugs hard to test. Making `getContent(locale)` explicit means a pt-BR test is a
function argument rather than a global-state manipulation.

The `studies.ts` pattern (neutral metadata in TS + prose in the catalogue, keyed
`study_<id>_summary`) ports unchanged under either.

---

## Recommendation

### The answer is not clear-cut, and it is contingent on ticket 06. This needs a follow-up decision session.

The reason it is not clear-cut is that the two decisive facts point opposite ways:

- **Q4 favours Paraglide**, and Q4 is the question that maps onto ADR 0003. Its type safety is
  fail-safe; next-intl's is fail-open.
- **Q1, Q2 and Q5 favour next-intl on Next 16**, and not marginally: Paraglide's published Next
  setup is pinned to Next 15.1.5, uses three APIs Next 16 removed or renamed, requires opting out
  of Next's default bundler, and is disclaimed by its own maintainer in favour of next-intl.

What resolves the tension is that **the conflict lives entirely in server-rendered locale
resolution**, and send-lab does not server-render today (`ssr = false`). So:

**Primary recommendation — keep Paraglide, and keep localized rendering on the client.**

Concretely: compile with `paraglide-js compile --emit-ts-declarations` as an explicit script
(`pnpm paraglide && next build`, `--watch` in dev), keep `outdir` gitignored, keep the
zero-messages guard from `scripts/compile-messages.ts`, switch `strategy` to
`['cookie', 'preferredLanguage', 'baseLocale']` so the locale is server-visible, and keep
localized UI in client components. Do not adopt `overwriteGetLocale` + `cache()`; that is the
pattern Next 16 broke.

Reasoning:

1. **It preserves the strongest available defence against this codebase's worst bug class**, and
   the map's own note says to carry ADR 0003 into the rebuild because *"a clean slate is exactly
   where it would be reintroduced."*
2. **It is the cheapest path by a wide margin.** 533 message ids unchanged. `messages/*.json`
   unchanged. `project.inlang/` unchanged. `m.foo()` / `m.foo({x})` call syntax unchanged across
   464 sites — Svelte-to-JSX rewriting touches the markup around them, not the calls.
   `src/lib/content/` ports with one import path edited. The compile script ports with one
   `outdir` edited. Compare that to 464 call-site rewrites plus a `global.d.ts` plus
   `createMessagesDeclaration` plus a `getContent(locale)` refactor.
3. **It matches the map's own weighting.** *"The client rewrite is the part with the value in it;
   server-side churn is cost."* Paraglide-on-the-client is zero server-side churn. The whole
   Paraglide/Next incompatibility is a server-rendering incompatibility, and buying into
   server-rendered i18n purchases churn the map already called cost.
4. **Alpha app, 5 accounts, no prerendering today.** The SEO and static-prerender arguments for
   `/[locale]/` prefixes carry no load on a single-athlete authenticated console. Losing static
   prerendering of a cookie-read layout costs nothing measured against an `ssr = false` SPA.
5. **The build story is genuinely fine.** The maintainer's own recommendation (CLI in watch mode)
   is what this repo already does, and generated-and-gitignored is Next's own documented pattern
   for `next-env.d.ts`.

**Fallback recommendation — if ticket 06 lands on server-rendered localized UI, switch to
next-intl and pay for the type safety explicitly.** Do not attempt Paraglide-with-RSC: you would
be maintaining a locale-injection shim that Paraglide's author has publicly disclaimed, against
Next APIs that removed the mechanism it depends on, with no upstream recipe. If next-intl is
chosen, treat as non-negotiable gate work (ticket 09): the `AppConfig` augmentation,
`createMessagesDeclaration`, `next typegen && tsc --noEmit` in `verify`, a
`@ts-expect-error` fixture asserting a misspelled key still fails, and a pt-BR render test —
because a fail-open guarantee needs a test that notices when it stops working.

**What the primary recommendation admits it gives up**, so the follow-up session can price it:
anything rendered on the server stays in the base locale — `<html lang>`, `generateMetadata` page
titles, `error.tsx` / `not-found.tsx` copy, and any RSC-rendered prose. That is **exactly the
status quo** (`ssr = false` already means the shell HTML is base-locale), so it is not a
regression; but it *is* a ceiling, and it forecloses per-locale prerendering. If any of those
matter more than they do today, the fallback recommendation applies. Next's own
preventing-flash-before-hydration guide sanctions the inline-script correction pattern for exactly
this class of attribute, if `<html lang>` alone turns out to be the sticking point.

Independent of which library wins, four things should happen:

- **Move the persisted locale from `localStorage` to a cookie.** Required for any server
  visibility, harmless otherwise, and it fixes the accidental English-only MCP output.
- **Make `getContent(locale)` take its locale as a parameter** rather than reading ambient state.
  This is the change that makes a pt-BR test cheap, and ADR 0003 says tests that only run in the
  base locale *"cannot catch a regression of this class."*
- **Brand the identity types** (`DayTypeId` already is a union; brand `WeekdayKey` and any id
  currently typed `string`). That is what turns ADR 0003 from a comment into a compile error, and
  under Paraglide `LocalizedString` closes the loop from the other side.
- **Add a locale-parity check to the gate.** Neither library fails a build when a key exists in
  `en-US` and not in `pt-BR` (Part 4) — both silently serve English. Both files currently hold
  exactly 533 keys, which is luck, not enforcement. Asserting equal key sets is a few lines and it
  covers the one gap that is genuinely nobody's product.

### What would change my mind

| Finding | Effect |
| --- | --- |
| Ticket 06 lands on **server-rendered / RSC-rendered localized prose**, or on locale-prefixed URLs with per-locale prerendering | Flips to next-intl. This is the single most likely flip and the reason this needs a follow-up session. |
| Paraglide ships a **maintained Next 16 example** (async `headers()`/`params`, `proxy.ts`, no `webpack:` config) | Removes the Q1 objection; Paraglide wins outright, server rendering included. |
| **Turbopack does not tree-shake Paraglide's per-message exports** in a production build | Weakens Paraglide's main technical advantage. I could find **no first-party statement** either way — Paraglide's tree-shaking claims name Vite and Rollup, never Turbopack. **Verify with a spike before committing**: build both locales, inspect the client chunks for a message string that is never called. |
| next-intl's key checking turns out **not to work with a flat 533-key file** and no namespace | Would remove the compensating argument. **Largely answered against this concern**: `MessageKeys`/`NamespaceKeys` in `use-intl` source confirm a bare `useTranslations()` yields exactly the flat key union. Not compiled end-to-end, so a cheap spike would close it. |
| An **ICU escaping** problem in the catalogue | Would raise next-intl's migration cost from mechanical to careful. **Measured and clean** (Part 0): no bare braces, no `'` before `{`/`}`/`<`, no bare angle brackets. Re-run that audit if messages change before a migration. |
| The rebuild wants **translator/vendor workflow** on the catalogue | Favours next-intl's plain-JSON-plus-standard-tooling story over inlang's plugin ecosystem, and would argue for moving some of `LocaleContent` into the catalogue too. |

---

## Sources

All retrieved 2026-08-15.

**Paraglide JS / inlang**
- https://paraglidejs.com/ — landing page; tree-shaking and type-safety claims
- https://paraglidejs.com/next-js — the Next.js guide (a stub; no code)
- https://paraglidejs.com/basics — `m.*`, `getLocale`/`setLocale`, `LocalizedString`
- https://paraglidejs.com/strategy — strategies, `routeStrategies`, custom strategies, `overwriteGetLocale`
- https://paraglidejs.com/i18n-routing — `urlPatterns`, prefix modes, documented no-prefix mode
- https://paraglidejs.com/middleware — `paraglideMiddleware`, the Next middleware example
- https://paraglidejs.com/server-side-rendering — AsyncLocalStorage, hydration-mismatch warning
- https://paraglidejs.com/compiling-messages — CLI / bundler plugins / programmatic; generated layout; TS 7 note
- https://paraglidejs.com/objects-and-arrays — the `JSON.parse` escape hatch and why there's no `returnObjects`
- https://paraglidejs.com/comparison — feature matrix (vs i18next / React-Intl; next-intl not covered)
- https://paraglidejs.com/message-keys — flat vs nested, stable-id rationale
- https://paraglidejs.com/errors — "No locale found" causes; request-context requirements of the `url` strategy
- https://paraglidejs.com/changelog — `baseLocale` as the exhaustive branch in generated message functions
- `github.com/opral/paraglide-js@main` — `examples/next-js-ssr/{README.md,package.json,next.config.mjs,src/app/layout.tsx}`, `examples/next-js-ssg/README.md`
- https://github.com/opral/paraglide-js/issues/675 — Turbopack incompatibility; maintainer: *"out of scope"*
- https://github.com/opral/paraglide-js/issues/245#issuecomment-2608727658 — maintainer on async request APIs, AsyncLocalStorage, and recommending against Next.js
- https://github.com/opral/inlang-paraglide-js/issues/407 — the `localizeHref` origin bug the docs' warning cites; closed as not planned

**next-intl**
- https://next-intl.dev/docs/workflows/typescript — `AppConfig` augmentation, `createMessagesDeclaration`, the tsc benchmark
- https://next-intl.dev/docs/usage/translations — flat vs nested keys, the `.` constraint, namespace-optional `useTranslations`, ICU syntax, escaping; `t` returns `string`; `t.rich`/`t.markup`/`t.raw`
- https://next-intl.dev/docs/usage/messages — rich text, nested objects, message arrays
- https://next-intl.dev/docs/usage/configuration — `messages` loading, `onError`/`getMessageFallback`, missing-key behaviour
- https://next-intl.dev/docs/environments/server-client-components — RSC vs client, `getTranslations`, `NextIntlClientProvider`, the four splitting options, no tree-shaking
- https://next-intl.dev/docs/getting-started/app-router — the cookie-only default path
- https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing — no locale prefix, no `[locale]` folder
- https://next-intl.dev/docs/routing/configuration — `localePrefix` modes, `prefixes`, `domains`, `NEXT_LOCALE` cookie
- https://next-intl.dev/docs/routing/setup — static rendering; `setRequestLocale` documented as legacy vs `next/root-params`
- https://next-intl.dev/docs/usage/plugin — `createNextIntlPlugin` and its experimental options
- https://next-intl.dev/docs/usage/extraction — `useExtracted` (4.5.0)
- https://next-intl.dev/docs/workflows/messages — `@eloqnt/cli` for cross-locale linting
- https://next-intl.dev/blog/next-intl-4-0 — strictly-typed ICU arguments; `IntlMessages`→`AppConfig`
- https://next-intl.dev/blog/precompilation — ahead-of-time ICU compilation (4.8.0), ~9 KB saving, `t.raw` tradeoff
- `github.com/amannn/next-intl@main` — `packages/use-intl/src/core/{AppConfig,MessageKeys,ICUArgs,createTranslator}.tsx`, `createTranslator.test.tsx`; `docs/src/pages/docs/**` (the MDX the site renders)
- https://github.com/amannn/next-intl/issues/1 — *"Automatic tree-shaking of messages"*, still open (last updated 2026-05-15)

**Next.js 16.3.1**
- https://nextjs.org/docs/app/guides/internationalization — App Router i18n guide (`[lang]`, `proxy.js`, `negotiator`, dictionaries, `next/root-params`)
- https://nextjs.org/docs/app/guides/upgrading/version-16 — Turbopack default; webpack config fails the build; `middleware`→`proxy`; sync request APIs fully removed
- https://nextjs.org/docs/app/api-reference/turbopack — *"Turbopack does not support webpack plugins"*
- https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack — `webpack:` still exists (semver-exempt)
- https://nextjs.org/docs/app/api-reference/functions/next-root-params — root params require a segment above the root layout
- https://nextjs.org/docs/app/api-reference/functions/cookies — Request-time API; opts a route into dynamic rendering
- https://nextjs.org/docs/app/guides/preventing-flash-before-hydration — cookie in root layout opts out of static prerendering; `Intl` hydration mismatch
- https://nextjs.org/docs/app/api-reference/config/typescript — *"Add [`next-env.d.ts`] to your `.gitignore`"*
- https://nextjs.org/docs/app/api-reference/cli/next — `next typegen`
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy — proxy runs separately from render code; no shared globals
- https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents — PPR via `cacheComponents` in 16.0
- https://github.com/vercel/next.js/blob/canary/packages/next/src/server/config.ts — *"i18n configuration … is unsupported in App Router"* (a warning, not an error)
- https://github.com/vercel/next.js/issues/69298 — AsyncLocalStorage middleware→server-component; closed 2025-02-27

**Registries**
- https://registry.npmjs.org/{next,next-intl,@inlang/paraglide-js,@inlang/paraglide-next,@inlang/paraglide-js-react}
