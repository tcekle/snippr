# CLAUDE.md

snippr — Windows tray app companion to the native Snipping Tool. Tauri 2 (Rust) + React 19 + Konva + zustand. Watches the clipboard for snips, pops an annotation editor, exports back to clipboard/PNG. Also: region snapshots and screen recording. (Scrolling capture is withheld pending a licensing review of its stitcher — see below.)

## Commands

```powershell
npm run tauri dev                                      # run the app (Rust auto-rebuilds)
npm run dev                                            # frontend only, plain browser (demo mode below)
npx tsc --noEmit                                       # frontend typecheck — run after TS changes
cargo test  --manifest-path src-tauri/Cargo.toml       # Rust tests (MF encode runs for real)
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build                                    # NSIS installer
```

## Architecture

- **IPC**: images cross the bridge as raw binary (`tauri::ipc::Response` / `tauri::ipc::Request` raw body) — never base64/JSON. Rust emits events to the `"main"` window (`snip-captured`, `snapshot-captured`, `recording-saved`, `recording-error`, `scroll-capture-error` — the last keeps its name so restoring scrolling capture stays a clean revert; it currently carries snapshot/encode failures); the frontend pulls pending bytes via `get_pending_image` (slot is `take()`n).
- **Multi-window**: one React bundle, routed by window label in `src/main.tsx` — `main` (editor), `overlay-N` (one region-selection overlay per monitor), `rec-toolbar` (floating recorder bar). The overlay asks `get_selection_mode` (`snapshot` | `recording`) to decide which command its drag fires. Mode 0 was scrolling capture; the numbering is left alone so restoring it doesn't renumber the others. New labels go in `src-tauri/capabilities/default.json`.
- **Editor state**: `src/store/editorStore.ts` — flat fields are the ACTIVE tab; inactive tabs park a `DocSnapshot`. Undo/redo = annotation-array snapshots. Annotations are plain data discriminated on `type` (`src/types/annotations.ts`), rendered declaratively in `EditorCanvas.tsx`.
- **Clipboard watcher** (`clipboard_watcher.rs`): Win32 message-only window + `AddClipboardFormatListener`; snips attributed via `GetClipboardOwner` → process name; `ignore_next` flag prevents export→re-trigger feedback loop.

## Hard-won rules (violating these causes real bugs)

