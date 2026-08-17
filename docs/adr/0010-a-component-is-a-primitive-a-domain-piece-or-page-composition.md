---
status: accepted
---

# A component is a primitive, a domain piece, or page composition

The SvelteKit app had 40 feature components beside 36 library primitives, and the
rebuild was on course to translate them one for one — which is how a design
system ends up with forty single-caller modules and nine pages that each invent
their own card. The question `#19` asked as *"how much of this is reusable?"* has
no answer while "component" means both `SetRows` and `Periodization`, because the
first is a shape every screen needs and the second was one screen's middle third.

We settled a three-tier vocabulary and one test for placing anything in it.

**`src/components/ui/` — primitives.** A component whose interface names nothing
from the training domain. It takes a label, a value, children and a variant, so
it can be used anywhere. Fourteen of them, five expressed as `tailwind-variants`
recipes rather than components because a `<label>`, an `<input>`, an `<a>` and a
`<Dialog.Close>` all have to be able to be the same button.

**`src/components/` — domain pieces.** Named in `CONTEXT.md`'s language, taking
domain entities, and owning a decision: how a set row wraps at 360px, how the
interval protocol advances, how a self-check scores.

**`src/routes/` — page composition.** Everything used exactly once that only
*arranges* primitives. Named local functions, no files of their own.

**The test is whether a thing owns a decision or only an arrangement.** Not
whether it is reused, and not whether it is long. `Timer` appears on one screen
and is a component, because it owns the protocol. `PlanCard` is a card, a list
and a hairline, and stays in the route. `Rehab`, `Periodization` and
`SavedPrograms` do not survive as components at all: each was a section of one
screen wearing a component's clothes, and length was the only argument for the
file it had.

## Consequences

- A route file holds several components, which `react-doctor`'s
  `no-multi-component-file` warns about. The warning is accepted deliberately and
  the reasoning is recorded in the route: the alternative is a directory of
  single-use, single-caller modules per screen, which is the failure this
  vocabulary exists to prevent.
- Promotion is a real event with a reason attached — a second screen needs it, or
  it grew a decision. Demotion is equally allowed and cheaper than it looks.
- `shadcn` generates `cva`; its output is normalised to `tailwind-variants` on
  ingest, every time (#46). Two variant systems side by side is the specific
  failure the redesign map exists to avoid.
- The nine page tickets compose from a named list rather than from whatever the
  last page happened to build, which is what the list is for.
