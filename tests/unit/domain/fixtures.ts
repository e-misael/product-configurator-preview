import type { Catalog, Configuration } from '../../../src/domain';

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
    {
      id: 'test-plate-a',
      type: 'plate',
      displayName: 'Test plate A',
      supportedShapes: ['square', 'rectangle'],
      supportedColorCategories: ['nude', 'colored'],
      supportedColorIds: ['test-color-nude', 'test-color-colored', 'test-color-retired'],
      dimensions: { square: { status: 'pending' }, rectangle: { status: 'pending' } },
    },
    {
      id: 'test-plate-square-nude',
      type: 'plate',
      displayName: 'Test plate square nude',
      supportedShapes: ['square'],
      supportedColorCategories: ['nude'],
      supportedColorIds: [],
      dimensions: { square: { status: 'pending' } },
    },
    {
      id: 'test-plate-unavailable',
      type: 'plate',
      displayName: 'Test plate unavailable',
      available: false,
      supportedShapes: ['square'],
      supportedColorCategories: ['nude'],
      supportedColorIds: [],
      dimensions: {},
    },
  ],
  frames: [
    {
      id: 'test-frame-any',
      type: 'frame',
      displayName: 'Test frame both shapes',
      compatibility: { shapes: ['square', 'rectangle'] },
    },
    {
      id: 'test-frame-square',
      type: 'frame',
      displayName: 'Test frame square',
      compatibility: { shapes: ['square'] },
    },
    {
      id: 'test-frame-plate-a-only',
      type: 'frame',
      displayName: 'Test frame plate A only',
      compatibility: { shapes: ['square', 'rectangle'], plateIds: ['test-plate-a'] },
    },
    {
      id: 'test-frame-square-plate-a-only',
      type: 'frame',
      displayName: 'Test frame square, plate A only',
      compatibility: { shapes: ['square'], plateIds: ['test-plate-a'] },
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
    plateId: 'test-plate-a',
    frameId: null,
    colorCategory: 'nude',
    colorId: null,
    shape: 'square',
    text: 'Casa da Ana',
    ...overrides,
  };
}
