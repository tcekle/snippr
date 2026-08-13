# run-programmer-card.png

`docs/help/images/run/run-programmer-card.png` · 437×424 · 45 KB · *Run* → Programmers.

## What it shows

One programmer card, PGM-01, in the same state as the overview: header with identifier and **READY**
status, a 4×2 socket grid of six passes / one fail / one empty, and the pass/fail tally below. Two
callouts.

## Getting back to something close

The shared mocked run (see the index) at 1440×900, `deviceScaleFactor: 1.5`. Find the `PGM-01` span,
walk up two parents to the card, clip its border box — **no pad**, for the halo reason: the margin
fill is the capture's dominant colour (the card's interior) while the pixels immediately outside the
card are the Programmers tile's ground, so any pad bands one against the other.

Same eight sockets and the same 6 pass / 1 fail as the overview, so this figure and the overview above
it are the same moment of the same run.

## Why it is annotated the way it is

No numbers: the section is prose and a status table.

**Two callouts, and neither names a part.** Naming the parts is what the prose already does — header,
socket grid, tally — and a ring captioned "socket grid" around a grid of sockets is the empty kind of
callout `unsaved-changes.png` was corrected for. What the picture gets actively wrong is **scope**:

- *This programmer's status, not the machine state* → the **READY** badge, the only region carrying
  its particular pale blue. READY sits forty pixels from a job bar reading Running, and nothing says
  they are two different things.
- *This programmer's tally, not the job's* → the tally row, a few hundred pixels from a Statistics
  tile reading 3164, with nothing to say which population each counts.

Both are misreadings a reader can actually make, and both are one ring away from being impossible.

**The tally target is the awkward one.** It is four separate ink clusters — `6`, `pass`, `1`, `fail` —
a couple of hundred pixels apart, and no selector produces one rectangle over the whole row. The
dilation is tuned to a narrow window: it must merge each number with its word (about 10px apart) while
leaving the socket grid above separate, and the grid's bottom is only 17px clear of the tally, so one
step higher swallows both into a single cluster covering a third of the card. A minimum-width filter
then drops the bare `3` in the empty socket, leaving four candidates top to bottom — identifier,
badge, `6 pass`, `1 fail`. The ring goes on the left half and **the label is worded for the row**,
because a ring cannot span both halves.

Both labels sit in the top and bottom margins and the figure takes no horizontal gutter, so it
publishes at the capture's own width and the site renders it at native pixels. A side gutter would
push it past the content column and start scaling the card's type back down.

### The backdrop

**Of the ten figures evaluated against the backdrop rule in this pass, this is the one whose white
version was most actively wrong.** The *no pad* note above says the margin fill is the capture's
dominant colour; here that colour is the **card's** own fill, not the page ground — so the card
appeared to continue past its 1px border into a 62px gutter above and below, and both labels sat on
what read as more card. A reader had no way to tell where the product stopped.

**Free.** 401px becomes 437px against a roughly 807px column, so the figure still renders at native
pixels and the card's 11px type still lands at 16.5 CSS px, which is what `deviceScaleFactor: 1.5` was
chosen for. The label scale is untouched for the same reason.

Measured on the rendered output, the labels go from 2.57:1 and 2.86:1 on the card grey — **both under
the 3:1 floor for large text** — to 10.17:1 and 8.56:1 on the gradient. The first of those is the
highest in the converted set, slightly over the 5.5–9:1 target band, because the top-right corner is
where the aubergine is darkest; over-band is not a defect the way under-band is.

## Known issues

None specific to this figure. It shares the mocked run's blank DPH / Elapsed, but neither is inside
this crop.
