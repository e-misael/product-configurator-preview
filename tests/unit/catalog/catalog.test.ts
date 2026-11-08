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

  it('registers exactly the four supplied models (D-040, D-046) and nothing else', () => {
    const { plates } = getCatalog();

    expect(
      plates.map(({ id, displayName, sizeLabel, shape }) => [id, displayName, sizeLabel, shape]),
    ).toEqual([
      ['placa-ceramica-10', 'Placa cerâmica', '10 × 10 cm', 'square'],
      ['quadro-20', 'Quadro', '20 × 20 cm', 'square'],
      ['bandeja-ondulada-m-8', 'Bandeja ondulada M', 'Aprox. 8 cm', 'scalloped'],
      ['bandeja-ondulada-g-11', 'Bandeja ondulada G', 'Aprox. 11 cm', 'scalloped'],
    ]);
    expect(Object.keys(getCatalog())).toEqual(['plates', 'textColors']);
  });

  it('invents no lettering colors: the palette stays empty until Taavi supplies it', () => {
    expect(getCatalog().textColors).toEqual([]);
  });

  it('invents no dimensions or images; every model is Bege', () => {
    for (const plate of getCatalog().plates) {
      expect(plate.dimensions).toEqual({ status: 'pending' });
      expect(plate.image).toBeUndefined();
      expect(plate.ceramicColor).toBe('Bege');
    }
  });

  it('returns the same deeply frozen instance on every call', () => {
    const catalog = getCatalog();

    expect(getCatalog()).toBe(catalog);
    expectDeeplyFrozen(catalog);
  });

  it('has a freeze assertion that detects unfrozen nested objects', () => {
    const partlyFrozen = Object.freeze({
      plates: Object.freeze([{ shape: 'square', tags: [] }]),
    });
    expect(() => expectDeeplyFrozen(partlyFrozen)).toThrow();
  });
});
