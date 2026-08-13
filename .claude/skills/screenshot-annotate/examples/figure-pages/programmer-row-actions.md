# programmer-row-actions.png

`docs/help/images/programmers/programmer-row-actions.png` · 1046×339 · 86 KB ·
**aubergine backdrop** · *Programmers* → Row actions.

## What it shows

The right-hand end of the programmer list — the **Connection**, **Status**, **Firmware**, **Adapters**
and **Actions** columns, with the header strip and two body rows. Two callouts, on **Blink** and
**Reboot**.

## Getting back to something close

The same page state and the same pixels as [`programmer-manager.png`](programmer-manager.md), clipped
tighter — `docs/help/.screenshots/capture-programmers.mjs`, state A. The left edge is the
**Connection** header cell rather than a fraction of the table, so it survives a different viewport;
the bottom edge lands exactly on row 2's own boundary.

**Eight pixels of breathing room at the bottom was tried first and reaches into row 3**, so the figure
closed on a sliver of two coloured chips with no row under them — an artefact that reads as a
rendering fault rather than as a list continuing.

## Why it is a crop and not a ring on the overview

On-page type size is `capture-font-size × column-width ÷ clip-width`, and the whole list is 1004
logical px wide and publishes its rows at about 10 CSS px. A ring around **Blink** at that size
encloses 40px of 8px type and the label points at a smudge. Cutting back to the Connection column
halves the width and the same rows publish at **15.0**.

**The two chip columns stay in frame on purpose.** Without them the crop is four verbs and two
numbers with no row to belong to. They also carry the only legible copy of the state chips anywhere
on the page, which is the reason the colour-convention callout lives on the overview and not here:
one figure about the list is enough.

**Two body rows, not four.** Every row's Actions cell is identical, so rows three and four would add
height, cost on-page size and say nothing. The header strip is the part that has to survive, because
it names the columns the crop keeps.

## Why it is annotated the way it is

No numbers: the section is an action table, not a numbered sequence.

**Two callouts, and both are about what does *not* happen.** The article gives all four buttons a
sentence each, so ringing one to repeat its sentence is the weak version. What neither the table nor
the picture says is where the feedback is:

- *Blink reports nothing on screen — watch the machine.* `blinkLeds` posts and sets no toast, no
  dialog and no row change. The only confirmation is the physical unit blinking, which is the whole
  point of the button, and a reader who presses it and watches the screen concludes it did not work.
- *Reboots at once; only Remove stops to ask.* `rebootProgrammer` posts straight through;
  `handleRemove` raises a `confirmDialog` first. The article mentions Remove's confirmation and never
  mentions Reboot's absence of one, so a reader reasonably assumes the two behave alike.

Read as a pair they draw the boundary the four buttons do not draw for themselves — Ping answers with
a toast, Remove answers with a prompt, and the two in between answer with nothing. Read alone, either
label looks like a caption. Same construction as the two labels on
[`run-socket-menu.png`](run-socket-menu.md).

**Rejected:** Ping, whose toast the article already mentions. Remove, whose confirmation the article
already mentions — it appears inside the second label as the thing Reboot is being contrasted with,
which is the only work it needed to do. Also rejected: a second callout on the Connection and Status
chips, which would make this crop a figure about the list rather than a figure about the actions.

## Targets

**The buttons are transparent text buttons with no fill, so the swatch detector cannot see them at
all** — every target here is an ink cluster.

The row is bounded by the detector's own rules. The source has exactly two horizontal borders, under
the header at 58 and under the first body row at 118, so a `panel` running from border 1 to the
bottom edge is the second body row and nothing else. Inside it the eight clusters run left to right
as Connected chip, Running chip, firmware, adapter count, Ping, Blink, Reboot, Remove — indices 5 and
6 are the two buttons wanted.

**Targeting the second row rather than the first is what keeps both leaders out of the table.** A
leader from the bottom gutter to a first-row button would have to cross the second row to get there.

## The backdrop and the gutter

Both labels sit in the derived bottom gutter, outside the captured strip, so the backdrop rule
applies.

**Bottom is the cheap axis here.** This figure is bound by the column, so a side gutter would come
straight off the row type the crop exists to rescue, while a vertical one costs nothing.

The two targets are only 79px apart — about a third of a label — so left to itself the layout puts
both labels on top of each other under their own buttons. `labelShift` pulls Blink's label left into
the empty half of the gutter and leaves Reboot's near its own column; the leaders then arrive as two
diverging sweeps rather than two stubs.

`fontScale` is **0.87**, which holds the labels at 17.1 CSS px. Sized off the 960px capture, an
unscaled label would publish at 19.6 — larger than the body copy beside it.

Measured on the rendered output: `#FFC35C` on `#39245B` — **8.42:1** — and on `#332053` — **8.95:1**.
