---
status: accepted
---

# Day types have identity independent of weekdays

A day type was identified by the weekday it happens to default to, so `"Mon"`
named both Monday-the-slot and Limit/Power-the-protocol, and "run Friday's
protocol on Tuesday" was stored as the string `"Fri"`. The overload leaked into
per-slot overrides, the program template, and generated rehab programs, where a
weekday key sometimes means a calendar position and sometimes means a
prescription. We gave day types their own ids (`limit-power`, `rest`, …) and left
weekdays to mean only calendar position.

## Consequences

- Production accounts store weekday keys in the per-slot override and program
  template maps, so this needs a migration mapping old weekday keys to day-type
  ids, not a blind drop.
- Rest days stop being detected by scanning for the day whose load label reads
  `OFF` — a display string standing in for identity — and become an explicit
  day type.
- Sessions currently store the *localized* weekday label as their day, which is
  the same identity-versus-display slip; they should carry the day-type id.
