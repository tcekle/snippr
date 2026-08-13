# Figure doctrine

**If you read one file in this bundle other than the README, read this one.** `SKILL.md` tells you
which keys exist. This tells you which figure to make. It is the accumulated result of making
twenty-nine real figures for a real manual, including the ones that were made twice.

## About the examples

Every rule below is stated with the figure that proved it and the number that settled it. Those
figures come from the PSV / Maestro help site, so names like `unsaved-changes`, `sign-in` and
`service-mode-banners` are screens you have never seen. **Read past the names.** The rules are about
contrast ratios, margins, crops and what a callout is allowed to say — none of that is
product-specific. The numbers are arithmetic and they will be the same on your screens.

The full page for each named figure is in [`examples/figure-pages/`](examples/figure-pages/), and the
original unedited index it all came from is
[`examples/FIGURES-psv-original.md`](examples/FIGURES-psv-original.md). Both are reference, not
required reading.

---

## The test every callout has to pass

**Does the callout say something the picture doesn't?** The single test. A ring labelled "Cancel"
beside a button captioned Cancel says nothing; a ring labelled *Cancels leaving, not the edits* says
what the caption cannot. Callouts that name a part the prose already names get cut. Callouts that name
a **consequence**, a **scope**, or an **unlabelled glyph** get kept. Record the rejections, because the
next person will otherwise re-propose a callout that was already considered and cut.

The shortest worked example of that whole paragraph is the bundled demo: three callouts kept, five
recorded as cut, in the `_rejected` key of [`example/demo.json`](example/demo.json). It also carries
the sixth lesson, which is that **a callout you cannot describe without a coordinate is a callout you
cannot keep** — one of its five rejections was honest and useful and was dropped purely because the
cell it pointed at had no selector behind it.

**Measure, don't eyeball.** Specs describe targets ("the second swatch inside the card", "the leftmost
ink in each entry block"); they do not contain coordinates. A hardcoded coordinate drifts silently —
the figure still renders, with every callout pointing at nothing. Of twenty-nine figures, exactly one
target in the whole set had no selector behind it, and it is recorded as a known defect.

**One style, house-wide.** `marker-rings` is the only permitted style in the PSV set. Eight other
presets are implemented and reachable via `--style`; they were reviewed and not kept. A figure
arriving in a different hand is a defect, not a variation. Pick one for your project and hold it —
even a figure with zero callouts should record the style, so that if a callout is ever added it
arrives in the house hand.

---

## Backdrops: when, not how

(How a backdrop is drawn is [`references/style-guide.md`](references/style-guide.md) §6. This is
which figures get one.)

**A backdrop goes on any figure whose annotation content sits outside the app window.** If labels
live in synthesized margin around the captured UI, that margin is not part of the product and a dark
gradient says so. If every annotation is contained within the captured view, the figure stays on
white, because there is no "outside" to fill. Whole-canvas or crop is not the test — this supersedes
an earlier rule that said backdrops were for whole-canvas figures only, which is why several crops
with large label gutters shipped on white and were converted later.

`unsaved-changes` is the worked example of the contained case, and it is the one that looks like it
should have a backdrop and deliberately does not: its three labels are drawn on the dimmed page
*behind* a modal, inside the capture, so its published PNG is exactly its source's 1350×912 with no
margin at all. Nothing would go under a gradient but the figure's own edges.

**`sign-in` is the second, and it is the better cautionary tale**, because it looks nothing like the
contained case: four labels, four long sweeping leaders, two thirds of the frame empty. Its margins
are also 0/0/0/0 — the published 2506×1034 is a crop of the capture and nothing else — and all four
labels land on the page's own ground *inside* the crop. Rendered on a dark backdrop to check rather
than to assume, all four fall from 3.46:1 to **1.57:1** and on-page type falls from 9.0 to 8.1 CSS px.
**The test is the margin, not the whitespace. A figure can look like it has a gutter and have none**,
and empty product background is not a gutter.

