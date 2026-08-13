# shell-status-bar.png

`docs/help/images/getting-started/shell-status-bar.png` · 3060×569 · 316 KB ·
**aubergine backdrop** · *Navigating the Application* → Status bar.

## What it shows

The status bar, full width, ringed into the three zones the prose describes: the loaded job at the
left, an empty centre where progress appears, and the homing indicator plus extension status items
at the right.

## Getting back to something close

A crop of `figures/sources/app-shell.png`. Re-shoot the overview first, then re-derive the rectangle
with `scripts/measure.mjs`.

The bar runs the full window width, so a crop of it *is* a crop of the whole width — there is no
narrower honest framing. Include ~20px of the content area above the bar's rule so the strip reads
as sitting at the bottom of a screen rather than floating, but **not so much that the notifications
panel's footer count bar is caught**: an earlier crop left the bottom of its three severity glyphs
hanging into the top edge as an unexplained fragment.

## Why it is annotated the way it is

Three zones described by position, not a numbered sequence, so no numbers.

Three callouts, one per bullet in the prose. Each one passes the test easily: the picture shows some
text at the left, nothing in the middle and some coloured items at the right, and says none of what
any of it is.

The middle callout rings empty bar on purpose. Nothing is running in this capture, so the centre is
empty, and where to look is the whole of what the reader needs — seeding a run to fill it would
break the pixel agreement with `app-shell.png` for one control.

Rejected: the homing indicator, whose own three-state table is the section's other half. The capture
can only ever show one of the three states, and a fourth ring nested inside the right-hand one reads
as a mistake.

Labels are allowed three lines rather than the default two: at two lines the right-hand label ran
almost the full width of its third of the bar and finished within a hair of the figure edge.

**This is the only crop in the set whose `fontScale` is near the default**, and the reason is the
same as the reason the figure is marginal: the crop is the full capture width, so the default label
sizing is very nearly right already. Every other crop is magnified relative to the overview and has
to bring its labels back down.

## Why it carries a backdrop, and why its margin had to be sized by hand

All three labels sit in derived margin below the strip, outside the capture, so the backdrop rule
applies. **This is the one converted figure where the backdrop is not free**, because its margin is
*derived* rather than forced — and a derived margin does not override the backdrop's padding floor,
it is max'd against it. The floor therefore widens the figure, and the on-page scale falls out of the
published width.

`backdropPadding` is set to **90**, not the 129.6 the 4.5%-of-capture-width default would give. The
default is sized for a whole-window figure. Here it would put a gutter twice the height of the 68px
strip above it, take the figure to 3139px wide, and drop the bar's already-marginal 6.1 CSS px text to
5.6px. At 90 the figure is 3060×569, the text lands at 5.7px, and there is still ~24 CSS px of
gradient on the page above and beside the strip — enough for it to read as floating. The bottom margin
is unaffected either way: it is `max(floor, derived)`, and three three-line labels derive 411px.

`fontScale` moved from 0.76 to **0.8075**, and the value is a derivation, not a tuning: label type is
sized off the capture width, so widening the figure by the side padding scales every label down on the
page by exactly `oldWidth ÷ newWidth`. Multiplying that ratio back in — `0.76 × 3060 ÷ 2880` — holds
the labels at the 16.2 CSS px they measured on white, and the measured result is 16.2. **Re-derive it
the same way if `backdropPadding` ever changes; do not nudge it.**

195 → 316 KB, the largest byte cost of the four conversions, because it is the largest canvas and the
gradient now covers most of it.

## Known issues

**This is the one figure in the set that cannot be magnified, and it ships anyway.** The full capture
width into the help column is a scale near 0.28, so the bar's 11 CSS px text renders around 6px —
unreadable, and barely larger than in `app-shell.png` itself. Accepted deliberately: the section is
*about* the three-way division of the bar, the targets are 500–950px zones rather than 30px glyphs,
and the labels carry the meaning at full size. A reader does not need to read the job name; they need
to know that the loaded job is what sits there. Cropping to one end would make the text legible and
destroy the division, which is the figure. It is the marginal one of the five — if any gets dropped,
this.

**The centre target is arithmetic, not detection, and it is the only one in the whole set that is.**
Empty space has nothing to detect: the region finder returns nothing inside the bar, its ground being
the bar's own fill rather than the page background. The two edges were derived from `StatusBar.tsx` —
a flex row with `px-3` and three `flex-1` spans, so each zone is `(captureWidth − 48) ÷ 3` and the
middle one starts one zone in. The measured content confirms the model: the right zone's last ink
ends exactly 24px short of the capture's right edge. Re-derive from that arithmetic if the capture
width changes; do not nudge the numbers. **Nothing but the golden would notice this sliding off the
empty centre**, and the golden is local-only on a fresh clone.
