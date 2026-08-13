# Figure style guide

The rules the annotation pipeline implements, and why. Several were learned by getting
them wrong first — those are called out, because the wrong version usually looks
plausible until you compare it against the product.

Read this before adding a preset or changing a constant in `scripts/geometry.mjs`.

---

## 1. Correctness rules

Non-negotiable. A figure that breaks one of these is wrong even if it looks good.

### 1.1 Annotate the real capture

Never regenerate, redraw, or approximate the UI. A figure that is a lookalike of the
product rather than the product is worse than no figure: a reader trusts it and it lies
to them.

This disqualifies any tool that cannot take the actual PNG as input. The Canva MCP
connector can only ingest images from a public HTTPS URL; the screenshots are local
files, so the only thing it could produce was a fabricated login screen with arrows
pointing at invented pixels. That is the whole reason this skill is a local Node
pipeline.

### 1.2 Measure, don't eyeball

Element bounds come from pixel detection, never guessed coordinates. Screenshots get
re-taken at a different window size or device scale, and hardcoded coordinates drift
silently — the figure still renders, and every callout points at empty space.

`scripts/select.mjs` is the enforcement: a spec describes a target ("the rightmost ink
cluster inside the password field"), and the description survives the layout changing.

The `rect` selector exists as an escape hatch. Using it forfeits this guarantee.

### 1.3 Never recolour a control

A translucent highlighter band drawn *over* the UI tinted the Sign In button olive-green.
The figure then misrepresented the product — a correctness bug, not a cosmetic one.

The fix: draw the band, then **punch the control's own rounded rect out of the band's
alpha mask**, so the highlight reads as sitting behind the UI. `Sketch.bandBehind()` does
this with an SVG mask; `spotlight`'s scrim uses the same mechanism inverted.

### 1.4 Leaders must not cross controls or each other

The reveal-toggle leader initially sliced diagonally across the Sign In button. Route it
out of the element into a free horizontal lane instead.

`routeLeader()` tries a straight line, then two elbows, then lane routes, and takes the
first with no intersections. Every drawn leader becomes an obstacle for later ones. If
nothing is clean it returns the least-blocked route and warns rather than failing.

One subtlety: a control that *encloses* the target is excluded from its obstacle set. The
reveal toggle sits inside the password field, so every possible leader to it ends inside
that field; without the exclusion the check would fire on every run and stop meaning
anything.

### 1.5 Label text follows the doc

Wording comes from the Markdown prose. Numbering matches the doc's step numbers.

If the doc folds a sub-control into another step, give it an **unnumbered** label. The
eye/reveal button is part of step 2 in `signing-in.md`, so inventing a step 4 for it would
put the figure out of step with the prose it illustrates. `figures/sign-in.json` is the
worked example: three numbered callouts and one unnumbered.

### 1.6 Labels align to the row they describe

A label floating above its target reads as belonging to the row above. Same vertical
centre as the element.

This is why `scripts/text.mjs` reads real cap heights out of the TTFs. Centring on the
font's ascender/descender midpoint leaves handwriting faces visibly high, because their
ascenders and descenders are wildly asymmetric.

---

## 2. Geometry

| Property | Value | Why |
|---|---|---|
| Arrowhead barb angle | **0.17π (~30°)** from the reversed shaft | 0.42π was tried first and renders as a bracket `⟩`, not an arrow |
| Arrowhead length | canvas width / 95 | |
| Stroke width | canvas width / 600 | 3px at 1920, 6px at 3640 |
| Ring shape | **Rounded rectangles, never ellipses** | An ellipse clips field corners and its long axis slices through label text |
| Ring radius | Match the control's own corner radius | |
| Ring padding | 9–14px at a 1920px canvas, scaled | |
| Ring overshoot | Start at a point along the perimeter, travel 104–109% | The stroke visibly crosses itself, the way a pen does, instead of closing dead on its start |
| Crop | Tight | The raw login capture is 2880×1800 with the card occupying a fraction of it; cropping roughly doubles the useful density |
| Margin | Only where an annotated region touches the frame | The app shell needs it on all four sides; the sign-in screen needs none |

Everything is derived from canvas width so a figure looks the same whether captured at 1x
or at device scale 2. See `metrics()` in `scripts/geometry.mjs`.

**Crop context.** Cropping to the targets alone can amputate whatever contains them — on
the sign-in screen it severs the card and the figure reads as a floating fragment. Name
the container in `cropInclude`.

### 2.1 Leaders sweep, they don't poke

A leader is an arc, not a line. Rough.js's `bowing` does nothing to a two-point path —
it can only bend segments that exist — so a short direct leader renders as a stubby
chevron no matter how the style is tuned. `curvedLeader()` bows the chord out into a
quadratic and samples it; `pickBow()` chooses the direction that stays clear of
everything. The elbow router is the fallback for when neither bow is clean, because an
elbow is legible but mechanical.

Three things make the sweep possible, and all three are needed:

- **`labelIn` — put the label in open space inside the frame.** A frame panel (the nav,
  the activity rail) runs the full height, so a label beside it is a label pinned to the
  extreme edge of the picture. `findEmptyRegions()` locates the actual whitespace by
  measurement — largest-rectangle-in-histogram over a downsampled background mask — and
  the label goes there, with a long arc crossing to the target.
- **`labelBias` — don't pin it to the target.** Clamping the label as close to its target
  as it will fit collapses the leader back to a stub. Default 0.35 leans it toward the
  target from the middle of the open space, which keeps the association while leaving the
  arc a run.
- **`aimSlide` — don't aim at the nearest point.** For a full-width panel the nearest
  point is directly below the label, so the leader drops a few pixels and reads as a tick
  mark. Sliding the landing point along the edge, proportionally to how close the label
  already is, turns it into a diagonal with room to curve. It still lands on the panel it
  names.

`labelShift` is the manual override when a label wants to sit somewhere the automatic
placement won't choose — sliding the title-bar label off centre so its arc has length.

**Backdrop padding.** A backdrop only reads as one if the window floats on it. Margins are
otherwise derived purely from labels, so any side without a label would run the screenshot
to the figure's edge and leave the gradient as two stripes. A floor of 4.5% of width
applies on all four sides whenever a backdrop is set.

---

## 3. Colour

**`#054BAA` is the only brand-verified value.** It is `theme-color` site-wide on
dataio.com and the exact blue of the PSV logo in the screenshots.

| Token | Hex | Use |
|---|---|---|
| Brand blue | `#054BAA` | Reference. Annotations rarely use it directly — a callout in the product's own blue competes with the product's own blue |
| Ink blue | `#123478` | Sketch annotations on light backgrounds |
| Amber | `#BF6F14` | Marker rings |
| Amber on dark | `#CE7A1A` rings / `#F6BA58` labels | Dark backdrops need the lift |
| Dark ink | `#1C202C` | Print-safe and highlighter |
| Highlighter | `#FFCE38` @ ~75% alpha | Band fill |
| Plate wash | `#141821` @ 82% | The ground a `labelPlate` brings with it |

Measured from the UI itself, useful for masks and matching: background `#F0F4F8`, input
fill `#E2E8F0`, borders `#CBD5E1`.

### 3.1 A mid-tone ground caps every ink

Contrast is a ratio of luminances, so against a mid grey both the darkest ink and the
lightest ink are closer to the ground than either is to black or white. On the `#999999`
of a modal's dimmed page, **white itself reaches only 2.85:1** — under the 3:1 floor for
large text — while `#F6BA58` reaches 1.64:1 and the house amber `#BF6F14` reaches 1.34:1.
There is no colour answer. The ground has to change.

`labelPlate` is that change: a filled rounded rect behind the label carrying `#141821` at
82%, with the label lifted to `#F6BA58` on top of it — the same pair a gutter label takes
on a dark backdrop. It is **off unless a spec asks**, and the doctrine for when to ask is
in [DOCTRINE.md](../DOCTRINE.md); `unsaved-changes` is the worked example, at 8.59:1.

Two properties of the drawing are deliberate. The plate's edge is drawn by Rough.js rather
than as a plain `<rect>`, because a crisp rounded rect composited onto a screenshot reads
as a toast belonging to the *product* — rule 1.1 territory, since a figure must not invent
UI. And it hugs the label's **ink**, measured out of the TTF outline (`inkExtent` in
`scripts/text.mjs`), not the label's line box: a line box is 1.25em of leading, so padding
it puts a third of an em of dead air above the caps and almost none under the descenders,
and the plate comes out top-heavy and too tall to fit a tight band.

