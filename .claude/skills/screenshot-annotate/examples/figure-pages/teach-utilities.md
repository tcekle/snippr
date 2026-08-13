# teach-utilities

**Article §** *Teach* — The Utilities column.
**Published** `docs/help/images/teach/teach-utilities.png`, 733×633, 93 KB,
**aubergine backdrop**.
**Source** `figures/sources/teach-utilities.png`, 434×594 — a 289×396 CSS px clip at
`deviceScaleFactor: 1.5`.

## What it shows

The top of the Utilities column while a programmer site is under teach: the section header, the jog
cross with its accent-tinted centre, the Z pair labelled `Z axis · P2`, the four **Step** pills with
`100 µm` selected, and the **Far probe** selector on 2. Two callouts.

## Getting back to something close

`docs/help/.screenshots/capture-teach.mjs`, state B. 1440×940 viewport at `deviceScaleFactor: 1.5`,
PGM-03 under teach, and the wizard driven to **step 8** with seven presses of the real **Next**
button.

**Step 8 is load-bearing.** Its location is Socket 8, the only one of PGM-03's three that carries
`Probe = 2` in `LumenXProgrammer.GenerateTeachableLocation()`. That is what puts the Far probe
selector on 2, prints `Z axis · P2` under the Z pair, and relabels the live Z row to `Z2`. On any
other step the same crop shows the default state and the Far probe row says nothing.

The same page state also yields [`teach-step-wizard`](teach-step-wizard.md), one clip lower.

## Why a programmer, when the overview above shows a tray

`Far probe` renders only when `tray.kind === 'programmer'`, and the article gives it its own
subsection. Shooting a programmer means one capture covers all three of the section's headings
instead of two. PGM-03 is the LumenX, and `lumenx.programmer.*` is the only programmer step set that
ships in the frontend's `teachStepRegistry` — a FlashCore site would fall through to the backend's
synthesized `fallback.move` and show a different wizard entirely.

## Where the bottom edge comes from

Left and right are the section's own border box; its neighbour starts 12 CSS px away, so there is no
page ground to include and no pad to add. **The bottom is not the section's bottom.** The Utilities
column stretches to the full height of the content area — 799 CSS px at this viewport — and its last
150 px are empty. `main.css` caps a figure at `max-height: 60vh`, so publishing the empty stretch
would scale the type down for nothing: the full column publishes at 434×1198 and renders at about
0.45. The cut lands 14px under the Far probe selector.

## The Position panel gets no figure, and that is a decision

It is below the cut. It is two stacked lists of six numbers, and the article names both blocks, both
units, the location suffix and the untaught placeholder — so a ring on any of it repeats a caption.
The two things it shows that the prose does not are both **corrections rather than callouts**:

- The **Live** rows read `—` on all three axes until a SignalR `GantryPositionChanged` arrives.
  Nothing on the Teach page calls `gantryStore.fetchInitialPosition()`, unlike the two Gantry
  diagnostics panes that do. The article says Live is "where the head is right now".
- The **Taught** block keeps its third row labelled `Z` even on a probe-2 location where the Live
  block says `Z2`. `TaughtRows` hard-codes the axis label; only `LivePositionRows` switches it.

Both reported to the content owner. The capture seeds `gantryStore` directly so the *source* has
live numbers rather than em-dashes, which is why they exist at all in state B.

## Why it is annotated the way it is

No numbers: the section is a control reference, not a numbered sequence.

**Two callouts, both naming a consequence.**

- *Captures the position — it does not move the head*, on the crosshair. It sits dead centre of an
  arrow cross, which is where a D-pad puts "home" or "centre"; it is the opposite. `JogPad`'s `set`
  direction short-circuits `handleJog` into `handleSet` and issues no move at all. It is also the
  least discoverable control on the screen: accent-tinted, unlabelled, and the one press that
  commits a taught position.
- *Exceeds the Z axis travel — that jog is refused*, on the `50 mm` pill. The four pills are
  identical furniture and one of them is dangerous. The article carries the warning in a caution
  block twenty lines further down; what prose cannot do is say **which** of four interchangeable
  pills it is about.

**Rejected:**

- **The Far probe selector**, which is in the frame on purpose without a ring. What the prose does
  not already say about it is that the selector reports the **site's** far-corner probe
  (`locations[2].probe`) while the Z label follows the **active step's** location
  (`stepTaughtLocation.probe`) — so on Socket 1 with Far probe set to 2, the selector reads 2 and
  the axis still reads `Z`. That contradicts the sentence beside the figure ("the Z readout and Z
  jog follow whichever probe is active"), so it is reported rather than ringed. The caption carries
  the one thing a reader needs from the row: that it appears only on programmers.
- **The Step label** and **the arrow cross** — both name parts.
- **The Z pair**, named in the article's button table.
- **`Z axis · P2`** — the same probe fact as the rejected Far probe callout, and the weaker half.

## Targets

Measured, no coordinates.

- **The crosshair** is the only `#D4DFEE` region in the figure — `ACCENT_SOFT` composited over the
  light theme — so it needs no ordering.
- **The `50 mm` pill** is unfilled text, so it is found as ink inside the Step row, itself the only
  `#F1F4F8` region between 300 and 400px wide. **`dilate: 5` has a working range of exactly one.**
  At the default 4 the numeral and its unit are two clusters 9px apart and `rightmost` rings the
  word `mm` alone; at 5 the closure merges each number with its unit and leaves five clusters —
  STEP, the `100 µm` pill, `2 mm`, `5 mm`, `50 mm` — of which the rightmost is the one wanted; at 6
  the STEP label merges into the `100 µm` pill 12px away and the count changes again.

## The backdrop, the gutter and one hand-set shift

Aubergine. Both labels sit in a derived right gutter outside the captured column, so the rule
applies. There is no inside-the-frame alternative worth measuring: the column is 289 CSS px wide and
every empty patch in it is the section's own `#F1F4F8` ground, where the dark palette's `#F6BA58` is
far under the 3:1 floor.

**The crosshair label carries `labelShift: [0, -0.13]`, and without it the figure is wrong.** The
crosshair is the middle cell of a 3×3 grid, so a leader arriving on any axis crosses an arrow
button — the first render ran straight through **X+**. The renderer does not warn: UI controls are
never in its obstacle set. Raising the label by 13% of the figure height swings the arc down through
the grid's **empty top-right cell** and onto the ring's top-right corner, crossing nothing. Any
change to the jog pad's layout invalidates the shift, which is what the golden case exists to catch.

`fontScale` is **1.7** — base `434/46 × 1.22` = 11.5px, and the figure is height-capped as well as
narrow. Published the labels measure **9.29:1** (`#FCC25C` on `#2E1E4A`).

## On the page

Renders at 625×540, scale **0.853** — **height**-bound by `60vh` on a 900px window, not width-bound;
at a taller window it approaches native. Labels land at 16.7 CSS px; the Step pills at 13.4.

## Known issues

- **The house hand draws capital `Z` so it reads as `2`.** "Exceeds the Z axis travel" publishes as
  "Exceeds the 2 axis travel" at a glance. The wording was chosen to put `axis` immediately after
  the letter so the reader resolves it; there is no way to fix it inside `marker-rings`. Worth
  knowing before writing any label on this article, where Z is an axis name that keeps coming up.
- **The Step pills publish at 13.4 CSS px**, under the 15–18 band, because the figure is
  height-capped. Cutting the section header would buy native pixels and about 15.8, at the cost of
  the words "Teach / Utilities" that name the column the section is about.
