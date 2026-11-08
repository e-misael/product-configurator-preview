import { getCatalog } from '../../../src/catalog';
import { demoCatalog } from '../../../src/demo/demo-catalog';
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
      ['bandeja-ondulada-m-8', 'Bandeja ondulada M', '8 × 8 cm', 'scalloped'],
      ['bandeja-ondulada-g-11', 'Bandeja ondulada G', '11 × 11 cm', 'scalloped'],
    ]);
    expect(Object.keys(getCatalog())).toEqual(['plates', 'textColors', 'defaultTextColorId']);
  });

  it('starts with Marrom selected, an available color (D-064)', () => {
    const catalog = getCatalog();
    expect(catalog.defaultTextColorId).toBe('marrom');
    expect(
      catalog.textColors.find((color) => color.id === catalog.defaultTextColorId)?.displayName,
    ).toBe('Marrom');
  });

  it('lists exactly the four approved lettering colors, in order (D-056)', () => {
    expect(getCatalog().textColors).toEqual([
      { id: 'marrom', type: 'text-color', displayName: 'Marrom', hex: '#4a2a14' },
      { id: 'azul', type: 'text-color', displayName: 'Azul', hex: '#2b4a7a' },
      { id: 'verde', type: 'text-color', displayName: 'Verde', hex: '#2f4a36' },
      { id: 'vermelho-escuro', type: 'text-color', displayName: 'Vermelho escuro', hex: '#7a1f1f' },
    ]);
  });

  it('contains no demo-only, pending, or excluded colors (D-028, D-056)', () => {
    const colors = getCatalog().textColors;
    const demoIds = new Set(demoCatalog.textColors.map((color) => color.id));
    for (const color of colors) {
      expect(color.id).not.toMatch(/demo/);
      expect(color.displayName).not.toMatch(/demonstração|proposta/i);
      expect(demoIds.has(color.id)).toBe(false);
    }
    // Amarelo queimado is pending visual approval; Laranja is excluded for now.
    expect(colors.map((color) => color.id)).not.toContain('amarelo-queimado');
    expect(colors.map((color) => color.displayName.toLowerCase()).join(' ')).not.toMatch(
      /amarelo|laranja/,
    );
  });

  it('records the confirmed outer dimensions; every model is Bege and has a photograph', () => {
    const { plates } = getCatalog();
    expect(plates.map(({ id, dimensions }) => [id, dimensions])).toEqual([
      ['placa-ceramica-10', { status: 'defined', widthMm: 100, heightMm: 100 }],
      // The frame's outside; the ceramic inside is 100 × 100 mm.
      ['quadro-20', { status: 'defined', widthMm: 200, heightMm: 200 }],
      ['bandeja-ondulada-m-8', { status: 'defined', widthMm: 80, heightMm: 80 }],
      ['bandeja-ondulada-g-11', { status: 'defined', widthMm: 110, heightMm: 110 }],
    ]);
    for (const plate of plates) {
      expect(plate.ceramicColor).toBe('Bege');
      expect(plate.image?.text?.fontSize).toBeGreaterThan(0);
    }
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
        fontSize: 0.0837,
      },
    });
  });

  it('registers the assembled Quadro with its text area on the ceramic only (M1.3b-2)', () => {
    const quadro = getCatalog().plates.find((plate) => plate.id === 'quadro-20');

    expect(quadro?.image).toEqual({
      image: {
        src: '/catalog/plates/quadro-20/bege.jpg',
        alt: 'Quadro: placa cerâmica bege em moldura de madeira, sem texto',
        widthPx: 660,
        heightPx: 660,
      },
      objectBounds: { x: 0.0364, y: 0.0318, width: 0.9273, height: 0.9364 },
      text: {
        area: { x: 0.3009, y: 0.3494, width: 0.3589, height: 0.3589 },
        align: 'center',
        fontSize: 0.0424,
      },
    });
    // The ceramic spans 282 of 660 px (x 176–458, y 208–490): the text area stays inside it.
    const area = quadro?.image?.text?.area;
    const ceramic = { x: 176 / 660, y: 208 / 660, width: 282 / 660, height: 282 / 660 };
    expect(area?.x).toBeGreaterThan(ceramic.x);
    expect(area?.y).toBeGreaterThan(ceramic.y);
    expect((area?.x ?? 1) + (area?.width ?? 1)).toBeLessThan(ceramic.x + ceramic.width);
    expect((area?.y ?? 1) + (area?.height ?? 1)).toBeLessThan(ceramic.y + ceramic.height);
  });

  it('gives Bandeja M and G one photograph and placement but their own lettering sizes (D-054)', () => {
    const find = (id: string) => getCatalog().plates.find((plate) => plate.id === id)?.image;
    const m = find('bandeja-ondulada-m-8');
    const g = find('bandeja-ondulada-g-11');

    expect(m).toEqual({
      image: {
        src: '/catalog/plates/bandeja-ondulada-m-8/bege.jpg',
        alt: 'Bandeja ondulada bege, sem texto',
        widthPx: 1060,
        heightPx: 1060,
      },
      objectBounds: { x: 0.0283, y: 0.0387, width: 0.9425, height: 0.9226 },
      text: {
        area: { x: 0.28, y: 0.265, width: 0.43, height: 0.43 },
        align: 'center',
        fontSize: 0.117,
      },
    });
    // Same placement; each file stays in its own model's folder.
    expect(g?.objectBounds).toEqual(m?.objectBounds);
    expect(g?.text?.area).toEqual(m?.text?.area);
    expect(g?.image.src).toBe('/catalog/plates/bandeja-ondulada-g-11/bege.jpg');
    expect(g?.text?.fontSize).toBe(0.0851);
  });

  it.each([
    // Ceramic width as a fraction of the photograph, and its real width in mm.
    ['placa-ceramica-10', 0.8422, 100],
    // The 100 mm ceramic inside the frame (282 of 660 px), never the 200 mm frame.
    ['quadro-20', 282 / 660, 100],
    ['bandeja-ondulada-m-8', 0.9425, 80],
    ['bandeja-ondulada-g-11', 0.9425, 110],
  ])('sizes the %s lettering for a capital about 7 mm tall (D-055)', (id, ceramic, mm) => {
    const fontSize =
      getCatalog().plates.find((plate) => plate.id === id)?.image?.text?.fontSize ?? 0;
    // Cap height of the sans-serif stack is 0.7046 of the font size (measured, D-055).
    const capMm = (fontSize * 0.7046 * mm) / ceramic;
    expect(capMm).toBeGreaterThan(6.95);
    expect(capMm).toBeLessThan(7.05);
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
