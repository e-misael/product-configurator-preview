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

/** Accepts `unknown` so malformed runtime data is rejected, not coerced. */
export function isValidCatalogId(id: unknown): boolean {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

/** Maps each ID to its first occurrence; later duplicates never overwrite it. */
function indexFirstById<T extends { readonly id: string }>(
  items: readonly T[],
  collection: string,
): Map<string, { item: T; path: string }> {
  const index = new Map<string, { item: T; path: string }>();
  items.forEach((item, i) => {
    if (!index.has(item.id)) index.set(item.id, { item, path: `${collection}[${i}]` });
  });
  return index;
}

export function validateCatalog(catalog: Catalog): CatalogValidationResult {
  const issues: CatalogIssue[] = [];

  // `id` is typed as string but may be malformed at runtime; only strings are reported (D-019).
  function report(code: CatalogIssueCode, path: string, id: unknown, relatedPath?: string) {
    issues.push({
      code,
      path,
      ...(typeof id === 'string' && { id }),
      ...(relatedPath !== undefined && { relatedPath }),
    });
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

  const colorsById = indexFirstById(catalog.colors, 'colors');
  const platesById = indexFirstById(catalog.plates, 'plates');

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
      const color = colorsById.get(colorId)?.item;
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
      // Each referenced plate is evaluated independently (D-022).
      restrictedTo.forEach((plateId, j) => {
        const refPath = `${path}.compatibility.plateIds[${j}]`;
        const target = platesById.get(plateId);
        if (target === undefined) {
          report('unknown-reference', refPath, frame.id);
        } else if (
          // Empty lists are already reported as `empty-list`.
          shapes.length > 0 &&
          target.item.supportedShapes.length > 0 &&
          !shapes.some((shape) => target.item.supportedShapes.includes(shape))
        ) {
          report('unreachable-compatibility', refPath, frame.id, target.path);
        }
      });
    }
    checkAssets(frame.assets, shapes, `${path}.assets`, frame.id);
  });

  return issues.length === 0 ? { status: 'valid' } : { status: 'invalid', issues };
}
