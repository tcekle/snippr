# Figure index

Every annotated figure that ships with `docs/help`, and where its reasoning lives.

**This file exists because almost nothing else survives.** `figures/*.json`, `figures/sources/` and
`test/golden/` are gitignored, and the capture scripts under `docs/help/.screenshots/` always were.
Of the whole chain that produces a figure, **only the published PNG in `docs/help/images/` is
committed.** Every decision about crop bounds, mock payloads, selector logic and rejected callouts is
local-only and leaves with the branch it was made on. This index and the pages under
`references/figures/` are the record.

## What is committed, and what is not

```
docs/help/.screenshots/capture-*.mjs   local only — scratch, deleted after use
        │
        ▼
figures/sources/<name>.png             local only — the raw capture
        │
        ▼
figures/<name>.json                    local only — crop, callout targets, label placement
        │
        ▼  node scripts/annotate.mjs figures/<name>.json
docs/help/images/…/<name>.png          COMMITTED — the published figure
        │
        ▼
test/golden/<name>.png                 local only — byte-comparison guard
```

What that means on a fresh clone:

- **The golden suite cannot run.** There are no sources and no specs to render, and no goldens to
  compare against. It only protects a working tree that already has the figures locally.
- **Re-deriving a figure means re-shooting it**, not re-rendering a spec. There is no "edit the JSON
  and re-run" path any more for anyone who did not make the figure in the first place.
- **The published PNG is the artifact.** Treat it as read-only output; never point a spec's `source`
  at it, or the next render annotates its own output — rings on top of rings.

A figure's page under `references/figures/` therefore has to carry enough to get back to *something
close*, not enough to reproduce the exact bytes. That is the deliberate bar. Numbers survive on those
pages only when the number carries its own reason; pure tuning against one capture's pixels does not,
because it means nothing against a new capture.

## Doctrine that applies to every figure

**Does the callout say something the picture doesn't?** The single test. A ring labelled "Cancel"
beside a button captioned Cancel says nothing; a ring labelled *Cancels leaving, not the edits* says
what the caption cannot. Callouts that name a part the prose already names get cut. Callouts that name
a **consequence**, a **scope**, or an **unlabelled glyph** get kept. Rejections are recorded on each
figure's page, because the next person will otherwise re-propose a callout that was already considered
and cut.

**`marker-rings` is the only permitted style.** Eight other presets are implemented and reachable via
`--style`; they were reviewed and not kept. A figure arriving in a different hand is a defect, not a
variation. Even a figure with zero callouts records `marker-rings`, so that if one is ever added it
arrives in the house hand.

**A backdrop goes on any figure whose annotation content sits outside the app window.** If labels
live in synthesized margin around the captured UI, that margin is not part of the product and the
aubergine gradient says so. If every annotation is contained within the captured view, the figure
stays on white, because there is no "outside" to fill. Whole-canvas or crop is not the test — this
supersedes an earlier rule that said backdrops were for whole-canvas figures only, which is why
several crops with large label gutters shipped on white and were converted later.

`unsaved-changes` is the worked example of the contained case, and it is the one that looks like it
should have a backdrop and deliberately does not: its three labels are drawn on the dimmed Settings
page *behind* the dialog, inside the capture, so its published PNG is exactly its source's 1350×912
with no margin at all. Nothing would go under a gradient but the figure's own edges.

**`sign-in` is the second, and it is the better cautionary tale**, because it looks nothing like the
contained case: four labels, four long sweeping leaders, two thirds of the frame empty. Its margins
are also 0/0/0/0 — the published 2506×1034 is a crop of the capture and nothing else — and all four
labels land on the sign-in route's own page ground *inside* the crop. Rendered on aubergine to check
rather than to assume, all four fall from 3.46:1 to **1.57:1** and on-page type falls from 9.0 to 8.1
CSS px. **The test is the margin, not the whitespace. A figure can look like it has a gutter and have
none**, and empty product background is not a gutter.

Twenty-seven figures carry the aubergine gradient today: `app-shell`, `system-blocker`, `run-themes`,
`shell-title-bar`, `shell-left-navigation`, `shell-status-bar`, `shell-notifications`,
`shell-activity-rail`, `service-mode-banners`, `account-menu`, `account-menu-operator`, `my-account`,
`my-account-password-rejected`, `run-job-bar`, `run-pipeline`, `run-statistics`, `run-programmer-card`,
`run-socket-states`, `run-socket-menu`, `programmer-manager`, `programmer-row-actions`,
`programmer-add`, `programmer-sockets`, `teach-not-homed`, `teach-component-picker`,
`teach-utilities` and `teach-step-wizard`. Every figure in *Navigating the App*, *Signing In*, *Run*,
*Programmers* and *Teach* with annotation content outside the window now has one; `unsaved-changes`
and `sign-in` are the two contained figures that correctly do not.

