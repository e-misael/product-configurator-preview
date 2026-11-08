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
  colors: [
    { id: 'test-color-nude', type: 'color', displayName: 'Test nude', category: 'nude' },
    { id: 'test-color-colored', type: 'color', displayName: 'Test colored', category: 'colored' },
  ],
  plates: [
    {
      id: 'test-plate-square',
      type: 'plate',
      displayName: 'Test plate square',
      shape: 'square',
      supportsFrame: true,
      supportedColorCategories: ['nude', 'colored'],
      supportedColorIds: ['test-color-nude', 'test-color-colored'],
      dimensions: { status: 'pending' },
      images: [
        {
          colorCategory: 'nude',
          image: { src: '/catalog/plates/test-plate-square/nude.webp', alt: 'Square, nude' },
          objectBounds: BOUNDS,
          text: TEXT,
        },
        {
          colorCategory: 'colored',
          image: { src: '/catalog/plates/test-plate-square/colored.webp', alt: 'Square, colored' },
          objectBounds: BOUNDS,
          text: TEXT,
        },
        {
          colorCategory: 'colored',
          colorId: 'test-color-colored',
          image: {
            src: '/catalog/plates/test-plate-square/test-color-colored.webp',
            alt: 'Square, shade',
          },
          objectBounds: BOUNDS,
          text: TEXT,
        },
      ],
    },
    {
      // Calibration pending: no object bounds and no text area.
      id: 'test-plate-rectangle',
      type: 'plate',
      displayName: 'Test plate rectangle',
      shape: 'rectangle',
      supportsFrame: true,
      supportedColorCategories: ['nude'],
      supportedColorIds: [],
      dimensions: { status: 'pending' },
      images: [
        {
          colorCategory: 'nude',
          image: { src: '/catalog/plates/test-plate-rectangle/nude.webp', alt: 'Rectangle' },
        },
      ],
    },
    {
      id: 'test-plate-circle',
      type: 'plate',
      displayName: 'Test plate circle',
      shape: 'circle',
      supportsFrame: false,
      supportedColorCategories: ['nude'],
      supportedColorIds: [],
      dimensions: { status: 'pending' },
      images: [
        {
          colorCategory: 'nude',
          image: { src: '/catalog/plates/test-plate-circle/nude.webp' },
          objectBounds: BOUNDS,
          text: { area: { x: 0.25, y: 0.35, width: 0.5, height: 0.3 } },
        },
      ],
    },
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
  '/catalog/plates/test-plate-square/nude.webp': { width: 400, height: 400 },
  '/catalog/plates/test-plate-square/colored.webp': { width: 400, height: 400 },
  '/catalog/plates/test-plate-square/test-color-colored.webp': { width: 400, height: 400 },
  '/catalog/plates/test-plate-rectangle/nude.webp': { width: 600, height: 400 },
  '/catalog/plates/test-plate-circle/nude.webp': { width: 400, height: 400 },
  '/catalog/frames/test-frame-any/square-back.webp': { width: 500, height: 500 },
  '/catalog/frames/test-frame-any/square-front.webp': { width: 500, height: 500 },
  '/catalog/frames/test-frame-any/rectangle-back.webp': { width: 600, height: 400 },
};

export function config(overrides: Partial<Configuration> = {}): Configuration {
  return {
    plateId: 'test-plate-square',
    frameId: null,
    colorCategory: 'nude',
    colorId: null,
    text: 'Ana',
    ...overrides,
  };
}

export const validate = (value: Configuration, catalog: Catalog = previewCatalog) =>
  validateConfiguration(value, catalog);