**`programmer-add` and `unsaved-changes` are the same class of screen resolved two different ways,
and the pair is the clearest statement of the rule there is.** Both are a modal over a dimmed page.
`unsaved-changes` has three labels that had to stay inside the frame, because a side gutter wide
enough for them would have cost about a fifth of the dialog's type — so it takes plates and no
backdrop. `programmer-add` has two labels and both targets on the card's right-hand edge, so the
gutter is affordable and the backdrop follows. Nothing about the *kind* of screen decided either
one; what decided both is whether the labels could leave the frame.

**Two figures were rejected first, and both rejections were sound about the figure as it stood.**
Neither was overturned by re-reading the rule; each was overturned by changing the figure so the
objection stopped applying, and that is the pattern to copy rather than the verdicts:

- `service-mode-banners` had one label in the gutter and one placed inside the frame with `labelIn`,
  where the dark palette measured **1.77:1**. Moving the second label out into a bottom gutter puts
  both on the same ground; both now measure above 6.8:1. It cost a crop — the tiles below leave no
  lane for a leader coming up from underneath, so the capture stops above them.
- `shell-activity-rail` was a 108×280 strip in a 468px figure — 7% of the area, 23% of the width —
  and read as a stripe on an empty purple field at every margin tried. Widening the crop to take in
  the panel the rail sits against makes it 46% of the area and 55% of the width, and moving its
  gutter from the left to the right stops both leaders crossing panel content.

### What a backdrop costs

**Adding a backdrop to a crop with forced margins is free; to one with derived margins it is not.**
A forced margin replaces the backdrop's 4.5%-of-width padding floor outright, so the published PNG
keeps its exact dimensions and on-page type does not move at all — only the gutter colour, the label
palette and the byte size change. A *derived* margin is max'd against the floor instead, so the floor
widens the figure and every UI pixel in it shrinks on the page. `shell-status-bar` is the worked
example: it needed `backdropPadding` hand-sized to 90 and `fontScale` re-derived as
`old × newWidth ÷ oldWidth` to hold its type. Check which kind of margin a figure has before
promising the change is free.

**Zero side padding is not the way out of that.** It does hold the UI size exactly — the figure keeps
its capture's width — but the window then bleeds off both sides and the gradient survives as two
horizontal stripes rather than a surround, which is precisely the failure the padding floor exists to
prevent. Pay the few percent instead.

**A small detail clip that already publishes under the column pays nothing at all, and that is the
common case, not the exception.** The floor is 4.5% of the *capture*, so on a 400px clip it is 18px a
side, and a figure with room under the article column absorbs that without ever being scaled. Four
1:1 detail figures converted at exactly zero cost to on-page type — 15.0 → 15.0, 16.5 → 16.5,
15.0 → 15.0, 18.0 → 18.0 — and their labels did not move either, so `fontScale` stayed untouched.
Check the width before assuming the conversion is expensive: the two figures that had to pay were a
full-width strip and a 1314px bar, both already over the column.

**Synthesized margin and a backdrop are the same thing, and stacking them is worse than either.**
Four sources were clipped flush against real screen edges and composited onto a corner-sampled band
by a padding step, 48px on all four sides. A backdrop supplies that margin itself — so on conversion
the pad has to be cropped back off, and not for tidiness: `composeFigure` draws the drop shadow and
the hairline around the **screenshot rectangle**, so with the pad left in, the object floating on the
gradient is a flat slab of corner-sampled grey with the UI somewhere inside it. The window silhouette
stops being the window. Cropping it also pays for the conversion outright, since the figure comes out
narrower than it was on white: 767 → 688, 802 → 723, 1607 → 1498 (10.5 → **11.3** CSS px) and
1101 → 1036 (15.4 → **16.4**).

