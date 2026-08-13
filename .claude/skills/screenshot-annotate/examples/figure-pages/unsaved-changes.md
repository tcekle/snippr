# unsaved-changes.png

`docs/help/images/getting-started/unsaved-changes.png` · 1350×912 · 140 KB ·
*Navigating the Application* → Unsaved changes.

## What it shows

The unsaved-changes prompt raised from Settings, over the dimmed Settings page. Three buttons —
**Cancel**, **Discard**, **Save**, in that on-screen order — with one callout each.

## Getting back to something close

**Drive it, do not fake it.** Sign in as `aroberts` (Supervisor), land on `/settings/General`, edit
the Job Folder setting, then click **Programmers** in the left nav. `useBlocker` sees the pathname
change while `hasCategoryPendingChanges('General')` is true and goes to `blocked`.

Assert two things before writing the PNG: that the store is dirty before the click, and that the hash
never left `/settings/General` after it. Otherwise a capture could be a dialog forced up some other
way, which would photograph the same pixels for the wrong reason.

**Clip 900×608 logical from a viewport only 720 tall.** The dialog centres in the *viewport*, so at a
900-tall viewport any clip that also caught the Settings heading had to run 830px to keep the dialog
off the bottom edge. Shortening the viewport is what lets the clip hold both the dialog and enough
page around it. Derive all clip bounds from the rendered DOM; never hardcode them.

The spec's crop is `none` on purpose — the capture is already a measured clip, and an automatic
re-crop to detected content would undo that.

## Why it is annotated the way it is

No numbers: the section is prose, not a numbered sequence.

**This figure shipped with zero callouts first, and that was wrong.** The argument for zero was that
the dialog already prints every word the prose uses — and that argument is right about *captions*. A
ring labelled "Cancel" beside a button captioned Cancel says nothing. It is wrong about
*consequences*, which is what a reader actually gets wrong here: **all three buttons dismiss the
dialog and only one of them abandons the trip, and nothing on screen says which.** Cancel is the
trap. It cancels the navigation, not the edits, and a reader who expects it to throw their work away
will pick Discard or Save to avoid it.

So each label states an outcome rather than repeating a caption, and the three read as one contrast:
*Cancels leaving, not the edits* / *Leaves without saving* / *Saves, then leaves*. Each was read out
of `SettingsPage.tsx` rather than inferred — `onCancel` calls `blocker.reset()` and never touches the
store; `onDiscard` calls `revertCategory` then `blocker.proceed()`; `onSave` awaits
`savePendingForCategory` then `blocker.proceed()`.

This is the figure the rest of the set cites when a callout is cut for repeating a caption, and the
one it cites when a callout is kept for naming a consequence.

**The wording is invented, and style guide 1.5 permits it here.** Label text normally comes from the
prose; the prose states no consequence for any of the three buttons, so there is nothing to borrow.
These are the shortest true sentences about what each button does, which is the rule's intent — not
an exemption from it.

**The labels take no gutter, and that is the whole layout.** On-page type size is
`capture-font-size × column-width ÷ clip-width`, so horizontal gutter comes straight out of the 14px
dialog text this figure exists to show — a side gutter wide enough for these labels would have cost
roughly a fifth of it. All three labels are therefore one line, inside the frame, in the narrow band
between the dialog's shadow and the Data Locations rule. That band is only about 70px tall, which is
what forces one line: a two-line box drops through the rule and into the heading below. The wrap
limit is set just above the longest label for the same reason — at the default, *"Cancels leaving,
not the edits"* breaks onto a second line that will not fit.

**Two of the three label positions are constrained, not aesthetic.** The automatic anchor puts all
three directly under their buttons, where they overlap. Cancel's label cannot sit further left, or
its leader launches out of the middle of the "during a run." caption; Discard's cannot sit further
left either, or its leader runs down *through* the dimmed toggle below the dialog instead of past it
(style guide 1.4). Save's is simply the remaining room without touching the frame edge.

**All three labels sit on a plate, and the plate is the whole reason this figure is legible.** See
*The labels used to be unreadable* below. The spec turns it on with `"labelPlate": { "padY": 0.24 }`
and every label in the figure gets a dark hand-edged chip with the lifted amber `#F6BA58` on it.
The shared `+0.00636` in each `labelShift`'s **y** exists only for the plate: it drops the row about
6px so the chip fits between the dimmed caption above and the Data Locations rule below. Both bounds
are measurable in the source — the caption's ink stops at y 661, the rule is the single dark row at
y 715 — so the clear band is 53px and the chip is 47px. Anything that changes the label type size
has to re-derive that shift, and the way to check it is to look for plate pixels in rows ≤661 and
≥715 rather than to eyeball it.

Targets: Cancel and Discard are the two white swatches inside the dialog card, left to right, with a
minimum-height filter to drop the card's own 1px border strips — which would otherwise take the first
index slots. Save is the only brand-blue region in the whole capture; the nav's selected item is a
much darker blue, well outside tolerance.

`cornerRadius` stays 0: this is a crop out of the middle of the window, not a window silhouette, so
rounding would round nothing that is round in the product.

