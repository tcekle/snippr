# teach-component-picker

**Article §** *Teach* — Pick a component.
**Published** `docs/help/images/teach/teach-component-picker.png`, 1029×629, 124 KB,
**aubergine backdrop**.
**Source** `figures/sources/teach-component-picker.png`, 459×588 — a 306×392 CSS px clip at
`deviceScaleFactor: 1.5`.

## What it shows

The component dropdown open on a machine where nothing has been picked yet: the three groups
`TeachLocationService` hard-codes, in its order — **Gantry**, **I/O Locations**, **Programmers** —
seven entries between them, status dots in all three colours, and the count column. Two callouts.

## Getting back to something close

`docs/help/.screenshots/capture-teach.mjs`, state A. Supervisor `aroberts` at `/#/teach`,
1440×940 viewport at `deviceScaleFactor: 1.5`, `/teach/locations` answered with the roster the
script builds, then the closed button clicked once. The prerequisites in
[FIGURES.md](../../FIGURES.md) all apply — in particular `/teach/camera-offset` must answer
`isApplied: false` or the head-camera rail panel opens itself over the page, and `/system` must
answer `isHomed: true` or `HomedRoute` replaces the screen with the card in
[`teach-not-homed`](teach-not-homed.md).

The roster: **Gantry** (5 positions, taught), **Input Tray 1** (4 positions, taught), **Reject bin**
(REJ, not taught), and **PGM-01** … **PGM-04** (3 sockets each; 01 taught, 03 out of tolerance, 02
and 04 not taught). The four programmers are the same units as `capture-programmers.mjs`, so the two
articles describe one machine. Seven entries is also a legibility budget: the figure is
height-capped by `max-height: 60vh` and every extra row costs the whole figure a percent of its
type.

## Shot before anything is picked, and that is the framing

Not a convenience. With a component selected, the page behind the open list is the two-column teach
layout and the right-hand quarter of the clip fills with the step wizard's black graphic panel —
25% of the figure, meaningless, and the most eye-catching thing in it. With nothing selected the
page behind it is the empty state, whose only ink (a 42px crosshair glyph and two muted lines) is
centred well right of and below the clip, so the list floats on plain ground. It is also the moment
the reader is actually in when they reach for this control.

## The Status pill is outside the clip on purpose

The open list is 280 CSS px wide against the closed button's 240, so the pill sits about 60 CSS px
past the list's right edge. Taking it in pushes the clip from 306 to 699 CSS px, and on-page type is
`column ÷ figure-width`, so the entries fall from about **15 CSS px to 11**. The pill is already
legible in `teach-overview.png` at the top of the same article, and the one callout that needs it
names it in words instead.

The word `Status:` is still in frame, because it falls inside the list's x-range and cutting before
it would shear the entries' count column. The right edge lands in the gap before the pill, so the
row visibly continues rather than ending mid-word.

## Why it is annotated the way it is

No numbers: the section is a description of a control, not a numbered sequence.

**Two callouts, neither of which names a part.**

- *Amber is the Status pill's Out of tolerance*, on PGM-03's dot. `STATUS_COLOR` maps
  taught/warn/untaught to green/amber/grey and the pill maps the same three values to
  Taught / Out of tolerance / Not taught — **the dot and the pill are one value rendered twice.**
  The article gives the pill's three words in a table and says separately that each entry carries a
  coloured dot, but never joins them, and the picture carries no legend at all. Amber is the one a
  reader cannot guess: green reads as good and grey as nothing.
- *A short code, not a count — one position only*, on the Reject bin's `REJ`. Every other row's
  right-hand column is a count; this one is three letters. `describeLocationCount` falls through to
  `item.abbreviation` whenever `locationCount` is 1, so a single-position teachable prints its short
  code in the slot the reader has just learned is a number. The article's parenthetical lists three
  example strings and none of them is an abbreviation.

**Rejected:**

- **The group headings, the chevron, the dot on the closed button, the count strings.** All named in
  the prose; a ring on any of them repeats a caption.
- **"Clicking an entry moves the gantry — there is no confirm."** The strongest fact about this
  picture, and it is a property of *every row* rather than of one pixel, so a ring on one row would
  under-claim it. It is in the caption instead.
- **That `3 sockets` counts teachable locations, not sockets.** `MapProgrammer` sets
  `LocationCount = taughtLocations.Count` when there are any, and a LumenX site exposes three
  (Socket 1, Socket 5, Socket 8) for a unit with eight. So a programmer's count column says
  "3 sockets" about an eight-socket machine. That is a correction to the product, not an addition to
  the prose — reported to the content owner, not ringed.
- **That with nothing picked the Status pill reads "Not taught."** `statusLabel` falls through to
  `'Not taught'` when `tray` is null, so an idle Teach screen appears to declare the machine
  untaught. Same class: a correction, and the pill is outside the clip anyway.

## Targets

Measured, no coordinates.

- **The amber dot** is the only `#FEB035` ink in the figure — `STATUS_COLOR.warn` — so it needs no
  ordering at all. `dilate: 3` keeps the 7 CSS px circle over `detectInk`'s 24px minimum area.
- **`REJ`** is the only ink cluster inside the list panel between 20 and 40px wide. The dots are
  11px, the entry names 59–101, the group headings 68–129, and every other count 74–85. **That
  window holds only while every other count stays two words long** — a one-word count string would
  land in it.
- The list panel is the one large `#FFFFFF` swatch, which is what `within` resolves to.

## The backdrop and the gutters

Aubergine, and **one label per side**. The split is forced rather than decorative: the two targets
sit at opposite ends of their rows — the status dot 18px from the list's left edge, `REJ` hard
against its right — so a single gutter always leaves one leader crossing the full width of a row.
Rendered with both on the right, the amber leader strikes through `PGM-03` and `3 sockets`. **The
renderer does not warn**, because unfilled text is not in its obstacle set (`obstacles` is the other
labels' rects and nothing else); it was found by looking at the PNG. Same failure and same class of
fix as [`programmer-sockets`](programmer-sockets.md), except that there one side served both targets
and here neither does.

`fontScale` is **1.6**: the base is `459/46 × 1.22` = 12.2px, and two gutters push the figure past
the article column, so the labels need lifting twice over. Published they measure **8.04:1**
(`#FCC25C` on `#3A265E`).

## On the page

Renders at 807×494, scale **0.785** — width-bound by the article column. Labels land at 15.3 CSS px
and the entry names at 14.7, against 16px body copy.

## Known issues

- **The count column disagrees with the article for programmers**, as above. Visible in the figure
  and not annotated.
- **No entry in the figure prints `Camera offset`**, which is one of the article's three examples.
  `describeLocationCount` only returns it for a gantry-kind teachable with one location *and no
  abbreviation*, and the PSV7000 gantry has five locations and an abbreviation. Whether any shipping
  machine produces that string is an open question.
