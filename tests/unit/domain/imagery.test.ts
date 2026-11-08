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
  it('returns the category photograph when no shade is selected', () => {
    expect(imageSrc(findPlateImage(plateA, 'nude', null))).toBe(
      '/catalog/plates/test-plate-a/nude.webp',
    );
  });

  it('returns the photograph of the exact shade', () => {
    expect(imageSrc(findPlateImage(plateA, 'colored', 'test-color-colored'))).toBe(
      '/catalog/plates/test-plate-a/test-color-colored.png',
    );
  });

  it('is pending when no color category is selected (no default photograph)', () => {
    expect(findPlateImage(plateA, null, null)).toEqual({ status: 'pending' });
  });

  it('does not fall back to the category photograph for a specific shade', () => {
    expect(findPlateImage(plateA, 'nude', 'test-color-nude')).toEqual({ status: 'pending' });
  });

  it('does not fall back to a shade photograph for the category alone', () => {
    expect(findPlateImage(plateA, 'colored', null)).toEqual({ status: 'pending' });
  });

  it('does not use another plate model or category', () => {
    expect(findPlateImage(plateB, 'nude', null)).toEqual({ status: 'pending' });
    expect(findPlateImage(plateA, 'nude', 'test-color-colored')).toEqual({ status: 'pending' });
  });

  it('returns the placement metadata with the photograph', () => {
    const lookup = findPlateImage(plateA, 'nude', null);
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
  const configs: Configuration[] = [
    {
      plateId: 'test-plate-a',
      frameId: null,
      colorCategory: 'nude',
      colorId: null,
      text: 'Ana',
    },
    {
      plateId: 'test-plate-a',
      frameId: 'test-frame-any',
      colorCategory: 'colored',
      colorId: 'test-color-nude',
      text: '',
    },
    {
      plateId: 'test-plate-b',
      frameId: 'test-frame-plate-a',
      colorCategory: null,
      colorId: null,
      text: 'Ana',
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
    expect(findPlateImage(plateB, 'nude', null)).toEqual({ status: 'pending' });
    expect(validateConfiguration(pending, catalog)).toEqual({ status: 'valid' });
  });
});
