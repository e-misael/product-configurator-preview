import type { Catalog } from '../domain';

/**
 * Raw catalog definitions. Access the catalog through `getCatalog()`
 * (src/catalog/index.ts), never by importing this module directly.
 *
 * Intentionally empty until real product information is provided.
 * Do not add invented plates, frames, colors, dimensions, or assets.
 * Every change must keep `validateCatalog` passing (tests/unit/catalog).
 */
export const catalogData: Catalog = {
  plates: [],
  frames: [],
  colors: [],
};