---

## 4. Typography

All faces are SIL OFL, vendored as TTF in `assets/fonts/`.

| Font | Preset |
|---|---|
| Patrick Hand | `plain-ink`; **all numbered-bubble numerals** |
| Kalam Bold | `marker-rings` |
| Kalam Regular | `numbered-bubbles` labels |
| Architects Daughter | `highlighter` |
| Poppins | the clean presets |

Numerals never come from Kalam: its `1` is a bare vertical slash with no flag or foot and
reads as punctuation at bubble size. `scripts/fonts.mjs` routes digits to Patrick Hand.

Handwriting faces need roughly **20–25% more point size** than a grotesque to read at the
same weight. `FONT_SIZE_SCALE` applies this per slot.

---

## 5. Determinism

Every style has a fixed seed, so rebuilds are byte-identical and every figure in the
manual is drawn by the same "hand".

Seeds: `plain-ink` 7, `marker-rings` 21, `highlighter` 4, `numbered-bubbles` 33.

The seed is passed through to Rough.js; nothing reseeds a global RNG. Individual shapes
derive `baseSeed + n * 7919` so shapes differ from each other while the figure as a whole
stays reproducible. Rough.js and resvg are **pinned to exact versions** — seed stability
across versions is not guaranteed, and `test/golden.test.mjs` is what catches it if it
changes.

