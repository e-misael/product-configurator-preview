/**
 * Canvas 2D painting of a scene (D-035). The only code that touches a canvas
 * context; export (M4) will call `drawScene` on another canvas so preview and
 * exported image come from the same path. No CSS filters, tinting, or
 * blending: each layer is the real image of its variation.
 */

import type { ImageSize, Scene } from './scene';
import type { MeasureText } from './text-fit';

/** Provisional typography (P-04, D-038): replace when the store defines it. */
export const TEXT_FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const TEXT_COLOR = '#2b2b2b';

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

export function fontFor(fontSize: number): string {
  return `${fontSize}px ${TEXT_FONT_FAMILY}`;
}

/** Text measurer backed by an offscreen canvas; falls back to a rough estimate without one. */
export function createTextMeasurer(): MeasureText {
  const ctx = document.createElement('canvas').getContext('2d');
  return (text, fontSize) => {
    if (ctx === null) return text.length * fontSize * 0.55;
    ctx.font = fontFor(fontSize);
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
    const { lines, fontSize, lineHeight, align, area } = layer.block;
    ctx.font = fontFor(fontSize);
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const x = area.x + area.width * TEXT_ANCHOR[align];
    const top = area.y + (area.height - lines.length * lineHeight) / 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, x, top + (index + 0.5) * lineHeight);
    });
  }
}
