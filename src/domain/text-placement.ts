/**
 * Pure text-placement rules (D-044). Positions are fractions of the free
 * space around the text block inside the calibrated text area; see
 * `TextPlacement`. Nothing here knows about pixels or the canvas.
 */

import { TEXT_ALIGNMENTS } from './types';
import type { Catalog, Configuration, Plate, TextAlignment, TextPlacement } from './types';

/** Line alignment used when the catalog's text layout does not declare one. */
export const DEFAULT_TEXT_ALIGN: TextAlignment = 'center';

/** Where a block aligned this way sits by default: left edge, center, right edge. */
export const ALIGN_ANCHOR: Readonly<Record<TextAlignment, number>> = {
  left: 0,
  center: 0.5,
  right: 1,
};

/** Keyboard and directional-button steps (D-042): 2%, 10% with Shift. */
export const POSITION_STEP = 0.02;
export const LARGE_POSITION_STEP = 0.1;

export const PRESET_ROWS = ['top', 'middle', 'bottom'] as const;
export type PresetRow = (typeof PRESET_ROWS)[number];
export const PRESET_COLUMNS = TEXT_ALIGNMENTS;
export type PresetColumn = TextAlignment;

const ROW_Y: Readonly<Record<PresetRow, number>> = { top: 0, middle: 0.5, bottom: 1 };

/** Accepts `unknown` so malformed runtime data is rejected, not coerced. */
export function isValidPlacement(value: unknown): value is TextPlacement {
  if (typeof value !== 'object' || value === null) return false;
  const { align, x, y } = value as Record<string, unknown>;
  const inRange = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  return TEXT_ALIGNMENTS.includes(align as TextAlignment) && inRange(x) && inRange(y);
}

/** The catalog default: the catalog's line alignment, anchored to match, vertically centered. */
export function defaultPlacement(catalogAlign: TextAlignment = DEFAULT_TEXT_ALIGN): TextPlacement {
  return { align: catalogAlign, x: ALIGN_ANCHOR[catalogAlign], y: 0.5 };
}

/** The stored placement when valid, otherwise the catalog default. */
export function resolvePlacement(
  layout: TextPlacement | null,
  catalogAlign: TextAlignment = DEFAULT_TEXT_ALIGN,
): TextPlacement {
  return layout !== null && isValidPlacement(layout) ? layout : defaultPlacement(catalogAlign);
}

/** The line alignment the catalog declares for the model's photograph. */
export function catalogTextAlign(plate: Plate | undefined): TextAlignment {
  return plate?.image?.text?.align ?? DEFAULT_TEXT_ALIGN;
}

/** The placement in effect for a configuration (stored, or the selected model's default). */
export function effectivePlacement(config: Configuration, catalog: Catalog): TextPlacement {
  // Looked up directly (not via findPlate) so validation can import this module without a cycle.
  const plate = catalog.plates.find((candidate) => candidate.id === config.plateId);
  return resolvePlacement(config.textLayout, catalogTextAlign(plate));
}

/** A preset sets all three properties: the column's alignment and anchor, and the row (D-044). */
export function presetPlacement(row: PresetRow, column: PresetColumn): TextPlacement {
  return { align: column, x: ALIGN_ANCHOR[column], y: ROW_Y[row] };
}

export function matchesPreset(
  placement: TextPlacement,
  row: PresetRow,
  column: PresetColumn,
): boolean {
  const preset = presetPlacement(row, column);
  return placement.align === preset.align && placement.x === preset.x && placement.y === preset.y;
}

export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Rounded so repeated steps land exactly on 0.1, 0.5, … instead of drifting. */
const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** Moves the block by fractions of the free space; alignment is unchanged. */
export function nudgePlacement(placement: TextPlacement, dx: number, dy: number): TextPlacement {
  return {
    align: placement.align,
    x: round(clampUnit(placement.x + dx)),
    y: round(clampUnit(placement.y + dy)),
  };
}
