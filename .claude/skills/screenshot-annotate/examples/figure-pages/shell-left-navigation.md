# shell-left-navigation.png

`docs/help/images/getting-started/shell-left-navigation.png` · 878×1204 · 184 KB ·
**aubergine backdrop** · *Navigating the Application* → Left navigation.

## What it shows

The navigation pane, whole, as a Supervisor sees it — which is why both **Sagas** and **Users** are
present. Two callouts.

## Getting back to something close

A crop of `figures/sources/app-shell.png`. Re-shoot the overview first, then re-derive the rectangle
with `scripts/measure.mjs`.

Start the crop a few pixels above the title bar's rule so the pane reads as hanging below it, and
end it just past the **About** row. The pane itself runs on to the status bar, but the several
hundred pixels below About are empty and cost on-page size for nothing: **this is the one figure in
the set capped by height rather than width**, so every pixel of crop height comes straight off the
scale. Run the right edge a little past the pane's own rule so the boundary with the content area is
visible.

A forced right gutter, because neither target touches the capture's frame and a pane this narrow has
no whitespace to hold a label. Because the 60vh cap and not the column width is what sizes this
figure, widening the browser does nothing for it — the on-page scale is constant from a 1280 to a
1920 viewport.

## Why it carries a backdrop

Both labels sit in the forced right gutter, outside the captured pane, so the backdrop rule applies.
Costless: the margin is forced, a forced margin replaces the backdrop's padding floor, so the
published PNG is still 878×1204 and the pane's 13.9 CSS px item text and 16.9 CSS px labels are
exactly where they were on white. 101 → 184 KB.

**The margins were deliberately left alone, and that is the interesting part.** The gutter is 430px
on the right but only 20px top and bottom and 24px left, so the pane sits on a thin trim of gradient
on three sides. Enlarging that trim was tried and rejected, because *this is the one figure in the set
whose on-page size is set by the 60vh cap rather than the column* — height is the expensive axis here
and width is the free one. Growing the top and bottom to a proportionate 44px would take the figure to
1252px tall and the pane's item text from 13.9 to 13.3 CSS px, spending the figure's whole remaining
type budget on gutter. The thin trim reads anyway: the compositor draws a blurred window silhouette
and a hairline edge stroke, and those separate the pane from the gradient on all four sides without
needing space.

If a future pass does want more room, take it out of **width** — left and right can grow to a combined
~1620px before the column, rather than the 60vh cap, becomes the binding constraint.

## Why it is annotated the way it is

A pane inventory, not a numbered sequence, so no numbers.

**Two callouts, and the restraint is the point.** Every entry in this pane carries its own visible
text label and the prose lists all of them by name, so ringing **Run** to say "Run" is the weak
version — the picture already says it. What the picture does not say is what the unlabelled glyph at
the top does, and that one entry is not there for everyone:

- *Collapses the pane to an icon strip*, on the hamburger. A widely understood glyph, but not a
  self-explaining one, and the prose gives it a paragraph.
- *Visible only with the ManageSettings permission*, on **Sagas**. This is the section's "two
  operators at the same machine can legitimately see different navigation" note made concrete on the
  one entry the prose singles out.

Rejected: every named row, for the reason above. Also rejected as unphotographable — the prose's
stronger claim that missing entries are *hidden* rather than greyed out. Absence has no pixels, so
the figure shows one gated entry and names the gate instead.

## Known issues

**The Sagas target is the weakest description in the whole set.** The pane has no rules inside it to
bound a row with, so the target is the union of two ink clusters taken by index down the pane — the
second item of the SETUP group. That is stable against one fixed capture and nothing else. If the
pane's contents ever change, re-derive with `scripts/measure.mjs`; do not nudge the indices.
