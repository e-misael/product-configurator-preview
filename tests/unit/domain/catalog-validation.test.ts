import {
  isValidCatalogId,
  validateCatalog,
  type Catalog,
  type CatalogIssue,
  type CatalogValidationResult,
  type Plate,
} from '../../../src/domain';
import { at, buildValidCatalog } from './catalog-fixtures';
import { testCatalog } from './fixtures';

function issuesOf(result: CatalogValidationResult): readonly CatalogIssue[] {
  return result.status === 'valid' ? [] : result.issues;
}

/** Valid catalog with one component replaced by a modified copy. */
function withPlate(index: number, patch: Partial<Plate>): Catalog {
  const catalog = buildValidCatalog();
  return {
    ...catalog,
    plates: catalog.plates.map((p, i) => (i === index ? { ...p, ...patch } : p)),
  };
}

function expectOnly(catalog: Catalog, issue: CatalogIssue) {
  expect(validateCatalog(catalog)).toEqual({ status: 'invalid', issues: [issue] });
}

describe('validateCatalog', () => {
  describe('valid catalogs', () => {
    it('accepts the synthetic valid catalog', () => {
      expect(validateCatalog(buildValidCatalog())).toEqual({ status: 'valid' });
    });

    it('accepts an empty catalog', () => {
      expect(validateCatalog({ plates: [], textColors: [] })).toEqual({
        status: 'valid',
      });
    });

    it('accepts the configuration-validation fixture catalog', () => {
      expect(validateCatalog(testCatalog)).toEqual({ status: 'valid' });
    });

    it('accepts pending dimensions and no image', () => {
      const catalog = withPlate(0, { dimensions: { status: 'pending' } });
      Reflect.deleteProperty(at(catalog.plates, 0), 'image');

      expect(at(catalog.plates, 0)).not.toHaveProperty('image');
      expect(validateCatalog(catalog)).toEqual({ status: 'valid' });
    });

    it('accepts a scalloped model (classification only)', () => {
      expect(validateCatalog(withPlate(1, { shape: 'scalloped' }))).toEqual({ status: 'valid' });
    });
  });

  describe('identifiers', () => {
    it.each(['placa-quadrada-01', 'a', 'test-plate-a', '123'])('accepts id %j', (id) => {
      expect(isValidCatalogId(id)).toBe(true);
    });

    it.each(['', ' ', 'Placa', 'placa_01', 'placa--01', '-placa', 'placa-', 'placa 01', 'ação'])(
      'rejects id %j',
      (id) => {
        expect(isValidCatalogId(id)).toBe(false);
      },
    );

    it('reports an empty id', () => {
      expectOnly(withPlate(1, { id: '' }), { code: 'invalid-id', path: 'plates[1].id', id: '' });
    });

    it('reports a malformed id', () => {
      expectOnly(withPlate(0, { id: 'Plate A' }), {
        code: 'invalid-id',
        path: 'plates[0].id',
        id: 'Plate A',
      });
    });

    it('reports a duplicate id within a collection with the first occurrence', () => {
      const catalog = buildValidCatalog();
      const duplicate = { ...at(catalog.plates, 0), displayName: 'Copy' };

      expectOnly(
        { ...catalog, plates: [...catalog.plates, duplicate] },
        {
          code: 'duplicate-id',
          path: 'plates[3].id',
          id: 'test-plate-a',
          relatedPath: 'plates[0].id',
        },
      );
    });
  });

  describe('labels', () => {
    it.each(['sizeLabel', 'ceramicColor'] as const)('reports a blank %s', (field) => {
      expectOnly(withPlate(1, { [field]: '  ' }), {
        code: 'empty-label',
        path: `plates[1].${field}`,
        id: 'test-plate-b',
      });
    });

    it.each(['sizeLabel', 'ceramicColor'] as const)(
      'reports a non-string %s from malformed runtime data',
      (field) => {
        const catalog = buildValidCatalog();
        Reflect.set(at(catalog.plates, 1), field, 5);

        expectOnly(catalog, {
          code: 'empty-label',
          path: `plates[1].${field}`,
          id: 'test-plate-b',
        });
      },
    );
  });

  describe('dimensions', () => {
    it.each([
      ['zero', 0],
      ['negative', -10],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('reports %s width', (_label, widthMm) => {
      expectOnly(withPlate(0, { dimensions: { status: 'defined', widthMm, heightMm: 100 } }), {
        code: 'invalid-dimension',
        path: 'plates[0].dimensions.widthMm',
        id: 'test-plate-a',
      });
    });

    it('reports width and height independently', () => {
      const catalog = withPlate(0, { dimensions: { status: 'defined', widthMm: 0, heightMm: -1 } });
      expect(issuesOf(validateCatalog(catalog))).toEqual([
        { code: 'invalid-dimension', path: 'plates[0].dimensions.widthMm', id: 'test-plate-a' },
        { code: 'invalid-dimension', path: 'plates[0].dimensions.heightMm', id: 'test-plate-a' },
      ]);
    });
  });

  describe('assets', () => {
    it.each(['', '   '])('reports plate image src %j', (src) => {
      expectOnly(withPlate(1, { image: { image: { src } } }), {
        code: 'invalid-asset',
        path: 'plates[1].image.image.src',
        id: 'test-plate-b',
      });
    });
  });

  describe('multiple independent errors', () => {
    it('reports every issue in deterministic order', () => {
      const base = buildValidCatalog();
      const catalog: Catalog = {
        textColors: [],
        plates: [
          {
            ...at(base.plates, 0),
            id: 'test-plate-b',
            sizeLabel: '',
            dimensions: { status: 'defined', widthMm: -1, heightMm: 100 },
          },
          at(base.plates, 1),
          {
            ...at(base.plates, 2),
            image: { image: { src: '/catalog/plates/test-plate-a/x.png' } },
          },
        ],
      };

      expect(validateCatalog(catalog)).toEqual({
        status: 'invalid',
        issues: [
          { code: 'empty-label', path: 'plates[0].sizeLabel', id: 'test-plate-b' },
          { code: 'invalid-dimension', path: 'plates[0].dimensions.widthMm', id: 'test-plate-b' },
          {
            code: 'duplicate-id',
            path: 'plates[1].id',
            id: 'test-plate-b',
            relatedPath: 'plates[0].id',
          },
          { code: 'invalid-asset', path: 'plates[2].image.image.src', id: 'test-plate-c' },
        ],
      });
    });
  });

  describe('duplicate id regressions', () => {
    it('reports an id appearing three times against the first occurrence', () => {
      const catalog = buildValidCatalog();
      const color = at(catalog.textColors, 0);

      expect(
        validateCatalog({
          ...catalog,
          textColors: [color, color, at(catalog.textColors, 1), color],
        }),
      ).toEqual({
        status: 'invalid',
        issues: [
          {
            code: 'duplicate-id',
            path: 'textColors[1].id',
            id: 'test-text-color-a',
            relatedPath: 'textColors[0].id',
          },
          {
            code: 'duplicate-id',
            path: 'textColors[3].id',
            id: 'test-text-color-a',
            relatedPath: 'textColors[0].id',
          },
        ],
      });
    });

    it('reports both malformed copies and the duplicate when the first entry is malformed', () => {
      const catalog = buildValidCatalog();
      const color = { ...at(catalog.textColors, 1), id: 'Bad_ID' };

      expect(
        validateCatalog({ ...catalog, textColors: [at(catalog.textColors, 0), color, color] }),
      ).toEqual({
        status: 'invalid',
        issues: [
          { code: 'invalid-id', path: 'textColors[1].id', id: 'Bad_ID' },
          { code: 'invalid-id', path: 'textColors[2].id', id: 'Bad_ID' },
          {
            code: 'duplicate-id',
            path: 'textColors[2].id',
            id: 'Bad_ID',
            relatedPath: 'textColors[1].id',
          },
        ],
      });
    });
  });

  describe('malformed runtime ids', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['number', 5],
      ['object', { id: 'test-x' }],
    ])('rejects a %s id without coercing it', (_label, value) => {
      expect(isValidCatalogId(value)).toBe(false);

      const catalog = buildValidCatalog();
      // Deliberately bypass the types to simulate malformed runtime data.
      Reflect.set(at(catalog.plates, 1), 'id', value);

      expect(validateCatalog(catalog)).toEqual({
        status: 'invalid',
        issues: [{ code: 'invalid-id', path: 'plates[1].id' }],
      });
    });
  });

  describe('no repair', () => {
    it('does not modify an invalid catalog', () => {
      const catalog = withPlate(0, {
        sizeLabel: '',
        dimensions: { status: 'defined', widthMm: -1, heightMm: 100 },
      });
      const snapshot = structuredClone(catalog);

      validateCatalog(catalog);

      expect(catalog).toEqual(snapshot);
    });
  });
});

