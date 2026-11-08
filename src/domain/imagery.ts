/**
 * Pure image lookups (D-032, D-033). They select catalog imagery for a
 * selection by exact match and never substitute another variation or plate.
 * Whether a file actually loads is the renderer's concern (M3).
 */

import type { ColorCategory, Frame, FrameImage, Plate, PlateImage } from './types';

export type ImageLookup<T> =
  { readonly status: 'available'; readonly image: T } | { readonly status: 'pending' };

const PENDING = { status: 'pending' } as const;

/**
 * The photograph of the plate in the selected category and shade. Pending
 * when no category is selected or no image matches exactly; a category-level
 * photograph is not used for a specific shade.
 */
export function findPlateImage(
  plate: Plate,
  colorCategory: ColorCategory | null,
  colorId: string | null,
): ImageLookup<PlateImage> {
  if (colorCategory === null) return PENDING;
  const image = plate.images?.find(
    (entry) => entry.colorCategory === colorCategory && (entry.colorId ?? null) === colorId,
  );
  return image === undefined ? PENDING : { status: 'available', image };
}

/** The frame imagery calibrated for the plate model; pending when none is registered. */
export function findFrameImage(frame: Frame, plateId: string): ImageLookup<FrameImage> {
  const image = frame.images?.find((entry) => entry.plateId === plateId);
  return image === undefined ? PENDING : { status: 'available', image };
}
