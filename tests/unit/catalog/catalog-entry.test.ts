import { getCatalog } from '../../../src/catalog';
import { validateCatalog } from '../../../src/domain';
import { buildValidCatalog } from '../domain/catalog-fixtures';
import { expectDeeplyFrozen } from './expect-deeply-frozen';

// Exercise the real entry point with nested synthetic data instead of the
// (currently empty) production catalog.
vi.mock('../../../src/catalog/data', async () => {
  const { buildValidCatalog: build } = await import('../domain/catalog-fixtures');
  return { catalogData: build() };
});

describe('getCatalog with nested data', () => {
  it('exposes the definitions unchanged', () => {
    expect(getCatalog()).toEqual(buildValidCatalog());
  });

  it('deep-freezes every reachable object', () => {
    // Root, 3 collections, components, lists, compatibility, dimensions, assets.
    expect(expectDeeplyFrozen(getCatalog())).toBeGreaterThan(20);
  });

  it('returns the same instance on every call', () => {
    expect(getCatalog()).toBe(getCatalog());
  });

  it('passes catalog integrity validation', () => {
    expect(validateCatalog(getCatalog())).toEqual({ status: 'valid' });
  });
});
