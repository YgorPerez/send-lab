# What makes an installed PWA feel like an app — and which of it a client-only TanStack Start SPA can reach

Research for [#43](https://github.com/YgorPerez/send-lab/issues/43), part of
[Map: Redesign](https://github.com/YgorPerez/send-lab/issues/42).

**Research run: 2026-08-16.** Every version, status and "as of" below is that date.

**No verdicts.** This establishes what is achievable, on which platform, at what cost. The decision is
someone else's.

## How to read this

Every claim carries a confidence marker:

- **[P] primary** — MDN or MDN browser-compat-data (BCD), WebKit release notes / WebKit Bugzilla,
  Apple developer docs, Chrome developer docs, developer.android.com, a W3C/WHATWG/CSSWG spec, or the
  TanStack Router repository (source, issues, PRs).
- **[B] blog / secondary** — a write-up, a third-party issue tracker, a developer-forum post, a press
  report. Named and dated where possible.
- **[I] inference** — reasoning from [P] facts. Not observed, not documented. Treat as a hypothesis to
  test on a device.

"Installed PWA" throughout means **standalone display mode, launched from the home screen**, which is
the only shape this app ships in on a phone.

## Platform baseline on the day of research

| | Current stable | Notes |
|---|---|---|
| Safari / iOS Safari | **26.6**, released **2026-07-27** [P] ([WebKit](https://webkit.org/blog/18178/webkit-features-for-safari-26-6/)) | Safari 27 is in beta from WWDC26 (2026-06-08) [P] |
| `@tanstack/react-router` | **1.170.29** [P] (npm) | |
| `@tanstack/react-start` | **1.168.46** [P] (npm); latest release tag `release-2026-08-14-2214` [P] | |

**iOS is a single-engine platform tied to the OS version.** There is no "update Safari" separate from
updating iOS, so every iOS floor below is an *OS* floor. [P] The DMA alternative-engine carve-out in
the EU is not relevant to a single-athlete app and is not considered here.

**One iOS 26 change reframes "installed" itself.** WebKit, Safari 26.0 (2025-09-15):
*"By default, every website added to the Home Screen opens as a web app"* and *"there are now zero
requirements for 'installability' in Safari."* Users can opt out per-site with an **"Open as Web App"**
toggle in the Add to Home Screen sheet — *"even if the site is configured to be a web app."* [P]
([WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/),
[WWDC25 beta post](https://webkit.org/blog/16993/)). Before that, installability required manifest
`display: standalone|fullscreen` or `apple-mobile-web-app-capable`. [P]
([Web Push for Web Apps on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/))

---

# 1. The View Transitions API, concretely

## 1.1 Which API applies

There are two, and only one of them is reachable here.

**Same-document (`document.startViewTransition`)** — the SPA API. You call it, it snapshots the old
DOM, runs your update callback, snapshots the new DOM, and cross-fades a pseudo-element tree. **This is
the one a client-side router uses.** [P] ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using))

**Cross-document (`@view-transition { navigation: auto }`)** — the MPA API. MDN's normative
description of `navigation: auto`, verbatim: *"The document will undergo a view transition when taking
part in a navigation, provided the navigation is same-origin, without cross-origin redirects, and its
`navigationType` is `traverse`, `push`, or `replace`."* [P]
([MDN `@view-transition`](https://developer.mozilla.org/en-US/docs/Web/CSS/@view-transition))
It fires on **document** navigations. **A `history.pushState` SPA route change gets nothing from it.**
[P] This app is a client-only SPA with a single prerendered `/_shell.html`; `@view-transition` is dead
weight in it. There is exactly one cross-document navigation in the whole app — cold start — and by
then there is no old document to snapshot.

## 1.2 Support, with the iOS floor stated plainly

All versions from MDN BCD, fetched 2026-08-16. [P]

| Feature | Chrome / Chrome Android | **Safari + iOS Safari** | Firefox |
|---|---|---|---|
| `document.startViewTransition` | 111 (2023-03-07) | **18.0 (2024-09-16)** | 144 (2025-10-14) |
| `ViewTransition.ready` / `.finished` / `.updateCallbackDone` / `.skipTransition()` | 111 | **18.0** | 144 |
| `view-transition-name` | 111 | **18.0** | 144 |
| `view-transition-class` | 125 (2024-05-14) | **18.2 (2024-12-11)** | 144 |
| types — `startViewTransition({update, types})`, `ViewTransition.types`, `:active-view-transition-type()` | 125 | **18.2** | 147 (2026-01-13) |
| `view-transition-name: match-element` | 137 (2025-05-27) | **18.4 (2025-03-31)** | 144 |
| `Document.activeViewTransition` | 142 (2025-10-28) | **26.2 (2025-12-12)** | 147 |
| `@view-transition` (cross-document) | 126 (2024-06-11) | **18.2** | **never** — [bug 1860854](https://bugzilla.mozilla.org/show_bug.cgi?id=1860854), status NEW |
| `ViewTransition.waitUntil()` | 144 (2026-01-13) | **no** | no |
| `ViewTransition.transitionRoot` | 147 (2026-04-07) | **no** | no |

**Bottom line for this app:** same-document view transitions work on **iOS 18.0+ and Android Chrome
111+**. Types — the mechanism you need for direction-aware transitions (slide left on forward, right
on back) — need **iOS 18.2+**. Everything the redesign wants is available on any iPhone that can run
iOS 18.2 (December 2024). [P]

**In an installed PWA specifically:** no primary source distinguishes installed-PWA behaviour from
in-browser behaviour for this API, on either platform. [P — absence confirmed by search] An iOS
home-screen web app runs the same OS-bundled WebKit, so availability tracks the iOS version
identically. [I]

## 1.3 What the API actually gives you

`document.startViewTransition(callbackOrOptions)` returns a `ViewTransition` with four things worth
knowing: [P] ([MDN `ViewTransition`](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition))

- `updateCallbackDone` — fulfils when your DOM-update callback's promise fulfils.
- `ready` — fulfils once the pseudo-element tree exists and the animation is about to start. **This is
  the promise that rejects on every interesting failure.**
- `finished` — fulfils once the animation is done and the new view is interactive.
- `skipTransition()` — skips the *animation*, not the DOM update.

The pseudo tree, which is what your CSS targets: [P]

```
::view-transition
└─ ::view-transition-group(name)
   └─ ::view-transition-image-pair(name)
      ├─ ::view-transition-old(name)
      └─ ::view-transition-new(name)
```

**The page is frozen while your callback runs.** Chrome's own docs: *"During this time, the page is
frozen, so delays here should be kept to a minimum."* [P]
([Chrome, same-document view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/same-document))
The spec sets `rendering suppression for view transitions` to `true` across the callback. [P]
([css-view-transitions-1](https://drafts.csswg.org/css-view-transitions-1/)) The spec's skip-after-
timeout is *"an implementation-defined duration"* — no number is normative. [P]

## 1.4 Interruption — the double-tap case

This is the ticket's specific worry, and the spec answers it precisely.

**Starting a second transition kills the first.** css-view-transitions-1 §6.1.1 step 5, verbatim:
*"If document's active view transition is not null, then skip that view transition with an
`AbortError` `DOMException`."* The new transition then proceeds. [P]
Chrome states the same in prose: *"Only one view transition is allowed to run at a time. If a new view
transition starts while one is already running, the old transition skips to the end."* [P]

What that means for each promise on the killed transition: [P]

| Promise | On being superseded |
|---|---|
| `ready` | **rejects with `AbortError`** |
| `updateCallbackDone` | resolves normally — the DOM update still ran |
| `finished` | **fulfils** — MDN: *"If a transition animation fails to start or is skipped … the end state is still reached therefore `finished` will still fulfill."* |

**So the visible behaviour of a double-tap is: the first transition snaps to its end state, the second
plays.** No stuck frame, no lost navigation. What you get instead is an **unhandled promise rejection**
on `ready` unless somebody catches it. The spec notes the lifecycle promises are created eagerly, so
rejections raise `unhandledrejection` **even if you never read the getter**. [P]

**Four other things silently skip a transition**, all of which happen on a phone:

1. **Document hidden at start** — §6.1.1 step 4: skip with `InvalidStateError`. [P]
2. **Document becomes hidden mid-transition** — the page-visibility change steps skip the active
   transition with `InvalidStateError`. [P] On a phone this is the app-switcher, a notification pull-
   down, the screen locking.
3. **Snapshot containing block resizes** — *"If transition's initial snapshot containing block size is
   not equal to the snapshot containing block size, then skip."* [P] **The software keyboard opening
   mid-transition resizes the viewport and therefore kills the transition.** [I — the spec rule is [P],
   that the keyboard triggers it follows from §4 below and is not separately documented]
4. **Duplicate `view-transition-name`** — MDN, verbatim: *"If two rendered elements have the same
   `view-transition-name` at the same time, `ViewTransition.ready` will reject and the transition will
   be skipped."* [P] ([MDN `view-transition-name`](https://developer.mozilla.org/en-US/docs/Web/CSS/view-transition-name))
   The spec skips with `InvalidStateError`. [P] **This is the failure mode for lists** — Log's session
   rows, Today's task list — where old and new items coexist for one frame during a route change.
   `view-transition-name: match-element` (iOS 18.4+, Chrome 137+) makes the browser assign unique names
   by element identity, which removes the class of bug entirely for same-document transitions; MDN
   notes it *"can only be used for same-document view transitions"*, which is all this app has. [P]

**If your update callback throws or returns a rejecting promise**, `ready` rejects **and** `finished`
rejects — the only case where `finished` rejects at all. MDN: *"This would indicate that the new state
of the page wasn't created."* [P]

**Error-name cheat sheet:** `AbortError` = superseded by a newer transition. `InvalidStateError` =
document hidden, or duplicate `view-transition-name`. Anything else = your callback failed. [P]

## 1.5 `prefers-reduced-motion` is not automatic

The spec's UA stylesheet gives `::view-transition-group(*)` an unconditional
`animation-duration: 0.25s` and **contains no `prefers-reduced-motion` rule anywhere** — not in the UA
styles, not in the accessibility considerations. [P] MDN's "Using the View Transition API" guide has no
reduced-motion section at all. [P] **The developer must gate it.**

`prefers-reduced-motion` is Baseline widely available since January 2020; on iOS it maps to
**Settings › Accessibility › Motion**. [P]
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion))

Chrome's guidance is worth quoting because it argues against the blunt fix: *"a preference for
'reduced motion' doesn't mean the user wants no motion. Instead of preventing transitions entirely, you
could choose a more subtle animation, but one that still expresses the relationship between elements,
and the flow of data."* [P]

The circulated kill-switch — `::view-transition-group(*), ::view-transition-old(*),
::view-transition-new(*) { animation: none !important }` — leaves both snapshots stacked and is not
prescribed by any primary source. [I] The clean route is to not start the transition, which TanStack
Router supports directly (§1.7).

## 1.6 Known iOS bugs in view transitions

WebKit Bugzilla open-bug query run 2026-08-16. [P] Bugzilla rate-limited (HTTP 503) on per-bug fetches,
so only 320238's body was read; the rest are ID/status/summary from the open-bug list.

**The one that matters most:**

- **[320238](https://bugs.webkit.org/show_bug.cgi?id=320238) — "View Transitions cause flash when
  overlapping iOS Safari header and footer"** — reported **2026-07-24**, last modified **2026-07-27**,
  status **NEW / unresolved**, filed against iOS 27. Transparent headers and footers go solid during a
  transition, producing a flash. In-thread analysis: Safari samples the top 6px of the viewport to
  choose the colour behind the Dynamic Island when `position: fixed` content exists, and view-
  transition pseudo-elements *are* fixed, so the sampled colour mismatches; linked to `viewport-fit=cover`
  handling on iOS in portrait. The reporter found `:root { view-transition-name: none !important }`
  reduces but does not eliminate it. [P] **This is a full-screen-route-transition bug on exactly the
  layout shape this app wants: a fixed bottom bar over a transitioning page.**

Others, all **NEW** as of the same query: [P]

| Bug | Summary |
|---|---|
| [310127](https://bugs.webkit.org/show_bug.cgi?id=310127) | `document.startViewTransition()` can return `null` — spec-violating; `startViewTransition(cb).ready` could throw |
| [321467](https://bugs.webkit.org/show_bug.cgi?id=321467) | [iOS] `object-view-box` overflow path off by 1 device pixel |
| [321084](https://bugs.webkit.org/show_bug.cgi?id=321084) | Snapshot of `<video>` blank for the first frame closing a same-document morph |
| [317712](https://bugs.webkit.org/show_bug.cgi?id=317712) | Rendering quality degrades when capturing elements with CSS transforms |
| [320346](https://bugs.webkit.org/show_bug.cgi?id=320346) | Smooth `scrollTo()` during a view transition desyncs `scrollLeft` |
| [302256](https://bugs.webkit.org/show_bug.cgi?id=302256) | `backdrop-filter` not applied during view transitions |
| [302166](https://bugs.webkit.org/show_bug.cgi?id=302166) | `transform-style: preserve-3d` flattened in snapshots (all engines) |
| [315907](https://bugs.webkit.org/show_bug.cgi?id=315907) | `finished` promise resolution timing may deviate from spec |
| [314154](https://bugs.webkit.org/show_bug.cgi?id=314154) | Crash with `content-visibility: auto` ancestor |

Safari 26.0 shipped **no new** view-transition features; its only related entry is a fix
(*"Fixed `will-change: view-transition-name` to create a stacking context and a backdrop root"*). [P]

## 1.7 TanStack Router's first-party support

**Yes, first-party, and it is a thin wrapper.** Read from `router-core` on `main`, 2026-08-16. [P]

Three surfaces: [P] ([NavigateOptionsType docs](https://github.com/TanStack/router/blob/main/docs/router/api/router/NavigateOptionsType.md),
[RouterOptionsType docs](https://github.com/TanStack/router/blob/main/docs/router/api/router/RouterOptionsType.md),
`packages/router-core/src/link.ts:327-338`)

- `<Link viewTransition>` and `navigate({ viewTransition })` — `boolean | ViewTransitionOptions`,
  **default `false`**.
- `createRouter({ defaultViewTransition })` — same type, applies to every navigation.
- `ViewTransitionOptions` is `{ types: Array<string> | ((info) => Array<string> | false) }`, where
  `info` is `{ fromLocation?, toLocation, pathChanged, hrefChanged, hashChanged }`.
  `packages/router-core/src/router.ts:857-867`. [P]

The implementation, `packages/router-core/src/router.ts:2378-2427`: [P]

```ts
startViewTransition = (fn: () => Promise<void>) => {
  const shouldViewTransition =
    this.shouldViewTransition ?? this.options.defaultViewTransition
  this.shouldViewTransition = undefined
  if (
    shouldViewTransition &&
    !(isServer ?? typeof document === 'undefined') &&
    typeof (document as any).startViewTransition === 'function'
  ) {
    // ... resolves types, feature-detects
    //     window.CSS?.supports?.('selector(:active-view-transition-type(a))')
    //     returning `false` from the types function skips the transition entirely
    return (document as any).startViewTransition(startViewTransitionParams)
      .updateCallbackDone
  }
  return fn()
}
```

Five things follow directly from that source, and each one matters here:

1. **It feature-detects and degrades to a plain call.** No polyfill, no fallback animation. On a
   browser without the API the navigation just happens. `defaultViewTransition` "will be ignored". [P]
2. **It feature-detects *types* separately**, via
   `CSS.supports('selector(:active-view-transition-type(a))')`. If types aren't supported it falls back
   to the plain `startViewTransition(fn)` form. So passing `{ types }` is safe down to iOS 18.0; you
   just lose the direction-awareness below 18.2. [P]
3. **Returning `false` from the `types` function skips the transition for that navigation.** This is
   the clean per-navigation opt-out — and it is the documented hook for both `prefers-reduced-motion`
   and the swipe-back conflict in §1.9. [P]
4. **It discards the `ViewTransition` object and awaits only `updateCallbackDone`.** `ready` and
   `finished` get no rejection handlers. This is [issue #7906](https://github.com/TanStack/router/issues/7906)
   — **open**, filed 2026-07-26, with a repro that fires
   `InvalidStateError: Transition was aborted because of invalid state` in Chrome by navigating while
   the document is hidden. [PR #7907](https://github.com/TanStack/router/pull/7907) is **open, not
   merged**. [P] **Every skip cause in §1.4 becomes a global unhandled rejection in this app until that
   lands or you patch around it.**
5. **The update callback awaits React.** `packages/router-core/src/load-client.ts:1947` wraps
   `await router.startTransition(commit, matches)` inside the view-transition callback. The frozen
   screenshot is held for as long as React takes to render the destination route — **including
   fetching a lazy code-split chunk**. On a cold chunk over gym wifi that is a visibly frozen screen.
   [P for the code; the user-visible consequence is [I]]

**`ssr: false` changes nothing here.** The router's own guard is `typeof document === 'undefined'`, and
the upstream `examples/react/view-transitions` app is a plain `ReactDOM.createRoot` client-side SPA
with no SSR at all. [P] View transitions are a purely client-side, post-hydration concern.

**One consequence of the shell that is not documented anywhere:** `runClientTransaction` is the single
client load path, including the first one, and there is no first-load guard on `startViewTransition`.
With `defaultViewTransition: true`, the shell → first-route commit on cold start should therefore run
through a view transition, cross-fading the shell's pending UI into the first real screen. [I — read
from source, **not observed; test this on a device**] Per-`Link` opt-in avoids the question entirely.

## 1.8 The gap that will bite: back/forward does not transition

**`shouldViewTransition` is only ever set inside `commitLocation`** — `router.ts:2190`,
`this.shouldViewTransition = viewTransition`, on the `PUSH`/`REPLACE` path. [P] Browser Back/Forward
arrives as `popstate` and goes straight to `router.load`, never through `commitLocation`.

[PR #7697](https://github.com/TanStack/router/pull/7697), "feat(router-core): replay view transitions
on browser Back/Forward" — **open, not merged**, filed 2026-06-25 — states it outright:

> View transitions only fire for navigations that go through `commitLocation` … Browser Back/Forward
> arrives as `popstate` … so the flag stays unset and **no transition plays**. … Result: an app
> animates `A → B` via a `Link`, but pressing Back gives a hard cut. The only workaround today is
> `defaultViewTransition`, which animates *every* navigation — you can't opt one flow in and have it
> round-trip. [P]

**This is decisive for an installed phone app**, where Back is a *system gesture*, not a button. Either
you take `defaultViewTransition` for the whole app — and inherit the cold-start question in §1.7 and
the `router.invalidate` behaviour in §1.10 — or Back is a hard cut while forward navigation animates,
which reads worse than no animation at all. There is no third option in shipped code today. [P]

Also open and related: [#2983](https://github.com/TanStack/router/issues/2983) (closed 2025-01-03) —
`router.history.back()` produced no transition where `window.history.back()` did.

## 1.9 The Safari double-animation

[Issue #6754](https://github.com/TanStack/router/issues/6754) — **open**, filed 2026-02-24, zero
comments, against Router 1.159.0: [P]

> On safari and browser that have default navigation transitions it clashes with view transitions. …
> On a safari browser use swipe to navigate back or forward … Observe seeing two animation: safari's
> and the view transition.

The reporter's own workaround uses `NavigateEvent.hasUAVisualTransition` — `true` means the UA already
ran its own visual transition — fed into `defaultViewTransition.types` returning `false`. [P]

**The catch is the support floor.** `hasUAVisualTransition` exists on two events with different
histories: [P]

- `PopStateEvent.hasUAVisualTransition` — Chrome/Edge 118+, **Safari and iOS Safari 18.0+**, Firefox
  149+.
- `NavigateEvent.hasUAVisualTransition` (the Navigation API) — Chrome 118+, **Safari and iOS Safari
  26.2+**, Firefox 147+. The whole Navigation API landed in **Safari 26.2, 2025-12-12**. [P]
  ([WebKit 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/))

So the issue's `navigation.addEventListener('navigate')` workaround needs **iOS 26.2**, while the
`popstate` form works from **iOS 18.0** — and `popstate` is what the router already sees. [P] Whether
the router exposes a hook at the right point to use it is not established here.

## 1.10 Two smaller router facts

- **`router.invalidate()` triggers a view transition** with no per-call opt-out —
  [#4344](https://github.com/TanStack/router/issues/4344), closed 2025-06-08. The only lever was
  `defaultViewTransition: false`. [P] Relevant because this app revalidates after every queued offline
  write.
- [#7158](https://github.com/TanStack/router/pull/7158) (closed, unmerged) reported a client-side
  crash blanking the UI when a redirect happened during a view transition with lazy routes. [P]

---

# 2. Scroll and overscroll

## 2.1 `overscroll-behavior` — the only documented lever, and iOS has it partially

Semantics, MDN verbatim: [P] ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior))

- `auto` — *"The default scroll overflow behavior occurs as normal."*
- `contain` — *"Default scroll overflow behavior (e.g., 'bounce' effects) is observed inside the element
  where this value is set. No scroll chaining occurs on neighboring scrolling areas… Disables native
  browser navigation, including the vertical pull-to-refresh gesture and horizontal swipe navigation."*
- `none` — *"No scroll chaining occurs to neighboring scrolling areas. Default scroll overflow behavior
  is prevented."*

Two independent axes: **scroll chaining** (does the scroll propagate to an ancestor) and **local
overscroll affordance** (bounce, glow, pull-to-refresh). `contain` kills chaining and keeps the bounce;
`none` kills both. [P] ([Chrome](https://developer.chrome.com/blog/overscroll-behavior/))

Support (BCD, 2026-08-16): [P]

| | shorthand | note |
|---|---|---|
| Chrome / Chrome Android | 63 (2017-12) partial → **144 full (2026-01-13)** | |
| **Safari / iOS Safari** | **16.0 (2022-09-12)** | **still flagged `partial_implementation`; no "full" entry** |
| Firefox | 59 partial → 150 full (2026-04-21) | |

**The BCD "partial" note, verbatim: *"The property has no effect on scroll containers that have no
scrollable overflow."*** [P] Chrome fixed this in 144; **Safari has not**. So on iOS, putting
`overscroll-behavior: contain` on a sheet that isn't currently overflowing does nothing. [P] MDN
consequently still labels the property **"Limited availability / not Baseline"**. [P]

WebKit's iOS implementation maps the CSS values onto UIKit `UIScrollView` `bouncesHorizontally` /
`bouncesVertically` — [bug 233788](https://bugs.webkit.org/show_bug.cgi?id=233788), filed 2021-12-02,
**RESOLVED FIXED 2022-01-28**. [P] That is why it behaves like a scroll-view flag rather than a CSS
property on iOS.

Chrome 150 (2026-06-30) added a `chain` value (propagate, no local effect). Not in Safari. [P]

## 2.2 Pull-to-refresh — probably absent in an installed iOS PWA

**Android Chrome — documented, and one line.** Chrome's own article: *"Turning off the pull-to-refresh
action is a single line of CSS… Just prevent scroll chaining on the entire viewport-defining element.
In most cases, that's `<html>` or `<body>`"* → `overscroll-behavior-y: contain`. [P]

**iOS Safari the browser** got pull-to-refresh in the iOS 15 redesign (2021-09-20), when the reload
button left the tab bar. [B — press/blog only; **not** in Apple's Safari 15 release notes]

**In an installed iOS PWA the reload gesture appears to be absent.** No Apple or WebKit source states
this either way. Evidence: [B]

- pixelfed [#3786](https://github.com/pixelfed/pixelfed/issues/3786), "UI: Overscroll refresh not
  working in PWA", opened 2022-11-18, iPhone 12 Pro Max / iOS 16.1.1: works in Safari, **does not work
  after Add To Home Screen**; the reporter had to switch tabs to refresh. Closed not-planned, no
  maintainer explanation.
- web.dev *Learn PWA — App design* (Chrome team, updated 2024-09-20): *"Modern mobile browsers, such
  as Google Chrome and Safari, have a feature that refreshes the page when it is pulled down. **On some
  browsers, such as Chrome on Android, that behavior is also enabled on standalone PWAs.**"* The
  "some browsers… such as Chrome on Android" phrasing implies iOS standalone is not one of them, but
  never says so. [P for the quote, [I] for the implication]
- Contradicting: Philip Heltweg, "A Checklist of Issues for Progressive Web Apps" (2024-10-15) asserts
  *"When dragging down, iOS triggers a pull-to-refresh"* in installed PWAs. [B]

**Reading:** what most standalone reports call "pull-to-refresh" is the elastic rubber-band bounce, not
a reload. The bounce is what makes a page feel like a page; it is present in standalone and is not
removed by anything documented except `overscroll-behavior: none` — which on iOS carries the
"no effect without scrollable overflow" caveat above. [I] **This is the single most load-bearing
unverified fact in this document. Test it on the athlete's phone before designing around either
answer.**

## 2.3 iOS rubber-banding: what is documented and what is folklore

**`-webkit-overflow-scrolling: touch` is obsolete.** Apple's Safari 13 release notes: *"Added support
for one-finger accelerated scrolling to all frames and overflow:scroll elements eliminating the need to
set `-webkit-overflow-scrolling: touch`."* [P — quote via the merged BCD PR
[#10542](https://github.com/mdn/browser-compat-data/pull/10542), Apple's page did not render for the
fetcher] BCD records `version_removed: 13` for Safari/iOS Safari: the property still *parses*
(`CSS.supports()` is true) but **has no effect**. [P] MDN's English page for it now 404s. [P]

**Stopping body rubber-banding:**

| Technique | Status |
|---|---|
| `overscroll-behavior: none` | **[P] documented** — the standard mechanism; iOS caveat per §2.1 |
| `position: fixed` + `overflow: hidden` on `html`/`body` + inner `100dvh` scroller | **[B] folklore.** The canonical write-up (Bramus, 2016-05-02) now carries the author's own note: *"The workaround below no longer seems to work in recent iOS/MobileSafari versions (iOS 12+)"* |
| `overflow: hidden` on `<body>` | unreliable on iOS — WebKit [bug 153852](https://bugs.webkit.org/show_bug.cgi?id=153852), *"`<body>` with overflow:hidden CSS is scrollable on iOS"*, behaviour differs from macOS [P] |
| `touch-action: none` on body | **[B] folklore**, no spec basis for suppressing overscroll |

**Only `overscroll-behavior` is documented. Everything else in the community stack is folklore, and
the most-cited piece of it is disavowed by its own author.**

## 2.4 Scroll restoration

**The browser primitive.** `history.scrollRestoration` is a property **of the session history entry**,
and `pushState` entries are ordinary session history entries carrying their own *scroll position data*.
[P] ([HTML spec](https://html.spec.whatwg.org/multipage/browsing-the-web.html#scroll-restoration-mode))
So **the browser does restore scroll on `popstate` traversal of pushState entries** unless the mode is
`manual`. `auto` = *"The user agent is responsible for restoring the scroll position upon navigation"*;
`manual` = *"The page is responsible … and the user agent does not attempt to do so automatically."* [P]
Support: Chrome 46, Firefox 46, **Safari 11 / iOS 11**. [P]

Because the mode is per-entry, the spec advises setting it *"as soon as possible (e.g., in the first
script element in the document's head)"*. [P]

**TanStack Router's implementation, and its open iOS regression.** `createRouter({ scrollRestoration: true })`
turns on a system that monitors scrollable areas, caches per-`__TSR_key` positions, and restores them
after navigation. It also supports `scrollToTopSelectors` for nested scroll containers, and
`getScrollRestorationKey` to key on something other than the history key. [P]
([scroll-restoration guide](https://github.com/TanStack/router/blob/main/docs/router/guide/scroll-restoration.md))

**`packages/router-core/src/scroll-restoration.ts:204` on `main` sets
`history.scrollRestoration = 'manual'`.** [P — read 2026-08-16]

[Issue #7956](https://github.com/TanStack/router/issues/7956) — **open**, filed 2026-08-05 — argues
this should never happen, and names iOS first:

> **iOS Safari (mobile):** swipe-back's preview snapshot no longer matches the landing position —
> native pre-paint restoration is disabled and the router's restore runs post-paint (in the
> `onRendered` subscriber), so the page repaints at the wrong offset after the gesture completes. [P]

Confirmed in the thread on **iOS 18 Safari and Chrome 128**, 2026-08-07: *"Reverting it to `'auto'` in
userland while leaving the router's restoration active fixes the swipe-back preview mismatch and the
refresh flash, and I couldn't produce a case where `'manual'` restores better."* [P] The commenter also
notes the removal alone does **not** fix forward-navigation: *"the forward-nav PUSH reset stays
post-paint since the browser doesn't restore on a new entry."* [P]

Predecessor [#7815](https://github.com/TanStack/router/issues/7815) was **closed as completed
2026-08-04** but the `'manual'` line is still on `main` — hence the follow-up. [P] #7815 also documents
the forward-navigation flicker: *"Navigating from a long page to a short one paints the new page pinned
to its bottom for a frame … which proves the reset is post-paint."* [P] **Log → Today is exactly that
shape.**

Other open scroll issues, all as of 2026-08-16: [P]

| Issue | State | Gist |
|---|---|---|
| [#8028](https://github.com/TanStack/router/issues/8028) | open | `resetScroll` lives in a single router slot (`this._scroll.next`), so a second navigation while the first settles silently drops the first's reset — reproduced with Playwright |
| [#7749](https://github.com/TanStack/router/issues/7749) | open | Pending Component does not receive scroll restoration logic |
| [#8024](https://github.com/TanStack/router/issues/8024) | open | scroll-restoration registers `pagehide` with a bare `addEventListener` |
| [#7687](https://github.com/TanStack/router/issues/7687) | closed | element scroll restoration reset to top by the `scrollToTopSelectors` fallback |

A user-reported regression window in #7815's thread (2026-07-23): plain browser-Back restoration
**regressed between `@tanstack/react-router` 1.170.17 and 1.170.18**, bisected to a single patch,
not minimally reproducible. [B — user report on a [P] tracker]

**`resetScroll: false`** on `<Link>` / `navigate` / `redirect` is the documented per-navigation opt-out.
[P]

## 2.5 Scroll anchoring — iOS has none, today

`overflow-anchor` / scroll anchoring adjusts scroll position so content doesn't jump when something
above the viewport changes size. It is **on by default** where supported and is **opt-out only**. [P]
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor))

Support: Chrome/Edge 56, Firefox 66, **Safari & iOS Safari 27**. [P] WebKit announced it in
*"News from WWDC26: WebKit in Safari 27 beta"*, 2026-06-08: *"When content is inserted or removed above
the current viewport position … the browser automatically adjusts the scroll position so the content
you're reading stays put instead of jumping."* Tracking bug
[171099](https://bugs.webkit.org/show_bug.cgi?id=171099), open since 2017. [P]

**Safari 27 is still beta on 2026-08-16, so shipping iOS (26.x) has no scroll anchoring at all.** [P]
Anything that grows above the fold on Today or Log — a lazily-hydrated card, an image without intrinsic
size — will jump the reading position on iPhone and will not on a current Chrome. [I]

## 2.6 Smooth scrolling

`scroll-behavior` applies only to scrolling *"triggered by navigation or CSSOM scrolling APIs"* —
*"any other scrolls, such as those performed by the user, are not affected"*. On `body` it does **not**
propagate to the viewport (unlike `overflow`); put it on the root. UAs *"are allowed to ignore this
property."* Baseline widely available since March 2022. [P] It is **not** suppressed by
`prefers-reduced-motion` automatically — that is a query you must write. [P]

---

# 3. Safe areas and the viewport

## 3.1 `viewport-fit=cover`

MDN: `auto` — *"Doesn't affect the initial layout viewport"*; `contain` — *"scaled to fit the largest
rectangle inscribed within the display"*; `cover` — *"scaled to fill the device display. It's highly
recommended to use the safe area inset variables to ensure that important content doesn't end up
outside the display."* [P]
([MDN viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport))

The normative home is **CSS Round Display Level 1** (ED 2025-12-26), not css-viewport, where
`viewport-fit` does not appear at all. The Round Display text does **not** mention safe-area insets. [P]

**iOS.** WebKit, *"Designing Websites for iPhone X"*, Timothy Horton, 2017-09-22: the default
`viewport-fit=auto` *"results in the automatic insetting behavior"* — *"Content is automatically inset
within the display's safe area so it is not obscured by the rounded corners, or the device's sensor
housing."* `cover` *"cause[s] the page to lay out to the full size of the screen"*. Shipped iOS 11;
`constant()` renamed to `env()` in iOS 11.2 beta. [P]
**Corollary: without `viewport-fit=cover`, `env(safe-area-inset-*)` are 0 on iOS, because the UA
already did the insetting.** [P]

**Android.** `viewport-fit=cover` is now meaningful there too. Chrome's edge-to-edge guide (2025-02-28):
*"To opt-in to edge-to-edge, set `viewport-fit` to the value of `cover`."* [P]
([developer.chrome.com/docs/css-ui/edge-to-edge](https://developer.chrome.com/docs/css-ui/edge-to-edge))

## 3.2 `env(safe-area-inset-*)`

MDN's definition, verbatim: *"The safe distance from the top, right, bottom, or left inset edge of the
viewport… The values are `0` if the viewport is a rectangle and no features — such as toolbars or
dynamic keyboards — are occupying viewport space; otherwise, it is a `px` value greater than `0`."* [P]
([MDN `env()`](https://developer.mozilla.org/en-US/docs/Web/CSS/env))

Support (BCD, 2026-08-16): [P]

| | `env()` | `safe-area-inset-*` | `keyboard-inset-*` | `titlebar-area-*` |
|---|---|---|---|---|
| Chrome / Chrome Android | 69 (2018-09-04) | 69 | **94** (2021-09-21) | 93 |
| **Safari / iOS Safari** | **11.1** (11 used `constant()`) | **11 (2017-09-19)** | **false** | **false** |
| Firefox | 65 (2019-01-29) | 65 | false | false |

**iOS: the bottom inset differs between Safari and standalone, and is not documented.** Apple Developer
Forums thread [716552](https://developer.apple.com/forums/thread/716552) (Sept 2022, follow-ups through
Aug 2023 / iOS 16): with the Safari toolbar hidden, `safe-area-inset-bottom` returned **34** portrait /
**21** landscape on iOS 14, but **0** on iOS 15+ — flipping between 21 and 0 as the toolbar shows and
hides, causing overlap. **No Apple reply in the thread.** [B — developer forum, but a well-documented
observation] The widely-repeated figures are **34px in standalone vs 0px in Safari**, because Safari's
bottom bar already occupies that space. [B]

**[I]** In standalone there is no retracting toolbar, so the bottom inset should be *stable* at the
home-indicator height rather than oscillating — which is the one respect in which the installed app is
easier to lay out than the browser. Not documented; verify.

An open WebKit bug, [272779](https://bugs.webkit.org/show_bug.cgi?id=272779), is titled
*"safe-area-inset-left and safe-area-inset-right should be 0 [when] viewport-fit is not cover"* —
implying real left/right behaviour deviates. Body unread (Bugzilla 503). [P for title only]

**Android insets.** Chrome's edge-to-edge guide names the system bars — the status bar and *"the
classic three-button navigation or the modern gesture navigation bar"* — and says safe-area insets
define the rectangle *"in which it is safe to place content so that it does not get obstructed by
things such as the Android gesture navigation bar."* It also introduces **"the chin"**: *"By default,
Chrome edge-to-edge shows a new dynamic bottom bar known as 'the chin' over the gesture navigation bar
area. Just like the Chrome address bar, this chin moves out of the way as you start scrolling and
affects the size of the viewport."* [P] **The guide never states inset values, and never distinguishes
gesture-nav from three-button-nav.** [P — absence]

Chrome went edge-to-edge on Android in **Chrome 135 (stable 2025-04-01)**, small-screen devices only;
*"Chrome on Android running on large-screen devices is currently excluded."* [P]
Platform side: edge-to-edge is **enforced on Android 15 (API 35)** for apps targeting SDK 35. [P]
([developer.android.com](https://developer.android.com/about/versions/15/behavior-changes-15))
**Whether an installed PWA's WebAPK window is affected is undocumented.** [P — absence]

## 3.3 What a bottom-anchored control has to do

The two platforms want different patterns, and Chrome documents a performance trap.

- **Apple's pattern is `max()`.** WebKit iPhone X post, verbatim: *"we want to use `max()`:
  `padding-left: max(12px, env(safe-area-inset-left));`"* [P]
- **Chrome's pattern is `calc()`, and it is load-bearing.** *"Chrome has code optimizations… in place
  when it detects the `calc(env(safe-area-inset-bottom, …) +/- …)` pattern."* And the trap, verbatim:
  a plain `padding-bottom: env(safe-area-inset-bottom, 0px)` means *"Chrome won't slide the chin away
  as you scroll when it detects this pattern."* [P] **A naive safe-area padding pins Chrome's chin
  permanently visible.**
- **`env()` takes a fallback**: formal syntax
  `env( <custom-ident> <integer [0,∞]>* , <declaration-value>? )`; *"Anything between the first comma
  and the end of the function is considered the fallback value."* [P]
- **`safe-area-max-inset-*`** — CSS Environment Variables L1 ED (2026-05-28): *"static values that
  represent the maximum value of their dynamic counterpart when dynamic UA interfaces are retracted"*.
  Shipped **Chrome 135** (same release as edge-to-edge), motivated by footers sliding as safe-area
  values change rather than forcing a relayout. Chrome's recommended combination is
  `safe-area-max-inset-bottom` to size the element up front plus `safe-area-inset-bottom` to pull it
  down as the chin retracts, with a `36px` fallback. **Absent from MDN BCD's `env.json`; no evidence of
  Safari support; absent from Safari 26.0–26.6 and 27-beta notes.** [P / **Chrome-only**]

**Net:** one bottom bar cannot be written once. iOS wants
`max(<gap>, env(safe-area-inset-bottom))` and needs `viewport-fit=cover` to get a non-zero value at all;
Android wants the `calc(env(...) ± ...)` shape or it disables the chin animation, and would ideally use
a Chrome-only variable that iOS does not have. [P for each half; the incompatibility is [I]]

## 3.4 `dvh` / `svh` / `lvh`

Support (BCD): all of `sv*`, `lv*`, `dv*`, `vi`, `vb` — **Safari and iOS Safari 15.4 (2022-03-14)**,
Firefox 101 (2022-05-31), Chrome/Edge 108 (2022-11-29). **Safari shipped first.** [P]

Definitions (MDN + CSS Values 4): **small (`sv*`)** = viewport assuming dynamic UA interfaces are
**expanded**; **large (`lv*`)** = **retracted**; **dynamic (`dv*`)** = sized with live consideration of
them. [P]

**The `100vh` overflow is documented, not folklore.** MDN states outright *"`vh` is equivalent to
`lvh`"* and *"currently all default viewport units are equivalent to their large viewport
counterparts"*. CSS Values 4 says the default mapping to the large viewport size *"is presumed to be
required for Web compatibility."* [P]

**`dvh` instability is also in the spec**, verbatim: *"The sizes of the dynamic viewport-percentage
units are not stable even while the viewport itself is unchanged. Using these units can cause content
to resize e.g. while the user scrolls the page. Depending on usage, this can be disturbing to the user
and/or costly in terms of performance."* MDN repeats it as a Warning. [P] web.dev adds that dynamic
values are **throttled** and *"do not update at 60fps"* — but does **not** call it layout thrash or
advise against `dvh`. [B for the "thrash" framing]

**In an installed iOS PWA there is no URL bar, so `svh == lvh == dvh`.** [I] It follows from the spec's
own definitions (no retracting UA chrome ⇒ small = large), and WebKit
[bug 261185](https://bugs.webkit.org/show_bug.cgi?id=261185), *"[iOS] `svh`/`dvh` units are unexpectedly
equal when Safari tab bar is not visible"*, shows the collapse is observed behaviour — body unread
(Bugzilla 503). [P for the title] **Note the consolation prize is small:** `100dvh` in standalone still
runs *under* the Dynamic Island and the home indicator, so safe-area insets are still required. [P]

Related: WebKit [bug 242758](https://bugs.webkit.org/show_bug.cgi?id=242758), *"REGRESSION (Safari
15.6): Dynamic viewport units (dvh) not matching viewport height"*. [P — title only]

## 3.5 Manifest `display`, and Apple's meta tags in 2026

**iOS honours the manifest `display` field, and has since iOS 11.3.** BCD
(`manifests/webapp/display.json`): **Safari iOS 11.3** for the member and for `standalone` / `browser`;
Safari macOS 17. **`fullscreen` and `minimal-ui` are `false` on both.** [P] web.dev Learn PWA: *"Safari
on iOS and iPadOS doesn't support Minimal UI mode for PWAs. Instead, a browser shortcut is used as a
fallback."* [P]

The `display` fallback chain is `fullscreen → standalone → minimal-ui → browser`. [P]
**`display_override`** is Chrome/Edge 89+ only; **Safari, iOS Safari and Firefox do not support it**.
[P]

**Apple's legacy meta tags are both in Apple's *archive* library** — the modern
`developer.apple.com/documentation/webkit/supported-meta-tags` URL 404s. [P]

- `apple-mobile-web-app-capable` — *"Sets whether a web application runs in full-screen mode… there is
  no browser URL text field at the top of the screen or button bar at the bottom of the screen. Only a
  status bar appears at the top of the screen."* Detect with `window.navigator.standalone`. [P —
  archived, updated 2016-12-12]
- `apple-mobile-web-app-status-bar-style` — *"has no effect unless you first specify full-screen mode
  using `apple-mobile-web-app-capable`."* `default` — *"Web content is displayed below the status
  bar"*; `black` — same, black background; `black-translucent` — *"Web content is displayed on the
  entire screen, partially obscured by the status bar."* [P — archived]
  **`black-translucent` is the one that gives you a true edge-to-edge dark app**, and it is also the
  one with community reports of a deprecation warning in Safari's remote debugger — **no Apple source
  found**. [B, unconfirmed]

**`@media (display-mode: standalone)`** — Chrome/Edge 42, Firefox 47, **Safari 13 / iOS Safari 12.2**.
MDN's caveat: *"A browser may not support the requested mode set in a PWA manifest, in which case
`display-mode` reflects the actual supported mode rather than what was requested."* [P] **Open
question:** given iOS 26's "every site opens as a web app" default, what does `display-mode` report for
a manifest-less site opened as a web app? Not documented. [P — absence]

---

# 4. The keyboard

## 4.1 The default is now the same on both platforms — and it is the awkward one

**The brief's premise that "Android resizes, iOS doesn't" is out of date.** Android Chrome resized both
viewports historically, but **Chrome 108 (2022-11-29) changed the default to resize the visual viewport
only, explicitly to align with iOS.** Chrome's announcement, 2022-10-28, verbatim: *"Chrome on Android
will no longer resize the Layout Viewport, and instead resize only the Visual Viewport"*, which *"will
align the behavior of Chrome on Android with that of Chrome on iOS, iPadOS, Windows, and CrOS, Safari
on iOS and iPadOS."* [P]
([developer.chrome.com/blog/viewport-resize-behavior](https://developer.chrome.com/blog/viewport-resize-behavior),
[chromestatus 6145225857171456](https://chromestatus.com/feature/6145225857171456))

iOS Safari has always behaved this way, and still does through 26.x. MDN: *"User-interface features
like the on-screen keyboard (OSK) can shrink the visual viewport without affecting the layout
viewport."* [P] ([MDN `VisualViewport`](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport),
[Viewport concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/CSSOM_view/Viewport_concepts))

**What that means concretely, and it is the whole problem:**

- **`position: fixed` resolves against the *layout* viewport**, which did not change. MDN: fixed headers
  and footers *"stick to the top and bottom of the layout viewport."* Chrome's post says of this
  default: elements using `position: fixed` *"remain in place and can be obscured by the OSK"*. [P]
  **A bottom-anchored control is behind the keyboard, not above it.**
- **Viewport units do not move either.** CSS Values 4, verbatim: *"UAs may have some dynamically-shown
  interfaces that intentionally overlay content and do not cause any shifts in layout—and therefore
  have no effect on any of the viewport-percentage lengths. **(Typically on-screen keyboards will fit
  into this category.)**"* [P] ([W3C](https://www.w3.org/TR/css-values-4/#viewport-variants))
  So `100dvh` does **not** shrink when the keyboard opens. `dvh` solves the URL-bar problem, not the
  keyboard problem — and in standalone there is no URL bar, so `dvh` buys nothing here at all. [P + [I]]
- The browser scrolls the *visual* viewport to keep the focused input visible, sliding the page under
  any fixed header too. [P]

**This is exactly the failure mode [#24](https://github.com/YgorPerez/send-lab/issues/24) cares about**:
the Train page's set rows and the assessment form both have inputs low on the screen and a
bottom-anchored control.

## 4.2 `interactive-widget` — Android only, and iOS has nothing equivalent

The viewport-meta `interactive-widget` property, MDN verbatim: [P]

- `resizes-visual` — *"The visual viewport gets resized by the interactive widget. This is the
  default."*
- `resizes-content` — *"The viewport gets resized by the interactive widget."* MDN adds: *"When the
  viewport gets resized, the initial containing block also gets resized, thereby affecting the computed
  size of viewport units."*
- `overlays-content` — *"Neither the viewport nor the visual viewport gets resized."*

Support (BCD, 2026-08-16): [P]

| Chrome Android | WebView Android | Firefox Android | Samsung | Opera Android | **Safari** | **Safari iOS** | **WebView iOS** | Chrome/Edge/Firefox desktop |
|---|---|---|---|---|---|---|---|---|
| **108** | 108 | 133 | 21.0 | 73 | **false** | **false** | **false** | false |

caniuse (data July 2026) lists Safari iOS **3.2 → 26.5 all "not supported"**. [P]

**`interactive-widget` does not exist on iOS. There is no way to make the iOS keyboard resize the
layout viewport.** [P] `resizes-content` is an Android-only affordance that restores the pre-Chrome-108
behaviour on that platform alone.

**And it is not queued.** WebKit [bug 259770](https://bugs.webkit.org/show_bug.cgi?id=259770),
*"Implement the interactive-widget property in the viewport meta tag"* — **status NEW, created
2023-08-03, last changed 2026-07-29, no resolution.** [P] WebKit standards-positions
[#65](https://github.com/WebKit/standards-positions/issues/65), filed **by Google on 2022-09-21** — still
**open, labelled "needs position", assigned to two WebKit engineers, and WebKit has never posted a
position.** [P] No Safari 26.0–26.6 or 27-beta release post mentions it. [P — verified absence]
**Interop 2026** (announced 2026-02-12, 20 focus areas) does not include it; the closest item is a
Mobile Testing *investigation* whose stated aim is *"improving infrastructure for mobile-specific
features like dynamic viewport changes."* [P]
([webkit.org/blog/17818](https://webkit.org/blog/17818/announcing-interop-2026/))

Spec text, for completeness — CSS Viewport Module Level 1, ED 2026-05-28 §3.4: `resizes-visual`
*"MUST resize the visual viewport but MUST NOT resize the initial viewport"*; `resizes-content` *"MUST
resize the initial viewport"*; `overlays-content` *"MUST NOT resize the initial viewport nor the visual
viewport"*; *"If no value, or an invalid value, is set … the behavior implied by `resizes-visual` is
used as the default."* [P] ([drafts.csswg.org/css-viewport](https://drafts.csswg.org/css-viewport/#interactive-widget-section))

**The VirtualKeyboard API is also Chromium-only.** `navigator.virtualKeyboard.overlaysContent = true`,
`boundingRect`, `show()`, `hide()`, the `geometrychange` event, `virtualkeyboardpolicy="manual"`, and
the six `env(keyboard-inset-*)` variables: **Chrome/Chrome Android/Edge 94+; Safari, iOS Safari and
Firefox — `false`.** Secure-context only; MDN labels it Experimental / Limited availability. [P]
WebKit [bug 230225](https://bugs.webkit.org/show_bug.cgi?id=230225), "Implement the VirtualKeyboard
API" — **NEW, created 2021-09-13, last changed 2026-04-15.** [P] (Per the CSS Viewport spec §3.4.1,
`VirtualKeyboard.overlaysContent = true` would take precedence over `interactive-widget` — moot on
iOS, which has neither. [P])

**So on iOS there is exactly one tool: `visualViewport`.**

## 4.3 `visualViewport`

Support: Chrome 61 (2017-09-05), **Safari and iOS Safari 13 (2019-09-19)**, Firefox 91. `resize` and
`scroll` events: Chrome 62, Safari/iOS 13, Firefox 91. `height`, `offsetTop`, `pageTop`, `scale` all at
the same versions. [P] ([BCD](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.VisualViewport.json))

Note `scrollend` on VisualViewport is **not supported in Safari** (Chrome 126, Firefox 150). [P]

**It does fire on keyboard open on iOS, and has since iOS 13.** WebKit
[bug 198347](https://bugs.webkit.org/show_bug.cgi?id=198347), *"Visual Viewport resize not firing when
keyboard opens"*, reported 2019-05-29 by Liam DeBeasi (Ionic), **RESOLVED FIXED**; reporter, 2019-09-26:
*"Looks like this was fixed on iOS 13."* [P]

`visualViewport.height` shrinking and `offsetTop` growing is the only signal iOS gives that a keyboard
is open. There is no keyboard-specific event, no keyboard-height variable, and no way to distinguish a
keyboard resize from a rotation or a toolbar retraction except by inference. [I from the API surface]
MDN publishes a `position: device-fixed` emulation recipe using
`viewport.height - layoutViewport.getBoundingClientRect().height + viewport.offsetTop`, with its own
warning: *"This technique should be used with care; emulating `position: device-fixed` in this way can
result in the fixed element flickering during scrolling."* [P]

### The one place where an installed PWA provably behaves differently from Safari

This is the only primary-source evidence in this whole document of installed-vs-browser divergence.

**WebKit [bug 237851](https://bugs.webkit.org/show_bug.cgi?id=237851) —
*"visualViewport.offsetTop is sometimes 0 when soft keyboard is open on web app mode"*. Status **NEW**,
created **2022-03-14**, last changed **2023-07-17**, rdar://90364854, never triaged by Apple.** [P]

Reporter (iOS 15.4, iPhone 12 Pro), verbatim: *"The log is sometimes correct, but other times I will
see a 0 `offsetTop`… If I add `setTimeout()` to the event handler and log `offsetTop` with a 50ms delay,
then `offsetTop` will be 380 even when it first reports 0 inside the event handler. **Note that I have
only seen it on the web app. I haven't reproed it on mobile Safari.**"* [P]

Second reporter, 2023-04-02: *"it's reliable for installed web apps but not in regular safari… Wrapping
the code in the resize listener in a 'before next paint' (double rAF) fixes it… Is it possible that the
`visualViewport` resize event sometimes fires too soon or the height calculation happens too late?"* [P]

**Reading: on iOS, in an installed PWA, reading `visualViewport` synchronously inside the `resize`
handler is unreliable. Both independent reporters landed on the same fix — defer to the next paint
(double `rAF`).** That is a hard constraint on any keyboard-avoidance implementation this app writes.
[P for the reports; the generalisation is [I]]

**A second, worse standalone-only bug exists and Apple could not reproduce it.** WebKit
[bug 279904](https://bugs.webkit.org/show_bug.cgi?id=279904) — *"Upon upgrading to iOS 18, on-screen
keyboard does not show up for installed web apps (PWAs) when focusing a text input of any kind"* —
created **2024-09-18**, **status NEW, Severity Critical**, rdar://136232949, 12 comments. WebKit
engineers engaged; **2024-11-12: "We've still been unable to reproduce this issue on our end."** [P]
Cause unknown. Listed here as a known risk, not a predicted failure.

Three further titles were located but their statuses could not be confirmed (Bugzilla 503):
**229876** "iOS 15 Beta 8 VisualViewport.height does not account for address bar above virtual
keyboard"; **265578** "Visual viewport height updated late when Safari UI is expanded"; **176205**
"On webkit ios there is no way for accounting for virtual keyboard height". [P — titles only]

**Beyond bug 237851, WebKit has never published anything about viewport, keyboard or form behaviour
differing in standalone mode** — verified across the Web Push post (2023-02-16), Safari 16.4, 17.0,
26.0 and 27-beta. [P — verified absence] Everything else circulating on this is community report.

## 4.4 The 16px auto-zoom — the constant is real, and it is in WebKit's source

Apple documents this nowhere. MDN documents it nowhere. It is in the open-source tree.

`Source/WebKit/UIProcess/API/ios/WKWebViewIOS.mm`, `-_zoomToFocusRect:…`, on `main`, read 2026-08-16:
[P] ([WebKit/WebKit](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/API/ios/WKWebViewIOS.mm))

```objc
const double webViewStandardFontSize = 16;
scale = clampTo<double>(webViewStandardFontSize / fontSize, minimumScale, maximumScale);
```

Three things follow that the folklore gets wrong: [P]

1. **It is a ratio, not a threshold.** `scale = clamp(16 / computedFontSize, minimumScale,
   maximumScale)`. Below 16px the ratio exceeds 1 and the page zooms *proportionally*; at or above 16px
   it is ≤ 1 and the lower clamp pins it to 1. A 12px input zooms harder than a 15px one.
2. **`fontSize` is the *computed* size** — `renderer->style()->fontDescription().computedSize()`
   (`WebProcess/WebPage/ios/WebPageIOS.mm`). Inherited and `rem`-derived sizes count. [P]
3. **iPad does not do it.** The call site gates on
   `PAL::currentUserInterfaceIdiomIsSmallScreen()`, so focus auto-zoom is iPhone-class only. [P]

The introduction date of `webViewStandardFontSize = 16` is untraceable — `git blame` reaches only a
2019-12-14 file move. [P — flagged]

**The `user-scalable=no` / `maximum-scale=1` story is more subtle than "iOS ignores it".**

MDN says, on `user-scalable`, `maximum-scale` and `minimum-scale` alike: *"**Browser settings can ignore
this rule, and iOS10+ ignores it by default.**"* [P] The API behind that is
[`WKWebViewConfiguration.ignoresViewportScaleLimits`](https://developer.apple.com/documentation/webkit/wkwebviewconfiguration/ignoresviewportscalelimits),
**introduced iOS 10.0** — *"When set to `true`, this property overrides the `user-scalable` HTML
property in a webpage, and lets the web view scale its webpage content regardless of the author's
intent."* [P] WebKit's implementation is `ViewportConfiguration::allowsUserScaling()` returning true
when `m_forceAlwaysUserScalable`, with a forced maximum of 5; origin commits 2015-03-26 (bug 143032)
and 2016-03-08 (bug 155056, wiring it to the accessibility setting). [P]

**But the pinch-zoom override does *not* re-enable focus auto-zoom.** WebKit comment at
`-_zoomToRevealFocusedElement`, verbatim: *"In case user scaling is force enabled, do not use that
scaling when zooming in with an input field. Zooming above the page's default scale factor should only
happen when the user performs it."* Dedicated accessors —
`allowsUserScalingIgnoringAlwaysScalable()`, `maximumScaleIgnoringAlwaysScalable()` — exist for exactly
this split. [P]

**So the old workaround still works for the thing it was used for, and the accessibility objection to
it still stands:** [P for the code paths, [I] for the user-visible outcome]

| Declaration | Focus auto-zoom | Pinch-zoom |
|---|---|---|
| `user-scalable=no` | suppressed (`allowScaling` false ⇒ `scale = currentScale`) | **still works** (force-enabled) |
| `maximum-scale=1` | suppressed (`clamp(16/fontSize, min, 1) = 1`) | **still works** (force-enabled) |
| neither, input ≥ 16px | none — the ratio is ≤ 1 | works |

WCAG 2.2 SC 1.4.4 requires text resizable to 200% (AA). [P]
([W3C, updated 2026-07-12](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)) MDN's
warning: *"Disabling zooming capabilities by setting `user-scalable` to a value of `no` prevents people
experiencing low vision conditions from being able to read and understand page content. Additionally,
**WCAG requires a minimum of 2× scaling; however, the best practice is to enable a 5× zoom.**"* [P]
Apple's archived doc adds a side effect: *"Setting `user-scalable` to `no` also prevents a webpage from
scrolling when entering text in an input field."* [P]

**Net: the zero-cost route is a computed `font-size` of at least 16px on every input** — no viewport
declaration, no accessibility trade, no zoom on focus. The pt-BR-vs-English density constraint on the
Train page's set rows meets a hard 16px floor here. [P for the mechanism, [I] for the design collision]

**Not confirmed:** whether shipping Safari.app itself sets the force-scalable preference. Safari is
closed source; only the `WKWebView` API and the accessibility pref are documented. [flagged]

## 4.5 Focus and scroll-into-view

- **The default is that focusing scrolls.** MDN `HTMLElement.focus()`: *"A value of `false` for
  `preventScroll` (the default) means that the browser will scroll the element into view after focusing
  it."* [P]
- **iOS additionally *forces* a scroll when the form accessory bar is present.** WebKit's
  `-_zoomToRevealFocusedElement` passes `forceScroll:[self requiresAccessoryView]` into
  `_zoomToFocusRect:…`. [P — WebKit source, read 2026-08-16]
- **`scroll-margin` is the documented lever for a fixed header.** MDN on `scrollIntoView()`: *"By
  default, the element is aligned to the top (or bottom) edge of the scrollable ancestor. To define a
  custom spacing, use `scroll-margin-top` or `scroll-margin-bottom`. This is often useful when there's a
  fixed header on the page."* `scroll-margin` is Baseline widely available since **July 2021**. [P]
- **The HTML Standard's focusing steps say nothing about virtual keyboards.** [P — verified absence]
  Every keyboard-avoidance behaviour is UA-specific.

## 4.6 Getting the right keypad for weight / reps / RPE

`inputmode`: Chrome 66 (2018-04-17), **Safari 12.1 / iOS Safari 12.2 (2019-03-25)**, Firefox 95. BCD
note: *"Before iOS 13, `inputmode="none"` had no effect."* Baseline widely available since December
2021. [P]

`enterkeyhint` (`enter, done, go, next, previous, search, send`): Chrome 77, **Safari 13.1 / iOS Safari
13.4 (2020-03-24)**, Firefox 94. [P]

**BCD does not break out per-value support for `inputmode`** [P — absence], but WebKit's source settles
the iOS mapping, `WKContentViewInteraction.mm` (~L7437–7492), read 2026-08-16: [P]

| `inputmode` | iOS keyboard |
|---|---|
| `numeric` | `UIKeyboardTypeNumberPad` — **digits only** |
| `decimal` | `UIKeyboardTypeDecimalPad` — digits **+ the locale's decimal separator** |
| `tel` | `UIKeyboardTypePhonePad` |
| `search` | `UIKeyboardTypeWebSearch` |
| `url` / `email` | `UIKeyboardTypeURL` / `UIKeyboardTypeEmailAddress` |
| *(none)*, on `<input type="number">` | **`UIKeyboardTypeNumbersAndPunctuation`** — the full punctuation keyboard, not a number pad |

**That last row is the primary-source basis for the widespread `type="text" inputmode="decimal"`
advice.** [P] It matters directly for this app: `decimal` is the right value for a weight field taking
`82.5`, and it is **locale-aware** — pt-BR gets a comma, en-US a period — which interacts with
[ADR 0003](../../docs/adr/0003-identity-is-never-a-display-string.md)'s separation of label from
identifier and with the bilingual requirement. RPE and reps want `numeric`. [P for the mapping, [I] for
the application]

`autocomplete`: Safari 6 / iOS Safari 6 (2012). **BCD tracks a single node with no sub-features — there
is no per-token compat data at all** (no `one-time-code`, `new-password`, `webauthn` entries), so
per-token claims cannot be sourced from BCD. [P — negative finding] Apple documents the iOS AutoFill
mapping directly, and notes: *"By default, the system selects a keyboard based on the input element's
`autocomplete` value; however, you can mix the input element's type and autocomplete values to
explicitly define the desired keyboard."* [P]
([Apple](https://developer.apple.com/documentation/security/enabling-password-autofill-on-an-html-input-element))
Only relevant to `login` here.

---

# 5. Gestures

## 5.1 iOS edge swipe-to-go-back in an installed PWA: it exists, it navigates pushState routes, and you cannot turn it off

**It exists in standalone home-screen web apps and it traverses the client-side history stack.** [B for
the version attribution, [P] for the behaviour's existence]

- iOS 11.3–11.4.1 had **no** gesture — Apple Developer Forums
  [thread 99579](https://developer.apple.com/forums/thread/99579), April–August 2018, no Apple reply.
  [B]
- **iOS 12.2 added it.** Maximiliano Firtman, 2019-03-26: *"Progressive Web Apps now have the
  navigation gestures enabled, similar to Safari. **It works for every URL within your scope, including
  client-side routes** and it's mostly useful for the back action as there is no back button on the
  screen while in standalone mode."* [B — this is the only dated attribution found, and the source most
  other write-ups trace back to]
- Corroborated on a W3C tracker: w3c/manifest [#1041](https://github.com/w3c/manifest/issues/1041),
  2022-06-08, by the Ionic framework lead: *"On platforms such as iOS, web apps installed to the home
  screen have swipe gestures that allow users to navigate back and forth between pages."* [P — W3C
  issue tracker, non-vendor participant]
- Still present and still double-animating in 2024–2025: Ionic
  [#29733](https://github.com/ionic-team/ionic-framework/issues/29733) (2024-07-25), duplicate of
  [#22299](https://github.com/ionic-team/ionic-framework/issues/22299) (2020-10-12), which Ionic
  labelled `bug: external` — i.e. WebKit's, not theirs. [B]

**No Apple or WebKit primary source mentions navigation gestures in home-screen web apps at all.**
Searched the Safari 13 and 26.0 feature posts, the Web Push for Web Apps post, and WWDC23 session
10120. [P — absence confirmed]

**The interaction that bites is the double animation.** w3c/pointerevents
[#358](https://github.com/w3c/pointerevents/issues/358), 2024-03-12: *"the user drags from the left,
Safari animates it, the `popstate` event triggers and my webapp animates the navigation again. It's a
very jarring experience."* [P] This is the same defect as TanStack Router
[#6754](https://github.com/TanStack/router/issues/6754) in §1.9, seen from the platform side.

**You cannot opt out. This is a stated WebKit position, not an oversight.** w3c/pointerevents
[#295](https://github.com/w3c/pointerevents/issues/295), "Set touch-action to allow web pages opt out
Android back gesture", 2019-08-21 — **@graouts (Antoine Quint, WebKit)**: *"I don't think we'd be
interested in this, application-level gestures should always be respected in my opinion."* Closed
2020-11-11. [P — vendor position]

The successor requests are open and unanswered: [P]

| Request | Opened | State |
|---|---|---|
| w3c/pointerevents [#358](https://github.com/w3c/pointerevents/issues/358) — `touch-action` to disable webview swipe-back | 2021-03-30 | **open**, labelled `v4` (deferred to Pointer Events L4), last activity 2024-03-12, 14 comments, **no WebKit response** |
| w3c/manifest [#1041](https://github.com/w3c/manifest/issues/1041) — manifest option to disable built-in navigation gestures | 2022-06-08 | **open**, 16 comments, last updated 2025-05-21. Editor @marcoscaceres, 2024-02-15: *"I'm so sorry this fell off our radar."* No resolution since |

#358 names the asymmetry exactly: *"When using webviews like WKWebView directly, developers can disable
this swipe gesture functionality"* — via
[`allowsBackForwardNavigationGestures`](https://developer.apple.com/documentation/webkit/wkwebview/1414995-allowsbackforwardnavigationgestu),
a native-only API [P] — *"but it is not currently possible to do the same with web apps installed to
the home screen."* [P]

**`touch-action: none` does not suppress it.** `touch-action` is specified as controlling *viewport
panning and zooming* only ([Compatibility Standard](https://compat.spec.whatwg.org/#touch-action),
[Pointer Events L3](https://w3c.github.io/pointerevents/)); system edge-swipe navigation is outside its
scope — which is precisely why #295 and #358 exist asking for a new mechanism. [I — no spec sentence
says "touch-action does not affect edge swipe"; the scope argument plus the open requests is the
evidence]

**The circulated `preventDefault` workaround is partial and documented as failing.** The snippet in
#1041 (2025-05-14) listens for `touchstart`, checks `pageX <= 20 || pageX >= innerWidth - 20`, and
calls `preventDefault()`. The immediate reply the same day: it **fails while the page is actively
scrolling, because native behaviour overrides the JS prevention**; the thread calls it *"fundamentally
an iOS/WebKit-level problem that remains unresolved."* [P — issue tracker; the failure mode is a
developer report] It also requires a non-passive listener — see §5.4.

**In-flight and not shipping:** WICG view-transitions
[`default-ua-transitions.md`](https://github.com/WICG/view-transitions/blob/main/default-ua-transitions.md)
proposes a `same-document-ua-transition` at-rule with `disable-atomic` / `disable-swipe`. No
implementation signals, no dates. [P — incubation stage]

**Plainly: on iOS, in an installed PWA, the system edge-swipe back gesture is not suppressible and not
interceptable. Any horizontally-swipeable UI within ~20px of the left screen edge fights the OS and
loses.**

## 5.2 Android

**Android Chrome reportedly disables the native swipe-back in installed PWAs by default** — asserted in
w3c/manifest#1041 (2025-05-14): *"Android platforms were designed with PWAs in mind and disable native
swipe-back gestures by default, requiring no manifest configuration."* [B — developer assertion on a
[P] tracker; **no developer.chrome.com page states this**]

**Predictive back is a native-host feature with no web-content API.** developer.android.com: introduced
in **Android 13**, behind a developer option in 13 and 14; **from Android 15 the developer option is
gone** and the system animations appear for apps that opted in via `OnBackInvokedCallback` /
`OnBackPressedCallback`. The page's only WebView reference is a codelab. [P]
([Predictive back gesture](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture))
**There is no web API to participate in predictive back.** [P — absence]

Chrome ships its own animated back/forward session-history transition on Android built on bfcache,
reported around Chrome 138 (2025); Chrome's predictive-back support *"does not include showing a
preview of the last web page visited"*. [B — press only; no chromestatus or developer.chrome.com entry
found; `developer.chrome.com/docs/android/predictive-back-gesture` 404s] [P — the 404]

**Back from the root closing the installed app** is widely relied on but **unconfirmed against a
primary source** — only issue threads. [B]

## 5.3 The Navigation API

The modern way to own back/forward in an SPA: `navigation.addEventListener('navigate')` fires *"for all
types of navigation — link clicks, form submissions, back-forward buttons, and programmatic changes"*,
with `NavigateEvent.intercept({handler})`, `canIntercept`, `scroll()`, and `committed`/`finished`
promises. [P] ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API))

Support: Chrome/Edge **102**, Samsung 19, **Safari and iOS Safari 26.2 (2025-12-12)**, Firefox 147. [P]
WebKit's own announcement: *"a modern replacement for the History API … you couldn't intercept link
clicks or form submissions, the `popstate` event only fired for back-forward navigation."* [P]
Safari 26.3 added an `AbortSignal` on `NavigateEvent`. [P]

**Practically: the Navigation API is only ~8 months old on iOS.** Anything built on it excludes every
iPhone below iOS 26.2. `PopStateEvent.hasUAVisualTransition` (iOS 18.0+) is the lower-floor alternative
for the one thing this app needs it for. [P]

## 5.4 Building your own gestures — sheets and drawers

**`touch-action`.** Values: `auto | none | [[pan-x|pan-left|pan-right] || [pan-y|pan-up|pan-down] ||
pinch-zoom] | manipulation`. Support: Chrome 36, Firefox 52, **iOS Safari partial 9.3–12.5, full from
iOS 13**. (Desktop Safari lists "no" — expected; macOS has no touch input path, not an iOS gap.) [P]

**`pointercancel` is the documented hazard for JS drag.** MDN: it fires when *"the browser determines
that there are unlikely to be any more pointer events, or **if after the `pointerdown` event is fired,
the pointer is then used to manipulate the viewport by panning, zooming, or scrolling.**"* Enumerated
causes include the app-switcher/home button, orientation change, palm rejection, *"The `touch-action`
CSS property prevents the input from continuing"*, and too many simultaneous pointers. [P]
([MDN `pointercancel`](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event))
**Consequence: a drag started on an element that has not opted out via `touch-action` is cancelled the
moment the UA claims the gesture for scrolling.** `touch-action: none` (or `pan-y`) on the drag handle
is the documented way to keep the pointer stream alive. [P] Pointer Events themselves: Safari 13
desktop, **iOS Safari partial 13, full 13.2**. [P]

**Passive listeners differ between iOS and Android — and Safari is the outlier.** MDN, verbatim:
*"If this option is not specified it defaults to `false` – **except that in browsers other than Safari,
it defaults to `true` for `wheel`, `mousewheel`, `touchstart` and `touchmove` events**"*, on `Window`,
`Document` and `Document.body`. And: *"If a passive listener calls `preventDefault()`, nothing will
happen and a console warning may be generated."* [P] Chrome's intervention landed in **Chrome 56
(2017-01-10)**: *"if the target of a touchstart or touchmove listener is the `window`, `document` or
`body` we default `passive` to `true`"*; *"calls to `preventDefault()` inside the listener will be
ignored."* [P] ([developer.chrome.com/blog/scrolling-intervention](https://developer.chrome.com/blog/scrolling-intervention))
**So a document-level `touchstart` listener calling `preventDefault()` behaves differently on iOS
Safari than on Chrome.** MDN gives no Safari version numbers for the carve-out. [P — absence] You must
pass `{ passive: false }` explicitly, forfeiting the scroll-performance optimisation.

**The CSS route to a sheet, with dates:**

| Mechanism | iOS floor | Other |
|---|---|---|
| `overscroll-behavior: contain` on the sheet's scroller (stops chaining, keeps bounce) | **16.0** (2022-09-12), still partial — §2.1 | Chrome 63 |
| CSS Scroll Snap (`scroll-snap-type`, `scroll-snap-align`, `scroll-snap-stop: always`) | **11** | Chrome 69, Firefox 68 |
| `<dialog>` + `showModal()` + `::backdrop` — makes everything outside **inert automatically**, adds `aria-modal="true"`, Esc closes | Baseline widely available **March 2022** | `closedby` (`any` light-dismiss / `closerequest` / `none`) is much newer; its own support not verified here |
| Popover API (`popover` attribute, `showPopover()`, `popovertarget`) | **17.0** (2023-09-18) | Chrome 114, Firefox 125 |
| CSS Anchor Positioning | **26.0** (2025-09-15) | Chrome/Edge 125, Firefox 147 |
| **Scroll-driven animations** (`animation-timeline: scroll()` / `view()`) | **26.0** (2025-09-15) | Chrome/Edge 115, Firefox 156 |
| CSS `interactivity: inert` | **none** — Experimental, Limited availability, **not Baseline** | do not depend on it |

[P] for all of the above.

**Scroll-driven animations are the JS-free route to a gesture-driven sheet** — a scroll container as
the drag surface with a scroll timeline. WebKit, 2025-09-15: *"Scroll-driven animations lets you tie
CSS animations to either the timeline of just how far the user has scrolled, or to how far particular
content has moved through the viewport."* [P] **The iOS floor is 26.0, September 2025** — eleven months
old. [P] Scroll-snap *events* (`scrollsnapchange`, `scrollsnapchanging`) have no Safari version
recorded. [P — absence]

**A conflict to resolve on device:** MDN says `overscroll-behavior: contain` *"disables native browser
navigation, including … horizontal swipe navigation"* [P], but the open W3C issues in §5.1 say iOS
edge-swipe cannot be disabled at all. The two are in apparent conflict; the likeliest reading is that
MDN describes Chromium's *overscroll-triggered* navigation, not iOS's system edge gesture. [I]

## 5.5 Long-press

**There is no standard long-press API.** Feature requests exist in both the W3C Touch Events (2021-02)
and Pointer Events (2026 Q1) mailing lists; neither is specced. [P — mailing-list archives]

**`contextmenu` does not fire on long-press on iOS Safari 13+.** mdn/browser-compat-data
[#6376](https://github.com/mdn/browser-compat-data/issues/6376): *"The `contextmenu` event isn't
supported on iOS 13 and later and needs a lot of quirky hacks with a custom `setTimeout()` callback."*
Long-press shows the native magnifier/callout instead, and `user-select: none` does not restore the
event. **Closed via PR #11765, i.e. BCD was updated to record the lack of support.** [P] MDN's
`contextmenu` page says nothing about touch at all. [P — absence]

**So long-press must be implemented by hand** — a `pointerdown` timer, cancelled on `pointermove`
beyond a threshold or on `pointercancel` — and it competes with the OS callout unless suppressed
(§7.1). [I]

---

# 6. Haptics

## 6.1 `navigator.vibrate` does not exist on iOS, and Apple has said it will not

BCD, fetched 2026-08-16 — `api.Navigator.vibrate`: [P]

| Browser | `version_added` |
|---|---|
| Chrome | **32** (2014-01-14). Note: *"Beginning in Chrome 60, this method requires a user gesture. Otherwise it returns false."* |
| Chrome Android | **32** (2014-01-15), same gesture requirement from 55 |
| Edge | 79 |
| WebView Android | 4.4.3 |
| Samsung Internet | 2.0 |
| Firefox | 16 → **removed in 129** |
| Firefox Android | partial from 79 — *"Vibration is disabled. If the window is visible, `navigator.vibrate()` returns true, but no vibration takes place."* |
| **Safari** | **`false`** |
| **Safari iOS** | **`false`** |
| **WebView iOS** | **`false`** |

**This is a stated position, not a backlog item.** WebKit standards-positions
[issue #267, "Vibration API (Second Edition)"](https://github.com/WebKit/standards-positions/issues/267)
— opened 2023-10-14, **closed 2023-11-14**, labelled **`position: oppose`** plus `concerns: annoyance`,
`device independence`, `integration`, `portability`, `power`, `use cases`. [P]

Marcos Cáceres (Apple), 2023-11-01, verbatim: *"Discussed with colleagues internally and they also
pointed out that **it wouldn't even be possible to support this API on Apple's native platforms**
(concern: integration)… we will be labeling this as 'opposed' within a week or so."* [P] Reconsideration
requests on 2025-10-31 and 2025-11-01 received **no WebKit response**; the oppose position stands. [P]

**The spec itself now records this.** W3C Vibration API, **Candidate Recommendation Draft, 2026-05-21**
— status section, verbatim: *"This specification is implemented in Chromium-based browsers. **WebKit has
published a position opposing this specification.** Firefox removed its implementation in version 129.
**It is not expected to advance to W3C Recommendation in its current form.**"* [P]
([W3C](https://www.w3.org/TR/vibration/))

WebKit [bug 72010](https://bugs.webkit.org/show_bug.cgi?id=72010), "Support for Vibration API", is
**RESOLVED FIXED** — created 2011-11-10, last changed 2012-04-19. That predates the Blink fork and
never reached Safari or iOS; BCD still shows `false` for both. [P for the bug record; that the fix was
for a non-Apple WebKit port is [I]]

**Interop 2026 does not include the Vibration API.** [P]

**Plainly: `navigator.vibrate` is unavailable on iOS Safari, in-browser and installed; Apple has
formally opposed the specification; and the spec itself says it is not expected to advance. There is no
timeline and no signal of one.** [P]

**On Android Chrome it works, in-browser and installed.** Constraints: [P]

- **Sticky user activation required since Chrome 60** — chromestatus: *"Calls to navigator.vibrate will
  immediately return 'false' if user hasn't tapped on the frame or any embedded frame yet."*
  ([5644273861001216](https://chromestatus.com/feature/5644273861001216)) It is **sticky, not
  per-call**: the CL notes it *"continues to be effective if a frame (or any of its subframes) has ever
  seen user action."* So one tap anywhere unlocks it for the session — a mid-set tick qualifies.
- Blocked in cross-origin iframes since Chrome 55.
- Spec backstops that apply in a PWA too: *"If the document's visibility state is not `visible`, then
  return false"*, and a running pattern **MUST** abort on visibility change — so it cannot fire from a
  backgrounded queued write. [P]
- MDN: *"Some devices may not vibrate if they are in Silent mode or Do Not Disturb (DND) mode."* [P]

An open Chromium issue titled *"navigator.vibrate requires user gesture even in PWAs"*
([41361876](https://issues.chromium.org/issues/41361876)) exists; its contents were not readable
(tracker requires auth). [P — title only]

## 6.2 The one sanctioned haptic on iOS — and the hack that Apple closed in May 2026

**WebKit shipped a real haptic, tied to one specific control.**

- `<input type="checkbox" switch>` shipped in **Safari 17.4, 2024-03-05** — iOS/iPadOS 17.4, macOS
  Sonoma 14.4, visionOS 1.1. Uses the ARIA `switch` role, `accent-color` styles the on-state, and
  unsupported browsers fall back to a plain checkbox. [P]
  ([An HTML Switch Control](https://webkit.org/blog/15054/an-html-switch-control/),
  [Safari 17.4 features](https://webkit.org/blog/15063/webkit-features-in-safari-17-4/))
  **Neither 17.4 post mentions haptics.** [P — verified absence]
- **The haptic came in Safari 18.0, 2024-09-16**, verbatim: *"WebKit for Safari on iOS 18 adds haptic
  feedback for `<input type=checkbox switch>`. This means, now when a user taps a switch control on
  iPhone, a single tap is felt — just like how toggling a switch feels in Settings app on iOS."* [P]
  ([Safari 18.0](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/); first flagged in the
  WWDC24 beta post, 2024-06-10)
- Implementation: `PageClientImplIOS::performSwitchHapticFeedback`, gated on
  `HAVE(UI_IMPACT_FEEDBACK_GENERATOR)` — UIKit's `UIImpactFeedbackGenerator`. Commit `de5133f289`,
  2023-12-08, bug 266066; extended to click by `a81bf20129`, 2024-03-27, bug 271711. [P]

**So there is exactly one sanctioned haptic on iOS: a finger physically toggling a real
`<input type="checkbox" switch>`.** [P]

### The `<label>` trick, and the two commits that killed it

Libraries (`use-haptic` 2024-09-19, Ionic [#29942](https://github.com/ionic-team/ionic-framework/issues/29942)
2024-10-16, `ios-haptics` 2025-06-03, `web-haptics` 2026-02-25) fired the haptic from script by
associating a hidden switch with a `<label>` and calling `.click()` on the label — or by overlaying an
invisible real switch on the target. Ionic #29942, verbatim: *"To trigger haptic feedback programatically
we need an `<input type=checkbox switch>` element with an associated `<label>` element. With this setup,
when we programatically trigger `click()` on the label, safari will emit the haptic feedback."* [P —
issue tracker]

WebKit closed it in two steps, both **undocumented — no blog post, no Safari release note, no Apple
release note.** [P — verified absence]

1. **User activation, commit `dfb3971bb0` / `288403@main`, 2025-01-03**, Aditya Keerthi,
   [bug 285120](https://bugs.webkit.org/show_bug.cgi?id=285120): *"Haptic feedback for
   `<input type=checkbox switch>` should require user activation… it should not be possible to generate
   haptic feedback from script alone."* **This did not kill the trick** — a tap supplies activation. [P]
2. **Trusted events, commit `fc1ef83eae` / `313638@main`,
   [bug 309082](https://bugs.webkit.org/show_bug.cgi?id=309082)**, rdar://171635705, same author,
   verbatim: *"288403@main ensured that haptic feedback … required user activation. However, it is also
   desired that haptics are only triggered for **trusted** events. This goal can currently be bypassed
   by calling `click()` on a label associated with the input… The underlying issue is that untrusted
   click events on label elements become trusted click events on the associated control… Fix by
   specifying `SimulatedClickSource::Bindings` if there is an underlying event and it is untrusted."*
   **Landed on the Safari release branch 2026-03-04 — within about a day of the trick going viral —
   and merged to `main` 2026-05-21.** [P]

**Which release contains it: Safari / iOS 26.5, released 2026-05-11.** Derived by branch-containment
against Apple's version table (26.4 = 20624.1.16, 2026-03-24; **26.5 = 20624.2.5, 2026-05-11**;
26.6 = 20624.4.5, 2026-07-27). [P for the commits and dates; the branch→version mapping is light [I]]

**Current state, August 2026:** [P for the commits, [B] for on-device confirmation]

| | Fires a haptic on iOS 26.5+ |
|---|---|
| Finger taps a real, natively-rendered `<input type=checkbox switch>` | **yes** |
| `label.click()`, `input.click()`, any dispatched/synthetic event | **no** |
| Invisible real switch overlaid on a button, tapped by the finger | **yes** — this is the surviving pattern |

On-device confirmation for the surviving pattern is community-sourced
([project-fathom](https://github.com/m1ckc3s/project-fathom), *"Verified on a physical iPhone running
iOS 26.5"*) [B], but it matches the commit exactly. **Verify on the athlete's phone before designing
around it.**

**A side effect worth knowing before adopting the switch control:** WebKit
[bug 321591](https://bugs.webkit.org/show_bug.cgi?id=321591) — *"[iOS] `<input type=checkbox switch>`
prevents scrolling and toggles when the touch is released anywhere"* — **NEW, 2026-08-12**, four days
before this research ran. [P] For a control in a scrolling list of tasks, that is the wrong failure.

**Not confirmed:** whether `appearance: none` suppresses the haptic.
`CheckboxInputType::performSwitchAnimation` early-returns when `!style().hasUsedAppearance()`, but the
`performSwitchHapticFeedback()` call inside `performSwitchVisuallyOnAnimation` is not itself
appearance-gated. [flagged] **This is the question that decides whether a haptic tick can also look
like the redesign.**

**Not confirmed:** whether the switch haptic behaves identically in standalone. The code lives in
WebKit's UIProcess (`PageClientImplIOS`), shared by Safari, standalone web apps and `WKWebView`, so
identical behaviour is reasonable — but no primary source and no credible on-device test was found.
[I]

### Everything else is a dead end on iOS

- **Gamepad haptics.** `GamepadHapticActuator`, `playEffect()`, `Gamepad.vibrationActuator` — BCD:
  **Safari iOS `false` for all of them**; `Gamepad.hapticActuators` false in Safari everywhere. (BCD
  says Safari desktop 16.4 for `vibrationActuator`; WebKit's own Safari 17.0 post announces it —
  **the two primary sources disagree**, and it is moot for iOS either way.) It drives a connected
  gamepad's motors, not the Taptic Engine. WebKit
  [bug 217678](https://bugs.webkit.org/show_bug.cgi?id=217678) "Support GamepadHapticActuator (gamepad
  rumble)" is **NEW**, last changed 2020-12-07. [P]
- **Web Audio, notifications, or anything else producing haptics on iOS: no primary source exists.**
  The Taptic Engine is not exposed to web content by any documented API. The only WebKit path is the
  internal, non-scriptable `UIImpactFeedbackGenerator` call behind the switch — **no Core Haptics, no
  waveforms, no intensity, no duration.** [P — WebKit source + verified absence] The closest Apple-side
  text is a non-committal 2021 developer-forum reply asking the developer to file feedback, never
  followed up. [P]
  ([forums thread 689625](https://developer.apple.com/forums/thread/689625))
- **The W3C "Haptic Interaction on the Web" Community Group closed 2023-04-07.** [P]
  ([w3.org](https://www.w3.org/community/webhaptics/))
- **WebKit release notes for 2025–2026 contain zero mentions of "haptic", "vibration" or "Taptic"** —
  verified across Safari 18.2, 18.4, 18.5, 18.6, the WWDC25 and WWDC26 beta posts, and 26.0 through
  26.6, plus Apple's own Safari release notes for 26.0–26.6. **Nothing since the Safari 18.0 post of
  2024-09-16.** [P — verified absence]

### What that means for ticking a task mid-set

The ticket names this as the interaction that would want a haptic. On iOS it is available **only if the
tick control is a real `<input type="checkbox" switch>` that the athlete's finger toggles directly.**
[P] A `<button>`, a `role="checkbox"` div, or a confirmation fired after a queued write completes gets
nothing. [P] Two open questions gate it: whether `appearance: none` kills the haptic (i.e. whether the
control can be styled to match the redesign at all), and whether bug 321591's scroll-blocking makes a
switch unusable inside a scrolling task list. Both are device-testable in minutes. [I]

On Android the same tick can call `navigator.vibrate()` freely once any tap has occurred. **The haptic
vocabulary is therefore not portable**: iOS constrains the *control's shape*, Android does not. [P + [I]]

---

# 7. The tells

Each row: what it does, where it works, what it costs.

## 7.1 Suppressing iOS's long-press UI

**`-webkit-touch-callout: none`** — MDN: *"controls the display of the default callout shown when you
touch and hold a touch target. When a target is touched and held on iOS, Safari displays a callout
information about the link."* Values `default | none`; **inherited**. **Non-standard**, WebKit only.
MDN: *"We do not recommend using non-standard features in production."* [P]
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-touch-callout), and Apple's archived
[Safari CSS Reference](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariCSSRef/Articles/StandardCSSProperties.html))

**Cost:** kills "Copy Link", "Save Image", and the link preview — real affordances the athlete may want
on `/studies` links.

**⚠️ Possibly broken on current iOS.** Apple Developer Forums
[thread 808606](https://developer.apple.com/forums/thread/808606), **November 2025**: `-webkit-touch-callout: none`
not suppressing the context menu on **iOS 26.1**, applied to `html, body` with `!important`. **Zero
replies, no Apple response.** [B — single report, unconfirmed, but directly on point]

**Whether it behaves differently in an installed standalone PWA: no source either way.** [P — absence]

## 7.2 Text selection

**`user-select: none` / `-webkit-user-select: none`** — values `none | auto | text | all | contain`
(`contain` unimplemented). **Status: Limited availability / not Baseline**; Safari needs the
`-webkit-` prefix. Spec says not inherited, but MDN notes *"WebKit/Chromium-based browsers implement
this as inherited, which technically violates the spec"* — so applying it high in the tree cascades
further than you expect on exactly the platform you care about. [P]
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/user-select))

**Cost:** MDN, on `none`: *"The `Selection` object can still contain these elements, and text can be
selected programmatically."* So it removes the *user's* copy affordance without protecting anything.
The athlete loses the ability to select and copy a weight, a date, a study title. Native iOS text views
are selectable on long-press; suppressing selection is arguably *less* native, not more. [P for the
quote, [I] for the framing] I found no primary source tying `user-select: none` to screen-reader
failures — the citable cost is loss of copy, not AT breakage. [P — absence]

**`::selection`** — only `color`, `background-color`, `text-decoration` and related, `text-shadow`, and
the `-webkit-text-stroke/fill` properties apply; `background-image` is ignored. **Limited availability /
not Baseline**; Firefox needs `::-moz-selection`. MDN's cost note: keep **4.5:1** contrast (3:1 large
text). [P]

## 7.3 Tap feedback

**`-webkit-tap-highlight-color: transparent`** — MDN, verbatim: *"sets the color of the highlight that
appears over a link while it's being tapped. **The highlighting indicates to the user that their tap is
being successfully recognized, and indicates which element they're tapping on.**"* **Non-standard**,
WebKit/Blink only (Safari, Chrome, Edge, Opera). MDN's compat table did not render exact versions for
either agent. [P for the definition; versions unconfirmed] [P]

**Cost is stated in MDN's own description:** setting it transparent removes the *only* built-in signal
that a tap registered. Unless it is replaced with explicit `:active` styling, every tap becomes silent
— which on a phone used one-handed mid-set with chalky hands is a functional regression, not a cosmetic
one. [P + [I]]

## 7.4 Double-tap zoom

**`touch-action: manipulation` is the only thing that works on iOS in 2026.** MDN, verbatim: *"Enable
panning and pinch zoom gestures, but disable additional non-standard gestures such as double-tap to
zoom. **Disabling double-tap to zoom removes the need for browsers to delay the generation of click
events when the user taps the screen.** This is an alias for `pan-x pan-y pinch-zoom`."* Baseline widely
available since September 2019. [P]

**`user-scalable=no` and `maximum-scale=1` are ignored by iOS 10+** (§4.4) — a no-op on iOS and an
accessibility violation everywhere else (WCAG SC 1.4.4). [P]

**So the tell is removable at zero accessibility cost on this one:** `touch-action: manipulation`
preserves pinch-zoom while killing double-tap zoom and the ~300ms click delay. [P]

## 7.5 Focus rings

**`:focus-visible`** — MDN, verbatim: *"The `:focus` pseudo-class always matches the currently-focused
element. The `:focus-visible` pseudo-class also matches the focused element, but only if the user needs
to be informed where the focus currently is."* Support: Chrome/Edge 86, **Safari and iOS Safari 15.4
(2022-03-14)**, Firefox 4. Baseline widely available March 2022. Shipped in WebKit by Igalia, not
Apple. [P]

**MDN's accessibility note, verbatim:** *"Changing focus style can decrease usability, while removing
focus styles makes keyboard navigation inaccessible for sighted users."* [P]

**Cost:** `outline: none` on `:focus` removes the indicator for keyboard users (WCAG 2.4.7). Scoping
suppression to `:focus:not(:focus-visible)` keeps the keyboard ring while removing the ring after a tap
— which is the "app-like" half without the accessibility half. [I — MDN does not spell out this
selector]

## 7.6 The remainder

| Property | What it does | Support | Cost |
|---|---|---|---|
| `-webkit-user-drag` | Makes an element draggable or explicitly not (links, images). **MDN page 404s at both URL shapes** — caniuse is the only structured source. | Chrome 4+, Safari 3.1+, **iOS Safari 3.2+**, Edge 79+; Firefox never | Non-standard; `none` works, `element` reportedly has no effect. HTML `draggable` is the standard alternative |
| `caret-color` | Insertion-caret colour; `auto | <color> | transparent`. Applies in text `<input>`s, `<textarea>`, `contenteditable` | Baseline widely available **January 2020** | `transparent` hides the caret — the user loses the insertion point in a set-entry field |
| `text-size-adjust` / `-webkit-text-size-adjust` | Controls the mobile **text inflation algorithm** (mobile browsers lay out at a wide viewport and enlarge small text). `none | auto | <percentage>` | **Limited availability / not Baseline**; `-webkit-` prefix for Safari/iOS; exact versions unrecorded | MDN: *"Websites designed with small screens in mind don't require this property."* On a responsive layout usually a no-op; `none` can suppress legitimate enlargement |

[P] for all rows except the noted absences.

## 7.7 Scoping the tells so they only apply where they belong

- **`@media (display-mode: standalone)`** — matches when the manifest `display` is `standalone` **and
  the UA supports and activated that mode**. Full value list: `browser | standalone | minimal-ui |
  fullscreen | window-controls-overlay | picture-in-picture`. Spec:
  [Media Queries L5](https://drafts.csswg.org/mediaqueries-5/#display-modes). Baseline widely available
  January 2020; **iOS Safari 12.2**. [P]
- **`@media (pointer: coarse)`** — tests the **primary** pointing device; `coarse` = *"a pointing
  device of limited accuracy, such as a finger on a touchscreen"*. Use `any-pointer` to test *any*
  device. Baseline widely available December 2018. [P]
- **`@media (hover: none)`** — `none` = *"The primary input mechanism cannot hover at all or cannot
  conveniently hover"*, explicitly including *"most mobile devices (which emulate hovering through
  inconvenient long taps)"*. Baseline widely available December 2018. [P]

Combining `(display-mode: standalone) and (pointer: coarse)` scopes the suppressions to the
installed-on-phone case and leaves the browser tab and the desktop layout with normal web affordances —
which is where the accessibility costs above mostly land. [I — no source recommends this combination]

---

# Appendix A — the PWA build itself is an open upstream problem

Not one of the seven areas, but it gates all of them, because none of this is testable until the
service worker builds.

**[TanStack Router #4988](https://github.com/TanStack/router/issues/4988), "vite-plugin-pwa
incompatible with tanstack start production builds" — open since 2025-08-17, 22 comments.** [P]
The cause: *"vite-plugin-pwa's Vite Environment API support is still open in
[vite-pwa/vite-plugin-pwa#786](https://github.com/vite-pwa/vite-plugin-pwa/pull/786). Its current build
plugin runs service-worker generation from a non-SSR `closeBundle` hook rather than selecting the Start
client environment."* — maintainer comment, 2026-07-15, keeping it open *"as an upstream integration
issue"*. [P]

A working SPA-mode configuration is documented in-thread (2026-05-09, Start ^1.167, vite-plugin-pwa
^1.3.0) and matches this app's shape exactly: [P — issue comment, [B] as engineering advice]

- `VitePWA({ integration: { closeBundleOrder: 'pre' } })` — must run before Nitro collects public
  assets, or *"the PWA build steps never execute"*.
- `outDir: '.output/public'` — Nitro serves from there, not `dist/`.
- `workbox.navigateFallback: '/_shell.html'`, with
  `navigateFallbackDenylist: [/^\/api\//, /^\/_serverFn\//]`.
- **`_shell.html` must be added via `additionalManifestEntries`, not `globPatterns`** — *"`_shell.html`
  is created by Nitro after VitePWA has already run its glob"*; without it Workbox throws
  `non-precached-url` at runtime.
- Register the SW in `src/client.tsx`, which is client-only by construction.

Also relevant to testing any of this: **PWAs require HTTPS**, so device testing needs a tunnel. [P]

And [#6455](https://github.com/TanStack/router/issues/6455) — **open**, "Hydration error on direct
navigation to non-root routes in SPA mode" (Cloudflare `not_found_handling: single-page-application`,
Start 1.154.8) — the same class of bug the Vercel rewrite-to-`/_shell.html` config could hit. [P]

---

# Appendix B — what is impossible on iOS, stated plainly

No hedging on these.

1. **`navigator.vibrate` does not exist.** Apple has formally *opposed* the specification and stated it
   *"wouldn't even be possible to support this API on Apple's native platforms"*; the W3C CR Draft
   (2026-05-21) records that it *"is not expected to advance to W3C Recommendation in its current
   form."* The only haptic reachable on iOS is a finger toggling a real
   `<input type=checkbox switch>` — the script-driven version was closed in **iOS 26.5**. [P]
2. **`interactive-widget` does not exist.** There is no way to make the iOS software keyboard resize
   the layout viewport. WebKit bug 259770 is NEW since 2023-08-03, and WebKit has never even answered
   the standards-position request Google filed in 2022. `visualViewport` observation is the only tool.
   [P]
3. **The VirtualKeyboard API and `env(keyboard-inset-*)` do not exist.** Chromium-only; WebKit bug
   230225 NEW since 2021-09-13. [P]
4. **Viewport units do not respond to the keyboard — on any platform.** CSS Values 4 puts on-screen
   keyboards in the class of interfaces that *"have no effect on any of the viewport-percentage
   lengths."* `dvh` does not help a form; in standalone it does not help at all, because there is no
   URL bar for it to track. [P]
5. **The system edge swipe-to-go-back in an installed PWA cannot be disabled or intercepted.** WebKit's
   stated position is that *"application-level gestures should always be respected"*; the W3C requests
   for an opt-out are open and unanswered since 2021 and 2022. [P]
6. **`contextmenu` does not fire on long-press since iOS 13.** Long-press must be hand-rolled. [P]
7. **`user-scalable=no` / `maximum-scale=1` no longer block *pinch* zoom** — force-overridden since
   iOS 10 via `ignoresViewportScaleLimits`. They *do* still suppress focus auto-zoom, by WebKit's
   explicit design. The zero-cost alternative is a computed `font-size` ≥ 16px on inputs. [P]
8. **Scroll anchoring does not exist in shipping iOS** (26.x). It arrives in Safari 27, still beta on
   2026-08-16. [P]
9. **`display_override`, manifest `fullscreen`, and manifest `minimal-ui` are not supported.**
   `standalone` and `browser` only, since iOS 11.3. [P]
10. **`safe-area-max-inset-*` is Chrome-only.** [P — absence in BCD and in every Safari 26.x/27 note
    checked]
11. **Cross-document `@view-transition` never fires for a pushState SPA** — on any platform. [P]
12. **Browser Back/Forward fires no view transition in shipped TanStack Router** unless
    `defaultViewTransition` is on for every navigation — not an iOS limit, a router one, but it lands
    hardest on iOS where Back is a system gesture. [P]
13. Already established elsewhere and restated for completeness: **no Background Sync, no Periodic
    Sync, no Background Fetch, no silent push**; ITP evicts script-writable storage after 7 idle days
    for *uninstalled* PWAs, and home-screen apps are exempt. (See
    [#26](https://github.com/YgorPerez/send-lab/issues/26).)

---

# Appendix C — the open questions, and what would settle each

Ranked by how much a wrong guess costs the redesign.

| # | Question | Why it matters | How to settle |
|---|---|---|---|
| 1 | **Does an installed iOS PWA have a pull-to-refresh *reload* gesture, or only the rubber-band bounce?** No Apple/WebKit source either way; the two best pieces of evidence disagree. | The ticket names this "the single most website-ish behaviour left". Whether it needs suppressing at all is unknown. | Install the current app on the athlete's phone, pull down at the top of Today. |
| 2 | **Does `defaultViewTransition: true` fire a transition on the `_shell.html` → first-route cold start?** [I] from source; no first-load guard found in `runClientTransaction`. | Cold start from the service worker is the app's best moment; a cross-fade from skeleton to content is either a feature or a flash. | Prototype with `defaultViewTransition: true`, hard-launch from the home screen. |
| 2b | **Does WebKit [237851](https://bugs.webkit.org/show_bug.cgi?id=237851) reproduce — `visualViewport.offsetTop` intermittently `0` inside the `resize` handler, in web-app mode only?** NEW since 2022-03-14, never triaged. Two independent reporters, both fixed it by deferring to the next paint. | `visualViewport` is the **only** keyboard tool on iOS (§4.2), and this is the one primary-source case of installed-PWA-specific divergence in the whole document. If it reproduces, every keyboard-avoidance handler needs a double-`rAF`. | Log `offsetTop` synchronously and after a double `rAF` on keyboard open, standalone, repeatedly. |
| 3 | **Does WebKit [320238](https://bugs.webkit.org/show_bug.cgi?id=320238) (view-transition flash over fixed header/footer) reproduce in standalone?** The bug is filed against Safari-the-browser's chrome; standalone has different chrome. | The redesign wants a fixed bottom nav and full-screen route transitions — exactly the reported shape. | Prototype a fixed bottom bar + a `<Link viewTransition>` route change, standalone, on iOS 26.x. |
| 4 | **`svh == lvh == dvh` in standalone?** [I]; WebKit [261185](https://bugs.webkit.org/show_bug.cgi?id=261185) title supports it, body unreadable. | Decides whether every full-height surface can just use `dvh`, or needs the three-unit dance. | Render all three units on screen in standalone. |
| 5 | **Does `appearance: none` suppress the switch haptic?** WebKit's switch *animation* path is appearance-gated; the haptic call nested inside it is not. [flagged] | Decides whether the one haptic available on iOS can be styled to match the redesign, or whether a haptic tick must look like a system switch. | Style a switch with `appearance: none`, tap it on iOS 26.5+. |
| 5b | **Does WebKit [321591](https://bugs.webkit.org/show_bug.cgi?id=321591) — switch blocks scrolling, toggles when the touch is released anywhere — make a switch unusable in a scrolling list?** NEW, filed **2026-08-12**, four days before this ran. | Today's task list *is* a scrolling list of tick controls. | Put switches in a tall scrolling list; start a drag on one and try to scroll. |
| 5c | **Does the overlaid-invisible-switch pattern still fire a haptic on iOS 26.5+?** The two WebKit commits that closed the `label.click()` route are [P]; on-device confirmation of the survivor is [B]. | The only way to attach a haptic to a control that is not itself a switch. | Overlay an invisible real switch on a button; tap it. |
| 5d | **Does the switch haptic behave the same in standalone as in Safari?** [I] — shared UIProcess code, no source either way. | Everything above is about the installed app. | Same tests, standalone. |
| 6 | **Is `-webkit-touch-callout: none` broken on iOS 26.1+?** One unanswered forum report. | Determines whether long-press UI is suppressible at all. | Long-press a link with the property applied. |
| 7 | **What does `@media (display-mode: standalone)` report on iOS 26 for a manifest-less site opened as a web app?** | Every tell in §7 is scoped on this query. | Log `matchMedia('(display-mode: standalone)').matches` in standalone. |
| 8 | **Does Android 15 edge-to-edge enforcement apply to an installed PWA's WebAPK window?** No documentation found. | Decides whether Android needs the safe-area work at all. | Android device test. |
| 9 | **Do gesture-nav and three-button-nav produce different Android insets?** Chrome's guide names both, states neither. | Bottom-bar layout on Android. | Toggle nav mode with insets logged on screen. |

**Further flagged items, lower stakes:**

- Statuses of WebKit bugs **229876**, **265578**, **176205** (visualViewport/keyboard height) — titles
  located, bodies unreadable.
- **BCD and WebKit's own blog disagree** on `Gamepad.vibrationActuator` (BCD says Safari 16.4; the
  Safari 17.0 post announces it). Moot for iOS — `false` there either way.
- Whether shipping Safari.app force-enables user scaling (Safari is closed source).
- Introduction date of `webViewStandardFontSize = 16` — `git blame` reaches only a 2019-12-14 file move.
- `one-time-code` iOS availability version — Apple's page carries no version annotation and BCD tracks
  no `autocomplete` tokens at all.
- Chrome's back/forward page-transition version (~138) — press-only; no chromestatus entry found.
- Chromium issue 41361876 (vibrate in PWAs) — tracker requires auth.
- `navigator.standalone`, the iOS standalone-detection property, **has no MDN page and no BCD entry** —
  it appears only as a non-standard one-liner on MDN's Navigator index. Apple documents it in the
  archive: *"You can determine whether a webpage is displaying in standalone mode using the
  `window.navigator.standalone` read-only Boolean JavaScript property."* [P — archived]
- Whether `@media (display-mode: standalone)` or `navigator.standalone` is the reliable detector on
  iOS 26, given manifest-less web apps.

**Bugzilla note:** bugs.webkit.org returned HTTP 503 on repeated fetches during this run — some bugs
were read via the Bugzilla REST API instead, some only by title. Titles and open-bug-list statuses are
accurate as of the 2026-08-16 query; **re-check individual bug bodies before citing them further.**

---

# Sources

## Specs
- [CSS View Transitions Level 1 (ED)](https://drafts.csswg.org/css-view-transitions-1/)
- [CSS Round Display Level 1 (ED, 2025-12-26)](https://drafts.csswg.org/css-round-display/#viewport-fit-descriptor)
- [CSS Environment Variables Level 1 (ED, 2026-05-28)](https://drafts.csswg.org/css-env/#safe-area-insets)
- [CSS Values and Units Level 4](https://www.w3.org/TR/css-values-4/#viewport-variants) — viewport-percentage units; on-screen keyboards excluded
- [CSS Viewport Module Level 1 (ED 2026-05-28) — `interactive-widget`](https://drafts.csswg.org/css-viewport/#interactive-widget-section)
- [CSSOM View (ED 2026-07-27)](https://drafts.csswg.org/cssom-view/)
- [W3C Vibration API — CR Draft 2026-05-21](https://www.w3.org/TR/vibration/) (status: WebKit opposes; not expected to advance)
- [W3C Web App Manifest — WD 2026-08-13, display modes](https://www.w3.org/TR/appmanifest/#display-modes)
- [WCAG 2.2 Understanding SC 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
- [Media Queries Level 5 — display modes](https://drafts.csswg.org/mediaqueries-5/#display-modes)
- [HTML Standard — scroll restoration mode](https://html.spec.whatwg.org/multipage/browsing-the-web.html#scroll-restoration-mode)
- [Compatibility Standard — `touch-action`](https://compat.spec.whatwg.org/#touch-action) · [Pointer Events L3](https://w3c.github.io/pointerevents/)
- [WCAG SC 1.4.4 Resize Text](https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast-scale.html)

## WebKit / Apple
- [WebKit Features in Safari 18.0](https://webkit.org/blog/15865/webkit-features-in-safari-180/) · [Safari 18.2](https://webkit.org/blog/16301/webkit-in-safari-18-2/) · [WWDC24 / Safari 18 beta](https://webkit.org/blog/15443/news-from-wwdc24-webkit-in-safari-18-beta/)
- [WWDC25 / Safari 26 beta](https://webkit.org/blog/16993/) · [Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) · [26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/) · [26.3](https://webkit.org/blog/17798/webkit-features-for-safari-26-3/) · [26.5](https://webkit.org/blog/17938/webkit-features-for-safari-26-5/) · [26.6](https://webkit.org/blog/18178/webkit-features-for-safari-26-6/)
- [WWDC26 / Safari 27 beta](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/)
- [Designing Websites for iPhone X (2017-09-22)](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) · [New Interaction Behaviors in iOS 10](https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/) · [Safari 13 features](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/) · [Safari 15.4 features](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/) · [Web Push for Web Apps on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) · [Safari 16.0](https://webkit.org/blog/13152/webkit-features-in-safari-16-0/)
- [An HTML Switch Control (2024-02-28)](https://webkit.org/blog/15054/an-html-switch-control/) · [Safari 17.4 features](https://webkit.org/blog/15063/webkit-features-in-safari-17-4/) · [Announcing Interop 2026 (2026-02-12)](https://webkit.org/blog/17818/announcing-interop-2026/)
- WebKit standards-positions: [#267 — Vibration API — **oppose**](https://github.com/WebKit/standards-positions/issues/267) · [#65 — `interactive-widget` — **open, "needs position" since 2022-09-21**](https://github.com/WebKit/standards-positions/issues/65)
- WebKit source on `main` (read 2026-08-16): [`WKWebViewIOS.mm`](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/API/ios/WKWebViewIOS.mm) (`webViewStandardFontSize = 16`; `_zoomToFocusRect:`) · `WKContentViewInteraction.mm` (`inputmode` → `UIKeyboardType` mapping; `_zoomToRevealFocusedElement`) · `WebPageIOS.mm` (`nodeFontSize`) · `PageClientImplIOS` (`performSwitchHapticFeedback`)
- WebKit commits: `de5133f289` (2023-12-08, bug 266066 — switch haptic) · `a81bf20129` (2024-03-27, bug 271711) · `dfb3971bb0` / `288403@main` (2025-01-03, [bug 285120](https://bugs.webkit.org/show_bug.cgi?id=285120) — user activation) · `fc1ef83eae` / `313638@main` ([bug 309082](https://bugs.webkit.org/show_bug.cgi?id=309082) — trusted events; release branch 2026-03-04)
- WebKit Bugzilla: [320238](https://bugs.webkit.org/show_bug.cgi?id=320238) · [310127](https://bugs.webkit.org/show_bug.cgi?id=310127) · [233788](https://bugs.webkit.org/show_bug.cgi?id=233788) · [261185](https://bugs.webkit.org/show_bug.cgi?id=261185) · [272779](https://bugs.webkit.org/show_bug.cgi?id=272779) · [153852](https://bugs.webkit.org/show_bug.cgi?id=153852) · [171099](https://bugs.webkit.org/show_bug.cgi?id=171099) · [242758](https://bugs.webkit.org/show_bug.cgi?id=242758) · **[237851](https://bugs.webkit.org/show_bug.cgi?id=237851)** (visualViewport `offsetTop` 0 in web-app mode, NEW) · [279904](https://bugs.webkit.org/show_bug.cgi?id=279904) (iOS 18 keyboard missing in PWAs, NEW/Critical) · [259770](https://bugs.webkit.org/show_bug.cgi?id=259770) (`interactive-widget`, NEW) · [230225](https://bugs.webkit.org/show_bug.cgi?id=230225) (VirtualKeyboard API, NEW) · [198347](https://bugs.webkit.org/show_bug.cgi?id=198347) (visualViewport resize on keyboard, FIXED iOS 13) · [321591](https://bugs.webkit.org/show_bug.cgi?id=321591) (switch blocks scrolling, NEW 2026-08-12) · [217678](https://bugs.webkit.org/show_bug.cgi?id=217678) (gamepad rumble, NEW) · [72010](https://bugs.webkit.org/show_bug.cgi?id=72010) (Vibration API, 2012)
- [`WKWebViewConfiguration.ignoresViewportScaleLimits`](https://developer.apple.com/documentation/webkit/wkwebviewconfiguration/ignoresviewportscalelimits) · [Password AutoFill on an HTML input element](https://developer.apple.com/documentation/security/enabling-password-autofill-on-an-html-input-element)
- [W3C Haptic Interaction on the Web CG — closed 2023-04-07](https://www.w3.org/community/webhaptics/)
- Apple archive: [Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/UsingtheViewport/UsingtheViewport.html) · [Safari CSS Reference](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariCSSRef/Articles/StandardCSSProperties.html) · [`allowsBackForwardNavigationGestures`](https://developer.apple.com/documentation/webkit/wkwebview/1414995-allowsbackforwardnavigationgestu)
- [WWDC23 — What's new in web apps (session 10120)](https://developer.apple.com/videos/play/wwdc2023/10120/)
- Apple Developer Forums (secondary): [716552](https://developer.apple.com/forums/thread/716552) · [808606](https://developer.apple.com/forums/thread/808606) · [99579](https://developer.apple.com/forums/thread/99579)

## Chrome / Android
- [Same-document view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/same-document) · [overscroll-behavior](https://developer.chrome.com/blog/overscroll-behavior/) · [Scrolling intervention (Chrome 56)](https://developer.chrome.com/blog/scrolling-intervention) · [Viewport resize behavior changes (Chrome 108)](https://developer.chrome.com/blog/viewport-resize-behavior) · [Edge-to-edge](https://developer.chrome.com/blog/edge-to-edge) + [migration guide](https://developer.chrome.com/docs/css-ui/edge-to-edge) · [History API scroll restoration](https://developer.chrome.com/blog/history-api-scroll-restoration) · [PWA navigation management](https://developer.chrome.com/docs/capabilities/pwa-navigation-management)
- Release notes: [Chrome 135](https://developer.chrome.com/release-notes/135) · [144](https://developer.chrome.com/release-notes/144) · [150](https://developer.chrome.com/release-notes/150)
- chromestatus: [Android OSK resizes visual viewport by default (Chrome 108)](https://chromestatus.com/feature/6145225857171456) · [Remove navigator.vibrate without user gesture (Chrome 60)](https://chromestatus.com/feature/5644273861001216)
- [VirtualKeyboard API](https://developer.chrome.com/docs/web-platform/virtual-keyboard)
- [Predictive back gesture](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture) · [Android 15 behavior changes](https://developer.android.com/about/versions/15/behavior-changes-15) · [Edge-to-edge](https://developer.android.com/develop/ui/views/layout/edge-to-edge)
- [web.dev Learn PWA — App design](https://web.dev/learn/pwa/app-design) · [The large, small, and dynamic viewport units](https://web.dev/blog/viewport-units)

## MDN and browser-compat-data
- View Transitions: [API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) · [Using](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using) · [`startViewTransition`](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) · [`ViewTransition`](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition) · [`ready`](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/ready) · [`finished`](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/finished) · [`@view-transition`](https://developer.mozilla.org/en-US/docs/Web/CSS/@view-transition) · [`view-transition-name`](https://developer.mozilla.org/en-US/docs/Web/CSS/view-transition-name)
- Scroll/viewport: [`overscroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior) · [`overflow-anchor`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor) · [`scroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-behavior) · [`history.scrollRestoration`](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration) · [viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport) · [`env()`](https://developer.mozilla.org/en-US/docs/Web/CSS/env) · [length units](https://developer.mozilla.org/en-US/docs/Web/CSS/length)
- Input/gesture: [`VisualViewport`](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) · [VirtualKeyboard API](https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API) · [`inputmode`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode) · [`touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action) · [`pointercancel`](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event) · [`addEventListener`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) · [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) · [`hasUAVisualTransition`](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent/hasUAVisualTransition)
- Tells: [`user-select`](https://developer.mozilla.org/en-US/docs/Web/CSS/user-select) · [`-webkit-tap-highlight-color`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-tap-highlight-color) · [`-webkit-touch-callout`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-touch-callout) · [`:focus-visible`](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible) · [`::selection`](https://developer.mozilla.org/en-US/docs/Web/CSS/::selection) · [`caret-color`](https://developer.mozilla.org/en-US/docs/Web/CSS/caret-color) · [`text-size-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/text-size-adjust) · [`display-mode`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode) · [`pointer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer) · [`hover`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover) · [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- PWA: [Installing web apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing) · [manifest `display`](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display) · [`display_override`](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display_override)
- BCD raw JSON (all fetched 2026-08-16): [`Document.startViewTransition`](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.Document.startViewTransition.json) · [`ViewTransition`](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.ViewTransition.json) · [`Document.activeViewTransition`](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.Document.activeViewTransition.json) · [`@view-transition`](https://bcd.developer.mozilla.org/bcd/api/v0/current/css.at-rules.view-transition.json) · [`view-transition-name`](https://bcd.developer.mozilla.org/bcd/api/v0/current/css.properties.view-transition-name.json) · [`view-transition-class`](https://bcd.developer.mozilla.org/bcd/api/v0/current/css.properties.view-transition-class.json) · [`overscroll-behavior`](https://bcd.developer.mozilla.org/bcd/api/v0/current/css.properties.overscroll-behavior.json) · [`env()`](https://bcd.developer.mozilla.org/bcd/api/v0/current/css.types.env.json) · [dynamic viewport units](https://bcd.developer.mozilla.org/bcd/api/v0/current/css.types.length.viewport_percentage_units_dynamic.json) · [`VisualViewport`](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.VisualViewport.json) · [`interactive-widget`](https://bcd.developer.mozilla.org/bcd/api/v0/current/html.elements.meta.name.viewport.interactive-widget.json) · [`Navigator.vibrate`](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.Navigator.vibrate.json) · [`inputmode`](https://bcd.developer.mozilla.org/bcd/api/v0/current/html.global_attributes.inputmode.json) · [`enterkeyhint`](https://bcd.developer.mozilla.org/bcd/api/v0/current/html.global_attributes.enterkeyhint.json) · [`Navigation`](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Navigation.json) · [`NavigateEvent`](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/NavigateEvent.json)
- BCD repo: [PR #10542](https://github.com/mdn/browser-compat-data/pull/10542) (`-webkit-overflow-scrolling` removed at Safari 13) · [issue #6376](https://github.com/mdn/browser-compat-data/issues/6376) (`contextmenu` not fired on iOS long-press)

## TanStack Router / Start
- Source on `main`, read 2026-08-16: [`router-core/src/router.ts`](https://github.com/TanStack/router/blob/main/packages/router-core/src/router.ts) (`startViewTransition` L2378-2427; `ViewTransitionOptions` L857-867; `commitLocation` / `shouldViewTransition` L2190) · [`load-client.ts`](https://github.com/TanStack/router/blob/main/packages/router-core/src/load-client.ts) (L1947) · [`scroll-restoration.ts`](https://github.com/TanStack/router/blob/main/packages/router-core/src/scroll-restoration.ts) (L204) · [`link.ts`](https://github.com/TanStack/router/blob/main/packages/router-core/src/link.ts) (L327-338)
- Docs: [`RouterOptionsType`](https://github.com/TanStack/router/blob/main/docs/router/api/router/RouterOptionsType.md) · [`NavigateOptionsType`](https://github.com/TanStack/router/blob/main/docs/router/api/router/NavigateOptionsType.md) · [scroll restoration](https://github.com/TanStack/router/blob/main/docs/router/guide/scroll-restoration.md) · [SPA mode](https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/spa-mode.md)
- Example: [`examples/react/view-transitions`](https://github.com/TanStack/router/tree/main/examples/react/view-transitions)
- Issues: [#6754](https://github.com/TanStack/router/issues/6754) open · [#7906](https://github.com/TanStack/router/issues/7906) open · [#7956](https://github.com/TanStack/router/issues/7956) open · [#7815](https://github.com/TanStack/router/issues/7815) closed · [#8028](https://github.com/TanStack/router/issues/8028) open · [#7749](https://github.com/TanStack/router/issues/7749) open · [#8024](https://github.com/TanStack/router/issues/8024) open · [#7687](https://github.com/TanStack/router/issues/7687) closed · [#4344](https://github.com/TanStack/router/issues/4344) closed · [#2983](https://github.com/TanStack/router/issues/2983) closed · [#4988](https://github.com/TanStack/router/issues/4988) open · [#6455](https://github.com/TanStack/router/issues/6455) open
- PRs: [#7697](https://github.com/TanStack/router/pull/7697) open · [#7907](https://github.com/TanStack/router/pull/7907) open · [#7158](https://github.com/TanStack/router/pull/7158) closed unmerged

## W3C / WICG trackers
- [w3c/pointerevents#295](https://github.com/w3c/pointerevents/issues/295) (closed — WebKit "not interested") · [#358](https://github.com/w3c/pointerevents/issues/358) (open) · [w3c/manifest#1041](https://github.com/w3c/manifest/issues/1041) (open) · [WICG default UA transitions explainer](https://github.com/WICG/view-transitions/blob/main/default-ua-transitions.md) · [Mozilla bug 1860854](https://bugzilla.mozilla.org/show_bug.cgi?id=1860854)

## Secondary, marked [B] in the body
- Maximiliano Firtman, "What's new on iOS 12.2 for Progressive Web Apps" (2019-03-26) — the only dated attribution for the standalone back-swipe
- Bramus, "Prevent overscroll/bounce in iOS MobileSafari" (2016-05-02, self-disavowed for iOS 12+)
- Philip Heltweg, "A Checklist of Issues for Progressive Web Apps" (2024-10-15)
- [pixelfed#3786](https://github.com/pixelfed/pixelfed/issues/3786) · [ionic-framework#29733](https://github.com/ionic-team/ionic-framework/issues/29733) / [#22299](https://github.com/ionic-team/ionic-framework/issues/22299)
- [`ios-haptics`](https://github.com/tijnjh/ios-haptics) README — the `<input type=checkbox switch>` haptic mechanism
