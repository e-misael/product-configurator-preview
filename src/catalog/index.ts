import type { Catalog } from '../domain';
import { catalogData } from './data';
import { deepFreeze } from './deep-freeze';

const catalog: Catalog = deepFreeze(catalogData);

/**
 * The product catalog: the single source of truth for available components.
 * Deeply frozen. Integrity is enforced by the catalog test gate (D-021),
 * not at runtime.
 */
export function getCatalog(): Catalog {
  return catalog;
}
