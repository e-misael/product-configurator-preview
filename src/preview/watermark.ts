/**
 * Taavi signature (D-060): the official arch symbol and "© Taavi" on a light
 * pill at the bottom-right of every composition, preview and PNG alike. It
 * identifies Taavi's images and discourages their reuse by other stores; it
 * does not prevent copying. Drawn by `drawScene` from the scene's
 * `signature` layer, so every canvas size gets the same relative geometry.
 * There is no way to turn it off or move it.
 */

import markUrl from '../assets/brand/taavi-arch.png';
import { FONT_STACKS } from './text-style';

/** The official arch symbol, unmodified (docs/reference-images/logo/logo-taavi.png). */
export const WATERMARK_SRC: string = markUrl;

/** The visible mark inside the file, in its own pixels (1262 × 1246, transparent around it). */
export const MARK_INK = { x: 349, y: 223, width: 558, height: 734 } as const;

/**
 * Sizes are fractions of the scene's shorter side. The pill sits in the
 * photograph's bottom-right corner, below and right of every model's text
 * area (the lowest ends at 0.845 of the height), on the background or the
 * Quadro's frame, never on the lettering.
 */
export const SIGNATURE = {
  text: '© Taavi',
  // 0.05 × 1.1 (M4.6 refinement).
  height: 0.055,
  margin: 0.022,
  /** Fractions of the pill height. */
  padding: 0.24,
  markHeight: 0.62,
  gap: 0.2,
  fontSize: 0.38,
  fontWeight: 500,
  fill: '#faf8f5',
  // Opacities: the first values × 0.8 (M4.6 refinement).
  fillAlpha: 0.64,
  ink: '#0d263f',
  inkAlpha: 0.72,
} as const;

export function signatureFont(fontSize: number): string {
  return `${SIGNATURE.fontWeight} ${fontSize}px ${FONT_STACKS['sans-serif']}`;
}

export interface SignatureBox {
  /** The pill. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Where the mark is drawn (its visible ink box). */
  readonly mark: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /** Left edge and vertical middle of the text, and its font size. */
  readonly text: { readonly x: number; readonly y: number; readonly fontSize: number };
}

/** Geometry for a scene of this size; `textWidth` measures the text at a font size. */
export function signatureBox(
  sceneWidth: number,
  sceneHeight: number,
  textWidth: (fontSize: number) => number,
): SignatureBox {
  const unit = Math.min(sceneWidth, sceneHeight);
  const height = SIGNATURE.height * unit;
  const padding = SIGNATURE.padding * height;
  const markHeight = SIGNATURE.markHeight * height;
  const markWidth = (markHeight * MARK_INK.width) / MARK_INK.height;
  const gap = SIGNATURE.gap * height;
  const fontSize = SIGNATURE.fontSize * height;
  // The pill's rounded ends need a little more room after the text than before the mark.
  const width = padding + markWidth + gap + textWidth(fontSize) + padding * 1.4;
  const x = sceneWidth - SIGNATURE.margin * unit - width;
  const y = sceneHeight - SIGNATURE.margin * unit - height;
  return {
    x,
    y,
    width,
    height,
    mark: {
      x: x + padding,
      y: y + (height - markHeight) / 2,
      width: markWidth,
      height: markHeight,
    },
    text: { x: x + padding + markWidth + gap, y: y + height / 2, fontSize },
  };
}
