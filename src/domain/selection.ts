/**
 * Pure selection transitions. Unlike validation, these may change a
 * configuration, but only explicitly and with a report of what changed
 * (D-005, D-026).
 */

import type { Catalog, Configuration, ConfigurationField, Frame } from './types';
import { findPlate, isAvailable, isFrameCompatible } from './validation';

export interface SelectionResult {
  readonly config: Configuration;
  /** Fields reset to their empty value by this transition, for the UI to announce. */
  readonly cleared: readonly ConfigurationField[];
}

/**
 * Selects a plate. If the plate does not support frames, a selected frame is
 * cleared and reported in `cleared`. Nothing else is changed or substituted;
 * other conflicts (e.g. an incompatible frame) are left for validation.
 */
export function selectPlate(
  config: Configuration,
  plateId: string,
  catalog: Catalog,
): SelectionResult {
  const plate = findPlate(catalog, plateId);
  if (plate !== undefined && !plate.supportsFrame && config.frameId !== null) {
    return { config: { ...config, plateId, frameId: null }, cleared: ['frameId'] };
  }
  return { config: { ...config, plateId }, cleared: [] };
}

/** Available frames compatible with the plate; empty for unknown or frameless plates. */
export function getFrameOptions(catalog: Catalog, plateId: string): readonly Frame[] {
  const plate = findPlate(catalog, plateId);
  if (plate === undefined) return [];
  return catalog.frames.filter((frame) => isAvailable(frame) && isFrameCompatible(frame, plate));
}
