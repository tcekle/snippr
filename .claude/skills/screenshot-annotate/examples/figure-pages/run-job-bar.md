# run-job-bar.png

`docs/help/images/run/run-job-bar.png` · 1394×368 · 148 KB · *Run* → The job bar.

## What it shows

The job bar **expanded**: the collapsed header row on top — disclosure triangle, job name, device,
checksum, the machine-state tag and the five run controls — with the six-field job record below it.
Three callouts.

## Getting back to something close

The shared mocked run (see the index), then click anything in the header to expand it — the device
name is a safe target — wait for the checksum row, and clip the CollapsibleBar's border box read off
the DOM. **Assert that all six `Name:` / `Device:` / `Algorithm:` / `Checksum:` / `Data File:` /
`Package:` rows are present before writing**; the expansion is the whole point of the figure.

**A 1152×900 viewport, not the 1440 every other Run capture uses.** The bar is as wide as the content
area, so at 1440 it is around 1164 CSS px and the 14px job name lands near 8 CSS px once the site
scales the figure into the article column; at 1152 the bar is 876 and the same text reaches 11. Same
move as `service-mode-banners.png`, which narrowed to 1040 for the same reason. **Nothing reflows
between the two widths** — the device name is `hidden sm:inline` and the checksum `hidden md:inline`,
both far below 1152, and the identity block still has about 25% more room than its text needs.
`deviceScaleFactor: 1.5`.

**Expanded, not collapsed, and that is what lets one figure carry three sections.** Collapsed, the
header shows three unlabelled strings — a job name that is itself device-shaped, a device, and a
checksum — and nothing on screen says which is which. Expanded, the grid below prints the field names,
so the figure answers the article's first table by itself and needs no callouts for it.

**No pad on the clip.** `annotate` fills its label margins with the capture's *dominant* colour, which
here is the bar's own interior fill, while the pixels immediately outside the bar are the page ground.
Any pad lands a band of page ground between the bar and a margin painted in the bar's fill, and the
figure grows a faint halo. On the border box the two match and the bar's own 1px border is the only
edge in the figure.

## Why it is annotated the way it is

No numbers: the section is prose and two reference tables.

Three callouts, and they are the reason `### Machine state` and `### Run controls` get no figures of
their own — both subsections describe controls inside this bar, and three crops of the same 40px
strip would say less than one crop with three rings.

- *Click the bar for the full job record* → the disclosure triangle, which is the only ink cluster in
  the capture under 20×20. Nothing else on screen says the bar is clickable.
- *Machine state — sets which controls are available* → the tag, the only region carrying its
  particular green. The causal claim is the article's and no pixel makes it; the tag looks like a
  status readout.
- *Dimmed: the job is already running* → the **Run** button, the only region carrying the faded accent
  blue. Run is drawn in the accent at 40% opacity, so it reads as the *primary* action when it is in
  fact the one button the current state forbids — the same class of trap as **Cancel** on
  `unsaved-changes.png`. The enabled secondaries and the disabled secondaries are both greys, well
  outside tolerance of the faded blue, so the match is unambiguous.

Rejected: a Machine-state figure of its own, which could only ever show one of the six states while
the tag prints its own name; and any callout naming a job-record field, since the expanded grid prints
all six.

**All three labels sit in the top margin and the figure takes no horizontal gutter**, which is the
whole layout — the same argument as `unsaved-changes.png`. A top or bottom margin only makes the
figure taller; a side margin comes straight out of the 14px bar text the figure exists to show.

### The backdrop

**This is the strongest case for one in the whole Run set, and the least free.** The top margin is
151px of a 319px figure — 47% of the picture was synthesized margin, and *No pad on the clip* above
records that `annotate` fills that margin with the capture's dominant colour, which here is the bar's
own interior fill. So half the figure was painted in a UI colour, the bar appeared to run the full
height of the picture, and all three labels read as printed on the product. That is the same
misreading `service-mode-banners.png` recorded, at twice the scale.

**The padding is hand-sized to 40, not the 4.5%-of-capture default of 59.** Top and bottom are
`max(floor, derived)` and the three labels derive about 152, so the floor buys nothing there; the only
thing it changes is the side gutter, and the side gutter comes straight out of the bar text. At the
default the figure goes to 1394 → 1432px and the bar's 14px name drops from 12.9 to 11.8 CSS px on the
page; at 40 it goes to 1394 and 12.2. Forty publishes as roughly 23 CSS px of gradient beside the bar,
which is what `shell-status-bar.png`'s hand-sized 90 publishes as, and it is enough for the bar to
float.

**Zero side padding was not available.** It holds 12.9 exactly by keeping the figure at its capture
width, and it is the two-stripes failure the padding floor exists to prevent — rendered and rejected
on `service-mode-banners.png` before this figure existed.

The label scale was **re-derived, not nudged**: `old × 1394 ÷ 1314`. Label type is sized off the
capture width, so the side padding scales every label down on the page by exactly that ratio, and
multiplying it back holds them at the 18.2 CSS px they measured on white. Do the same arithmetic if
the padding ever changes. The width is `1314 + 2 × 40` whatever the labels do, because nothing sits in
the left or right gutter, so this does not iterate.

Measured on the rendered output, the three labels go from 3.45 / 3.45 / 3.19:1 on the bar's grey to
7.20 / 5.74 / 7.39:1 on the gradient. The middle one is the lowest in the whole converted set and it
is still inside the 5.5–9:1 band: it lands where the aubergine is lightest.

**The three label positions are constrained, not aesthetic, and the reason is worth knowing.** Step 5
of the layout pushes overlapping labels **downwards**, not sideways — so two margin labels that
collide horizontally do not shuffle, they stack, and the lower one lands on the bar's own top border
with its descenders crossing it and its leader collapsed to a stub barb inside the ring. That is what
the first render did. The three shifts exist to make the boxes miss each other in x so no push happens
at all, while keeping every box inside the frame: a label pushed past the left edge would force a left
margin and re-introduce the gutter this layout exists to avoid.

## Known issues

At 148 KB for 1394×368 this is still the fattest byte-per-pixel figure in the set, and the backdrop
made it worse — a gradient does not compress like flat fill, and the conversion took it from 95 KB to
148 KB on 15% more pixels. `docs/help` runs no image-optimisation pass; if PDF weight ever becomes a
problem, this is where to start. See the index's Outstanding list.

**It is also the only figure in the set whose on-page type the backdrop actually cost.** 12.9 → 12.2
CSS px against 16px body copy. The lever that would buy it back is a narrower capture viewport, not a
larger `deviceScaleFactor`: this figure already publishes wider than the article column, so the scale
factor cancels out of the on-page arithmetic entirely and re-shooting at 2 would change nothing.