The prototype hand-rolled the sketch effect: smooth perpendicular noise on resampled
paths, each stroke drawn twice with a small offset to mimic re-inking, tapered wobble at
path ends. Rough.js does all of it natively via `roughness` and `bowing`, and adds the
seed the noise code never had. Don't port the noise code.

---

## 6. Backdrops

**When one applies is not a style question — see the backdrop doctrine in
[DOCTRINE.md](../DOCTRINE.md).** The short version: a backdrop goes on any figure whose annotation
content sits in synthesized margin outside the app window, and a figure whose annotations are all
contained within the captured view stays on white. This section is about how a backdrop is drawn, not
about which figures get one. (It used to say "frame diagrams only"; that rule was superseded, and
thirteen crops with label gutters have been converted as a result — four in the first pass, then
`service-mode-banners` and `shell-activity-rail`, then the nine detail figures of *Signing In* and
*Run*. Eighteen figures carry one now.)

**Two of the drawing details above decide whether a conversion needs a re-crop.** The blurred
silhouette and the hairline edge are both drawn around the *screenshot rectangle* — so if the source
carries synthesized margin of its own (`docs/help/.screenshots/pad-clip.mjs` composites 48px onto a
clip taken flush against a screen edge), the thing that floats on the gradient is that margin, not the
UI. Crop synthesized margin off when adding a backdrop; leave captured margin in.

Recipe: linear gradient at ~118°, a soft radial white lighten at
~16% height so it does not read as a flat ramp, the window silhouette blurred as a
shadow, the screenshot composited, then a hairline edge stroke so a light title bar does
not bleed into the gradient.