**`programmer-add` and `unsaved-changes` are the same class of screen resolved two different ways,
and the pair is the clearest statement of the rule there is.** Both are a modal over a dimmed page.
`unsaved-changes` has three labels that had to stay inside the frame, because a side gutter wide
enough for them would have cost about a fifth of the dialog's type — so it takes plates and no
backdrop. `programmer-add` has two labels and both targets on the card's right-hand edge, so the
gutter is affordable and the backdrop follows. Nothing about the *kind* of screen decided either
one; what decided both is whether the labels could leave the frame.

**`service-mode-banners` and `shell-activity-rail` were both rejected first, and both rejections were
sound about the figure as it stood.** Neither was overturned by re-reading the rule; each was
overturned by changing the figure so the objection stopped applying, and that is the pattern to copy
rather than the verdicts:

- `service-mode-banners` had one label in the gutter and one placed inside the frame with `labelIn`,
  where the dark palette measured **1.77:1**. Moving the second label out into a bottom gutter puts
  both on the same ground; both now measure above 6.8:1. It cost a crop — the Quick Actions tiles
  leave no lane for a leader coming up from below, so the capture stops above them.
- `shell-activity-rail` was a 108×280 strip in a 468px figure — 7% of the area, 23% of the width —
  and read as a stripe on an empty purple field at every margin tried. Widening the crop to take in
  the notifications panel the rail sits against makes it 46% of the area and 55% of the width, and
  moving its gutter from the left to the right stops both leaders crossing panel content.

Both pages carry what was tried and rejected on the way, including the framings that looked cheaper.

**Adding a backdrop to a crop with forced margins is free; to one with derived margins it is not.**
A forced margin replaces the backdrop's 4.5%-of-width padding floor outright, so the published PNG
keeps its exact dimensions and on-page type does not move at all — only the gutter colour, the label
palette and the byte size change. A *derived* margin is max'd against the floor instead, so the floor
widens the figure and every UI pixel in it shrinks on the page. `shell-status-bar` is the worked
example: it needed `backdropPadding` hand-sized to 90 and `fontScale` re-derived as
`old × newWidth ÷ oldWidth` to hold its type. `service-mode-banners` is the second, at 40. Check
which kind of margin a figure has before promising the change is free.

**Zero side padding is not the way out of that.** It does hold the UI size exactly — the figure keeps
its capture's width — but the window then bleeds off both sides and the gradient survives as two
horizontal stripes rather than a surround, which is precisely the failure the padding floor exists to
prevent. It was rendered and rejected on `service-mode-banners`. Pay the few percent instead.

**A small detail clip that already publishes under the column pays nothing at all, and that is the
common case, not the exception.** The floor is 4.5% of the *capture*, so on a 400px clip it is 18px a
side, and a figure with room under the ~807px column absorbs that without ever being scaled. All four
of the 1:1 Run details converted at exactly zero cost to on-page type — `run-statistics` 15.0 → 15.0,
`run-programmer-card` 16.5 → 16.5, `run-socket-states` 15.0 → 15.0, `run-socket-menu` 18.0 → 18.0 —
and their labels did not move either, so `fontScale` stayed untouched. Check the width before assuming
the conversion is expensive: the two figures that had to pay were a full-width strip
(`shell-status-bar`) and a 1314px bar (`run-job-bar`), both already over the column.

**`padClip`'s synthesized margin and a backdrop are the same thing, and stacking them is worse than
either.** Four sources in *Signing In* were clipped flush against real screen edges and composited
onto a corner-sampled band by `docs/help/.screenshots/pad-clip.mjs`, 48px on all four sides. A
backdrop supplies that margin itself — so on conversion the pad has to be cropped back off, and not
for tidiness: `composeFigure` draws the drop shadow and the hairline around the **screenshot
rectangle**, so with the pad left in, the object floating on the gradient is a flat slab of
corner-sampled grey with the UI somewhere inside it. The window silhouette stops being the window.
Cropping it also pays for the conversion outright, since the figure comes out narrower than it was on
white: `account-menu` 767 → 688, `account-menu-operator` 802 → 723 (back under the column, so it holds
21.0 CSS px instead of dropping to 20.5), `my-account` 1607 → 1498 (10.5 → **11.3** CSS px) and
`my-account-password-rejected` 1101 → 1036 (15.4 → **16.4**). Keep capturing the pad — it is what
makes a source usable without a backdrop, and 48 is `padClip`'s own default rather than a measured
pixel, so the crop key carries its own reason.

