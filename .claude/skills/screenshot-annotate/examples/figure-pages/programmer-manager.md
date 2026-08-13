# programmer-manager.png

`docs/help/images/programmers/programmer-manager.png` · 1586×708 · 129 KB ·
**aubergine backdrop** · *Programmers* — top.

## What it shows

The Programmer Manager's content area with nothing selected: the screen title, **+ Add Programmer**,
and the list of four programmers with all eight columns and the four row actions. One callout.

**This figure replaces one that predated the skill**, and the replacement is not just an annotation
pass. The old `programmer-manager.png` was a whole-window capture with no source, no spec and no
callouts — and it was taken *with the detail flyout open*, which drops a `rgba(0,0,0,0.3)` scrim over
the entire page. The establishing figure for an article whose first two sections are about the list
therefore showed the list dimmed. This one is the content area only, nothing selected; the app shell
around it is already taught by `app-shell.png` and its five crops, so repeating it here bought
nothing and cost width.

## Getting back to something close

`docs/help/.screenshots/capture-programmers.mjs`, state A. Supervisor `aroberts` on `/#/programmers`
with `/programmer`, `/programmer/types` and `/programmer/192.168.0.23` mocked. Clip the card's own
width, and from just above the **Programmer Manager** heading to just under the card.

**Capture at a 1280px viewport, and do not widen it.** This is the constraint that shapes every
figure on the page. The list is a nine-column PrimeReact DataTable with a natural width of 940
logical px — 254 of it the fixed-width Actions column — and it does not reflow. Squeeze the content
area below that and the table overflows its card: at 1180 the **IP Address** header wraps to two
lines and **Remove** is sheared off the right-hand edge, which would publish a figure showing three
row actions where the article names four. The capture asserts against exactly that, by comparing the
table's laid-out right edge against the card's. Going the other way is no better: at 1440 the content
area hits its `max-w-[1200px]` cap and the card grows to 1168 for no extra content.

Four programmers, because Connection and Status are two independent state machines and one row cannot
show that. PGM-04 is the unreachable one because `mocks.mjs` already ships a notification reading
*"PGM-04 (192.168.0.24) did not respond to ping"* — it is visible in `shell-notifications.png`, so a
reader who compares the two finds the same machine. The two LumenX units carry four sockets and the
two FlashCore units eight, which gives the Adapters column something to say and lets
[`programmer-sockets`](programmer-sockets.md) be four rows tall.

## Its type is small, and nothing fixes that

The rows publish at about **9.9 CSS px**. There is no framing that improves it: the table is 1004
logical px of content, and cropping columns off it is not available to a figure whose job is to show
the columns. So this is treated as an orientation figure and the two sections that need type a reader
can actually read get their own tighter crops from the same page state —
[`programmer-row-actions`](programmer-row-actions.md) at 15.0 and
[`programmer-sockets`](programmer-sockets.md) at 16.9.

For scale: `app-shell.png` publishes at about 7.8 and `run-overview.png` was condemned as
un-annotatable at 6.7. **If a future pass wants this figure to read, the only lever left is the
product** — a table that reflows, or fewer columns.

## Why it is annotated the way it is

No numbers: the section is a column reference table, not a numbered sequence.

**One callout, and the restraint is the finding rather than the shortcut.** This article's prose is
unusually complete. The column table defines all eight columns one for one; the paragraph under it
covers sorting, row clicks and the five-second refresh; the action table covers all four buttons.
Almost every candidate callout here is therefore a caption, and the doctrine cuts captions.

What the page never says is that **Connection and Status are independent answers to different
questions**, and that is the most common misreading of a table whose two adjacent columns are both
coloured chips. The ring goes on PGM-03's red **Error** chip, one column right of a green
**Connected** chip on the same row: *Connected, and still faulted*. A reader who has learned that red
means trouble reads left and finds the machine is reachable and broken at once. PGM-04 below makes
the same point from the other side.

**Rejected:**

- **+ Add Programmer.** It is step 1 of a numbered sequence in a later section, and reaching it from
  a top gutter needs a leader down across the whole table.
- **Anything about the five-second refresh.** Stated outright in the prose.
- **Any callout naming a column.** The column table does all eight.
- **The Adapters column**, where 8/8/4/4 is genuinely informative — and is exactly what the table's
  one-line definition already says.

**Two things this figure shows that could not be labelled**, because a figure must not carry a
correction to the prose beside it. Both are reported as documentation defects instead:

- **Firmware and Adapters carry no sort control.** Six of the eight columns have the `⇅` glyph and
  those two do not, which contradicts the article's *"Every column sorts."* `Column` in
  `ProgrammerManagerPage.tsx` is `sortable` on Name, Type, Site, IP Address, Connection and Status,
  and not on the other two.
- **The Type column reads `FlashCore`.** That is `ProgrammerTypes.ToString()`, which is what the API
  returns and what the UI prints. The article writes *FlashCORE*.

## Targets

The two white body rows are the odd rows of a `stripedRows` table, so they are the only wide
`#FFFFFF` regions inside the card, and `top-to-bottom index 1` is PGM-03. Inside the row the twelve
ink clusters run left to right in column order — name, type, site, address, Connection chip, Status
chip, firmware, adapter count, then the four buttons — so index 5 is the Error chip.

**Neither the Error chip nor the Idle chip below it survives the swatch detector.** They are short
words in small pills and their fill ratio falls under the threshold that the wider **Connected** and
**NoContact** pills clear. That is why this target is an ink index and not a `#FECACA` swatch, and it
is why the golden case matters: index 4 is the Connected chip, the same shape, 60px to the left, and
nothing in the console would say so.

## The backdrop and the gutter

The single label sits in the derived bottom gutter, outside the captured content area, so the
backdrop rule applies. It also fixes a misreading: with no backdrop the gutter takes
`report.background.hex`, which here is the shell's own `#F1F4F8`, so the band under the card would
read as more application chrome and the page would appear to continue past the bottom of the picture.

`backdropPadding` is **40**, not the 68 the 4.5% floor would give. This figure's margin is derived,
so the floor widens it and every pixel of the table shrinks with it — at the default the figure goes
to 1642 and the rows fall from 9.9 to 9.6 CSS px. 40 publishes as roughly 20 CSS px of gradient
beside the card, which is enough for it to float.

**Bottom, not a side.** A side gutter on a figure this wide is the expensive axis: 250px of it would
take the rows under 9 CSS px, while a vertical gutter costs nothing at all. The price is a leader
that has to reach up past PGM-04's row, and `labelShift: [0.1, 0]` slides the label right so the
sweep threads the lane between the **Idle** chip and the firmware column instead of crossing either.

Measured on the rendered output, the label is `#F3B757` on `#372358` — **7.62:1**. On-page label type
is 17.1 CSS px.
