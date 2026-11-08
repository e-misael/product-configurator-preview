/**
 * Pure validation for configurations against a catalog.
 *
 * Every field is evaluated and reports at most one issue: the first failing
 * rule in a fixed precedence order (see docs/04-data-model.md).
 *
 * Validation only reports issues. It never replaces or corrects a user's
 * selection; any such behavior must be explicit and live elsewhere.
 */

import { FONT_FAMILIES } from './types';
import { areValidRanges } from './text-ranges';
import { isValidPlacement } from './text-placement';
import type {
  Catalog,
  Configuration,
  Frame,
  Plate,
  PlateShape,
  TextColor,
  ValidationIssue,
  ValidationResult,
} from './types';

export function createEmptyConfiguration(): Configuration {
  return {
    plateId: null,
    frameId: null,
    text: '',
    fontFamily: 'sans-serif',
    textColorId: null,
    secondaryColorId: null,
    secondaryRanges: [],
    textLayout: null,
  };
}

export function findPlate(catalog: Catalog, id: string): Plate | undefined {
  return catalog.plates.find((plate) => plate.id === id);
}

export function findFrame(catalog: Catalog, id: string): Frame | undefined {
  return catalog.frames.find((frame) => frame.id === id);
}

export function findTextColor(catalog: Catalog, id: string): TextColor | undefined {
  return catalog.textColors.find((color) => color.id === id);
}

export function isAvailable(component: { readonly available?: boolean }): boolean {
  return component.available !== false;
}

/** The shape is a property of the plate model, never a separate selection (D-023). */
export function getPlateShape(catalog: Catalog, plateId: string): PlateShape | undefined {
  return findPlate(catalog, plateId)?.shape;
}

/**
 * Declared compatibility only. A `true` result is not proof of physical fit
 * until real dimensions and mounting constraints exist.
 */
export function isFrameCompatible(frame: Frame, plate: Plate): boolean {
  return (
    plate.supportsFrame &&
    frame.compatibility.shapes.includes(plate.shape) &&
    isFrameAllowedForPlate(frame, plate)
  );
}

/** Checks only the frame's optional plate restriction; independent of shape. */
export function isFrameAllowedForPlate(frame: Frame, plate: Plate): boolean {
  const { plateIds } = frame.compatibility;
  return plateIds === undefined || plateIds.includes(plate.id);
}

/**
 * Whitespace (Unicode `White_Space`, incl. line breaks and no-break spaces)
 * plus a narrow set of invisible formatting characters: U+200B ZERO WIDTH
 * SPACE, U+200C ZWNJ, U+200D ZWJ, U+2060 WORD JOINER, U+FEFF BOM.
 * See D-017.
 */
const BLANK_TEXT = /^[\p{White_Space}\u200B-\u200D\u2060\uFEFF]+$/u;

/** True when non-empty text has no visible content. Never modifies the text. */
export function isBlankText(text: string): boolean {
  return BLANK_TEXT.test(text);
}

export function validateConfiguration(config: Configuration, catalog: Catalog): ValidationResult {
  const issues: ValidationIssue[] = [];

  const plate = config.plateId === null ? undefined : findPlate(catalog, config.plateId);
  if (config.plateId === null) {
    issues.push({ kind: 'missing', field: 'plateId' });
  } else if (plate === undefined) {
    issues.push({ kind: 'invalid', field: 'plateId', code: 'unknown-reference' });
  } else if (!isAvailable(plate)) {
    issues.push({ kind: 'invalid', field: 'plateId', code: 'unavailable' });
  }

  // Frame is optional: `null` is a valid "no frame" choice. Plate-dependent
  // rules need a known plate; an unknown plate is already reported on plateId.
  if (config.frameId !== null) {
    const frame = findFrame(catalog, config.frameId);
    if (frame === undefined) {
      issues.push({ kind: 'invalid', field: 'frameId', code: 'unknown-reference' });
    } else if (!isAvailable(frame)) {
      issues.push({ kind: 'invalid', field: 'frameId', code: 'unavailable' });
    } else if (plate !== undefined && !plate.supportsFrame) {
      issues.push({ kind: 'invalid', field: 'frameId', code: 'frame-not-supported' });
    } else if (plate !== undefined && !frame.compatibility.shapes.includes(plate.shape)) {
      issues.push({ kind: 'invalid', field: 'frameId', code: 'incompatible-shape' });
    } else if (plate !== undefined && !isFrameAllowedForPlate(frame, plate)) {
      issues.push({ kind: 'invalid', field: 'frameId', code: 'incompatible-plate' });
    }
  }

  if (config.text.length === 0) {
    issues.push({ kind: 'missing', field: 'text' });
  } else if (isBlankText(config.text)) {
    issues.push({ kind: 'invalid', field: 'text', code: 'blank' });
  }

  // Font family: typed, but runtime data may carry anything.
  if (!FONT_FAMILIES.includes(config.fontFamily)) {
    issues.push({ kind: 'invalid', field: 'fontFamily', code: 'unsupported-font' });
  }

  // Lettering colors come from the catalog palette (D-042); there is no default.
  if (config.textColorId === null) {
    issues.push({ kind: 'missing', field: 'textColorId' });
  } else {
    const color = findTextColor(catalog, config.textColorId);
    if (color === undefined) {
      issues.push({ kind: 'invalid', field: 'textColorId', code: 'unknown-reference' });
    } else if (!isAvailable(color)) {
      issues.push({ kind: 'invalid', field: 'textColorId', code: 'unavailable' });
    }
  }

  if (config.secondaryColorId !== null) {
    const color = findTextColor(catalog, config.secondaryColorId);
    if (color === undefined) {
      issues.push({ kind: 'invalid', field: 'secondaryColorId', code: 'unknown-reference' });
    } else if (!isAvailable(color)) {
      issues.push({ kind: 'invalid', field: 'secondaryColorId', code: 'unavailable' });
    } else if (config.secondaryColorId === config.textColorId) {
      issues.push({ kind: 'invalid', field: 'secondaryColorId', code: 'same-as-primary' });
    }
  }

  if (config.secondaryRanges.length > 0) {
    if (config.secondaryColorId === null) {
      issues.push({ kind: 'invalid', field: 'secondaryRanges', code: 'ranges-without-color' });
    } else if (!areValidRanges(config.text, config.secondaryRanges)) {
      issues.push({ kind: 'invalid', field: 'secondaryRanges', code: 'invalid-ranges' });
    }
  }

  // Placement is raw user input; it is reported, never clamped (D-044).
  if (config.textLayout !== null && !isValidPlacement(config.textLayout)) {
    issues.push({ kind: 'invalid', field: 'textLayout', code: 'invalid-layout' });
  }

  if (issues.some((issue) => issue.kind === 'invalid')) {
    return { status: 'invalid', issues };
  }
  if (issues.length > 0) {
    return { status: 'incomplete', issues };
  }
  return { status: 'valid' };
}