**Captured pad is content and stays.** `run-socket-menu` is the counter-example and the two are easy
to confuse: its clip is padded 8 CSS px because the menu's `shadow-lg` lives outside its border box,
and those pixels are real page ground. On the gradient they publish as a thin light mat between the UI
and the backdrop, which is what they are. Synthesized margin is what a backdrop replaces; captured
margin is part of the picture.

**Correct a padding tax; do not correct a zoom.** `fontScale` is re-derived as `old × newWidth ÷
oldWidth` when a backdrop's side padding widens a figure, because that padding adds nothing to the
picture and shrinks everything on the page — `shell-status-bar` and `run-job-bar` both do this. It is
**not** re-derived when the width moves because a redundant mat came off, as on the four `padClip`
figures: that is a uniform zoom, every pixel in the figure changed by the same ratio, nothing inside
it moved relative to anything else, and correcting it would make the labels smaller against the UI
than they were tuned to be.

**The label palette is chosen once per figure, and `labelIn` can defeat it.** A dark backdrop lifts
every label to `#F6BA58`, which measures 6.8–8.3:1 on the aubergine and **1.77:1** on the app's white
content area. A label placed inside the frame with `labelIn` on a dark-backdrop figure is therefore
below the 3:1 floor for large text. Two of `app-shell`'s four labels are, and that defect is recorded
on its page — with `labelPlate`, below, now named there as the cheapest fix for it.

**A mid-grey ground caps the achievable contrast for *any* ink, so on one, no colour is the fix.**
This is the general lesson and it is worth internalising before reaching for a palette. Contrast is a
ratio of luminances, so the darkest ink and the lightest ink are both *closer* to a mid grey than
either is to black or white. Against the `#999999` of a modal's dimmed page, pure white — the best
light ink that exists — reaches **2.85:1**, under the 3:1 floor for large text; `#F6BA58` reaches
1.64:1 and the house `#BF6F14` reaches 1.34:1. Only near-black clears it, at 5.7:1, and near-black is
not this hand. Whenever a label lands on something mid-toned, stop tuning the ink: the ground is the
only variable left.

**The lever for that is `labelPlate` — the label brings its own ground.** A spec-level opt-in that
draws a dark hand-edged chip behind every label and puts the lifted `#F6BA58` on it, giving the same
ink-on-ground pair a gutter label gets on the aubergine. `unsaved-changes` is the worked example: its
three labels went from 1.33:1 to **8.59:1** with no change to the figure's dimensions, its crop, or
its on-page type size — which is what makes a plate cheaper than either of the two remedies below.
Three things to know before using it:

- **The edge is hand-drawn on purpose.** A crisp rounded rect on a screenshot reads as a toast or a
  tooltip belonging to the *product*, and a figure must not invent UI. The Rough.js edge is what says
  "annotation". A crisp version was rendered and rejected on exactly this.
- **It covers capture pixels.** Unlike a highlighter band, which is punched out so the control shows
  through, a plate is opaque-ish and drawn on top. Put it over flat background, verify by pixel row
  which content it lands on, and expect to hand-place the row it sits in.
- **It is off by default and stays off.** No existing figure changed when it landed. It is the right
  answer for a label that must stay inside the frame, not a general upgrade.

**The two older remedies are still the right ones when they apply.** A gutter is better than a plate
whenever the label can leave the frame at all, because a label on the figure's own ground needs no
furniture; a backdrop is better whenever the figure has synthesized margin anyway. Reach for a plate
when both are ruled out — a contained figure whose labels are wanted in place.

**The gutter remedy, in full.** `service-mode-banners` had the same defect and it is
now the worked example of the cure: its inside-the-frame label moved out to a bottom gutter, where it
takes the same ground as the other one and measures 7.68:1 instead of 1.77:1. Relocating a label is
usually not free — that one cost a crop, because the leader coming up from the new gutter needed a
lane through the dashboard. Reach for it before concluding a figure cannot take a backdrop. The
deeper point is that a `labelIn` label on a dark-backdrop figure is a caption on the *application*
while its neighbours are captions on the *page*; the contrast number is the symptom. A plate makes
that label a caption on its own ground instead, which is the third answer and the one to weigh
against relocation now that it exists. Ink derived per label from the ground it lands on is still
nobody's work and is still the proper repair.

