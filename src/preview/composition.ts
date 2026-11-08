/**
 * Preview composition (D-009, D-037): turns a configuration, its validation
 * result, and the catalog into a description of the visual layers. Pure: no
 * React, DOM, or image loading. It reads catalog imagery by exact match and
 * contains no product rules or per-product coordinates.
 */

import {
  findPlate,
  findPlateImage,
  findTextColor,
  isAvailable,
  letteringText,
  placementFor,
  type Catalog,
  type Configuration,
  type ConfigurationField,
  type FontFamily,
  type NormalizedBox,
  type TextAlignment,
  type TextRange,
  type ValidationResult,
} from '../domain';
import { WATERMARK_SRC } from './watermark';

/** Why part of the preview is not shown. Wording lives in the UI layer. */
export type PreviewNoticeCode =
  | 'plate-not-selected'
  | 'size-not-selected'
  | 'plate-invalid'
  | 'plate-image-pending'
  | 'plate-image-loading'
  | 'plate-image-error'
  | 'text-area-pending'
  | 'text-size-pending'
  | 'text-color-provisional'
  | 'text-overflow'
  | 'watermark-error';

export interface PlateLayer {
  readonly src: string;
  readonly alt: string | undefined;
}

export interface TextLayer {
  /** The user's text exactly as typed. */
  readonly text: string;
  /** Text area in the plate image's own coordinates. */
  readonly area: NormalizedBox;
  /** Fixed lettering size as a fraction of the plate image width (D-055). */
  readonly fontSize: number;
  /** Line alignment inside the text block. */
  readonly align: TextAlignment;
  /** Block position as fractions of the free space in the area (D-044). */
  readonly x: number;
  readonly y: number;
  readonly fontFamily: FontFamily;
  /** Chosen lettering color; undefined until one is picked (the renderer then uses a neutral preview color). */
  readonly primaryColor: string | undefined;
  /** Second color and the characters it applies to; undefined when unusable or unused. */
  readonly secondary: { readonly color: string; readonly ranges: readonly TextRange[] } | undefined;
}

export interface Composition {
  readonly plate: PlateLayer | undefined;
  readonly text: TextLayer | undefined;
  readonly notices: readonly PreviewNoticeCode[];
}

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
  const nothing = { plate: undefined, text: undefined } as const;

  if (config.plateId === null) {
    return { ...nothing, notices: ['plate-not-selected'] };
  }
  const plate = findPlate(catalog, config.plateId);
  if (plate === undefined || hasIssue(validation, 'plateId', 'invalid')) {
    return { ...nothing, notices: ['plate-invalid'] };
  }

  const notices: PreviewNoticeCode[] = [];

  // Plate: the model's own photograph; pending shows nothing in its place.
  let plateLayer: PlateLayer | undefined;
  let textLayout;
  const lookup = findPlateImage(plate);
  if (lookup.status === 'available') {
    plateLayer = {
      src: lookup.image.image.src,
      alt: lookup.image.image.alt,
    };
    textLayout = lookup.image.text;
  } else {
    notices.push('plate-image-pending');
  }

  // Text: needs the plate photograph's calibrated area; the entered text is never altered.
  let textLayer: TextLayer | undefined;
  const hasText = config.text !== '' && !hasIssue(validation, 'text');
  if (plateLayer !== undefined && hasText) {
    if (textLayout === undefined) {
      notices.push('text-area-pending');
    } else if (textLayout.fontSize === undefined) {
      // No approved lettering size: nothing is drawn rather than a guessed or fitted size (D-055).
      notices.push('text-size-pending');
    } else {
      // An invalid stored placement is reported by validation and drawn at the catalog default;
      // a model with a fixed placement always uses its default (D-068).
      const placement = placementFor(config.textLayout, plate);
      const fontFamily: FontFamily = hasIssue(validation, 'fontFamily', 'invalid')
        ? 'sans-serif'
        : config.fontFamily;
      textLayer = {
        // Capitals for "Sem serifa", same offsets as the stored text (D-068).
        text: letteringText(config.text, fontFamily),
        area: textLayout.area,
        fontSize: textLayout.fontSize,
        align: placement.align,
        x: placement.x,
        y: placement.y,
        fontFamily,
        primaryColor: usableColor(catalog, config.textColorId, validation, 'textColorId'),
        secondary: secondaryStyle(catalog, config, validation),
      };
      // The renderer's fallback color is not a customer choice; say so (D-043).
      if (textLayer.primaryColor === undefined) notices.push('text-color-provisional');
    }
  }

  return { plate: plateLayer, text: textLayer, notices };
}

/** The hex of a chosen lettering color, or undefined when none is chosen or it is invalid. */
function usableColor(
  catalog: Catalog,
  id: string | null,
  validation: ValidationResult,
  field: ConfigurationField,
): string | undefined {
  if (id === null || hasIssue(validation, field, 'invalid')) return undefined;
  const color = findTextColor(catalog, id);
  return color !== undefined && isAvailable(color) ? color.hex : undefined;
}

/**
 * The highlight color is drawn only while highlighting is on and it and its
 * words are valid (D-071); nothing is guessed.
 */
function secondaryStyle(
  catalog: Catalog,
  config: Configuration,
  validation: ValidationResult,
): TextLayer['secondary'] {
  if (
    !config.highlightEnabled ||
    config.secondaryRanges.length === 0 ||
    hasIssue(validation, 'secondaryRanges', 'invalid')
  ) {
    return undefined;
  }
  const color = usableColor(catalog, config.secondaryColorId, validation, 'secondaryColorId');
  return color === undefined ? undefined : { color, ranges: config.secondaryRanges };
}

/**
 * A model group before its size is chosen (M4.6): the photograph its sizes
 * share, illustrative only. No text is drawn, since each size has its own
 * lettering scale and text area, and the notice keeps export blocked.
 */
export function composeIllustration(catalog: Catalog, plateId: string): Composition {
  const plate = findPlate(catalog, plateId);
  const lookup = plate === undefined ? undefined : findPlateImage(plate);
  if (lookup?.status !== 'available') {
    return { plate: undefined, text: undefined, notices: ['size-not-selected'] };
  }
  return {
    plate: { src: lookup.image.image.src, alt: lookup.image.image.alt },
    text: undefined,
    notices: ['size-not-selected'],
  };
}

/** Every image file the composition needs: the model's photograph, when there is one. */
export function compositionSources(composition: Composition): readonly string[] {
  // The Taavi signature is part of every composition that shows a model (D-060).
  return composition.plate === undefined ? [] : [composition.plate.src, WATERMARK_SRC];
}
