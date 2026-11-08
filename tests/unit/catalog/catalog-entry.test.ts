import { getCatalog } from '../../../src/catalog';
import { validateCatalog } from '../../../src/domain';
import { buildValidCatalog } from '../domain/catalog-fixtures';
import { expectDeeplyFrozen } from './expect-deeply-frozen';

// Exercise the real entry point with nested synthetic data instead of the
// production catalog's flat models.
vi.mock('../../../src/catalog/data', async () => {
  const { buildValidCatalog: build } = await import('../domain/catalog-fixtures');
  return { catalogData: build() };
});

describe('getCatalog with nested data', () => {
  it('exposes the definitions unchanged', () => {
    expect(getCatalog()).toEqual(buildValidCatalog());
  });

  it('deep-freezes every reachable object', () => {
    // Root, 2 collections, components, compatibility, dimensions.
    expect(expectDeeplyFrozen(getCatalog())).toBeGreaterThan(10);
  });

  it('returns the same instance on every call', () => {
    expect(getCatalog()).toBe(getCatalog());
  });

  it('passes catalog integrity validation', () => {
    expect(validateCatalog(getCatalog())).toEqual({ status: 'valid' });
  });
});
