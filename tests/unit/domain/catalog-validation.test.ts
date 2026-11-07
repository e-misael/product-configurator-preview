import {
  isValidCatalogId,
  validateCatalog,
  type Catalog,
  type CatalogIssue,
  type CatalogValidationResult,
  type Frame,
  type Plate,
  type PlateColor,
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

function withFrame(index: number, patch: Partial<Frame>): Catalog {
  const catalog = buildValidCatalog();
  return {
    ...catalog,
    frames: catalog.frames.map((f, i) => (i === index ? { ...f, ...patch } : f)),
  };
}

function withColor(index: number, patch: Partial<PlateColor>): Catalog {
  const catalog = buildValidCatalog();
  return {
    ...catalog,
    colors: catalog.colors.map((c, i) => (i === index ? { ...c, ...patch } : c)),
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
      expect(validateCatalog({ plates: [], frames: [], colors: [] })).toEqual({ status: 'valid' });
    });

    it('accepts the configuration-validation fixture catalog', () => {
      expect(validateCatalog(testCatalog)).toEqual({ status: 'valid' });
    });

    it('accepts pending dimensions, omitted dimensions, and empty supportedColorIds', () => {
      const catalog = withPlate(1, {
        supportedShapes: ['square', 'rectangle'],
        supportedColorIds: [],
        dimensions: { square: { status: 'pending' } },
      });
      expect(validateCatalog(catalog)).toEqual({ status: 'valid' });
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

    it('reports an empty id, and the reference that no longer resolves', () => {
      expect(validateCatalog(withColor(1, { id: '' }))).toEqual({
        status: 'invalid',
        issues: [
          { code: 'invalid-id', path: 'colors[1].id', id: '' },
          {
            code: 'unknown-reference',
            path: 'plates[0].supportedColorIds[1]',
            id: 'test-plate-a',
          },
        ],
      });
    });

    it('reports a malformed id', () => {
      expectOnly(withFrame(0, { id: 'Frame Any' }), {
        code: 'invalid-id',
        path: 'frames[0].id',
        id: 'Frame Any',
      });
    });

    it('reports a duplicate id within a collection with the first occurrence', () => {
      const catalog = buildValidCatalog();
      const duplicate = { ...at(catalog.frames, 0), displayName: 'Copy' };

      expectOnly(
        { ...catalog, frames: [...catalog.frames, duplicate] },
        {
          code: 'duplicate-id',
          path: 'frames[2].id',
          id: 'test-frame-any',
          relatedPath: 'frames[0].id',
        },
      );
    });

    it('reports a duplicate id across collections', () => {
      expectOnly(withFrame(0, { id: 'test-color-nude' }), {
        code: 'duplicate-id',
        path: 'frames[0].id',
        id: 'test-color-nude',
        relatedPath: 'colors[0].id',
      });
    });
  });

  describe('lists', () => {
    it.each([
      ['supportedShapes', { supportedShapes: [] }],
      ['supportedColorCategories', { supportedColorCategories: [] }],
    ] as const)('reports empty %s', (field, patch) => {
      const issues = issuesOf(validateCatalog(withPlate(1, patch)));
      expect(issues).toContainEqual({
        code: 'empty-list',
        path: `plates[1].${field}`,
        id: 'test-plate-b',
      });
    });

    it('reports empty frame compatibility shapes', () => {
      const issues = issuesOf(validateCatalog(withFrame(1, { compatibility: { shapes: [] } })));
      expect(issues).toContainEqual({
        code: 'empty-list',
        path: 'frames[1].compatibility.shapes',
        id: 'test-frame-plate-a',
      });
    });

    it('reports an empty plateIds restriction but allows omitting it', () => {
      expectOnly(withFrame(1, { compatibility: { shapes: ['square'], plateIds: [] } }), {
        code: 'empty-list',
        path: 'frames[1].compatibility.plateIds',
        id: 'test-frame-plate-a',
      });
      expect(validateCatalog(withFrame(1, { compatibility: { shapes: ['square'] } }))).toEqual({
        status: 'valid',
      });
    });

    it.each([
      ['supportedShapes', { supportedShapes: ['square', 'rectangle', 'square'] }, 2, 0],
      [
        'supportedColorCategories',
        { supportedColorCategories: ['nude', 'colored', 'colored'] },
        2,
        1,
      ],
      [
        'supportedColorIds',
        { supportedColorIds: ['test-color-nude', 'test-color-nude', 'test-color-colored'] },
        1,
        0,
      ],
    ] as const)('reports duplicate entries in %s', (field, patch, index, firstIndex) => {
      expectOnly(withPlate(0, patch), {
        code: 'duplicate-entry',
        path: `plates[0].${field}[${index}]`,
        id: 'test-plate-a',
        relatedPath: `plates[0].${field}[${firstIndex}]`,
      });
    });

    it('reports duplicate entries in frame compatibility lists', () => {
      const catalog = withFrame(1, {
        compatibility: { shapes: ['square', 'square'], plateIds: ['test-plate-a', 'test-plate-a'] },
      });
      expect(validateCatalog(catalog)).toEqual({
        status: 'invalid',
        issues: [
          {
            code: 'duplicate-entry',
            path: 'frames[1].compatibility.shapes[1]',
            id: 'test-frame-plate-a',
            relatedPath: 'frames[1].compatibility.shapes[0]',
          },
          {
            code: 'duplicate-entry',
            path: 'frames[1].compatibility.plateIds[1]',
            id: 'test-frame-plate-a',
            relatedPath: 'frames[1].compatibility.plateIds[0]',
          },
        ],
      });
    });
  });

  describe('references', () => {
    it('reports a reference to a nonexistent color', () => {
      expectOnly(withPlate(0, { supportedColorIds: ['test-color-nude', 'test-color-missing'] }), {
        code: 'unknown-reference',
        path: 'plates[0].supportedColorIds[1]',
        id: 'test-plate-a',
      });
    });

    it('reports a reference to a nonexistent plate', () => {
      expectOnly(
        withFrame(1, { compatibility: { shapes: ['square'], plateIds: ['test-plate-missing'] } }),
        {
          code: 'unknown-reference',
          path: 'frames[1].compatibility.plateIds[0]',
          id: 'test-frame-plate-a',
        },
      );
    });

    it('does not resolve references across component types', () => {
      const issues = issuesOf(
        validateCatalog(withPlate(0, { supportedColorIds: ['test-plate-b'] })),
      );
      expect(issues).toEqual([
        { code: 'unknown-reference', path: 'plates[0].supportedColorIds[0]', id: 'test-plate-a' },
      ]);
    });
  });

  describe('color categories', () => {
    it('reports a referenced color whose category the plate does not support', () => {
      expectOnly(withPlate(1, { supportedColorIds: ['test-color-colored'] }), {
        code: 'color-category-mismatch',
        path: 'plates[1].supportedColorIds[0]',
        id: 'test-plate-b',
      });
    });
  });

  describe('shape keys', () => {
    it('reports dimensions for an unsupported shape', () => {
      expectOnly(withPlate(1, { dimensions: { rectangle: { status: 'pending' } } }), {
        code: 'unsupported-shape-key',
        path: 'plates[1].dimensions.rectangle',
        id: 'test-plate-b',
      });
    });

    it('reports plate assets for an unsupported shape', () => {
      expectOnly(withPlate(1, { assets: { rectangle: { src: '/catalog/test/b.png' } } }), {
        code: 'unsupported-shape-key',
        path: 'plates[1].assets.rectangle',
        id: 'test-plate-b',
      });
    });

    it('reports frame assets for a shape outside its compatibility', () => {
      expectOnly(withFrame(1, { assets: { rectangle: { src: '/catalog/test/f.png' } } }), {
        code: 'unsupported-shape-key',
        path: 'frames[1].assets.rectangle',
        id: 'test-frame-plate-a',
      });
    });
  });

  describe('dimensions', () => {
    it.each([
      ['zero', 0],
      ['negative', -10],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('reports %s width', (_label, widthMm) => {
      expectOnly(
        withPlate(0, {
          dimensions: { square: { status: 'defined', widthMm, heightMm: 100 } },
        }),
        {
          code: 'invalid-dimension',
          path: 'plates[0].dimensions.square.widthMm',
          id: 'test-plate-a',
        },
      );
    });

    it('reports width and height independently', () => {
      const catalog = withPlate(0, {
        dimensions: { rectangle: { status: 'defined', widthMm: 0, heightMm: -1 } },
      });
      expect(issuesOf(validateCatalog(catalog))).toEqual([
        {
          code: 'invalid-dimension',
          path: 'plates[0].dimensions.rectangle.widthMm',
          id: 'test-plate-a',
        },
        {
          code: 'invalid-dimension',
          path: 'plates[0].dimensions.rectangle.heightMm',
          id: 'test-plate-a',
        },
      ]);
    });
  });

  describe('assets', () => {
    it.each(['', '   '])('reports plate asset src %j', (src) => {
      expectOnly(withPlate(0, { assets: { square: { src } } }), {
        code: 'invalid-asset',
        path: 'plates[0].assets.square.src',
        id: 'test-plate-a',
      });
    });

    it('reports an invalid frame asset', () => {
      expectOnly(withFrame(0, { assets: { square: { src: '' } } }), {
        code: 'invalid-asset',
        path: 'frames[0].assets.square.src',
        id: 'test-frame-any',
      });
    });

    it('reports an invalid color swatch', () => {
      expectOnly(withColor(0, { swatch: { src: ' ' } }), {
        code: 'invalid-asset',
        path: 'colors[0].swatch.src',
        id: 'test-color-nude',
      });
    });
  });

  describe('multiple independent errors', () => {
    it('reports every issue in deterministic order', () => {
      const base = buildValidCatalog();
      const catalog: Catalog = {
        colors: [{ ...at(base.colors, 0), swatch: { src: '' } }, at(base.colors, 1)],
        plates: [
          {
            ...at(base.plates, 0),
            id: 'test-plate-b',
            supportedColorIds: ['test-color-missing'],
            dimensions: { square: { status: 'defined', widthMm: -1, heightMm: 100 } },
          },
          { ...at(base.plates, 1), supportedShapes: [] },
        ],
        frames: [
          at(base.frames, 0),
          {
            ...at(base.frames, 1),
            compatibility: { shapes: ['square'], plateIds: ['test-plate-a'] },
          },
        ],
      };

      expect(validateCatalog(catalog)).toEqual({
        status: 'invalid',
        issues: [
          { code: 'invalid-asset', path: 'colors[0].swatch.src', id: 'test-color-nude' },
          {
            code: 'unknown-reference',
            path: 'plates[0].supportedColorIds[0]',
            id: 'test-plate-b',
          },
          {
            code: 'invalid-dimension',
            path: 'plates[0].dimensions.square.widthMm',
            id: 'test-plate-b',
          },
          {
            code: 'duplicate-id',
            path: 'plates[1].id',
            id: 'test-plate-b',
            relatedPath: 'plates[0].id',
          },
          { code: 'empty-list', path: 'plates[1].supportedShapes', id: 'test-plate-b' },
          {
            code: 'unknown-reference',
            path: 'frames[1].compatibility.plateIds[0]',
            id: 'test-frame-plate-a',
          },
        ],
      });
    });
  });

  describe('no repair', () => {
    it('does not modify an invalid catalog', () => {
      const catalog = withPlate(0, {
        supportedShapes: ['square', 'square'],
        supportedColorIds: ['test-color-missing'],
      });
      const snapshot = structuredClone(catalog);

      validateCatalog(catalog);

      expect(catalog).toEqual(snapshot);
    });
  });
});
