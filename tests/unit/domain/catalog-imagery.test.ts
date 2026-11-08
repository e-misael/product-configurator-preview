import {
  isValidAssetPath,
  validateCatalog,
  type AssetRef,
  type Catalog,
  type CatalogIssue,
  type FrameImage,
  type NormalizedBox,
  type PlateImage,
  type TextLayout,
} from '../../../src/domain';
import { getCatalog } from '../../../src/catalog';
import { demoCatalog } from '../../../src/demo/demo-catalog';
import { at, buildImageCatalog } from './catalog-fixtures';

/** Image catalog with plate A's photographs replaced. */
function withPlateImages(images: readonly PlateImage[]): Catalog {
  const catalog = buildImageCatalog();
  return {
    ...catalog,
    plates: catalog.plates.map((p, i) => (i === 0 ? { ...p, images } : p)),
  };
}

/** Image catalog with frame test-frame-any's images replaced. */
function withFrameImages(images: readonly FrameImage[]): Catalog {
  const catalog = buildImageCatalog();
  return {
    ...catalog,
    frames: catalog.frames.map((f, i) => (i === 0 ? { ...f, images } : f)),
  };
}

function expectOnly(catalog: Catalog, issue: CatalogIssue) {
  expect(validateCatalog(catalog)).toEqual({ status: 'invalid', issues: [issue] });
}

const nudeImage = (image: AssetRef, extra: Partial<PlateImage> = {}): PlateImage => ({
  colorCategory: 'nude',
  image,
  ...extra,
});
const NUDE_SRC = '/catalog/plates/test-plate-a/nude.webp';
const BOX: NormalizedBox = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };

