# programmer-sockets.png

`docs/help/images/programmers/programmer-sockets.png` · 858×555 · 94 KB ·
**aubergine backdrop** · *Programmers* → Sockets and adapters.

## What it shows

The **Sockets** section of PGM-03's detail flyout: four socket rows carrying a pass, a fail with a
consecutive-failure count, a socket switched off behind an adapter that failed validation, and a
socket with no adapter at all. Wear bars in all three of their colours. Two callouts.

## This is not a second take on `run-socket-states`

Worth stating first, because the two figures sound alike and are not. `run-socket-states.png` is the
**Run** page's grid of coloured squares and exists to be a legend for six appearances of one control.
This is the Programmer Manager's socket **list** — a different control showing different columns:
adapter serial, adapter state, on/off, consecutive failures, actuation wear, and lifetime pass and
fail. The grid shows none of those. Both callouts here name things the grid has no equivalent for,
which is the check that keeps the two apart; if a future callout here could equally have been written
on the grid, it belongs on the grid.

## Getting back to something close

`docs/help/.screenshots/capture-programmers.mjs`, state C. Click PGM-03's row, wait for the panel's
`transition-transform` to land on the viewport edge, and clip from just above the **SOCKETS** heading
to just under socket 4.

**Wait for the transform, not for a timeout.** The panel slides in over 200ms and the first probe
measured its left edge 38px out mid-slide, which would have clipped a diagonal band of page down one
side of the figure.

**Clip the top against the property chips, not against a fixed offset.** The **Connection** and
**Status** tags of the properties grid sit about 19px above the SOCKETS heading, and a flat −18
offset catches the bottom two rows of both, so the figure opens on a green and a red sliver. The
clip takes whichever bound is lower.

The right edge is the window edge: the flyout is `right-0` and there is no page beyond it.

## Why four sockets

**The socket count is a legibility budget, not a stylistic choice.** `main.css` caps a figure at
`max-height: 60vh`, an `AdapterSocketRow` carrying a wear row is 82 logical px tall, and eight of them
make a 1002px-tall figure that the cap scales down to about 11.6 CSS px of type. Four rows keep the
whole figure under the cap, so it publishes at native pixels and its 12px type lands at 16.9.

Nothing had to be fudged to get there. PGM-03 is the LumenX in the list and the list says LumenX
units carry four sockets, so the two figures agree.

**PGM-03 rather than PGM-01, because it is the faulted unit in
[`programmer-manager.png`](programmer-manager.md).** The list says PGM-03 is Connected and in Error;
this panel says why — socket 3's adapter failed validation at 97% of its rated life and the socket has
been switched off. Any programmer would have illustrated the section; this one also answers a question
the previous figure raises.

## Why it is annotated the way it is

No numbers: the section is a bulleted inventory, not a numbered sequence.

**Two callouts, and neither is a caption.** The article's five bullets for this section are unusually
complete — they name the index, the status dot, the adapter identity, the on/off state, the failure
count, and the wear bar with both its thresholds. Ringing any of those repeats the prose. What the
bullets do not resolve is what the picture makes confusing on its own:

- *Consecutive, not the total below*, on socket 2's red `3 fail`. **The row prints two different fail
  counts about 40px apart and nothing on screen distinguishes them.** `3 fail` beside the On tag is
  `consecutiveFailureCount`; `139 fail` on the line under it is the adapter's lifetime `failCount`
  out of `AdapterLife`. The article names only the first. A reader going down the row sees the number
  jump from 3 to 139 with no way to know they measure different things — a confusion the figure
  creates and therefore has to clear up.
- *A readout, not a switch*, on socket 3's `Off`. The On/Off tag is a PrimeReact `Tag` with no
  `onClick` — a readout that looks exactly like a switch, on the one row where a reader most wants to
  press it. The article does say sockets are taken out of rotation from the Run screen, two
  paragraphs later; what it never says is that the thing that looks like the control here is not one.
  Ringing the **Off** tag on the socket that *is* off is the pointed version.

**Rejected:**

- **The wear bar, in all three of its colours.** It is the most eye-catching thing in the figure and
  the article covers it completely — actuations against the rated maximum, amber past 80%, red past
  95% — so a ring would say strictly less than the sentence above it.
- **The `No adapter` row and the em-dash device status.** Both named in the bullets verbatim.
- **The red `ValidateFailed` beside ADP-13.** Likewise: *"An adapter in a bad state is called out in
  red next to its name."*

**One thing the figure shows that the article does not mention at all:** the `N pass · M fail`
lifetime tally under each wear bar. It came close to being the second callout and lost to the
consecutive-versus-total confusion, which needs the tally as its *evidence* rather than as its
subject — the second label points at `3 fail` and says "the total below", which names the tally
without spending a ring on it. Worth reporting as a documentation gap.

## Targets

Each socket card is a `#FFFFFF` region 517×114, separated from its neighbours by the 1px `#CBD5E1`
rules the detector finds.

**`minHeight: 80` is load-bearing.** It drops socket 4, which is only 57px tall *because* it has no
adapter and therefore no wear row — that is what makes `top-to-bottom index 1` socket 2 and `index 2`
socket 3 rather than an arbitrary count. Without the filter both rings walk one card up.

Inside each card the target is simply the rightmost ink cluster: `3 fail` on socket 2, the Off tag on
socket 3. **Note the asymmetry it hides:** on socket 1 the green On tag is detected as ink because
the fill is saturated, while socket 3's grey Off tag is not — the cluster there is the word alone.
The ring's own padding covers the difference, and the two rings come out visibly similar.

## The backdrop and the gutter

Both labels sit in the derived right gutter, outside the captured flyout, so the backdrop rule
applies. Free: the capture is 570px against a roughly 807px column, so the 4.5% padding floor is
absorbed without the figure ever being scaled below what the gutter alone costs it.

**The gutter started on the left and had to move.** Left is the intuitive side — the flyout's right
edge is the window edge, and a right gutter puts labels beyond a boundary that is a real screen edge
in the product. But both targets sit at the far right of their rows, so every left-hand leader
crossed the full width of its card and struck through `#2 ● Fail ADP-12` and
`#3 ● Disabled ADP-13 ValidateFailed` on the way. **The renderer did not warn**, because unfilled
text is not in its obstacle set — it was found by looking at the PNG, which is the only thing that
finds it. Moving the gutter to the right gives two short leaders that cross nothing, and it is the
same fix [`shell-activity-rail`](shell-activity-rail.md) made for the same reason.

`fontScale` is **1.2**, lifting the labels off a 570px capture to 17.1 CSS px on the page.

Measured on the rendered output: `#FFCB60` on `#382C4F` — **8.55:1** — and `#FFCC60` on `#33234C` —
**9.41:1**.
