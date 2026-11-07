import type { Catalog, Frame, Plate, PlateColor } from '../../../src/domain';

/**
 * Test-only synthetic catalog for integrity tests. Values (including the
 * 100 mm dimensions) are deliberately fake and must never be used as real
 * product data. Returns a fresh mutable copy on every call.
 */
export function buildValidCatalog(): Catalog {
  const colors: PlateColor[] = [
    {
      id: 'test-color-nude',
      type: 'color',
      displayName: 'Test nude',
      category: 'nude',
      swatch: { src: '/catalog/test/swatch-nude.png' },
    },
    { id: 'test-color-colored', type: 'color', displayName: 'Test colored', category: 'colored' },
  ];
  const plates: Plate[] = [
    {
      id: 'test-plate-a',
      type: 'plate',
      displayName: 'Test plate A',
      supportedShapes: ['square', 'rectangle'],
      supportedColorCategories: ['nude', 'colored'],
      supportedColorIds: ['test-color-nude', 'test-color-colored'],
      dimensions: {
        square: { status: 'defined', widthMm: 100, heightMm: 100 },
        rectangle: { status: 'pending' },
      },
      assets: { square: { src: '/catalog/test/plate-a-square.png', alt: 'Test plate A' } },
    },
    {
      id: 'test-plate-b',
      type: 'plate',
      displayName: 'Test plate B',
      supportedShapes: ['square'],
      supportedColorCategories: ['nude'],
      supportedColorIds: [],
      dimensions: {},
    },
  ];
  const frames: Frame[] = [
    {
      id: 'test-frame-any',
      type: 'frame',
      displayName: 'Test frame any',
      compatibility: { shapes: ['square', 'rectangle'] },
      assets: { rectangle: { src: '/catalog/test/frame-any-rectangle.png' } },
    },
    {
      id: 'test-frame-plate-a',
      type: 'frame',
      displayName: 'Test frame plate A',
      compatibility: { shapes: ['square'], plateIds: ['test-plate-a'] },
    },
  ];
  return { colors, plates, frames };
}

/** Indexed access that fails loudly instead of returning `undefined`. */
export function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`Fixture index out of range: ${index}`);
  return item;
}