describe('catalog imagery', () => {
  it('accepts the synthetic image catalog', () => {
    expect(validateCatalog(buildImageCatalog())).toEqual({ status: 'valid' });
  });

  it('keeps the production and demo catalogs valid', () => {
    expect(validateCatalog(getCatalog())).toEqual({ status: 'valid' });
    expect(validateCatalog(demoCatalog)).toEqual({ status: 'valid' });
  });

  it('accepts images without intrinsic size or placement (calibration pending)', () => {
    expect(validateCatalog(withPlateImages([nudeImage({ src: NUDE_SRC })]))).toEqual({
      status: 'valid',
    });
    expect(
      validateCatalog(
        withFrameImages([
          { plateId: 'test-plate-b', back: { src: '/catalog/frames/test-frame-any/b.webp' } },
        ]),
      ),
    ).toEqual({ status: 'valid' });
  });

  describe('asset paths', () => {
    it.each([
      '/catalog/plates/test-plate-a/nude.webp',
      '/catalog/plates/test-plate-a/test-color-colored.png',
      '/catalog/plates/test-plate-a/nude-2.jpg',
    ])('accepts %s', (src) => {
      expect(isValidAssetPath(src, 'plates', 'test-plate-a')).toBe(true);
    });

    it.each([
      ['empty', ''],
      ['whitespace', '  '],
      ['relative', 'catalog/plates/test-plate-a/nude.webp'],
      ['external URL', 'https://example.com/catalog/plates/test-plate-a/nude.webp'],
      ['protocol-relative URL', '//example.com/catalog/plates/test-plate-a/nude.webp'],
      ['data URI', 'data:image/png;base64,AAAA'],
      ['javascript scheme', 'javascript:alert(1)'],
      ['path traversal', '/catalog/plates/test-plate-a/../test-plate-b/nude.webp'],
      ['dot segment', '/catalog/plates/test-plate-a/./nude.webp'],
      ['encoded traversal', '/catalog/plates/test-plate-a/%2e%2e/nude.webp'],
      ['double slash', '/catalog/plates//test-plate-a/nude.webp'],
      ['backslash', '/catalog/plates/test-plate-a\\nude.webp'],
      ['query string', '/catalog/plates/test-plate-a/nude.webp?v=2'],
      ['fragment', '/catalog/plates/test-plate-a/nude.webp#x'],
      ['uppercase', '/catalog/plates/test-plate-a/Nude.webp'],
      ['spaces', '/catalog/plates/test-plate-a/nude plate.webp'],
      ['unsupported extension', '/catalog/plates/test-plate-a/nude.svg'],
      ['no extension', '/catalog/plates/test-plate-a/nude'],
      ['nested folder', '/catalog/plates/test-plate-a/extra/nude.webp'],
      ['another plate folder', '/catalog/plates/test-plate-b/nude.webp'],
      ['another owner type', '/catalog/frames/test-plate-a/nude.webp'],
      ['outside /catalog/', '/images/plates/test-plate-a/nude.webp'],
    ])('rejects %s', (_label, src) => {
      expect(isValidAssetPath(src, 'plates', 'test-plate-a')).toBe(false);
      expectOnly(withPlateImages([nudeImage({ src })]), {
        code: 'invalid-asset',
        path: 'plates[0].images[0].image.src',
        id: 'test-plate-a',
      });
    });

    it('rejects a non-string src from malformed runtime data', () => {
      expect(isValidAssetPath(42, 'plates', 'test-plate-a')).toBe(false);
    });

    it('requires frame layers and swatches in their owner folders', () => {
      expectOnly(
        withFrameImages([
          {
            plateId: 'test-plate-b',
            back: { src: '/catalog/frames/test-frame-any/back.webp' },
            front: { src: '/catalog/frames/test-frame-plate-a/front.png' },
          },
        ]),
        { code: 'invalid-asset', path: 'frames[0].images[0].front.src', id: 'test-frame-any' },
      );

      const catalog = buildImageCatalog();
      expectOnly(
        {
          ...catalog,
          colors: [
            { ...at(catalog.colors, 0), swatch: { src: '/catalog/plates/test-color-nude/s.png' } },
            at(catalog.colors, 1),
          ],
        },
        { code: 'invalid-asset', path: 'colors[0].swatch.src', id: 'test-color-nude' },
      );
    });
  });

  describe('intrinsic size', () => {
    it.each([
      ['only width', { widthPx: 100 }, ['heightPx']],
      ['only height', { heightPx: 100 }, ['widthPx']],
      ['zero', { widthPx: 0, heightPx: 100 }, ['widthPx']],
      ['negative', { widthPx: 100, heightPx: -1 }, ['heightPx']],
      ['fractional', { widthPx: 100.5, heightPx: 100 }, ['widthPx']],
      ['NaN', { widthPx: Number.NaN, heightPx: Number.NaN }, ['widthPx', 'heightPx']],
    ])('reports %s', (_label, size, sides) => {
      const result = validateCatalog(withPlateImages([nudeImage({ src: NUDE_SRC, ...size })]));
      expect(result).toEqual({
        status: 'invalid',
        issues: sides.map((side) => ({
          code: 'invalid-asset',
          path: `plates[0].images[0].image.${side}`,
          id: 'test-plate-a',
        })),
      });
    });
  });

  describe('plate image variations', () => {
    it('reports a category the plate does not support', () => {
      const catalog = buildImageCatalog();
      const plateB = at(catalog.plates, 1); // nude only
      expectOnly(
        {
          ...catalog,
          plates: catalog.plates.map((p, i) =>
            i === 1
              ? {
                  ...plateB,
                  images: [
                    {
                      colorCategory: 'colored',
                      image: { src: '/catalog/plates/test-plate-b/colored.webp' },
                    },
                  ],
                }
              : p,
          ),
        },
        {
          code: 'unsupported-variation',
          path: 'plates[1].images[0].colorCategory',
          id: 'test-plate-b',
        },
      );
    });

    it('reports an unknown shade', () => {
      expectOnly(withPlateImages([nudeImage({ src: NUDE_SRC }, { colorId: 'test-color-x' })]), {
        code: 'unknown-reference',
        path: 'plates[0].images[0].colorId',
        id: 'test-plate-a',
      });
    });

    it('reports a shade from another category', () => {
      expectOnly(
        withPlateImages([nudeImage({ src: NUDE_SRC }, { colorId: 'test-color-colored' })]),
        {
          code: 'color-category-mismatch',
          path: 'plates[0].images[0].colorId',
          id: 'test-plate-a',
        },
      );
    });

    it('reports a shade the plate is not made in', () => {
      const catalog = withPlateImages([
        nudeImage({ src: NUDE_SRC }, { colorId: 'test-color-nude' }),
      ]);
      const restricted: Catalog = {
        ...catalog,
        plates: catalog.plates.map((p, i) =>
          i === 0 ? { ...p, supportedColorIds: ['test-color-colored'] } : p,
        ),
      };
      expectOnly(restricted, {
        code: 'unsupported-variation',
        path: 'plates[0].images[0].colorId',
        id: 'test-plate-a',
      });
    });

    it('reports duplicate variations against the first occurrence', () => {
      const result = validateCatalog(
        withPlateImages([
          nudeImage({ src: NUDE_SRC }),
          nudeImage({ src: '/catalog/plates/test-plate-a/nude-alt.webp' }),
          nudeImage(
            { src: '/catalog/plates/test-plate-a/nude-shade.webp' },
            {
              colorId: 'test-color-nude',
            },
          ),
          nudeImage(
            { src: '/catalog/plates/test-plate-a/nude-shade-2.webp' },
            {
              colorId: 'test-color-nude',
            },
          ),
        ]),
      );
      expect(result).toEqual({
        status: 'invalid',
        issues: [
          {
            code: 'duplicate-variation',
            path: 'plates[0].images[1]',
            id: 'test-plate-a',
            relatedPath: 'plates[0].images[0]',
          },
          {
            code: 'duplicate-variation',
            path: 'plates[0].images[3]',
            id: 'test-plate-a',
            relatedPath: 'plates[0].images[2]',
          },
        ],
      });
    });

    it('treats category-only and shade-specific photographs as distinct variations', () => {
      const catalog = withPlateImages([
        nudeImage({ src: NUDE_SRC }),
        nudeImage(
          { src: '/catalog/plates/test-plate-a/test-color-nude.webp' },
          {
            colorId: 'test-color-nude',
          },
        ),
      ]);
      expect(validateCatalog(catalog)).toEqual({ status: 'valid' });
    });

    it('allows one file to be reused by several entries', () => {
      const catalog = withPlateImages([
        nudeImage({ src: NUDE_SRC }),
        nudeImage({ src: NUDE_SRC }, { colorId: 'test-color-nude' }),
      ]);
      expect(validateCatalog(catalog)).toEqual({ status: 'valid' });
    });
  });

  describe('frame images', () => {
    const back = { src: '/catalog/frames/test-frame-any/back.webp' };

    it('reports an unknown plate', () => {
      expectOnly(withFrameImages([{ plateId: 'test-plate-x', back }]), {
        code: 'unknown-reference',
        path: 'frames[0].images[0].plateId',
        id: 'test-frame-any',
      });
    });

    it.each([
      ['a frameless circular plate', 'test-plate-c', 'plates[2]', 0],
      ['a plate outside the plate restriction', 'test-plate-b', 'plates[1]', 1],
    ])('reports imagery for %s using the domain compatibility rule', (_l, plateId, rel, frame) => {
      const catalog = buildImageCatalog();
      const frames = catalog.frames.map((f, i) =>
        i === frame
          ? { ...f, images: [{ plateId, back: { src: `/catalog/frames/${f.id}/back.webp` } }] }
          : { ...f, images: [] },
      );
      expectOnly(
        { ...catalog, frames },
        {
          code: 'unreachable-compatibility',
          path: `frames[${frame}].images[0].plateId`,
          id: at(catalog.frames, frame).id,
          relatedPath: rel,
        },
      );
    });

    it('accepts imagery for a plate allowed by the restriction', () => {
      const catalog = buildImageCatalog();
      const frames = catalog.frames.map((f, i) =>
        i === 1
          ? {
              ...f,
              images: [
                {
                  plateId: 'test-plate-a',
                  back: { src: '/catalog/frames/test-frame-plate-a/a.png' },
                },
              ],
            }
          : f,
      );
      expect(validateCatalog({ ...catalog, frames })).toEqual({ status: 'valid' });
    });

    it('reports duplicate imagery for the same plate', () => {
      expectOnly(
        withFrameImages([
          { plateId: 'test-plate-a', back },
          { plateId: 'test-plate-a', back },
        ]),
        {
          code: 'duplicate-variation',
          path: 'frames[0].images[1]',
          id: 'test-frame-any',
          relatedPath: 'frames[0].images[0]',
        },
      );
    });
  });

  describe('placement metadata', () => {
    it.each([
      ['negative x', { ...BOX, x: -0.1 }],
      ['negative y', { ...BOX, y: -0.01 }],
      ['zero width', { ...BOX, width: 0 }],
      ['zero height', { ...BOX, height: 0 }],
      ['overflowing right edge', { ...BOX, x: 0.3, width: 0.8 }],
      ['overflowing bottom edge', { ...BOX, y: 0.5, height: 0.6 }],
      ['larger than the image', { x: 0, y: 0, width: 1.5, height: 1 }],
      ['NaN', { ...BOX, x: Number.NaN }],
      ['Infinity', { ...BOX, height: Number.POSITIVE_INFINITY }],
    ])('reports objectBounds with %s', (_label, objectBounds) => {
      expectOnly(withPlateImages([nudeImage({ src: NUDE_SRC }, { objectBounds })]), {
        code: 'invalid-placement',
        path: 'plates[0].images[0].objectBounds',
        id: 'test-plate-a',
      });
    });

    it.each([
      ['the full image', { x: 0, y: 0, width: 1, height: 1 }],
      ['edges reached by floating-point sums', { x: 0.7, y: 0.1, width: 0.3, height: 0.9 }],
    ])('accepts a box covering %s', (_label, objectBounds) => {
      expect(
        validateCatalog(withPlateImages([nudeImage({ src: NUDE_SRC }, { objectBounds })])),
      ).toEqual({ status: 'valid' });
    });

    it('reports an invalid text area and frame placement', () => {
      expectOnly(
        withPlateImages([nudeImage({ src: NUDE_SRC }, { text: { area: { ...BOX, width: -1 } } })]),
        { code: 'invalid-placement', path: 'plates[0].images[0].text.area', id: 'test-plate-a' },
      );
      expectOnly(
        withFrameImages([
          {
            plateId: 'test-plate-b',
            back: { src: '/catalog/frames/test-frame-any/b.webp' },
            platePlacement: { ...BOX, y: 0.9 },
          },
        ]),
        {
          code: 'invalid-placement',
          path: 'frames[0].images[0].platePlacement',
          id: 'test-frame-any',
        },
      );
    });

    it('reports a text area outside the object bounds', () => {
      expectOnly(
        withPlateImages([
          nudeImage(
            { src: NUDE_SRC },
            {
              objectBounds: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
              text: { area: { x: 0.1, y: 0.3, width: 0.5, height: 0.2 } },
            },
          ),
        ]),
        {
          code: 'invalid-placement',
          path: 'plates[0].images[0].text.area',
          id: 'test-plate-a',
          relatedPath: 'plates[0].images[0].objectBounds',
        },
      );
    });

    it('accepts a text area without object bounds', () => {
      const catalog = withPlateImages([nudeImage({ src: NUDE_SRC }, { text: { area: BOX } })]);
      expect(validateCatalog(catalog)).toEqual({ status: 'valid' });
    });

    it('reports an unknown text alignment from malformed runtime data', () => {
      const text = { area: BOX, align: 'justify' } as unknown as TextLayout;
      expectOnly(withPlateImages([nudeImage({ src: NUDE_SRC }, { text })]), {
        code: 'invalid-placement',
        path: 'plates[0].images[0].text.align',
        id: 'test-plate-a',
      });
    });
  });

  it('does not modify or repair an invalid image catalog', () => {
    const catalog = withPlateImages([
      nudeImage({ src: '../nude.webp', widthPx: 0 }, { objectBounds: { ...BOX, x: 2 } }),
    ]);
    const snapshot = structuredClone(catalog);

    validateCatalog(catalog);

    expect(catalog).toEqual(snapshot);
  });
});
