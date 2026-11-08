/**
 * Scene layout (D-037): turns a composition and the state of its image files
 * into positioned layers in painting order, in "logical" units — the natural
 * pixel size of the base image. Pure: no DOM, canvas, or React; text widths
 * come from the `measure` function. `drawScene` (draw.ts) paints the result,
 * and the same scene can later feed export (M4).
 *
 * Layer order (D-037): frame back → plate → text → frame front.
 */

import type { NormalizedBox } from '../domain';
import type { Composition, FrameLayer, PlateLayer, PreviewNoticeCode } from './composition';
import { fitText, type MeasureText } from './text-fit';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What the layout needs to know about a loaded image. */
export interface ImageSize {
  readonly naturalWidth: number;
  readonly naturalHeight: number;
}

export type ImageState<I extends ImageSize = HTMLImageElement> =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly image: I };

export type ImageRole = 'frame-back' | 'plate' | 'frame-front';

export interface TextBlock {
  readonly lines: readonly string[];
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly align: 'left' | 'center' | 'right';
  readonly area: Rect;
}

export type SceneLayer<I extends ImageSize> =
  | { readonly kind: 'image'; readonly role: ImageRole; readonly image: I; readonly rect: Rect }
  | { readonly kind: 'text'; readonly block: TextBlock };

export interface Scene<I extends ImageSize = HTMLImageElement> {
  /** Logical size: the natural pixel size of the base image. Zero when nothing is drawn. */
  readonly width: number;
  readonly height: number;
  /** In painting order. Empty when there is nothing to show. */
  readonly layers: readonly SceneLayer<I>[];
  readonly notices: readonly PreviewNoticeCode[];
  /** Accessible description of the visible product images. */
  readonly description: string | undefined;
}

/** Relative difference in aspect ratio above which frame layers are considered mismatched. */
export const ASPECT_TOLERANCE = 0.01;

const WHOLE_IMAGE: NormalizedBox = { x: 0, y: 0, width: 1, height: 1 };

function scaleBox(box: NormalizedBox, width: number, height: number, origin: Rect): Rect {
  return {
    x: origin.x + box.x * width,
    y: origin.y + box.y * height,
    width: box.width * width,
    height: box.height * height,
  };
}

const aspect = (size: ImageSize) => size.naturalWidth / size.naturalHeight;

/**
 * Where the plate image goes inside a frame image: the plate's object box is
 * scaled uniformly (aspect preserved) to fit the placement and centered in it.
 */
export function placePlate(
  plate: ImageSize,
  objectBounds: NormalizedBox | undefined,
  placement: Rect,
): Rect {
  const bounds = objectBounds ?? WHOLE_IMAGE;
  const objectWidth = bounds.width * plate.naturalWidth;
  const objectHeight = bounds.height * plate.naturalHeight;
  const scale = Math.min(placement.width / objectWidth, placement.height / objectHeight);
  const width = plate.naturalWidth * scale;
  const height = plate.naturalHeight * scale;
  return {
    x: placement.x + (placement.width - objectWidth * scale) / 2 - bounds.x * width,
    y: placement.y + (placement.height - objectHeight * scale) / 2 - bounds.y * height,
    width,
    height,
  };
}

export function buildScene<I extends ImageSize>(
  composition: Composition,
  images: ReadonlyMap<string, ImageState<I>>,
  measure: MeasureText,
): Scene<I> {
  const notices = [...composition.notices];
  const empty = (): Scene<I> => ({
    width: 0,
    height: 0,
    layers: [],
    notices,
    description: undefined,
  });
  const { plate, frame } = composition;
  if (plate === undefined) return empty();

  const stateOf = (src: string): ImageState<I> => images.get(src) ?? { status: 'loading' };
  const plateState = stateOf(plate.src);
  const frameStates =
    frame === undefined
      ? []
      : [
          stateOf(frame.backSrc),
          ...(frame.frontSrc === undefined ? [] : [stateOf(frame.frontSrc)]),
        ];

  // Nothing is drawn until every needed file has settled, so the canvas never flashes a partial composition.
  const loading = [plateState, ...frameStates].some((state) => state.status === 'loading');
  if (loading) {
    notices.push('plate-image-loading');
    return empty();
  }
  if (plateState.status !== 'loaded') {
    notices.push('plate-image-error');
    return empty();
  }

  let framed: Framed<I> | undefined;
  if (frame !== undefined) {
    const states = frameStates;
    if (states.some((state) => state.status === 'error')) {
      notices.push('frame-image-error');
    } else {
      framed = loadedFrame(frame, states);
      if (framed === undefined) notices.push('frame-layers-mismatch');
    }
  }

  return assemble(plate, plateState.image, framed, composition, notices, measure);
}

interface Framed<I extends ImageSize> {
  readonly layer: FrameLayer;
  readonly back: I;
  readonly front: I | undefined;
}

/** The frame's loaded images, or undefined when its layers do not share one aspect ratio. */
function loadedFrame<I extends ImageSize>(
  layer: FrameLayer,
  states: readonly ImageState<I>[],
): Framed<I> | undefined {
  const [back, front] = states.map((state) =>
    state.status === 'loaded' ? state.image : undefined,
  );
  if (back === undefined) return undefined;
  if (front !== undefined) {
    const difference = Math.abs(aspect(front) - aspect(back)) / aspect(back);
    if (difference > ASPECT_TOLERANCE) return undefined;
  }
  return { layer, back, front };
}

function assemble<I extends ImageSize>(
  plate: PlateLayer,
  plateImage: I,
  framed: Framed<I> | undefined,
  composition: Composition,
  notices: PreviewNoticeCode[],
  measure: MeasureText,
): Scene<I> {
  const layers: SceneLayer<I>[] = [];
  let width = plateImage.naturalWidth;
  let height = plateImage.naturalHeight;
  let plateRect: Rect = { x: 0, y: 0, width, height };

  if (framed !== undefined) {
    width = framed.back.naturalWidth;
    height = framed.back.naturalHeight;
    const placement = scaleBox(framed.layer.platePlacement, width, height, {
      x: 0,
      y: 0,
      width,
      height,
    });
    plateRect = placePlate(plateImage, plate.objectBounds, placement);
    layers.push({
      kind: 'image',
      role: 'frame-back',
      image: framed.back,
      rect: { x: 0, y: 0, width, height },
    });
  }

  layers.push({ kind: 'image', role: 'plate', image: plateImage, rect: plateRect });

  const { text } = composition;
  if (text !== undefined) {
    const area = scaleBox(text.area, plateRect.width, plateRect.height, plateRect);
    const fit = fitText(text.text, area, measure);
    if (fit.overflow) notices.push('text-overflow');
    layers.push({
      kind: 'text',
      block: {
        lines: fit.lines,
        fontSize: fit.fontSize,
        lineHeight: fit.lineHeight,
        align: text.align,
        area,
      },
    });
  }

  if (framed?.front !== undefined) {
    layers.push({
      kind: 'image',
      role: 'frame-front',
      image: framed.front,
      rect: { x: 0, y: 0, width, height },
    });
  }

  const description = [framed?.layer.alt, plate.alt].filter((alt) => alt !== undefined).join('; ');
  return {
    width,
    height,
    layers,
    notices,
    description: description === '' ? undefined : description,
  };
}
