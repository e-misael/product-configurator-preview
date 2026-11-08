import type { Catalog, Plate, TextColor } from '../../../src/domain';

/**
 * Test-only synthetic catalog for integrity tests. Values (including the
 * 100 mm dimensions) are deliberately fake and must never be used as real
 * product data. Returns a fresh mutable copy on every call.
 */
/** Fake lettering palette for tests; never product data. */
export const TEST_TEXT_COLORS: readonly TextColor[] = [
  { id: 'test-text-color-a', type: 'text-color', displayName: 'Test ink A', hex: '#112233' },
  { id: 'test-text-color-b', type: 'text-color', displayName: 'Test ink B', hex: '#aa2200' },
];

export function buildValidCatalog(): Catalog {
  const plates: Plate[] = [
    {
      id: 'test-plate-a',
      type: 'plate',
      displayName: 'Test plate A (square)',
      sizeLabel: 'Test size A',
      ceramicColor: 'Test beige',
      shape: 'square',
      dimensions: { status: 'defined', widthMm: 100, heightMm: 100 },
    },
    {
      id: 'test-plate-b',
      type: 'plate',
      displayName: 'Test plate B (rectangle)',
      sizeLabel: 'Test size B',
      ceramicColor: 'Test beige',
      shape: 'rectangle',
      dimensions: { status: 'pending' },
    },
    {
      id: 'test-plate-c',
      type: 'plate',
      displayName: 'Test plate C (circle)',
      sizeLabel: 'Test size C',
      ceramicColor: 'Test beige',
      shape: 'circle',
      dimensions: { status: 'pending' },
    },
  ];
  return { plates, textColors: TEST_TEXT_COLORS.map((color) => ({ ...color })) };
}

/**
 * The valid catalog with synthetic imagery: a plate photograph with placement
 * and text area. Paths, pixel sizes, and boxes are invented
 * test values; no files exist for them.
 */
export function buildImageCatalog(): Catalog {
  const catalog = buildValidCatalog();
  const [plateA, ...plates] = catalog.plates;
  if (!plateA) throw new Error('Unexpected fixture shape');
  return {
    textColors: catalog.textColors,
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
  };
}

/** Indexed access that fails loudly instead of returning `undefined`. */
export function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`Fixture index out of range: ${index}`);
  return item;
}
