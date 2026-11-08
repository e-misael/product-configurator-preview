/**
 * Pure text-placement rules (D-044, D-059). Positions are fractions of the
 * free space around the text block inside the calibrated text area; see
 * `TextPlacement`. Position and line alignment are independent (D-059): the
 * block is the widest line by all lines, placed by `x`/`y`; `align` arranges
 * the lines inside that block, so changing it never moves the block, and
 * placing the block never changes it. Nothing here knows about pixels or the canvas.
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
/** Preset columns are positions (left edge, center, right edge), not line alignments. */
export const PRESET_COLUMNS = ['left', 'center', 'right'] as const;
export type PresetColumn = (typeof PRESET_COLUMNS)[number];

const ROW_Y: Readonly<Record<PresetRow, number>> = { top: 0, middle: 0.5, bottom: 1 };
const COLUMN_X: Readonly<Record<PresetColumn, number>> = { left: 0, center: 0.5, right: 1 };

/** Accepts `unknown` so malformed runtime data is rejected, not coerced. */
export function isValidPlacement(value: unknown): value is TextPlacement {
  if (typeof value !== 'object' || value === null) return false;
  const { align, x, y } = value as Record<string, unknown>;
  const inRange = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  return TEXT_ALIGNMENTS.includes(align as TextAlignment) && inRange(x) && inRange(y);
}

/**
 * The catalog default: the catalog's line alignment, anchored to match, vertically
 * centered. Every current model declares `center`, so the default is the middle preset.
 */
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

/** Whether the model's lettering has one fixed placement (the Bandejas, D-068). */
export function isPlacementFixed(plate: Plate | undefined): boolean {
  return plate?.image?.text?.fixedPlacement === true;
}

/**
 * The placement in effect for `plate`: its fixed default, or the stored
 * placement. A fixed model ignores the stored placement without clearing it,
 * so it applies again on the next model that allows positioning (D-068).
 */
export function placementFor(
  layout: TextPlacement | null,
  plate: Plate | undefined,
): TextPlacement {
  const align = catalogTextAlign(plate);
  return isPlacementFixed(plate) ? defaultPlacement(align) : resolvePlacement(layout, align);
}

/** The placement in effect for a configuration (stored, or the selected model's default). */
export function effectivePlacement(config: Configuration, catalog: Catalog): TextPlacement {
  // Looked up directly (not via findPlate) so validation can import this module without a cycle.
  const plate = catalog.plates.find((candidate) => candidate.id === config.plateId);
  return placementFor(config.textLayout, plate);
}

/** A preset places the block only; the line alignment is kept (D-059, replacing D-047). */
export function presetPlacement(
  row: PresetRow,
  column: PresetColumn,
  align: TextAlignment,
): TextPlacement {
  return { align, x: COLUMN_X[column], y: ROW_Y[row] };
}

/** Whether the block sits at a preset position, whatever its line alignment. */
export function matchesPreset(
  placement: TextPlacement,
  row: PresetRow,
  column: PresetColumn,
): boolean {
  return placement.x === COLUMN_X[column] && placement.y === ROW_Y[row];
}

/** Changes the line alignment only; the block stays where it is (D-059). */
export function alignPlacement(placement: TextPlacement, align: TextAlignment): TextPlacement {
  return { align, x: placement.x, y: placement.y };
}

/**
 * "Redefinir posição": the catalog default position, keeping the chosen line
 * alignment. `null` (the catalog default) when the alignment is the catalog's too.
 */
export function resetPosition(
  placement: TextPlacement,
  catalogAlign: TextAlignment = DEFAULT_TEXT_ALIGN,
): TextPlacement | null {
  if (placement.align === catalogAlign) return null;
  const { x, y } = defaultPlacement(catalogAlign);
  return { align: placement.align, x, y };
}

/** Whether the block is away from the catalog default position. */
export function isDefaultPosition(
  placement: TextPlacement,
  catalogAlign: TextAlignment = DEFAULT_TEXT_ALIGN,
): boolean {
  const { x, y } = defaultPlacement(catalogAlign);
  return placement.x === x && placement.y === y;
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
