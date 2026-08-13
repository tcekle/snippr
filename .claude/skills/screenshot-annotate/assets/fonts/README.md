# Vendored fonts

Committed as `.ttf` on purpose. `@resvg/resvg-js` is handed these files explicitly via
`font.fontFiles` (see `scripts/fonts.mjs`) rather than resolving `font-family` by name,
because name lookup renders differently on every machine and falls back silently when a
name misses — a figure that looks right locally and wrong in CI.

`@fontsource/*` is **not** usable here: those packages ship only `.woff` and `.woff2`, and
resvg's font database will not load woff2. Verified — `@fontsource/patrick-hand@5` ships
`files/*.woff` and `files/*.woff2` and no TTF at all.

All six faces are SIL Open Font License 1.1, which permits redistribution and commercial
documentation use. The license text and the per-family copyright notices are in
[OFL.txt](OFL.txt) — the OFL requires that they travel with the fonts, so keep that file
alongside the `.ttf`s if you copy this directory anywhere.

| File | Family | Used by |
|---|---|---|
| `PatrickHand-Regular.ttf` | Patrick Hand | `plain-ink`; all numbered-bubble numerals |
| `Kalam-Bold.ttf` | Kalam 700 | `marker-rings` |
| `Kalam-Regular.ttf` | Kalam 400 | `numbered-bubbles` labels |
| `ArchitectsDaughter-Regular.ttf` | Architects Daughter | `highlighter` |
| `Poppins-Regular.ttf` | Poppins 400 | clean presets |
| `Poppins-SemiBold.ttf` | Poppins 600 | clean preset emphasis |

Numerals never come from Kalam: its `1` is a bare vertical slash with no flag or foot and
reads as punctuation at bubble sizes. `scripts/fonts.mjs` routes digits to Patrick Hand.

## Refetching

From the OFL directories of <https://github.com/google/fonts>:

```bash
cd assets/fonts        # from the skill root
base=https://raw.githubusercontent.com/google/fonts/main/ofl
for spec in patrickhand/PatrickHand-Regular.ttf \
            kalam/Kalam-Regular.ttf \
            kalam/Kalam-Bold.ttf \
            architectsdaughter/ArchitectsDaughter-Regular.ttf \
            poppins/Poppins-Regular.ttf \
            poppins/Poppins-SemiBold.ttf; do
  curl -sSL -o "$(basename "$spec")" "$base/$spec"
done
```

Then prove resvg can actually rasterise them — a missing face draws blank rather than
raising, so this check counts rendered ink per face and fails if any drew nothing:

```bash
node test/font-path.test.mjs
```
