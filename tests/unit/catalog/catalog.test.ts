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

  it('invents no dimensions; every model is Bege; only the Placa has a photograph', () => {
    for (const plate of getCatalog().plates) {
      expect(plate.dimensions).toEqual({ status: 'pending' });
      expect(plate.ceramicColor).toBe('Bege');
    }
    expect(
      getCatalog()
        .plates.filter((plate) => plate.image)
        .map((plate) => plate.id),
    ).toEqual(['placa-ceramica-10']);
  });

  it('registers the Placa photograph with its measured, centered placement (M1.3b-1)', () => {
    const placa = getCatalog().plates.find((plate) => plate.id === 'placa-ceramica-10');

    expect(placa?.image).toEqual({
      image: {
        src: '/catalog/plates/placa-ceramica-10/bege.png',
        alt: 'Placa cerâmica quadrada bege, sem texto',
        widthPx: 640,
        heightPx: 640,
      },
      objectBounds: { x: 0.0781, y: 0.0891, width: 0.8422, height: 0.8219 },
      text: {
        area: { x: 0.145, y: 0.155, width: 0.71, height: 0.69 },
        align: 'center',
        fontSize: 0.08625,
      },
    });
  });

  it('fixes the Placa lettering at half its former starting size (D-055)', () => {
    const text = getCatalog().plates.find((plate) => plate.id === 'placa-ceramica-10')?.image?.text;
    // Former start: 25% of the text-area height (0.69 of the 640 px image) = 110.4 px.
    expect(text?.fontSize).toBeCloseTo(0.5 * 0.25 * 0.69, 10);
    expect((text?.fontSize ?? 0) * 640).toBeCloseTo(55.2, 10);
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
