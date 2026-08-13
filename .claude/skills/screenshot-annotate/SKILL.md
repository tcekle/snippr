---
name: screenshot-annotate
description: Annotate UI screenshots for help docs with callouts, arrows, numbered steps, rings, highlighter bands and gradient backdrops. Use whenever the user mentions annotating a screenshot, adding callouts or arrows to an image, marking up a figure, producing a figure for the manual, or hands over a screenshot together with a doc page. Also use when a help article needs a figure that points at specific controls.
allowed-tools: Bash(node *) Bash(npm *) Read Write Edit Glob Grep
---

# Screenshot Annotate

Composites numbered callouts, arrows, rings and labels onto **real** screenshots of an application.
Node + sharp + Rough.js + resvg. Deterministic: same spec in, same bytes out.

**Before making a figure, read [DOCTRINE.md](DOCTRINE.md).** `SKILL.md` tells you which keys exist;
DOCTRINE tells you which figure to make — when a callout earns its place, when a backdrop applies,
why a label that renders fine can still be illegible, and how a crop changes the figure's size on the
page. It is the accumulated result of twenty-nine real figures and it is the part that is hard to
re-derive. Worked examples of individual figures are in
[`examples/figure-pages/`](examples/figure-pages/).

## The one rule that matters

**A documentation figure is the real capture with annotations composited on top. Never a
regenerated approximation.** Any tool that cannot take the actual PNG as input is
disqualified for this job — that is why this skill exists rather than a hosted design
service. (A Canva route was tried and abandoned: its connector can only ingest images
from a public HTTPS URL, so it could only produce a *lookalike* login screen with arrows
pointing at fabricated pixels. In a manual that is actively harmful, because the figure
stops matching the product.)

The corollary rule: **measure, don't eyeball.** Specs describe targets ("the second
`#E2E8F0` swatch inside the card"); they never contain coordinates. Screenshots get
re-taken at different window sizes, and hardcoded coordinates drift silently — the figure
still renders, with every callout pointing at nothing.

## Setup

```bash
cd .claude/skills/screenshot-annotate
npm install
node test/font-path.test.mjs      # prove resvg loads the vendored TTFs
```

`node_modules/`, `out/` and the figure working set are gitignored; `assets/fonts/*.ttf` are committed
on purpose (see `assets/fonts/README.md` — `@fontsource` ships only woff2, which resvg cannot load).

Prove the whole pipeline before pointing it at your own screenshots:

```bash
node scripts/annotate.mjs example/demo.json     # writes out/demo.png
```

## Where things live in YOUR project

Nothing under `scripts/` knows about any repository. Every path a figure touches is stated in the
spec, relative to the spec file, and there are only two of them:

| Spec key | Points at | Suggested convention |
|---|---|---|
| `source` | the raw capture to annotate | `figures/sources/<name>.png` — **never** the published figure, or the next render annotates its own output and you get rings on top of rings |
| `output` | where the finished figure is written | your docs' image directory, e.g. `../../../docs/images/<section>/<name>.png` |

Create `figures/` yourself for your working set. `out/` is scratch for experiments.

## Making a figure

### 1. Look at what the detector can see

```bash
node scripts/measure.mjs example/sample-app.png
node scripts/measure.mjs path/to/your-capture.png
```

Prints the background colour, every detected divider rule, and every uniform-colour
region with its fill, size and position. This is the vocabulary your spec gets to use.

`measure.mjs --verify <fixture>` checks the detector against hand-measured reference captures. The
two fixtures that ship (`app-shell`, `sign-in`) are measured from PSV captures that are **not** in
this bundle, so `--verify` is not usable until you add a fixture of your own in `scripts/measure.mjs`.
It is a detector self-test, not part of making a figure.

### 2. Write a spec

A spec is JSON. Start from [`example/demo.json`](example/demo.json), which is commented throughout in
`_`-prefixed keys the tool ignores. Read the page for a figure that resembles yours in
[`examples/figure-pages/`](examples/figure-pages/) before writing one; `unsaved-changes`,
`run-job-bar` and `run-socket-states` carry the most.

```json
{
  "source": "sources/sign-in.png",
  "output": "../../../docs/images/getting-started/sign-in.png",
  "style": "marker-rings",
  "crop": "auto",
  "cropInclude": { "swatch": { "fill": "#FFFFFF", "minWidth": 600, "order": "area-desc", "index": 0 } },
  "callouts": [
    {
      "number": 1,
      "label": "Type your username",
      "side": "left",
      "target": { "swatch": { "within": { "...": "the card" }, "minWidth": 600, "order": "top-to-bottom", "index": 0 } }
    }
  ]
}
```

