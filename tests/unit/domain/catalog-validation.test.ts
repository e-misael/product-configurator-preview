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

    it('accepts pending dimensions, no images, and empty supportedColorIds', () => {
      const catalog = withPlate(0, { supportedColorIds: [], dimensions: { status: 'pending' } });
      Reflect.deleteProperty(at(catalog.plates, 0), 'images');

      expect(at(catalog.plates, 0)).not.toHaveProperty('images');
      expect(validateCatalog(catalog)).toEqual({ status: 'valid' });
    });

    it('accepts a rectangular plate without frame support', () => {
      expect(validateCatalog(withPlate(1, { supportsFrame: false }))).toEqual({ status: 'valid' });
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
    it('reports empty supportedColorCategories', () => {
      const issues = issuesOf(validateCatalog(withPlate(1, { supportedColorCategories: [] })));
      expect(issues).toContainEqual({
        code: 'empty-list',
        path: 'plates[1].supportedColorCategories',
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

  describe('frame capability', () => {
    it('reports a circular plate declared as supporting frames', () => {
      expectOnly(withPlate(2, { supportsFrame: true }), {
        code: 'frame-capability-conflict',
        path: 'plates[2].supportsFrame',
        id: 'test-plate-c',
      });
    });

    it('reports circle in a frame compatibility list', () => {
      expectOnly(withFrame(0, { compatibility: { shapes: ['square', 'rectangle', 'circle'] } }), {
        code: 'unsupported-frame-shape',
        path: 'frames[0].compatibility.shapes[2]',
        id: 'test-frame-any',
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
      expectOnly(withPlate(1, { images: [{ colorCategory: 'nude', image: { src } }] }), {
        code: 'invalid-asset',
        path: 'plates[1].images[0].image.src',
        id: 'test-plate-b',
      });
    });

    it('reports an invalid frame image', () => {
      expectOnly(withFrame(0, { images: [{ plateId: 'test-plate-a', back: { src: '' } }] }), {
        code: 'invalid-asset',
        path: 'frames[0].images[0].back.src',
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
            dimensions: { status: 'defined', widthMm: -1, heightMm: 100 },
          },
          at(base.plates, 1),
          { ...at(base.plates, 2), supportsFrame: true },
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
          { code: 'invalid-dimension', path: 'plates[0].dimensions.widthMm', id: 'test-plate-b' },
          {
            code: 'duplicate-id',
            path: 'plates[1].id',
            id: 'test-plate-b',
            relatedPath: 'plates[0].id',
          },
          {
            code: 'frame-capability-conflict',
            path: 'plates[2].supportsFrame',
            id: 'test-plate-c',
          },
          {
            code: 'unknown-reference',
            path: 'frames[1].compatibility.plateIds[0]',
            id: 'test-frame-plate-a',
          },
        ],
      });
    });
  });

  describe('duplicate id regressions', () => {
    it('reports an id appearing three times against the first occurrence', () => {
      const catalog = buildValidCatalog();
      const frame = at(catalog.frames, 0);

      expect(
        validateCatalog({ ...catalog, frames: [frame, frame, at(catalog.frames, 1), frame] }),
      ).toEqual({
        status: 'invalid',
        issues: [
          {
            code: 'duplicate-id',
            path: 'frames[1].id',
            id: 'test-frame-any',
            relatedPath: 'frames[0].id',
          },
          {
            code: 'duplicate-id',
            path: 'frames[3].id',
            id: 'test-frame-any',
            relatedPath: 'frames[0].id',
          },
        ],
      });
    });

    it('reports both malformed copies and the duplicate when the first entry is malformed', () => {
      const catalog = buildValidCatalog();
      const color = { ...at(catalog.colors, 1), id: 'Bad_ID' };

      expect(
        validateCatalog({ ...catalog, colors: [at(catalog.colors, 0), color, color] }),
      ).toEqual({
        status: 'invalid',
        issues: [
          { code: 'invalid-id', path: 'colors[1].id', id: 'Bad_ID' },
          { code: 'invalid-id', path: 'colors[2].id', id: 'Bad_ID' },
          { code: 'duplicate-id', path: 'colors[2].id', id: 'Bad_ID', relatedPath: 'colors[1].id' },
          { code: 'unknown-reference', path: 'plates[0].supportedColorIds[1]', id: 'test-plate-a' },
        ],
      });
    });

    it('resolves references against the first occurrence of a duplicated color id', () => {
      const catalog = buildValidCatalog();
      // colors[0] is nude; the later duplicate is colored and must not overwrite it.
      const conflicting = { ...at(catalog.colors, 1), id: 'test-color-nude' };
      const nudeOnlyPlate = { ...at(catalog.plates, 1), supportedColorIds: ['test-color-nude'] };

      expect(
        validateCatalog({
          ...catalog,
          colors: [...catalog.colors, conflicting],
          plates: [at(catalog.plates, 0), nudeOnlyPlate],
        }),
      ).toEqual({
        status: 'invalid',
        issues: [
          {
            code: 'duplicate-id',
            path: 'colors[2].id',
            id: 'test-color-nude',
            relatedPath: 'colors[0].id',
          },
        ],
      });
    });

    it('reports a category mismatch against the first occurrence, not a later duplicate', () => {
      const catalog = buildValidCatalog();
      // colors[0] becomes colored; the later nude duplicate must not mask the mismatch.
      const coloredFirst = { ...at(catalog.colors, 0), category: 'colored' as const };
      const nudeLater = { ...at(catalog.colors, 0) };
      const nudeOnlyPlate = { ...at(catalog.plates, 1), supportedColorIds: ['test-color-nude'] };

      expect(
        issuesOf(
          validateCatalog({
            ...catalog,
            colors: [coloredFirst, at(catalog.colors, 1), nudeLater],
            plates: [at(catalog.plates, 0), nudeOnlyPlate],
          }),
        ),
      ).toContainEqual({
        code: 'color-category-mismatch',
        path: 'plates[1].supportedColorIds[0]',
        id: 'test-plate-b',
      });
    });
  });

  describe('cross-collection references', () => {
    it('does not resolve a frame id listed as a plate color', () => {
      expectOnly(withPlate(0, { supportedColorIds: ['test-color-nude', 'test-frame-any'] }), {
        code: 'unknown-reference',
        path: 'plates[0].supportedColorIds[1]',
        id: 'test-plate-a',
      });
    });

    it('does not resolve a color id listed as a frame plate restriction', () => {
      expectOnly(
        withFrame(1, { compatibility: { shapes: ['square'], plateIds: ['test-color-nude'] } }),
        {
          code: 'unknown-reference',
          path: 'frames[1].compatibility.plateIds[0]',
          id: 'test-frame-plate-a',
        },
      );
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
      Reflect.set(at(catalog.frames, 0), 'id', value);

      expect(validateCatalog(catalog)).toEqual({
        status: 'invalid',
        issues: [{ code: 'invalid-id', path: 'frames[0].id' }],
      });
    });

    it('reports a malformed color id together with the reference it breaks', () => {
      const catalog = buildValidCatalog();
      Reflect.set(at(catalog.colors, 1), 'id', 5);

      expect(validateCatalog(catalog)).toEqual({
        status: 'invalid',
        issues: [
          { code: 'invalid-id', path: 'colors[1].id' },
          { code: 'unknown-reference', path: 'plates[0].supportedColorIds[1]', id: 'test-plate-a' },
        ],
      });
    });
  });

  describe('unreachable compatibility', () => {
    const unreachable = (j: number, relatedPath: string) => ({
      code: 'unreachable-compatibility' as const,
      path: `frames[1].compatibility.plateIds[${j}]`,
      id: 'test-frame-plate-a',
      relatedPath,
    });

    it('reports a frame restricted to a plate of another shape', () => {
      // Frame supports only square; plate B is rectangular.
      expectOnly(
        withFrame(1, { compatibility: { shapes: ['square'], plateIds: ['test-plate-b'] } }),
        unreachable(0, 'plates[1]'),
      );
    });

    it('reports a frame restricted to a plate without frame support', () => {
      // Plate C is circular and frameless.
      expectOnly(
        withFrame(1, { compatibility: { shapes: ['square'], plateIds: ['test-plate-c'] } }),
        unreachable(0, 'plates[2]'),
      );
    });

    it('uses the capability, not the shape, for a frameless square plate', () => {
      const base = buildValidCatalog();
      const catalog: Catalog = {
        ...base,
        plates: [{ ...at(base.plates, 0), supportsFrame: false }, ...base.plates.slice(1)],
      };
      expectOnly(catalog, unreachable(0, 'plates[0]'));
    });

    it('reports only the unreachable plate among several references', () => {
      expectOnly(
        withFrame(1, {
          compatibility: { shapes: ['square'], plateIds: ['test-plate-a', 'test-plate-b'] },
        }),
        unreachable(1, 'plates[1]'),
      );
    });

    it('accepts a restriction sharing the plate shape', () => {
      const catalog = withFrame(1, {
        compatibility: {
          shapes: ['square', 'rectangle'],
          plateIds: ['test-plate-a', 'test-plate-b'],
        },
      });
      expect(validateCatalog(catalog)).toEqual({ status: 'valid' });
    });

    it('keeps unknown-reference handling for missing plates', () => {
      expect(
        issuesOf(
          validateCatalog(
            withFrame(1, {
              compatibility: {
                shapes: ['square'],
                plateIds: ['test-plate-missing', 'test-plate-b'],
              },
            }),
          ),
        ),
      ).toEqual([
        {
          code: 'unknown-reference',
          path: 'frames[1].compatibility.plateIds[0]',
          id: 'test-frame-plate-a',
        },
        unreachable(1, 'plates[1]'),
      ]);
    });

    it('does not repeat an empty frame shape list as a shape mismatch', () => {
      const catalog = withFrame(1, { compatibility: { shapes: [], plateIds: ['test-plate-a'] } });
      expect(issuesOf(validateCatalog(catalog)).map((issue) => issue.code)).toEqual(['empty-list']);
    });

    it('still reports a frameless plate when the frame shape list is empty', () => {
      const catalog = withFrame(1, { compatibility: { shapes: [], plateIds: ['test-plate-c'] } });
      expect(issuesOf(validateCatalog(catalog)).map((issue) => issue.code)).toEqual([
        'empty-list',
        'unreachable-compatibility',
      ]);
    });

    it('evaluates repeated plate references independently', () => {
      expect(
        issuesOf(
          validateCatalog(
            withFrame(1, {
              compatibility: { shapes: ['square'], plateIds: ['test-plate-b', 'test-plate-b'] },
            }),
          ),
        ).map((issue) => `${issue.code} ${issue.path}`),
      ).toEqual([
        'duplicate-entry frames[1].compatibility.plateIds[1]',
        'unreachable-compatibility frames[1].compatibility.plateIds[0]',
        'unreachable-compatibility frames[1].compatibility.plateIds[1]',
      ]);
    });
  });

  describe('multiple independent inconsistencies including new rules', () => {
    it('reports every issue across collections in deterministic order', () => {
      const base = buildValidCatalog();
      const catalog: Catalog = {
        colors: [at(base.colors, 0), { ...at(base.colors, 1), id: 'test-color-nude' }],
        plates: [
          { ...at(base.plates, 0), supportedColorIds: ['test-frame-any'] },
          {
            ...at(base.plates, 1),
            images: [{ colorCategory: 'nude', image: { src: '' } }],
          },
        ],
        frames: [
          { ...at(base.frames, 0), id: 'Frame' },
          {
            ...at(base.frames, 1),
            compatibility: { shapes: ['square'], plateIds: ['test-plate-b'] },
          },
        ],
      };

      expect(validateCatalog(catalog)).toEqual({
        status: 'invalid',
        issues: [
          {
            code: 'duplicate-id',
            path: 'colors[1].id',
            id: 'test-color-nude',
            relatedPath: 'colors[0].id',
          },
          { code: 'unknown-reference', path: 'plates[0].supportedColorIds[0]', id: 'test-plate-a' },
          { code: 'invalid-asset', path: 'plates[1].images[0].image.src', id: 'test-plate-b' },
          { code: 'invalid-id', path: 'frames[0].id', id: 'Frame' },
          {
            code: 'unreachable-compatibility',
            path: 'frames[1].compatibility.plateIds[0]',
            id: 'test-frame-plate-a',
            relatedPath: 'plates[1]',
          },
        ],
      });
    });
  });

  describe('no repair', () => {
    it('does not modify an invalid catalog', () => {
      const catalog = withPlate(0, {
        supportedColorCategories: ['nude', 'nude'],
        supportedColorIds: ['test-color-missing'],
        supportsFrame: true,
      });
      const snapshot = structuredClone(catalog);

      validateCatalog(catalog);

      expect(catalog).toEqual(snapshot);
    });
  });
});
