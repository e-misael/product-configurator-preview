import { getCatalog } from '../../../src/catalog';
import { validateCatalog } from '../../../src/domain';
import { expectDeeplyFrozen } from './expect-deeply-frozen';

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
    expectDeeplyFrozen(catalog);
  });

  it('has a freeze assertion that detects unfrozen nested objects', () => {
    const partlyFrozen = Object.freeze({ plates: Object.freeze([{ supportedShapes: [] }]) });
    expect(() => expectDeeplyFrozen(partlyFrozen)).toThrow();
  });
});
