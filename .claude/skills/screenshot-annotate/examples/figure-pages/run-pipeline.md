# run-pipeline

**Article §** *Run* — Pipeline.
**Published** `docs/help/images/run/run-pipeline.png`, 1022×605.
**Source** `figures/sources/run-pipeline.png`, 966×380 — a 644×253 CSS px clip at
`deviceScaleFactor: 1.5`.

The Run screen's **Pipeline** bar, expanded: the header row with its `INPUT ▸ PROGRAMMER ▸ OUTPUT`
chips, and under it the five-station graph — Start, Input, Programmer, and the fork to Output and
Reject.

## Getting back to it

The shared mocked run every Run figure uses (job `AT25QL128A-Rev-C`, 3164 pass / 22 fail / 3 lost,
PGM-01 and PGM-02, the 10×9 tray, the reject bin, `machineState: Running`) — see the prerequisites
in [FIGURES.md](../../FIGURES.md). Then:

1. **`/saga/DeviceStateMachine` is not optional and must be the real payload.** The generic mock
   answers unknown `/api/` paths with a 200 `[]`, `PipelineSummary` reads `graph.states` off it, and
   the whole Run page falls into the error boundary — assert *"Something went wrong"* is absent
   before writing anything. Transcribe the graph field-for-field from
   `SagaGraphProvider.BuildDeviceStateMachineGraph()` in
   `src/DataIO.PSVSystem.Api/Services/SagaGraphProvider.cs`: five states (`start` 0,200 · `input`
   300,200 · `programmer` 680,200 · `output` 1100,100 · `reject` 1100,320) and four transitions
   (`t1` start→input `out`, `t2` input→programmer `pass`, `t5` programmer→output `pass` guard Pass,
   `t6` programmer→reject `fail` guard Fail). **Do not reuse the ad-hoc graph in
   `capture-run-themes.mjs`** — its `input-1`/`programmer-1` ids produce identical chips, because
   `getNodeType` strips the `-<digit>` suffix, but its node coordinates are invented and this
   figure's subject is the drawn graph.
2. **Viewport 920×900, `deviceScaleFactor: 1.5`.** Not 1440. See *Why 920* below; it is a floor, and
   the capture script asserts it rather than trusting it.
3. Expand the bar by clicking its header — `CollapsibleBar` opens with `defaultOpen = false`, so it
   is collapsed on load.
4. Clip the `CollapsibleBar` element's own border box. No pad.

## Why expanded, and why one figure rather than two

`CollapsibleBar` always renders its header; `open` only appends the graph panel underneath. The
expanded capture therefore **contains** the collapsed state pixel-for-pixel, and a second figure of
the collapsed bar would be a crop of this one with nothing added. Same question and same resolution
as `run-job-bar` one section up the same page, whose caption is the model for this one's.

The one thing a separate collapsed crop buys is size: clipped to ~500px it publishes its chips at
13.5 CSS px against 10.7 here. That is not worth a figure showing a strict subset of another.

## Why 920

The bar is as wide as the content area, and on-page type is `capture-font-size × column ÷
figure-width`, so every pixel of bar width comes out of the 9px chips. Measured: the chips publish
at **6.2** CSS px from a 1440 viewport, **8.3** from 1152, **10.7** from 920.

It cannot go lower. `PipelineOverview` fixes the graph canvas at 200px tall, so ReactFlow's
`fitView` is height-bound at zoom 0.5417 and then clamps at its own `minZoom` of 0.5 — below that
the graph stops shrinking to fit and starts being **clipped**. At zoom 0.5 it is 587 CSS px of ink
in a 618px canvas, 16px of slack a side; at an 880 viewport the canvas is 578 and Start and Reject
shear off.

## The column is fluid, and 807 is the 1440-viewport figure

Measured in the built page, not assumed. The article column is not a constant:

| Viewport | Column / rendered figure | Chips | Node captions |
|---|---|---|---|
| 1280 | 689 | 9.1 | 6.1 |
| 1440 | **807** | **10.7** | **7.1** |
| 1600 | 911 | 12.0 | 8.0 |
| 1728 and up | 1024 (capped) — figure at **native 1022** | 13.5 | 9.0 |

So the 807 every spec calibrates against is the column at a 1440px viewport. Two consequences for
this figure: it is never upscaled (1022 is 2px under the site's maximum column, which is a happy
accident worth preserving if it is ever re-framed), and `max-height: 60vh` binds only on a short
window — 1920×700 scales it to 708px and the chips to 9.4. At the standard width/height pairs a
viewport narrow enough to matter is width-bound first.

## The graph cannot be published legibly, and that is the product

Worth writing down before someone tries to fix it. The node captions are 12px CSS at zoom 0.5 =
**6.0 CSS px in the application itself**, and the graph needs 587 CSS px of clip to appear whole, so
the ceiling is `6.0 × 807 ÷ 587` = **8.2 CSS px** even with the bar cropped away entirely — 7.1 with
the bar kept. Cropping does not help, because the informative unit is the whole route. A larger
`deviceScaleFactor` does not help, because the figure already publishes wider than the column and
the scale factor drops out of the arithmetic.

What the figure carries at this size is the **shape** — five stations, one fork, the pass branch in
citrus and the fail branch in red — plus chips at 10.7 and the `PIPELINE` label at 13.0. Same class
of limit as `programmer-manager`'s 9.9px table rows: the only remaining lever is the product.

## Callouts

Two, and neither names a part.

