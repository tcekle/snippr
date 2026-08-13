# Bundle manifest

Packaged from `.claude/skills/screenshot-annotate/` in the `maestro-user-help` repository,
branch `feature/maestro-user-help` at commit `01e7104`.

**Examples are current** as of the Teach batch: 29 worked figure pages.

**Bundle: 2.4 MB unpacked (70 files), 1.1 MB zipped.** The source folder on disk is 54 MB; the
difference is `node_modules/`, render output and the PSV figure working set, none of which is
shippable.

Verified by a clean-room install: zip extracted to an empty directory outside the repository,
`npm install` (23 packages), font check 6/6 PASS, demo render 2600×1029, golden 0 px differ.

## Included

| Path | Size | Notes |
|---|---:|---|
| `assets/fonts/` | 1.5 MB | Six TTFs. **Required at render time**, not a convenience — resvg is handed them explicitly with `loadSystemFonts: false`, so without them every figure renders textless. All SIL OFL 1.1; `OFL.txt` added to satisfy the licence's redistribution clause |
| `test/golden/demo.png` | 301 KB | **New.** The demo's recorded golden, so `npm test` verifies a fresh install end to end |
| `examples/figure-pages/` | 216 KB | 29 worked figure pages, verbatim. Reference only |
| `scripts/` | 185 KB | The tool. 10 modules + 9 style presets over 2 shared engines. **Verbatim — no edits needed, none made** |
| `examples/FIGURES-psv-original.md` | 33 KB | The original PSV figure index, unedited, as provenance for `DOCTRINE.md` |
| `example/sample-app.png` | 44 KB | **New.** A drawn stand-in so the install can be proved with no real capture |
| `package-lock.json` | 26 KB | Verbatim. Carries every platform's prebuilt binary, so `npm ci` works cross-platform |
| `README.md` | 18 KB | **New.** Install, demo, and the "what to change" section |
| `DOCTRINE.md` | 17 KB | **New.** The doctrine lifted out of `FIGURES.md`, reframed for a reader outside this repo |
| `references/style-guide.md` | 16 KB | Verbatim. §3 colour tokens and §8 are PSV-specific; flagged in the README |
| `SKILL.md` | 14 KB | **Edited.** Repo paths replaced; `DOCTRINE.md`, `margin`, `union`, `fontScale`, `maxLabelWidth`, `seed` documented |
| `MANIFEST.md` | 6 KB | **New.** This file |
| `assets/fonts/OFL.txt` | 5 KB | **New.** SIL OFL 1.1 text, extracted verbatim from the licence record inside `ArchitectsDaughter-Regular.ttf`, with the per-family copyright notices |
| `test/golden.test.mjs` | 5 KB | **Edited.** 29 PSV cases replaced by the demo case; header rewritten |
| `example/demo.json` | 7.4 KB | **New.** The demo spec, commented throughout |
| `example/make-sample.mjs` | 5.9 KB | **New.** Regenerates `sample-app.png` |
| `examples/README.md` | 4.7 KB | **New.** What the worked examples are and the page template |
| `test/font-path.test.mjs` | 2.6 KB | Verbatim. The install check |
| `assets/fonts/README.md` | 2.3 KB | Lightly edited: points at `OFL.txt`, refetch command de-pathed |
| `.gitignore` | 0.9 KB | **Rewritten.** Same ignores; the commit-your-specs-or-not decision is now spelled out rather than assumed |
| `package.json` | 0.7 KB | **Edited.** Description de-PSV'd, `engines.node >= 18.17`, `verify` + `demo` scripts added. Dependencies untouched |

## Excluded

| Path | Size | Why |
|---|---:|---|
| `node_modules/` | 30 MB | `npm install` reinstalls it in ~2 s. Both native deps ship prebuilt binaries for every platform — nothing compiles. See the README |
| `out/` | 16 MB | Render output. Scratch |
| `test/golden/` (PSV) | 4.4 MB | 29 golden PNGs of PSV screens. Meaningless without the specs that produce them |
| `figures/` | 2.8 MB | The PSV working set: raw captures and their specs. Gitignored at source, and every path in them points into `docs/help` |
| `FIGURES.md` (as-is, at root) | 33 KB | Not dropped — **split**. The doctrine became `DOCTRINE.md`; the 29-row index, the PSV capture prerequisites (mock users, viewport floors, DTO shapes) and the outstanding-defects list are noise outside this repo. The unedited original is kept at `examples/FIGURES-psv-original.md` so nothing is lost |
| `test/font-path.png` | 77 KB | Output of the font test. Regenerated on first run |

## Decisions worth challenging

**All 29 figure pages shipped, not a curated subset.** They are 200 KB of text about screens the
recipient has never seen — but `DOCTRINE.md` and `style-guide.md` name a dozen of them by way of
evidence, and trimming to six would leave those references dangling while I guessed which analogies
would land. They cost nothing on disk and they are the only worked demonstration of what a figure
page should contain. `examples/README.md` says plainly what they are and points at six worth reading.

**`DOCTRINE.md` keeps the PSV figure names and the measured numbers.** The doctrine is written as
"rule + the figure that proved it + the number that settled it". Strip the evidence and you get
assertions. Nobody believes "a mid-grey ground caps every ink" until they see that white itself only
reaches 2.85:1 on `#999999` — and that is arithmetic, not PSV. The preamble tells the reader to read
past the names.

**`scripts/measure.mjs` FIXTURES left in.** The `app-shell` and `sign-in` fixtures are PSV
coordinates and `--verify` cannot pass without those captures. Removing them would delete a working
example of how to write a detector self-test, for a feature that is opt-in and inert otherwise.
Documented in the README instead.

**`test/golden/demo.png` shipped.** 224 KB buys an install check that verifies byte-level
determinism across machines — a far stronger signal than "it produced a PNG". If the recipient's
sharp or resvg resolves differently, or the fonts load differently, it fails loudly with a diff image
rather than shipping a subtly different manual.

## What was NOT changed in the source skill

Nothing. The source at `.claude/skills/screenshot-annotate/` is untouched; every edit above was made
to a copy. No change was required to make the tool portable, because `scripts/` had no repo coupling
to begin with.
