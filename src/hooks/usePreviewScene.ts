import { useMemo } from 'react';
import type { Catalog, Configuration, ValidationResult } from '../domain';
import { composeIllustration, composePreview, compositionSources } from '../preview/composition';
import { createTextMeasurer } from '../preview/draw';
import { buildScene } from '../preview/scene';
import { useImages } from './useImages';

/**
 * The one scene for the configuration (D-037): the preview paints it, the
 * position controls read its text block, and export renders it (D-009).
 * `illustration` is the model whose photograph stands in while a model
 * group waits for its size; it is never part of the configuration.
 */
export function usePreviewScene(
  catalog: Catalog,
  config: Configuration,
  validation: ValidationResult,
  illustration?: string,
) {
  const composition = useMemo(
    () =>
      config.plateId === null && illustration !== undefined
        ? composeIllustration(catalog, illustration)
        : composePreview(catalog, config, validation),
    [catalog, config, validation, illustration],
  );
  const measure = useMemo(() => createTextMeasurer(config.fontFamily), [config.fontFamily]);
  const images = useImages(compositionSources(composition));
  return useMemo(() => buildScene(composition, images, measure), [composition, images, measure]);
}
