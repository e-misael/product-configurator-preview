/**
 * Loads the lettering fonts (D-072) with the Font Loading API before anything
 * is measured or drawn with them. Each family loads once and is shared by
 * the preview, the text measurer, and the PNG export; a failed load is
 * attempted again the next time it is requested.
 */

import type { FontFamily } from '../domain';
import { LETTERING_FONTS } from './lettering-fonts';

export type FontState = 'loading' | 'loaded' | 'error';

const loads = new Map<FontFamily, Promise<void>>();
const loaded = new Set<FontFamily>();

/** Without the Font Loading API (jsdom) there is nothing to load; canvases there draw nothing. */
function supported(): boolean {
  return typeof FontFace !== 'undefined' && typeof document !== 'undefined' && 'fonts' in document;
}

/** Resolves once every file of `family` is loaded and registered for canvas use. */
export function loadLetteringFont(family: FontFamily): Promise<void> {
  if (!supported()) return Promise.resolve();
  let load = loads.get(family);
  if (load === undefined) {
    const font = LETTERING_FONTS[family];
    load = Promise.all(
      font.faces.map(async ({ src, unicodeRange }) => {
        const face = new FontFace(font.family, `url(${src}) format('woff2')`, {
          weight: String(font.weight),
          unicodeRange,
        });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(
      () => {
        loaded.add(family);
      },
      (error: unknown) => {
        loads.delete(family);
        throw error;
      },
    );
    loads.set(family, load);
  }
  return load;
}

/** Whether `family` can be drawn right now, without waiting. */
export function isLetteringFontLoaded(family: FontFamily): boolean {
  return !supported() || loaded.has(family);
}
