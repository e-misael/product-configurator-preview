/**
 * Pure pointer geometry for moving the text block (D-044): converting a
 * pointer position on the displayed canvas to scene ("logical") units, hit
 * testing the text block, and turning a drag into a new block position.
 * The canvas is drawn at a different pixel size than it is displayed, so all
 * conversions go through the displayed rectangle.
 */

import { clampUnit } from '../domain';
import type { ImageSize, Rect, Scene, TextBlock } from './scene';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The displayed canvas box, as `getBoundingClientRect` reports it. */
export interface DisplayRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Extra margin, in CSS pixels, around the text block that still counts as a hit. */
export const HIT_TOLERANCE_PX = 8;

export function textBlockOf<I extends ImageSize>(scene: Scene<I>): TextBlock | undefined {
  for (const layer of scene.layers) {
    if (layer.kind === 'text') return layer.block;
  }
  return undefined;
}

export function toLogical(
  clientX: number,
  clientY: number,
  display: DisplayRect,
  scene: { readonly width: number; readonly height: number },
): Point {
  const sx = display.width > 0 ? scene.width / display.width : 0;
  const sy = display.height > 0 ? scene.height / display.height : 0;
  return { x: (clientX - display.left) * sx, y: (clientY - display.top) * sy };
}

export function hitsBlock(bounds: Rect, point: Point, tolerance: number): boolean {
  return (
    point.x >= bounds.x - tolerance &&
    point.x <= bounds.x + bounds.width + tolerance &&
    point.y >= bounds.y - tolerance &&
    point.y <= bounds.y + bounds.height + tolerance
  );
}

/** Rounded to 0.01% so stored positions stay readable. */
const round = (value: number) => Math.round(value * 1e4) / 1e4;

/**
 * The block position after dragging by `delta` scene units from `start`.
 * Each axis moves by the fraction of its free space the pointer travelled;
 * an axis without free space does not move. Line alignment is not touched.
 */
export function dragPosition(
  start: Point,
  slack: { readonly x: number; readonly y: number },
  delta: Point,
): Point {
  const axis = (from: number, room: number, by: number) =>
    room > 0 ? round(clampUnit(from + by / room)) : from;
  return { x: axis(start.x, slack.x, delta.x), y: axis(start.y, slack.y, delta.y) };
}
