# The desktop layout is CSS below the shell

Send Lab has two layouts. Both are the **same DOM**, and everything that differs
between them is a `lg:` utility in the stylesheet. Nothing in the app tree learns
how wide the window is — no `matchMedia`, no width in state, no layout picked in
a component — and above all nothing in the **shell** does.

The breakpoint is one, at Tailwind's `lg` (1024px), and the two layouts are:

| | Phone | Wide |
|---|---|---|
| Navigation | ~~three tabs on the bottom edge~~ ~~a menu in the top strip~~ a bar on the bottom edge: Today, Train, Timer, Log, and More | ~~the same three as a 200px left rail~~ ~~the same menu~~ the same element as a 200px left rail listing every destination |
| Measure | `max-w-[520px]`, centred | `max-w-[1000px]`, centred in what the rail leaves |
| Panes | one | two, on the pages that earn it; a one-pane page starts on the measure's left edge |

> **Amended 2026-11-07 — the bar returns, with an overflow (#115, spec #113).**
> This contradicts the 2026-09-08 amendment below on purpose, and leaves this
> ADR's decision where it was: one DOM, every difference a `lg:` utility, no
> viewport read anywhere, and none in the shell.
>
> The 2026-09-08 amendment removed the bar because a three-item bar could not
> grow: every page after the third became a one-off. That failure belonged to a
> bar with no overflow, not to having a bar. The new bar holds the four places a
> training day moves between (Today, Train, Timer, Log) and a fifth item, More,
> which opens a sheet from the bottom edge holding Week and Settings, and later
> Program (#65) and Studies (#67). A new page gets a row in that sheet and in the
> rail, and the bar does not change, so it cannot produce the one-offs the menu
> was brought in to end. What the menu cost, and the athlete paid mid-set, was
> reach: `train` and `timer` sat behind a control in the top-right corner, the
> part of a phone a thumb reaches last. The bar puts them under the thumb.
>
> From `lg` the same `<nav>` is a 200px rail under the strip, listing every
> destination, with More hidden. The strip's content and `main` sit in one
> 1000px measure centred in what the rail leaves, and a one-pane page starts on
> that measure's left edge, so the wordmark and every screen's title share one
> left edge. The window reserves the scrollbar's gutter from `lg`, so a page that
> scrolls is not 15px narrower than one that does not.
>
> What the page has to clear is two CSS variables, `--nav-clear` (the bar and
> the home indicator on a phone, nothing from `lg`) and `--nav-rail` (200px from
> `lg`), both zero on the intake. The intake hides the bar because its route says
> so (`staticData.navigation`), read in `__root.tsx` once the app has hydrated;
> the baked shell renders the bar. Nothing in this reads the viewport.
>
> The rail listing every destination reverses "a wider navigation on the wide
> screen", rejected below. That rejection was against a second information
> architecture: a rail with pages the phone did not reach from the same place.
> There is no second one now. The phone and the rail list the same destinations
> in the same order from the same element; the phone folds the last ones into
> More because 360px holds five items, and the rail does not need to.

> **Amended 2026-09-08 — the tab bar and the rail are gone, and this decision is
> not.** *(Superseded on the navigation by the 2026-11-07 amendment above; kept as
> the record of why the bar went.)* The navigation row above is struck through rather than rewritten,
> because what changed is *what the chrome contains*, not *how the two layouts are
> chosen*, which is what this ADR decides. Everything below still holds: one DOM,
> every difference a `lg:` utility, no viewport read anywhere, and above all none
> in the shell.
>
> What changed is that #52's three destinations stopped being three. That claim —
> "exactly three places the athlete goes on a training day" — held while there
> were three pages, and produced one-offs as the other six arrived: `settings`
> became a lone gear in the top strip and `week` a chip in Today's header, each
> invented because there was nowhere for it to live. The athlete went looking for
> `week`, could not find it, and asked for a menu, then for the bar to go with it.
> Prototyped four ways on `proto/menu` and decided on the dropdown.
>
> The rail went with the bar necessarily: this ADR's own claim is that the rail
> *is* the tab bar restyled, one element under two stylesheets, so once the bar
> was gone there was nothing left to restyle. A wide screen now centres `main` on
> its own measure instead of sitting beside a 200px gutter — which is a smaller
> difference between the layouts than before, and therefore a stronger case for
> this ADR rather than a weaker one.

## Why this needed deciding

The athlete chose *phone-first with a real desktop layout*, not a centred column
(#42). So a second layout genuinely exists, and the obvious way to build one —
resolve the viewport once, high up, and render the right chrome — collides with
[ADR 0006](0006-the-app-is-client-only-with-one-server-seam.md).

ADR 0006 fixes one `ssr: false` seam at the root. The build prerenders exactly
that seam into `/_shell.html`: **one artefact**, user-independent by
construction, which the service worker precaches so an installed app cold-starts
without the network. "User-independent" had only ever been read as "does not know
who is signed in". A layout chosen above that seam adds a second axis: the shell
would also have to know how wide the window is, and it is built on a machine that
has no window at all.

That leaves two outcomes, and both are quiet:

- **One shell, baked with one layout.** Every load on the other viewport hydrates
  against the wrong markup. That is [#70](https://github.com/YgorPerez/send-lab/issues/70)
  with a new cause — React discards the tree and re-renders, the page looks
  correct, and the only evidence is a console error.
- **Two shells.** The precache has to choose one before a window exists, and the
  two have to be kept in step forever.

CSS has neither problem. A media query is evaluated by the browser after the
markup arrives, so one baked artefact is correct at every width, and the cold
start stays a file read.

## Consequences

- **The chrome has exactly one `<nav>` and one `<main>`.** Two navs behind a media
  query would also work as CSS and is still wrong: assistive technology sees both,
  the second one's links are duplicate landmarks, and a duplicated
  `view-transition-name` is one of the three ways a view transition silently skips
  (#43). *Amended 2026-11-07: `AppShell` owns the one `<main>` and
  `Navigation.tsx` owns the one `<nav>`, which is the bar on a phone and the rail
  from `lg`. More's sheet is a dialog, not a second navigation. The chrome's
  view-transition names are `topbar` and `navigation`, and `app.css` and
  `tests/motion.test.ts` changed together to say so.* (Between 2026-09-08 and
  2026-11-07, `Menu.tsx` owned the `<nav>` and `topbar` was the only chrome name.)
- **`tests/desktop.test.ts` enforces both halves** — no viewport read in
  `__root.tsx` or `AppShell.tsx`, and one nav and one main *across the two chrome
  files*. It is a source scan
  because the failure is invisible in a diff: a `useMediaQuery` in a layout
  component looks like exactly the right thing to write.
- **`pnpm check:hydration --desktop` is the runtime half**, and it is the check
  that would actually catch a breach. A layout branched in JS shows up as a
  hydration mismatch at the viewport the shell was not baked for, and nothing else
  reports it. `--desktop` also emulates `hover` and `pointer`, without which every
  `hover:` rule is inert and the run measures a layout nobody uses. (Until #125 it
  only asked to: headless Chrome ignores CDP's `hover`/`pointer` emulation. It is
  a launch flag now, and every session checks the device it got before measuring;
  see `scripts/browser.ts`'s `inputDevice`.)
- **A page's own desktop shape is a page decision, expressed through `Panes` or
  `Pane`.** The shell hands a page up to 1000px; whether that becomes two panes or
  one capped near the phone measure is the page's call, and those two adjacent
  functions in `ui/primitives.tsx` are the only place either answer is written
  down. Two shapes rather than one with an optional prop, because `<Panes>` with
  one pane renders no panes — and `Pane` rather than `Column`, because "column"
  already means one of the four cells a set row wraps into.
- **A hover state never lands on an accent fill**, enforced by the same test file.
  `check:contrast` measures a page nobody is hovering, so hover is the one place it
  cannot catch a regression — and `--flag-deep` carries the ground at 3.91:1 while
  already being the primary button's `active:` fill. Correct as a press, wrong as
  something a pointer can rest on.
- **A two-column split must be contiguous in the phone order.** `Panes` works by
  putting `display: contents` on its two wrappers below `lg`, so they vanish and
  their children stack in DOM order — the phone screen is unchanged to the pixel.
  The price is that the columns cannot interleave. That is the right price: an
  app judged on a phone does not reorder its phone screens to suit a laptop.

## Considered and rejected

**Container queries instead of one media query.** Genuinely more composable, and
the right tool if these components were reused at several widths. Rejected
because they are not: there is one app, one shell, and one place the width is
decided. A container query would move that decision into every component that
needs it, which is more places to disagree, not fewer.

**A tablet breakpoint.** The middle is awkward and it resolves upward or downward
rather than existing: below 1024px there is not room for the rail plus two
columns of the 360px measure these screens were designed against (200 + 2×360 +
gutters ≈ 992px, and `lg` is the first stop above it), so a tablet gets the phone
layout at a comfortable width. Adding a third case would double what
`check:contrast`, `check:motion`, `check:hydration` and `check:overflow` have to
cover, for a device
the single athlete does not own. Reversible: it is one more breakpoint in
`Panes` and `AppShell` if a tablet ever appears.

**A wider navigation on the wide screen** — the rail has room for the other six
pages. Rejected because it makes desktop a different app: a second information
architecture, and every page ticket then owing two answers to "where is this
reached from". The rail carries the same three destinations the tab bar does.
*Reversed 2026-11-07, see the amendment at the top: with More, the phone and the
rail list the same destinations from one element, so a page ticket owes one
answer (a row in `DESTINATIONS`) and the rail shows the rows More folds away.*
