/**
 * Pure validation for configurations against a catalog.
 *
 * Every field is evaluated and reports at most one issue: the first failing
 * rule in a fixed precedence order (see docs/04-data-model.md).
 *
 * Validation only reports issues. It never replaces or corrects a user's
 * selection; any such behavior must be explicit and live elsewhere.
 */

import type {
  Catalog,
  Configuration,
  Frame,
  Plate,
  PlateColor,
  PlateShape,
  ValidationIssue,
  ValidationResult,
} from './types';

export function createEmptyConfiguration(): Configuration {
  return {
    plateId: null,
    frameId: null,
    colorCategory: null,
    colorId: null,
    text: '',
  };
}

export function findPlate(catalog: Catalog, id: string): Plate | undefined {
  return catalog.plates.find((plate) => plate.id === id);
}

export function findFrame(catalog: Catalog, id: string): Frame | undefined {
  return catalog.frames.find((frame) => frame.id === id);
}

export function findColor(catalog: Catalog, id: string): PlateColor | undefined {
  return catalog.colors.find((color) => color.id === id);
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

  if (config.colorCategory === null) {
    issues.push({ kind: 'missing', field: 'colorCategory' });
  } else if (
    plate !== undefined &&
    !plate.supportedColorCategories.includes(config.colorCategory)
  ) {
    issues.push({ kind: 'invalid', field: 'colorCategory', code: 'unsupported-by-plate' });
  }

  // A specific color is optional, but when provided it must be consistent.
  if (config.colorId !== null) {
    const color = findColor(catalog, config.colorId);
    if (color === undefined) {
      issues.push({ kind: 'invalid', field: 'colorId', code: 'unknown-reference' });
    } else if (!isAvailable(color)) {
      issues.push({ kind: 'invalid', field: 'colorId', code: 'unavailable' });
    } else if (config.colorCategory !== null && color.category !== config.colorCategory) {
      issues.push({ kind: 'invalid', field: 'colorId', code: 'category-mismatch' });
    } else if (plate !== undefined && !plate.supportedColorIds.includes(color.id)) {
      issues.push({ kind: 'invalid', field: 'colorId', code: 'unsupported-by-plate' });
    }
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

  if (issues.some((issue) => issue.kind === 'invalid')) {
    return { status: 'invalid', issues };
  }
  if (issues.length > 0) {
    return { status: 'incomplete', issues };
  }
  return { status: 'valid' };
}