**Top-level keys**

| Key | Meaning |
|---|---|
| `source` | Screenshot to annotate, relative to the spec file |
| `output` | Where to write the figure, relative to the spec file |
| `style` | `marker-rings` unless you have deliberately chosen another — see Styles below |
| `backdrop` | Optional gradient backdrop. Set it when annotation content sits in margin **outside** the app window; leave it off when every annotation is contained within the captured view. See the backdrop doctrine in [DOCTRINE.md](DOCTRINE.md) |
| `labelPlate` | Off by default. `true` draws a dark hand-edged chip behind **every** label and puts the lifted amber on it. Set it when labels land on pixels that cannot carry the ink — see the plate doctrine in [DOCTRINE.md](DOCTRINE.md). An object tunes it: `{ "padX": 0.5, "padY": 0.34, "fill": "#141821", "opacity": 0.82, "ink": "#F6BA58", "radius": px, "hand": true }`, paddings being fractions of the label's own type size |
| `crop` | `"auto"` (default), `"none"`, or `[x, y, w, h]` |
| `cropInclude` | A target that must survive the crop — usually the card or panel containing everything |
| `cornerRadius` | Rounds the screenshot's corners. **Defaults to 0**: rounding clips real pixels, which the correctness rule forbids by default |
| `margin` | Force margins instead of deriving them |
| `backdropPadding` | How much backdrop shows around the window. Defaults to 4.5% of width when a backdrop is set |
| `fontScale` | Multiplies label type. Needed because label size is derived from the **capture** width, not the crop |
| `maxLabelWidth` | Label wrap width as a fraction of the figure. Default 0.28 |
| `seed` | Overrides the style's Rough.js seed |

**Callout keys**

| Key | Meaning |
|---|---|
| `label` | The text. Comes from the prose |
| `number` | Omit entirely for an unnumbered callout |
| `target` | What it points at (below) |
| `labelIn` | Put the label in **open space inside the frame** rather than beside the target — usually an `empty` selector. This is what gives a long swept leader instead of a stub against the frame edge |
| `margin` | `true` forces the label out into the figure's gutter even when its target does not touch the frame |
| `side` | `left`/`right`/`top`/`bottom`; otherwise chosen from available space |
| `labelShift` | `[dx, dy]` as a fraction of the figure, to slide a label along its panel and give the arc room |
| `labelBias` | 0 = centre of the open space, 1 = as close to the target as it fits. Default 0.35 |
| `aimSlide` | How far the arrow slides along a big panel's edge from the nearest point. Default 1.2; 0 aims at the nearest point |
| `leader: false` | Suppress the arrow |
| `labelPlate` | Overrides the spec-level setting for this callout alone — `false` to opt one label out, or an object to give it different padding or a different wash |
| `maxLines` | Label wrap limit. Default 2 |

### 3. Target selectors

Five kinds. They compose — `within` takes another selector.

```jsonc
// A uniform-colour region: input field, button, card, panel.
{ "swatch": { "fill": "#E2E8F0", "tolerance": 18, "minWidth": 600,
              "within": { /* selector */ }, "order": "top-to-bottom", "index": 0 } }

// An icon or glyph drawn ON a control — a swatch detector cannot see these.
{ "ink": { "within": { /* selector */ }, "pick": "rightmost" } }

// A region bounded by detected rules and/or the frame. For things with no fill of
// their own: the title bar, the left nav, a status bar.
{ "panel": { "top": "edge", "bottom": { "border": { "axis": "horizontal", "index": 0 } },
             "left": "edge", "right": "edge" } }

// Open space with nothing drawn in it. Use with `labelIn` to place a label inside
// the frame. Largest-first, or `nearest` to another element.
{ "empty": { "index": 0, "minWidth": 300, "minHeight": 200 } }

// The bounding box of several targets — "both password fields", "these two rows".
{ "union": [ { /* selector */ }, { /* selector */ } ] }

// Escape hatch. Avoid — this is the drift the selectors exist to prevent.
{ "rect": [1102, 918, 675, 93] }
```

`order`: `top-to-bottom`, `left-to-right`, `area-desc` (default), `area-asc`.
`pick`: `leftmost`, `rightmost`, `largest`, `index`.

**`within` excludes the container itself.** "Within the card" means the things inside it,
not the card as well. Getting this wrong shifts every index by one and produces a figure
where every ring is around the wrong control, with nothing in the output to announce it.

### 4. Render and look at it

