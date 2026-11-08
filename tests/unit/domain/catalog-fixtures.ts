import type { Catalog, Frame, Plate } from '../../../src/domain';

/**
 * Test-only synthetic catalog for integrity tests. Values (including the
 * 100 mm dimensions) are deliberately fake and must never be used as real
 * product data. Returns a fresh mutable copy on every call.
 */
export function buildValidCatalog(): Catalog {
  const plates: Plate[] = [
    {
      id: 'test-plate-a',
      type: 'plate',
      displayName: 'Test plate A (square)',
      sizeLabel: 'Test size A',
      ceramicColor: 'Test beige',
      shape: 'square',
      supportsFrame: true,
      dimensions: { status: 'defined', widthMm: 100, heightMm: 100 },
    },
    {
      id: 'test-plate-b',
      type: 'plate',
      displayName: 'Test plate B (rectangle)',
      sizeLabel: 'Test size B',
      ceramicColor: 'Test beige',
      shape: 'rectangle',
      supportsFrame: true,
      dimensions: { status: 'pending' },
    },
    {
      id: 'test-plate-c',
      type: 'plate',
      displayName: 'Test plate C (circle)',
      sizeLabel: 'Test size C',
      ceramicColor: 'Test beige',
      shape: 'circle',
      supportsFrame: false,
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
  return { plates, frames };
}

/**
 * The valid catalog with synthetic imagery: a plate photograph with placement
 * and text area, and frame layers. Paths, pixel sizes, and boxes are invented
 * test values; no files exist for them.
 */
export function buildImageCatalog(): Catalog {
  const catalog = buildValidCatalog();
  const [plateA, ...plates] = catalog.plates;
  const [frameAny, ...frames] = catalog.frames;
  if (!plateA || !frameAny) throw new Error('Unexpected fixture shape');
  return {
    plates: [
      {
        ...plateA,
        image: {
          image: {
            src: '/catalog/plates/test-plate-a/beige.webp',
            alt: 'Test plate A',
            widthPx: 1000,
            heightPx: 1000,
          },
          objectBounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
          text: { area: { x: 0.2, y: 0.3, width: 0.6, height: 0.4 }, align: 'center' },
        },
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
