import type { Catalog } from '../domain';

/**
 * The product catalog: the source of truth for available components.
 *
 * Intentionally empty until real product information is provided.
 * Do not add invented plates, frames, colors, dimensions, or assets.
 */
export const catalog: Catalog = Object.freeze({
  plates: Object.freeze([]),
  frames: Object.freeze([]),
  colors: Object.freeze([]),
});
