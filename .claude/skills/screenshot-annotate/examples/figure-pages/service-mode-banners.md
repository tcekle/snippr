# service-mode-banners.png

`docs/help/images/getting-started/service-mode-banners.png` · 2160×668 · 166 KB ·
*Navigating the Application* → Banners and blocking overlays. Cross-referenced from
*Run* → Service modes.

## What it shows

The top of the app on the aubergine backdrop, with both service-mode banners live, stacked under the
title bar: no pick/place mode above, wrap-around mode below, and a band of dashboard beneath them so
content is visibly pushed down. Two callouts, one in the gutter above and one in the gutter below.

## Getting back to something close

`ServiceModeBanner` renders from `GET /system/service-modes`, so answer it with both flags true and
clip the top of the shell. No store seeding needed — this one is a plain REST mock.

**Viewport width 1040, deliberately.** It is the narrowest width at which the longer (dry-run) banner
still fits on one line the way it does on a real 1440px window. On-page type size is
`capture-font-size × column-width ÷ published-width`, so a narrow capture is what keeps the 13px
banner text legible once the site scales the figure into its column. `run-job-bar.png` makes the same
move at 1152 for the same reason.

**The capture is 2080×560 and the figure uses the top 300 of it.** That cut is load-bearing, not
tidying — see the backdrop section below.

## Why it is annotated the way it is

No numbers: the section is prose with a two-item bullet list.

Labels are the article's own bold lead-ins for the two bullets, so a reader can map bullet to strip.
The banners carry their full explanation already, so a label that repeated it would say nothing the
ring does not.

**Ring each banner's *contents*, not the strip. This is the trap worth knowing about.** A strip runs
edge to edge, so ringing it draws nothing but two horizontal rules per banner — four in all — and the
pair at the shared boundary reads as one doubled rule with the leader's arrowhead merged into it.
Fusing each banner's icon and sentence into a single ink cluster instead rings as a rounded rect with
visible ends, and gives the two banners visibly different ring widths.

Two knock-on consequences, both of which cost a render to find:

- **A minimum-height filter is required on the strip selector.** The 2px rules under each banner are
  the same width as the banners and would otherwise take index slots.
- **Both callouts must force their own margin.** A gutter is normally derived from the target
  touching the frame, and ringing the contents rather than the strip pulls both targets *off* the
  frame — without the force, the first label is laid inside the title bar and the second inside the
  dashboard.

**Both labels go above or below their own strip, never beside it.** Both banners run edge to edge, so
anything reaching the lower banner from the side has to cross the upper one. Side gutters were tried
and rejected twice, on the same arithmetic: on-page UI size is `26px × column-width ÷ published-width`,
so a gutter wide enough for a 380px label takes the banner text the figure exists to show from 10.1
to about 8 CSS px, while a vertical gutter costs nothing at all.

## The backdrop, and the crop that made it possible

**This figure was converted, measured, reverted, and then converted again — the second time by
changing the composition rather than the palette.** Both attempts are worth carrying, because the
first one records a failure mode that will recur.

The rule says a figure with annotation content outside the app window takes the aubergine gradient,
and this one has some: *No pick/place mode* sits in a derived gutter above the capture. The first
attempt set `backdrop` and changed nothing else. It fails, because the palette is chosen **per
figure, not per label**, and the old layout put *Wrap-around mode* inside the frame with `labelIn`,
on the white band the dashboard leaves above the Quick Actions tiles. A dark backdrop lifts every
label to `#F6BA58`, which is a dark-ground colour:

| Label | Ground | On white | On aubergine (naive) | Now |
|---|---|---|---|---|
| *No pick/place mode* — gutter | `#F1F4F8` → gradient | 3.46:1 | 8.17:1 | **6.81:1** |
| *Wrap-around mode* — was inside the frame | white dashboard band → gradient | 3.82:1 | **1.77:1** | **7.68:1** |

The *on white* column reads 3.46 and 3.82 where the first pass recorded 3.52 and 3.89; nothing drifted,
the two passes sampled the ground differently (modal colour of the label's own box here, the flat fill
there). The *now* column is lower than the naive 8.17 for the same reason plus a real one: the figure
is 108px narrower and 69px shorter than the naive conversion would have been, so a different part of
the gradient sits behind the label. All four numbers in the last two columns are sampled off the
published PNG.

The fix is not a colour, it is the placement: **move the label out of the frame so both labels sit on
the same ground.** That also cures the deeper problem, which is that one label was a caption on the
application and the other a caption on the page.

Moving it costs a crop. Both banners run edge to edge, so the lower label can only come from below,
and the four Quick Actions tiles start at y=308 and run to the foot of the capture with 28px between
them — there is no lane for a leader. Above the tiles there is nothing but the hamburger, the QUICK
ACTIONS heading and white. So the crop stops at **y=300**, 8px short of the tiles so they are absent
rather than shaved, and the leader comes up through the white. The figure loses the tiles and keeps
what it needed them for: content is visibly pushed down below the banners.

Two things the gradient buys, both of which were already true and are worth recording as gains rather
than re-discovering as arguments:

- **The old gutter was a lie.** With no backdrop it is filled with `report.background.hex`, which for
  this capture is `#F1F4F8` — the shell's own background — so the band above the title bar read as
  more application chrome and the figure implied the window extended to the top of the picture. The
  gradient makes the window's top edge unambiguous.
- **Section consistency.** `system-blocker` is the other figure in the same *Banners and blocking
  overlays* section and it has always carried the gradient.

**`backdropPadding` is hand-sized to 40, and that is the one real cost.** This figure's margin is
derived rather than forced, so the padding floor widens it and every UI pixel shrinks on the page. At
the 4.5% default the figure goes to 2268px and the banner text drops from 10.1 to 9.2 CSS px; at 40 it
goes to 2160 and 9.7. Zero side padding was also tried — it holds 10.1 exactly, by keeping the figure
at 2080 — and rejected, because the window then bleeds off both sides and the gradient survives as two
horizontal stripes rather than a surround, which is the failure the padding floor exists to prevent.
`fontScale` was re-derived as `0.8 × 2160 ÷ 2080` so the labels stayed at the 17.1 CSS px they
measured on white; re-derive it the same way if the padding ever changes.

## Known issues

- **The banner text is 9.7 CSS px on the page, down from 10.1.** Inherent to a width-limited figure
  that gained side padding. The only way back is a narrower capture, and 1040 is already the narrowest
  width at which the longer banner stays on one line.
- Not called out: the amber colour itself. The style guide's unresolved list notes that annotations
  and the product both use amber here, so a reader may read a callout colour as a machine-state
  colour. This is the figure where that collision is sharpest, and the backdrop sharpens it further —
  the labels are now `#F6BA58` while the banners are `#FDE68A`.
- **The figure is shared, not duplicated.** *Run* → Service modes cross-references this figure rather
  than shipping a second copy of the same two banners.
