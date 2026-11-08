/**
 * Preview composition (D-009, D-037): turns a configuration, its validation
 * result, and the catalog into a description of the visual layers. Pure: no
 * React, DOM, or image loading. It reads catalog imagery by exact match and
 * contains no product rules or per-product coordinates.
 */

import {
  findFrame,
  findFrameImage,
  findPlate,
  findPlateImage,
  type Catalog,
  type Configuration,
  type ConfigurationField,
  type NormalizedBox,
  type TextAlignment,
  type ValidationResult,
} from '../domain';

/** Why part of the preview is not shown. Wording lives in the UI layer. */
export type PreviewNoticeCode =
  | 'plate-not-selected'
  | 'plate-invalid'
  | 'color-not-selected'
  | 'color-invalid'
  | 'plate-image-pending'
  | 'plate-image-loading'
  | 'plate-image-error'
  | 'frame-invalid'
  | 'frame-image-pending'
  | 'frame-not-calibrated'
  | 'frame-image-loading'
  | 'frame-image-error'
  | 'frame-layers-mismatch'
  | 'text-area-pending'
  | 'text-overflow';

export interface PlateLayer {
  readonly src: string;
  readonly alt: string | undefined;
  /** Where the ceramic object sits in the photograph; the whole image when pending. */
  readonly objectBounds: NormalizedBox | undefined;
}

export interface FrameLayer {
  readonly backSrc: string;
  readonly frontSrc: string | undefined;
  readonly alt: string | undefined;
  /** Where the plate's object box goes within the frame's images. */
  readonly platePlacement: NormalizedBox;
}

export interface TextLayer {
  /** The user's text exactly as typed. */
  readonly text: string;
  /** Text area in the plate image's own coordinates. */
  readonly area: NormalizedBox;
  readonly align: TextAlignment;
}

export interface Composition {
  readonly plate: PlateLayer | undefined;
  readonly frame: FrameLayer | undefined;
  readonly text: TextLayer | undefined;
  readonly notices: readonly PreviewNoticeCode[];
}

/** Alignment used when the catalog gives a text area without one. */
export const DEFAULT_TEXT_ALIGN: TextAlignment = 'center';

function hasIssue(result: ValidationResult, field: ConfigurationField, kind?: 'invalid'): boolean {
  return (
    result.status !== 'valid' &&
    result.issues.some(
      (issue) => issue.field === field && (kind === undefined || issue.kind === kind),
    )
  );
}

export function composePreview(
  catalog: Catalog,
  config: Configuration,
  validation: ValidationResult,
): Composition {
  const nothing = { plate: undefined, frame: undefined, text: undefined } as const;

  if (config.plateId === null) {
    return { ...nothing, notices: ['plate-not-selected'] };
  }
  const plate = findPlate(catalog, config.plateId);
  if (plate === undefined || hasIssue(validation, 'plateId', 'invalid')) {
    return { ...nothing, notices: ['plate-invalid'] };
  }

  const notices: PreviewNoticeCode[] = [];

  // Plate: exact variation only; a selection that conflicts with the plate shows nothing.
  let plateLayer: PlateLayer | undefined;
  let textLayout;
  if (config.colorCategory === null) {
    notices.push('color-not-selected');
  } else if (
    hasIssue(validation, 'colorCategory', 'invalid') ||
    hasIssue(validation, 'colorId', 'invalid')
  ) {
    notices.push('color-invalid');
  } else {
    const lookup = findPlateImage(plate, config.colorCategory, config.colorId);
    if (lookup.status === 'available') {
      plateLayer = {
        src: lookup.image.image.src,
        alt: lookup.image.image.alt,
        objectBounds: lookup.image.objectBounds,
      };
      textLayout = lookup.image.text;
    } else {
      notices.push('plate-image-pending');
    }
  }

  // Frame: drawn only when valid and calibrated; otherwise the plate stands alone.
  let frameLayer: FrameLayer | undefined;
  if (config.frameId !== null) {
    const frame = findFrame(catalog, config.frameId);
    if (frame === undefined || hasIssue(validation, 'frameId', 'invalid')) {
      notices.push('frame-invalid');
    } else {
      const lookup = findFrameImage(frame, plate.id);
      if (lookup.status === 'pending') {
        notices.push('frame-image-pending');
      } else if (lookup.image.platePlacement === undefined) {
        notices.push('frame-not-calibrated');
      } else {
        frameLayer = {
          backSrc: lookup.image.back.src,
          frontSrc: lookup.image.front?.src,
          alt: lookup.image.back.alt,
          platePlacement: lookup.image.platePlacement,
        };
      }
    }
  }

  // Text: needs the plate photograph's calibrated area; the entered text is never altered.
  let textLayer: TextLayer | undefined;
  const hasText = config.text !== '' && !hasIssue(validation, 'text');
  if (plateLayer !== undefined && hasText) {
    if (textLayout === undefined) {
      notices.push('text-area-pending');
    } else {
      textLayer = {
        text: config.text,
        area: textLayout.area,
        align: textLayout.align ?? DEFAULT_TEXT_ALIGN,
      };
    }
  }

  return { plate: plateLayer, frame: frameLayer, text: textLayer, notices };
}

/** Every image file the composition needs, in painting order, without duplicates. */
export function compositionSources(composition: Composition): readonly string[] {
  const sources = [
    composition.frame?.backSrc,
    composition.plate?.src,
    composition.frame?.frontSrc,
  ].filter((src): src is string => src !== undefined);
  return [...new Set(sources)];
}
