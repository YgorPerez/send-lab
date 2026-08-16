# Base component library — which headless layer the owned components sit on

Research for [#44](https://github.com/YgorPerez/send-lab/issues/44), under the map
[#42](https://github.com/YgorPerez/send-lab/issues/42). Feeds the decision on
[#46](https://github.com/YgorPerez/send-lab/issues/46).

**All versions checked against the npm registry on 2026-08-16.** Facts and trade-offs only; no verdict.

---

## 0. Scope, and what is not in question

Fixed by #42 and not relitigated here: Tailwind 4, `tailwind-variants` as the variant system (already a
dependency at `^3.2.2`; latest is `3.3.1`, published 2026-08-03), and **shadcn-style ownership** —
component source lives in this repo and is edited here.

That last constraint narrows the question more than it first appears. Under shadcn-style ownership you
own the *styled wrapper*; you do not own the *behavioural primitive*, which stays a versioned npm
dependency in every one of these candidates. None of the four is a "copy the a11y engine into your
repo" library. So the question is which behaviour engine your owned wrappers call into.

Target: client-only React SPA on TanStack Start (ADR 0006), installed as a PWA, cold-starting from a
precached `/_shell.html`, used **on a phone, one-handed, mid-set, with chalky hands**. The deciding axis
is touch and overlay behaviour.

---

## 1. The two framing facts — both verified

### `@base-ui-components/react` is deprecated in favour of `@base-ui/react` — CONFIRMED

```
$ npm view @base-ui-components/react version deprecated
version = '1.0.0-rc.0'
deprecated = 'Package was renamed to @base-ui/react'
```

The old package's last publish was 2026-07-15 and it never left RC. `@base-ui/react` is at **1.7.0**,
published 2026-08-04 — unchanged since the 2026-08-15 reading in the ticket.

A third, older name also exists and is deprecated the same way: `@mui/base` is at `5.0.0-beta.70` with
`deprecated = 'This package has been replaced by @base-ui/react'`. If any snippet you find online
imports `@mui/base` or `@base-ui-components/react`, it predates the rename.

### `shadcn@4.18.0` defaults to Base UI, not Radix — see §3

`shadcn` latest is **4.18.0**, published 2026-08-13. Details and registry evidence in §3.

### A third fact worth adding: Base UI is no longer pre-1.0

This materially changes the pinning conversation in the ticket. Base UI **shipped 1.0.0 on
2025-12-11**, and has released a minor roughly every 4–6 weeks since:

```
1.0.0  2025-12-11     1.3.0  2026-03-12     1.6.0  2026-06-18
1.1.0  2026-01-15     1.4.0  2026-04-13     1.7.0  2026-08-04
1.2.0  2026-02-12     1.4.1  2026-04-20
```

(`npm view @base-ui/react time`.) Eight minors and exactly one patch in eight months. See §5 for what
"1.x" does and does not buy you here — the answer is: less than semver implies.

---

## 2. Bundle cost — measured, not estimated

<!-- This section is first-party measurement rather than a citation, so the method is stated in full. -->

**Method.** Installed each candidate at its exact current version into a throwaway directory outside
the repo (the repo's `node_modules` and manifest were not touched), then bundled a module importing
exactly the six components in play with esbuild — `--bundle --minify --format=esm`,
`NODE_ENV=production`, with `react`, `react-dom` and `react/jsx-runtime` marked external. Sizes are of
the resulting JS, gzip `-9` and brotli. Reproduce with the entry files in
`scratchpad/bundle/src/*.jsx`.

Components imported: **dialog, select, popover, accordion, tabs**, plus a **drawer/sheet** where the
library ships one.

### All six together

| Stack | raw | **gzip** | brotli |
|---|---:|---:|---:|
| Radix `radix-ui@1.6.7` + `vaul@1.1.2` | 143.0 KB | **46.2 KB** | 40.6 KB |
| React Aria Components `1.20.0` (incl. Modal/ModalOverlay) | 147.2 KB | **46.6 KB** | 41.0 KB |
| Ark UI `@ark-ui/react@5.38.1` (incl. Drawer) | 205.7 KB | **61.6 KB** | 51.7 KB |
| Base UI `@base-ui/react@1.7.0` (incl. Drawer) | 236.6 KB | **80.6 KB** | 69.3 KB |

### The five, without any drawer

| Stack | raw | **gzip** | brotli |
|---|---:|---:|---:|
| Radix | 113.6 KB | **37.8 KB** | 33.1 KB |
| Ark UI | 164.6 KB | **49.8 KB** | 42.6 KB |
| Base UI | 192.3 KB | **65.8 KB** | 56.6 KB |

### Per component (gzip, measured in isolation)

| | Base UI | Radix | Ark UI | React Aria |
|---|---:|---:|---:|---:|
| dialog | 23.0 KB | 13.7 KB | 19.5 KB | 5.6 KB |
| select | 44.3 KB | 31.3 KB | 32.5 KB | 31.4 KB |
| popover | 40.6 KB | 24.0 KB | 30.0 KB | 21.6 KB |
| accordion | 9.2 KB | 8.8 KB | 11.5 KB | 7.4 KB (Disclosure) |
| tabs | 12.5 KB | 9.2 KB | 12.4 KB | 14.2 KB |
| drawer / sheet | 37.5 KB | 21.8 KB (`vaul`) | 29.5 KB | — (17.7 KB Modal only) |

Per-component figures sum to more than the combined bundle because the libraries share internals; the
combined row is the honest number for a shell that loads all six.

**Reading of this.** Every candidate tree-shakes — all four ship an `exports` map with per-component
subpaths or a side-effect-free barrel, and none pulled in the whole package. The headline size scares
turn out to be wrong in both directions:

- **React Aria's 6.4 MB unpacked / 15.5 MB `react-aria` dependency is not what you ship.** It measured
  at 46.6 KB gzip — the lightest per-component of any candidate for dialog, popover and accordion. I
  checked the module graph directly for the feared `@internationalized/date` leak: for a Select-only
  bundle the graph contains `@internationalized/number` and `@internationalized/string` but **not
  `@internationalized/date`**, which only arrives with a date component.
- **Base UI is the heaviest**, ~75% more gzip than Radix across the six, and its Drawer alone (37.5 KB)
  costs more than Radix's whole dialog+popover pair. Its Select at 44.3 KB is the single most expensive
  component measured. This is the price of the behaviour described in §4; it is not waste, but it is
  real on a precached shell.

Caveat: measured against the current TanStack Start/React tree only in the sense of "React external".
Actual delivered cost depends on route-level code splitting — a drawer used only on `train` need not
sit in the shell.

---

## 3. shadcn 4.18.0 and the registry

**The claim is confirmed, with two corrections that matter.**

### Correction 1 — Base UI became the default in July, not in 4.18.0

The authoritative statement is the changelog entry
[`2026-07-base-ui-default.mdx`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/changelog/2026-07-base-ui-default.mdx),
dated **2026-07-02**, titled "July 2026 — Base UI as the Default":

> Starting today, **Base UI is the default component library in shadcn/ui**. […] **Radix is not being
> deprecated.** […] every update and new component will ship for both libraries.

Its stated rationale: *"Base UI is stable. It's at 1.6.0 with 6M+ weekly downloads… Projects created
on shadcn/create now pick Base UI over Radix 2 to 1."* `4.18.0` (2026-08-13) is a later, unrelated
registry-resolution release. Confirmed in the shipped 4.18.0 binary
(`https://cdn.jsdelivr.net/npm/shadcn@4.18.0/dist/index.js`), whose non-interactive default is
`base: "base"`, and by live docs routing — `https://ui.shadcn.com/docs/components/dialog` `307`-redirects
to `.../docs/components/base/dialog`.

### Correction 2 — there are three bases, not two. React Aria is one of them.

This is the finding that most changes the shape of the decision. The init prompt in the 4.18.0 binary
is literally:

```js
{type:"select", name:"base", message:"Select a component library", choices:[
  {title:"Base UI (Recommended)", value:"base"},
  {title:"React Aria",            value:"aria"},
  {title:"Radix UI",              value:"radix"}]}
```

React Aria landed as a first-class base on **2026-07-17**
([`2026-07-react-aria.mdx`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/changelog/2026-07-react-aria.mdx)):
*"Choose React Aria anywhere you can choose Base UI or Radix, including the CLI, presets, and
shadcn/create."* CLI flag: `-b, --base <base>  the component library to use. (base, radix, aria)`
(https://ui.shadcn.com/docs/cli.md).

**Ark UI is not supported.** `gh api "search/code?q=ark-ui+repo:shadcn-ui/ui"` returns
`total_count: 0`, and there is no `apps/v4/registry/bases/ark` tree alongside the `base`/`radix`/`aria`
ones. Ark is the only candidate here where the shadcn CLI emits nothing.

### What the registry actually emits

The base is **not** a `components.json` field — it is encoded in `style`, as `{base}-{preset}` across
8 presets (`vega, nova, maia, lyra, mira, luma, sera, rhea`), per the live schema at
https://ui.shadcn.com/schema.json. The real registry URL template (hard-coded in the CLI) is
`https://ui.shadcn.com/r/styles/{style}/{name}.json`; the `r/{name}.json` form shown in some docs is
stale and 404s.

Fetched live, the dependency each base resolves to:

| component | `base-vega` | `radix-vega` | `aria-vega` |
|---|---|---|---|
| dialog | `@base-ui/react/dialog` | `radix-ui` | `react-aria-components` |
| select | `@base-ui/react/select` | `radix-ui` | `react-aria-components` |
| popover | `@base-ui/react/popover` | `radix-ui` | `react-aria-components` |
| accordion | `@base-ui/react/accordion` | `radix-ui` | `react-aria-components` |
| tabs | `@base-ui/react/tabs` | `radix-ui` | `react-aria-components` |
| sheet | `@base-ui/react/dialog` | `radix-ui` (Dialog) | `react-aria-components` |
| **drawer** | **`@base-ui/react/drawer`** | **`vaul`** | **`@base-ui/react/drawer`** |

**Read that last row twice.** shadcn's React Aria preset does not have a React Aria drawer — it reaches
across and imports Base UI's. `aria-vega/drawer.json` carries `dependencies: ["@base-ui/react"]`. shadcn
itself treats Base UI's Drawer as the reference bottom sheet for React, and it is the only drawer in
the registry that is not `vaul`.

Note also that `Sheet` is Dialog-backed in all three bases — the shadcn "Sheet" is a side panel with no
gesture, distinct from "Drawer".

### The variant system — still `cva` in all three shadcn bases

This is unchanged by the Base UI switch and confirms what #42 already decided. From
`https://ui.shadcn.com/r/styles/base-vega/button.json`:

```tsx
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/registry/base-vega/lib/utils"

const buttonVariants = cva("group/button inline-flex shrink-0 …", {
  variants: { variant: {…}, size: {…} },
  defaultVariants: { variant: "default", size: "default" },
})
```

and `utils.json` is the familiar `cn` = `twMerge(clsx(inputs))`, with `dependencies: ["clsx",
"tailwind-merge"]`. So **the `cva` → `tailwind-variants` normalisation #42 mandated is required on every
component generated from `ui.shadcn.com`, regardless of which base is chosen.**

### …except from Adobe's registry, which already emits `tailwind-variants`

There is a second, independent source of React Aria components, and it is the one exception to the
`cva` rule. **Adobe runs its own live shadcn registry**, documented in a `### shadcn CLI` section on
https://react-aria.adobe.com/getting-started:

```
npx shadcn@latest add @react-aria/tailwind-button
```

Probing it directly: `https://react-aria.adobe.com/registry/tailwind-button.json` → **200**, declaring
`dependencies: ["react", "react-aria-components", "tailwind-variants",
"tailwindcss-react-aria-components", "tw-animate-css"]`. The backing Tailwind starter kit
(https://github.com/adobe/react-spectrum/blob/main/starters/tailwind/package.json) depends on
`tailwind-variants ^0.3.1`, `tailwindcss ^4.0.0` and `tw-animate-css ^1.4.0` — **and no `cva`
anywhere**.

That is an unusually exact match to this repo's fixed architecture: Tailwind 4, `tailwind-variants`,
`tw-animate-css` — all three already dependencies here. Of the four candidates, React Aria is the only
one with a first-party, copy-the-source distribution that needs **no** variant-system normalisation at
all.

(Note `https://react-aria.adobe.com/registry/tailwind-sheet.json` → **404**; a `css-sheet` entry exists
in the vanilla-CSS flavour only. The sheet is the gap — see §4.)

One pleasant detail for the Base UI base specifically: the generated components do **not** import React
and use no `forwardRef` — they type props as `ButtonPrimitive.Props`. The Radix output is more verbose.

**Tailwind 4 is the only target.** The style index emits `@import "shadcn/tailwind.css"` and
`@import "tw-animate-css"` with no `tailwind.config`; `components-json.md` says of `tailwind.config`:
*"For Tailwind CSS v4, leave this blank."* Tailwind 3 is split to a separate site (v3.shadcn.com). This
matches the repo, which is already on `tailwindcss ^4.3.1` and already has `tw-animate-css ^1.4.0`.

### Fit with shadcn-style ownership, per candidate

To restate the point from §0: **none of the four lets you own the behaviour engine.** All are consumed
as versioned npm dependencies; what you copy and edit is the styled wrapper. Base UI is explicit that
this is the model — it ships build output only (`./dialog/index.mjs` plus `.d.ts`, no source), has no
CLI or registry of its own, and v1.7.0 even shipped *"Strip implementation-only types from published
`.d.ts` files (#5165)"*, actively narrowing what consumers can reach into. It is MIT, so lifting source
is legally fine, but each component leans on a shared private `internals/` graph, so it is not
practical.

Where they genuinely differ is whether a generator emits owned source for them at all:

| | copy-the-source path | variant system emitted | normalisation needed |
|---|---|---|---|
| **Base UI** | shadcn CLI, default base | `cva` | yes → `tailwind-variants` |
| **Radix** | shadcn CLI, `--base radix` | `cva` | yes |
| **React Aria** | shadcn CLI `--base aria` **and** Adobe's own registry + 3 starter kits | `cva` (shadcn) / **`tailwind-variants`** (Adobe) | none, via Adobe |
| **Ark UI** | **none that fits** | — | — |

**Ark is the outlier and it is worth being blunt about it.** The shadcn CLI cannot target it. Its own
guidance for a Tailwind project is to write classes against `data-scope` / `data-part` attributes — the
very attributes v6 renames (§5). The one shadcn-style CLI that does copy Ark source is **Park UI**
(`npx @park-ui/cli add button`), but Park UI is built on **Panda CSS**, so adopting it means running a
second styling engine alongside Tailwind 4 and abandoning `tailwind-variants`. Neither is compatible
with what #42 fixed. In place of a registry Ark ships an MCP server (`@ark-ui/mcp`) for docs lookup,
which is useful but is not component ownership. INFERENCE: choosing Ark means hand-writing every
wrapper from its docs — real work that the other three partly automate.

### Migrating between bases

shadcn ships a **skill, not a codemod**: `npx skills add shadcn/ui`, then `migrate accordion to
base-ui`. INFERENCE: an LLM-driven rewrite with no mechanical guarantee — treat a later base change as
manual work of roughly the same size as writing the components once.

---

## 4. Touch and overlay behaviour — the deciding axis

### 4.1 Does a drawer/sheet exist at all?

| | ships a drawer? | gesture model |
|---|---|---|
| **Base UI** | **Yes — `@base-ui/react/drawer`**, first-party | swipe + snap points + velocity |
| **Ark UI** | **Yes — `@zag-js/drawer`**, first-party | swipe + snap points + velocity |
| **Radix** | **No.** Confirmed against the package directory (55 entries, no `drawer`, no `sheet`) | — (via `vaul`) |
| **React Aria** | **No.** Modal/ModalOverlay only | — |

Radix and React Aria both require a third-party drawer. For Radix that is **`vaul`**, and see §5 for
why that is the single largest risk in this whole document. For React Aria, shadcn's own answer is to
import Base UI's drawer (§3).

React Aria's position deserves precision, because "no drawer" understates what it does give you. A
Sheet is documented as a **recipe, not a component** — the Modal page carries an explicit `## Sheet`
section: *"Overlays such as trays, drawers, and sheets can be built using a `Modal` with custom entry
and exit animations"* (https://react-aria.adobe.com/Modal). The vanilla starter kit ships a concrete
`Sheet.tsx` that is about 15 lines — `ModalOverlay` + `Modal` + `Dialog`, two CSS classes, **no gesture
code**. The Tailwind starter has no Sheet at all, and `registry/tailwind-sheet.json` 404s. So RAC gives
you a correct, accessible, keyboard-aware modal container and leaves 100% of the gesture to you.

Two naming notes for RAC: its accordion is **`Disclosure` / `DisclosureGroup`** (*"a `DisclosureGroup`
is a grouping of related disclosures, sometimes called an accordion"*), which uses
`hidden="until-found"` so collapsed content stays find-in-page searchable — a genuinely nice touch for
the `log` screen's collapsed sessions. And `Dialog` has no standalone docs page; it is documented on
the Modal page. Also note Adobe's docs moved: `react-spectrum.adobe.com/react-aria/*` now 301s to
**`react-aria.adobe.com`**.

### 4.2 The gesture implementations, read from shipped source

I inspected the published bundles directly rather than relying on doc prose.

**Base UI** — `@base-ui/react/drawer` decomposes into `Drawer.Provider / Root / Trigger / SwipeArea /
VirtualKeyboardProvider / Portal / Backdrop / Viewport / Popup / Content / Title / Description / Close`,
plus `Indent` / `IndentBackground` for the iOS-style stacked-card effect. The gesture lives in a shared
`utils/useSwipeDismiss.mjs`, whose constants are:

```
DEFAULT_SWIPE_THRESHOLD          = 40
REVERSE_CANCEL_THRESHOLD         = 10
MIN_DRAG_THRESHOLD               = 1
MIN_VELOCITY_DURATION_MS         = 50
MIN_RELEASE_VELOCITY_DURATION_MS = 16
MAX_RELEASE_VELOCITY_AGE_MS      = 80
DEFAULT_IGNORE_SELECTOR = 'button,a,input,select,textarea,label,[role="button"]'
```

That last line is the detail that matters for this app: dragging that starts on a button or a
number input does **not** hijack into a sheet dismissal. On the `train` screen — set rows the athlete
types weight/reps/RPE into, inside a sheet — that is exactly the collision you would otherwise hand-fix.
The same utility backs `Toast`, so swipe-to-dismiss on toasts is free.

Documented API: `swipeDirection` (`'up'|'down'|'left'|'right'`, default `'down'`), `snapPoints`
(fractions 0–1, pixels, or `px`/`rem` strings), `snapToSequentialPoints` to **disable** velocity-based
snap skipping (i.e. velocity skipping is the default), `modal: boolean | 'trap-focus'`,
`disablePointerDismissal`. It exposes `--drawer-swipe-movement-x/y`, `--drawer-swipe-progress`,
`--drawer-swipe-strength` (a velocity scalar for transition timing), `--drawer-snap-point-offset`,
`--nested-drawers`, and `[data-swiping]` / `[data-swipe-direction]` attributes
(https://base-ui.com/react/components/drawer).

**Ark UI / Zag** — `@zag-js/drawer` has the more elaborate velocity model of the two. Constants in the
shipped bundle include `MAX_VELOCITY = 4e3`, `VELOCITY_WINDOW_MS = 100`, `VELOCITY_SAMPLES = 2`,
`VELOCITY_AGE_MS = 80`, and methods `getReleaseVelocity()`,
`adjustReleaseVelocityAgainstDisplacement()`, `adjustReleaseVelocityForOpenSwipe()`. The source
comments in `packages/machines/drawer/src/utils/session.ts` explain the intent: average the last 100 ms
of movement, *"ignore stale samples so release velocity reflects the final part of the gesture"*, and
require ≥2 samples before trusting a value.

Its public props are the most explicitly tuned of any candidate
(https://ark-ui.com/react/docs/components/drawer):

| prop | default | meaning |
|---|---|---|
| `swipeVelocityThreshold` | `700` | px/s above which the drawer closes |
| `closeThreshold` | `0.25` | fraction dragged past which it closes |
| `preventDragOnScroll` | `true` | don't start a drag when the touch begins on a scrollable element |
| `snapPoints` / `snapPoint` / `onSnapPointChange` | `[1]` | controlled or uncontrolled snap state |
| `snapToSequentialPoints` | `false` | disable velocity-based snap skipping |
| `swipeDirection` | `"down"` | logical: `up \| down \| start \| end` (RTL-aware) |

Parts include a `Grabber`/`GrabberIndicator` and a `SwipeArea`; machine states are
`open | closed | closing | swipe-area-dragging | swiping-open`, so **edge-swipe-to-open** is supported
as well as swipe-to-dismiss. `data-no-drag` on any descendant excludes it from drag initiation — Ark's
equivalent of Base UI's ignore-selector, but opt-in per element rather than defaulted to form controls.

Two caveats. The Drawer's docs frontmatter is **`status: Preview`** — one of only three components so
flagged. And it is ~6 months old: `@zag-js/drawer` first published 2026-02-19, and Ark 5.32.0
(2026-02-21) *"Replaced `BottomSheet` with new `Drawer` component"* — a whole component renamed and
re-anatomised inside a **minor** release.

**Vaul**, for contrast, has a single `VELOCITY_THRESHOLD = 0.4`.

### 4.3 The mobile virtual keyboard over an open overlay

This is where the candidates separate most sharply, and it is directly load-bearing for `train` —
a sheet containing numeric inputs the athlete taps mid-set.

I grepped every candidate's shipped bundle for `visualViewport`, the only browser API that reports the
keyboard-occluded viewport:

| library | `visualViewport` used in… |
|---|---|
| **Base UI** | `drawer/virtual-keyboard-provider/`, `select/popup/`, `number-field/`, `utils/adaptiveOriginMiddleware` |
| **React Aria** | `overlays/usePreventScroll`, `overlays/calculatePosition`, `overlays/useOverlayPosition`, `utils/useViewportSize` |
| **Ark UI / Zag** | `dom-query`, `rect-utils`, `remove-scroll`, `tour` — **not in `@zag-js/drawer`** |
| **Radix** | **no hits anywhere** |

**Base UI** ships the only first-class API for it: `<Drawer.VirtualKeyboardProvider>`, added in v1.6.0
(2026-06-18), which "scrolls the body to keep the focused field visible" when the software keyboard
opens and exposes `--drawer-keyboard-inset` so content can be offset above the keyboard. It is
**Drawer-only** — Dialog, Popover and Select get no equivalent. Their sole keyboard accommodation is a
heuristic on `Dialog.Popup`'s `initialFocus`, documented verbatim as: focus moves to the first tabbable
element *"except when the dialog is opened by touch — then the popup itself is focused to avoid opening
the virtual keyboard."*

**React Aria** has the most explicit engineering model of mobile Safari of any candidate, though it is
aimed at scroll-locking rather than at sheets. The comments in
`react-aria/dist/private/overlays/usePreventScroll.mjs` enumerate the failure modes and the fix for
each, verbatim:

> Mobile Safari is a whole different beast. Even with `overflow: hidden`, it still scrolls the page in
> many situations:
> 1. When the bottom toolbar and address bar are collapsed, page scrolling is always allowed.
> 2. When the keyboard is visible, the viewport does not resize. Instead, the keyboard covers part of
>    it, so it becomes scrollable.
> 3. When tapping on an input, the page always scrolls so that the input is centered in the visual
>    viewport. This may cause even fixed position elements to scroll off the screen.
> 4. When using the next/previous buttons in the keyboard to navigate between inputs, the whole page
>    always scrolls, even if the input is inside a nested scrollable element that could be scrolled
>    instead.

The hook branches explicitly — `if (isIOS() && isWebKit()) restore = preventScrollMobileWebKit(); else
restore = preventScrollStandard();` — and refcounts so nested overlays do not fight. The iOS branch is
roughly 150 bespoke lines that:

- intercept `touchstart` (capturing, **non-passive**) to record the nearest scrollable ancestor, with
  four documented exceptions: pinch-zoom, active text selection, `<input type="range">` sliders, and
  dragging text-selection handles;
- inject a `<style>` element containing `@layer { * { overscroll-behavior: contain; } }`, with the
  comment *"This must be applied before the touchstart event as of iOS 26, so inject it as a `<style>`
  element"*;
- `preventDefault()` on `touchmove` when the scroll target is the document, and also when the
  scrollable element does not actually overflow — working around a **named WebKit bug**,
  https://bugs.webkit.org/show_bug.cgi?id=243452;
- **monkey-patch `HTMLElement.prototype.focus`** via `Reflect.defineProperty` for the duration of the
  lock, forcing `preventScroll: true` and doing its own centring scroll, restored on cleanup.

For the keyboard specifically it handles the case twice over. In JS, an `onBlur` capture handler calls
`willOpenKeyboard(relatedTarget)`; if the next focus target will summon the keyboard it focuses with
`preventScroll: true` and then calls `scrollIntoViewWhenReady`, which waits on
`visualViewport.addEventListener('resize', …, {once: true})` *"so we can measure the correct
position"*. It even works around the keyboard's **Done** button (focus goes to `<body>`, FocusScope
restores it, so no blur fires next time — they move focus to the nearest `[tabindex]` ancestor instead).
And in CSS, `ModalOverlay` publishes `--visual-viewport-height`, documented as *"the height of the
Visual Viewport, i.e. **space above the software keyboard**"*, plus `--visual-viewport-width`,
`--page-height` and `--page-width`
([Modal.tsx](https://github.com/adobe/react-spectrum/blob/main/packages/react-aria-components/src/Modal.tsx)).

It is candid about the residual limits — *"This is best effort: we can't prevent default when pinch
zooming or when an element contains text selection."* **This is the most thorough iOS scroll-lock and
keyboard implementation of the four, by a clear margin**, and the only one that names specific WebKit
bugs and iOS versions in its source.

Source: [`packages/react-aria/src/overlays/usePreventScroll.ts`](https://github.com/adobe/react-spectrum/blob/main/packages/react-aria/src/overlays/usePreventScroll.ts).
(The `@react-aria/overlays` package is now a re-export shim; the real file moved into the `react-aria`
monopackage in v1.17.0.)

**Radix** has none of this. Its scroll lock is not even its own code: `@radix-ui/react-dialog@1.1.23`
delegates to `react-remove-scroll ^2.7.2` and `aria-hidden ^1.2.4`. INFERENCE: iOS scroll-lock defects
in Radix are therefore often not Radix's to fix, which is consistent with how long the relevant issues
have stayed open (below).

**Ark/Zag** splits the difference, and its scroll lock is better than the table alone suggests.
`@zag-js/remove-scroll` is a single file that handles iOS explicitly
(https://github.com/chakra-ui/zag/blob/main/packages/utilities/remove-scroll/src/index.ts):

```js
// Only iOS doesn't respect `overflow: hidden` on document.body
const setBodyStyleIOS = () => {
  const { scrollX, scrollY, visualViewport } = win
  const offsetLeft = visualViewport?.offsetLeft ?? 0   // iOS 12 does not support `visualViewport`.
  const offsetTop  = visualViewport?.offsetTop  ?? 0
  const styles = { position: "fixed", overflow: "hidden",
    top: `${-(scrollY - Math.floor(offsetTop))}px`, left: `${-(scrollX - Math.floor(offsetLeft))}px`, right: "0" }
  …restore scroll position on release
}
```

That is the canonical `position: fixed` + negative-offset rubber-band fix, **with `visualViewport`
offset compensation so it survives the keyboard being up**, plus scroll-position restore, ref-counting
per document via a `WeakMap` (so nested dialogs and StrictMode remounts each release their own claim),
`scrollbar-gutter: stable` awareness, and correct scroll-container detection for app-shell layouts where
`body` is permanently hidden — which is exactly this app's shape.

What Ark lacks is the **drawer-level** keyboard story: `@zag-js/drawer` itself never reads
`visualViewport`, so there is no `--drawer-keyboard-inset` equivalent and no "scroll the focused field
above the keyboard" behaviour. Ark locks the page correctly; Base UI additionally re-lays-out the sheet
around the keyboard.

### 4.4 Scroll locking, and the iOS rubber-band

**Base UI's behaviour on touch is deliberately partial, and this is documented, not a bug.** From
`packages/react/src/select/root/SelectRoot.tsx` (the same wording appears on Popover):

> On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup
> spans nearly the full viewport width, matching native iOS behavior.

There is **no `preventScroll` prop** anywhere in Base UI to override this. `modal` takes
`true | false | 'trap-focus'`, where `'trap-focus'` traps focus but leaves page scroll unlocked. Select
additionally disables its `alignItemWithTrigger` positioning mode when the popup was opened by touch.
Base UI has shipped real iOS work recently — v1.4.0 "Lock scroll of full-width anchored `modal` popups
with touch input (#3100)", "[combobox] Fix iOS viewport settling (#4351)", "[drawer] Fix touch scroll in
portaled popups (#4382)". The rubber-band specifically is not mentioned in its docs.

**Radix's open issue list is the clearest evidence against it on this axis.** All verified open on
2026-08-16:

| # | state | opened | title |
|---|---|---|---|
| [#3078](https://github.com/radix-ui/primitives/issues/3078) | **open** | 2022-06-19 | `[Dialog]` height "jumps" at bottom on scroll when Safari address bar animates on iPhone X+/iOS 15+ — *open ~4 years, untouched for 2* |
| [#1159](https://github.com/radix-ui/primitives/issues/1159) | **open** | 2022-02-15 | `[Dialog][Popover]` scrolling issue when Popover inside Dialog — **61 comments**, the most-discussed scroll bug in the repo |
| [#2634](https://github.com/radix-ui/primitives/issues/2634) | **open** | 2024-01-06 | `[Select]` closes when the on-screen keyboard is shown — *unlabelled, 2.5 years* |
| [#1343](https://github.com/radix-ui/primitives/issues/1343) | **open** | 2022-04-26 | `[Select]` instantly closes after opening with touch-based screen readers — reproduces **on radix-ui.com's own docs** |
| [#3752](https://github.com/radix-ui/primitives/issues/3752) | **open** | 2025-11-14 | scroll lock prevents swipe-back navigation — zero maintainer response |
| [#2868](https://github.com/radix-ui/primitives/issues/2868) | **open** | 2024-04-26 | Popover content moves on scroll under iOS Safari |
| [#3124](https://github.com/radix-ui/primitives/issues/3124) | **open** | 2024-09-18 | `[DropdownMenu]` WCAG 2.2 SC 2.5.2 violation — opens on `onPointerDown` |
| [#2580](https://github.com/radix-ui/primitives/issues/2580) | **open** | 2023-12-10 | `[DropdownMenu]` trigger doesn't open on iOS |

There is genuine good news in the unreleased `radix-ui@1.7.0-rc`: changeset `huge-foxes-serve` fixes
*"nested, portalled layers being unusable inside a modal layer […] the modal layer's trapped
`FocusScope` reclaimed focus, and its `RemoveScroll` only allowed scrolling within the modal content"* —
i.e. the #1159 class of bug. But it is an RC, and the shipped `1.6.7` does not have it.

**Base UI's open issues on this axis are fewer and much younger** (312 open issues total; only 3 carry
the `mobile` label):

| # | state | opened | title |
|---|---|---|---|
| [#5471](https://github.com/mui/base-ui/issues/5471) | **open** | 2026-08-12 | `[drawer]` with `snapPoints`, a swipe can dismiss the popup visually while `onOpenChange` never fires |
| [#4645](https://github.com/mui/base-ui/issues/4645) | **open** | 2026-04-17 | `[drawer]` scroll lock applies html `scrollbar-gutter: stable` |
| [#3227](https://github.com/mui/base-ui/issues/3227) | **open** | 2025-11-14 | `--available-height` changes when the keyboard opens on iOS (combobox) |
| [#3104](https://github.com/mui/base-ui/issues/3104) | **open** | 2025-10-30 | `[popover]` `onOpenChange` doesn't stop touch-event propagation |
| [#3185](https://github.com/mui/base-ui/issues/3185) | **open** | 2025-11-11 | `[scroll area]` prop to disable custom scrollbars on mobile |

#5471 is worth flagging: it was **four days old** when this was written, it is Drawer-specific, and
"swipe dismissed it visually but the controlled state never changed" is precisely the class of bug that
bites a controlled bottom sheet in an offline-first app that persists UI state.

The honest comparison is not "Base UI has fewer bugs" — it is that Base UI's mobile bugs are weeks to
months old and being worked, while Radix's are two to four years old and unassigned.


---

## 5. Maturity, maintenance, and what exact-pinning costs

ADR 0005 accepts pre-1.0 dependencies *"conditionally — versions are pinned exactly and upgrades are
deliberate work, never routine"*, and records that *"the rebuild pins Node 22 and exact framework
versions. Upgrades are scheduled work with a changeset read, not a routine bump."* The question for
each candidate is therefore not "is it stable" but **"how often will a scheduled upgrade be forced, and
how big is it when it comes."**

### Snapshot, 2026-08-16

| | version | 1.0? | licence | cadence | next forced break |
|---|---|---|---|---|---|
| **Base UI** `@base-ui/react` | **1.7.0** (2026-08-04) | yes, since 2025-12-11 | MIT | minor every 4–6 wks | none announced |
| **Radix** `radix-ui` | **1.6.7** (2026-07-24) | yes | MIT | bursty; see below | none announced (`1.7.0-rc` is a minor) |
| **Ark UI** `@ark-ui/react` | **5.38.1** (2026-08-07) | yes, since 2023-11-09 | MIT | minor ~monthly | **v6, open and overdue** |
| **React Aria** `react-aria-components` | **1.20.0** (2026-08-14) | yes | Apache-2.0 | frequent minors | none announced |

### Base UI — post-1.0, but semver is looser than the number implies

The ticket's premise that Base UI is pre-1.0 is **out of date**: 1.0.0 shipped 2025-12-11, and eight
minors plus exactly one patch have landed since. Pinning exactly is easy and the version number is
meaningful.

The caveat is that **three breaking changes have shipped inside minors** since 1.0.0, per the
changelog:

- **v1.3.0** — *"**Breaking change:** `Drawer` is no longer marked as preview"*, renaming the
  `DrawerPreview` namespace to `Drawer` (#4293).
- **v1.5.0** — *"**Breaking change:** Rename `sanitizeValue()` to `normalizeValue()`"* (OTP Field only).
- **v1.6.0** — *"🚨 **Breaking change:** Unmark preview — `OTPFieldPreview` → `OTPField`"* (#5029).

No codemods and no deprecation windows accompany any of them. INFERENCE: the operating convention
appears to be "stable components are stable; `*Preview` namespaces are exempt from semver" — that is a
reading of the pattern, not a stated policy, and no versioning-policy document exists on the site. The
practical consequence for exact-pinning is mild: a minor bump requires reading the changelog, but the
breaks so far have been one-line renames confined to preview surfaces.

**Relevant to the drawer specifically: it only left preview in v1.3.0 (2026-03-12), five months ago,**
and still takes bug fixes every release. It is the newest large surface in the library.

Governance: MUI-owned (`mui/base-ui`, MIT, "Copyright (c) 2019 Material-UI SAS"), staffed by MUI
engineers plus **Colm Tuite and Jenna Smith (Radix UI)** and **@atomiks (Floating UI)** — self-described
as *"From the creators of Radix, Material UI, and Floating UI"* (https://base-ui.com/react/overview/about).
INFERENCE: @atomiks authors the substantial majority of the overlay, positioning and touch work in every
1.x release, which is a quality signal and a bus-factor concentration at the same time.

### Radix — alive again, but the drawer story is the problem

The "Radix is abandoned" framing needs correcting. The repo is **not archived**, is described as
*"Maintained by @workos"* with a `Copyright © 2022-present WorkOS` licence line, and 2026 has seen
**217 commits** and nine `radix-ui` releases in seven weeks (1.5.0 on 2026-06-06 through 1.6.7 on
2026-07-24) after a ~10-month publish gap following 1.4.3 (2025-08-13). 194 open issues, 139 open PRs.
There are **no GitHub Releases** at all (`releases` returns an empty array); the changelog lives at
https://www.radix-ui.com/primitives/docs/overview/releases. There is no pinned issue and no public
statement of maintenance status or roadmap — INFERENCE: WorkOS stewardship explains the 2026 burst, but
I found no announcement confirming the funding model.

Exact-pinning Radix is easy and the unreleased `1.7.0-rc` is all minors and patches — no major pending.

**The problem is not Radix, it is `vaul`.** Radix ships no drawer, so a Radix stack takes its bottom
sheet from `vaul` — which shadcn still pins at exactly `1.1.2`. Verified first-hand today, the entire
`vaul` README is now this and nothing else:

> **Note**
> This repo is unmaintained. I might come back to it at some point, but not in the near future. This
> was and always will be a hobby project and I simply don't have the time or will to work on it right
> now.

(https://github.com/emilkowalski/vaul/blob/main/README.md, committed 2025-10-03.) Supporting facts:

- **Last npm publish: 1.1.2 on 2024-12-14** — 20 months ago. Confirmed via `npm view vaul time.modified`.
- Two code fixes are merged but **never published**; users are pointing `package.json` at git SHAs.
  [#624](https://github.com/emilkowalski/vaul/issues/624) (open) asks for a release or an npm
  collaborator — no maintainer reply.
- [#630](https://github.com/emilkowalski/vaul/issues/630) "Vaul's future" (open) is the succession
  thread; the maintainer's single comment was 2025-12-23 and no handover has been announced since.
- [#653](https://github.com/emilkowalski/vaul/issues/653) (open, **2026-08-14**, two days before this
  was written) reports a hard crash in the *current published build* — `Drawer.Overlay` calls
  `useCallback` after an `if (!modal) return null` early return, so toggling `modal` on a mounted
  overlay throws "Rendered fewer hooks than expected". There is no maintainer to fix it.
- 132 open issues, 26 open PRs.
- It hard-depends on `@radix-ui/react-dialog` as a regular `dependencies` entry, so it cannot be
  combined with Base UI without shipping two focus traps and two scroll locks.

For an exact-pinning repo this is the sharpest form of the risk: pinning `vaul@1.1.2` is not "deliberate
upgrades are rare", it is "there will never be an upgrade".

### Ark UI — the reputation is stale, but a breaking major is in flight

The "frequent majors" reputation is a **2023–2025 artifact**. Majors landed every 82–162 days from
1.0.0 (2023-11-09) through 5.0.0 (2025-03-06) — and then **v5 has held for ~528 days**, with minors
roughly monthly.

**But Ark v6 is open, breaking, and already overdue.**
[Issue #3616 "Ark v6"](https://github.com/chakra-ui/ark/issues/3616) (open, labelled `rfc`) states
*"Status: In Progress / Target Release: Q2 2026"* — a target now passed. The tracking PR
[#3920](https://github.com/chakra-ui/ark/pull/3920) (open, not draft) touches **413 files**. Announced
breaking changes:

1. **`asChild` → `render`** — *"The biggest change in v6 is how you compose custom elements."* Touches
   every composed element.
2. **Data attributes change shape**: `data-scope="popover" data-part="trigger"` →
   `data-popover-trigger="…"`. **This breaks every CSS selector written against Ark's parts** — and
   since Ark's own guidance for a Tailwind project is to style via `data-scope`/`data-part`, that is
   the whole stylesheet.
3. **Anatomy imports move** to `@ark-ui/[framework]/anatomy`.

`@zag-js/*` also has a `next` dist-tag at `2.0.0-next.1` (2026-08-01), so the engine underneath is
majoring too. INFERENCE: adopting Ark today means adopting v5 roughly 6–12 months before a v6 whose
migration rewrites both the JSX composition and the styling selectors. That is precisely the
"scheduled, non-optional, large" upgrade ADR 0005 is trying to avoid — and it is the only such upgrade
visible among the four candidates.

Ark's issue trackers are otherwise remarkably clean: **3 open issues** on `chakra-ui/zag`
(#3224, #3207, #3203 — hover card, stacked-dialog animation, backdrop click-through) and **1** on
`chakra-ui/ark` (#3616, the v6 RFC). No open iOS, body-scroll, or keyboard issues in either.

### React Aria — independent per-package versioning, no pending break

`react-aria-components` is at **1.20.0** while `react-aria` is at `3.51.0` and `react-stately` at
`3.49.0`; Adobe versions every package in the monorepo independently, so the numbers are not comparable
across packages and a single "React Aria version" does not exist. For exact-pinning this is the most
awkward of the four in mechanics — you pin a set of packages that move together but are numbered
separately — though in practice `react-aria-components` pins its transitive `react-aria`/`react-stately`
to exact versions itself (`"react-aria": "3.51.0"`, `"react-stately": "3.49.0"` are exact, not ranged,
in its `dependencies`), which makes the lockfile deterministic. It is Apache-2.0, the only
non-MIT candidate — worth noting only because it differs, not because it constrains this use.

### The pinning summary

| | pinning painful? | why |
|---|---|---|
| **Base UI** | no | post-1.0, one package, monthly minors, breaks confined to preview namespaces |
| **React Aria** | mildly | many separately-versioned packages, but exact transitive pins |
| **Radix** | no for Radix, **yes for `vaul`** | pinning an unmaintained package with a known open crash |
| **Ark UI** | **yes** | a 413-file breaking major is open and overdue; Zag 2.0 behind it |

---

## 6. Accessibility

All four claim ARIA conformance. They differ in **what they claim** and, more usefully, **how they
test** — which is the falsifiable part.

### The claims, verbatim

- **React Aria** — *"Components implement semantics and keyboard behavior according to the W3C ARIA
  Authoring Practices Guide"*; *"All components are extensively tested using many popular screen
  readers and devices"*; *"All behaviors work without a keyboard, ensuring **touch screen reader users**
  have full access."* (https://react-aria.adobe.com/, https://react-aria.adobe.com/quality)
- **Base UI** — *"Base UI components adhere to the WAI-ARIA Authoring Practices to provide basic
  keyboard accessibility out of the box"*; *"tested on a broad spectrum of browsers, devices,
  platforms, screen readers, and environments."* (https://base-ui.com/react/overview/accessibility).
  Note "basic keyboard accessibility"; no VPAT or audit report is linked.
- **Radix** — *"Components adhere to the WAI-ARIA design patterns **where possible**."*
  (https://www.radix-ui.com/primitives/docs/overview/introduction). The hedge is theirs.
- **Ark / Zag** — *"Zag is built with accessibility in mind. We handle many details related to keyboard
  interactions, focus management, aria roles and attributes."*
  (https://zagjs.com/overview/introduction). No explicit APG-conformance claim on either intro page.

### The testing stories, which are more informative than the claims

**React Aria publishes a named screen-reader matrix** — VoiceOver on macOS in Safari *and* Chrome, JAWS
in Firefox and Chrome, NVDA in Firefox and Chrome, **VoiceOver on iOS**, and **TalkBack on Android in
Chrome** (https://react-aria.adobe.com/quality). It is the only candidate naming mobile screen readers
explicitly. It also publishes a
[known-accessibility-false-positives wiki](https://github.com/adobe/react-spectrum/wiki/Known-accessibility-false-positives)
rather than claiming a clean automated run — an honesty marker, since axe-style tools catch a minority
of WCAG issues. Its drag-and-drop has a full non-pointer parallel path, including *"touch screen reader
users can also drag by double tapping to activate drag and drop mode, swiping between drop targets, and
double tapping again to drop"* (https://react-aria.adobe.com/dnd).

**Ark/Zag has the best automated story.** Playwright e2e suites per component run against **five
frameworks** (react, vue, solid, svelte, preact), with `@axe-core/playwright@4.13.0` wired into a shared
`checkAccessibility()` helper. The drawer alone has three e2e files including real pointer-drag tests
(`"should close when dragged down past swipeVelocityThreshold"`). Sources:
https://github.com/chakra-ui/zag/blob/main/e2e/drawer.e2e.ts,
https://github.com/chakra-ui/zag/blob/main/package.json. This is above average for OSS, but it is
automated axe checking, not manual audit, and there is no published conformance statement.

**Base UI** publishes no test matrix; the evidence is the changelog, which does carry real screen-reader
fixes (e.g. "[combobox/autocomplete] Fix popup closing on iOS VoiceOver (#3859)").

**Radix has the weakest evidence, and it is documented in its own tracker.**
[#2317](https://github.com/radix-ui/primitives/issues/2317) — *"Accessibility audit on Radix UI and Next
Steps"*, **open since 2023-08-01** — records that Publicis Sapient's Accessibility Center of Excellence
tested Radix with VoiceOver/Safari on macOS **and iOS**, NVDA/Firefox and TalkBack/Chrome, and found
**35 accessibility issues**. They asked before filing 35 tickets; three years later there is no
resolution. That single artifact is the strongest counterweight to the "Radix is the accessible one"
reputation.

### Where focus management is known to be weak on touch — the specific answer the ticket asks for

| library | known touch focus weaknesses |
|---|---|
| **Radix** | [#1343](https://github.com/radix-ui/primitives/issues/1343) Select instantly closes with **touch-based screen readers**, reproducing on Radix's own docs, open since 2022. [#2634](https://github.com/radix-ui/primitives/issues/2634) Select closes when the on-screen keyboard appears. [#3124](https://github.com/radix-ui/primitives/issues/3124) DropdownMenu opens on `onPointerDown`, a **WCAG 2.2 SC 2.5.2 violation**. [#3811](https://github.com/radix-ui/primitives/issues/3811) Safari focus escapes a Dialog with `modal={false}`. [#2850](https://github.com/radix-ui/primitives/issues/2850) Slider broken with Android TalkBack. All open. |
| **Base UI** | [#5237](https://github.com/mui/base-ui/issues/5237) focus-guard sentinels expose as nameless buttons in WebKit (axe `button-name` violation), open, labelled *"expected behavior"*. [#3104](https://github.com/mui/base-ui/issues/3104) Popover `onOpenChange` doesn't stop touch-event propagation. Its touch-specific *mitigation* is the `initialFocus` heuristic — focus the popup rather than the first field when opened by touch, to avoid summoning the keyboard. |
| **Ark UI** | No open iOS/scroll/keyboard/focus issues in either tracker. Recently **closed**: [#3099](https://github.com/chakra-ui/zag/issues/3099) Select not announcing selected value under Safari VoiceOver; [#3239](https://github.com/chakra-ui/zag/issues/3239) clicking a radio item scrolls the page when the group is inside `position: sticky` (hidden input focused without `preventScroll`). |
| **React Aria** | No open bundle-or-focus issue of this class surfaced. Its `usePress` documentation is unusually candid about the residual limits — *"iOS still sometimes fires `onPointerUp` even if your finger isn't over the target, so we need to double check ourselves"*, and on `user-select`: *"The only way to avoid this is to add `user-select: none` to the entire page"*, which React Aria then does automatically on touch start and removes after a delay. |

INFERENCE: on this axis the ordering is fairly clear — React Aria has the deepest touch-a11y
investment and the only named mobile screen-reader matrix; Ark has the cleanest tracker; Base UI is
credible but less evidenced; Radix carries the most, and the oldest, unresolved touch-focus defects.
For a single-athlete training app the practical stakes are lower than for a public product, but the
`train` screen is used one-handed with chalky hands, which is closer to the touch-input edge cases
these bugs live in than a desktop app would be.

---

## 7. The migration reality from `bits-ui`

### First, a correction to the framing

The ticket and the map describe today's UI as "`bits-ui` (36 shadcn-svelte primitives)". The 36 is
accurate as a **file** count, but it overstates the behavioural surface by a lot. Counted in the tree
at `src/lib/components/ui/`:

- **36 `.svelte` files**, across **10 component families**: `accordion` (4 files), `badge` (1),
  `button` (1), `card` (7), `input` (1), `popover` (8), `progress` (1), `select` (11), `separator` (1),
  `sonner` (1).
- **21 of the 36 files import `bits-ui`**; the other 15 are markup plus Tailwind classes with no
  behavioural dependency at all.
- The families that actually import `bits-ui` are **accordion, popover, progress, select, separator**.
  `sonner` is `svelte-sonner`, a different library.

So the genuinely headless surface today is **three non-trivial components — accordion, popover,
select** — plus `progress` and `separator`, which are a `role`/`aria-valuenow` and a `<div>`
respectively. `badge`, `button`, `card`, `input` are pure Tailwind and carry no behaviour to port.

There is also **one hand-rolled overlay**, `src/lib/Modal.svelte`, outside the `ui/` tree — the app has
no `bits-ui` Dialog. Grepping the whole `src/` tree for `drawer`, `sheet` or `bottom-sheet` returns
**nothing: the app has never had a drawer or sheet.**

### What this means per candidate

The map's recorded finding that `bits-ui` → Base UI is *"a genuine rewrite with no shortcut"* holds,
and it holds equally for all four candidates — but the rewrite is smaller than "36 primitives" implies.

**Nothing transfers mechanically to any candidate.** `bits-ui` is Svelte 5; every candidate here is
React. There is no shared runtime, no shared prop convention, and no codemod between them. What
transfers in every case is identical and is not library-specific:

- The **Tailwind class strings** on each part, which are the actual visual work — though #42 has
  reopened the palette, so even these are prior art rather than a floor.
- The **anatomy** — that a Select has a trigger, a portal, a content, an item, a group heading, a
  separator and two scroll buttons. Every candidate uses the same compound-component decomposition, so
  the shape of the file you write is recognisable in all four.
- The **`tailwind-variants` definitions**, which are framework-agnostic and port verbatim.

One asymmetry worth naming: `bits-ui` is itself modelled closely on Radix's API, so **Radix is the only
candidate where the prop names and part names would look familiar** (`Root`/`Trigger`/`Portal`/
`Content`/`Item`, `onOpenChange`, `asChild`). Base UI is from several of the same authors and is
recognisably descended from it, but has renamed and re-scoped much of it (`render` instead of
`asChild`, `Popup` instead of `Content`). Ark's `useX`/machine idiom and React Aria's render-prop
idiom are both a larger conceptual step. **INFERENCE:** this familiarity is worth little in practice
given three components are in scope, but it does reduce the reading required.

The larger migration fact is the inverse of the framing: the rebuild is not mostly *porting*, it is
mostly *new*. The three-screen prototype brief in #42 (`/` → `train` → `log`) calls for a bottom sheet,
a tabbed or segmented navigation, and swipe-to-tick — **none of which exist in the current app at all.**
The candidate should therefore be judged far more on what it gives you for the components you do not
yet have than on how cleanly it replaces the three you do.

---

## 8. Does any candidate constrain the visual direction?

### The general answer: no, on styling

All four are unstyled and ship no CSS of their own. Base UI states it plainly: *"Base UI components are
unstyled, don't bundle CSS, and are compatible with Tailwind, CSS Modules, CSS-in-JS, or any other
styling solution you prefer. You retain total control of your styling layer."*
(https://base-ui.com/react/handbook/styling). None of the four can make a *look* unbuildable.

Two small idiom notes that affect how the `tailwind-variants` layer is written, not what it can express:

- **Base UI / Radix / Ark** take a plain `className` string, so a `tv()` call drops straight in.
- **React Aria Components** additionally allow `className` (and `style`) to be a **function of render
  state** — `className={({isPressed, isFocusVisible}) => …}`. Far from fighting `tailwind-variants`,
  this composes with it unusually well, because the render-prop object is exactly the shape `tv()`
  wants for `variants` keys. Adobe's own `starters/tailwind/src/Button.tsx` spreads it straight in:

  ```tsx
  let button = tv({ extend: focusRing, base: '…',
    variants: { variant: {…}, isDisabled: { true: '…' }, isPending: { true: '…' } }, … });

  <RACButton {...props}
    className={composeRenderProps(props.className, (className, renderProps) =>
      button({ ...renderProps, variant: props.variant, className }))} />
  ```

  RAC's interaction states become `tv` variants for free — no `data-[hovered]:` selector gymnastics.
  `composeRenderProps` is exported from the library itself, so this is first-class API rather than a
  workaround. INFERENCE: the real friction is elsewhere — any wrapper written as `cn("base", className)`
  breaks when a caller passes a *function*, so every owned component must route through
  `composeRenderProps`. Mechanical, but pervasive, and a convention to set once at the start.

### The specific answer: the gestural direction is where they differ

#42 commits one of the four prototypes to being *"deliberately tactile and gestural — swipe-to-tick,
drag-to-dismiss, a bottom sheet that tracks the finger and settles on velocity."* Taking those three
requirements literally:

| requirement | Base UI | Ark UI | Radix | React Aria |
|---|---|---|---|---|
| bottom sheet tracking the finger, settling on velocity | **built in** | **built in** | via `vaul` | **nothing** |
| drag-to-dismiss | built in (`useSwipeDismiss`, also powers Toast) | built in | via `vaul` | build on `useMove` |
| swipe-to-tick on a list row | build it (Motion) | build it (Motion) | build it (Motion) | build it (Motion) |

**Nothing here makes the gestural direction unbuildable** — swipe-to-tick is a bespoke interaction in
every case, and Motion (`motion`/`framer-motion`, both at **13.1.0**, published 2026-08-10) supplies
`drag`, velocity and spring physics regardless of the base library. #42 already presumes Motion.

What differs is how much of the sheet you write yourself:

- **Base UI and Ark hand you the hard part.** A velocity-settling, snap-pointed, finger-tracking sheet
  is a `<Drawer.Root snapPoints={…} swipeDirection="down">` rather than a week of tuning against iOS.
  Base UI additionally gives you the keyboard-inset handling (§4.3) and the ignore-selector that keeps
  drags starting on an input from becoming dismissals — both of which you would otherwise discover the
  hard way on the `train` screen.
- **React Aria makes it the most work — but Adobe has already written the answer down.** It has no
  drawer and no gesture physics: `useMove`'s event payload is
  `{type, pointerType, deltaX, deltaY, shiftKey, ctrlKey, metaKey, altKey}` with **no velocity field**,
  so a flick has to be differenced against timestamps by hand. Adobe's official response is an example
  called **"Gesture Driven Sheet"** (https://react-aria.adobe.com/examples/sheet) that wraps RAC in
  Motion:

  ```tsx
  drag="y"
  dragConstraints={{ top: 0 }}
  onDragEnd={(e, { offset, velocity }) => {
    if (offset.y > window.innerHeight * 0.75 || velocity.y > 10) setOpen(false);
    else animate(y, 0, { ...inertiaTransition, min: 0, max: 0 });
  }}
  ```

  Two sibling examples exist and are directly on this app's path: **iOS List View** — a GridList with
  Motion swipe gestures, i.e. swipe-to-tick already worked out
  (https://react-aria.adobe.com/examples/ios-list) — and **Swipeable Tabs**, built on CSS scroll-snap
  and scroll-driven animations with no JS gesture library at all
  (https://react-aria.adobe.com/examples/swipeable-tabs). So the gestural direction on RAC is
  "assemble from Adobe's own worked examples plus Motion", not "invent from nothing" — but it is
  meaningfully more code than a `<Drawer.Root>`, and you own the tuning.
- **Radix means adopting `vaul`**, whose position is covered in §5 and is the weakest link in this
  document.

**One flag worth raising for the prototype phase.** Base UI issue
[#5471](https://github.com/mui/base-ui/issues/5471) (open, 2026-08-12) — a snap-pointed drawer can be
swiped away visually without `onOpenChange` firing — sits exactly on the gestural direction's critical
path. It should be reproduced early on a real phone rather than discovered during the prototype
judging, since #42 judges the directions *on a phone, in the athlete's hand*.

### A note on the four directions collectively

#42 requires all four prototypes to be built on the **same** base library, so the base must serve the
gestural direction and the three calmer ones equally. All four candidates serve the calm directions
fine; only the gestural one discriminates. INFERENCE: that makes the gestural prototype the natural
place to spike the base library first, before the other three are started.

---

## 9. Candidates considered and set aside

The ticket invites adding competitors and saying so if one is not worth the ink.

**Headless UI (`@headlessui/react`, 2.2.10)** — Tailwind Labs' own. Set aside on maintenance and scope:
last release **2026-04-07**, last commit 2026-04-13, so **four months quiet**, with 83 open issues. It
ships no drawer, no sheet, and a much smaller component set than any candidate above (no accordion as
such, no select in the Radix sense). INFERENCE: it would leave more to hand-build than Ark while
offering none of Ark's gesture work.

**`@silk-hq/components` (0.10.1)** — a genuinely impressive native-feeling iOS gesture/sheet library,
and the closest thing to "the gestural direction, solved". Set aside on two counts: it is **pre-1.0**
(0.10.1, last publish 2026-02-10), and its licence field is **`SEE LICENSE FILE`** with a commercial
homepage at silkhq.com — i.e. **not open source**, unlike the MIT/Apache-2.0 of every candidate above.
Worth naming only as a possible *supplement* for one screen if the gestural direction wins and the
chosen base's drawer proves insufficient; not viable as the base layer.

**`react-modal-sheet` (5.6.0, MIT)** — a maintained Motion-based bottom sheet, and a credible
replacement for `vaul` specifically if Radix were chosen. It is a single component, not a base library,
so it does not compete for this decision — but it is the obvious answer to "what if we want Radix but
`vaul` is dead".

**`corvu` (0.7.2)** — Solid.js, not React. Not applicable.

**`@radix-ui/themes`** and **Park UI** — both *styled* layers, which #42 rules out by fixing
shadcn-style ownership.

---

## 10. Fit with the client-only TanStack Start shell

ADR 0006 fixes one `ssr: false` seam at the root, with the build emitting a user-independent
`/_shell.html` precached by the service worker. Relevant observations, all first-hand from the
installed packages:

- **`'use client'` directives**: Base UI ships them in 774 files and Ark in 805; Radix and React Aria
  ship none. React Aria instead carries a `client-only` dependency, which throws if imported into a
  React Server Component. **With `ssr: false` none of this matters** — there are no server components
  in this app — so this is a non-differentiator here. INFERENCE: it would matter if the `ssr: false`
  seam were ever narrowed.
- **React 19 peer ranges** are satisfied by all four: Base UI `^17 || ^18 || ^19`, Radix
  `^16.8 || ^17.0 || ^18.0 || ^19.0`, Ark `>=18.0.0`, React Aria `^16.8.0 || … || ^19.0.0-rc.1`.
- **Tree-shaking setup** is correct in all four: `sideEffects: false` (Base UI, Ark, Radix) or
  `["*.css"]` (React Aria), each with per-component subpath exports. Only React Aria's docs actively
  push subpaths as the default (`react-aria-components/Button`), and only React Aria advertises
  *"smaller bundles without relying on tree-shaking"* as the reason. Radix hedges: *"importing from the
  subpath can help some bundlers tree-shake more effectively"*, INFERENCE — its barrel is not perfectly
  shakeable everywhere.

---

## 11. Summary of the trade-offs

No verdict — this is the shape of the choice, not a recommendation.

| | Base UI 1.7.0 | React Aria 1.20.0 | Ark UI 5.38.1 | Radix 1.6.7 + vaul 1.1.2 |
|---|---|---|---|---|
| **six components, gzip** | 80.6 KB | **46.6 KB** | 61.6 KB | **46.2 KB** |
| **first-party drawer** | **yes**, velocity + snap points | no (recipe + Motion) | **yes**, velocity + snap points | no (`vaul`) |
| **drawer keyboard handling** | **`VirtualKeyboardProvider`**, `--drawer-keyboard-inset` | `--visual-viewport-height` on ModalOverlay | none in the drawer machine | none |
| **iOS scroll lock** | partial by design on touch; no override | **deepest implementation of the four** | solid, `visualViewport`-aware | delegated to `react-remove-scroll`; oldest open bugs |
| **shadcn CLI** | **default base** | supported base **+ Adobe's own registry** | **unsupported** | supported base |
| **variant system emitted** | `cva` → normalise | `cva`, or **`tailwind-variants`** from Adobe | n/a | `cva` → normalise |
| **pinning pain** | low | low–moderate (many packages) | **high — v6 open and overdue** | low for Radix, **terminal for `vaul`** |
| **gestural direction** | built in | build on Motion, from Adobe's examples | built in | `vaul`, unmaintained |

The three axes that actually separate them:

1. **Drawer or no drawer.** Base UI and Ark ship a real velocity-settling sheet; React Aria and Radix
   do not. For an app whose gestural direction is a bottom sheet that tracks the finger, this is the
   largest single difference in build cost.
2. **Who owns the iOS problem.** React Aria has written the most thorough answer to mobile Safari and
   the software keyboard, but has no gesture layer. Base UI has the only keyboard-aware *drawer*.
   Radix has neither and its relevant issues are years old.
3. **What breaks next.** Ark has a 413-file breaking major open and overdue; `vaul` will never ship
   again. Base UI and React Aria have nothing comparable pending.

Note the two options that pair well and are not mutually exclusive: shadcn's own `aria` preset already
imports **Base UI's drawer** into a React Aria project, so "React Aria everywhere, Base UI for the
sheet" is a shipped, supported configuration rather than a hack — at the cost of two behaviour
libraries in the bundle.

---

## Method and provenance

- **Versions**: every version in this document was read from the npm registry with `npm view` on
  **2026-08-16**. Where a package's own docs state a different current version, the registry wins.
- **Bundle numbers**: first-party measurement, method in §2. Not a citation — reproduce it rather than
  trust it. The repo's `node_modules` and manifest were not touched; the probe lives in the session
  scratchpad at `scratchpad/bundle/`.
- **Source quotes**: taken from the published packages installed for the bundle probe, or from the
  named file in each project's GitHub repo. Doc quotes are from each library's own site.
- **Issue states**: every GitHub issue cited was checked open/closed on 2026-08-16 and is given with its
  number.
- **Inference**: everything not directly supported by a source is marked INFERENCE inline.

### One deviation from the ticket

The ticket asks for *"a document on a `research/` branch, linked back here."* This document was written
to the session scratchpad instead, because the working tree is shared by three concurrent agents and
this task was constrained to run no state-changing git commands. **It still needs committing to a
`research/` branch and linking on #44** — that is outstanding work, not a decision.

