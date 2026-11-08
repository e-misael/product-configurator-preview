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
    sizeLabel: 'Test size',
    ceramicColor: 'Test beige',
    shape,
    supportsFrame,
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
    plate('test-plate-square', 'square', true),
    plate('test-plate-rectangle', 'rectangle', true),
    plate('test-plate-square-b', 'square', true),
    plate('test-plate-circle', 'circle', false),
    plate('test-plate-scalloped', 'scalloped', false),
    // Capability, not shape, decides frame support.
    plate('test-plate-square-frameless', 'square', false),
    plate('test-plate-unavailable', 'square', true, { available: false }),
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
    text: 'Casa da Ana',
    fontFamily: 'sans-serif',
    textColorId: 'test-text-color-a',
    secondaryColorId: null,
    secondaryRanges: [],
    ...overrides,
  };
}
