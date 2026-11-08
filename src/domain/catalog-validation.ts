/**
 * Pure integrity validation for catalog definitions.
 *
 * Reports every issue found, in a deterministic order (colors, plates,
 * frames; fields in definition order). It never repairs or filters data.
 * See docs/04-data-model.md and D-018.
 */

import { FRAMELESS_SHAPES, TEXT_ALIGNMENTS } from './types';
import type {
  AssetRef,
  Catalog,
  CatalogIssue,
  CatalogIssueCode,
  CatalogValidationResult,
  Dimensions,
  NormalizedBox,
} from './types';
import { isFrameCompatible } from './validation';

/** Lowercase kebab-case, e.g. `placa-quadrada-01` (D-019). */
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Accepts `unknown` so malformed runtime data is rejected, not coerced. */
export function isValidCatalogId(id: unknown): boolean {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

export type AssetOwner = 'plates' | 'frames' | 'colors';

/**
 * `/catalog/{owner}/{owner-id}/{name}.{webp|png|jpg}` with kebab-case
 * segments (D-031). Being an allowlist, it excludes external URLs, schemes
 * (`data:`, `javascript:`), traversal, query strings, and encoded characters.
 */
const ASSET_PATH_PATTERN =
  /^\/catalog\/(plates|frames|colors)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:webp|png|jpg)$/;

/** Whether `src` is a well-formed asset path inside the folder of the given owner. */
export function isValidAssetPath(src: unknown, owner: AssetOwner, ownerId: string): boolean {
  if (typeof src !== 'string') return false;
  const match = ASSET_PATH_PATTERN.exec(src);
  return match !== null && match[1] === owner && match[2] === ownerId;
}

/** Tolerance for floating-point sums such as `x + width`. */
const EPSILON = 1e-9;

function isValidBox(box: NormalizedBox): boolean {
  const { x, y, width, height } = box;
  return (
    [x, y, width, height].every(Number.isFinite) &&
    x >= 0 &&
    y >= 0 &&
    width > 0 &&
    height > 0 &&
    x + width <= 1 + EPSILON &&
    y + height <= 1 + EPSILON
  );
}

