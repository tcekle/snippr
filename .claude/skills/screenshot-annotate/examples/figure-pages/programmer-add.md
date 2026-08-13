# programmer-add.png

`docs/help/images/programmers/programmer-add.png` · 1086×817 · 133 KB ·
**aubergine backdrop** · *Programmers* → Adding a programmer.

## What it shows

The **Add Programmer** dialog part-way through being filled in wrongly: all three of the duplicate
messages the article quotes, the auto-filled Site Number that produced the third of them, and the
greyed-out **Add** button. A band of the page's own scrim on all four sides. Two callouts.

## Getting back to something close

`docs/help/.screenshots/capture-programmers.mjs`, state B. Open the dialog from **+ Add Programmer**,
type `PGM-02` into Name and `192.168.0.22` into IP Address, and blur.

**Driven, not faked, and that input is the only one that raises all three messages at once.**
Re-adding a programmer that is already registered is what an operator does when they believe it was
removed. Typing PGM-02's address then brings the third message with it for free, because
`handleIpChange` copies the last octet of any valid address into Site Number. The fourth message the
article mentions — the IPv4 format check — **cannot appear beside these**, since an address has to
parse before it can match an existing one; the article is right to list it separately.

The capture asserts all three messages, the disabled **Add** button and the auto-filled `22` before
it writes anything, so a capture cannot be a dialog that merely looks like this one.

## The scrim band, and why it is 22 by 52

40 logical px of `rgba(0,0,0,0.5)` around the card, and it is **captured margin, not synthesized**.
The distinction matters: `pad-clip.mjs`'s synthesized margin is what a backdrop replaces, while
captured margin is part of the picture — the same call [`run-socket-menu`](run-socket-menu.md) makes
about its 8px of shadow ground. Here the scrim is a *live control*: `AddProgrammerDialog` puts
`onClick={onClose}` on the full-screen overlay, so clicking the grey discards the form. It is the
subject of one of the two callouts, and the reader has to be able to see there is a page behind. The
dimmed site numbers and state chips showing through are what make it read as a page rather than as a
grey mat.

The band is **22 vertically and 52 horizontally**, not square. This is the one figure of the four
whose on-page size is set by the **60vh cap** rather than by the column: 417 logical px of dialog is
nowhere near the 807px column even with a gutter, but 453 logical px of dialog is already past 60vh
once it is scaled at 1.5. Every pixel of vertical band therefore comes straight off the dialog's type
size and every pixel of horizontal band is nearly free. A symmetric 40 published the form text at
15.8 CSS px; 22/52 publishes it at 16.9 before the gutter, 14.5 after.

## Why it is annotated the way it is

**No numbers, and this is the figure where that decision is least obvious** — the section *is* a
numbered sequence, steps 1 to 6. But step 1 happens on the previous screen, and steps 2 through 5
land on five fields whose on-screen labels are already `PROGRAMMER TYPE`, `NAME`, `IP ADDRESS`,
`SITE NUMBER` and `PORT`, word for word. Numbering them would put five bubbles on the figure to say
what the field labels already say. The one step worth a mark is 6, and it earns it for a reason that
has nothing to do with being sixth.

**Two callouts:**

- *Disabled until every check clears*, on **Add**. `canSave` wants a type, a parsing address, a free
  address, a site number, a free site number and a free name; the button is the only place the form's
  overall verdict appears, and it is the quietest thing on the dialog. The ring also puts the
  product's own word for the button — **Add** — beside the article's step 6, which says *Save*.
- *Discards it — so does a click outside*, on the close glyph. A dialog's × closing the dialog is a
  caption; what earns the ring is what it shares with the whole dark area around it. The card stops
  propagation and the overlay closes, so a click anywhere outside throws the form away with no prompt
  at all — **the opposite of what the same help site teaches about leaving a dirty Settings form**,
  where `unsaved-changes.png` shows a prompt. Nothing on screen distinguishes the two behaviours,
  which is exactly the kind of thing a figure can say and prose in another article cannot.

**Rejected:**

- **The three red validation messages.** The article quotes all three verbatim two lines above the
  figure — the strongest kind of caption-repeat there is.
- **The Port field.** A callout saying it defaults to 50001 would repeat the picture, which prints
  50001.
- **The auto-filled Site Number.** Step 4 already explains the last-octet rule. The figure showing
  `22` arrive from `192.168.0.22` *is* the illustration; a label would be a second telling of it.

**One thing found while shooting it and not annotated:** `canSave` never requires a name, so a
programmer can be added with the Name field empty. The article's step 3 reads as though a name is
required. Reported, not fixed, and not annotable here because the figure has a name typed in it.

## Targets

The disabled **Add** button is the only `#9AB6DC` region anywhere in the figure — PrimeReact's
disabled primary, and nothing else in the capture is that colour.

The close glyph is found as **the smallest ink cluster inside the dialog card**. At 13×12 it is less
than half the area of the next smallest mark, and "the smallest mark on the card" survives a
re-capture in a way a coordinate does not. The card itself is the only `#FFFFFF` region over 600px in
both axes, which separates it from the five white input fields inside it.

## The backdrop

Both labels sit in the derived right gutter, outside the captured dialog and its scrim band, so the
backdrop rule applies.

**Note this is the opposite call to [`unsaved-changes.png`](unsaved-changes.md)**, which is the other
modal-over-a-dimmed-page figure in the set and correctly has no backdrop at all. Its three labels had
to stay inside the frame, because a side gutter wide enough for them would have cost about a fifth of
the dialog's type, so they took `labelPlate` instead. Here there are two labels rather than three,
both targets sit on the card's right-hand edge, and the gutter is affordable — so the doctrine's
cheaper remedy applies and no plate is needed. The two figures are worth reading together: they are
the same class of screen resolved two different ways, and which way is right turns entirely on
whether the labels can leave the frame.

**Right, not bottom.** Both targets are on the card's right edge, one near the top and one at the
bottom, so a right gutter gives two short leaders that cross nothing. A bottom gutter would send the
Add leader up past **Cancel** and the × leader up the whole height of the dialog.

Measured on the rendered output: `#FFC35C` on `#301E4F` — **9.27:1** — and on `#2C233F` —
**9.34:1**. On-page label type is 17.0 CSS px; the dialog's own 13px form text lands at 14.5.

## Known issue

**It is the one figure on the page whose size depends on the reader's window height.** Measured in a
1080px-tall browser it renders 807×608 and the column is what binds it; below about a 1014px-tall
window the 60vh cap takes over and the figure shrinks with the window. At 900px tall it publishes its
labels at about 15.2 CSS px and the form text at 12.9 — still inside the band, but it is the only
figure here that moves at all, and any future re-crop should re-check it at 900 as well as at 1080.
The vertical scrim band is the only slack left if it ever falls out of the band.
