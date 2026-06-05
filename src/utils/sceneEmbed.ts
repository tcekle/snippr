// Editable-PNG "scene embed": serialize the active document (annotations,
// backdrop, crop, board, base image) into a binary container that rides inside a
// custom `snIp` PNG chunk, and parse it back on reopen. Pure bytes/canvas/Image —
// no Tauri APIs, so it is safe in the plain-browser build. The chunk data layout
// is mirrored by the Rust splice in `src-tauri/src/png_embed.rs` (opaque there).
import type { Annotation } from '../types/annotations';
import type { BackdropConfig } from '../types/backdrop';
import { useEditorStore } from '../store/editorStore';

export const SCENE_VERSION = 1; // bump on breaking schema changes
export const CONTAINER_MAGIC = 'SNPR'; // chunk-data magic (matches Rust)
export const CONTAINER_FORMAT = 1; // container framing version

/** An annotation with its non-serializable runtime fields stripped. ImageAnno
 *  loses `imageEl` (an HTMLImageElement) and `src` (an object URL); its bitmap
 *  travels as a blob referenced by the annotation's own id. */
export type SerialAnnotation =
  | Exclude<Annotation, { type: 'image' }>
  | (Omit<Extract<Annotation, { type: 'image' }>, 'imageEl' | 'src'> & {
      /** blob id in the container; equals the annotation id */
      blobRef: string;
    });

export interface SceneManifest {
  version: number; // SCENE_VERSION
  app: 'snippr';
  /** native-pixel document size (page size for boards) */
  doc: { width: number; height: number };
  /** 'image' = screenshot doc (has a base blob); 'board' = no base image */
  kind: 'image' | 'board';
  /** present iff kind==='image'; the blob id of the unannotated base bitmap */
  baseRef: string | null; // "base" or null
  boardBackground: string | null; // color | 'transparent' | null
  annotations: SerialAnnotation[];
  cropRect: { x: number; y: number; width: number; height: number } | null;
  backdrop: BackdropConfig | null;
  /** diagnostics / forward-compat; ignored on read if unknown */
  meta?: { createdAt: string; appVersion: string };
}

/** In-memory container before it is serialized to chunk bytes. */
export interface SceneContainer {
  manifest: SceneManifest;
  blobs: Map<string, Uint8Array>; // id -> raw image bytes ("base", ImageAnno ids…)
}

// ── build from the live store ──────────────────────────────────────────────

/** Snapshot the active document into a serializable container. `baseImagePng` is
 *  the unannotated base bitmap (raw PNG bytes) the caller rendered separately;
 *  null for boards. The caller adds each ImageAnno's bitmap to `blobs` (by id). */
export function buildSceneContainer(baseImagePng: Uint8Array | null): SceneContainer {
  const s = useEditorStore.getState();
  const isBoard = s.boardBackground !== null && !s.screenshot.imageEl;
  const blobs = new Map<string, Uint8Array>();

  if (!isBoard && baseImagePng) blobs.set('base', baseImagePng);

  const annotations: SerialAnnotation[] = s.annotations.map((a): SerialAnnotation => {
    if (a.type === 'image') {
      // Strip the runtime-only imageEl/src; the bitmap rides as a blob (by id).
      return { id: a.id, type: 'image', x: a.x, y: a.y, width: a.width, height: a.height, blobRef: a.id };
    }
    return a;
  });

  const manifest: SceneManifest = {
    version: SCENE_VERSION,
    app: 'snippr',
    doc: { width: s.screenshot.width, height: s.screenshot.height },
    kind: isBoard ? 'board' : 'image',
    baseRef: isBoard ? null : 'base',
    boardBackground: s.boardBackground,
    annotations,
    cropRect: s.cropRect,
    backdrop: s.backdrop,
    meta: { createdAt: new Date().toISOString(), appVersion: '0.1.0' },
  };
  return { manifest, blobs };
}

/** Fetch an ImageAnno's bytes from its (blob:/data:) object URL. */
export async function imageAnnoBytes(src: string): Promise<Uint8Array> {
  const resp = await fetch(src);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

// ── byte (de)serialization — big-endian throughout (PNG convention) ──────────

export function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

/** Serialize manifest + blobs into the `snIp` chunk DATA payload. */
export function serializeContainer(c: SceneContainer): Uint8Array {
  const enc = new TextEncoder();
  const json = enc.encode(JSON.stringify(c.manifest)); // v1: no DEFLATE (flag 0)

  const parts: Uint8Array[] = [];
  parts.push(enc.encode(CONTAINER_MAGIC)); // "SNPR"
  parts.push(new Uint8Array([CONTAINER_FORMAT, 0x00, 0x00, 0x00])); // ver + flags(0) + reserved
  parts.push(u32be(json.length));
  parts.push(json);
  parts.push(u32be(c.blobs.size));
  for (const [id, bytes] of c.blobs) {
    const idBytes = enc.encode(id);
    parts.push(new Uint8Array([idBytes.length])); // blob_id_len (1 byte; ids are short)
    parts.push(idBytes);
    parts.push(u32be(bytes.length));
    parts.push(bytes);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Parse the `snIp` chunk DATA payload back into a container, or null if it is
 *  not a recognized container (caller falls back to flat-open). */
export function parseContainer(data: Uint8Array): SceneContainer | null {
  const dec = new TextDecoder();
  let off = 0;
  if (data.length < 12) return null;
  const magic = dec.decode(data.subarray(0, 4));
  if (magic !== CONTAINER_MAGIC) return null;
  off = 4;
  const format = data[off];
  off += 4; // skip ver + flags + reserved
  if (format !== CONTAINER_FORMAT) return null; // unknown framing → bail
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const jsonLen = view.getUint32(off);
  off += 4;
  const manifest = JSON.parse(dec.decode(data.subarray(off, off + jsonLen))) as SceneManifest;
  off += jsonLen;
  const blobCount = view.getUint32(off);
  off += 4;
  const blobs = new Map<string, Uint8Array>();
  for (let i = 0; i < blobCount; i++) {
    const idLen = data[off];
    off += 1;
    const id = dec.decode(data.subarray(off, off + idLen));
    off += idLen;
    const len = view.getUint32(off);
    off += 4;
    blobs.set(id, data.subarray(off, off + len));
    off += len;
  }
  return { manifest, blobs };
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Find the first `snIp` chunk's DATA inside a whole PNG, or null. */
export function extractSnipChunk(png: Uint8Array): Uint8Array | null {
  if (png.length < 8 || PNG_SIG.some((b, i) => png[i] !== b)) return null;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let off = 8;
  while (off + 8 <= png.length) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(png[off + 4], png[off + 5], png[off + 6], png[off + 7]);
    const dataStart = off + 8;
    if (type === 'snIp') return png.subarray(dataStart, dataStart + len);
    if (type === 'IEND') break;
    off = dataStart + len + 4; // skip data + CRC
  }
  return null;
}
