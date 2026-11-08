import { deepFreeze } from '../catalog/deep-freeze';
import type { Catalog } from '../domain';

/**
 * DEMONSTRATION DATA — NOT REAL PRODUCTS (D-028).
 *
 * Loaded only in demo mode (`--mode demo`) to exercise the configuration
 * workflow while the production catalog is empty. Every ID starts with
 * `demo-`, every name is labeled "(demonstração)", dimensions are pending,
 * and there are no image assets. Never copy these entries into
 * src/catalog/data.ts.
 */
export const demoCatalog: Catalog = deepFreeze({
  colors: [
    {
      id: 'demo-cor-nude',
      type: 'color',
      displayName: 'Tom nude (demonstração)',
      category: 'nude',
    },
    {
      id: 'demo-cor-colorida',
      type: 'color',
      displayName: 'Tom colorido (demonstração)',
      category: 'colored',
    },
  ],
  plates: [
    {
      id: 'demo-placa-quadrada',
      type: 'plate',
      displayName: 'Placa quadrada (demonstração)',
      shape: 'square',
      supportsFrame: true,
      supportedColorCategories: ['nude', 'colored'],
      supportedColorIds: ['demo-cor-nude', 'demo-cor-colorida'],
      dimensions: { status: 'pending' },
    },
    {
      id: 'demo-placa-retangular',
      type: 'plate',
      displayName: 'Placa retangular (demonstração)',
      shape: 'rectangle',
      supportsFrame: true,
      supportedColorCategories: ['nude', 'colored'],
      supportedColorIds: ['demo-cor-nude', 'demo-cor-colorida'],
      dimensions: { status: 'pending' },
    },
    {
      id: 'demo-placa-redonda',
      type: 'plate',
      displayName: 'Placa redonda (demonstração)',
      shape: 'circle',
      supportsFrame: false,
      supportedColorCategories: ['nude'],
      supportedColorIds: ['demo-cor-nude'],
      dimensions: { status: 'pending' },
    },
  ],
  frames: [
    {
      id: 'demo-quadro-universal',
      type: 'frame',
      displayName: 'Quadro quadrado e retangular (demonstração)',
      compatibility: { shapes: ['square', 'rectangle'] },
    },
    {
      id: 'demo-quadro-quadrado',
      type: 'frame',
      displayName: 'Quadro só para placas quadradas (demonstração)',
      compatibility: { shapes: ['square'] },
    },
  ],
});