- **Any Tauri command that creates a window MUST be `pub async fn`.** A sync command deadlocks on Windows: `build()` blocks the main thread, which is blocked on the command's IPC reply.
- **windows crate 0.58 + 0.61 coexist** in the dep graph. Pass zero-value sentinels (`HWND::default()`, `HANDLE::default()`) or concretely-typed `None::<&IMFAttributes>` — never bare `None` — or the `Param` trait impls conflict between windows_core versions.
- **Screen capture is GDI `BitBlt` with `CAPTUREBLT`** (`capture_screen_rect` / `capture_screen_rect_bgra_cursor` in `scrolling_capture.rs` — the module keeps its name but now holds only the overlay, snapshot and the shared GDI helpers); frames are top-down. H.264 needs even width/height (round down).
- **MF H.264 video orientation: feed top-down BGRA verbatim with a POSITIVE stride.** The SinkWriter's encoder MFT treats the input buffer as top-down and ignores the `MF_MT_DEFAULT_STRIDE` sign hint — a negative stride or a manual row-flip both produce upside-down video. Do NOT trust an MF SourceReader encode→decode round-trip to verify orientation: both ends share the same stride convention, so a flip cancels and the test lies. Verify with an **external** decoder. Quick browser oracle: encode a 4-colour quadrant pattern (TL red / TR green / BL blue / BR yellow), load the mp4 in a `<video>`+`<canvas>` page, screenshot via headless Edge (`--headless=new --autoplay-policy=no-user-gesture-required`), read the corners. Upright = same as source.
- **Coordinates**: overlays compute physical px as `CSS px × scaleFactor + outerPosition`, per overlay window (mixed-DPI safe). Rust takes physical coords everywhere.
- **Text annotations are created on pointerUP**, not pointerdown — a textarea mounted during pointerdown is blurred by the browser's own mousedown focus pass and instantly self-deletes.
- **The annotations Konva layer is `listening` only with the select tool (or Ctrl held)** — otherwise drawing on top of a shape drags it instead. Ctrl is the Photoshop-style temporary move tool.
- **Plain-browser safety**: the bundle must load outside Tauri (README screenshots). Wrap every `@tauri-apps/*` call in try/catch or `.catch()`; `getCurrentWindow()` at module scope throws in a browser.
- **Canvas height cap is 16,000 px** (WebView2 texture limit) — taller bitmaps render blank.
- **Badge numbers derive from `max(existing)+1`** at creation — there is no counter to increment.
- **Sketch shapes use Rough.js's `generator()`, never its `RoughCanvas`** (`src/utils/roughPath.ts`). The canvas variant draws onto a 2D context, which would mean punching through Konva's context wrapper inside a `sceneFunc`; the generator emits plain op lists (`move`/`lineTo`/`bcurveTo`) that convert to an SVG path string for `<Path>`. Annotations stay declarative data, so export, hit-testing and the transformer need no special cases. Geometry is generated in LOCAL coords (rect spans `0,0..w,h`; ellipse centres on `0,0`) and positioned by Konva, so the wobble doesn't regenerate mid-drag. **`seed` is STORED on the annotation, not derived at render** — derive it and the shape re-wobbles on every redraw and differs in the exported PNG. Pre-sketch documents fall back to `seedFromId()`, which is stable for the same reason.
- **Canvas text does not wait for webfonts.** Konva measures and rasterises with whatever face is resolved at draw time and nothing invalidates it when the font arrives, so a hand-lettered label drawn in that window stays in the fallback forever. `whenHandFontsReady()` exists so `EditorCanvas` can force one `batchDraw()` once the faces land. Hand fonts are bundled, not fetched — the app must render identically offline, and a CDN face would silently change exported PNGs.
- **The `snippr generate` / `snippr mcp` CLI renders in a headless WebView, so build it with `tauri build` (`npx tauri build --no-bundle`), NOT `cargo build --release`.** A plain cargo release isn't a production Tauri app — it still loads `devUrl` (`localhost:1420`), so with no dev server the render window hangs to the 30s watchdog. The render window routes by the `cli-render` label, sets its own `WEBVIEW2_USER_DATA_FOLDER` (so it runs while the tray app holds the default folder), and exits via `std::process::exit` — `app.exit` leaves the OS status 0 and masks failures. `mcp` spawns `generate` as a subprocess of itself; the MCP server runs the *built* binary, so re-run `tauri build` and restart it after code changes.
- **CI versioning is MinVer-style** (`scripts/compute-version.mjs`, run by `.github/workflows/build.yml`): latest `vX.Y.Z` tag + commit height → a version stamped into `package.json` / `tauri.conf.json` / `Cargo.toml` at build time only — never committed, tags are the source of truth. Checkout needs `fetch-depth: 0` or the runner has no tags to describe. **The MSI bundler rejects a pre-release identifier that isn't a single number ≤ 65535** (it maps to the Windows installer version), so the stamped format is `X.Y.Z` on a tag and `X.Y.(Z+1)-N` (bare numeric height) off it — no `alpha` label and no `+gSHA` build-metadata in the string; the short sha is a separate CI output. `npm run version:show` prints it locally.
- **Auto-update = `tauri-plugin-updater` + NSIS `currentUser`** (per-user, no admin; the schema *rejects* `perUser` — valid modes are `currentUser` / `perMachine` / `both`). Updates are signed: private key is the `TAURI_SIGNING_PRIVATE_KEY` repo secret (back up `.secrets/snippr-updater.key` — losing it breaks the chain), pubkey is in `tauri.conf.json`; `release.yml` signs and uploads `latest.json` (the `createUpdaterArtifacts` flag lives in the `updater.release.json` overlay so `build.yml` stays unsigned and needs no secrets). **Self-update needs the NSIS preinstall hook (`src-tauri/windows/hooks.nsh`) that force-kills every `snippr.exe`** — the default name-based check can't kill cleanly when more than one instance runs (tray app + a `generate`/`mcp` child), so the installer rewrites `uninstall.exe` but leaves the locked `snippr.exe`, the version never advances, and the app loops re-offering the same release (tauri-apps/tauri#8223). Diagnose by comparing the installed `%LOCALAPPDATA%\snippr\snippr.exe` version/mtime against the release. Note: release builds have **no logger** (`env_logger` is `#[cfg(debug_assertions)]`-only), so the updater is silent in production.

