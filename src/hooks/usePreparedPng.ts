import { useEffect, useRef, useState } from 'react';
import { renderPng } from '../preview/export';
import type { Scene } from '../preview/scene';

/** Pause after the last change before the PNG is rendered (D-076). */
export const PREPARE_DELAY_MS = 300;

export type PreparedPng =
  | { readonly status: 'idle' }
  | { readonly status: 'preparing' }
  | { readonly status: 'ready'; readonly file: File }
  | { readonly status: 'failed' };

/**
 * The PNG to share, rendered before the tap (D-076): the share sheet opens only
 * from the tap itself, and rendering takes longer than browsers keep that
 * permission. While `enabled` (an exportable configuration with its fonts,
 * photograph, and signature loaded, in the open finalization section), the
 * scene is rendered `PREPARE_DELAY_MS` after the last change of `revision`. A
 * file is returned only for the current revision, so a stale image is never
 * offered; the export path is the same `renderPng` as "Baixar minha criação".
 */
export function usePreparedPng(
  scene: Scene,
  revision: string,
  fileName: string,
  enabled: boolean,
): PreparedPng {
  const [prepared, setPrepared] = useState<{ revision: string; file: File | null } | null>(null);
  // The note changes the scene object but not the revision: the latest scene draws the same image.
  const latestScene = useRef(scene);
  useEffect(() => {
    latestScene.current = scene;
  });

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const timer = setTimeout(() => {
      renderPng(latestScene.current).then(
        (blob) => {
          if (current) {
            setPrepared({ revision, file: new File([blob], fileName, { type: 'image/png' }) });
          }
        },
        () => {
          if (current) setPrepared({ revision, file: null });
        },
      );
    }, PREPARE_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [enabled, revision, fileName]);

  if (!enabled) return { status: 'idle' };
  if (prepared?.revision !== revision) return { status: 'preparing' };
  return prepared.file ? { status: 'ready', file: prepared.file } : { status: 'failed' };
}