| Ring | Label | Why it earns its place |
|---|---|---|
| The Programmer station | *One station, however many programmers* | There is one Programmer box on a screen that has just shown two programmer cards, and nothing says the graph is one device's route rather than a picture of the machine. The backend's own description of this graph is "the lifecycle of a single device". |
| The Reject station | *Reject is not on the compact summary* | `buildSummaryNodes` walks only the `pass` and `out` handles out of the start node, so the reject station is structurally unreachable by the collapsed summary and appears only when the bar is expanded. Nothing on screen accounts for three chips against five boxes — and it is the direct answer to why anyone would expand the bar. |

### Rejected

- **The disclosure triangle.** `run-job-bar` already rings the identical control one section up the
  same page with *"Click the bar for the full job record"*. A second crop making the same point is
  the third telling of it.
- **The Start node**, which is also summary-only. It is a graph artefact rather than a station a
  device is held at, and ringing it would dilute the reject callout that shares its fact.
- **The Output station.** A ring there says only what the picture says.
- **"Neither the chips nor the graph carry any live data."** The one a reader would benefit from
  most, and it cannot be shipped: the sentence beside the figure says the opposite. See *Contradicts
  the article* below. A figure must not carry a correction to the prose next to it — the same call
  `page-programmers`' four contradictions got.

## Targets

Measured, no coordinates.

- **Programmer** — the second of exactly two 44×44 `#F1F4F8` swatches, left to right. Only Input and
  Programmer are `sagaProcess` nodes with a neutral `var(--border)` box; Start, Output and Reject
  carry coloured borders whose interiors fall under the detector's fill threshold, so they never
  enter that list. *Give any of them a neutral border and this index walks.*
- **Reject** — `#AA1205` is `--danger` and the only red in the figure. The 30–80px size window is
  what tells the 47×48 node box from the 246×86 edge curve feeding it and the 19×18 glyph inside it.

## Layout

One label per gutter, top and bottom, no side gutter — the `run-programmer-card` arrangement, and
for the same reason: a horizontal gutter comes out of the chips, a vertical one only makes the
figure taller.

The top label is shifted **right** of its target rather than sitting over it. Dead centre gives a
300px vertical leader that reads as a plumb line; shifting **left** instead swings the arc through
the `OUTPUT` chip. Right is the only direction with an empty quadrant in it.

`backdropPadding` is 28 rather than the 43 the 4.5% default would give: both label margins are
derived and far larger than either number, so the floor only ever decides the side gutter. At the
default the figure publishes 1052 wide and the chips drop to 10.3; at 28 it publishes 1022 and they
hold 10.7. 28 renders as ~22 CSS px of gradient beside the bar — what `run-job-bar`'s hand-sized 40
publishes as, and enough for the window to float.

`fontScale` 0.816 puts the labels at 16.5 CSS px on the page against 16px body copy. Re-derive as
`old × oldWidth ÷ newWidth` if `backdropPadding` ever moves.

## Backdrop

Aubergine. Both labels are in synthesized margin outside the bar, so the rule applies — but the
inside-the-frame alternative was rejected on measurement, not reflex. The expanded panel is 926×299
of flat `#FFFFFF` with a thin graph across it, so there is more open space inside this frame than in
any other Run figure and `labelIn` would have been easy. Two things stop it: it is the app's own
bordered panel, so a label drawn in it reads as something the *product* printed — the failure
`run-programmer-card` records — and a dark backdrop lifts every label to `#F6BA58`, which measures
**1.74:1** on that white. On the gradient the two labels measure **7.97:1** and **7.38:1**.

`sign-in` is the figure this one most resembles and correctly stays on white; the difference is that
its labels land on the sign-in route's *page* ground, not inside a product panel.

## Known issues

- **The node captions publish at 7.1 CSS px and the PASS/FAIL connector labels at 4.4.** Product
  ceiling, argued above. A reader identifies Start/Input/Programmer/Output/Reject from the icons,
  the colours and the two callout labels, not from the captions.
- **Both rings clip the 7px caption under their node.** Ring padding is `9–14 ÷ 1920 × canvasWidth`
  ≈ 5–7px here, and there is no per-callout override. The captions are decorative at this size.
- **`max-height: 60vh` binds on a short, wide window.** 1920×700 renders the figure at 708px and
  the chips at 9.4 CSS px. Not reachable at any standard width/height pair — see the table above.
- **`run-overview.png`, three sections up the same page, shows this bar collapsed and *empty*** —
  no chips at all, because it was shot without `/saga/DeviceStateMachine` mocked. The two figures
  on one page now disagree about whether the collapsed bar carries a summary. Already recorded
  under Outstanding in [FIGURES.md](../../FIGURES.md) as part of that figure's re-shoot; this
  figure makes it visible rather than causing it.
- **Contradicts the article, in three places — none of them annotated.** (1) The prose says *"Use it
  to see where devices are being held up"*; the bar carries no runtime data at all. Both
  `PipelineSummary` and `PipelineOverview` call `usePipelineGraph`, which fetches
  `/saga/DeviceStateMachine` once on mount with no polling and no SignalR, and `SagaGraphProvider` is
  a hand-authored static graph on the backend. Nothing on the bar reflects device positions,
  occupancy or dwell. (2) The prose lists **inspection** as one of the stations on the route;
  `DeviceSagaConstants` defines an `INSPECTION` id but `BuildDeviceStateMachineGraph` never emits
  it, so no build of the product draws that station. (3) The prose implies the collapsed summary
  shows the whole route including reject; it shows the pass path only. Reported rather than fixed,
  so the content owner decides.
