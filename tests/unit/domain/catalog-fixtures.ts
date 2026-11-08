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
    },
    { id: 'test-color-colored', type: 'color', displayName: 'Test colored', category: 'colored' },
  ];
  const plates: Plate[] = [
    {
      id: 'test-plate-a',
      type: 'plate',
      displayName: 'Test plate A (square)',
      shape: 'square',
      supportsFrame: true,
      supportedColorCategories: ['nude', 'colored'],
      supportedColorIds: ['test-color-nude', 'test-color-colored'],
      dimensions: { status: 'defined', widthMm: 100, heightMm: 100 },
    },
    {
      id: 'test-plate-b',
      type: 'plate',
      displayName: 'Test plate B (rectangle)',
      shape: 'rectangle',
      supportsFrame: true,
      supportedColorCategories: ['nude'],
      supportedColorIds: [],
      dimensions: { status: 'pending' },
    },
    {
      id: 'test-plate-c',
      type: 'plate',
      displayName: 'Test plate C (circle)',
      shape: 'circle',
      supportsFrame: false,
      supportedColorCategories: ['nude'],
      supportedColorIds: ['test-color-nude'],
      dimensions: { status: 'pending' },
    },
  ];
  const frames: Frame[] = [
    {
      id: 'test-frame-any',
      type: 'frame',
      displayName: 'Test frame any',
      compatibility: { shapes: ['square', 'rectangle'] },
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

/**
 * The valid catalog with synthetic imagery: a swatch, plate photographs per
 * variation with placement, and frame layers. Paths, pixel sizes, and boxes
 * are invented test values; no files exist for them.
 */
export function buildImageCatalog(): Catalog {
  const catalog = buildValidCatalog();
  const [nude, ...colors] = catalog.colors;
  const [plateA, ...plates] = catalog.plates;
  const [frameAny, ...frames] = catalog.frames;
  if (!nude || !plateA || !frameAny) throw new Error('Unexpected fixture shape');
  return {
    colors: [{ ...nude, swatch: { src: '/catalog/colors/test-color-nude/swatch.png' } }, ...colors],
    plates: [
      {
        ...plateA,
        images: [
          {
            colorCategory: 'nude',
            image: {
              src: '/catalog/plates/test-plate-a/nude.webp',
              alt: 'Test plate A',
              widthPx: 1000,
              heightPx: 1000,
            },
            objectBounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
            text: { area: { x: 0.2, y: 0.3, width: 0.6, height: 0.4 }, align: 'center' },
          },
          {
            colorCategory: 'colored',
            colorId: 'test-color-colored',
            image: { src: '/catalog/plates/test-plate-a/test-color-colored.png' },
          },
        ],
      },
      ...plates,
    ],
    frames: [
      {
        ...frameAny,
        images: [
          {
            plateId: 'test-plate-b',
            back: { src: '/catalog/frames/test-frame-any/test-plate-b-back.webp' },
            front: { src: '/catalog/frames/test-frame-any/test-plate-b-front.png' },
            platePlacement: { x: 0.15, y: 0.2, width: 0.7, height: 0.6 },
          },
        ],
      },
      ...frames,
    ],
  };
}

/** Indexed access that fails loudly instead of returning `undefined`. */
export function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`Fixture index out of range: ${index}`);
  return item;
}
