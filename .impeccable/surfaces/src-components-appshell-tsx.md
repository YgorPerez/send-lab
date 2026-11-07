---
version: 1
slug: "src-components-appshell-tsx"
primary_target: "src/components/AppShell.tsx"
related_targets: ["src/routes/index.tsx","src/routes/train.tsx","src/routes/timer.tsx","src/routes/log.tsx","src/routes/week.tsx","src/routes/settings.tsx","src/routes/welcome.tsx","src/routes/login.tsx","src/components/ui/primitives.tsx","src/components/ui/variants.ts"]
---

# The whole app: the UI/UX overhaul (spec #113)

Mode: Operate. Scope: the shell and the eight built screens (Today, Train, Timer, Log, Week, Settings, the intake on `welcome`, sign-in), worked as a chain of tickets #114–#125. Decided in a grill with the athlete on 2026-11-07; every decision in #113 is final.

Audience and task: one athlete. Before training, on a phone at home: answer the readiness check, read the verdict and the plan. During the session, one-handed with chalk on the fingers: log sets on Train, run the clock on Train or the Timer, often from 1–3 m away. Afterwards, or at a desk: Log and Week, sometimes on a laptop.

## Direction contract

THESIS: one standard of alignment, type, hierarchy, icons and spacing across every screen, inside the incumbent identity. The app should read as one tool, built at once, not eight tickets.

OWN-WORLD: Direction A, locked (#47, picked on #51): the hue-free dark ground, the graphite ramp, vermilion as the signature and the one primary, teal / gold / violet as state, Inter for words, Roboto Mono for data, Barlow Condensed for the clock's numbers. Type sizes, spacing, radii, icons, component shapes, density and placement are open.

STORY: the athlete learns a header, a group, an empty or offline state and the navigation once, on the first screen, and reads them the same way on every other one.

FIRST VIEWPORT: per screen, `ScreenHeader` first, then the answer the screen is opened for (the verdict on Today, the open task on Train, saved protocols on the Timer). Navigation at the bottom edge on a phone, a rail from `lg`.

FORM: pinned by the athlete in the #113 grill. No concept roll: a refinement of an incumbent world the athlete chose. seed: not rolled (direction pinned by the athlete)

FINISH: each ticket closes on an `/impeccable` pass over what it changed, with every finding fixed or answered on the ticket, and the measuring gates green at 360px and `--desktop`. #125 reviews all eight screens together from a contact sheet.