**On-page type size is `capture-font-size × column-width ÷ clip-width`,** and it does not depend on
the device scale factor at all. `main.css` gives figures `max-width: 100%; max-height: 60vh` and never
upscales, so a figure wider than the column is scaled down and the scale factor drops out, while a
figure narrower than the column renders at its own pixel width and the scale factor *is* the on-page
zoom. Two consequences drive most framing decisions in this set:

- **Cropping buys roughly 2.7× the on-page size of the same pixels.** A 2880px whole-window capture
  renders around 0.28 in the ~805px article column; a ~1070px crop of it renders around 0.75. That is
  the entire argument for cutting a detail out of `app-shell.png` rather than ringing it in place.
- **The 60vh cap binds on tall figures**, and a height-capped figure does not grow when the browser
  widens. `shell-left-navigation` and the portrait layout `run-themes` rejected are both governed by
  it.
- **A figure that already fits the column at 1:1 should spend every remaining pixel on the capture,
  not on the gutter.** Below the column the site does not scale, so the gutter is exactly the label's
  own width and no more. Widen past the column and holding the label size needs a proportionally
  wider gutter, which widens the figure again — the downscale eats what the extra capture bought.
  1:1 is the equilibrium. `shell-activity-rail` is the worked example: 440px of capture + a 336px
  gutter + 24 = 800, against a ~805px column.

**`fontScale` corrects label size in both directions.** Label type is sized off the **capture** width,
not the crop, so a crop of a 2880px capture needs it far below 1 and a ~400px detail clip needs it
above 1. The target is 15–18 CSS px against 16px body copy; every figure in the set lands there.

**Measure, don't eyeball.** Specs describe targets ("the second swatch inside the card", "the leftmost
ink in each entry block"); they do not contain coordinates. A hardcoded coordinate drifts silently —
the figure still renders, with every callout pointing at nothing. Exactly one target in the whole set
has no selector behind it; see Outstanding.

**The renderer's obstacle set is other labels, and nothing else.** `layout.mjs` builds `obstacles`
from the laid-out label rects, so a leader will cross a button, a chip or a line of text without a
word of warning — the *"could not avoid every element"* message only fires when a leader hits another
**label**. Two figures have been caught by this by looking at the PNG and nothing else:
`programmer-sockets`, whose leaders struck through two socket captions until its gutter moved, and
`teach-utilities`, whose crosshair leader ran through the X+ button until its label was shifted up to
thread the jog pad's empty corner cell. **Open every render and follow each leader.**

**Capital `Z` in the house hand reads as `2`.** The `marker-rings` face draws it with a curled top,
and at figure size *"the whole Z stroke"* publishes as *"the whole 2 stroke"*. There is no fix inside
the style. Where a label has to name the Z axis, put the word **axis** immediately after the letter
so the reader resolves it from context — `teach-utilities` is the worked example — or reword around
it. Worth checking before writing any label on *Teach*, where Z, Z2 and probe numbers all appear.

## Prerequisites for any re-shoot

1. **The React app's Vite dev server, with a mocked backend.** No .NET host — Playwright's `page.route`
   answers every `/api` call with payloads shaped to the DTOs in
   `src/psvsystem-app/src/api/types.ts`. Real components, fictional data. Convention is port **3000**;
   `run-themes` uses **3001** so a second server can run without colliding. `page.route` also aborts
   `/hubs/`, so nothing driven by SignalR arrives on its own.
2. **Playwright resolved through the app's own `node_modules`.** ESM resolution ignores `NODE_PATH`,
   so borrow the app's `createRequire`.
3. **Role gating.** Settings, User Authentication and the account menu all silently redirect to the
   dashboard unless the signed-in role is `Supervisor` or `Service`. The fictional user set is
   `aroberts` (Supervisor) and `mpatel` (Operator) — **and those are the only two**. Service has been
   removed from this help as a customer-facing role: it is an internal Data I/O super-user set that
   customers never see, so no figure may sign in as it or show a Service-only control. `mocks.mjs`
   still tests for it in `isAdmin` because the *application* still has the role; `USERS` deliberately
   cannot produce one.
8. **The programmer list has a viewport floor of 1280.** It is a nine-column PrimeReact DataTable
   with a natural width of 940 logical px, 254 of it a fixed-width Actions column, and it does not
   reflow. Below about 1250 the table overflows its card: the **IP Address** header wraps and
   **Remove** is sheared off, so the figure shows three row actions where the article names four.
   Narrower is otherwise always better for on-page type, which makes this the one screen where the
   usual instinct is wrong. `capture-programmers.mjs` asserts the table's right edge against the
   card's rather than trusting the number.
