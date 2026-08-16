# Animation and View Transitions — research findings

Resolves ticket [#45](https://github.com/YgorPerez/send-lab/issues/45) of the redesign map
([#42](https://github.com/YgorPerez/send-lab/issues/42)). **Research only. This document does not
recommend anything** — the choice is made on
[The component stack](https://github.com/YgorPerez/send-lab/issues/46). Where a fact has a
consequence, the consequence is stated as a consequence, not as advice. Inference is labelled
**INFERENCE**; anything unestablished is labelled **UNKNOWN** with the sources checked named.

**Researched 2026-08-16.** Every version and licence below was read from the npm registry on that
date. Every capability claim carries a URL. Sources used: the npm registry, the published package
tarballs themselves (read with `npm pack`, not installed), motion.dev docs, the
`motiondivision/motion` repo, MDN, the W3C CSS View Transitions Level 1 and Level 2 drafts,
`w3c/csswg-drafts` issues, WebKit release notes, Chrome for Developers, the `TanStack/router` repo
and docs, `pmndrs/react-spring`, `pmndrs/use-gesture`, `formkit/auto-animate`,
`Wombosvideo/tw-animate-css`, and this repo's own tree.

Three framing facts, stated up front so nothing below is read out of scope.

1. **The bundle numbers in this document are measured, not quoted.** §0 says exactly how. They do
   not agree with the numbers on motion.dev, and §1.3 shows both and quantifies the gap rather than
   picking one.
2. **The ticket's premise about `motion/react-mini` is wrong, and it matters.** `motion/react-mini`
   is not a mini build of the `motion.div` component. It exports exactly one thing — a WAAPI-backed
   `useAnimate` hook. §1.2 proves this from the shipped tarball. The "full vs LazyMotion vs mini"
   triad in the ticket is really "full vs LazyMotion vs *a different API that animates nothing
   declaratively*".
3. **Motion 13 is not a competitor to View Transitions; it ships a View Transitions builder.**
   `animateView` wraps `document.startViewTransition`, assigns `view-transition-name`s for you, does
   paired shared-element morphs, and adds an interruption queue the spec does not have — for a
   measured **6.5 kB gzip**, without pulling in the 40 kB component system. This was not in the
   ticket's framing and it reshapes question 4. §4.3.

---

## 0. How I measured

Bundle-size figures for Motion are widely misquoted, so none here are quoted from anywhere.

**Method.** Each candidate's published tarball was downloaded with `npm pack` (read-only; nothing
was installed into this repo and no manifest was touched) and extracted into an isolated
`node_modules` outside the repo. A one-line entry module was written per case that *imports and
retains* the API a real caller would use, then bundled with **Vite 8.0.16 / Rollup 4.62.2** —
the same bundler TanStack Start builds with — as `format: "es"`, `target: "es2022"`,
`minify: "esbuild"`, `NODE_ENV=production`, with `react`, `react-dom` and `react/jsx-runtime` marked
**external**. React is excluded deliberately: the question is the *incremental* cost of the
animation layer, not of React.

Output chunks were then compressed with Node's `zlib.gzipSync(level: 9)` and
`zlib.brotliCompressSync(quality: 11)`. For code-split cases the Rollup chunk graph was walked from
the entry along `import-statement` edges, so **"initial" means statically reachable from the entry**
and "async" means reachable only through a dynamic `import()`. Every case was also run through
**esbuild 0.25.12** independently; the two bundlers agreed to within 1% on every non-split case.

**Two caveats on the method, both of which cut against my own numbers.**

- Rollup and esbuild disagree sharply on code splitting. esbuild hoists the code shared between the
  entry and the lazy chunk into a chunk the entry imports *statically*, which destroys the
  LazyMotion saving entirely (measured: 29.8 kB gzip initial, i.e. worse than not splitting).
  Rollup does not. The LazyMotion numbers in §1.1 are therefore **Rollup's**, and they are the ones
  that describe a real TanStack Start build. A project that swapped bundlers would lose the saving.
  **This is the single most fragile number in this document.**
- Real gains depend on what else is in the graph. These are isolated measurements; a real app shares
  helpers across chunks.

**Reproducibility.** The harness is three short scripts, kept in the scratchpad alongside this
document, not committed: they need a network fetch and a throwaway `node_modules`.

---

## Versions this document describes

All read from the npm registry on **2026-08-16**. "Published" is the publish timestamp of that exact
version.

| Package | Version | Licence | Published |
| --- | --- | --- | --- |
| `motion` | **13.1.0** | MIT | 2026-08-10 |
| `framer-motion` | **13.1.0** | MIT | 2026-08-10 |
| `motion-dom` | **13.0.0** | MIT | 2026-08-05 |
| `motion-utils` | **13.0.0** | MIT | 2026-08-05 |
| `@react-spring/web` | **10.1.2** | MIT | 2026-06-24 |
| `@use-gesture/react` | **10.3.1** | MIT | **2024-03-21** |
| `@formkit/auto-animate` | **0.10.0** | MIT | 2026-07-10 |
| `tw-animate-css` (incumbent, `^1.4.0`) | **1.4.0** | MIT | 2025-09-24 |
| `tailwind-variants` (settled, repo has `^3.2.2`) | **3.3.1** | MIT | 2026-08-03 |
| `tailwindcss` | **4.3.3** | MIT | 2026-07-16 |
| `@tanstack/react-router` | **1.170.29** | MIT | 2026-08-14 |
| `@tanstack/react-start` | **1.168.46** | MIT | 2026-08-14 |
| `tailwindcss-motion` (dropped, still a devDep in this tree) | 1.1.1 | MIT | **2025-06-10** |

Three notes on that table.

- **`tailwindcss-motion`'s last publish was 2025-06-10 — fourteen months ago.** The drop decision
  holds on the registry evidence. It is still `@plugin`'d at `src/app.css:3` and still a devDep; the
  rebuild simply does not carry it over.
- **`@use-gesture/react` last published 2024-03-21 — nearly two and a half years ago.** It is the
  only route to gestures for `@react-spring/web` (§2.2). Its peer range is `react: ">= 16.8.0"`,
  which admits React 19 by construction rather than by testing.
- **`motion` v13 depends on `framer-motion` v13, not the other way round.** Read from the published
  `motion@13.1.0` manifest: `dependencies: { "framer-motion": "^13.1.0", "tslib": "^2.4.0" }`, and
  `motion/dist/es/react.mjs` is literally `import * as fm from 'framer-motion'; export * from
  'framer-motion';`. `motion` is a 171 kB tarball of re-export shims over a 1.25 MB `framer-motion`.
  Installing either gets you the same code at the same version. The official guidance is
  nonetheless to install `motion` and import from `motion/react`
  ([upgrade guide](https://motion.dev/docs/react-upgrade-guide), repo README) — no formal
  deprecation notice for `framer-motion` was found on either.

---

## 1. What Motion actually costs and gives

### 1.1 Measured, per entry point

Vite 8.0.16 / Rollup 4.62.2, gzip -9, React external, 2026-08-16. **Bytes, gzipped.**

| Import | Initial (gzip) | Async (gzip) | Total (gzip) | Brotli, initial |
| --- | ---: | ---: | ---: | ---: |
| `motion/react` — `motion.div` only | **40 647** | — | 40 647 | 37 741 |
| `motion/react` — `motion.div` + `AnimatePresence` | **42 284** | — | 42 284 | 37 741 |
| `motion/react` — realistic surface¹ | **48 853** | — | 48 853 | 43 444 |
| `LazyMotion` + `m` + `AnimatePresence` + `domAnimation`, **not split** | **28 693** | — | 28 693 | 26 030 |
| `LazyMotion` + `m` + `AnimatePresence` + `domMax`, **not split** | **42 325** | — | 42 325 | 37 785 |
| `LazyMotion` + `m` + `AnimatePresence`, **`domAnimation` lazy** | **16 424** | 14 571 | 30 995 | 14 983 |
| `LazyMotion` + `m` + `AnimatePresence`, **`domMax` lazy** | **16 524** | 28 278 | 44 802 | 15 036 |
| `LazyMotion` + `m`, no `AnimatePresence`, `domAnimation` lazy | **14 697** | 14 608 | 29 305 | — |
| `motion/react-mini` — `useAnimate` (see §1.2) | **3 208** | — | 3 208 | 2 930 |
| `motion` (vanilla hybrid) — `animate` | **22 815** | — | 22 815 | 20 715 |
| `motion/mini` (vanilla mini) — `animate` | **3 095** | — | 3 095 | 2 827 |
| **`animateView` alone (View Transitions builder, §4.3)** | **6 514** | — | 6 514 | — |
| `animateView` + `spring` | 8 028 | — | 8 028 | — |
| `animateView` + `motion/mini` `animate` | 7 257 | — | 7 257 | — |

¹ `motion`, `AnimatePresence`, `MotionConfig`, `useReducedMotion`, `useAnimate`, `useMotionValue`,
`useSpring`, `useScroll`, `useTransform`, `LayoutGroup`.

Isolated components, same method: `AnimatePresence` alone **2 192**; `useReducedMotion` alone
**247**; `LazyMotion` + `m` with no features at all **6 799** (animates nothing until a feature
bundle loads).

### 1.2 What each entry point can and cannot do

**`motion/react` (full).** Everything. The cost is structural, not accidental: `motion` is a
`Proxy`, so `motion.div` cannot be tree-shaken to less than the whole component system. The docs say
this outright — "Because of its declarative, props-driven API, it's impossible for bundlers to tree
shake it any smaller"
([reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size)). My measurement confirms
it: `motion.div` alone costs 40.6 kB, within 1.7 kB of the same import plus `AnimatePresence`.

**`LazyMotion` + `m`.** `m` "works identically to `motion` but excludes preloaded features"
(same page); features arrive as a separate bundle.
- `domAnimation` — "animations, variants, exit animations, and tap/hover/focus gestures."
- `domMax` — "all of the above, plus pan/drag gestures and layout animations."

  So **`layoutId` shared-element morphs and drag both require `domMax`**, the expensive one. On the
  measured numbers, deferring `domMax` moves 28.3 kB off the critical path but costs 44.8 kB total —
  *more* than importing `motion/react` outright (42.3 kB). **LazyMotion + `domMax` is a
  time-shifting trick, not a size reduction.** LazyMotion only reduces total bytes if you stop at
  `domAnimation`, i.e. if you give up layout animation and drag.

**`motion/react-mini` — the ticket's premise is wrong.** Read from the shipped tarball,
`motion/dist/es/react-mini.mjs` is one line, `export * from 'framer-motion/mini'`, and
`framer-motion/dist/es/mini.mjs` is one line:

```js
export { useAnimateMini as useAnimate } from './animation/hooks/use-animate-style.mjs';
```

**That is the entire entry point.** No `motion`/`m` component, no `AnimatePresence`, no `layout`, no
drag. It is an imperative scoped-animation hook and nothing else. It is "built exclusively on the
Web Animations API" and "can only animate registered CSS properties in modern browsers"
([animate docs](https://motion.dev/docs/animate)); springs work but are not bundled by default —
you must `import { spring } from "motion"` and pass the imported object as `type`
([mini-spring troubleshooting](https://motion.dev/troubleshooting/mini-spring)).

Consequence: the ticket's three-way comparison is really a two-way one. Choosing `react-mini` is not
choosing a cheaper Motion, it is choosing to hand-write imperative animations and give up the
declarative component API entirely — at which point the honest comparison is against raw WAAPI
(§2.4), which costs 0 bytes and does much the same thing.

**`motion/react-m`** is the separate entry that exports the `m` components and `create`. It is what
you import from when you want LazyMotion's saving to survive bundling; importing `m` from the
`motion/react` barrel instead drags more of the barrel in.

### 1.3 The gap between the docs' numbers and mine

motion.dev states, on
[Reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size): full `motion` **34kb**; `m` +
`LazyMotion` "just under **4.6kb** for the initial render"; `domAnimation` **+15kb**; `domMax`
**+25kb**; mini `useAnimate` **2.3kb** (and **17kb** for hybrid `useAnimate` on that page but
**18kb** on the [animate page](https://motion.dev/docs/animate) — the docs disagree with themselves
by 1 kB).

| Thing | motion.dev | Measured here | Gap |
| --- | ---: | ---: | ---: |
| Full `motion/react` | 34 kB | 40.6 kB | +19% |
| `m` + `LazyMotion` base | 4.6 kB | 6.8 kB | +48% |
| `+ domAnimation` | +15 kB | +14.6 kB | −3% |
| `+ domMax` | +25 kB | +28.3 kB | +13% |
| mini `animate` / mini `useAnimate` | 2.3 kB | 3.1 / 3.2 kB | +35% |

The *deltas* agree closely; the *baselines* do not. The docs' basis is stated only loosely — the page
opens by contrasting itself with "the gzipped and minified size … using a bundle analysis website
like Bundlephobia," and never re-attaches "gzipped" to any individual figure. **I did not establish
what version or bundler the docs' figures were taken with** — the page carries no date and no method
note. **UNKNOWN.** Both sets are reported here; neither is asserted over the other. The direction of
the gap is consistent (mine are larger), which is what one would expect if the docs' figures predate
some version growth.

### 1.4 Engine, and whether it survives on a phone

Motion is a **hybrid engine**: it "runs animations natively in the browser using the Web Animations
API and ScrollTimeline" and "seamlessly falls back to JavaScript" for "spring physics, interruptible
keyframes, or gesture tracking"
([motion component docs](https://motion.dev/docs/react-motion-component)). On the same page:
"Physical properties like `x` and `scale` use spring physics by default; visual properties like
`opacity` use tween easing."

Read together, that is a load-bearing consequence for a phone: **Motion's default behaviour on
transforms is the JS path, not the compositor path**, because springs are what it defaults to for
`x`/`scale` and WAAPI cannot express a spring natively. The hardware-accelerated case is the one the
vanilla docs describe — "when a value can be hardware accelerated, like `opacity`, `filter` or
`transform`, it will be" ([animate docs](https://motion.dev/docs/animate)) — which applies when the
animation is a tween WAAPI can take over. An exhaustive value-type-to-engine table is **not
published**; the `x`/`scale` vs `opacity` sentence above is the most specific statement in the docs.
**UNKNOWN** beyond that.

`motion/mini` and `motion/react-mini` have **no** JS fallback at all — WAAPI only — which is both
why they are 3 kB and why they cannot do arbitrary springs without an extra import.

### 1.5 React 19 and client-only

Peer range on the published manifest is `react: "^18.0.0 || ^19.0.0"`, `react-dom` likewise; the docs
require "React versions 18.2 and higher"
([installation](https://motion.dev/docs/react-installation)). React 19 fixes appear in the
changelog (in-flight motion values across React 19 reorder unmount/remount; a drag `undefined` error
under React 19 Strict Mode). **React Compiler compatibility is not stated in official docs —
UNKNOWN.** No caveat was found against a client-only SPA; the only installation caveat on that page
is Next.js App Router-specific (`"use client"` or `motion/react-client`), which does not apply to a
`ssr: false` TanStack Start app.

---

## 2. The lighter alternatives

### 2.1 `tw-animate-css` 1.4.0 — the incumbent

Already a dependency at `^1.4.0`, and already the *only* animation mechanism this app uses (§3.1).
shadcn's own Tailwind 4 docs make it the sanctioned successor: "We've deprecated `tailwindcss-animate`
in favor of `tw-animate-css`" ([ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4)).
Imported as `@import "tw-animate-css";` — no plugin registration, **no JS runtime whatsoever**.

**Measured payload.** Read from the published tarball: `dist/tw-animate.css` is 14 880 bytes raw,
**1 780 bytes gzipped**, and that is the *source* file, not the emitted output. Its structure, read
directly:

- **17 `@property` declarations** (the `--tw-enter-*` / `--tw-exit-*` / `--tw-animation-*` registered
  customs). These are top-level and emitted unconditionally.
- One `@theme inline` block, tree-shaken by Tailwind 4 to the tokens actually referenced.
- **54 `@utility` definitions**, emitted only when the corresponding class appears in your source.
- **7 `@keyframes`**: `enter`, `exit`, `accordion-down`, `accordion-up`, `collapsible-down`,
  `collapsible-up`, `caret-blink`.

So the shipped cost is the 17 `@property` rules plus whichever of the 54 utilities you use — a few
hundred bytes gzipped in practice, against 40 kB of JS for full Motion. **This is the only candidate
whose cost is under a kilobyte.**

**What it provides.** `animate-in` / `animate-out` as the base pair, then `fade-in`/`fade-out`,
`zoom-in`/`zoom-out`, `spin-in`/`spin-out`, `blur-in`/`blur-out`, and directional
`slide-in-from-*`/`slide-out-to-*`. Parameters as `duration-*`, `delay-*`, `ease-*`, `repeat-*`,
`direction-*`, `fill-mode-*`, `running`/`paused`. Direction-aware `slide-in-from-start`/`-end` using
`:dir()`, which is dead weight for an en-US/pt-BR app (both LTR) but costs nothing unused.

**Three things I verified are absent**, by searching the shipped CSS directly:

- **Zero `prefers-reduced-motion` handling.** Not one occurrence. §5.
- **Zero View Transitions support.** No `view-transition` anywhere — no `::view-transition-*`
  utilities, no `view-transition-name` utility. If View Transitions are styled, that CSS is written
  by hand.
- **Zero `@starting-style`.**

**A seam finding worth carrying to #46.** The accordion and collapsible keyframes resolve their
height from a chain of vendor custom properties:
`var(--radix-accordion-content-height, var(--bits-accordion-content-height,
var(--reka-…, var(--kb-…, var(--ngp-…, auto)))))`. That chain covers Radix, Bits UI, Reka, Kobalte
and NGP. **It does not contain a Base UI variable** — I searched the file for `base-ui`: zero
matches. Since the map records that `shadcn@4.18.0` now defaults to Base UI, `tw-animate-css`'s
prebuilt accordion/collapsible keyframes may not bind to a Base UI accordion out of the box. The
fallback is `auto`, which does not animate. **This is a fact about the file, not a prediction about
Base UI** — whether Base UI exposes an equivalent variable under another name was not checked here
and belongs to [#46](https://github.com/YgorPerez/send-lab/issues/46). Also relevant: the maintainer's
README warns "it might not be a 100% compatible drop-in replacement" and signals a breaking v2.0.0.

**What it cannot express.** No exit animation on React unmount — it supplies `animate-out` classes
but has no lifecycle hook, so something must keep the component mounted until the animation ends. No
FLIP/layout measurement. No gestures. No springs. No interruption model beyond what CSS animations
give you.

### 2.2 `@react-spring/web` 10.1.2

**Measured**: `useSpring` + `useTransition` + `animated.div` + `config` = **18 800 gzip** (16 914
brotli). `useSpring` + `animated` alone = 17 346. Adding `@use-gesture/react` takes it to **25 334
gzip**. `@use-gesture/react` alone is 6 895. **No size figure is stated in official docs** — the
README carries none and react-spring.dev returned 403 to direct fetches.

**What it is.** "A cross-platform spring-physics first animation library"
([README](https://github.com/pmndrs/react-spring)) — springs by default, optional duration/easing,
declarative and imperative (`api.start`) usage, genuinely interruptible (a new goal retargets the
spring rather than restarting it).

**What it is not.** **No layout/FLIP.** Confirmed from the repo's own issues: "FLIP-style animations"
([#9](https://github.com/pmndrs/react-spring/issues/9)) is **open** and has been since the project's
early days; "Does react-spring use FLIP animations?"
([#395](https://github.com/pmndrs/react-spring/issues/395)) is **closed**. The maintainer's position
in that discussion is an explicit rejection of automatic FLIP. So the one capability people most
often want a JS library for — `layoutId`-style shared-element morphs — is the one thing react-spring
does not have.

**Exit animations** come from `useTransition`'s `from`/`enter`/`leave` phases.

**Gestures are a separate, stale package.** `@use-gesture/react`'s own README says the quiet part:
"You can use it stand-alone, but to make the most of it you should combine it with an animation
library like react-spring." Last published **2024-03-21** (§Versions). A swipeable sheet on this
stack is `@react-spring/web` + a package that has not shipped in 29 months.

**React 19.** Supported since v10.0.0 (2025-05-14). Issue
[#2341](https://github.com/pmndrs/react-spring/issues/2341) is **closed**; PR
[#2349](https://github.com/pmndrs/react-spring/pull/2349) was **closed unmerged** and the work landed
via [#2368](https://github.com/pmndrs/react-spring/pull/2368). Current peer range includes `^19.0.0`.

**Phone.** react-spring drives arbitrary interpolated values through a `requestAnimationFrame` loop
and writes styles imperatively; it is not WAAPI-based. **No compositor claim appears in its own
docs.** Treat as main-thread — **INFERENCE**, from architecture, not a quoted statement.

### 2.3 `@formkit/auto-animate` 0.10.0

**Measured**: `useAutoAnimate` from `@formkit/auto-animate/react` = **3 289 gzip** (2 951 brotli);
the core default export = 3 144. **The official docs and README state no size figure at all** — the
marketing site carries no numbers, only "zero-config". The "3.28 kB gzipped" figure that circulates
traces to aggregators, not to FormKit. My measurement happens to land at 3.29 kB, but the two are
independent; do not read the coincidence as corroboration.

**What it does, exactly.** From the docs: animations fire "when one of three events occurs: a child
is added in the DOM. A child is removed in the DOM. A child is moved in the DOM" — and "will be
applied to the parent element and **its immediate children**." That is the whole feature. It is a
FLIP-for-lists primitive with a one-line API and no configuration surface to speak of.

**Reduced motion is the only candidate here that gets it right by default.** Verified in
`src/index.ts`: `window.matchMedia("(prefers-reduced-motion: reduce)")`, with an
`AutoAnimateOptions.disrespectUserMotionPreference` escape hatch documented as "It is not
recommended to use this," defaulting to `false`. §5.

**Phone.** Verified in source: it calls native `Element.animate()` (WAAPI), and its plugin interface
returns a `KeyframeEffect`. So its transform/opacity work gets WAAPI's compositor eligibility. The
library makes no compositor claim of its own.

**Known limitation, from its own docs**: flex layouts using `flex-grow: 1` "don't resize children
immediately, causing AutoAnimate to perform poorly."

### 2.4 The Web Animations API, used directly

**0 bytes.** Everything below is MDN.

**What it can express.** `Element.animate(keyframes, options)` creates, applies and plays an
`Animation` in one call, taking all `KeyframeEffect` timing options. `composite`
(`replace`/`add`/`accumulate`) lets independent animations layer on the same property — e.g.
combining a `translateX()` and a `rotate()` — and `iterationComposite` controls build-up across
iterations. `Element.getAnimations()` / `Document.getAnimations()` return every running animation
(CSS Animations, CSS Transitions and script-created alike) for inspection or interruption; MDN's own
example is `document.getAnimations().forEach(a => a.playbackRate *= 0.5)`. `Animation.commitStyles()`
writes the final computed styles to the inline `style` attribute so the end state persists.
`Animation.currentTime` and `playbackRate` are settable, which is the primitive a finger-scrubbed
animation is built on.

**What it cannot express.** No native springs — the easing functions are `cubic-bezier`, `steps` and
`linear()`, and `linear()` only "approximate[s] any curve" via many stop points; MDN's `linear()`
page does not mention springs at all. And beyond timing: no FLIP or layout measurement, no React
unmount lifecycle, no gesture abstraction, no shared-element concept. It is a primitive, not a
system.

**Phone.** MDN's performance guide: "If an element is promoted as a layer, animating transform
properties can be done in the GPU, meaning better performance/efficiency, **especially on mobile**."
That page names `transform` explicitly and defers a fuller property list to an external site; it does
not itself name `opacity` or `filter`. motion.dev does name all three together.

### 2.5 `motion` vanilla, and one non-candidate

`motion/mini` `animate` at **3 095 gzip** measured is the interesting one: WAAPI-only, hardware-
accelerated where the value allows, spring available by explicit import. It is effectively "WAAPI
with a nicer signature and a spring you can opt into" for 3 kB. Full vanilla `motion` `animate` is
**22 815 gzip**.

`react-transition-group` was checked and is **not a candidate**: BSD-3-Clause (not MIT, unlike every
other package here), and its own docs disclaim being an animation library — "it does not animate
styles by itself… it exposes transition stages, manages classes and group elements and manipulates
the DOM."

### 2.6 Everything measured, one table

Gzipped bytes, Vite 8.0.16 / Rollup 4.62.2, React external, 2026-08-16.

| Option | Initial gzip | Layout/FLIP | Gestures | Springs | Exit on unmount | Reduced motion |
| --- | ---: | --- | --- | --- | --- | --- |
| `tw-animate-css` (incumbent) | ~**0.3 kB**¹ | no | no | no | classes only, no hook | **none shipped** |
| WAAPI direct | **0** | no | no | no (approx. via `linear()`) | no | manual |
| `motion/mini` `animate` | **3.1** | no | no | opt-in import | no | manual |
| `motion/react-mini` `useAnimate` | **3.2** | no | no | opt-in import | no | manual |
| `@formkit/auto-animate` | **3.3** | list add/remove/move only | no | no | yes, for list children | **automatic** |
| `motion` `animateView` | **6.5** | via View Transitions | no | easings mapped | via VT snapshots | manual |
| `@use-gesture/react` alone | **6.9** | n/a | yes | n/a | n/a | n/a |
| LazyMotion + `m` + AP, `domAnimation` lazy | **16.4** (+14.6 async) | **no** | hover/tap/focus only | yes | yes | opt-in |
| `@react-spring/web` | **18.8** | **no** (#9 open) | no (+6.9 for gestures) | yes | yes | opt-in |
| `motion` vanilla hybrid | **22.8** | no | no | yes | no | manual |
| `@react-spring/web` + `@use-gesture/react` | **25.3** | **no** | yes | yes | yes | opt-in |
| LazyMotion + `m` + AP + `domAnimation`, unsplit | **28.7** | no | hover/tap/focus only | yes | yes | opt-in |
| `motion/react` full | **42.3** | **yes** | **yes** | yes | yes | opt-in |
| LazyMotion + `domMax` lazy | 16.5 (+28.3 async, **44.8 total**) | **yes** | **yes** | yes | yes | opt-in |

¹ Emitted output, not the 1.78 kB source file: 17 `@property` rules plus only the utilities used.
Estimated from the file's structure, not measured through a Tailwind build — **INFERENCE**.

---

## 3. The capability line

### 3.1 What this app animates today — the only hard evidence available

Before asking what a library gives, here is what the nine-page console actually does now, counted
across `src/`:

- **Zero** imports from `svelte/transition`, `svelte/animate` or `svelte/motion`. **Zero**
  `transition:` / `in:` / `out:` / `animate:` directives. The current app uses no JS animation
  primitive of any kind, in a framework that ships them for free.
- **15 uses of `animate-in`**, 2 of `animate-out`, 1 `animate-spin`, and one
  `animate-accordion-up`/`-down` pair — all `tw-animate-css`, all CSS.
- 17 `duration-300`, 5 `transition-colors`, 5 `transition-all`, 1 `transition-opacity`.
- One `prefers-reduced-motion` block, at `src/app.css:101`.

`animate-in` appears on `/`, `train`, `log`, `week`, `program`, `settings`, `studies`, `stats`,
`metrics`, `exercises`, the error page, and three owned UI components (accordion, popover, select).
That is enter-fade-and-slide on content blocks, and nothing else.

**Consequence, stated as a consequence.** The redesign is not constrained by this — the brief is
that the app "is not really a phone app," and the motion vocabulary is explicitly listed as *not yet
specified* on [#42](https://github.com/YgorPerez/send-lab/issues/42). But it means there is no
existing animation the rebuild must preserve, and no evidence from the current app that anything
beyond CSS enter/exit has ever been needed. Every capability below is a *proposal* about the
redesign, not a requirement inherited from the tree.

### 3.2 The five capabilities, against this app

**Layout animation (`layoutId`-style shared-element morph).** CSS cannot do it: there is no way to
measure two layouts and interpolate between them in CSS alone. Costs `domMax` (44.8 kB total split,
or 42.3 kB unsplit) in Motion; **is not available at all in `@react-spring/web`**
([#9](https://github.com/pmndrs/react-spring/issues/9), open). **But View Transitions do this
natively for free** (§4) — that is the single most important overlap in this ticket. Plausible use
here: a log row expanding into a session detail, a stat card opening into a chart. Both are
route-or-overlay transitions, which is exactly where View Transitions apply.

**Gesture-driven animation that tracks the finger and settles on velocity.** No CSS route, and no
View Transitions route (§4.2 — confirmed absent from the spec, not merely unshipped). This is the
one capability that genuinely and irreducibly requires a JS library. Cost: `domMax` in Motion, or
`@react-spring/web` + a package last published in March 2024. Plausible use here: a swipe-to-dismiss
bottom sheet, or edge-swipe back. **Sceptical note:** on an installed iOS PWA the edge-swipe gesture
is the browser's own, and the CSSWG's own discussion records that a page-level transition on top of
it "won't make sense"
([csswg-drafts#8747](https://github.com/w3c/csswg-drafts/issues/8747)). A finger-tracked sheet on
`train` is the realistic case; finger-tracked *navigation* is not.

**Interruptible spring physics.** CSS transitions do interrupt, but from the current value with the
original easing, which reads as a hitch. Springs retarget smoothly. Relevance here is bounded: the
surfaces that get interrupted are ones the athlete taps repeatedly — set rows on `train`, accordions
on `log`. Whether a 40 kB spring engine is the answer to a 200 ms accordion is the question #46 has
to answer.

**Exit animations for unmounting elements.** The gap is not the animation, it is the *lifecycle*:
React unmounts immediately, so nothing can play. `tw-animate-css` ships `animate-out` classes and no
way to delay unmount. Three routes: `AnimatePresence` (2.2 kB measured on top of the Motion graph
you are already paying for), `useTransition` from react-spring, or hand-rolled state +
`onAnimationEnd`. **This is the most likely real need in the app** — a rest timer finishing, a toast,
a dismissed sheet, the deep-assessment overlay closing. It is also the cheapest to satisfy without a
library, if the transition is a route or overlay change that View Transitions already wrap (§4.1).

**Scroll-linked animation.** `animation-timeline`/`ScrollTimeline` is now a platform feature; Motion
wraps it. **On a nine-page private training console with no marketing surfaces, no hero sections and
no parallax, I found no plausible use.** Adding `useScroll`/`useTransform` to the realistic import
set cost 6.6 kB of the 48.9 kB figure in §1.1.

### 3.3 The line, stated plainly

CSS plus View Transitions covers: enter/exit styling, hover/focus/active states, cross-fades,
route-level morphs, and shared-element morphs between two DOM states. What is left for a JS library,
for *this* app, is:

1. **Finger-tracked, velocity-settled gestures.** Irreducible.
2. **Delaying React's unmount** so an exit animation can play — a lifecycle problem, ~2 kB, not an
   animation problem.
3. **Interruption that retargets rather than restarts**, and springs generally.
4. **Layout morphs that are not route or overlay changes** — a reorder inside a list, say — where
   there is no navigation for View Transitions to hang off. `auto-animate` covers exactly this case,
   for 3.3 kB.

Everything else on the usual feature list either has a CSS or View Transitions equivalent, or has no
plausible use on nine private pages.

---

## 4. View Transitions versus the library

Browser-support facts are the subject of
[#43](https://github.com/YgorPerez/send-lab/issues/43); **§4.4 gives only the minimum needed to
answer the overlap question and defers the matrix there.**

### 4.1 What View Transitions carry on their own

`document.startViewTransition(updateCallback)` snapshots the old state, runs your DOM update,
snapshots the new state, and animates between them through a generated pseudo-element tree —
`::view-transition` → `::view-transition-group(name)` → `::view-transition-image-pair(name)` →
`::view-transition-old(name)` / `::view-transition-new(name)`
([CSS View Transitions L1](https://drafts.csswg.org/css-view-transitions-1/),
[MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)). The UA default is a
cross-fade, with one exception MDN states directly: "`height` and `width` transitions have a smooth
scaling animation applied," and "`position` and `transform` transitions have a smooth movement
animation applied."

**Shared-element morphs work, natively, with no library.** Give the before-element and the
after-element the same `view-transition-name` and the browser interpolates position, size and
border-radius between them. That is `layoutId` — the capability that costs `domMax` in Motion and is
absent from react-spring — as a CSS property.

Four documented limits, all load-bearing:

- **Names must be unique at capture time, and duplicates skip the whole transition.** MDN: "If two
  rendered elements have the same `view-transition-name` at the same time, the `ViewTransition.ready`
  Promise will reject and **the transition will be skipped**." The spec's capture algorithm is
  literal about it: "If usedTransitionNames contains transitionName, then … return failure." On a
  page of repeated rows — `log`'s grouped sessions, `train`'s set rows — this is a real hazard: the
  failure mode is not a wrong animation, it is *no* animation.
- **The old snapshot is a static bitmap.** MDN: "so that the user can't interact with it as it
  animates 'out'." Anything inside it — text reflow, a running timer, a nested animation — is frozen
  for the duration.
- **Aspect-ratio distortion.** The default `inline-size: 100%; block-size: auto` stretches content
  between differently-proportioned states; MDN's own example needs a manual
  `html::view-transition-old(*), html::view-transition-new(*) { height: 100% }` fix.
- **Fragmented elements are silently excluded.** Spec: "If element has more than one box fragment,
  then continue" — it gets no name and no snapshot.

**Level 2 adds** `@view-transition` (cross-document), `view-transition-class`, the
`view-transition-group` *property* for nested groups (`normal | contain | nearest | <custom-ident>`),
and `types` / `:active-view-transition-type()`. **Maturity today**: Level 1 is a **Candidate
Recommendation Draft** (28 March 2024); Level 2 is a **Working Draft** (TR snapshot 13 November 2024,
editor's draft moving as of August 2026). Level 2 is materially less settled than Level 1.

### 4.2 What View Transitions cannot do

**Interruption is a hard abort, not a retarget.** The spec, step 5 of `startViewTransition()`: "If
document's active view transition is not null, then **skip that view transition with an `AbortError`
DOMException**." Chrome's docs put it plainly: "Only one view transition is allowed to run at a time.
If a new view transition starts while one is already running, the old transition skips to the end."
This is the sharpest difference from a spring library: an interrupted view transition snaps; an
interrupted spring retargets.

**There is no scrubbing, and no reversal.** No mechanism exists to drive a `ViewTransition`'s
progress from a finger or from `animation-timeline`.
[csswg-drafts#7957](https://github.com/w3c/csswg-drafts/issues/7957) — reversing/cancelling a
transition mid-flight — is **open** and unresolved since October 2022.
`ViewTransition.waitUntil()` was added to Level 2 by
[PR #12925](https://github.com/w3c/csswg-drafts/pull/12925) (merged 2025-10-17, resolving
[#9901](https://github.com/w3c/csswg-drafts/issues/9901), closed), but it only lets a transition
*wait for* a scroll-driven animation before tearing down snapshots — it does not expose a seek. **A
swipeable sheet that tracks the finger and settles on velocity cannot be a View Transition.** That is
confirmed-absent from the spec, not merely unshipped.

### 4.3 Motion 13 ships a View Transitions builder — `animateView`

This was not in the ticket's framing and it changes the shape of the question. Read from the
published `motion-dom@13.0.0` tarball (`dist/es/view/index.mjs`, `start.mjs`, `queue.mjs`), exported
as `animateView` and reachable as `import { animateView } from "motion"` or `from "motion/react"`.
**Measured at 6 514 bytes gzip standalone** — it does not drag in the `motion.div` component system.

It is a chainable builder over `document.startViewTransition` that:

- **Feature-detects and degrades silently**: `if (!document.startViewTransition)` it awaits the
  update and resolves with an empty animation group. No polyfill, no throw.
- **Assigns `view-transition-name`s for you**, resolving selectors or Elements before and after the
  update and releasing the names afterwards — which removes exactly the uniqueness hazard §4.1
  flags, since it manages a name registry rather than leaving you to hand-allocate idents across
  repeated rows.
- **Does paired shared-element morphs between two different elements**: `.add(card, ".modal")`
  resolves the first in the old snapshot and the second in the new, sharing one name. The source
  comment: "so two *different* elements morph into each other… Symmetric — pass them the other way
  round to morph back."
- **Wraps Level 2 features**: `.class(name)` sets `view-transition-class`; `.group(false)` opts a
  layer out of `view-transition-group: contain` nesting so it "escapes an ancestor's clip"; `.crop()`
  controls clip + `object-fit: cover` + animated corner radii on a morph.
- **Adds an interruption queue the spec does not have.** `ViewTransitionOptions.interrupt` is
  `"wait" | "immediate"`, defaulting to `"wait"`. `queue.mjs` serialises builders; an `"immediate"`
  builder batches all preceding pending updates into itself and jumps the queue. This does not make
  a running transition reversible — the spec's `AbortError` still applies (§4.2) — but it removes
  the "second navigation kills the first" failure mode for *queued* transitions.
- **Maps Motion's easings, including springs, onto native WAAPI easings** for the pseudo-element
  animations (`mapEasingToNativeEasing`, `applyGeneratorOptions`).

**Consequence.** The choice is not "View Transitions *or* a library." Motion can be adopted purely as
a 6.5 kB View Transitions ergonomics layer, with the 40 kB component system left out entirely. That
is a distinct option the ticket did not enumerate, and it sits between "CSS only" and "Motion".

**It ships no reduced-motion handling** — verified by searching `motion-dom/dist/es/view/` for
`prefers-reduced-motion` and `reducedMotion`: zero matches. §5.

### 4.4 TanStack Router carries the route layer

`@tanstack/react-router` 1.170.29 supports view transitions at the router level.
`RouterOptions.defaultViewTransition` and per-navigation `viewTransition` on `<Link>` and
`navigate()` both take `boolean | ViewTransitionOptions`, where `ViewTransitionOptions` is a `types`
field accepting `Array<string>` or a callback given `fromLocation`, `toLocation`, `pathChanged`,
`hrefChanged`, `hashChanged`
([source: `packages/router-core/src/router.ts` ~lines 290, 857, 1021](https://github.com/TanStack/router);
[docs](https://tanstack.com/router/latest/docs/framework/react/api/router/ViewTransitionOptionsType)).

`RouterCore.startViewTransition` (~line 2378) guards on three things: not server, `typeof
document.startViewTransition === 'function'`, and — separately — `window.CSS?.supports?.('selector(:active-view-transition-type(a))')`
before passing the Level 2 `types` object, falling back to a plain `startViewTransition(fn)` when
that check fails. Both degradations are silent.

**What the router does not carry.**

- **Shared-element/element-level transitions are not implemented.**
  [TanStack/router#5670](https://github.com/TanStack/router/discussions/5670), "Element View
  Transition API", is **open** (opened 2025-10-28); an April 2026 comment raises React's own
  forthcoming `<ViewTransition>` component as the likely resolution, i.e. the router is deferring
  rather than building. So route-level transitions are the router's; **shared-element morphs are
  yours to name**, by hand or via `animateView` (§4.3).
- **Lifecycle events are not merged.** [TanStack/router#5861](https://github.com/TanStack/router/pull/5861)
  (`onViewTransitionStart` / `Ready` / `UpdateCallbackDone` / `Finish`) is **closed**, unmerged
  (2025-11-26).
- **No `flushSync`/concurrent-rendering caveat appears in TanStack's docs.** The risk is documented in
  React's own repo instead: [facebook/react#34510](https://github.com/facebook/react/issues/34510)
  (merged 2025-09-17) adds performance-track instrumentation for "Interrupted View Transition — when
  a `flushSync` update aborts a View Transition before it starts." **INFERENCE:** a `flushSync`
  anywhere in the update path can abort a view transition before it captures, independently of the
  router.

### 4.5 iOS Safari — the minimum needed, deferring the rest

Same-document View Transitions shipped in **Safari 18.0**
([WebKit Features in Safari 18.0](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)):
"WebKit added support for the View Transitions API in Safari 18… Safari supports the CSS View
Transitions Module Level 1 specification." Cross-document (`@view-transition`), `view-transition-name: auto`,
view-transition classes and types shipped in **Safari 18.2**
([WebKit Features in Safari 18.2](https://webkit.org/blog/16301/webkit-features-in-safari-18-2/)).

Because the app is a `ssr: false` SPA, only the **same-document** API is in play — the Safari 18.0
line, not 18.2. Level 2 `types`, which TanStack Router feature-detects separately, is the 18.2 line.

An installed home-screen web app on iOS renders on system WebKit, the same engine as Safari. **No
primary source was found that guarantees version-for-version parity between the installed Safari app
and a home-screen web app's WebKit build — UNKNOWN in that narrow sense**; the general architecture
is well established. **The full support matrix, minimum-version policy and any iOS-specific PWA
quirks belong to [#43](https://github.com/YgorPerez/send-lab/issues/43) and are deliberately not
re-derived here.**

### 4.6 The answer to question 4, without a verdict

View Transitions **can** carry route-level transitions on their own — TanStack Router already wires
them with a one-line option and degrades silently where unsupported. They **can** carry shared-element
morphs on their own, but only if something allocates unique `view-transition-name`s correctly, and
nothing in the router does that today (#5670 open).

They **cannot** carry: a finger-tracked gesture, a smoothly interrupted transition, or an animation
of anything that is not a DOM-state change (a spinner, a pulse, a value counting up). They also
cannot carry an exit animation for a component that unmounts without a navigation.

So the library's remaining job, if View Transitions take the route layer, is: in-component motion,
gestures, and unmount lifecycle. On the measured numbers that is a job `domAnimation` can do
(16.4 kB initial / 31.0 kB total) — **`domMax`, the expensive half, exists mostly to provide layout
animation and drag, and View Transitions replace the layout half of that.**

---

## 5. Reduced motion

| Option | Behaviour under `prefers-reduced-motion: reduce` |
| --- | --- |
| **View Transitions** | **Nothing automatic.** Author must write the media query. |
| `tw-animate-css` | **Nothing shipped** — zero occurrences in the CSS. |
| Motion components | **Off by default.** Opt in via `<MotionConfig reducedMotion="user">`. |
| Motion `animateView` | **Nothing** — zero occurrences in `motion-dom/dist/es/view/`. |
| `@react-spring/web` | Opt-in: `useReducedMotion` hook, or `Globals.assign({ skipAnimation: true })`. |
| `@formkit/auto-animate` | **Automatic and on by default.** |
| WAAPI direct | Manual — `matchMedia` yourself. |

**View Transitions do not honour it automatically, and the fix is still unmerged.** The spec's UA
stylesheet contains no reduced-motion rule.
[csswg-drafts#10267](https://github.com/w3c/csswg-drafts/issues/10267), "Users need to be able to
disable view transitions" (opened 2024-04-29, from TAG review feedback), is addressed by
[PR #10996](https://github.com/w3c/csswg-drafts/pull/10996), "Don't animate transform/size by default
when prefers-reduced-motion is on" — **both still open as of 2026-08-16**. Chrome's docs give the
author-side snippet and a caution worth quoting: "a preference for 'reduced motion' doesn't mean the
user wants *no motion*"
([developer.chrome.com](https://developer.chrome.com/docs/web-platform/view-transitions/same-document)).

On the ticket's sub-question — *is opacity even a motion concern?* — the CSSWG's own framing says no.
The proposed UA default suppresses **transform and size**, leaving the plain cross-fade intact,
because opacity fades are not vestibular triggers the way translating or scaling large regions are
([public-css-archive, Oct 2024](https://lists.w3.org/Archives/Public/public-css-archive/2024Oct/0121.html)).
Consequence: the *default* view transition — an opacity cross-fade — is the least objectionable thing
on this page. It is the shared-element morphs, which move and scale, that need the media query.

**Motion's own model.** `<MotionConfig reducedMotion>` takes `"user"` / `"always"` / `"never"`, and
**the default is `"never"`** ([motion-config docs](https://motion.dev/docs/react-motion-config)) —
Motion disables nothing unless told to. Under `"user"`, components "automatically disable transform
and layout animations, while preserving the animation of other values like `opacity` and
`backgroundColor`" ([useReducedMotion docs](https://motion.dev/docs/react-use-reduced-motion)) —
the same transform-vs-opacity split the CSSWG proposal draws, arrived at independently.
`useReducedMotion` measured at **247 bytes**.

### 5.1 The repo's existing rule does not cover any of this — a finding

`src/app.css:101-108` currently nukes motion globally:

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

That works today because every animation in the app is a CSS animation or transition (§3.1). It does
**not** transfer to the rebuild, for two reasons, both **INFERENCE** from how the platform is
specified rather than from a quoted statement:

- **It cannot reach script-created WAAPI animations.** CSS `animation-*` properties control CSS
  Animations; an `Animation` created by `Element.animate()` has its timing from its own
  `KeyframeEffect`. So `auto-animate`, `motion/mini`, `motion/react-mini`, and Motion's WAAPI path
  are all untouched by this rule. Motion's JS/rAF path, which writes inline styles per frame, is
  untouched twice over.
- **It cannot reach `::view-transition-*` pseudo-elements.** The universal selector does not match
  them; they must be targeted explicitly as `::view-transition-group(*)` and friends.

Consequence: whichever option is chosen, the reduced-motion story has to be rebuilt deliberately.
Carrying the existing block forward would produce an app that *looks* like it honours the preference
and silently does not.

---

## 6. The Tailwind seam

Settled inputs: Tailwind 4 stays, `tailwind-variants` is the variant system (repo has `^3.2.2`;
registry latest is `3.3.1`), components are owned shadcn-style. The question is where animation
lives — utility class, variant, or component prop — and what each candidate implies. This is
vocabulary, so it belongs to [#46](https://github.com/YgorPerez/send-lab/issues/46); what follows is
what each option *forces*, not what is best.

**`tw-animate-css` puts animation in the class string, so `tailwind-variants` owns it for free.**
`animate-in fade-in slide-in-from-bottom-2 duration-300` is a set of utilities like any other, so it
composes into a `tv()` slot or variant with no new concept:

```ts
const card = tv({
  base: "rounded-lg border",
  variants: { enter: { true: "animate-in fade-in slide-in-from-bottom-2 duration-300" } },
});
```

`tailwind-merge` (already a dep at `^3.6.0`) will also dedupe conflicting `duration-*`. There is one
seam cost: this is the *only* option where reduced motion cannot be expressed in the variant at all —
it has to live in global CSS, because there is no `motion-safe:`-style prefix baked into these
classes. (Tailwind's own `motion-safe:` / `motion-reduce:` variants do apply, which is the escape
hatch — but nothing in `tw-animate-css` uses them for you.)

**Motion's declarative components move animation out of the class string and into props**, which
splits the vocabulary in two. `<motion.div animate={{ opacity: 1 }} transition={{ ... }}>` cannot be
expressed as a `tv()` variant; it is a different axis. The practical consequence for owned
components is that each component grows two parallel styling surfaces — `className` from `tv()`, and
motion props — and the component's API has to decide which one a caller reaches for. Motion values
are also not Tailwind tokens: a duration written in a `transition` prop does not come from
`--animation-duration-*`, so the design system's timing scale forks unless it is threaded through by
hand.

**`animateView` (§4.3) does not touch the seam at all.** It is called imperatively at a navigation or
state change, and its styling escape hatch is `.class(name)` → `view-transition-class` → a
`::view-transition-group(.name)` rule in global CSS. Nothing enters the component's class string or
props. **INFERENCE:** this is the only JS option that leaves `tailwind-variants` as the sole
component-level styling vocabulary.

**`@react-spring/web` is the most invasive.** `animated.div` requires styles as interpolated
`SpringValue`s in the `style` prop, which is the one place Tailwind utilities cannot reach. Any
property that springs is a property that leaves the design token system.

**`@formkit/auto-animate` is the least invasive of the JS options** — one ref on a parent, no
per-child classes, no props, no style prop. It adds a hook, not a vocabulary.

**One concrete seam hazard already in the tree.** §2.1: `tw-animate-css`'s accordion and collapsible
keyframes resolve height from `--radix-*` / `--bits-*` / `--reka-*` / `--kb-*` / `--ngp-*`, with no
Base UI variable in the chain and `auto` as the terminal fallback. The repo currently uses `bits-ui`
(`^2.18.1`), which the chain covers. If #46 lands on Base UI, `animate-accordion-down/up` may
silently resolve to `auto` and not animate. That is a fact about the shipped CSS; whether Base UI
publishes an equivalent variable is for #46 to check.

---

## Contradictions and unknowns

1. **motion.dev's bundle figures and mine disagree by 13–48% on baselines** (§1.3), while agreeing
   within 3% on the `domAnimation` delta. The docs' version and method are undated and unstated.
   **UNKNOWN** which is right; both are reported.
2. **motion.dev contradicts itself** on hybrid `useAnimate`: 17 kB on one page, 18 kB on another.
3. **The LazyMotion saving is bundler-dependent.** Rollup preserves it; esbuild destroys it by
   hoisting shared code into a statically-imported chunk (measured: 29.8 kB gzip initial vs Rollup's
   16.4 kB). Vite/Rollup is what TanStack Start uses, so the Rollup numbers are the relevant ones —
   but this is not a property of Motion, it is a property of the build.
4. **`LazyMotion` + `domMax` costs more in total than plain `motion/react`** (44.8 kB vs 42.3 kB).
   It only wins on time-to-first-paint, never on total bytes.
5. **`@use-gesture/react` has not shipped since 2024-03-21**, and it is the only gesture route for
   `@react-spring/web`. Its React 19 compatibility rests on a `">= 16.8.0"` peer range, not on a
   tested release. **UNKNOWN** whether it is tested against React 19.
6. **Two react-spring reduced-motion bugs were reported but their current state was not verified**:
   `skipAnimation` not applying when `enter` is a function (#1429), and not skipping to the end of
   `to` arrays (#1901). **UNKNOWN** — re-check before relying on `skipAnimation`.
7. **`@formkit/auto-animate` publishes no size figure anywhere.** My 3.29 kB measurement coincides
   with a widely circulated aggregator number; treat the agreement as coincidence, not corroboration.
8. **`@react-spring/web` publishes no size figure and no compositor claim**; react-spring.dev
   returned 403 to direct fetches, so its docs were reached only via the GitHub README and source.
   The main-thread characterisation in §2.2 is **INFERENCE**.
9. **`prefers-reduced-motion` for View Transitions is unfixed at spec level** — #10267 and #10996
   both open. Any reduced-motion behaviour must be authored.
10. **Motion's value-type-to-engine mapping (WAAPI vs rAF) is not documented exhaustively.**
    **UNKNOWN** beyond the `x`/`scale` vs `opacity` example.
11. **§5.1's two claims about the existing `app.css` rule are INFERENCE** from how CSS Animations and
    view-transition pseudo-elements are specified, not from a quoted source. They are testable in a
    prototype and worth testing.
12. **Whether Base UI exposes an accordion content-height variable** that `tw-animate-css`'s chain
    would need is **UNKNOWN** — not checked here; belongs to #46.
13. **Version-for-version WebKit parity between Safari and an installed iOS home-screen app** is
    **UNKNOWN** from primary sources (§4.5); deferred to #43.

---

## Where this document belongs

The repo's convention is `docs/research/<slug>.md` on a `research/<slug>` branch — see
`docs/research/tanstack-db.md` on `research/tanstack-db` and `docs/research/local-state-options.md` on
`research/local-state-options`. The in-repo home for this file is therefore
**`docs/research/animation-and-view-transitions.md`** on **`research/animation-and-view-transitions`**.
It was written to a scratchpad path and **no git operation was performed** — this checkout is shared
by concurrent agents, so branching and committing are left to the caller.

## Sources

**Registry** — `https://registry.npmjs.org/<pkg>`, read 2026-08-16, for every row of the versions
table. Package manifests and `dist/` contents read from the published tarballs via `npm pack`.

**Motion** — [reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size) ·
[LazyMotion](https://motion.dev/docs/react-lazy-motion) · [animate](https://motion.dev/docs/animate) ·
[quick start](https://motion.dev/docs/quick-start) ·
[motion component](https://motion.dev/docs/react-motion-component) ·
[useAnimate](https://motion.dev/docs/react-use-animate) ·
[mini spring troubleshooting](https://motion.dev/troubleshooting/mini-spring) ·
[MotionConfig](https://motion.dev/docs/react-motion-config) ·
[useReducedMotion](https://motion.dev/docs/react-use-reduced-motion) ·
[accessibility](https://motion.dev/docs/react-accessibility) ·
[installation](https://motion.dev/docs/react-installation) ·
[upgrade guide](https://motion.dev/docs/react-upgrade-guide) ·
[WAAPI DX](https://motion.dev/docs/improvements-to-the-web-animations-api-dx) ·
[rename announcement](https://motion.dev/blog/framer-motion-is-now-independent-introducing-motion) ·
[repo](https://github.com/motiondivision/motion) · `motion-dom@13.0.0` tarball
(`dist/es/view/index.mjs`, `dist/es/view/start.mjs`, `dist/es/view/queue.mjs`, `dist/index.d.ts`),
`framer-motion@13.1.0` tarball (`dist/es/mini.mjs`, `dist/es/m.mjs`, `dist/es/dom-mini.mjs`,
`dist/es/dom.mjs`).

**View Transitions** — [CSS View Transitions L1 (ED)](https://drafts.csswg.org/css-view-transitions-1/) ·
[L1 (CR Draft, 2024-03-28)](https://www.w3.org/TR/css-view-transitions-1/) ·
[L2 (ED)](https://drafts.csswg.org/css-view-transitions-2/) ·
[L2 (WD, 2024-11-13)](https://www.w3.org/TR/css-view-transitions-2/) ·
[MDN View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) ·
[MDN Using](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using) ·
[MDN startViewTransition](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) ·
[MDN view-transition-name](https://developer.mozilla.org/en-US/docs/Web/CSS/view-transition-name) ·
[MDN view-transition-class](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/view-transition-class) ·
[MDN skipTransition](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/skipTransition) ·
[Chrome, same-document](https://developer.chrome.com/docs/web-platform/view-transitions/same-document) ·
csswg-drafts [#7957 open](https://github.com/w3c/csswg-drafts/issues/7957),
[#8747](https://github.com/w3c/csswg-drafts/issues/8747),
[#9901 closed](https://github.com/w3c/csswg-drafts/issues/9901),
[#10267 open](https://github.com/w3c/csswg-drafts/issues/10267),
[PR #10996 open](https://github.com/w3c/csswg-drafts/pull/10996),
[PR #12925 merged](https://github.com/w3c/csswg-drafts/pull/12925) ·
[public-css-archive 2024Oct/0121](https://lists.w3.org/Archives/Public/public-css-archive/2024Oct/0121.html) ·
[WebKit Safari 18.0](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/) ·
[WebKit Safari 18.2](https://webkit.org/blog/16301/webkit-features-in-safari-18-2/) ·
[developer.apple.com/documentation/WebKit](https://developer.apple.com/documentation/WebKit).

**TanStack Router** — [repo](https://github.com/TanStack/router) (`packages/router-core/src/router.ts`) ·
[ViewTransitionOptions](https://tanstack.com/router/latest/docs/framework/react/api/router/ViewTransitionOptionsType) ·
[RouterOptions](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType) ·
[#5670 open](https://github.com/TanStack/router/discussions/5670) ·
[PR #5861 closed](https://github.com/TanStack/router/pull/5861) ·
[facebook/react#34510](https://github.com/facebook/react/issues/34510).

**Alternatives** — [pmndrs/react-spring](https://github.com/pmndrs/react-spring) ·
[#9 open](https://github.com/pmndrs/react-spring/issues/9) ·
[#395 closed](https://github.com/pmndrs/react-spring/issues/395) ·
[#2341 closed](https://github.com/pmndrs/react-spring/issues/2341) ·
[PR #2349 closed unmerged](https://github.com/pmndrs/react-spring/pull/2349) ·
[PR #2368 merged](https://github.com/pmndrs/react-spring/pull/2368) ·
[pmndrs/use-gesture](https://github.com/pmndrs/use-gesture) ·
[formkit/auto-animate](https://github.com/formkit/auto-animate) (`src/index.ts`) ·
[auto-animate.formkit.com](https://auto-animate.formkit.com/) ·
[Wombosvideo/tw-animate-css](https://github.com/Wombosvideo/tw-animate-css) ·
[ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) ·
[reactcommunity.org/react-transition-group](https://reactcommunity.org/react-transition-group/).

**MDN, Web Animations** — [Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) ·
[KeyframeEffect](https://developer.mozilla.org/en-US/docs/Web/API/KeyframeEffect/KeyframeEffect) ·
[easing-function/linear](https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/linear) ·
[Document.getAnimations](https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations) ·
[Animation.commitStyles](https://developer.mozilla.org/en-US/docs/Web/API/Animation/commitStyles) ·
[Animation.currentTime](https://developer.mozilla.org/en-US/docs/Web/API/Animation/currentTime) ·
[CSS/JS animation performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance).

**This repo** — `package.json`, `src/app.css`, and a `grep`/`git ls-tree` survey of `src/`
(read-only).
