---
status: accepted
---

# Reduced motion means everything finishes inside one frame

`src/app.css` carried the rule everyone writes — `animation-duration: 0.01ms
!important` on `*`, `::before`, `::after` — and it had been carried as done since
the app was SvelteKit. The animation research (#45) established that it reached
neither of the two mechanisms this app actually animates with. It looked
compliant and was not, which is worse than absent, because nobody looks twice at
a rule that is already there.

Three mechanisms animate the app, and each escapes differently:

1. **CSS transitions and keyframes**, `tw-animate-css` included. The `*` rule
   does reach these.
2. **The view-transition pseudo-elements.** `defaultViewTransition: true` (#46)
   animates every navigation. They are generated on the root, so `*` never
   matches them, and the spec does not apply `prefers-reduced-motion` to them at
   all (csswg #10267, open).
3. **WAAPI**, which is what Motion drives. No stylesheet reaches it, and Motion
   defaults to `reducedMotion: "never"` — it opts *out* of the athlete's setting
   unless told otherwise.

We settled one answer for all three: **every animation and transition finishes
inside one frame.** Not the more thoughtful-sounding "movement removed,
cross-fades kept" — the only animations in the app are a 190ms screen
replacement and a 190ms accordion height, and a cross-fade shortened to the point
of being safe is a hard cut with extra steps. The distinction buys the athlete
nothing and gives the check something ambiguous to measure.

## Consequences

- The reduced-motion block also sets `animation-iteration-count: 1`. A short
  duration does not shorten an infinite animation, it speeds it up.
- Motion is installed and pinned but **not entered**. When it is, it must be
  imported only from `src/components/ui/motion.tsx`, which wraps its children in
  `<MotionConfig reducedMotion="user">`. `tests/motion.test.ts` fails on any
  other import site and its message says so — the same shape as #20's rule that
  one project-local factory is the only sanctioned way to define a server route.
- A named view-transition rule must not carry `!important`, or it outranks the
  override by specificity. Asserted.
- **`pnpm check:motion`** measures it in a browser, because a stylesheet cannot
  say whether its own media query matched. It runs twice — motion allowed, then
  reduced — and the allowed run has to observe a real transition over a real
  navigation before the reduced run's result counts. That control caught the
  first real defect: **headless Chrome reports `prefers-reduced-motion: reduce`
  by default**, so both passes were reduced and a green result meant nothing.
- Not in `pnpm verify`, which stays jsdom-only and browserless. `pnpm build &&
  pnpm check:motion`, beside `check:contrast`.
