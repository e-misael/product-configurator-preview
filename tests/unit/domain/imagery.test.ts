import {
  findPlateImage,
  validateConfiguration,
  type Catalog,
  type Configuration,
} from '../../../src/domain';
import { at, buildImageCatalog, buildValidCatalog } from './catalog-fixtures';

const catalog = buildImageCatalog();
const plateA = at(catalog.plates, 0);
const plateB = at(catalog.plates, 1);
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

describe('configuration validation is independent of imagery', () => {
  const style = {
    fontFamily: 'sans-serif',
    textColorId: 'test-text-color-a',
    secondaryColorId: null,
    secondaryRanges: [],
    textLayout: null,
  } as const;
  const configs: Configuration[] = [
    { plateId: 'test-plate-a', text: 'Ana', ...style },
    { plateId: 'test-plate-a', text: '', ...style },
    { plateId: 'test-plate-b', text: 'Ana', ...style },
  ];
  const withoutImages: Catalog = buildValidCatalog();

  it.each(configs.map((config) => [`${config.plateId} "${config.text}"`, config] as const))(
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
