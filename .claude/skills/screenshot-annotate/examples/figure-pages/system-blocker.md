# system-blocker.png

`docs/help/images/getting-started/system-blocker.png` · 3139×2059 · 537 KB ·
*Navigating the Application* → Banners and blocking overlays.

## What it shows

The full-screen blocking overlay over the dashboard, on the aubergine backdrop, 1440×900 to match
`app-shell.png`. Three callouts: the held navigation, the card itself, and the acknowledge button.

## Getting back to something close

**There is no REST endpoint to mock.** `SystemBlockerOverlay` is driven by `activeBlockers` in
`uiStore`, filled by the SignalR `SystemBlockerChanged` event, and the mock layer aborts `/hubs/` so
the shell does not hang waiting for a socket that will never connect. Seed the store directly
instead: from the page, dynamically import the same Vite module URL the app already loaded — that
returns the same module *instance* — and call the store's own `setSystemBlocker` action. The rendered
pixels are then the real component on real store state, not a lookalike.
[`run-socket-states.png`](run-socket-states.md) uses the same technique on `runStore`.

Whole window at 1440×900, `deviceScaleFactor: 2`, matching the article's other whole-window figures
so the three agree with each other on the page.

**The payload is a judgement call worth knowing about.** The backend ships four blocker payloads
(`SystemController` homing; `TrayFeederCoverMonitor` cover-open, cover-closed-acknowledge,
remove-tray). The article's example is a safety cover *open* — but that phase carries **no dismiss
control**, and the section's third sentence describes one. The figure therefore uses the
*acknowledgement* phase of the same `tray-feeder:cover` blocker, and the caption says so. Swapping to
the cover-open payload costs the third callout.

## Why it is annotated the way it is

No numbers: the section is prose, not a numbered sequence.

All three labels come from the section's own sentences, and all three sit in **open space inside the
frame** rather than in a gutter. The scrim leaves large uniform areas to drop a label into, and a
side gutter would widen the figure and shrink the capture further inside the content column.

The label wrap is deliberately tight, forcing three short lines rather than two long ones: the card's
label has to live in the narrow column between the notification timestamps and the window edge, and
at the default wrap it ran two long lines that touched the timestamps on one side and stopped a few
pixels short of the window edge on the other.

**Two target decisions were forced by the scrim.**

- *The dismiss button is white on a white card*, so the swatch detector cannot see it. It is the only
  ink cluster inside the card above a minimum width and height — the check icon and every text run
  fall below one or the other — which isolates the button's border box rather than the glyphs inside
  it.
- *The navigation is ringed by its item list, not by the nav panel.* The panel runs from the title-bar
  rule to the status-bar rule with nothing else in the callout set to cap the ring padding, so its
  ring inflated past both and struck through the job name in the status bar. Fusing the nav's ink from
  the collapse button down to About gives a ring that stops where the items stop.

**Every label home is an empty region measured *within the content panel*.** Unconstrained, the scrim
makes the nav and the content read as one continuous background, so the largest empty regions straddle
the nav's right-hand rule and the nav label lands on top of its own ring. Two labels share one home
and are pulled apart by hand, because the layout's own overlap fix only ever pushes a label *down* —
and here that pushed it through the status bar and off the window.

**The aubergine backdrop is doing contrast work, not decoration.** The overlay's own scrim is
`bg-black/70`, which puts the whole capture near RGB 72; the light-background amber has a contrast
ratio near 1.9 against that. A dark backdrop switches the palette to the lifted ring and label
colours, which clear it comfortably. It also matches `app-shell.png`, the article's other whole-window
figure, so the pair reads as one set.

`cornerRadius: 26` matches `app-shell.png` — a deliberate opt-in against the default of 0, clipping
only backdrop-adjacent scrim pixels.

## Known issues

**A reader comparing hard will notice the figure says *closed* where the prose says *open*.** That is
the payload trade above, and it is recorded rather than hidden: the caption names the acknowledgement
phase.
