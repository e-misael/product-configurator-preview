/**
 * Pure integrity validation for catalog definitions.
 *
 * Reports every issue found, in a deterministic order (colors, plates,
 * frames; fields in definition order). It never repairs or filters data.
 * See docs/04-data-model.md and D-018.
 */

import type {
  AssetRef,
  Catalog,
  CatalogIssue,
  CatalogIssueCode,
  CatalogValidationResult,
  Dimensions,
  PlateShape,
} from './types';

/** Lowercase kebab-case, e.g. `placa-quadrada-01` (D-019). */
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidCatalogId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export function validateCatalog(catalog: Catalog): CatalogValidationResult {
  const issues: CatalogIssue[] = [];

  function report(code: CatalogIssueCode, path: string, id: string, relatedPath?: string) {
    issues.push(relatedPath === undefined ? { code, path, id } : { code, path, id, relatedPath });
  }

  function checkList(list: readonly string[], path: string, id: string, required: boolean) {
    if (required && list.length === 0) {
      report('empty-list', path, id);
    }
    list.forEach((value, index) => {
      const first = list.indexOf(value);
      if (first !== index) {
        report('duplicate-entry', `${path}[${index}]`, id, `${path}[${first}]`);
      }
    });
  }

  function checkShapeKeys(
    record: Readonly<Partial<Record<PlateShape, unknown>>>,
    supported: readonly PlateShape[],
    path: string,
    id: string,
  ) {
    for (const key of Object.keys(record)) {
      if (!supported.some((shape) => shape === key)) {
        report('unsupported-shape-key', `${path}.${key}`, id);
      }
    }
  }

  function checkAsset(asset: AssetRef, path: string, id: string) {
    if (asset.src.trim().length === 0) {
      report('invalid-asset', `${path}.src`, id);
    }
  }

  function checkAssets(
    assets: Readonly<Partial<Record<PlateShape, AssetRef>>> | undefined,
    supported: readonly PlateShape[],
    path: string,
    id: string,
  ) {
    if (assets === undefined) return;
    checkShapeKeys(assets, supported, path, id);
    for (const [shape, asset] of Object.entries(assets)) {
      if (asset !== undefined) checkAsset(asset, `${path}.${shape}`, id);
    }
  }

  function checkDimensions(dimensions: Dimensions, path: string, id: string) {
    if (dimensions.status !== 'defined') return;
    for (const side of ['widthMm', 'heightMm'] as const) {
      const value = dimensions[side];
      if (!Number.isFinite(value) || value <= 0) {
        report('invalid-dimension', `${path}.${side}`, id);
      }
    }
  }

  // IDs must be valid and unique across the whole catalog (D-019).
  const firstPathById = new Map<string, string>();
  function checkId(id: string, path: string) {
    if (!isValidCatalogId(id)) {
      report('invalid-id', `${path}.id`, id);
    }
    const firstPath = firstPathById.get(id);
    if (firstPath === undefined) {
      firstPathById.set(id, path);
    } else {
      report('duplicate-id', `${path}.id`, id, `${firstPath}.id`);
    }
  }

  const colorsById = new Map(catalog.colors.map((color) => [color.id, color] as const));
  const plateIds = new Set(catalog.plates.map((plate) => plate.id));

  catalog.colors.forEach((color, i) => {
    const path = `colors[${i}]`;
    checkId(color.id, path);
    if (color.swatch !== undefined) checkAsset(color.swatch, `${path}.swatch`, color.id);
  });

  catalog.plates.forEach((plate, i) => {
    const path = `plates[${i}]`;
    checkId(plate.id, path);
    checkList(plate.supportedShapes, `${path}.supportedShapes`, plate.id, true);
    checkList(plate.supportedColorCategories, `${path}.supportedColorCategories`, plate.id, true);
    checkList(plate.supportedColorIds, `${path}.supportedColorIds`, plate.id, false);
    plate.supportedColorIds.forEach((colorId, j) => {
      const refPath = `${path}.supportedColorIds[${j}]`;
      const color = colorsById.get(colorId);
      if (color === undefined) {
        report('unknown-reference', refPath, plate.id);
      } else if (!plate.supportedColorCategories.includes(color.category)) {
        report('color-category-mismatch', refPath, plate.id);
      }
    });
    checkShapeKeys(plate.dimensions, plate.supportedShapes, `${path}.dimensions`, plate.id);
    for (const [shape, dimensions] of Object.entries(plate.dimensions)) {
      if (dimensions !== undefined) {
        checkDimensions(dimensions, `${path}.dimensions.${shape}`, plate.id);
      }
    }
    checkAssets(plate.assets, plate.supportedShapes, `${path}.assets`, plate.id);
  });

  catalog.frames.forEach((frame, i) => {
    const path = `frames[${i}]`;
    const { shapes, plateIds: restrictedTo } = frame.compatibility;
    checkId(frame.id, path);
    checkList(shapes, `${path}.compatibility.shapes`, frame.id, true);
    if (restrictedTo !== undefined) {
      // Omitted means "no plate restriction"; an empty list would fit no plate (D-018).
      checkList(restrictedTo, `${path}.compatibility.plateIds`, frame.id, true);
      restrictedTo.forEach((plateId, j) => {
        if (!plateIds.has(plateId)) {
          report('unknown-reference', `${path}.compatibility.plateIds[${j}]`, frame.id);
        }
      });
    }
    checkAssets(frame.assets, shapes, `${path}.assets`, frame.id);
  });

  return issues.length === 0 ? { status: 'valid' } : { status: 'invalid', issues };
}
