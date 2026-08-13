# teach-not-homed

**Article §** *Teach* — the note above the overview figure.
**Published** `docs/help/images/teach/teach-not-homed.png`, 759×441, 58 KB,
**aubergine backdrop**.
**Source** `figures/sources/teach-not-homed.png`, 696×324 — a 464×216 CSS px clip at
`deviceScaleFactor: 1.5`.

## What it shows

The **System Not Homed** card that `HomedRoute` puts in place of the entire Teach screen when
`/system` reports `isHomed: false`: the heading, one sentence of explanation, and the **Cancel** /
**Home System** pair. One callout.

## Why it earns a figure at all

The article's note describes this state in three lines and names the **Home System** button. The
figure is here for two things the note does not do: it names **Cancel**, which the note omits, and
it makes the state recognisable. This card replaces the whole screen, so an operator on a cold
machine meets it before anything else in the article applies.

## Getting back to something close

`docs/help/.screenshots/capture-teach.mjs`, state D. A **separate browser context** with
`GET /system` answering `{ ..., isHomed: false }`, then `/#/teach`. There is no partial state to
catch and nothing to drive — `HomedRoute` renders the card on first paint.

1100×720 viewport at `deviceScaleFactor: 1.5`. The card is a fixed `max-w-md`, so the viewport only
decides how much page surrounds it and the clip takes none of that.

**8 CSS px of pad** around the card's border box, because its `shadow-xl` lives outside the box and
those pixels are page ground the product actually draws. Same call as
[`run-socket-menu`](run-socket-menu.md)'s 8px, and deliberately **not** the four *Signing In*
figures' 48: at that width the object floating on the gradient stops being a card and becomes a slab
of grey with a card inside it, because `composeFigure` draws its own drop shadow and hairline around
the **screenshot rectangle** rather than around the UI in it. The first take used 16 and was cut
back for exactly that reason.

## Why it is annotated the way it is

No numbers: it is one control on a blocking card, not a sequence.

**One callout.** The heading, the sentence and **Home System** are all in the note beside the
figure, so ringing any of them is a caption.

*Cancel leaves for the dashboard — it does not skip homing.* `handleCancel` navigates to `/`. It
does not dismiss the panel, and it does not let the operator through to Teach unhomed: there is no
path to Teach that skips homing, because `HomedRoute` re-renders this card until `isHomed` is true.
This is the doctrine's own *"Cancels leaving, not the edits"* shape, on a button the prose never
mentions.

**Rejected:**

- **The Home System button.** Named in the note; a ring says strictly less than the sentence above
  it.
- **The heading and the explanatory paragraph.** Likewise.
- **The error slot.** `HomedRoute` renders a red band under the paragraph when `/system/home`
  throws, and a second message — *"Homing finished but the system did not report a homed state"* —
  when it returns `isHomed: false`. Both are real states and the article covers neither, but
  photographing them needs a mocked failure and would turn a recognition figure into an error
  figure. Recorded rather than shot.
- **That both buttons are disabled while `isHomed` is `null`** and Home System reads *Checking…*.
  A sub-second load state; not worth a figure or a ring.

## Targets

Measured. **Cancel** is the only `#FFFFFF` region in the figure between 80 and 160px wide — the card
itself is 668px and every other white area is unbounded page. That window holds only while the card
stays wider than 160, which `max-w-md` guarantees. **Home System** is `#054BAA` and is not a target;
it is named here only so the next person does not reach for it by index.

## The backdrop and the gutter

Aubergine. The single label sits in synthesized margin below the card, outside the capture, so the
rule applies.

**A bottom gutter rather than a side one.** The figure is 696px wide against a roughly 807px column,
so a side gutter would push it over the column and start scaling the card down; a bottom gutter
costs nothing but height, and the figure is short enough that `60vh` never binds.

`fontScale` is **0.9**: the base is `696/46 × 1.22` = 18.5px, a shade over the 15–18 band. Published
the label measures **8.56:1** (`#FCC25C` on `#362256`).

## On the page

Renders at 761×443, scale **1.00** — native. The label lands at 16.6 CSS px, the card's heading at
24 and its body copy at 21.

## Known issues

- **It sits immediately above `teach-overview.png`**, so the article opens with two figures back to
  back. The pairing is deliberate — blocked screen, then the screen — but it does put a picture
  before the reader has seen the feature. If the article ever grows a Homing section, this figure
  belongs there instead.
