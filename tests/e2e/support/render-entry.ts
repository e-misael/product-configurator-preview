/**
 * Browser bundle for rendering.spec.ts: the app's real catalog, composition,
 * scene layout, and Canvas painting, without React. Bundled at test time.
 */
export { getCatalog } from '../../../src/catalog';
export { demoCatalog } from '../../../src/demo/demo-catalog';
export { createEmptyConfiguration, validateConfiguration } from '../../../src/domain';
export { composePreview } from '../../../src/preview/composition';
export { createTextMeasurer, drawScene, fontFor } from '../../../src/preview/draw';
export { DEBOSS } from '../../../src/preview/deboss';
export { buildScene } from '../../../src/preview/scene';
export { MARK_INK, SIGNATURE, WATERMARK_SRC } from '../../../src/preview/watermark';