9. **`ALL_PERMISSIONS` in `mocks.mjs` is not the permission set this help documents.** It lists
   `ManageRoles`, `RunJob`, `TeachSystem`, `ViewDiagnostics` and `ViewLogs`; the five the articles
   document are `ManageSettings`, `ManageProgrammers`, `ManageUsers`, `Diagnose` and `Debug`. Two
   consequences: the Diagnostics nav row is missing from any whole-window capture (see Outstanding),
   and **any figure that would put a permission list on screen must not be shot against this mock** —
   fix the list first, or the figure contradicts the page it illustrates. None of the figures in the
   set does so today.
4. **The head-camera rail gotcha.** The rail panel opens itself whenever `GET /teach/camera-offset`
   reports `isApplied: true`, and without a backend it then renders a WebSocket error. Answer that
   endpoint with `isApplied: false`, or close the panel before capturing.
10. **Teach needs two things beyond its own endpoint.** `/system` must report `isHomed: true` or
    `HomedRoute` replaces the whole screen (which is what [`teach-not-homed`](references/figures/teach-not-homed.md)
    photographs on purpose). And **nothing on the Teach page fetches an initial gantry pose** — the
    Live readout is fed only by the SignalR `GantryPositionChanged` event, which `mocks.mjs` aborts,
    so the three Live rows sit at `—` and contradict the article. Seed `gantryStore.setPosition`
    through the app's own Vite module URL, the way `capture-shell-overlays.mjs` seeds `uiStore`, and
    assert on the rendered number rather than on the store write.
5. **Mock payloads must match what the component reads, which is not always the public DTO.** The
   Programmer Manager list keys on `name` via `ProgrammerDto` while the Run page keys on `identifier`
   via `ProgrammerStatusDto`; the Logs Source column comes from `SourceContext` inside `properties`.
6. **Whole-window figures at 1440×900, `deviceScaleFactor: 2`; detail clips at 1.5.** A whole-screen
   capture is scaled down to the column regardless, a clipped control is not — so a clip at 2 draws at
   twice the size of the body text around it.
7. **`palette: false` on any `png()` call that also passes `effort`.** In sharp, `effort` implies
   `palette: true`, which silently quantises to 256 colours. Verified: `effort` alone gives colortype
   3; `effort` with `palette: false` gives 6. This has already cost one re-shoot — see Outstanding.

**The five Run details and `run-themes` share one mocked run**, so they describe the same machine.
Job `AT25QL128A-Rev-C` on an Adesto device, quantity 5000, pass 3164, fail 22, lost 3 — yield 99.2%,
progress 63.8%. `/scheduler/state` must carry **both** `machineState` and `state`
(`runStore.fetchMachineState` reads one, the status bar reads the other). PGM-01 and PGM-02 with eight
sockets each, PGM-01 holding one unpopulated socket and one failure. A reject bin with both counts.
One 10×9 tray part-way through. And **`/saga/DeviceStateMachine` is not optional** — the generic mock
answers unknown `/api/` paths with a 200 `[]`, `PipelineSummary` reads `graph.states` off it, and the
Run page falls into the error boundary. Anyone capturing the Run screen hits this. Assert that
"Something went wrong" is absent before writing any Run figure.

## The figures

Twenty-nine annotated figures. Each page records what the figure shows, how to get back to something
close, why it is annotated the way it is — including which callouts were **rejected** — and its known
issues.

