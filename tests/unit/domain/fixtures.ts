import type { Catalog, Configuration, Plate } from '../../../src/domain';

function plate(id: string, shape: Plate['shape'], extra: Partial<Plate> = {}): Plate {
  return {
    id,
    type: 'plate',
    displayName: `Test ${id}`,
    sizeLabel: 'Test size',
    ceramicColor: 'Test beige',
    shape,
    dimensions: { status: 'pending' },
    ...extra,
  };
}

/**
 * Test-only fixtures. These are deliberately fake and must never be used as
 * real product data. IDs are prefixed with `test-` to make that obvious.
 */
export const testCatalog: Catalog = {
  plates: [
    plate('test-plate-square', 'square'),
    plate('test-plate-rectangle', 'rectangle'),
    plate('test-plate-circle', 'circle'),
    plate('test-plate-scalloped', 'scalloped'),
    plate('test-plate-unavailable', 'square', { available: false }),
  ],
  textColors: [
    { id: 'test-text-color-a', type: 'text-color', displayName: 'Test ink A', hex: '#112233' },
    { id: 'test-text-color-b', type: 'text-color', displayName: 'Test ink B', hex: '#aa2200' },
    {
      id: 'test-text-color-retired',
      type: 'text-color',
      displayName: 'Test ink retired',
      hex: '#888888',
      available: false,
    },
  ],
};

export function validConfiguration(overrides: Partial<Configuration> = {}): Configuration {
  return {
    plateId: 'test-plate-square',
    text: 'Casa da Ana',
    fontFamily: 'sans-serif',
    textColorId: 'test-text-color-a',
    secondaryColorId: null,
    secondaryRanges: [],
    textLayout: null,
    ...overrides,
  };
}
