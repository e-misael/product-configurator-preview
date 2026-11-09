/**
 * Debossed lettering (D-052, treatment B of D-072): a subtle inner shadow
 * along the top inside edge of each glyph, as if the letters were engraved
 * into the ceramic. No highlight. The lettering color itself is painted by
 * the caller and stays dominant; this module only adds shading, and only
 * inside the glyphs.
 *
 * Technique, all on offscreen canvases in device pixels:
 * 1. an inverse mask: an opaque sheet with the glyph runs cut out;
 * 2. a layer twice as wide as the mask: the mask is drawn in its right half
 *    with a shadow offset by one mask width, so the blurred shadow lands in
 *    the left half, shifted down. Everything stays
 *    on the canvas: WebKit drops shadows of images drawn fully off-canvas;
 * 3. the mask itself, drawn over the left half with `destination-out`, removes
 *    the shading wherever there is no glyph and scales it by the antialiased
 *    coverage elsewhere. One draw for all lines and colors: per-call
 *    `destination-in` would erase earlier runs;
 * 4. the left half is drawn over the already painted lettering.
 * No pixel without glyph coverage is ever changed. No `ctx.filter` (absent in
 * Safari), no drop shadow, stroke, or halo.
 */

import { fillSpacedText } from './letter-spacing';

/** One left-aligned run of glyphs to shade, in the scene's logical units. */
export interface GlyphRun {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  /** Letter spacing after each grapheme (D-072). */
  readonly spacing: number;
}

/** Effect strength: offset and blur as fractions of the font size, and the shadow's opacity. */
export interface DebossStyle {
  readonly offset: number;
  readonly blur: number;
  readonly shadow: number;
}

/**
 * Treatment B (D-072): in the comparison it kept about 95% of glyph pixels
 * within ΔE 5 of the chosen color, against about 80% for the previous
 * shadow-and-highlight effect. Not customer-adjustable.
 */
export const DEBOSS: DebossStyle = { offset: 0.012, blur: 0.012, shadow: 0.3 };

/** Below this font size in device pixels the effect is skipped, so small text stays clean. */
export const DEBOSS_MIN_FONT_PX = 9;

/** Layers are reused between frames up to this many pixels; larger ones (exports) are dropped after use. */
const REUSE_LIMIT_PX = 2048 * 2048;

interface Surface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
}

const pool: { layer?: Surface; mask?: Surface } = {};

/**
 * A cleared offscreen surface of at least `width` × `height`, reused between
 * frames. `exact` sizes the canvas exactly: WebKit casts no shadow when a
 * sub-rectangle of a larger canvas is drawn, so the shadow source is drawn whole.
 */
function surface(
  key: 'layer' | 'mask',
  width: number,
  height: number,
  exact = false,
): Surface | undefined {
  const reuse = width * height <= REUSE_LIMIT_PX;
  let entry = reuse ? pool[key] : undefined;
  if (entry === undefined) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx === null) return undefined;
    entry = { canvas, ctx };
    if (reuse) pool[key] = entry;
  }
  if (exact) {
    // Unchanged while the text is dragged; resized when the block changes size.
    if (entry.canvas.width !== width) entry.canvas.width = width;
    if (entry.canvas.height !== height) entry.canvas.height = height;
  } else {
    // Grow in steps so typing does not reallocate on every keystroke.
    if (entry.canvas.width < width) entry.canvas.width = Math.ceil(width / 128) * 128;
    if (entry.canvas.height < height) entry.canvas.height = Math.ceil(height / 128) * 128;
  }
  const { ctx } = entry;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);
  return entry;
}

function fillRuns(ctx: CanvasRenderingContext2D, runs: readonly GlyphRun[]): void {
  for (const run of runs) fillSpacedText(ctx, run.text, run.x, run.y, run.spacing);
}

/**
 * Shades `runs` on `target`, whose transform maps logical units to device
 * pixels with a uniform `scale`. `region` (logical units) must contain the
 * glyphs; anything outside it is left unshaded, never shaded outside.
 */
export function paintDeboss(
  target: CanvasRenderingContext2D,
  runs: readonly GlyphRun[],
  font: string,
  fontSize: number,
  scale: number,
  region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  style: DebossStyle = DEBOSS,
): void {
  const fontPx = fontSize * scale;
  if (runs.length === 0 || fontPx < DEBOSS_MIN_FONT_PX) return;
  // Canvas shadows ignore the transform, so offset and blur are in device pixels.
  const offset = Math.max(0.5, fontPx * style.offset);
  const blur = Math.max(0.5, fontPx * style.blur);
  const pad = Math.ceil(offset + blur * 2) + 2;
  const left = Math.floor(region.x * scale) - pad;
  const top = Math.floor(region.y * scale) - pad;
  const width = Math.ceil(region.width * scale) + pad * 2;
  const height = Math.ceil(region.height * scale) + pad * 2;
  const layer = surface('layer', width * 2, height);
  const mask = surface('mask', width, height, true);
  if (layer === undefined || mask === undefined) return;

  const glyphs = (ctx: CanvasRenderingContext2D) => {
    ctx.setTransform(scale, 0, 0, scale, -left, -top);
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    fillRuns(ctx, runs);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const m = mask.ctx;
  m.fillStyle = '#000';
  m.fillRect(0, 0, width, height);
  m.globalCompositeOperation = 'destination-out';
  glyphs(m);
  m.globalCompositeOperation = 'source-over';

  const l = layer.ctx;
  l.save();
  l.shadowColor = `rgba(0, 0, 0, ${style.shadow})`;
  l.shadowBlur = blur;
  l.shadowOffsetX = -width;
  l.shadowOffsetY = offset;
  l.drawImage(mask.canvas, width, 0);
  l.restore();
  l.globalCompositeOperation = 'destination-out';
  l.drawImage(mask.canvas, 0, 0);
  l.globalCompositeOperation = 'source-over';

  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.drawImage(layer.canvas, 0, 0, width, height, left, top, width, height);
  target.restore();
}
