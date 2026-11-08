/**
 * Canvas 2D painting of a scene (D-035). The only code that touches a canvas
 * context; export (export.ts) calls `drawScene` on another canvas so preview
 * and exported image come from the same path (D-008, D-009). Photographs are
 * never filtered, tinted, or blended: each image layer is the real image of its
 * variation. The lettering gets a debossed look inside its glyphs only (D-052).
 */

import type { FontFamily } from '../domain';
import { DEBOSS, paintDeboss, type DebossStyle, type GlyphRun } from './deboss';
import type { ImageSize, Scene, TextBlock } from './scene';
import type { MeasureText } from './text-fit';
import { FALLBACK_TEXT_COLOR, FONT_STACKS } from './text-style';

/** Provisional typography (P-04, P-14, D-038, D-042): replace when the store defines it. */
export const TEXT_FONT_FAMILY = FONT_STACKS['sans-serif'];
/** Preview color while no lettering color is chosen; never a product color. */
export const TEXT_COLOR = FALLBACK_TEXT_COLOR;

/** Opaque background of preview and export alike (D-008). */
export const CANVAS_BACKGROUND = '#ffffff';

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

interface ColoredRun extends GlyphRun {
  readonly color: string;
}

/**
 * Where each single-color run of a text block is painted. The lettering color
 * and the deboss shading both use these runs, so the shading lines up with
 * the glyphs exactly.
 */
function layoutRuns(ctx: CanvasRenderingContext2D, block: TextBlock): ColoredRun[] {
  const { lines, segments, lineHeight, align, bounds } = block;
  // Lines are aligned inside the block; the block itself is placed by the scene (D-044).
  const x = bounds.x + bounds.width * TEXT_ANCHOR[align];
  return lines.flatMap((line, index) => {
    const y = bounds.y + (index + 0.5) * lineHeight;
    const runs = segments[index] ?? [{ text: line, color: FALLBACK_TEXT_COLOR }];
    const [only] = runs;
    // One color: let the canvas align the whole line.
    if (runs.length === 1 && only !== undefined)
      return [{ text: line, x, y, align, color: only.color }];
    // Mixed colors: lay the runs out left to right from the aligned start of the line.
    const widths = runs.map((run) => ctx.measureText(run.text).width);
    const total = widths.reduce((sum, width) => sum + width, 0);
    let cursor = x - total * TEXT_ANCHOR[align];
    return runs.map((run, runIndex) => {
      const placed = { text: run.text, x: cursor, y, align: 'left' as const, color: run.color };
      cursor += widths[runIndex] ?? 0;
      return placed;
    });
  });
}

/**
 * Paints `scene` scaled so its logical width spans `pixelWidth` canvas pixels.
 * `deboss` is the lettering effect strength; preview and export both use the
 * default, `null` paints flat lettering (comparisons and tests only).
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene<CanvasImageSource & ImageSize>,
  pixelWidth: number,
  deboss: DebossStyle | null = DEBOSS,
): void {
  const scale = pixelWidth / scene.width;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.fillStyle = CANVAS_BACKGROUND;
  ctx.fillRect(0, 0, scene.width, scene.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (const layer of scene.layers) {
    if (layer.kind === 'image') {
      const { x, y, width, height } = layer.rect;
      ctx.drawImage(layer.image, x, y, width, height);
      continue;
    }
    const { block } = layer;
    const font = fontFor(block.fontSize, block.fontFamily);
    ctx.font = font;
    ctx.textBaseline = 'middle';
    const runs = layoutRuns(ctx, block);
    for (const run of runs) {
      ctx.fillStyle = run.color;
      ctx.textAlign = run.align;
      ctx.fillText(run.text, run.x, run.y);
    }
    if (deboss === null) continue;
    // Room around the block for glyphs that overhang their line box.
    const overhang = block.fontSize * 0.5;
    const { x, y, width, height } = block.bounds;
    const region = {
      x: x - overhang,
      y: y - overhang,
      width: width + overhang * 2,
      height: height + overhang * 2,
    };
    paintDeboss(ctx, runs, font, block.fontSize, scale, region, deboss);
  }
}

/** Dash pattern and stroke width of the overflow outline, in device pixels. */
export const OVERFLOW_OUTLINE = { dash: [6, 4], width: 2, color: '#1f1f1f', halo: '#ffffff' };

/**
 * Preview only (D-057): outlines the calibrated text area while the text
 * overflows it, so the customer sees how far the lettering runs past it. Drawn
 * over a painted scene; never part of `drawScene`, so an export never shows it
 * (an overflowing configuration cannot be exported anyway).
 */
export function drawOverflowOutline(
  ctx: CanvasRenderingContext2D,
  scene: Scene<CanvasImageSource & ImageSize>,
  pixelWidth: number,
): void {
  const text = scene.layers.find((layer) => layer.kind === 'text');
  if (text === undefined || !scene.notices.includes('text-overflow')) return;
  const scale = pixelWidth / scene.width;
  const { x, y, width, height } = text.block.area;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const rect = [x * scale, y * scale, width * scale, height * scale] as const;
  // A light halo under dark dashes keeps the outline visible on any ceramic.
  ctx.lineWidth = OVERFLOW_OUTLINE.width + 2;
  ctx.strokeStyle = OVERFLOW_OUTLINE.halo;
  ctx.setLineDash([]);
  ctx.strokeRect(...rect);
  ctx.lineWidth = OVERFLOW_OUTLINE.width;
  ctx.strokeStyle = OVERFLOW_OUTLINE.color;
  ctx.setLineDash(OVERFLOW_OUTLINE.dash);
  ctx.strokeRect(...rect);
  ctx.restore();
}