function isBoxInside(inner: NormalizedBox, outer: NormalizedBox): boolean {
  return (
    inner.x >= outer.x - EPSILON &&
    inner.y >= outer.y - EPSILON &&
    inner.x + inner.width <= outer.x + outer.width + EPSILON &&
    inner.y + inner.height <= outer.y + outer.height + EPSILON
  );
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

  function checkAsset(asset: AssetRef, path: string, owner: AssetOwner, id: string) {
    if (!isValidAssetPath(asset.src, owner, id)) {
      report('invalid-asset', `${path}.src`, id);
    }
    // Intrinsic size is optional, but both sides are declared together.
    if (asset.widthPx === undefined && asset.heightPx === undefined) return;
    for (const side of ['widthPx', 'heightPx'] as const) {
      const value = asset[side];
      if (!Number.isSafeInteger(value) || (value ?? 0) <= 0) {
        report('invalid-asset', `${path}.${side}`, id);
      }
    }
  }

  /** Reports a malformed box; returns whether it is usable for further checks. */
  function checkBox(box: NormalizedBox | undefined, path: string, id: string): boolean {
    if (box === undefined) return false;
    if (isValidBox(box)) return true;
    report('invalid-placement', path, id);
    return false;
  }

  /** Reports entries whose key repeats an earlier entry's key. */
  function checkVariationKeys(keys: readonly string[], path: string, id: string) {
    keys.forEach((key, index) => {
      const first = keys.indexOf(key);
      if (first !== index) {
        report('duplicate-variation', `${path}[${index}]`, id, `${path}[${first}]`);
      }
    });
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
    if (color.swatch !== undefined) {
      checkAsset(color.swatch, `${path}.swatch`, 'colors', color.id);
    }
  });

  catalog.plates.forEach((plate, i) => {
    const path = `plates[${i}]`;
    checkId(plate.id, path);
    if (plate.supportsFrame && FRAMELESS_SHAPES.includes(plate.shape)) {
      report('frame-capability-conflict', `${path}.supportsFrame`, plate.id);
    }
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
    checkDimensions(plate.dimensions, `${path}.dimensions`, plate.id);

    const images = plate.images ?? [];
    images.forEach((entry, j) => {
      const imagePath = `${path}.images[${j}]`;
      if (!plate.supportedColorCategories.includes(entry.colorCategory)) {
        report('unsupported-variation', `${imagePath}.colorCategory`, plate.id);
      }
      if (entry.colorId !== undefined) {
        const colorPath = `${imagePath}.colorId`;
        const color = colorsById.get(entry.colorId)?.item;
        if (color === undefined) {
          report('unknown-reference', colorPath, plate.id);
        } else if (color.category !== entry.colorCategory) {
          report('color-category-mismatch', colorPath, plate.id);
        } else if (!plate.supportedColorIds.includes(entry.colorId)) {
          report('unsupported-variation', colorPath, plate.id);
        }
      }
      checkAsset(entry.image, `${imagePath}.image`, 'plates', plate.id);
      const bounds = entry.objectBounds;
      const hasBounds = checkBox(bounds, `${imagePath}.objectBounds`, plate.id);
      if (entry.text !== undefined) {
        const areaPath = `${imagePath}.text.area`;
        const hasArea = checkBox(entry.text.area, areaPath, plate.id);
        if (hasArea && hasBounds && bounds && !isBoxInside(entry.text.area, bounds)) {
          report('invalid-placement', areaPath, plate.id, `${imagePath}.objectBounds`);
        }
        const { align } = entry.text;
        if (align !== undefined && !TEXT_ALIGNMENTS.includes(align)) {
          report('invalid-placement', `${imagePath}.text.align`, plate.id);
        }
      }
    });
    // One photograph per category/shade combination (D-032).
    checkVariationKeys(
      images.map((entry) => `${entry.colorCategory}|${entry.colorId ?? ''}`),
      `${path}.images`,
      plate.id,
    );
  });

  catalog.frames.forEach((frame, i) => {
    const path = `frames[${i}]`;
    const { shapes, plateIds: restrictedTo } = frame.compatibility;
    checkId(frame.id, path);
    checkList(shapes, `${path}.compatibility.shapes`, frame.id, true);
    shapes.forEach((shape, j) => {
      if (FRAMELESS_SHAPES.includes(shape)) {
        report('unsupported-frame-shape', `${path}.compatibility.shapes[${j}]`, frame.id);
      }
    });
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
          !target.item.supportsFrame ||
          // An empty shape list is already reported as `empty-list`.
          (shapes.length > 0 && !shapes.includes(target.item.shape))
        ) {
          report('unreachable-compatibility', refPath, frame.id, target.path);
        }
      });
    }

    const images = frame.images ?? [];
    images.forEach((entry, j) => {
      const imagePath = `${path}.images[${j}]`;
      const target = platesById.get(entry.plateId);
      if (target === undefined) {
        report('unknown-reference', `${imagePath}.plateId`, frame.id);
      } else if (!isFrameCompatible(frame, target.item)) {
        // Same rule as configuration validation: imagery only for offerable pairs.
        report('unreachable-compatibility', `${imagePath}.plateId`, frame.id, target.path);
      }
      checkAsset(entry.back, `${imagePath}.back`, 'frames', frame.id);
      if (entry.front !== undefined) {
        checkAsset(entry.front, `${imagePath}.front`, 'frames', frame.id);
      }
      checkBox(entry.platePlacement, `${imagePath}.platePlacement`, frame.id);
    });
    checkVariationKeys(
      images.map((entry) => entry.plateId),
      `${path}.images`,
      frame.id,
    );
  });

  return issues.length === 0 ? { status: 'valid' } : { status: 'invalid', issues };
}
