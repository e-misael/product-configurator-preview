/**
 * PNG export (D-008, D-009). The exported image is the preview's own scene —
 * same composition, images, font, colored segments, alignment, and position —
 * painted by `drawScene` on a separate canvas at the base image's native
 * size (never upscaled, longest edge capped). Export is allowed only when
 * the configuration is valid and the scene shows everything selected: any
 * preview notice means something is pending, failed, or would be left out.
 */

import type { ValidationIssue, ValidationResult } from '../domain';
import type { PreviewNoticeCode } from './composition';
import { drawScene } from './draw';
import type { ImageSize, Scene } from './scene';

/** Longest edge of an exported image, in pixels (D-008). */
export const MAX_EXPORT_EDGE = 4000;
/** Largest canvas area allocated for export: a full-size square at the edge cap. */
export const MAX_EXPORT_PIXELS = MAX_EXPORT_EDGE * MAX_EXPORT_EDGE;
/** Longest filename stem taken from the model ID. */
const MAX_ID_LENGTH = 60;

export type ExportBlocker =
  | { readonly kind: 'configuration'; readonly issue: ValidationIssue }
  | { readonly kind: 'preview'; readonly code: PreviewNoticeCode }
  | { readonly kind: 'empty' };

/**
 * Why export is not possible, in display order; empty when it is. A frame
 * that is not selected produces no notice and blocks nothing; a selected
 * frame that is incompatible, missing, broken, or uncalibrated does.
 */
export function exportBlockers<I extends ImageSize>(
  validation: ValidationResult,
  scene: Scene<I>,
): ExportBlocker[] {
  const blockers: ExportBlocker[] = [];
  if (validation.status !== 'valid') {
    for (const issue of validation.issues) blockers.push({ kind: 'configuration', issue });
  }
  for (const code of new Set(scene.notices)) blockers.push({ kind: 'preview', code });
  if (blockers.length === 0 && scene.layers.length === 0) blockers.push({ kind: 'empty' });
  return blockers;
}

export interface ExportSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Pixel size of the exported image: the scene's native size, scaled down
 * uniformly only when the longest edge exceeds the cap. Undefined for
 * unusable dimensions, checked before any canvas is allocated.
 */
export function exportSize(scene: {
  readonly width: number;
  readonly height: number;
}): ExportSize | undefined {
  const { width, height } = scene;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  const scale = Math.min(1, MAX_EXPORT_EDGE / Math.max(width, height));
  const pixelWidth = Math.max(1, Math.round(width * scale));
  // Same rounding as the preview's backing store, so both keep one aspect ratio.
  const pixelHeight = Math.max(1, Math.round((pixelWidth * height) / width));
  if (pixelWidth * pixelHeight > MAX_EXPORT_PIXELS) return undefined;
  return { width: pixelWidth, height: pixelHeight };
}

/** `taavi-{plateId}.png`, reduced to safe characters; never contains the customer's text. */
export function exportFileName(plateId: string): string {
  const stem = plateId
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, MAX_ID_LENGTH)
    .replace(/^-+|-+$/g, '');
  return `taavi-${stem === '' ? 'peca' : stem}.png`;
}

export type ExportFailure = 'invalid-size' | 'no-canvas' | 'no-context' | 'draw' | 'encode';

export class ExportError extends Error {
  readonly reason: ExportFailure;

  constructor(reason: ExportFailure, options?: { cause?: unknown }) {
    super(`PNG export failed: ${reason}`, options);
    this.name = 'ExportError';
    this.reason = reason;
  }
}

/** Paints `scene` on a new canvas at the export size and encodes it as PNG. */
export async function renderPng(
  scene: Scene<CanvasImageSource & ImageSize>,
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): Promise<Blob> {
  const size = exportSize(scene);
  if (size === undefined) throw new ExportError('invalid-size');

  let canvas: HTMLCanvasElement;
  try {
    canvas = createCanvas();
    canvas.width = size.width;
    canvas.height = size.height;
  } catch (cause) {
    throw new ExportError('no-canvas', { cause });
  }
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new ExportError('no-context');
  try {
    drawScene(ctx, scene, size.width);
  } catch (cause) {
    throw new ExportError('draw', { cause });
  }

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob === null) reject(new ExportError('encode'));
        else resolve(blob);
      }, 'image/png');
    } catch (cause) {
      reject(new ExportError('encode', { cause }));
    }
  });
}

/** Starts a browser download of `blob`; the object URL is released afterwards. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  // Some browsers read the URL after `click()` returns; release it a moment later.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