**Captured pad is content and stays.** The counter-example is easy to confuse with the above: one
menu clip is padded 8 CSS px because the menu's drop shadow lives outside its border box, and those
pixels are real page ground. On the gradient they publish as a thin light mat between the UI and the
backdrop, which is what they are. Synthesized margin is what a backdrop replaces; captured margin is
part of the picture.

**Correct a padding tax; do not correct a zoom.** `fontScale` is re-derived as
`old × newWidth ÷ oldWidth` when a backdrop's side padding widens a figure, because that padding adds
nothing to the picture and shrinks everything on the page. It is **not** re-derived when the width
moves because a redundant mat came off: that is a uniform zoom, every pixel in the figure changed by
the same ratio, nothing inside it moved relative to anything else, and correcting it would make the
labels smaller against the UI than they were tuned to be.

---

## Legibility: the part that is physics, not taste

**The label palette is chosen once per figure, and `labelIn` can defeat it.** A dark backdrop lifts
every label to a light amber, which measures 6.8–8.3:1 on the gradient and **1.77:1** on the app's
white content area. A label placed inside the frame with `labelIn` on a dark-backdrop figure is
therefore below the 3:1 floor for large text. Two of `app-shell`'s four labels are, and that defect is
recorded on its page rather than quietly shipped.

**A mid-grey ground caps the achievable contrast for *any* ink, so on one, no colour is the fix.**
This is the general lesson and it is worth internalising before reaching for a palette. Contrast is a
ratio of luminances, so the darkest ink and the lightest ink are both *closer* to a mid grey than
either is to black or white. Against the `#999999` of a modal's dimmed page, pure white — the best
light ink that exists — reaches **2.85:1**, under the 3:1 floor for large text; `#F6BA58` reaches
1.64:1 and `#BF6F14` reaches 1.34:1. Only near-black clears it, at 5.7:1, and near-black is not this
hand. Whenever a label lands on something mid-toned, stop tuning the ink: the ground is the only
variable left.

**The lever for that is `labelPlate` — the label brings its own ground.** A spec-level opt-in that
draws a dark hand-edged chip behind every label and puts the lifted amber on it, giving the same
ink-on-ground pair a gutter label gets on the backdrop. `unsaved-changes` is the worked example: its
three labels went from 1.33:1 to **8.59:1** with no change to the figure's dimensions, its crop, or
its on-page type size — which is what makes a plate cheaper than either of the two remedies below.
Three things to know before using it:

- **The edge is hand-drawn on purpose.** A crisp rounded rect on a screenshot reads as a toast or a
  tooltip belonging to the *product*, and a figure must not invent UI. The Rough.js edge is what says
  "annotation". A crisp version was rendered and rejected on exactly this.
- **It covers capture pixels.** Unlike a highlighter band, which is punched out so the control shows
  through, a plate is opaque-ish and drawn on top. Put it over flat background, verify by pixel row
  which content it lands on, and expect to hand-place the row it sits in.
- **It is off by default and stays off.** No existing figure changed when it landed. It is the right
  answer for a label that must stay inside the frame, not a general upgrade.

**The two older remedies are still the right ones when they apply.** A gutter is better than a plate
whenever the label can leave the frame at all, because a label on the figure's own ground needs no
furniture; a backdrop is better whenever the figure has synthesized margin anyway. Reach for a plate
when both are ruled out — a contained figure whose labels are wanted in place.

**The gutter remedy, in full.** `service-mode-banners` had the same defect and is now the worked
example of the cure: its inside-the-frame label moved out to a bottom gutter, where it takes the same
ground as the other one and measures 7.68:1 instead of 1.77:1. Relocating a label is usually not free
— that one cost a crop, because the leader coming up from the new gutter needed a lane. Reach for it
before concluding a figure cannot take a backdrop. The deeper point is that a `labelIn` label on a
dark-backdrop figure is a caption on the *application* while its neighbours are captions on the
*page*; the contrast number is the symptom.

---

## Sizing: the arithmetic that drives most framing decisions

