/**
 * Provisional text fitting for the preview (D-038). A deliberately simple
 * strategy: explicit line breaks are kept, lines wrap at spaces (and between
 * whole characters inside a word that is wider than the area), and the font
 * shrinks by a fixed factor down to a minimum. Below the minimum the text
 * stays at the minimum size and is reported as overflowing; it is never
 * clipped or truncated. Typography is pending (P-04).
 */

import type { Rect } from './scene';

/** Width of `text` in logical units when drawn at `fontSize`. */
export type MeasureText = (text: string, fontSize: number) => number;

/** Starting font size, as a fraction of the text area's height. */
export const START_FONT_RATIO = 0.25;
/** Smallest font size, as a fraction of the text area's height. */
export const MIN_FONT_RATIO = 0.08;
/** Each shrink step multiplies the font size by this factor. */
export const SHRINK_FACTOR = 0.9;
/** Line height as a multiple of the font size. */
export const LINE_HEIGHT = 1.2;

export interface TextFit {
  /** Lines to draw, in order. Their concatenation preserves the user's characters. */
  readonly lines: readonly string[];
  /** Offset of each line's first character in the source text (parallel to `lines`). */
  readonly starts: readonly number[];
  readonly fontSize: number;
  readonly lineHeight: number;
  /** True when the text does not fit even at the minimum font size. */
  readonly overflow: boolean;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Splits a word into the fewest pieces that fit, never inside a grapheme cluster (emoji, accents). */
function breakWord(word: string, fits: (candidate: string) => boolean): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const { segment } of segmenter.segment(word)) {
    if (piece !== '' && !fits(piece + segment)) {
      pieces.push(piece);
      piece = '';
    }
    piece += segment;
  }
  if (piece !== '') pieces.push(piece);
  return pieces;
}

export interface WrappedLine {
  readonly text: string;
  /** Offset of the line's first character in the source text. */
  readonly start: number;
}

/**
 * Wraps `text` into lines no wider than `maxWidth` where possible. Explicit
 * line breaks (`\n`, `\r\n`, `\r`) always start a new line, including empty ones.
 * Every line is a substring of `text` found at its `start`.
 */
export function wrapTextWithOffsets(
  text: string,
  maxWidth: number,
  widthOf: (text: string) => number,
): WrappedLine[] {
  const fits = (candidate: string) => widthOf(candidate) <= maxWidth;
  const lines: WrappedLine[] = [];

  const paragraphs: { text: string; start: number }[] = [];
  let paragraphStart = 0;
  for (const match of text.matchAll(/\r\n|\r|\n/g)) {
    paragraphs.push({ text: text.slice(paragraphStart, match.index), start: paragraphStart });
    paragraphStart = match.index + match[0].length;
  }
  paragraphs.push({ text: text.slice(paragraphStart), start: paragraphStart });

  for (const paragraph of paragraphs) {
    let line = '';
    let lineStart = paragraph.start;
    for (const match of paragraph.text.matchAll(/\s+|\S+/g)) {
      const token = match[0];
      const tokenStart = paragraph.start + match.index;
      if (fits(line + token)) {
        if (line === '') lineStart = tokenStart;
        line += token;
        continue;
      }
      // Soft wrap: trailing spaces at a break are not drawn.
      if (line.trim() !== '') lines.push({ text: line.trimEnd(), start: lineStart });
      line = '';
      if (token.trim() === '') continue;
      // A word wider than the area is split between characters; its last piece continues the line.
      const pieces = fits(token) ? [token] : breakWord(token, fits);
      line = pieces.pop() ?? '';
      let offset = tokenStart;
      for (const piece of pieces) {
        lines.push({ text: piece, start: offset });
        offset += piece.length;
      }
      lineStart = offset;
    }
    lines.push({ text: line, start: lineStart });
  }
  return lines;
}

/** Same wrapping as `wrapTextWithOffsets`, text only. */
export function wrapText(
  text: string,
  maxWidth: number,
  widthOf: (text: string) => number,
): string[] {
  return wrapTextWithOffsets(text, maxWidth, widthOf).map((line) => line.text);
}

export function fitText(text: string, area: Rect, measure: MeasureText): TextFit {
  const start = area.height * START_FONT_RATIO;
  const min = area.height * MIN_FONT_RATIO;
  let fontSize = start;

  for (;;) {
    const wrapped = wrapTextWithOffsets(text, area.width, (candidate) =>
      measure(candidate, fontSize),
    );
    const lines = wrapped.map((line) => line.text);
    const starts = wrapped.map((line) => line.start);
    const lineHeight = fontSize * LINE_HEIGHT;
    const fits =
      lines.length * lineHeight <= area.height &&
      lines.every((line) => measure(line, fontSize) <= area.width);
    if (fits) return { lines, starts, fontSize, lineHeight, overflow: false };
    if (fontSize <= min) return { lines, starts, fontSize, lineHeight, overflow: true };
    fontSize = Math.max(min, fontSize * SHRINK_FACTOR);
  }
}
