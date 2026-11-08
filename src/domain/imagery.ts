/**
 * Pure image lookups (D-032, D-033, D-041). They return the catalog's imagery
 * for a model or a frame/model pair, and never substitute another product's
 * image. Whether a file actually loads is the renderer's concern.
 */

import type { Frame, FrameImage, Plate, PlateImage } from './types';

export type ImageLookup<T> =
  { readonly status: 'available'; readonly image: T } | { readonly status: 'pending' };

const PENDING = { status: 'pending' } as const;

/** The model's photograph; pending until the store supplies it. */
export function findPlateImage(plate: Plate): ImageLookup<PlateImage> {
  return plate.image === undefined ? PENDING : { status: 'available', image: plate.image };
}

/** The frame imagery calibrated for the model; pending when none is registered. */
export function findFrameImage(frame: Frame, plateId: string): ImageLookup<FrameImage> {
  const image = frame.images?.find((entry) => entry.plateId === plateId);
  return image === undefined ? PENDING : { status: 'available', image };
}
