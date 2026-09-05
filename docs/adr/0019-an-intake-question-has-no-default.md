# An intake question has no default

No question at the intake opens with an answer in it. Every required field of the
draft starts empty, each step's advance is held until the athlete has answered
it, and the conversion to a `Baseline` refuses a draft with a hole anywhere in
it — so a value the athlete did not give cannot reach `programGen`.

The trap that produced it is in the page this replaced. The SvelteKit intake form
opened with `goal = 'boulder'`, `focus = 'fingers'`, `level = 'advanced'`, four
days a week and all four pieces of equipment selected, and with `niggle` and
`synovitis` at `false`. An athlete who tapped Next four times got a program built
from somebody else's answers — and the two booleans are the sharp end of it,
because `false` there is not "no niggle", it is *nobody asked*, and a niggle is
what caps finger effort at RPE 8 in every finger exercise and softens each phase.
A default is a training decision, made by the form, wearing the athlete's name.

This is the same finding [#61](https://github.com/YgorPerez/send-lab/issues/61)
made one layer downstream, where `computeReadiness` scored each wellness
question's *fallback* and put a verdict made of nothing in front of the athlete.
That one is about output and this one is about input; both are the app answering
on the athlete's behalf and then treating the answer as theirs.

## Consequences

It costs four taps and a longer first run, and it makes an unfinished intake a
state the UI has to carry rather than one it can define away: a held primary that
says what it is waiting for, and — because a draft can reopen at the last step
with the first one blank — a last step gated on the whole draft that names the
*first* unanswered step rather than the one on screen.

The reversal is one line per field and it is **silent**: nothing fails, no test
that does not exist for it goes red, and the programs that come out are merely
wrong. `tests/welcome.test.ts` asserts it on both sides — that a fresh draft
answers nothing and converts to `null`, and that the rendered page carries no
pressed option.

The rule binds the intake, which is where it was paid for. Whether it binds every
form the rebuild has left to build is not settled here; the two screens that
write next (`week`, `program`) edit values the athlete already has, which is a
different case from asking for one.
