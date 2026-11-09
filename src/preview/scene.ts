/**
 * Scene layout (D-037): turns a composition and the state of its image files
 * into positioned layers in painting order, in "logical" units — the natural
 * pixel size of the base image. Pure: no DOM, canvas, or React; text widths
 * come from the `measure` function. `drawScene` (draw.ts) paints the result
 * for both the preview and the PNG export (D-008).
 *
 * Layer order (D-037, revised by D-046 and D-060): the model's photograph, the
 * text, then the Taavi signature. The signature's image is required: while it
 * loads nothing is drawn, and when it fails the scene says so and export is blocked.
 * The lettering font (D-072) is treated the same way while text is shown:
 * nothing is drawn while it loads; if it fails, the text is drawn with the
 * fallback font and export is blocked.
 */

import type { FontFamily, NormalizedBox, Plate, TextAlignment } from '../domain';
import type { Composition, PlateLayer, PreviewNoticeCode } from './composition';
import type { FontState } from './font-loading';
import { LETTERING_FONTS } from './lettering-fonts';
import { LINE_HEIGHT, layoutText, type MeasureText } from './text-fit';
import { FALLBACK_TEXT_COLOR, segmentLine, type TextSegment, type TextStyle } from './text-style';
import { WATERMARK_SRC } from './watermark';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What the layout needs to know about a loaded image. */
export interface ImageSize {
  readonly naturalWidth: number;
  readonly naturalHeight: number;
}

export type ImageState<I extends ImageSize = HTMLImageElement> =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly image: I };

export interface TextBlock {
  readonly lines: readonly string[];
  /** Per line, the single-color runs to draw (parallel to `lines`); colors follow source offsets. */
  readonly segments: readonly (readonly TextSegment[])[];
  readonly fontFamily: FontFamily;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly align: 'left' | 'center' | 'right';
  /** Calibrated text area (the safe area). */
  readonly area: Rect;
  /** Measured width of each line (parallel to `lines`). */
  readonly lineWidths: readonly number[];
  /** Block position as fractions of the free space (D-044); see `bounds`. */
  readonly x: number;
  readonly y: number;
  /** Free space around the block in the area on each axis; negative when the text overflows. */
  readonly slack: { readonly x: number; readonly y: number };
  /** Where the block is drawn: widest line × all lines. Used for drawing and hit testing. */
  readonly bounds: Rect;
  /** Lines beyond what the area holds at the fixed size; 0 when the text fits vertically. */
  readonly excessLines: number;
}

export type SceneLayer<I extends ImageSize> =
  | { readonly kind: 'image'; readonly image: I; readonly rect: Rect }
  | { readonly kind: 'text'; readonly block: TextBlock }
  /** The Taavi signature (D-060); geometry from `signatureBox`, painted last. */
  | { readonly kind: 'signature'; readonly image: I };

export interface Scene<I extends ImageSize = HTMLImageElement> {
  /** Logical size: the natural pixel size of the base image. Zero when nothing is drawn. */
  readonly width: number;
  readonly height: number;
  /** In painting order. Empty when there is nothing to show. */
  readonly layers: readonly SceneLayer<I>[];
  readonly notices: readonly PreviewNoticeCode[];
  /** Accessible description of the visible product images. */
  readonly description: string | undefined;
}

function scaleBox(box: NormalizedBox, width: number, height: number, origin: Rect): Rect {
  return {
    x: origin.x + box.x * width,
    y: origin.y + box.y * height,
    width: box.width * width,
    height: box.height * height,
  };
}

/**
 * Places the text block inside the area (D-044). The block is the widest line
 * by all lines; its position is that fraction of the free space on each axis,
 * so with free space it never leaves the area. Without free space (overflow)
 * it is placed by its position horizontally (the free space is then negative)
 * and centered vertically. The line alignment plays no part: it arranges the
 * lines inside the block (D-059), so changing it never moves the block.
 */
export function placeBlock(
  area: Rect,
  lineWidths: readonly number[],
  blockHeight: number,
  placement: { readonly align: TextAlignment; readonly x: number; readonly y: number },
): Pick<TextBlock, 'x' | 'y' | 'slack' | 'bounds'> {
  const width = Math.max(0, ...lineWidths);
  const slack = { x: area.width - width, y: area.height - blockHeight };
  const tx = placement.x;
  const ty = slack.y >= 0 ? placement.y : 0.5;
  return {
    x: placement.x,
    y: placement.y,
    slack,
    bounds: {
      x: area.x + tx * slack.x,
      y: area.y + ty * slack.y,
      width,
      height: blockHeight,
    },
  };
}

