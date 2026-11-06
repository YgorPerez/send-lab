# Timer redesign — approved mockups

Static HTML mockups of the Timer redesign, approved by the athlete on 2026-11-06
after a grill session. They are the critique reference for a code-led build, not a
pixel contract.

- `clock.html` — the clock: ready, running (work, prepare, long rest) and paused. #110.
- `list-editor-train-strip.html` — the `/timer` list with the mini bar (#111), the
  `/train` strip (#110) and the protocol editor (#112).

One approved deviation since: paused digits are solid in the segment colour, not
outlined, because transparent outlined text measures 1:1 in `check:contrast`.
The decisions themselves are recorded in issues #110, #111 and #112.
