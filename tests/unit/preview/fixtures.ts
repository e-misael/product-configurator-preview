import type { Catalog, Configuration } from '../../../src/domain';
import { validateConfiguration } from '../../../src/domain';
import type { Size } from '../support/fake-image';

/**
 * Synthetic catalog with imagery for preview tests. Every path, size, and box
 * is an invented test value; no files exist for them.
 */
const BOUNDS = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
const TEXT = {
  area: { x: 0.2, y: 0.3, width: 0.6, height: 0.4 },
  align: 'center',
  fontSize: 0.1,
} as const;

export const previewCatalog: Catalog = {
  plates: [
    {
      id: 'test-plate-square',
      type: 'plate',
      displayName: 'Test plate square',
      sizeLabel: 'Test size',
      ceramicColor: 'Test beige',
      shape: 'square',
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
      dimensions: { status: 'pending' },
      image: {
        image: { src: '/catalog/plates/test-plate-circle/beige.webp' },
        objectBounds: BOUNDS,
        text: { area: { x: 0.25, y: 0.35, width: 0.5, height: 0.3 }, fontSize: 0.075 },
      },
    },
    {
      // Text area calibrated, lettering size not yet approved (D-055).
      id: 'test-plate-size-pending',
      type: 'plate',
      displayName: 'Test plate size pending',
      sizeLabel: 'Test size',
      ceramicColor: 'Test beige',
      shape: 'square',
      dimensions: { status: 'pending' },
      image: {
        image: { src: '/catalog/plates/test-plate-size-pending/beige.webp', alt: 'Size pending' },
        objectBounds: BOUNDS,
        text: { area: { x: 0.2, y: 0.3, width: 0.6, height: 0.4 }, align: 'center' },
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
      dimensions: { status: 'pending' },
    },
  ],
  textColors: [
    { id: 'test-text-color-a', type: 'text-color', displayName: 'Test ink A', hex: '#112233' },
    { id: 'test-text-color-b', type: 'text-color', displayName: 'Test ink B', hex: '#aa2200' },
  ],
};

/** Natural sizes of the fixture's files. */
export const previewSizes: Record<string, Size> = {
  '/catalog/plates/test-plate-square/beige.webp': { width: 400, height: 400 },
  '/catalog/plates/test-plate-rectangle/beige.webp': { width: 600, height: 400 },
  '/catalog/plates/test-plate-circle/beige.webp': { width: 400, height: 400 },
  '/catalog/plates/test-plate-size-pending/beige.webp': { width: 400, height: 400 },
};

export function config(overrides: Partial<Configuration> = {}): Configuration {
  return {
    plateId: 'test-plate-square',
    text: 'Ana',
    fontFamily: 'sans-serif',
    textColorId: 'test-text-color-a',
    secondaryColorId: null,
    secondaryRanges: [],
    textLayout: null,
    ...overrides,
  };
}

export const validate = (value: Configuration, catalog: Catalog = previewCatalog) =>
  validateConfiguration(value, catalog);
