# run-themes.png

`docs/help/images/getting-started/run-themes.png` · 4831×2523 · 742 KB ·
*Navigating the Application* → Appearance.

## What it shows

The Run screen in all six themes as a labelled 3×2 contact sheet, on the aubergine backdrop. No
callouts.

## Getting back to something close

1. Mock a run matching `run-overview.png` — same job, counts and yield, so the two figures agree —
   plus one failed socket on PGM-01, so a pass square and a fail square sit side by side inside one
   programmer card. See the index for the shared mocked run.
2. **Also mock `/saga/DeviceStateMachine`.** The generic mock answers unknown `/api/` paths with a
   200 `[]`, `PipelineSummary` reads `graph.states` off it, and the Run page falls into the error
   boundary. Anyone capturing the Run screen hits this.
3. **On a single page load**, import the app's own `themeStore` module and call `setTheme` for each of
   light, dark, high-contrast, protanopia, deuteranopia and tritanopia, capturing 1440×900 at
   `deviceScaleFactor: 2` after each. One load matters: the DOM, the data and the layout stay the same
   objects and only `data-theme` on `<html>` changes.
4. Downsample each capture 2:1 to native app pixels, composite 3×2 with a label band per panel on a
   slate mat, and encode with **`palette: false`**.

**Verify the six are identical apart from palette.** Fingerprint every element in `body *` — tag,
bounding rect to two decimal places, own text — and refuse to write if they diverge. This caught a
real difference on the first run: the title-bar theme glyph, which *is* the theme rendering itself,
and is the one node normalised out. Nothing else should be exempt.

**Why the Run screen:** it is the only screen carrying the pass/fail semantics the Appearance section
is about. An idle screen renders as six near-identical greys and the figure would say nothing.

**3×2, not 2×3.** `main.css` caps a figure at `max-height: 60vh` alongside `max-width: 100%`, so a
portrait sheet is height-capped and renders at the same 580 CSS px at *every* viewport from 1280 to
2560 — widening the browser does nothing for it. The landscape sheet clears the cap and grows with the
column. It also groups correctly: top row the three general themes, bottom row the three colour-vision
themes, which is the split the paragraph above the figure describes.

## Why it is annotated the way it is

**No callouts, on purpose.** The content of this figure *is* the colour difference between panels, and
the reading task is to compare the same region across six of them. A ring can only enclose one, so
drawing one would say the opposite of what the figure is for. The panels are already captioned by the
capture with the exact theme names the article's table prints, and the article's caption names the
three places to look.

`marker-rings` is recorded in the spec anyway, so that if a callout is ever added it arrives in the
house hand rather than whichever preset the next author reaches for. The golden still earns its place
even with nothing drawn: the source is itself a composite of six captures, so it guards that the
backdrop pass lands the sheet at native pixels — a resample would smear 4.7 megapixels of UI type.

**The mat stays slate, not a purple.** The obvious move when a figure goes onto the aubergine is to
retint its ground to match, and here that would be wrong: the mat is the only thing touching all six
panels, and a purple one would put a simultaneous-contrast bias on the six palettes the reader is
being asked to compare. The backdrop sits ~200px from the nearest panel and does not. Panel labels are
white on the mat, never on the gradient, so their contrast is unaffected.

**`cornerRadius` stays 0, unlike the other two backdropped figures.** `app-shell.png` and
`system-blocker.png` round to 26 for fidelity — they photograph the application window and the real
window has rounded corners. There is no window here, only a mat holding six square-cornered prints,
each already outlined with a hard rule by the capture. Rounding the mat would round the one edge in
the figure that nothing in the product corresponds to.

**The backdrop padding is not free**, and if it is ever raised, re-measure first. It takes the sheet's
aspect from 2.09 to 1.92, which narrows the margin on the 60vh cap without closing it, and — the cost
actually paid at every viewport — it shrinks the sheet to about 92% of the figure's width, so each
panel renders about 8% smaller in the widest column. Both effects scale linearly with the padding.

**One sheet, not six figures — measured.** Six whole-window PNGs at this scale are ~200 KB each, so
~1.18 MB added to a 4.3 MB image tree for one short section. The sheet as published is 742 KB, of
which only ~170 KB is the backdrop; the rest is the encoder no longer quantising.

## Known issues

- **The source sheet is 256-colour quantised and needs a re-shoot.** It was encoded with
  `png({ compressionLevel: 9, effort: 10 })`, and in sharp **`effort` implies `palette: true`**. That
  is how six screenshots fitted in under 300 KB. The published PNG is truecolour now and the capture
  passes `palette: false`, but the *source* has not been re-shot, so the published figure faithfully
  reproduces pixels that already went through a 256-colour bottleneck — and a shared palette across
  all six panels can merge colours that differ *between* themes, which is the one difference this
  figure exists to show. **Outstanding.**
- **Re-shoot it together with `run-overview.png`**, which is also outstanding. The two were calibrated
  against each other and the neighbouring article depends on them agreeing.
- **DPH reads `—` and Elapsed `00:00:00` in every panel**, an artefact of the shared mocked run.
  See [`run-statistics.md`](run-statistics.md).
- **`--status-pass` / `--status-fail` are not used by the Run page.** Its pass/fail colour comes from
  `--success` / `--danger` plus hardcoded hexes in `DeviceSlot`'s variant table and in
  `statusColor('Pass')`. So in the figure the *fail* side retunes across all six themes while the
  tray/socket *pass* green stays identical. The article's claim still holds, but those hardcoded
  greens are why the pass tile does not move.