export function buildScene<I extends ImageSize>(
  composition: Composition,
  images: ReadonlyMap<string, ImageState<I>>,
  measure: MeasureText,
  font: FontState = 'loaded',
): Scene<I> {
  const notices = [...composition.notices];
  const empty = (): Scene<I> => ({
    width: 0,
    height: 0,
    layers: [],
    notices,
    description: undefined,
  });
  const { plate } = composition;
  if (plate === undefined) return empty();

  // Nothing is drawn until the photograph has settled, so the canvas never flashes a partial composition.
  const plateState = images.get(plate.src) ?? { status: 'loading' };
  if (plateState.status === 'loading') {
    notices.push('plate-image-loading');
    return empty();
  }
  if (plateState.status !== 'loaded') {
    notices.push('plate-image-error');
    return empty();
  }
  const markState = images.get(WATERMARK_SRC) ?? { status: 'loading' };
  if (markState.status === 'loading') {
    notices.push('plate-image-loading');
    return empty();
  }
  // Measured and drawn only with the loaded lettering font (D-072).
  if (composition.text !== undefined && font === 'loading') {
    notices.push('plate-image-loading');
    return empty();
  }
  // Without the signature the product is still shown, but it cannot be exported (D-060).
  if (markState.status !== 'loaded') notices.push('watermark-error');
  if (composition.text !== undefined && font === 'error') notices.push('font-error');
  const mark = markState.status === 'loaded' ? markState.image : undefined;

  return assemble(plate, plateState.image, mark, composition, notices, measure);
}

function assemble<I extends ImageSize>(
  plate: PlateLayer,
  plateImage: I,
  mark: I | undefined,
  composition: Composition,
  notices: PreviewNoticeCode[],
  measure: MeasureText,
): Scene<I> {
  const layers: SceneLayer<I>[] = [];
  const width = plateImage.naturalWidth;
  const height = plateImage.naturalHeight;
  const plateRect: Rect = { x: 0, y: 0, width, height };

  layers.push({ kind: 'image', image: plateImage, rect: plateRect });

  const { text } = composition;
  if (text !== undefined) {
    const area = scaleBox(text.area, plateRect.width, plateRect.height, plateRect);
    // Fixed lettering size (D-055): never depends on the text, its position, or the area.
    const fontSize = drawnFontSize(text.fontSize, text.fontFamily, plateRect.width);
    const fit = layoutText(text.text, area, fontSize, measure);
    if (fit.overflow) notices.push('text-overflow');
    const lineWidths = fit.lines.map((line) => measure(line, fit.fontSize));
    const style: TextStyle = {
      fontFamily: text.fontFamily,
      primaryColor: text.primaryColor ?? FALLBACK_TEXT_COLOR,
      secondary: text.secondary,
    };
    layers.push({
      kind: 'text',
      block: {
        lines: fit.lines,
        segments: fit.lines.map((line, index) => segmentLine(line, fit.starts[index] ?? 0, style)),
        fontFamily: text.fontFamily,
        fontSize: fit.fontSize,
        lineHeight: fit.lineHeight,
        align: text.align,
        area,
        lineWidths,
        excessLines: fit.excessLines,
        ...placeBlock(area, lineWidths, fit.lines.length * fit.lineHeight, text),
      },
    });
  }

  if (mark !== undefined) layers.push({ kind: 'signature', image: mark });

  return { width, height, layers, notices, description: plate.alt };
}

/**
 * Drawn lettering size in scene units: the catalog size (a fraction of the
 * image width) scaled so the font's capital keeps the calibrated height (D-055, D-072).
 */
export function drawnFontSize(fontSize: number, family: FontFamily, sceneWidth: number): number {
  return fontSize * sceneWidth * LETTERING_FONTS[family].sizeScale;
}

export interface TextFrame {
  /** Calibrated text area, in scene units. */
  readonly area: Rect;
  readonly fontSize: number;
  readonly lineHeight: number;
}

/**
 * The text area and fixed lettering size the scene gives `plate`'s photograph,
 * the same as `assemble` uses, whether or not any text is entered yet (D-063).
 * Undefined until the photograph is drawn, or without a calibrated area or
 * an approved lettering size.
 */
export function textFrameOf(
  plate: Plate | undefined,
  scene: { readonly width: number; readonly height: number },
  family: FontFamily,
): TextFrame | undefined {
  const layout = plate?.image?.text;
  if (layout?.fontSize === undefined || scene.width <= 0 || scene.height <= 0) return undefined;
  const plateRect: Rect = { x: 0, y: 0, width: scene.width, height: scene.height };
  const fontSize = drawnFontSize(layout.fontSize, family, scene.width);
  return {
    area: scaleBox(layout.area, scene.width, scene.height, plateRect),
    fontSize,
    lineHeight: fontSize * LINE_HEIGHT,
  };
}
