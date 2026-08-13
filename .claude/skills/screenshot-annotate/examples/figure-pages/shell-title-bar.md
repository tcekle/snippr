# shell-title-bar.png

`docs/help/images/getting-started/shell-title-bar.png` · 1310×404 · 110 KB · **aubergine backdrop** ·
*Navigating the Application* → Title bar.

## What it shows

The right-hand end of the title bar — bell, theme glyph, username, help — with three of the four
ringed. Same signed-in Supervisor session as the overview.

## Getting back to something close

A crop of `figures/sources/app-shell.png`, not a capture of its own. Re-shoot the overview first;
then re-derive this rectangle with `scripts/measure.mjs`.

**Crop the right-hand end, not the whole bar, and this is the one contested call in the set.** The
bar spans the full capture width, so a full-width crop renders at 0.28 in the help column and puts
every glyph at about 8px on the page — no better than the overview, which already rings the whole
bar. Worse, the four controls are packed into the right 15% of that width, and four labels around
200px wide cannot be fanned around targets 80–140px apart, so the full-width version is **not
annotatable at the control level at all.** That is the argument; it is not aesthetics. The left edge
of the crop clears the Desktop BETA badge and leaves several hundred pixels of empty bar so the
result reads as the end of a bar rather than a floating cluster of icons, and the bottom edge runs a
few pixels past the bar's own rule so the boundary is visible.

Forced gutters above and below, sized so the finished figure lands near 1300px — which is what puts
the bar's 13 CSS px text at roughly body size once the site scales it into the column. Side margins
here are not decoration; they set that scale.

## Why it carries a backdrop

Every label in this figure sits in synthesized margin above or below the bar, not on captured pixels,
so there is an "outside the window" here and the backdrop rule fills it. It is the repo owner's own
worked example of the rule.

**It cost nothing but bytes.** The margins are forced, and a forced margin replaces the backdrop's
4.5%-of-width padding floor outright, so the published PNG is still 1310×404 — the same crop scale,
the same 16.0 CSS px bar text, the same 17.8 CSS px labels as it had on white. The file went from 59
to 110 KB; a gradient does not compress like flat white, and these ship in a PDF.

The palette lifts to the dark-ground amber automatically: rings and leaders to `#CE7A1A`, labels to
`#F6BA58`. Measured against the aubergine ground actually under them, the labels come out 6.9:1 — the
lifted amber is what makes that work, and the light-background `#BF6F14` would have been near 2:1.

`cornerRadius` stays at **0**, unlike `app-shell.json` and `system-blocker.json`. Those two round to
26 for fidelity, because they photograph the whole application window and the real window has rounded
corners. Three of this crop's four edges are cut lines through the middle of a bar; rounding them
would invent a window boundary that is not there.

## Why it is annotated the way it is

A control table, not a numbered sequence, so no numbers.

**Three of the four controls in frame.** The bell, the theme glyph and the username are bare glyphs
whose function is not guessable — a bell that could be an alarm, a sun that could be brightness, a
username that does not look like a menu. The help **?** is deliberately **not** ringed: it is the
universal help glyph and the prose's entire entry for it is the word "Help", so a callout would say
only what the picture already says.

Labels alternate above and below, because three ~200px labels will not share one gutter over targets
80px apart. The two sharing the top gutter carry small opposing shifts so their boxes clear each
other; neither can be centred on its target.

**Targets come from an ink pass over the bar, and three of its parameters are load-bearing.**
Edge-touching clusters must be *allowed*, because the unread dot is clipped by the top of the window
(`TopBar.tsx` pins it at `-top-1`) — the default drops it and the bell rings without its badge. The
dilation must be raised above the default so the dot merges into the bell and the person icon merges
into the username, which is what should be ringed in both cases. The pass then yields exactly six
clusters left to right: logo, BETA badge, bell, theme, username, help.

**The third is the threshold, and only the bell's pass lowers it.** While the Notifications panel is
open its button carries a pale circular background — the app's `#E2E8F0` input fill, 80px across,
hanging below and to the left of the glyph. At the default threshold the detector cannot see it, and
the figure shipped for a while with the ring closed around the bell and the dot and a crescent of the
button's own ground outside its lower-left corner. **Ringing a button means ringing the button**, so
the repair admits the background to the cluster rather than padding the ring out to reach it: padding
is the wrong shape for an asymmetric miss as well as the wrong doctrine, and a `rect` would forfeit
the measure-don't-eyeball guarantee for a control the pipeline can still name. The number carries its
own reason and therefore survives onto this page: `detectInk` quantises the bar's fill to a base of
`#F0F0F8`, the bar background sits 4.1 from it and the button's circle 18.0, so the threshold has to
fall between them. Both ends were rendered — at 18 the cluster snaps back to the bell-plus-dot box
that caused the defect, at 4.1 the whole title bar becomes one cluster — and anything from 5 to 17
yields the identical six clusters, so the midpoint is chosen for margin rather than for which pixels
it picks. The other two callouts keep the default: their glyphs are 240–270 from the base and nothing
pale sits behind them.

Ring slack is untouched by any of this — all three rings pad 8.9–9.6px on every edge, the same as
they always did. The bell's ring is larger than its neighbours' because the control is: an 80×76
button against a 28×28 glyph.

## Known issues

- **Two of the section's six table rows are missing from the figure.** The **PSV** logo is at the far
  left, outside the crop — a wordmark needs no identifying and the caption says where it is. The
  **window buttons** are in no capture this project can make (`{isElectron && …}` in `TopBar.tsx`);
  see the index's Outstanding list.
- The three ink indices are positional. If the title bar gains or loses a control, re-derive them
  rather than nudging the numbers.
- **The bell's ring crosses the bar's own rule at the bottom and overhangs the crop at the top, and
  that is not a defect to repair.** The button is 76px tall in a 78px bar and is clipped by the top
  of the window, so no ring with any slack at all can stay inside the bar. Both overhangs land in the
  backdrop margin, which is what the margin is for. Tightening either one puts the stroke back on the
  control.
- **The pale circle is the button's *open* state**, because this capture has the Notifications panel
  showing. Shoot the bar with the panel closed and the circle is gone — the button is then a bare
  bell, the low threshold has nothing extra to find, and the ring correctly shrinks to the glyph.
  Re-check this callout after any re-shoot rather than assuming the threshold still earns its place.
