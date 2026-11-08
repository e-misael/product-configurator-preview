import type { Catalog, Configuration } from '../../../src/domain';
import { validateConfiguration } from '../../../src/domain';
import type { Size } from '../support/fake-image';

/**
 * Synthetic catalog with imagery for preview tests. Every path, size, and box
 * is an invented test value; no files exist for them.
 */
const BOUNDS = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
const TEXT = { area: { x: 0.2, y: 0.3, width: 0.6, height: 0.4 }, align: 'center' } as const;

export const previewCatalog: Catalog = {
  plates: [
    {
      id: 'test-plate-square',
      type: 'plate',
      displayName: 'Test plate square',
      sizeLabel: 'Test size',
      ceramicColor: 'Test beige',
      shape: 'square',
      supportsFrame: true,
      dimensions: { status: 'pending' },
      image: {
        image: { src: '/catalog/plates/test-plate-square/beige.webp', alt: 'Square' },
        objectBounds: BOUNDS,
        text: TEXT,
      },
    },
    {
      // Calibration pending: no object bounds and no text area.
      id: 'test-plate-rectangle',
      type: 'plate',
      displayName: 'Test plate rectangle',
      sizeLabel: 'Test size',
      ceramicColor: 'Test beige',
      shape: 'rectangle',
      supportsFrame: true,
      dimensions: { status: 'pending' },
      image: {
        image: { src: '/catalog/plates/test-plate-rectangle/beige.webp', alt: 'Rectangle' },
      },
    },
    {
      id: 'test-plate-circle',
      type: 'plate',
      displayName: 'Test plate circle',
      sizeLabel: 'Test size',
      ceramicColor: 'Test beige',
      shape: 'circle',
      supportsFrame: false,
      dimensions: { status: 'pending' },
      image: {
        image: { src: '/catalog/plates/test-plate-circle/beige.webp' },
        objectBounds: BOUNDS,
        text: { area: { x: 0.25, y: 0.35, width: 0.5, height: 0.3 } },
      },
    },
    {
      // No photograph registered yet (the production state of every model).
      id: 'test-plate-pending',
      type: 'plate',
      displayName: 'Test plate pending',
      sizeLabel: 'Test size',
      ceramicColor: 'Test beige',
      shape: 'square',
      supportsFrame: false,
      dimensions: { status: 'pending' },
    },
  ],
  textColors: [
    { id: 'test-text-color-a', type: 'text-color', displayName: 'Test ink A', hex: '#112233' },
    { id: 'test-text-color-b', type: 'text-color', displayName: 'Test ink B', hex: '#aa2200' },
  ],
  frames: [
    {
      id: 'test-frame-any',
      type: 'frame',
      displayName: 'Test frame any',
      compatibility: { shapes: ['square', 'rectangle'] },
      images: [
        {
          plateId: 'test-plate-square',
          back: { src: '/catalog/frames/test-frame-any/square-back.webp', alt: 'Frame, square' },
          front: { src: '/catalog/frames/test-frame-any/square-front.webp' },
          platePlacement: BOUNDS,
        },
        {
          // Image registered but not calibrated for this plate.
          plateId: 'test-plate-rectangle',
          back: { src: '/catalog/frames/test-frame-any/rectangle-back.webp' },
        },
      ],
    },
    {
      // Compatible with squares but no imagery registered.
      id: 'test-frame-square',
      type: 'frame',
      displayName: 'Test frame square',
      compatibility: { shapes: ['square'] },
    },
  ],
};

/** Natural sizes of the fixture's files. */
export const previewSizes: Record<string, Size> = {
  '/catalog/plates/test-plate-square/beige.webp': { width: 400, height: 400 },
  '/catalog/plates/test-plate-rectangle/beige.webp': { width: 600, height: 400 },
  '/catalog/plates/test-plate-circle/beige.webp': { width: 400, height: 400 },
  '/catalog/frames/test-frame-any/square-back.webp': { width: 500, height: 500 },
  '/catalog/frames/test-frame-any/square-front.webp': { width: 500, height: 500 },
  '/catalog/frames/test-frame-any/rectangle-back.webp': { width: 600, height: 400 },
};

export function config(overrides: Partial<Configuration> = {}): Configuration {
  return {
    plateId: 'test-plate-square',
    frameId: null,
    text: 'Ana',
    fontFamily: 'sans-serif',
    textColorId: 'test-text-color-a',
    secondaryColorId: null,
    secondaryRanges: [],
    ...overrides,
  };
}

export const validate = (value: Configuration, catalog: Catalog = previewCatalog) =>
  validateConfiguration(value, catalog);