```bash
node scripts/annotate.mjs figures/<your-figure>.json
node scripts/annotate.mjs figures/<your-figure>.json --style plain-ink --out out/try.png
node scripts/annotate.mjs figures/<your-figure>.json --backdrop aubergine --out out/try.png
node scripts/annotate.mjs figures/<your-figure>.json --contact-sheet --out out/sheet   # all nine
```

**Always open the result with the Read tool.** A spec that resolves cleanly can still
produce a wrong figure — that is precisely how the off-by-one selector bug above looks
from the console. Check: is each ring around the thing its label names?

The renderer warns when a leader could not avoid every element:

```
warning: leader for "Reveals what you typed" could not avoid every element
```

Fix it by setting `side` explicitly rather than ignoring it.

### 5. Lock it

```bash
node test/golden.test.mjs            # 0 px must differ
node test/golden.test.mjs --update   # re-record after an intended change
```

Add a case to the `CASES` array in `test/golden.test.mjs` for each figure you ship. The renderer is
deterministic by construction, so the golden catches a bumped dependency or a changed default
quietly restyling every figure in the docs.

## Styles

**Pick one preset and hold the whole manual to it.** The PSV set uses `marker-rings` everywhere; a
figure that arrives in a different hand is a defect, not a variation. Nine are implemented and
reachable via `--style`, and `--contact-sheet` renders all nine so you can choose once.

`marker-rings` handles both jobs on its own: it rings and labels regions, and it draws a
numbered bubble whenever a callout carries a `number`, so step sequences do not need a
separate preset.

| Preset | Seed | Notes |
|---|---|---|
| **`marker-rings`** | **21** | Amber hand, rings + labels, bubbles when numbered. The PSV house style |
| `plain-ink` | 7 | Ink blue, one colour, thin line |
| `highlighter` | 4 | Translucent band *behind* the control |
| `numbered-bubbles` | 33 | Bubbles + labels |
| `numbered-legend` | 11 | Clean geometry, plated labels |
| `inline-arrows` | 12 | Arrow and a word |
| `spotlight` | 13 | Dims everything except the targets |
| `print-safe` | 14 | Near-black, no dependence on hue — the one to reach for if greyscale printing is a requirement |
| `shop-floor` | 15 | Oversized type, heavy strokes |

Backdrops: `cool` (safest on a light site), `warm`, `navy`, `violet-brand`, `indigo-violet`,
`plum`, `aubergine`, `lavender`. The PSV set uses `aubergine` on every figure that has one. Which
figures get a backdrop at all is doctrine, not a per-figure style choice — see
[DOCTRINE.md](DOCTRINE.md).

## Before you ship a figure

- Label wording comes from the Markdown prose, and numbering matches the doc's step
  numbers. If the prose folds a sub-control into another step, give it an **unnumbered**
  label — do not invent a step the doc does not have.
- No control has been recoloured. Bands and scrims go *behind* the UI via an alpha punch.
- No leader crosses a control or another leader.
- Labels are vertically centred on the row they describe.
- **Every label is legible on the ground it actually lands on**, not on the ground the
  figure as a whole is on. The label palette is picked once per figure; `labelIn` and a
  `side` that puts a label over UI can both land one somewhere the palette is wrong for.
  Sample the rendered PNG. If the ground cannot carry any ink — a mid grey is the classic
  case — the fix is `labelPlate`, not a lighter colour.
- **It has a page recording what it shows, how to get back to it, why each callout is there and
  which ones you rejected.** See [`examples/figure-pages/`](examples/figure-pages/) for
  twenty-nine worked examples. If your sources and specs are gitignored, that page is the *only*
  thing that gets the next person back to the figure.

Full rationale, geometry constants, colour tokens and the open questions nobody has
resolved yet: **[references/style-guide.md](references/style-guide.md)**. Read it before
adding a preset or changing a constant.

## Layout

```
scripts/
  measure.mjs     pixel detection: borders, uniform swatches, ink clusters   (CLI + library)
  select.mjs      resolve a spec's target descriptions to rectangles
  layout.mjs      sides, margins, crop, label placement, leader routing
  drawing.mjs     SVG emission; Rough.js strokes, masks, text
  geometry.mjs    rounded-rect outlines, arrowheads, route search
  text.mjs        real metrics from the TTFs via opentype.js
  render.mjs      resvg rasterisation + sharp compositing
  fonts.mjs       font registry and resvg's explicit fontFiles
  palette.mjs     colour tokens and backdrop gradients
  styles/         one module per preset, over four shared draw engines
example/
  sample-app.png  a drawn stand-in, so the install can be proved with no real capture
  demo.json       the end-to-end demo spec, commented throughout
```
