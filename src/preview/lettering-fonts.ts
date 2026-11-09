/**
 * Lettering fonts (D-072): the one place that names each lettering font, its
 * weight, its self-hosted files, its letter spacing, and its calibration.
 * Preview, measurement, and PNG export all read it, so they draw with the
 * same loaded font. Files come unmodified from `@fontsource` (SIL OFL 1.1),
 * Latin and Latin Extended only, which cover pt-BR. Pure data; loading is in
 * font-loading.ts.
 */

import gelasioLatin from '@fontsource/gelasio/files/gelasio-latin-400-normal.woff2';
import gelasioLatinExt from '@fontsource/gelasio/files/gelasio-latin-ext-400-normal.woff2';
import quicksandLatin from '@fontsource/quicksand/files/quicksand-latin-700-normal.woff2';
import quicksandLatinExt from '@fontsource/quicksand/files/quicksand-latin-ext-700-normal.woff2';
import type { FontFamily } from '../domain';
import { FONT_STACKS } from './text-style';

/** Unicode ranges of the `@fontsource` subsets (their 400.css / 700.css). */
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,' +
  'U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,' +
  'U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/**
 * Cap height ÷ font size the catalog sizes were calibrated with (D-055): a
 * 7 mm capital at each model's `fontSize`.
 */
export const CALIBRATION_CAP_RATIO = 0.7046;

export interface LetteringFont {
  /** Family name the files are registered under; not a system font's name. */
  readonly family: string;
  readonly weight: number;
  readonly faces: readonly { readonly src: string; readonly unicodeRange: string }[];
  /** Drawn only if the files fail to load; export is then blocked (`font-error`). */
  readonly fallback: string;
  /** Cap height ÷ font size of these files. */
  readonly capRatio: number;
  /** Added after every grapheme but the last, in em. */
  readonly letterSpacing: number;
  /** Catalog size → drawn size, keeping the calibrated capital height. */
  readonly sizeScale: number;
}

export const LETTERING_FONTS: Readonly<Record<FontFamily, LetteringFont>> = {
  // Quicksand Bold, uppercase (D-068), slightly spaced like the stamps.
  'sans-serif': {
    family: 'Taavi Lettering Sans',
    weight: 700,
    faces: [
      { src: quicksandLatin, unicodeRange: LATIN },
      { src: quicksandLatinExt, unicodeRange: LATIN_EXT },
    ],
    fallback: FONT_STACKS['sans-serif'],
    capRatio: 0.7,
    letterSpacing: 0.05,
    // 0.7046 ÷ 0.700 ≈ 1.007: the 7 mm capital at the catalog sizes.
    sizeScale: CALIBRATION_CAP_RATIO / 0.7,
  },
  // Gelasio Regular: Georgia's metrics, so the serif lettering keeps its size and wrapping.
  serif: {
    family: 'Taavi Lettering Serif',
    weight: 400,
    faces: [
      { src: gelasioLatin, unicodeRange: LATIN },
      { src: gelasioLatinExt, unicodeRange: LATIN_EXT },
    ],
    fallback: FONT_STACKS.serif,
    capRatio: 0.693,
    letterSpacing: 0,
    sizeScale: 1,
  },
};

/** CSS font shorthand for lettering of `family` at `fontSize` (logical units). */
export function letteringFont(fontSize: number, family: FontFamily): string {
  const font = LETTERING_FONTS[family];
  return `${font.weight} ${fontSize}px "${font.family}", ${font.fallback}`;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** User-perceived characters of `text`; spacing goes between them, never inside one. */
export function graphemeCount(text: string): number {
  return Array.from(graphemes.segment(text)).length;
}

/**
 * Width of `text` drawn with `spacing` between graphemes, given its width
 * without spacing. The one formula for wrapping, alignment, and overflow,
 * whichever way the spacing is drawn (draw.ts).
 */
export function spacedWidth(text: string, unspacedWidth: number, spacing: number): number {
  if (spacing === 0) return unspacedWidth;
  return unspacedWidth + spacing * Math.max(0, graphemeCount(text) - 1);
}
