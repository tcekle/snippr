# run-statistics.png

`docs/help/images/run/run-statistics.png` · 654×489 · 67 KB · *Run* → Statistics (and Reject bin).

## What it shows

The Statistics tile part-way through a job: the four big counts, the DPH / Elapsed / Quantity rows,
and the reject-bin block at the bottom. Two callouts.

## Getting back to something close

The shared mocked run (see the index) at 1440×900, `deviceScaleFactor: 1.5`. Clip the border box of
the `Statistics` heading's parent, read off the rendered DOM.

**1.5, not 2.** The tile is only ~285 CSS px wide, so the finished figure is narrower than the content
column and renders at its own pixel width — the scale factor doubles as on-page zoom, and 2 would draw
the tile's 10px labels at twice the size of the body text beside them.

**No pad on the clip**, for the same halo reason as every other Run detail: the margin fill is the
capture's dominant colour (the tile's interior) while the pixels just outside the tile are the page
ground. On the border box the two match and the tile's own 1px border is the only edge in the figure.

**The reject bin is part of this figure rather than one of its own.** `### Reject bin` describes three
things that occupy the bottom 40px of this same tile; cropped alone they would say nothing the words
*RS1* and *RS2* do not already say, and it would separate the caution from the tile it belongs to.

Worth asserting in the capture rather than eyeballing, because it fails silently: that the reject-bin
**Empty** button really is `disabled`. It is part of what this figure exists to show.

## Why it is annotated the way it is

No numbers: the section is a reference table.

Two callouts. Everything else in this tile prints its own name, and a ring that repeats a printed
caption is what `unsaved-changes.png` was corrected for.

- *The current job's counts* → the **STATISTICS** heading. The tile's own caption says nothing about
  scope, the manual has a separate Statistics **page** covering yield across all jobs, and the
  article's own See-also flags the distinction — so a four-figure pass count can reasonably be read as
  a lifetime total.
- *Disabled while a run is active* → the **Empty** button, found by colour rather than position. The
  danger red at the disabled 40% opacity composites over the tile fill to a distinct muted rose, and
  nothing else in the capture is close to it — the live danger red of the Fail count is far away. A
  greyed word could read as a quiet link, and the section's caution is the strongest safety statement
  on the page.

Rejected: **Yield**, whose formula the table two lines above already gives; and **DPH** / **Elapsed**,
which in this mocked run are blank (see Known issues).

The label scale is a **lift**, not a trim, and that is the opposite of `run-job-bar.png` for the same
reason both are right — label type is sized off the *capture* width, so a ~430px capture would
otherwise get labels two-thirds the size of the body text beside them. Because the finished figure is
narrower than the column and renders at native pixels, the corrected size is also the size on the page.

The heading label goes in the top margin and the Empty label in the right. Top costs height only; the
right gutter is the one that costs on-page type size, so it is sized by a two-line wrap rather than a
one-line one, which keeps the finished figure inside the content column.

### The backdrop

Both labels sit in derived margin outside the tile, so the backdrop rule applies — and the *No pad on
the clip* note above is the reason it matters more than it looks. That note explains that the margin
fill is the capture's dominant colour, which here is the tile's own interior: the tile therefore
appeared to run past its 1px border into both gutters, and the two labels read as printed inside the
product rather than beside it.

**Free.** The figure is 634px against a roughly 807px column, so it renders at native pixels, and the
4.5% floor (19px) takes it to 654 — still under. On-page type is unchanged at 15.0 CSS px and the
labels do not move, so the label scale is untouched. This is the general shape of the four Run details
that publish at 1:1: the padding floor is a percentage of a small capture, so it is a small number,
and the figure has room under the column to absorb it.

Measured on the rendered output, the labels go from 3.20:1 and 2.87:1 on the tile grey — the second of
those under the 3:1 floor for large text — to 8.40:1 and 9.79:1 on the gradient.

## Known issues

**DPH reads `—` and Elapsed `00:00:00`, on a job showing 3164 passes.** That is an artefact of the
shared mocked run, not of this figure: `elapsedSeconds` only ever arrives from the SignalR
`RunProgress` handler, and nothing in a mocked capture drives it. `run-overview.png` and every panel
of `run-themes.png` show the same two blanks, so the figures at least agree with each other. **Fixing
it means seeding `runStore` with an `elapsedSeconds` and re-shooting all three together** — otherwise
the detail figure would show a clock the overview does not, at an identical pass count. **Outstanding.**
