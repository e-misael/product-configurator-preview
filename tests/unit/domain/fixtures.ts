import type { Catalog, Configuration, Plate } from '../../../src/domain';

function plate(
  id: string,
  shape: Plate['shape'],
  supportsFrame: boolean,
  extra: Partial<Plate> = {},
): Plate {
  return {
    id,
    type: 'plate',
    displayName: `Test ${id}`,
    shape,
    supportsFrame,
    supportedColorCategories: ['nude'],
    supportedColorIds: [],
    dimensions: { status: 'pending' },
    ...extra,
  };
}

/**
 * Test-only fixtures. These are deliberately fake and must never be used as
 * real product data. IDs are prefixed with `test-` to make that obvious.
 */
export const testCatalog: Catalog = {
  colors: [
    { id: 'test-color-nude', type: 'color', displayName: 'Test nude', category: 'nude' },
    { id: 'test-color-colored', type: 'color', displayName: 'Test colored', category: 'colored' },
    {
      id: 'test-color-retired',
      type: 'color',
      displayName: 'Test retired',
      category: 'nude',
      available: false,
    },
    { id: 'test-color-unsupported', type: 'color', displayName: 'Test other', category: 'nude' },
  ],
  plates: [
    plate('test-plate-square', 'square', true, {
      supportedColorCategories: ['nude', 'colored'],
      supportedColorIds: ['test-color-nude', 'test-color-colored', 'test-color-retired'],
    }),
    plate('test-plate-rectangle', 'rectangle', true),
    plate('test-plate-square-b', 'square', true),
    plate('test-plate-circle', 'circle', false),
    // Capability, not shape, decides frame support.
    plate('test-plate-square-frameless', 'square', false),
    plate('test-plate-unavailable', 'square', true, { available: false }),
  ],
  frames: [
    {
      id: 'test-frame-any',
      type: 'frame',
      displayName: 'Test frame square and rectangle',
      compatibility: { shapes: ['square', 'rectangle'] },
    },
    {
      id: 'test-frame-square',
      type: 'frame',
      displayName: 'Test frame square',
      compatibility: { shapes: ['square'] },
    },
    {
      id: 'test-frame-square-plate-only',
      type: 'frame',
      displayName: 'Test frame square, test-plate-square only',
      compatibility: { shapes: ['square'], plateIds: ['test-plate-square'] },
    },
    {
      id: 'test-frame-unavailable',
      type: 'frame',
      displayName: 'Test frame unavailable',
      available: false,
      compatibility: { shapes: ['square', 'rectangle'] },
    },
  ],
};

export function validConfiguration(overrides: Partial<Configuration> = {}): Configuration {
  return {
    plateId: 'test-plate-square',
    frameId: null,
    colorCategory: 'nude',
    colorId: null,
    text: 'Casa da Ana',
    ...overrides,
  };
}
