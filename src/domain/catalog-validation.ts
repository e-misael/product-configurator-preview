/**
 * Pure integrity validation for catalog definitions.
 *
 * Reports every issue found, in a deterministic order (plates, then text
 * colors; fields in definition order). It never repairs or filters data.
 * See docs/04-data-model.md and D-018.
 */

import { TEXT_ALIGNMENTS } from './types';
import type {
  AssetRef,
  Catalog,
  CatalogIssue,
  CatalogIssueCode,
  CatalogValidationResult,
  Dimensions,
  NormalizedBox,
} from './types';

/** Lowercase kebab-case, e.g. `placa-ceramica-10` (D-019). */
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Accepts `unknown` so malformed runtime data is rejected, not coerced. */
export function isValidCatalogId(id: unknown): boolean {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

/**
 * `/catalog/plates/{owner-id}/{name}.{webp|png|jpg}` with kebab-case
 * segments (D-031, D-046). Being an allowlist, it excludes external URLs, schemes
 * (`data:`, `javascript:`), traversal, query strings, and encoded characters.
 */
const ASSET_PATH_PATTERN =
  /^\/catalog\/plates\/([a-z0-9]+(?:-[a-z0-9]+)*)\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:webp|png|jpg)$/;

/** Whether `src` is a well-formed asset path inside the folder of the given model. */
export function isValidAssetPath(src: unknown, ownerId: string): boolean {
  if (typeof src !== 'string') return false;
  const match = ASSET_PATH_PATTERN.exec(src);
  return match !== null && match[1] === ownerId;
}

/** Lettering colors are `#rrggbb`. */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

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

  function checkAsset(asset: AssetRef, path: string, id: string) {
    if (!isValidAssetPath(asset.src, id)) {
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

  catalog.plates.forEach((plate, i) => {
    const path = `plates[${i}]`;
    checkId(plate.id, path);
    for (const label of ['sizeLabel', 'ceramicColor'] as const) {
      // Typed as strings but may be malformed at runtime; blank labels are never repaired.
      if (typeof plate[label] !== 'string' || plate[label].trim().length === 0) {
        report('empty-label', `${path}.${label}`, plate.id);
      }
    }
    checkDimensions(plate.dimensions, `${path}.dimensions`, plate.id);

    if (plate.image !== undefined) {
      const imagePath = `${path}.image`;
      checkAsset(plate.image.image, `${imagePath}.image`, plate.id);
      const bounds = plate.image.objectBounds;
      const hasBounds = checkBox(bounds, `${imagePath}.objectBounds`, plate.id);
      const { text } = plate.image;
      if (text !== undefined) {
        const areaPath = `${imagePath}.text.area`;
        const hasArea = checkBox(text.area, areaPath, plate.id);
        if (hasArea && hasBounds && bounds && !isBoxInside(text.area, bounds)) {
          report('invalid-placement', areaPath, plate.id, `${imagePath}.objectBounds`);
        }
        if (text.align !== undefined && !TEXT_ALIGNMENTS.includes(text.align)) {
          report('invalid-placement', `${imagePath}.text.align`, plate.id);
        }
      }
    }
  });

  catalog.textColors.forEach((color, i) => {
    const path = `textColors[${i}]`;
    checkId(color.id, path);
    if (typeof color.displayName !== 'string' || color.displayName.trim().length === 0) {
      report('empty-label', `${path}.displayName`, color.id);
    }
    if (typeof color.hex !== 'string' || !HEX_COLOR.test(color.hex)) {
      report('invalid-color', `${path}.hex`, color.id);
    }
  });

  return issues.length === 0 ? { status: 'valid' } : { status: 'invalid', issues };
}
