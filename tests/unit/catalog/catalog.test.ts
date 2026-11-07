import { getCatalog } from '../../../src/catalog';
import { validateCatalog } from '../../../src/domain';

/**
 * Catalog test gate (D-021): the production catalog must pass integrity
 * validation before it can be built or deployed.
 */
describe('production catalog', () => {
  it('passes catalog integrity validation', () => {
    expect(validateCatalog(getCatalog())).toEqual({ status: 'valid' });
  });

  it('contains no invented product data', () => {
    expect(getCatalog()).toEqual({ plates: [], frames: [], colors: [] });
  });

  it('returns the same deeply frozen instance on every call', () => {
    const catalog = getCatalog();

    expect(getCatalog()).toBe(catalog);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.plates)).toBe(true);
    expect(Object.isFrozen(catalog.frames)).toBe(true);
    expect(Object.isFrozen(catalog.colors)).toBe(true);
  });
});
