<img src="src-tauri/icons/128x128.png" width="64" align="left" alt="snippr logo" />

# snippr

**A companion to the Windows Snipping Tool — snip with `Win+Shift+S`, annotate instantly, copy or save.**

<br clear="left" />

snippr sits in your system tray and watches the clipboard. The moment the native Snipping Tool captures a screenshot, the snippr editor pops up with it loaded — draw arrows, boxes, text, badges, blur out secrets, then put the result back on the clipboard or save it as a PNG. No capture UI of its own, no replacing what Windows already does well.

![snippr editor with annotations](docs/editor.png)

## How it works

1. **Snip** anything with `Win+Shift+S` (the normal Windows flow)
2. snippr detects the screenshot on the clipboard and opens the editor
3. **Annotate**, then **Copy** (`Ctrl+C`) or **Save** (`Ctrl+S`) — done

Ordinary copied images don't trigger the editor — snippr checks that the clipboard write came from the Snipping Tool (there's a setting to trigger on any image if you prefer).

## Features

- **Annotation tools** — line, rectangle, ellipse, arrow, freehand pen, highlighter, text, auto-numbered step badges
- **Scrolling capture** — grab an entire scrollable page as one tall image (see below)
- **Open existing images** — paste (`Ctrl+V`) or drag files in; with nothing open the image becomes the tab's background, with a document open it lands as a movable **image layer** on top
- **Pixelate** — drag a region to censor API keys, emails, faces
- **Crop** — non-destructive; adjust or remove it any time before export
- **Tabs** — every snip opens its own tab with independent annotations and undo history
- **Layers panel** — every annotation listed with a live geometry preview; click to select, double-click text to edit, `×` to delete
- **Full undo/redo**, drag/resize via selection handles, drag anywhere inside the selection box
- **Smart export bounds** — annotations placed outside the image grow the exported canvas instead of being clipped
- **Design-tool canvas** — dot-grid backdrop that pans and zooms with the view (never baked into exports)
- **Tray app** — starts with Windows (optional), single instance, close-to-tray

<table>
<tr>
<td width="60%" valign="top">

### Layers with live previews

Each row renders a miniature of the actual shape — its real geometry and color. Pen strokes are down-sampled, arrows keep their heads, text shows its content.

</td>
<td>

![layers panel](docs/layers-panel.png)

</td>
</tr>
</table>

## Scrolling capture

For content taller than the screen — long pages, chat logs, code files — snippr can capture the whole thing as a single image (the one capture the native Snipping Tool can't do):

1. Click **Scrolling capture** in the top bar (or the tray menu)
2. The screen dims — **drag a rectangle** over the scrollable content
3. Hands off: snippr parks the cursor in the region, scrolls automatically, and captures frames every 300 ms
4. It stops by itself at the bottom (or press `Esc` to stop early and keep what it has) — the stitched result opens as a new tab

Frames are joined by matching pixel rows between captures, ignoring the side margins (scrollbars) and auto-detecting sticky footers so they appear only once. Tips:

- Select **only the scrolling content** — exclude browser chrome and sticky headers when you can
- Animated content (video, GIFs, carousels) breaks frame matching — leave it out of the region
- Output height is capped at 16,000 px (canvas texture limit)

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1` `2` `3` `4` `5` | Line, Rectangle, Arrow, Text, Pen |
| `V` | Select / move |
| `E` `H` `B` `X` `C` | Ellipse, Highlighter, Badge, Pixelate, Crop |
| `Ctrl+C` / `Ctrl+Enter` | Copy annotated image to clipboard |
| `Ctrl+V` | Paste an image — new tab, or image layer when a doc is open |
| `Ctrl+S` | Save As… |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Delete` | Delete selected annotation |
| `Esc` | Cancel draw → deselect → hide window |
| `Enter` | Confirm crop |
| `Ctrl+Tab` / `Ctrl+W` | Next tab / close tab |
| `Ctrl+0`, `Ctrl+=`, `Ctrl+-` | Fit, zoom in, zoom out |
| `Ctrl+wheel` / `Space`+drag / middle-drag | Zoom / pan |

## Tray menu

- **Open editor** — bring up the window (left-click does this too)
- **Annotate clipboard image** — manually pull in whatever image is on the clipboard
- **Scrolling capture** — capture a scrollable page as one tall image
- **Pause watching** — stop reacting to snips
- **Settings** — save directory, trigger-on-any-image, start with Windows
- **Quit**

When idle, the editor waits quietly:

![empty state](docs/empty-state.png)

## Building from source

Prerequisites (Windows 11):

- [Rust](https://rustup.rs) (MSVC toolchain) and the **Desktop development with C++** workload
- [Node.js](https://nodejs.org) 20+
- WebView2 (preinstalled on Windows 11)

```powershell
git clone https://gitea.tcekle.com/taylor/snippr.git
cd snippr
npm install
npm run tauri dev      # development
npm run tauri build    # NSIS installer → src-tauri\target\release\bundle\nsis\
```

The installer is unsigned — SmartScreen will warn on first run (`More info → Run anyway`).

## Architecture

- **Backend (Rust / Tauri 2):** a Win32 message-only window registered with `AddClipboardFormatListener` watches the clipboard. New images are attributed via `GetClipboardOwner` → process name (`ScreenClippingHost.exe` / `SnippingTool.exe`), debounced (the Snipping Tool writes the clipboard once per format), PNG-encoded, and handed to the frontend over raw binary IPC. Exports flow back the same way; a feedback-loop guard keeps snippr's own clipboard writes from re-triggering the watcher.
- **Scrolling capture:** a transparent always-on-top overlay window hosts the region selector; a Rust thread then drives the target with `SendInput` mouse-wheel events, grabs frames via GDI `BitBlt`, and stitches them with a row-matching algorithm ported from [ShareX](https://github.com/ShareX/ShareX)'s scrolling capture (side margins ignored, sticky footers deduplicated, stop on two identical frames). `Esc` is a thread-level `RegisterHotKey`. The stitcher is covered by unit tests against synthetic scroll sequences.
- **Frontend (React 19 + Konva):** the screenshot is the bottom layer of a Konva stage; annotations are plain data rendered declaratively, with snapshot-based undo/redo in a zustand store. Export resets the stage transform and rasterizes at native resolution.

### README screenshots

The screenshots above are generated from the web build: `npm run dev`, then open `http://localhost:1420/?demo=1` (dev-only demo mode that loads a synthetic screenshot plus sample annotations).