describe('validateCatalog: text colors (D-042)', () => {
  const withColors = (textColors: Catalog['textColors']): Catalog => ({
    ...buildValidCatalog(),
    textColors,
  });
  const color = (patch: object = {}) => ({
    id: 'test-text-color-x',
    type: 'text-color' as const,
    displayName: 'Test ink X',
    hex: '#abcdef',
    ...patch,
  });

  it('accepts a palette, and an empty one', () => {
    expect(validateCatalog(withColors([color(), color({ id: 'test-text-color-y' })]))).toEqual({
      status: 'valid',
    });
    expect(validateCatalog(withColors([]))).toEqual({ status: 'valid' });
  });

  it.each(['red', '#fff', '#12345g', '123456', '#1234567', ''])('rejects hex %j', (hex) => {
    expectOnly(withColors([color({ hex })]), {
      code: 'invalid-color',
      path: 'textColors[0].hex',
      id: 'test-text-color-x',
    });
  });

  it('rejects a blank name', () => {
    expectOnly(withColors([color({ displayName: '  ' })]), {
      code: 'empty-label',
      path: 'textColors[0].displayName',
      id: 'test-text-color-x',
    });
  });

  it('keeps IDs unique across plates and colors', () => {
    expectOnly(withColors([color({ id: 'test-plate-a' })]), {
      code: 'duplicate-id',
      path: 'textColors[0].id',
      id: 'test-plate-a',
      relatedPath: 'plates[0].id',
    });
  });

  it('rejects a malformed id', () => {
    expectOnly(withColors([color({ id: 'Ink X' })]), {
      code: 'invalid-id',
      path: 'textColors[0].id',
      id: 'Ink X',
    });
  });
  describe('default lettering color (D-064)', () => {
    const withDefault = (id: string, colors = [color()]) => ({
      ...withColors(colors),
      defaultTextColorId: id,
    });

    it('accepts an available listed color', () => {
      expect(validateCatalog(withDefault('test-text-color-x'))).toEqual({ status: 'valid' });
    });

    it.each([
      ['an unlisted color', 'test-text-color-y', [color()]],
      ['an unavailable color', 'test-text-color-x', [color({ available: false })]],
    ])('rejects %s', (_, id, colors) => {
      expectOnly(withDefault(id, colors), {
        code: 'unknown-reference',
        path: 'defaultTextColorId',
        id,
      });
    });
  });
});
