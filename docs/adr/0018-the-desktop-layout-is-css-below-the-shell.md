# The desktop layout is CSS below the shell

Send Lab has two layouts. Both are the **same DOM**, and everything that differs
between them is a `lg:` utility in the stylesheet. Nothing in the app tree learns
how wide the window is — no `matchMedia`, no width in state, no layout picked in
a component — and above all nothing in the **shell** does.

The breakpoint is one, at Tailwind's `lg` (1024px), and the two layouts are:

| | Phone | Wide |
|---|---|---|
| Navigation | three tabs on the bottom edge | the same three as a 200px left rail |
| Measure | `max-w-[520px]`, centred | `max-w-[1000px]` beside the rail |
| Panes | one | two, on the pages that earn it |

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

- **`AppShell` has exactly one `<nav>` and one `<main>`.** The rail is the tab bar
  restyled. Two navs behind a media query would also work as CSS and is still
  wrong: assistive technology sees both, the second one's links are duplicate
  landmarks, and a duplicated `view-transition-name` is one of the three ways a
  view transition silently skips (#43). Keeping one element is also what lets the
  rail inherit `tabbar`'s hold-still rule unchanged.
- **`tests/desktop.test.ts` enforces both halves** — no viewport read in
  `__root.tsx` or `AppShell.tsx`, and one nav and one main. It is a source scan
  because the failure is invisible in a diff: a `useMediaQuery` in a layout
  component looks like exactly the right thing to write.
- **`pnpm check:hydration --desktop` is the runtime half**, and it is the check
  that would actually catch a breach. A layout branched in JS shows up as a
  hydration mismatch at the viewport the shell was not baked for, and nothing else
  reports it. `--desktop` also emulates `hover` and `pointer`, without which every
  `hover:` rule is inert and the run measures a layout nobody uses.
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
`check:contrast`, `check:motion` and `check:hydration` have to cover, for a device
the single athlete does not own. Reversible: it is one more breakpoint in
`Panes` and `AppShell` if a tablet ever appears.

**A wider navigation on the wide screen** — the rail has room for the other six
pages. Rejected because it makes desktop a different app: a second information
architecture, and every page ticket then owing two answers to "where is this
reached from". The rail carries the same three destinations the tab bar does.
