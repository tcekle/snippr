# app-shell.png

`docs/help/images/getting-started/app-shell.png` · 3139×2360 · 522 KB ·
*Navigating the Application*, top of the article.

## What it shows

The whole application window on the aubergine backdrop, with four callouts naming the title bar,
left navigation, activity rail and status bar. Signed in as a Supervisor on the dashboard, with the
Notifications panel open — that last part was not chosen, it is simply the state the capture was
taken in, and five other figures now depend on it.

## Getting back to something close

Signed in, on the dashboard, whole window at 1440×900 and `deviceScaleFactor: 2`. Nothing beyond
what the dashboard itself needs is mocked.

**This one predates the capture harness.** It was taken by hand before `mocks.mjs` existed, so the
recipe above is reconstructed from the capture rather than read off a script that was ever run —
treat it as less certain than the rest of the set.

**Re-shooting it re-cuts five other figures.** `shell-title-bar`, `shell-left-navigation`,
`shell-activity-rail`, `shell-status-bar` and `shell-notifications` are all crops of this same
source, not separate captures, and every crop rectangle is expressed in this capture's own 2880×1800
coordinates. Re-derive them with `scripts/measure.mjs` rather than scaling the old numbers. The
crops exist because a detail that agrees with the overview pixel for pixel is worth more than a
fresher capture that quietly disagrees about the job name, the signed-in role or the notification
feed.

## Why it is annotated the way it is

A frame diagram, so no numbers: the section is prose, not a numbered sequence.

The title bar and status bar span the full width, so their labels sit in the backdrop margin above
and below. The nav and the activity rail run the full height, and a label beside either would be
pinned to the extreme edge of the picture — so those two go in open space *inside* the frame, found
by measurement rather than by hand, with a long swept leader out to each. The two homes are the
empty content area below the notifications card and the empty lower half of the notifications panel.

Nothing at control level is ringed. That is the division of labour with the five detail crops: this
figure teaches the four-part frame, they teach the controls.

`cornerRadius: 26` is a deliberate opt-in against the default of 0 — this is a window silhouette
floating on a backdrop and the real window has rounded corners. At that radius only
backdrop-adjacent background pixels are clipped, so no UI is lost.

## Known issues

- **The Notifications panel is open.** For a figure whose job is to teach the four-part frame, a
  clean capture with the panels closed would be stronger; this one serves the *Activity rail*
  section better than it serves its own. Carried in the style guide's unresolved list.
- **The window buttons are missing and cannot be added.** `TopBar.tsx` guards them with
  `{isElectron && …}` and every figure in this set is a browser capture, so customers see chrome
  here that no figure can show. Permanent without a packaged Electron build.
- **Two of the four labels are washed out, and it is the backdrop palette that does it.** *Title bar*
  and *Status bar* sit in the gradient margin and measure 6.9:1. *Left navigation* and *Activity
  rail* use `labelIn` to sit in open space **inside** the frame — on the app's own white content area
  — and the dark-ground amber `#F6BA58` measures **1.77:1** there, below the 3:1 floor for large
  text. Both were sampled from the published PNG, not estimated. The root cause is that the palette
  is chosen once per figure from `backdrop.dark`, while `labelIn` can place an individual label on a
  ground the opposite of the backdrop's. Nothing here is a wrong crop or a wrong margin.

  **The preferred fix is now `labelPlate`, not relocation.** This page used to name gutter
  relocation as the candidate — the cure `service-mode-banners` got — and then noted that it is
  awkward here because both problem labels name full-height panels, so a gutter label beside either
  is a label pinned to the extreme edge of the picture. That objection has not gone away. What has
  changed is that there is now a remedy that does not move anything: `"labelPlate": true` in the
  spec draws a dark hand-edged chip behind every label and puts the lifted amber on it, so a label
  sitting on app white takes its own ground instead of the page's. On `unsaved-changes`, whose
  labels are on a `#999999` scrim, it took three labels from 1.33:1 to 8.59:1 without changing the
  figure's dimensions, crop or on-page type size. Applied here it would keep the composition this
  page argues for — the two long swept leaders into open space — and fix the contrast, which
  relocation cannot do without giving up the composition.

  **This figure has still not been changed, and the change is not trivial.** A plate is drawn *over*
  the capture, so on a whole-window figure the two plates would cover UI in the content area and in
  the notifications panel — flat regions in both cases, but it needs looking at, and the plate rows
  will need hand-placing the way `unsaved-changes`' did. Applying it also re-cuts nothing, since the
  five detail crops come from the source rather than from this figure's output. Gutter relocation
  and the backdrop margin (~130px each side, and both panels touch their frame edge) remain on the
  table as alternatives; the plate is simply the first one to try now.
