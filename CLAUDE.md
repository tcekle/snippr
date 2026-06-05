# CLAUDE.md

snippr — Windows tray app companion to the native Snipping Tool. Tauri 2 (Rust) + React 19 + Konva + zustand. Watches the clipboard for snips, pops an annotation editor, exports back to clipboard/PNG. Also: scrolling capture, region snapshots, screen recording.

## Commands

```powershell
npm run tauri dev                                      # run the app (Rust auto-rebuilds)
npm run dev                                            # frontend only, plain browser (demo mode below)
npx tsc --noEmit                                       # frontend typecheck — run after TS changes
cargo test  --manifest-path src-tauri/Cargo.toml       # Rust tests (stitch + MF encode run for real)
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build                                    # NSIS installer
```

## Architecture

- **IPC**: images cross the bridge as raw binary (`tauri::ipc::Response` / `tauri::ipc::Request` raw body) — never base64/JSON. Rust emits events to the `"main"` window (`snip-captured`, `snapshot-captured`, `recording-saved`, `recording-error`, `scroll-capture-error`); the frontend pulls pending bytes via `get_pending_image` (slot is `take()`n).
- **Multi-window**: one React bundle, routed by window label in `src/main.tsx` — `main` (editor), `overlay-N` (one region-selection overlay per monitor), `rec-toolbar` (floating recorder bar). The overlay asks `get_selection_mode` (`scrolling` | `snapshot` | `recording`) to decide which command its drag fires. New labels go in `src-tauri/capabilities/default.json`.
- **Editor state**: `src/store/editorStore.ts` — flat fields are the ACTIVE tab; inactive tabs park a `DocSnapshot`. Undo/redo = annotation-array snapshots. Annotations are plain data discriminated on `type` (`src/types/annotations.ts`), rendered declaratively in `EditorCanvas.tsx`.
- **Clipboard watcher** (`clipboard_watcher.rs`): Win32 message-only window + `AddClipboardFormatListener`; snips attributed via `GetClipboardOwner` → process name; `ignore_next` flag prevents export→re-trigger feedback loop.

## Hard-won rules (violating these causes real bugs)

- **Any Tauri command that creates a window MUST be `pub async fn`.** A sync command deadlocks on Windows: `build()` blocks the main thread, which is blocked on the command's IPC reply.
- **windows crate 0.58 + 0.61 coexist** in the dep graph. Pass zero-value sentinels (`HWND::default()`, `HANDLE::default()`) or concretely-typed `None::<&IMFAttributes>` — never bare `None` — or the `Param` trait impls conflict between windows_core versions.
- **Screen capture is GDI `BitBlt` with `CAPTUREBLT`** (`capture_screen_rect[_bgra]` in `scrolling_capture.rs`); frames are top-down. H.264 needs even width/height (round down).
- **MF H.264 video orientation: feed top-down BGRA verbatim with a POSITIVE stride.** The SinkWriter's encoder MFT treats the input buffer as top-down and ignores the `MF_MT_DEFAULT_STRIDE` sign hint — a negative stride or a manual row-flip both produce upside-down video. Do NOT trust an MF SourceReader encode→decode round-trip to verify orientation: both ends share the same stride convention, so a flip cancels and the test lies. Verify with an **external** decoder. Quick browser oracle: encode a 4-colour quadrant pattern (TL red / TR green / BL blue / BR yellow), load the mp4 in a `<video>`+`<canvas>` page, screenshot via headless Edge (`--headless=new --autoplay-policy=no-user-gesture-required`), read the corners. Upright = same as source.
- **Coordinates**: overlays compute physical px as `CSS px × scaleFactor + outerPosition`, per overlay window (mixed-DPI safe). Rust takes physical coords everywhere.
- **Text annotations are created on pointerUP**, not pointerdown — a textarea mounted during pointerdown is blurred by the browser's own mousedown focus pass and instantly self-deletes.
- **The annotations Konva layer is `listening` only with the select tool (or Ctrl held)** — otherwise drawing on top of a shape drags it instead. Ctrl is the Photoshop-style temporary move tool.
- **Plain-browser safety**: the bundle must load outside Tauri (README screenshots). Wrap every `@tauri-apps/*` call in try/catch or `.catch()`; `getCurrentWindow()` at module scope throws in a browser.
- **Canvas height cap is 16,000 px** (WebView2 texture limit) — taller bitmaps render blank.
- **Badge numbers derive from `max(existing)+1`** at creation — there is no counter to increment.

## README screenshots

`npm run dev`, then headless Edge against `http://localhost:1420/?demo=1` (dev-only demo doc + sample annotations):

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu `
  --window-size=1440,900 --virtual-time-budget=10000 --screenshot="docs\editor.png" "http://localhost:1420/?demo=1"
```

`docs/empty-state.png` = same without `?demo=1`; `docs/layers-panel.png` = 220-wide crop of the right panel. Regenerate when the UI visibly changes.

## Conventions

- Commits: Conventional Commits, imperative subject ≤50 chars, body only for non-obvious why. No AI attribution lines.
- Styling is inline `style={{...}}` with CSS vars (`--color-accent`, `--color-elevated`, `--color-border`, `--color-text[-muted]`) — no CSS framework, match the existing idiom.
- Rust modules use section comment bars (`// ── … ──`) and doc comments that explain WHY.
- After every milestone: commit and push `origin main`. Gitea push auth flakes intermittently — one retry always succeeds.
