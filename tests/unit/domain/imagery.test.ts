import {
  findFrameImage,
  findPlateImage,
  validateConfiguration,
  type Catalog,
  type Configuration,
} from '../../../src/domain';
import { at, buildImageCatalog, buildValidCatalog } from './catalog-fixtures';

const catalog = buildImageCatalog();
const plateA = at(catalog.plates, 0);
const plateB = at(catalog.plates, 1);
const frameAny = at(catalog.frames, 0);
const imageSrc = (lookup: ReturnType<typeof findPlateImage>) =>
  lookup.status === 'available' ? lookup.image.image.src : undefined;

describe('findPlateImage', () => {
  it("returns the model's own photograph", () => {
    expect(imageSrc(findPlateImage(plateA))).toBe('/catalog/plates/test-plate-a/beige.webp');
  });

  it('is pending for a model without a photograph (no fallback to another model)', () => {
    expect(findPlateImage(plateB)).toEqual({ status: 'pending' });
  });

  it('returns the placement metadata with the photograph', () => {
    const lookup = findPlateImage(plateA);
    expect(lookup.status === 'available' && lookup.image.text).toEqual({
      area: { x: 0.2, y: 0.3, width: 0.6, height: 0.4 },
      align: 'center',
    });
  });
});

describe('findFrameImage', () => {
  it('returns the layers calibrated for the plate model', () => {
    const lookup = findFrameImage(frameAny, 'test-plate-b');
    expect(lookup.status === 'available' && lookup.image).toMatchObject({
      back: { src: '/catalog/frames/test-frame-any/test-plate-b-back.webp' },
      front: { src: '/catalog/frames/test-frame-any/test-plate-b-front.png' },
    });
  });

  it('is pending for a compatible plate without calibrated imagery', () => {
    expect(findFrameImage(frameAny, 'test-plate-a')).toEqual({ status: 'pending' });
  });

  it('is pending for a frame without images', () => {
    expect(findFrameImage(at(catalog.frames, 1), 'test-plate-a')).toEqual({ status: 'pending' });
  });
});

describe('configuration validation is independent of imagery', () => {
  const style = {
    fontFamily: 'sans-serif',
    textColorId: 'test-text-color-a',
    secondaryColorId: null,
    secondaryRanges: [],
  } as const;
  const configs: Configuration[] = [
    {
      plateId: 'test-plate-a',
      frameId: null,
      text: 'Ana',
      ...style,
    },
    {
      plateId: 'test-plate-a',
      frameId: 'test-frame-any',
      text: '',
      ...style,
    },
    {
      plateId: 'test-plate-b',
      frameId: 'test-frame-plate-a',
      text: 'Ana',
      ...style,
    },
  ];
  const withoutImages: Catalog = buildValidCatalog();

  it.each(configs.map((config) => [config.plateId, config] as const))(
    'gives the same result with and without images (%s)',
    (_id, config) => {
      expect(validateConfiguration(config, catalog)).toEqual(
        validateConfiguration(config, withoutImages),
      );
    },
  );

  it('accepts a valid configuration whose image is pending', () => {
    const config = configs[0];
    if (!config) throw new Error('fixture');
    const pending = { ...config, plateId: 'test-plate-b' };
    expect(findPlateImage(plateB)).toEqual({ status: 'pending' });
    expect(validateConfiguration(pending, catalog)).toEqual({ status: 'valid' });
  });
});
