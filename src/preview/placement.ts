/**
 * The text block of a scene, read by the position controls, the review, and
 * export. The block is placed with the position presets only; the canvas is
 * not interactive (D-068, which removed dragging).
 */

import type { ImageSize, Scene, TextBlock } from './scene';

export function textBlockOf<I extends ImageSize>(scene: Scene<I>): TextBlock | undefined {
  for (const layer of scene.layers) {
    if (layer.kind === 'text') return layer.block;
  }
  return undefined;
}
