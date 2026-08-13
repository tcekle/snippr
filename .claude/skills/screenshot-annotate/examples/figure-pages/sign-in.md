# sign-in.png

`docs/help/images/getting-started/sign-in.png` · 2506×1034 · 208 KB ·
*Signing In* → Sign in.

## What it shows

The sign-in card with the username field, the password field, the password reveal toggle and the
**Sign In** button. Both fields are populated, so the button is enabled.

## Getting back to something close

The sign-in route with both fields filled. **This one predates the capture harness**, like
`app-shell.png` — it was taken by hand before `mocks.mjs` existed, so the recipe is reconstructed
from the capture rather than read off a script that was ever run.

Crop is automatic but constrained: **crop tight, but not so tight it severs the card.** Without
naming the card as a must-include, the union of the three fields alone slices the logo and heading
off the top and the card's lower edge off the bottom, and the figure reads as a floating fragment.

## Why it is annotated the way it is

**Steps 1–3 match the numbered list in the prose.** The reveal toggle is deliberately unnumbered: the
prose folds it into step 2, and inventing a step 4 would put the figure out of step with the article
it illustrates. This is the worked example for that rule in the style guide.

The three controls are described as "the wide swatches inside the white card, top to bottom", which
survives the card moving, the window resizing, or the **Sign In** button changing colour when it
stops being disabled. Matching the button on its measured disabled fill would break the moment
someone captures it enabled — that is the difference between a description and a coordinate.

The reveal toggle is an icon drawn *on* a control, so no swatch detector can see it; it is found as
the rightmost ink inside the password field. Its leader originally sliced diagonally across the
**Sign In** button and had to be routed out into a free lane — the incident that produced style guide
rule 1.4.

The label wrap limit is raised slightly above the default so *"Reveals what you typed"* stays on one
line instead of stranding its last word.

### Why it has no backdrop, and will not get one

**This is the second worked example of the contained case, after `unsaved-changes.png` — and the one
that looks most like it should have a backdrop.** It has four labels and four sweeping leaders, it is
the largest figure in *Signing In*, and roughly two thirds of its area is empty ground. None of that
is the test. The test is whether the annotation content lands outside the app window, and here it does
not:

- **The figure's margins are 0/0/0/0.** The published 2506×1034 PNG is a crop of the 2880×1800 capture
  and nothing else. There is no synthesized margin anywhere in it, so there is no "outside" for a
  gradient to fill — the same condition that keeps `unsaved-changes.png` on white.
- **All four label boxes resolve inside the crop.** They land on the sign-in route's own page ground,
  the app's `#F1F4F8`, to the left and right of the card. That ground is product, not gutter. The
  leaders cross the app's empty background, not white space beside a window.

Rendered on aubergine anyway, to check rather than assume, it fails on both of the things the rule
protects:

- **Every label drops from 3.46:1 to 1.57:1.** A dark backdrop repalettes the whole figure to the
  lifted `#F6BA58`, and that ink on the app's near-white content area is the 1.77:1-class defect
  recorded against `app-shell.png` — here it is worse, and it hits **all four** labels rather than two,
  because every one of them is effectively a `labelIn` label. Well under the 3:1 floor for large text.
- **On-page type drops from 9.0 to 8.1 CSS px.** The floor is 4.5% of a 2880px capture, so it adds
  260px of gutter to a figure already scaled down hard by the column.

The remedies that rescued `service-mode-banners.png` do not apply. There is nowhere to relocate the
labels *to* — moving them out of the frame means widening a figure that is already the most
downscaled in the set — and a `labelPlate` would put four dark chips on the sign-in screen to solve a
problem the figure does not have, since on white the labels already measure 3.46:1 against a ground
that is genuinely theirs.

**If someone proposes this again:** the numbers above are the answer, and the framing to check first
is the margin, not the whitespace. A figure can look like it has a gutter and have none.

## Known issues

None outstanding. The recipe's uncertainty is the only caveat: nobody has re-shot this against the
mock harness, so a re-shoot may not land on the same card position or the same window size.