## README screenshots

`npm run dev`, then headless Edge against `http://localhost:1420/?demo=1` (dev-only demo doc + sample annotations):

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu `
  --window-size=1440,900 --virtual-time-budget=10000 --screenshot="docs\editor.png" "http://localhost:1420/?demo=1"
```

`docs/empty-state.png` = same without `?demo=1`; `docs/layers-panel.png` = 220-wide crop of the right panel. Regenerate when the UI visibly changes.

The committed docs screenshots are then **beautified by snippr itself** (dogfood). After regenerating the raw PNGs above, re-run the beautify pass — a backdrop-only scene (`{"annotations":[],"backdrop":{…}}`) through the production CLI, writing back over the same file:

The scene is passed on **stdin** (`--scene -`), so there is no scene file to keep in sync — these exact values are the recipe, and they reproduce the committed images 1:1:

```powershell
$exe = "src-tauri\target\release\snippr.exe"   # must be a `tauri build`, not cargo --release
$macos = '{"annotations":[],"backdrop":{"padding":72,"fill":{"kind":"gradient","from":"#0A1628","to":"#054BAA","angle":225},"cornerRadius":14,"shadow":true,"frame":"macos","aspect":"auto"}}'
$macos | & $exe generate --input docs\editor.png --scene - --output docs\editor.png
```

Frame per shot: `macos` for the full-app captures (editor/empty-state/beautify/sketch), `none` for the `layers-panel` crop — same fill, but `padding:28` and `cornerRadius:8`.

The geometry is load-bearing, because the committed sizes are fixed: a 1440×900 capture + `padding:72` + the 28px macOS title bar = **1584×1072**, and the 220×270 panel crop + `padding:28` = **276×326**. Change padding and every image silently changes size. `Failed to unregister class Chrome_WidgetWin_0` on stderr is benign WebView2 teardown noise — check the printed output path, not the exit chatter.

## Withheld: scrolling capture

Removed from the shipped tool in `HEAD`, pending a licensing review. Its row-matching stitcher was ported from ShareX, which is **GPL-3.0**, and this repo has no LICENSE file — so shipping it in a signed binary release was the part that needed settling, not the README wording.

What came out: the stitcher and its tests, `capture_session`, `send_scroll`, the `begin_scrolling_selection` / `start_scrolling_capture` commands, the tray item and the top-bar button. What stayed: the region overlay, the selection-mode tri-state, `check_hotkey`, `store_and_emit` and the GDI capture helpers — snapshot and recording all depend on those and none of them are ShareX-derived.

To restore, start from `git show 88e6db3:src-tauri/src/scrolling_capture.rs`. Resolve the licence question first: either license snippr GPL-3.0 and keep the attribution, or replace the stitcher with an independently designed one.

## Conventions

- Commits: Conventional Commits, imperative subject ≤50 chars, body only for non-obvious why. No AI attribution lines.
- Styling is inline `style={{...}}` with CSS vars (`--color-accent`, `--color-elevated`, `--color-border`, `--color-text[-muted]`) — no CSS framework, match the existing idiom.
- Rust modules use section comment bars (`// ── … ──`) and doc comments that explain WHY.
- After every milestone: commit and push `origin main` (GitHub: `tcekle/snippr`).