| Figure | Article § | What puts the app in that state |
|---|---|---|
| [`app-shell`](references/figures/app-shell.md) | Navigating the App — top | Supervisor on the dashboard, whole window, notifications panel open |
| [`shell-title-bar`](references/figures/shell-title-bar.md) | Navigating the App — Title bar | Crop of the `app-shell` source, right-hand controls |
| [`shell-left-navigation`](references/figures/shell-left-navigation.md) | Navigating the App — Left navigation | Crop of the `app-shell` source, the whole pane |
| [`shell-activity-rail`](references/figures/shell-activity-rail.md) | Navigating the App — Activity rail | Crop of the `app-shell` source, top of the rail and the open panel beside it |
| [`shell-status-bar`](references/figures/shell-status-bar.md) | Navigating the App — Status bar | Crop of the `app-shell` source, full-width strip |
| [`shell-notifications`](references/figures/shell-notifications.md) | Navigating the App — Notifications | Crop of the `app-shell` source, top of the panel |
| [`service-mode-banners`](references/figures/service-mode-banners.md) | Navigating the App — Banners and overlays | `/system/service-modes` with both flags on, 1040px viewport |
| [`system-blocker`](references/figures/system-blocker.md) | Navigating the App — Banners and overlays | `uiStore` seeded directly with a cover-acknowledge blocker |
| [`unsaved-changes`](references/figures/unsaved-changes.md) | Navigating the App — Unsaved changes | Dirty Settings form, then navigate away |
| [`run-themes`](references/figures/run-themes.md) | Navigating the App — Appearance | The mocked run in six themes, one page load |
| [`sign-in`](references/figures/sign-in.md) | Signing In — Sign in | Sign-in screen, both fields filled |
| [`account-menu`](references/figures/account-menu.md) | Signing In — The account menu | Supervisor, account menu open |
| [`account-menu-operator`](references/figures/account-menu-operator.md) | Signing In — The account menu | Operator, same menu — **one shoot with the above** |
| [`my-account`](references/figures/my-account.md) | Signing In — Changing your password | Operator on `/account` |
| [`my-account-password-rejected`](references/figures/my-account-password-rejected.md) | Signing In — Changing your password | …after a too-short password — **one shoot with the above** |
| [`run-job-bar`](references/figures/run-job-bar.md) | Run — The job bar | The mocked run, bar expanded, 1152px viewport |
| [`run-pipeline`](references/figures/run-pipeline.md) | Run — Pipeline | The mocked run with the real `SagaGraphProvider` payload, bar expanded, 920px viewport |
| [`run-statistics`](references/figures/run-statistics.md) | Run — Statistics | The mocked run, the Statistics tile clipped |
| [`run-programmer-card`](references/figures/run-programmer-card.md) | Run — Programmers | The mocked run, PGM-01 clipped |
| [`run-socket-states`](references/figures/run-socket-states.md) | Run — Reading the socket grid | The mocked run with one socket of every kind, four seeded into `runStore` |
| [`run-socket-menu`](references/figures/run-socket-menu.md) | Run — Socket status and actions | The mocked run, right-click menu raised during a live run |
| [`programmer-manager`](references/figures/programmer-manager.md) | Programmers — top | Four mocked programmers, nothing selected, 1280px viewport |
| [`programmer-row-actions`](references/figures/programmer-row-actions.md) | Programmers — Row actions | Crop of the `programmer-manager` state, right-hand columns |
| [`programmer-add`](references/figures/programmer-add.md) | Programmers — Adding a programmer | The Add dialog with an existing programmer's name and IP typed in |
| [`programmer-sockets`](references/figures/programmer-sockets.md) | Programmers — Sockets and adapters | PGM-03's detail flyout, the Sockets section |
| [`teach-not-homed`](references/figures/teach-not-homed.md) | Teach — the note above the overview | `/system` answering `isHomed: false`, then `/#/teach` |
| [`teach-component-picker`](references/figures/teach-component-picker.md) | Teach — Pick a component | The seven-entry roster, dropdown open, nothing selected |
| [`teach-utilities`](references/figures/teach-utilities.md) | Teach — The Utilities column | PGM-03 under teach, wizard on step 8 (the probe-2 location) |
| [`teach-step-wizard`](references/figures/teach-step-wizard.md) | Teach — The step wizard | The same state, the dot band — **one shoot with the above** |

`run-overview.png` also ships, in *Run* — top, but it is not in the spec chain and has no page here.
See Outstanding. `teach-overview.png` likewise ships in *Teach* — top, predates the skill, and has no
page; the four Teach figures were shot around it rather than replacing it, and the seam is recorded
under Outstanding.

**Teach has no Head camera figure, and the omission is a decision.** The section is the one a figure
would help most — the panel's controls are unlabelled and **Save crosshair offset** is absent for
every account a customer can create — and it cannot be shot honestly. `CameraView` draws its
crosshair overlay only when `crosshairOn && frameUrl`, and `frameUrl` arrives solely over the
`/ws/camera` WebSocket, which no mock answers; the panel's only truthful state without hardware is a
black rectangle reading *Camera unavailable*. Supplying a fabricated frame would put an invented
photograph of hardware in the manual, which is the failure the skill's one rule exists to prevent.
Two things worth carrying forward: the panel also has a **Camera settings** disclosure that the
article does not mention at all, and `isService` gates the offset button on a role this help
deliberately cannot sign in as.

**Programmers has no Properties figure, and the omission is a decision rather than an oversight.**
The detail flyout's properties grid is nine labelled values and the article enumerates all nine in
the sentence above it, so a ring on any of them repeats a caption; the section's real subject —
what changes when you press **Edit** — is a state transition a still cannot show. The flyout is
therefore represented on the page only by its Sockets section, which is where the picture beats the
prose. Recorded here so the gap is not filled by reflex.

