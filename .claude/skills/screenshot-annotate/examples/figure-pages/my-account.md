# my-account.png

`docs/help/images/getting-started/my-account.png` · 1498×822 · 217 KB ·
*Signing In* → Changing your password.

**One shoot, two states.** This figure and
[`my-account-password-rejected.png`](my-account-password-rejected.md) are the same form before and
after a rejected password, so **re-shoot them together.** The error message pushes the whole form
down when it appears, so the two captures do not share a layout — which is exactly why the second
figure's target is matched on colour rather than position.

## What it shows

The My Account form as an operator lands on it: username and role shown but not editable, first and
last name, the two password fields, and the **Save** button. Three callouts.

## Getting back to something close

An operator session on `/account`, viewport 1440×900, `deviceScaleFactor: 1.5`.

**Padding is synthesized, not captured**, the same way as the account menu: the form has nothing to
its left before the nav sidebar, so the tight clip is composited onto a margin sampled from its own
corner pixel rather than a hardcoded white. **The spec now crops it back off** — see *The backdrop*
below. Keep capturing it; a probe reports the band uniform on all four sides, and the ten extra
uniform rows it finds at the top are the form's own white and stay in.

## Why it is annotated the way it is

No numbers. The steps in the prose begin with "open the account menu", which happens on a different
screen, so numbering this figure 2 and 3 would be accurate and would read as an error.

- *Shown, but not editable here* — a union of the username and role fields. Nothing in the rendering
  distinguishes a read-only field from an editable one at a glance.
- *Type the new password twice, or leave both blank to keep it* — a union of the two password fields.
  The wording follows the prose, and it belongs on **this** callout rather than on **Save**: the
  sentence is about the password fields, so hanging it off the button would attach it to the wrong
  control.
- *Saves your changes* — the **Save** button, which is the only region in the capture carrying the
  brand blue and therefore needs no container to disambiguate it.

Rejected: the first and last name fields, which are self-evidently editable text inputs with printed
labels.

**The six field boxes are white rects of a consistent width, ordered top to bottom.** A minimum-height
filter is essential — each bordered field also contributes 1px-tall strips of border colour at the
same width, and without it the selector matches thirty regions instead of six and every index rings
a hairline.

The label scale is set so the labels land near body size once the site scales the figure into the
content column. At a lower value they rendered around 11px and read as fine print. The two account-menu
figures sit at a higher value than this one because they are physically smaller and scale down less.

### The backdrop

All three labels sit in the derived left and right gutters, outside the captured form, so the rule
applies. Those gutters were **pure white**, which is the worst version of the problem the rule exists
for: the figure read as a form printed on a page with handwriting beside it, not as a screenshot with
notes.

**Cheap.** Both side margins are already far wider than the 4.5% floor (34.6px on a 768px capture), so
the floor only shows on the top and bottom and the width is set by the labels either way. Cropping
`pad-clip.mjs`'s 48px band off then takes the figure from 1607 to 1498px, so the form's 14px type comes
out **larger** on the page than it was on white — 10.5 → 11.3 CSS px.

Measured on the rendered output, the labels go from 3.82:1 on white to 7.65 / 8.26 / 7.17:1 on the
gradient.

**The label scale was deliberately not re-derived, and the distinction is worth keeping.**
`shell-status-bar.png` and `run-job-bar.png` both re-derive it as `old × newWidth ÷ oldWidth` after a
conversion, because there the backdrop's side padding is a pure tax: it adds nothing to the picture
and shrinks everything on the page, so the label has to be given back what the padding took. Here the
width moved the *other* way, and for a different reason — the crop removed 96px of synthesized white
mat, which is a uniform zoom-in. Every pixel in the figure grew by the same 7%, nothing inside it
changed relative to anything else, and re-deriving would make the labels smaller against the form than
they were tuned to be. **Correct the tax; do not correct a zoom.**

## Known issues

The label type now publishes around 20.9 CSS px against 16px body copy, above the 15–18 band the index
states. That is not the backdrop's doing and predates it: the figure's scale was chosen against a
689px article column and the column is now roughly 807, which inflated every label sized before the
change. The conversion carried the existing size across rather than quietly fixing it, so the two
questions stay separable. **Re-deriving the label scales across the whole set against the current
column is outstanding work, not this figure's bug.**
