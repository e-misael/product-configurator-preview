/**
 * Canvas 2D painting of a scene (D-035). The only code that touches a canvas
 * context; export (M4) will call `drawScene` on another canvas so preview and
 * exported image come from the same path. No CSS filters, tinting, or
 * blending: each layer is the real image of its variation.
 */

import type { FontFamily } from '../domain';
import type { ImageSize, Scene } from './scene';
import type { MeasureText } from './text-fit';
import { FALLBACK_TEXT_COLOR, FONT_STACKS } from './text-style';

/** Provisional typography (P-04, P-14, D-038, D-042): replace when the store defines it. */
export const TEXT_FONT_FAMILY = FONT_STACKS['sans-serif'];
/** Preview color while no lettering color is chosen; never a product color. */
export const TEXT_COLOR = FALLBACK_TEXT_COLOR;

/** Highest device pixel ratio the backing store is sized for. */
export const MAX_PIXEL_RATIO = 3;

/**
 * Backing-store width in pixels: the displayed width times the device pixel
 * ratio, but never more than the base image's own width, since extra pixels
 * would only upscale the photograph. Unknown display width → the image's width.
 */
export function chooseBackingWidth(
  cssWidth: number,
  pixelRatio: number,
  naturalWidth: number,
): number {
  if (!(cssWidth > 0)) return naturalWidth;
  const ratio = Math.min(Math.max(pixelRatio, 1), MAX_PIXEL_RATIO);
  return Math.max(1, Math.min(Math.round(cssWidth * ratio), naturalWidth));
}

export function fontFor(fontSize: number, family: FontFamily = 'sans-serif'): string {
  return `${fontSize}px ${FONT_STACKS[family]}`;
}

/** Text measurer backed by an offscreen canvas; falls back to a rough estimate without one. */
export function createTextMeasurer(family: FontFamily = 'sans-serif'): MeasureText {
  const ctx = document.createElement('canvas').getContext('2d');
  return (text, fontSize) => {
    if (ctx === null) return text.length * fontSize * 0.55;
    ctx.font = fontFor(fontSize, family);
    return ctx.measureText(text).width;
  };
}

const TEXT_ANCHOR = { left: 0, center: 0.5, right: 1 } as const;

/** Paints `scene` scaled so its logical width spans `pixelWidth` canvas pixels. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene<CanvasImageSource & ImageSize>,
  pixelWidth: number,
): void {
  const scale = pixelWidth / scene.width;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (const layer of scene.layers) {
    if (layer.kind === 'image') {
      const { x, y, width, height } = layer.rect;
      ctx.drawImage(layer.image, x, y, width, height);
      continue;
    }
    const { lines, segments, fontFamily, fontSize, lineHeight, align, bounds } = layer.block;
    ctx.font = fontFor(fontSize, fontFamily);
    ctx.textBaseline = 'middle';
    // Lines are aligned inside the block; the block itself is placed by the scene (D-044).
    const x = bounds.x + bounds.width * TEXT_ANCHOR[align];
    const top = bounds.y;
    lines.forEach((line, index) => {
      const y = top + (index + 0.5) * lineHeight;
      const runs = segments[index] ?? [{ text: line, color: FALLBACK_TEXT_COLOR }];
      const [only] = runs;
      if (runs.length === 1 && only !== undefined) {
        // One color: let the canvas align the whole line.
        ctx.fillStyle = only.color;
        ctx.textAlign = align;
        ctx.fillText(line, x, y);
        return;
      }
      // Mixed colors: lay the runs out left to right from the aligned start of the line.
      const widths = runs.map((run) => ctx.measureText(run.text).width);
      const total = widths.reduce((sum, width) => sum + width, 0);
      let cursor = x - total * TEXT_ANCHOR[align];
      ctx.textAlign = 'left';
      runs.forEach((run, runIndex) => {
        ctx.fillStyle = run.color;
        ctx.fillText(run.text, cursor, y);
        cursor += widths[runIndex] ?? 0;
      });
    });
  }
}