## Adding a figure

1. Drive the real component through the real code path and **assert the state you are photographing
   actually happened**. Use whatever throwaway script you like; write the capture into
   `figures/sources/`, then throw the script away.
2. Write `figures/<name>.json`. Record *why* in `_`-prefixed keys as you go — they are ignored by the
   tool and are the raw material for step 7.
3. Render, then **look at the PNG**. Open it. Zoom into anything you are unsure about. Every defect in
   this project's figure history was found by looking and missed by not looking.
4. Add a case to `test/golden.test.mjs`, run `--update`, then run plain and confirm 0px.
5. Reference it from the article with the `figures` syntax (`^^^` … `^^^ Caption.`).
6. `cd docs/help && dotnet docfx docfx.json` — 0 warnings.
7. **Write `references/figures/<name>.md` and add a row to the table above.** This is the step that
   ships: the spec and the source will not survive the branch, and a figure nobody can get back to is
   a figure nobody can correct. Carry the reasons across, not the coordinates.

## Outstanding

- **`run-themes` source is 256-colour quantised.** `sharp`'s `png({ effort })` implies
  `palette: true`; the capture now passes `palette: false`, but **the source has not been re-shot**,
  so truecolour output faithfully reproduces already-damaged pixels — and a shared palette across six
  panels can merge colours that differ *between* themes, which is the one difference the figure
  exists to show. Re-shoot needed.
- **`run-overview` needs a re-shoot and is not in the spec chain.** Its UI text renders at 6.7 CSS px,
  so it cannot usefully be annotated. A replacement must be shot with the permission `Diagnose` in the
  mock — `DashboardPage.tsx` gates the Diagnostics nav row on it, and `mocks.mjs` currently lists
  `ViewDiagnostics` instead, so a naive re-shoot silently drops a nav row the help site documents —
  *and* with `/saga/DeviceStateMachine` populated, or the PIPELINE bar renders empty and contradicts
  prose calling it "a compact summary". **Re-shoot it together with `run-themes`** so the two stay
  calibrated.
- **Shared-mock defect across `run-overview`, `run-themes` and `run-statistics`.** DPH shows `—` and
  Elapsed `00:00:00` on a job showing 3164 passes, because `elapsedSeconds` only ever arrives via
  SignalR. The three figures at least agree with each other, so fixing it means re-shooting all three
  together.
- **Window buttons cannot be photographed at all.** `TopBar.tsx` guards them with `{isElectron && …}`
  and every figure here is a browser capture. Permanent without a packaged Electron build — and it
  means `app-shell.png` is missing chrome that customers always see.
- **The status bar's centre target is arithmetic, not detection.** Empty space has nothing to detect,
  so the middle third was derived from `StatusBar.tsx` (`px-3` plus three `flex-1` → `(2880−48)/3`)
  and confirmed against measured ink ending at 2856. **It is the only target in the whole set without
  a selector behind it.** It will not survive a layout change and nothing will flag that.
- **Label type is sized against a 689px article column that no longer exists.** Every spec written
  before the *Navigating the App* pass states its label size in CSS px derived from a 689px column;
  `main.css` says the column is **807** and the recent pages use ~805. Nothing is broken by it, but
  the labels on the older figures publish larger than the 15–18 band above claims — `my-account` at
  ~20.9 and `my-account-password-rejected` at ~29.9 are the two worst, and they sit four paragraphs
  apart in the same section at visibly different sizes. The backdrop conversion deliberately carried
  the existing sizes across rather than quietly fixing them, so the two questions stay separable.
  **Re-derive `fontScale` across the whole set against the current column as one pass**, pairs
  together, and re-check each figure's on-page size afterwards.
- **`page-programmers.md` contradicts the product in four places, found while shooting its figures.**
  None is annotated, because a figure must not carry a correction to the prose beside it, and the
  article was left alone so the content owner decides. (1) *"Every column sorts"* — **Firmware** and
  **Adapters** carry no sort control; the other six do. (2) Step 6 of *Adding a programmer* says
  *Save*; the button is **Add**. (3) Step 3 reads as though a **Name** is required, but `canSave`
  never checks for one, so a programmer can be added nameless. (4) The article writes *FlashCORE*
  where the UI prints `FlashCore`, which is `ProgrammerTypes.ToString()`. Two of the four are visible
  in `programmer-manager.png` and one in `programmer-add.png`, so fixing the prose is the cheaper
  half of keeping the page consistent with its own pictures. The *Sockets* bullets also omit the
  `N pass · M fail` lifetime tally that every wear row prints.
