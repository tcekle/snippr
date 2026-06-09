// Driver for `snippr generate`: runs inside the hidden `index.html?cli=render`
// window. Pulls the job + input image from Rust, applies the scene to the store,
// waits for the real Konva pipeline to paint, then ships the rendered bytes back
// to `cli_write_output` (which writes the file and exits the process).
import { invoke } from '@tauri-apps/api/core';
import type Konva from 'konva';
import { useEditorStore } from '../store/editorStore';
import { buildSaveBody } from '../utils/exportPng';
import type { Annotation, CropRect } from '../types/annotations';
import type { BackdropConfig } from '../types/backdrop';

interface CliJob {
  sceneJson: string;
  editable: boolean;
}

interface SceneInput {
  annotations?: Annotation[];
  backdrop?: BackdropConfig | null;
  cropRect?: CropRect | null;
  boardBackground?: string | null;
}

function decode(bytes: Uint8Array): Promise<{ url: string; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    const img = new Image();
    img.onload = () => resolve({ url, img });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('input image failed to decode'));
    };
    img.src = url;
  });
}

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Wait until EditorCanvas has mounted and registered the Konva stage. */
async function waitForStage(): Promise<Konva.Stage> {
  for (let i = 0; i < 240; i++) {
    const s = useEditorStore.getState().stageRef;
    if (s) return s;
    await raf();
  }
  throw new Error('render stage never mounted');
}

export async function runCliRender(): Promise<void> {
  try {
    const job = await invoke<CliJob>('cli_get_job');
    const buf = await invoke<ArrayBuffer>('cli_get_input_image');
    const bytes = new Uint8Array(buf);
    const { url, img } = await decode(bytes);

    const store = useEditorStore.getState();
    // Pass the raw bytes as originalBytes so an --editable save embeds them verbatim.
    store.addTab(url, img.naturalWidth, img.naturalHeight, img, bytes);

    const scene = JSON.parse(job.sceneJson) as SceneInput;

    // Image-layer annotations need bitmap assets the CLI doesn't carry; drop them
    // with a warning rather than failing the whole render.
    const annotations = (scene.annotations ?? []).filter((a) => {
      if (a.type === 'image') {
        console.warn(`snippr: dropping image-layer annotation "${a.id}" (unsupported via CLI)`);
        return false;
      }
      return true;
    });

    useEditorStore.setState({
      annotations,
      backdrop: scene.backdrop ?? null,
      cropRect: scene.cropRect ?? null,
      boardBackground: scene.boardBackground ?? null,
      history: [],
      future: [],
      selectedId: null,
      editingTextId: null,
    });
    store.requestFit();

    await waitForStage();
    // Give React a few frames to mount the new shapes and let filter-backed
    // nodes (pixelate, loupe) build their cached canvases before rasterizing.
    await raf();
    await raf();
    await raf();
    await sleep(300);

    const { body, headers } = await buildSaveBody(job.editable);
    await invoke('cli_write_output', body, { headers });
    // cli_write_output writes the file and exits the process; nothing runs after.
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await invoke('cli_fail', { message }).catch(() => {});
  }
}