**On-page type size is `capture-font-size × column-width ÷ clip-width`,** and it does not depend on
the device scale factor at all. A docs site that gives figures `max-width: 100%` and never upscales
will scale a figure wider than the column down — and the scale factor drops out — while a figure
narrower than the column renders at its own pixel width and the scale factor *is* the on-page zoom.
Two consequences:

- **Cropping buys roughly 2.7× the on-page size of the same pixels.** A 2880px whole-window capture
  renders around 0.28 in an ~805px article column; a ~1070px crop of it renders around 0.75. That is
  the entire argument for cutting a detail out of a whole-window shot rather than ringing it in place.
- **A height cap binds on tall figures**, and a height-capped figure does not grow when the browser
  widens. Check your site's CSS for one (`max-height: 60vh` in the PSV case).
- **A figure that already fits the column at 1:1 should spend every remaining pixel on the capture,
  not on the gutter.** Below the column the site does not scale, so the gutter is exactly the label's
  own width and no more. Widen past the column and holding the label size needs a proportionally
  wider gutter, which widens the figure again — the downscale eats what the extra capture bought.
  1:1 is the equilibrium. The worked example: 440px of capture + a 336px gutter + 24 = 800, against
  an ~805px column.

**`fontScale` corrects label size in both directions.** Label type is sized off the **capture** width,
not the crop, so a crop of a 2880px capture needs it far below 1 and a ~400px detail clip needs it
above 1. Target **15–18 CSS px** against 16px body copy.

---

## Capturing the screenshot

Most of the PSV capture recipe is specific to that app and is not reproduced here, but two lessons
are not:

- **Whole-window figures at `deviceScaleFactor: 2`; detail clips at 1.5.** A whole-screen capture is
  scaled down to the column regardless, a clipped control is not — so a clip at 2 draws at twice the
  size of the body text around it.
- **`palette: false` on any sharp `png()` call that also passes `effort`.** In sharp, `effort`
  implies `palette: true`, which silently quantises to 256 colours. Verified: `effort` alone gives
  colortype 3; `effort` with `palette: false` gives 6. This has already cost one re-shoot, and the
  damage is invisible until you compare two figures that were supposed to show a colour difference.

And the structural lesson, which is what makes the pages in `examples/figure-pages/` exist at all:
**decide up front which links in the chain are committed.** In the PSV set only the published PNG is
— the capture script, the raw source, the spec and the golden are all local-only and leave with the
branch. That is a defensible choice, but it means re-deriving a figure is a re-shoot, not a re-render,
and the *only* thing standing between the next person and a blank page is the prose page describing
what the figure showed and how to get back to it. If you commit your sources and specs instead, you
need those pages far less. Pick deliberately; do not drift into the first one by accident.

---

## Before you ship a figure

- Label wording comes from the prose, and numbering matches the doc's step numbers. If the prose
  folds a sub-control into another step, give it an **unnumbered** label — do not invent a step the
  doc does not have.
- No control has been recoloured. Bands and scrims go *behind* the UI via an alpha punch.
- No leader crosses a control or another leader.
- Labels are vertically centred on the row they describe.
- **Every label is legible on the ground it actually lands on**, not on the ground the figure as a
  whole is on. Sample the rendered PNG. If the ground cannot carry any ink — a mid grey is the
  classic case — the fix is `labelPlate`, not a lighter colour.
- **You have opened the rendered PNG and looked at it.** Every defect in this project's figure
  history was found by looking and missed by not looking. A spec that resolves cleanly can still
  produce a figure where every ring is around the wrong control, and nothing in the console says so.
- **It has a page recording what it shows, how to get back to it, why each callout is there, which
  callouts you rejected, and any defect you knowingly shipped.** A figure nobody can reproduce is a
  figure nobody can correct. See [`examples/figure-pages/`](examples/figure-pages/) for
  twenty-nine worked examples of that page.
