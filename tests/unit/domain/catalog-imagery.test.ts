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

/** Image catalog with plate A's photograph replaced. */
function withPlateImage(image: PlateImage): Catalog {
  const catalog = buildImageCatalog();
  return {
    ...catalog,
    plates: catalog.plates.map((p, i) => (i === 0 ? { ...p, image } : p)),
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

const plateImage = (image: AssetRef, extra: Partial<PlateImage> = {}): PlateImage => ({
  image,
  ...extra,
});
const PLATE_SRC = '/catalog/plates/test-plate-a/beige.webp';
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
    expect(validateCatalog(withPlateImage(plateImage({ src: PLATE_SRC })))).toEqual({
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
      '/catalog/plates/test-plate-a/beige.webp',
      '/catalog/plates/test-plate-a/beige-2.png',
      '/catalog/plates/test-plate-a/beige-3.jpg',
    ])('accepts %s', (src) => {
      expect(isValidAssetPath(src, 'plates', 'test-plate-a')).toBe(true);
    });

    it.each([
      ['empty', ''],
      ['whitespace', '  '],
      ['relative', 'catalog/plates/test-plate-a/beige.webp'],
      ['external URL', 'https://example.com/catalog/plates/test-plate-a/beige.webp'],
      ['protocol-relative URL', '//example.com/catalog/plates/test-plate-a/beige.webp'],
      ['data URI', 'data:image/png;base64,AAAA'],
      ['javascript scheme', 'javascript:alert(1)'],
      ['path traversal', '/catalog/plates/test-plate-a/../test-plate-b/beige.webp'],
      ['dot segment', '/catalog/plates/test-plate-a/./beige.webp'],
      ['encoded traversal', '/catalog/plates/test-plate-a/%2e%2e/beige.webp'],
      ['double slash', '/catalog/plates//test-plate-a/beige.webp'],
      ['backslash', '/catalog/plates/test-plate-a\\beige.webp'],
      ['query string', '/catalog/plates/test-plate-a/beige.webp?v=2'],
      ['fragment', '/catalog/plates/test-plate-a/beige.webp#x'],
      ['uppercase', '/catalog/plates/test-plate-a/Beige.webp'],
      ['spaces', '/catalog/plates/test-plate-a/beige plate.webp'],
      ['unsupported extension', '/catalog/plates/test-plate-a/beige.svg'],
      ['no extension', '/catalog/plates/test-plate-a/beige'],
      ['nested folder', '/catalog/plates/test-plate-a/extra/beige.webp'],
      ['another plate folder', '/catalog/plates/test-plate-b/beige.webp'],
      ['another owner type', '/catalog/frames/test-plate-a/beige.webp'],
      ['outside /catalog/', '/images/plates/test-plate-a/beige.webp'],
    ])('rejects %s', (_label, src) => {
      expect(isValidAssetPath(src, 'plates', 'test-plate-a')).toBe(false);
      expectOnly(withPlateImage(plateImage({ src })), {
        code: 'invalid-asset',
        path: 'plates[0].image.image.src',
        id: 'test-plate-a',
      });
    });

    it('rejects a non-string src from malformed runtime data', () => {
      expect(isValidAssetPath(42, 'plates', 'test-plate-a')).toBe(false);
    });

    it('requires frame layers in their owner folder', () => {
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
      const result = validateCatalog(withPlateImage(plateImage({ src: PLATE_SRC, ...size })));
      expect(result).toEqual({
        status: 'invalid',
        issues: sides.map((side) => ({
          code: 'invalid-asset',
          path: `plates[0].image.image.${side}`,
          id: 'test-plate-a',
        })),
      });
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
      expectOnly(withPlateImage(plateImage({ src: PLATE_SRC }, { objectBounds })), {
        code: 'invalid-placement',
        path: 'plates[0].image.objectBounds',
        id: 'test-plate-a',
      });
    });

    it.each([
      ['the full image', { x: 0, y: 0, width: 1, height: 1 }],
      ['edges reached by floating-point sums', { x: 0.7, y: 0.1, width: 0.3, height: 0.9 }],
    ])('accepts a box covering %s', (_label, objectBounds) => {
      expect(
        validateCatalog(withPlateImage(plateImage({ src: PLATE_SRC }, { objectBounds }))),
      ).toEqual({ status: 'valid' });
    });

    it('reports an invalid text area and frame placement', () => {
      expectOnly(
        withPlateImage(plateImage({ src: PLATE_SRC }, { text: { area: { ...BOX, width: -1 } } })),
        { code: 'invalid-placement', path: 'plates[0].image.text.area', id: 'test-plate-a' },
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
        withPlateImage(
          plateImage(
            { src: PLATE_SRC },
            {
              objectBounds: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
              text: { area: { x: 0.1, y: 0.3, width: 0.5, height: 0.2 } },
            },
          ),
        ),
        {
          code: 'invalid-placement',
          path: 'plates[0].image.text.area',
          id: 'test-plate-a',
          relatedPath: 'plates[0].image.objectBounds',
        },
      );
    });

    it('accepts a text area without object bounds', () => {
      const catalog = withPlateImage(plateImage({ src: PLATE_SRC }, { text: { area: BOX } }));
      expect(validateCatalog(catalog)).toEqual({ status: 'valid' });
    });

    it('reports an unknown text alignment from malformed runtime data', () => {
      const text = { area: BOX, align: 'justify' } as unknown as TextLayout;
      expectOnly(withPlateImage(plateImage({ src: PLATE_SRC }, { text })), {
        code: 'invalid-placement',
        path: 'plates[0].image.text.align',
        id: 'test-plate-a',
      });
    });
  });

  it('does not modify or repair an invalid image catalog', () => {
    const catalog = withPlateImage(
      plateImage({ src: '../beige.webp', widthPx: 0 }, { objectBounds: { ...BOX, x: 2 } }),
    );
    const snapshot = structuredClone(catalog);

    validateCatalog(catalog);

    expect(catalog).toEqual(snapshot);
  });
});