**One figure, not two.** The window-close variant mounts the *same* component with the same props
(`App.tsx` `onCloseRequested` → the guard → `pendingElectronClose` → the same `UnsavedChangesDialog`).
Identical pixels, so a second capture would add weight and teach nothing.

## The labels used to be unreadable, and lighter ink could never have fixed it

The figure shipped for a while with bare `#BF6F14` labels on the modal's dimmed page. Measured off
the published PNG, the glyph cores were **1.32–1.33:1** against a ground of `#999999`. The owner
reported it as hard to read, which it was.

**The arithmetic rules out the obvious fix.** A mid grey is the worst possible ground: nothing in the
sRGB gamut is far from it in luminance, so there is no ink — of any colour, at any lightness — that
clears the 3:1 floor for large text on it.

| Ink on `#999999` | Contrast |
|---|---|
| `#BF6F14` — the house amber, what shipped | **1.34:1** |
| `#F6BA58` — the dark-ground amber | 1.64:1 |
| `#FFE0B2` | 2.25:1 |
| `#FFFFFF` — the theoretical best light ink | **2.85:1** |
| `#1C202C` — near-black | 5.70:1 |

Every light ink is worse than white and white does not clear the floor. Only near-black does, and
near-black is not this hand. **So the lever is the ground, not the ink** — do not spend time on
lighter ambers, the table above is why.

**What was built instead: a label plate.** `"labelPlate"` in the spec draws a filled, hand-edged
rounded rect behind the label and puts the lifted amber on it. Here it composites to an effective
ground of `#2B2E35`, and the three labels now measure **8.59:1, 8.60:1 and 8.59:1** — sampled from
the rendered PNG inside the plate. (Nominal `#F6BA58` on nominal `#2B2E35` computes to 7.82:1; the
published pixels read higher because the overlay is rasterised at 3× and downsampled with lanczos3,
whose overshoot brightens the glyph cores to about `#FFC45C`. Both numbers are in the band, and the
measured one is the one a reader actually sees.) That band is where the gutter labels on the
aubergine-backdropped figures live, 5.5–9:1, which is the point: an in-frame plated label and a
gutter label on a dark backdrop are the same ink-on-ground pair, so the figure keeps one hand.

The plate itself measures 4.78:1 against the dimmed page, so the chip reads as a distinct object
rather than a smudge.

**Alternatives rendered and rejected**, all of them looked at rather than reasoned about:

- **A crisp-edged plate** (the same rect without the Rough.js outline). Identical contrast, and it
  reads as a toast or a tooltip belonging to the *product*. On a figure that is a picture of an
  application, a rectangle that could be part of the application is a correctness problem, not a
  taste one. The hand-drawn edge is what says "ink".
- **A glyph halo** — `paint-order="stroke"` with a dark stroke round the amber, no plate at all.
  resvg 2.6.2 supports it and it is the least intrusive option, since it covers no pixels. Rejected
  on looks: it reads as comic-book lettering rather than marker, and at the published scale
  (1350px scaled into an ~805px column) the counters of *a*, *e* and *g* start closing up. The code
  for it was written, rendered, and removed.
- **An aubergine plate** (`#1A102E`, matching the backdrop preset) instead of a neutral one. 9.5:1,
  and handsome — but this figure has no backdrop, so the purple appears nowhere else in it and reads
  as arbitrary. The plate wash is deliberately near-neutral for that reason.
- **A lighter plate** at 0.68 opacity. 6.56:1, still fine, but the extra transparency buys nothing
  the reader can use and lets the dimmed page mottle the chip.
- **A light plate with dark ink.** Not rendered. It scores well and abandons the marker amber
  entirely, which is the one thing every other figure in the manual has in common.

**A backdrop is still not available here**, for the reason recorded when it was first considered: it
forces a 4.5%-of-width margin on all four sides, roughly a 9% cut to the dialog's on-page type size.
The plate gets the same contrast without touching the figure's dimensions — 1350×912 before and
after.

## Known issues

- **The plate covers dimmed page pixels, by design and only just.** It is drawn *over* the capture,
  unlike a highlighter band, which is punched out so the control shows through (style guide 1.3). The
  band it sits in was chosen so it covers nothing but flat scrim — the "during a run." caption above
  it survives intact, verified by pixel row rather than by eye — but the clearance is about 2px at
  each end and the hand-drawn edge wobbles into roughly 1px of it. A re-shoot at a different viewport
  will move both bounds and the shift has to be re-derived.
- **Rings and leaders are still bare amber on the scrim.** Only labels take a plate. The rings sit on
  the white dialog card where `#BF6F14` clears 3.8:1, and the leaders cross both grounds; a leader is
  a line with a barb, not something anyone has to read, so it survives on hue where a word would not.
- **The article lists the buttons in reverse of the on-screen order.** On screen it is
  Cancel · Discard · Save; the prose offers "**Save**, **Discard**, or **Cancel**". The three labels
  make the mismatch conspicuous. Reported, not fixed.
- **"Settings is the main one" overstates it.** Settings is the *only* screen that raises this dialog.
  `SagaDiagramPage` tracks dirty state but renders an inline warning label with no prompt and no
  navigation block. Reported, not fixed.
