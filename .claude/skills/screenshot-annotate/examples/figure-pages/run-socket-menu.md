# run-socket-menu.png

`docs/help/images/run/run-socket-menu.png` · 641×553 · 73 KB ·
*Run* → Socket status and actions.

## What it shows

The right-click socket menu raised on a selected socket while the run is active: the italic reason
line, **Mark Fail** and **Mark Empty** greyed, **Disable socket** live, **Clear Selection**. Two
callouts.

## Getting back to something close

The shared mocked run (see the index) at 1440×900, `deviceScaleFactor: 1.5`.

**Drive it the way the article says to** — left-click a socket, then right-click it — so the selection
outline in the figure is the real one and not a forced state. Both clicks land on the bottom-left
square, at its bottom-left corner: the menu is `position: fixed` at the cursor, so anchoring there
drops it clear of the grid (every square stays visible, including the outline on the one clicked) and
keeps it inside the card's own width, so the clip never reaches PGM-02. A right-click fires no `click`
event, so the menu's own outside-click dismissal does not race the capture.

Clip the union of the card and the menu, **padded 8** — the one padded clip in this set, because the
menu's `shadow-lg` lives outside its border box and a zero pad shears it off.

**`machineState: 'Running'` is what makes this figure worth taking.** The menu then renders its
`disabledReason` line, greys the two Mark items and leaves **Disable socket** live — the asymmetry the
section spends three sentences on. Read the reason line and every item's `disabled` flag back out of
the DOM and refuse to write unless they are what the article describes.

## Why it is annotated the way it is

No numbers: the section is prose and an action table.

Two callouts — *Blocked while a run is active* on the band holding both Mark items, and *Still works
during a live run* on the band holding Disable socket.

**The two only make sense as a pair.** Alone, each looks like it repeats the menu: the reason line
already prints *State changes disabled while a run is active*. What the picture gets wrong is
**scope** — one italic line at the top of a menu reads as governing the whole menu, and it does not.
Disable socket sits below it and works anyway. The labels exist to draw the boundary the menu itself
does not draw, and neither earns its place without the other. Same construction as the three labels on
[`unsaved-changes.png`](unsaved-changes.md).

**Targets come free from the menu's own divider rules.** Each section of the menu is a separate
uniform region because the 1px `border-t` rules break them apart, so height alone separates the reason
band, the two-item Mark band, the Disable band and the Clear band. No counting, no ink pass.

**Both labels go in the right margin, and have to.** The menu spans nearly the full width of the clip,
so a top or bottom label would need a leader crossing the menu — style guide 1.4. The two bands are
far enough apart vertically that the two labels stack without colliding. The gutter is sized by a
two-line wrap rather than a one-line one, which keeps the finished figure inside the content column so
the menu's type renders at native size instead of being scaled back down.

Rejected: **Clear Selection**, which is self-describing; and the *absence* of a **Mark Pass** entry,
which is the other thing this figure shows and cannot ring — a ring cannot enclose something that is
not drawn. The article's note explains why Mark Pass is missing.

### The backdrop

Both labels sit in the derived 195px right gutter, outside the captured UI, so the backdrop rule
applies; that gutter was previously filled with the tile's ground and read as more application chrome
beside the menu.

**Free.** 620px becomes 641px against a roughly 807px column, still under it, so the menu's 12px type
stays at 18.0 CSS px and the label scale is untouched.

**The 8px capture pad survives the conversion, and should.** This is the one padded clip in the set,
and it is tempting to read it as the same thing `pad-clip.mjs` synthesizes around the account-menu
figures — the redundancy the backdrop is supposed to retire. It is not. Those 8 CSS px are *real page
ground*, captured, holding the menu's `shadow-lg`, and removing them shears the shadow off. On the
gradient they publish as a thin light mat between the UI and the backdrop, which reads as what it is:
the page the menu is drawn on. Synthesized margin is what a backdrop replaces; captured margin is
content.

Measured on the rendered output, both labels go from 2.87:1 and 2.88:1 — under the 3:1 floor — to
9.02:1 and 9.61:1.

## Known issues

**Figure and prose have been reconciled — do not re-fix this in the wrong direction.** The article's
action table used to say "Fail" and "Empty"; the controls are **Mark Fail** and **Mark Empty**
(`DeviceStateMenu.tsx:57` renders `Mark {state.label}`). The table now names them correctly, and a
**Clear Selection** row — which was missing entirely, and which this figure shows — has been added.
The figure and the table agree.