- **`programmer-manager.png` publishes its table rows at 9.9 CSS px and nothing in this pipeline can
  fix it.** 1004 logical px of nine-column table against an 807px column, and cropping columns off is
  not available to a figure whose job is to show the columns. It is treated as an orientation figure
  and the sections that need readable type take their own crops. The only remaining lever is the
  product.
- **A wrapped `^^^` caption silently loses everything after its first line.** The Markdig figures
  extension reads the caption from the `^^^ ` line only; a continuation line becomes a separate
  `<p>` **outside** the `<figure>`, so it publishes as a stray sentence under the caption in a
  different type. docfx reports nothing. **Four captions in `page-programmers.md` are broken this
  way today** — `programmer-manager`, `programmer-row-actions`, `programmer-add` and
  `programmer-sockets` all lose their second sentence out of the caption. Left for the content owner
  because it is prose in another article; the fix is to join each caption onto one line, which is
  what every caption on `page-teach.md` and `page-run.md` already does.
- **`teach-overview.png` predates the skill, has no page, and now disagrees with its neighbours.**
  It is a 2880×1800 whole-window capture that publishes at scale 0.28, so its UI type lands around
  7.8 CSS px — the `app-shell` class of un-annotatable. It was also shot against a different mocked
  machine: `Input Tray 1 · 4 positions`, five steps titled *"Move to the first corner position"* and
  a `STATIC TRAY` chip, none of which any build of the product emits — `Tray.cs` ships eight steps
  over two locations with titles *Row/column setup*, *Move to top-left corner*, *Z-axis teach*,
  *XY-axis teach*, *Save*, *Move to bottom-right corner*, *XY diagonal*, *Save*. The four new Teach
  figures were shot around it rather than over it, on PGM-03 with `LumenXProgrammer`'s real ten
  steps, so nothing in the set now contradicts the product; but the overview and the picker do show
  the same dropdown entry with counts from two different mocks. **Re-shoot the overview against
  `capture-teach.mjs`'s roster** if the set is ever revisited.
- **`page-teach.md` contradicts the product in three places, found while shooting its figures.**
  None is annotated, because a figure must not carry a correction to the prose beside it. (1) *"the
  Z readout and Z jog follow whichever probe is active — the axis label changes to Z2"* — the **Far
  probe selector** reports the site's far-corner probe (`locations[2].probe`) while the axis label
  follows the **active step's** location (`stepTaughtLocation.probe`), so the two legitimately
  disagree on Socket 1 with Far probe set to 2. (2) *"**Live** — where the head is right now,
  updating continuously"* — the Live rows read `—` until the first SignalR `GantryPositionChanged`,
  because nothing on the page fetches an initial pose the way the Gantry diagnostics panes do.
  (3) *"Green with a check — completed"* — `handleNext` marks a step complete unconditionally, so a
  check records a button press rather than a capture; this one **is** annotated, because the ring
  adds to the bullet rather than contradicting it. Two further items are product oddities rather
  than prose errors: a programmer's count column reads `3 sockets` for an eight-socket LumenX
  because `MapProgrammer` counts teachable locations, and the **Taught** block keeps its axis
  labelled `Z` on a probe-2 location where **Live** says `Z2`.
- **`docs/help` runs no image-optimisation pass, and the backdrops made it more pressing.** The four
  figures converted in the first pass grew from 461 KB to 785 KB between them — a gradient does not
  compress like flat white, and `shell-status-bar` alone went 195 → 316 KB. The two converted after it
  added another 78 KB: `service-mode-banners` 123 → 166 KB and `shell-activity-rail` 22 → 58 KB, the
  latter because the re-frame also gave it 2.2× the pixels. **The *Signing In* and *Run* batch added
  380 KB more** — the four account figures 317 → 538 KB and the five Run details 215 → 374 KB — so the
  gradient has now cost roughly 780 KB across eighteen figures that ship in a PDF.
  `.claude/tools/optimize-images/` is the lever if PDF size becomes a problem. `run-job-bar.png` at
  148 KB for 1394×368 is still the fattest per pixel, and got fatter. The four *Programmers* figures
  added another 442 KB on top of that, of which about 137 KB is gradient: the figure they replace was
  305 KB of flat-white whole window, so the section is net +137 KB for four figures instead of one.
  The four *Teach* figures are **320 KB net new** — nothing was replaced, so the article went from
  248 KB to 568 KB.
