/**
 * Pure image lookups (D-032, D-041). They return the catalog's photograph of a
 * model and never substitute another product's image. Whether a file actually
 * loads is the renderer's concern.
 */

import type { Plate, PlateImage } from './types';

export type ImageLookup<T> =
  { readonly status: 'available'; readonly image: T } | { readonly status: 'pending' };

const PENDING = { status: 'pending' } as const;

/** The model's photograph; pending until the store supplies it. */
export function findPlateImage(plate: Plate): ImageLookup<PlateImage> {
  return plate.image === undefined ? PENDING : { status: 'available', image: plate.image };
}