| Preset | Gradient | Note |
|---|---|---|
| `cool` | `#F2F6FB → #C6D5E8` | On-brand, safest |
| `warm` | `#FAF6F0 → #DBD2C6` | Good on off-white paper |
| `navy` | `#1E3452 → #0C1626` | Screenshot pops |
| `violet-brand` | `#07307A → #4E288C` | Purple, anchored near the brand blue |
| `indigo-violet` | `#26164A → #683EA8` | Most saturated purple |
| `plum` | `#2C1238 → #7A3A6A` | Magenta lift |
| `aubergine` | `#1A102E → #3C2660` | Restrained purple |
| `lavender` | `#F5F2FC → #CEC2E8` | Only purple that prints cleanly |

**A dark backdrop repalettes every label in the figure, including ones placed inside the frame.**
`onDark` is derived once from the preset, so `marker-rings` lifts rings to `#CE7A1A` and labels to
`#F6BA58` everywhere. Measured on published output, `#F6BA58` runs 5.6–9.1:1 against the aubergine
ground — comfortable — and **1.77:1 against the app's white content area**, which is below the 3:1
floor for large text. Any callout using `labelIn` to sit in open space inside a light UI is therefore
made *less* legible by adding a backdrop. Check where each label actually lands before converting a
figure.

**The remedy is to move that label into a gutter, or to give it a plate — not to abandon the
backdrop.** Relocated, both labels sit on the same ground and the per-figure palette is correct for
both; `service-mode-banners` is the worked example, 1.77:1 to 7.68:1 by moving to a bottom gutter, at
the cost of a shorter crop to give the new leader a lane. Where the label has to stay put, §3.1's
`labelPlate` gives it the dark ground the palette already assumes. `app-shell` still carries the
defect on two of its four labels, because both name full-height panels and a gutter label beside
either would be pinned to the edge of the picture; the plate is now the first thing to try there —
see its page.

**Rounded corners are a cosmetic edit to the capture.** In practice ~20px per corner
clips only background pixels, but rule 1.1 governs, so `cornerRadius` defaults to **0**
and a spec must opt in.

---

## 7. Implementation pitfalls

- **Font loading is the most likely thing to break.** Pass fonts explicitly via resvg's
  `font.fontFiles` and set `loadSystemFonts: false`. A missing face renders as blank
  space rather than raising, so "it did not throw" proves nothing — `test/font-path.test.mjs`
  counts rendered ink per face.
- **`@fontsource/*` ships only woff/woff2**, which resvg's font database will not load.
  Verified. Vendor TTFs from `google/fonts` instead.
- **Memory.** Supersampling a 3640×2320 canvas at 3× is ~125MB per RGBA layer.
  `supersampleFactor()` drops to 2× above 3200px.
- **Don't reach for puppeteer.** It would work, but it is a heavyweight dependency for a
  few hundred SVG paths and it makes CI slow and flaky.

---

## 8. Unresolved

Carried forward from the handoff. None of these are settled, and a figure author should
know about them.

1. **`Maestro` vs `PSV` naming mismatch.** `signing-in.md` and `navigating-the-app.md` say
   "Maestro" throughout; the UI says "PSV" and "Sign in to PSV System". Either the product
   was renamed or the docs were forked. This needs a decision and probably a repo-wide
   pass — a bigger content problem than any figure.
2. **Amber collision.** Annotations use amber; so does the product — the *Not homed*
   indicator and the service-mode banners are both amber. A reader may read a callout
   colour as a machine-state colour. Prefer `plain-ink` on amber-heavy screens until this
   is settled.
3. **Purple is not brand-verified.** The purple backdrops were requested but could not be
   confirmed in Data I/O's palette. Only `#054BAA` is verifiable. If purple is real, get
   the hex.
4. **Dark backdrops vs the product's dark theme.** The app ships Light, Dark and High
   Contrast themes. A reader in Dark mode sees a dark UI on a dark backdrop and the figure
   stops matching their screen. Light backdrops degrade more gracefully and survive laser
   printing, where dark gradients band.
5. **The app-shell capture has the Notifications panel open.** For a figure whose job is
   to teach the four-part frame, a clean capture with panels closed would be stronger.
   This one would serve the *Activity rail* section better.
