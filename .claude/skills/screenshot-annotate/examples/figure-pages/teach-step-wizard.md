# teach-step-wizard

**Article §** *Teach* — The step wizard.
**Published** `docs/help/images/teach/teach-step-wizard.png`, 729×198, 45 KB,
**aubergine backdrop**.
**Source** `figures/sources/teach-step-wizard.png`, 669×83 — a 446×55 CSS px clip at
`deviceScaleFactor: 1.5`.

## What it shows

The wizard's step dots part-way through a programmer's ten-step sequence: seven completed (pale
green, green border, check glyph), step 8 current (filled accent, its number showing), and 9 and 10
in outline. One callout.

The figure is the article's **legend for the three dot states**, which is the job the prose can only
do by describing colours. That is why it exists; the ring carries the one thing neither the prose
nor the picture says.

## Getting back to something close

`docs/help/.screenshots/capture-teach.mjs`, state B — the **same page state** as
[`teach-utilities`](teach-utilities.md), one clip lower. PGM-03 under teach at a 1440×940 viewport,
`deviceScaleFactor: 1.5`, and seven presses of the real **Next** button.

Seven Nexts is what produces the legend: `handleNext` adds the current step to `completedSteps` and
advances, so after seven the wizard sits on step 8 with 1–7 checked and 9–10 untouched. All three
appearances in one frame, driven through the real code path rather than seeded.

**Ten dots over three taught positions**, transcribed from
`LumenXProgrammer.GenerateTeachableLocation()`: Socket 1 carries four steps, Socket 5 three, Socket 8
three. The count matters when re-shooting — a component with three or four steps gives no run of
completions long enough for the legend to read as a legend.

## Why the clip stops before Back and Next

The footer strip is as wide as the whole right-hand column — 868 CSS px at a 1440 viewport — and
on-page type is `column ÷ figure-width`, so publishing the full strip drops the 12px dot numerals to
about **7 CSS px**. Clipped to the dot band with 46 CSS px of slack a side they publish at **18**.
Back and Next are one sentence of prose away and lose nothing by being described rather than shown.

Vertically the clip is the footer's own border box plus 2px, so the figure opens on its 1px top rule
and closes on the section's bottom edge instead of on an arbitrary offset around the circles. The
capture asserts the dots did not wrap to a second row and that the slack does not shear **Back**.

## Why it is annotated the way it is

No numbers: the dots already carry the doc's step numbers, and a numbered bubble beside a numbered
dot would be absurd.

**One callout, and the restraint is the finding.** The article's three bullets name all three dot
appearances exactly — filled accent, green with a check, outline — so a ring on any of them is a
caption. The legend is what the *figure* carries and what the *caption* states. The ring carries the
fact neither does:

*A check means Next was pressed, not that anything was taught.* `handleNext` adds the current step
to `completedSteps` **unconditionally**. Nothing checks that a position was captured, that a Z-Auto
ran, or that the step's own component reported success — pressing Next is the entire condition. A
green check therefore records that the operator walked past the step, and an operator reading the
row as a record of taught positions is reading it wrong. The article says only "Green with a check —
completed", which is exactly the word that invites the misreading.

**Rejected:**

- **The accent-filled current dot** and **the outline dots.** Named in the prose, verbatim.
- **"Click any dot to jump straight to that step"** and **"hover for its title."** Both in the prose
  — and the tooltip cannot be photographed at all, being a native `title` attribute that does not
  render into a screenshot.
- **"Next on the final step reads Finish."** True, and not fully covered: `handleNext` on the last
  step only marks it done — it does not close the session or leave the screen. But showing it needs
  the wizard parked on step 10, which costs the outline dots and therefore the legend the figure
  exists to be.
- **"The checks clear when you pick another component"** (`handleSelectLocation` resets
  `completedSteps`). The same fact as the ring's, approached from the other end; a second ring
  saying it would dilute the first.

## Targets

Measured. The seven completed dots are the only `#22C55E` ink in the figure — `STATUS_COLOR.taught`
draws both their border and their check glyph — and each resolves as its full 45×45 circle.
`minWidth: 20` drops nothing today but keeps the selector honest against antialiasing crumbs in a
future capture.

**`pick: "rightmost"` takes dot 7 rather than dot 1 on purpose.** It sits directly against the
accent-filled current dot, so the ring lands where the two states are side by side and the
comparison the label depends on is in the same glance.

## The backdrop and the gutter

Aubergine. The strip is 83px tall and there is no space inside it for anything, so the single label
lives in synthesized margin above the band — the rule applies with nothing to weigh against it.

`fontScale` is **0.95**: the base is `669/46 × 1.22` = 17.7px and the figure publishes under the
article column, so it is never scaled down. Published the label measures **6.46:1** (`#FCC25C` on
`#463A5A`) — the lowest of the four Teach figures, because a top gutter puts it over the lighter
top-left corner of the gradient. Still well clear of the 3:1 floor.

## On the page

Renders at 731×200, scale **1.00** — native, and the only Teach figure that is neither width- nor
height-bound. The label lands at 16.9 CSS px and the dot numerals at 18.
