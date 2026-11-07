/**
 * Pure validation for configurations against a catalog.
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
    shape: null,
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

export function isShapeSupported(plate: Plate, shape: PlateShape): boolean {
  return plate.supportedShapes.includes(shape);
}

/**
 * Declared compatibility only. A `true` result is not proof of physical fit
 * until real dimensions and mounting constraints exist.
 */
export function isFrameCompatible(frame: Frame, plate: Plate, shape: PlateShape): boolean {
  const { shapes, plateIds } = frame.compatibility;
  return shapes.includes(shape) && (plateIds === undefined || plateIds.includes(plate.id));
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

  if (config.shape === null) {
    issues.push({ kind: 'missing', field: 'shape' });
  } else if (plate !== undefined && !isShapeSupported(plate, config.shape)) {
    issues.push({ kind: 'invalid', field: 'shape', code: 'unsupported-by-plate' });
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

  // Frame is optional: `null` is a valid "no frame" choice.
  if (config.frameId !== null) {
    const frame = findFrame(catalog, config.frameId);
    if (frame === undefined) {
      issues.push({ kind: 'invalid', field: 'frameId', code: 'unknown-reference' });
    } else if (!isAvailable(frame)) {
      issues.push({ kind: 'invalid', field: 'frameId', code: 'unavailable' });
    } else if (config.shape !== null && !frame.compatibility.shapes.includes(config.shape)) {
      issues.push({ kind: 'invalid', field: 'frameId', code: 'incompatible-shape' });
    } else if (
      plate !== undefined &&
      config.shape !== null &&
      !isFrameCompatible(frame, plate, config.shape)
    ) {
      issues.push({ kind: 'invalid', field: 'frameId', code: 'incompatible-plate' });
    }
  }

  if (config.text.length === 0) {
    issues.push({ kind: 'missing', field: 'text' });
  } else if (config.text.trim().length === 0) {
    issues.push({ kind: 'invalid', field: 'text', code: 'whitespace-only' });
  }

  if (issues.some((issue) => issue.kind === 'invalid')) {
    return { status: 'invalid', issues };
  }
  if (issues.length > 0) {
    return { status: 'incomplete', issues };
  }
  return { status: 'valid' };
}
