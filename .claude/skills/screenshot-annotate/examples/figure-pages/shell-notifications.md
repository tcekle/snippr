# shell-notifications.png

`docs/help/images/getting-started/shell-notifications.png` · 1458×726 · 175 KB ·
**aubergine backdrop** · *Navigating the Application* → Notifications.

## What it shows

The top of the Notifications panel: header, both tabs, the clear-all control and two unread entries —
one Warning, one Error. Two callouts.

## Getting back to something close

A crop of `figures/sources/app-shell.png`, whose capture already has the panel open. Re-shoot the
overview first, then re-derive the rectangle with `scripts/measure.mjs`.

Every bound is one of the panel's own edges, and each was chosen against a specific stray. The top
starts at the title bar's rule so the bell button's tray does not hang into the edge. The right stops
at the rule against the activity rail so the rail's blue open-panel indicator does not appear as an
unexplained stripe. The left runs a few pixels past the panel's divider so the divider reads as an
edge rather than as the frame. The bottom cuts at the rule under the second entry — stopping before
the panel's large empty middle (the feed holds only two notifications) and therefore also before the
footer count bar, which the article does not describe.

Forced gutters on both sides, because neither target touches the frame and the panel has no
whitespace of its own: the first draft laid both labels straight over the notification text.
Widening those gutters past their current values buys label room by shrinking the UI the figure
exists to show.

**Selectors key off the five white blocks.** The panel's body is a stack of them and nothing else in
the capture is white and in that width band, so a width filter names them without resolving the panel
first. Top to bottom: tabs, clear-all plus the first entry, the second entry, the empty remainder,
the footer count bar.

## Why it carries a backdrop

Both labels sit in the forced side gutters, outside the captured panel, so the backdrop rule applies.
Costless, for the usual reason: the margins are forced, a forced margin replaces the backdrop's
padding floor, so the published PNG is still 1458×726 with the panel's 15.5 CSS px text and 17.7 CSS
px labels unmoved. 109 → 175 KB.

**The 24px top and bottom trim was kept on purpose, and it is not the obvious choice.** This figure is
width-limited, so height is free: it could grow to about 1084px before the 60vh cap binds, and a 110px
gutter above and below was rendered and compared. It is worse. The crop cuts the panel just past the
rule under the second entry, and floating that cut edge 110px clear of the frame turns an honest "the
feed continues below" into what reads as a torn-off panel with a white lip. Hard against the frame, a
cut reads as a crop, which is what it is.

Note when re-rendering: the amber sweep for "on light ground" label ink flags ~4% of this figure's
`#F6BA58`-range pixels. Those are the product's own amber Warning triangle inside the panel, not
annotation. All annotation ink is in the gutters.

## Why it is annotated the way it is

A severity table and two paragraphs, not a numbered sequence, so no numbers.

- *Marks them read — they move to the Read tab*, on the clear-all control. **The strongest callout in
  the set.** The button is captioned "Clear all notifications", which reads as delete; `handleClearAll`
  in `NotificationPanel.tsx` posts `/notifications/mark-all-read` and calls `markAllRead`, so nothing
  is destroyed and the entries reappear under **Read**. Same shape as the Cancel label on
  `unsaved-changes.png`: the caption says what the button is called, the label says what happens.
- *Severity: Error, Warning or Information*, one ring over both glyphs. A severity icon is the
  leftmost thing in its entry, so a leftmost pick finds it in each entry block without counting.
  Ringing them separately would put two labels on one column of two icons and say less.

Rejected: the **Unread**/**Read** tabs (captioned on screen and named in the prose), the close **X**
(self-evident), and the per-entry chevron — the prose's "click it to expand" cannot be illustrated by
entries that are already expanded.

## Known issues

- **Two rows of the prose are not in this state and a crop cannot invent them.** There is no
  Information entry, so the per-entry **Clear** button — which `NotificationPanel.tsx` renders only
  for Information in the Unread tab — is absent, and no message is long enough to be truncated. Both
  are covered by the prose table. Manufacturing them would have cost the pixel agreement with
  `app-shell.png`, which is worth more than illustrating two more table rows.
- **Figure and prose have been reconciled — do not re-fix this in the wrong direction.** The article
  used to say "Mark all read", which is not the name of any control. It now names **Clear all
  notifications** correctly and states that entries move to the **Read** tab rather than being
  deleted, which is what the callout says. The two agree.
