# run-socket-states.png

`docs/help/images/run/run-socket-states.png` · 437×378 · 41 KB ·
*Run* → Reading the socket grid.

## What it shows

A programmer card carrying one socket of every appearance the grid can produce, rendered by the real
`DeviceSlot` component rather than drawn as a legend. Row 1 is the four resting appearances the colour
table lists — pass, fail, no device, disabled. Row 2 is four sockets holding a device in flight, each
showing its state code where a number normally sits. One callout.

**The article's two tables, one per row.** That is why the card is laid out this way and not another.

## Getting back to something close

The shared mocked run (see the index) at 1440×900, `deviceScaleFactor: 1.5`, same clip logic as
[`run-programmer-card.png`](run-programmer-card.md) — the card's border box, no pad. Only the socket
payload differs.

Sockets 1–4 come from the mocked `/job/programmers`: Pass, Fail with a consecutive-failure count,
unpopulated, and `isEnabled: false`.

**Sockets 5–8 need an in-flight device each, and those come from no endpoint.** `activeDevices` is
filled by SignalR or by the 500ms progress poll, neither of which runs in a mocked capture. Seed them
straight into the app's own store the way [`system-blocker.png`](system-blocker.md) seeds `uiStore` —
from the page, dynamically import the same module URL the app already loaded (which returns the same
module *instance*) and `setState` four devices onto PGM-01's site, in states Initializing /
MovingToProgrammer / Programming / MovingToOutput. The rendered squares are then the real component
reading real store state. Wait for a state code to be visible before clipping.

**This is the one Run figure that is not the same moment as the overview**, and that is a deliberate
trade. PGM-01 there holds six passes, one fail and one empty; here it holds eight different things.
The overview state contains three of the six appearances and none of the codes, so a figure cropped
from it could only illustrate half a legend — and the missing half is the half words are worst at:
diagonal stripes, and a four-letter code where a number normally is. The article's prose for this
section is about what happens "while a run is in progress", which is a later moment than the overview,
so the caption says so. A reader comparing hard will see a different PGM-01. Same class of judgement
as the cover-open / cover-closed swap on [`system-blocker.png`](system-blocker.md).

## Why it is annotated the way it is

No numbers: the section is two reference tables.

**One callout.** The colours *are* the content of this figure and the table directly above it names
every one, so ringing a colour would repeat the prose — and ringing one of six things the reader is
meant to compare would say the opposite of what the figure is for, which is the argument
[`run-themes.md`](run-themes.md) makes at more length.

The single exception is the bare number in the empty socket: *An empty socket shows its number*. A
number floating in a grey square is the one thing here that neither the picture nor the article
explains anywhere. It is `String(socket.index)`, shown only when the socket holds no device — which is
also what makes the row-2 codes legible as *replacements* rather than as extra decoration.

**A tightened colour tolerance is load-bearing on that target.** The empty socket is the only region
inside the card that shares the card's own fill, but the pass green is close enough to the card fill
to win the first index at the default tolerance — a ring around the wrong square, with nothing in the
console to say so.

The label sits in the top margin, so the figure takes no horizontal gutter and publishes at the
capture's own width, rendering at native pixels.

### The backdrop

The single label sits in derived margin above the card, outside the captured UI, so the backdrop rule
applies — and for the same reason as its twin [`run-programmer-card.png`](run-programmer-card.md):
the margin was filled with the card's own fill, so the card appeared to extend into the gutter and the
label read as part of the product.

**Free.** 401px becomes 437px against a roughly 807px column, still native pixels, so the tiles' 10px
code type stays at 15.0 CSS px and the label scale is untouched.

Measured on the rendered output, the label goes from 2.86:1 — under the 3:1 floor — to 7.42:1.

**It does nothing for the `OFF` tile below.** That contrast problem is *inside* the capture, and
nothing outside the window can reach it; see Known issues. Worth stating because the two are easy to
conflate: a backdrop repaints the ground the *annotations* land on, never the ground the *product*
draws on.

## Known issues

**The `OFF` label is grey type on grey diagonal stripes** — about the lowest-contrast thing in the
product's light theme. It is legible at the size this figure publishes at, and it is what the operator
actually sees, so it is reproduced rather than fixed. **If the stripe treatment ever changes, this is
the figure to re-shoot.**
