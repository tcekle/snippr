# shell-activity-rail.png

`docs/help/images/getting-started/shell-activity-rail.png` · 800×298 · 58 KB ·
*Navigating the Application* → Activity rail.

## What it shows

The top of the activity rail on the aubergine backdrop, against the open Notifications panel it sits
beside. Two callouts, one each for the two icons that are always present: the notification bell with
its unread badge, and the head camera.

## Getting back to something close

A crop of `figures/sources/app-shell.png`. Re-shoot the overview first, then re-derive the rectangle
with `scripts/measure.mjs`.

**Both icons sit in the first ~170px of a strip well over 1600px tall.** Running the crop down to the
status bar would add ~1500px of empty rail and, because the figure would then be height-capped at
60vh, would shrink the two icons this figure exists to show from about 38px on the page to about
13px. Stop it a little past the camera cell so the strip visibly continues rather than ending.

**The bottom edge is exact.** y stops at 330, not 360: the first notification's collapse chevron
begins at 338, and a crop that reaches it leaves a lone chevron floating with nothing to belong to.
330 still runs ~68px past the camera cell.

**The left edge is a budget, not a preference.** 440px is the widest crop that still publishes at 1:1
— 440 + the 336px gutter + 24 = 800, against a ~805px content column — and x=2440 is the left edge
that cuts through panel whitespace only. *Clear all notifications* starts at 2505 and the Read tab's
text at 2565, so nothing is severed mid-word; a 220px crop starting at 2660 was tried and cut *Clear
all notifications* to *ications*. The panel has no vertical rule anywhere between its own left edge
(2032) and the rail (2792), so unlike `shell-notifications` there is no divider to align the cut to.
It is an honest crop edge with the backdrop's hairline on it.

**The gutter is on the right, and the side matters more than the width.** See below.

**This figure publishes at 1:1.** 800px is under the content column, so `max-width: 100%` renders it
at its own pixel size — the label size in the spec is literally the label size on screen, which is
why its `fontScale` is far below every other crop's. That was true of the old 468px version too and
survives the re-frame unchanged.

## Why it is annotated the way it is

Two named icons, not a numbered sequence, so no numbers.

Two callouts, one per icon, and they are the entire reason the figure exists: both controls are bare
glyphs with no caption, so naming them is exactly what the picture cannot do for itself. The badge
overlaps the bell and resolves as one ink cluster with it, which is what should be ringed anyway.

Rejected: the prose's other point, that further icons appear only on the screen that provides them.
It is about icons that are absent here, and absence has no pixels.

Also not called out: **the bell cell is white with a blue bar down its left edge because its panel is
open** — the state `app-shell.png` was captured in. The prose does not describe the active treatment,
so ringing it would introduce a distinction the article never makes. The open panel beside it is what
explains it to a reader who notices, and the article's caption already says so.

**Both targets resolve in source coordinates and are independent of the crop.** The rail panel is
bounded by the shell's two horizontal rules (78 and 1752) and by the last vertical rule in the capture
(2792), which is the one the rail hangs off; the topmost two ink clusters inside it are the bell and
the camera. Bounding it with `"edge"` instead is wrong and fails silently: `edge` means the
*capture's* edge, so the panel reaches y=0, swallows the title bar's help icon, and that takes index 0
and slides both callouts up one — a render where both labels point at the bell.

## The backdrop, and the re-frame that earned it

**This figure satisfied the backdrop rule for a long time and was left on white anyway, on
composition.** Both labels sat in a forced gutter outside the captured strip, so by the rule it should
have carried the gradient. At the old crop it was rendered three ways — a 24px trim, `{64, 120, 64,
336}` and `{90, 170, 90, 360}` — and every one read as a pale stripe stranded on a large empty purple
field rather than as a window floating on a backdrop. The captured strip was 108×280 in a figure that
had to be at least 468px wide to hold two ~290px labels: about **7% of the figure's area, spanning
23% of its width**, with both labels to its left. Giving it more room made it worse, because margin
enlarges the purple and not the strip.

The fix was to stop cropping the rail out of its context. It is now **46% of the figure's area and
spans 55% of its width**, which is the same shape as `shell-title-bar` — a capture that bisects the
picture rather than floating in it.

Including the panel is not filler. It is the only thing in the capture that explains the bell cell's
active treatment, and the article's caption already leans on it.

**Moving the gutter from left to right is the part that is easy to get wrong.** The two icons sit 14px
from the capture's right edge and the whole width to their left is notifications panel — and the
panel's content lands in exactly the two lanes the leaders need: the header's close × sits on the
bell's row and the *Read* tab sits on the camera's row. Rendered with the labels still on the left,
both leaders slice horizontally across panel text. From the right they cross 14px of rail and nothing
else. The labels are also then adjacent to the strip they name instead of a figure-width away from it.

Measured on the published output, the labels run **8.28:1** and **7.63:1** against the gradient behind
them. Nothing here uses `labelIn`, so the palette trap that governs `app-shell` and once governed
`service-mode-banners` does not apply.

Other framings tried and rejected:

- **Crop height 185** (stopping before *Clear all notifications*). Tighter, but the rail ends 41px
  past the camera and reads as though the strip stops there, and the panel is reduced to a close × and
  the word *Read*, which is a slice of nothing in particular.
- **Crop height 300.** Reaches the first entry's chevron. See the bottom edge above.
- **Crop from the panel's own left edge (2032, 848px wide).** The figure goes to 1208px, the site
  scales it to 0.67, and the icons drop from 38 to 25 CSS px. Worse: holding the label size through a
  downscale needs a proportionally wider gutter, which widens the figure again. At 1:1 the gutter is
  exactly what the label needs, so 1:1 is the equilibrium and every pixel of remaining width should go
  to the capture.
- **Including the title bar above the rail.** Good vertical context, but it puts a second, unlabelled
  bell directly above the labelled one.

## Known issues

- **The figure is 58 KB, up from 22 KB.** 2.2× the pixels and a gradient instead of flat white. The
  set has no image-optimisation pass; see Outstanding in `FIGURES.md`.
- **It shows part of the Notifications panel, which has its own figure two sections later.** The
  overlap is deliberate and the two are framed differently, but a reader skimming could take this for
  a notifications figure. The labels and the caption are what keep it on the rail.
- Inherits the overview's open-panel state, which here is the point rather than a defect.
