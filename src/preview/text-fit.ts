/**
 * Text layout at a fixed lettering size (D-055, replacing the shrinking of
 * D-038): Taavi's lettering molds have one size, so the font size comes from
 * the catalog and never depends on the text. Explicit line breaks are kept,
 * lines wrap at spaces (and between whole characters inside a word that is
 * wider than the area). Text that does not fit is reported as overflowing; it
 * is never resized, clipped, or truncated.
 */

import type { Rect } from './scene';

/** Width of `text` in logical units when drawn at `fontSize`. */
export type MeasureText = (text: string, fontSize: number) => number;

/** Line height as a multiple of the font size. */
export const LINE_HEIGHT = 1.2;

export interface TextFit {
  /** Lines to draw, in order. Their concatenation preserves the user's characters. */
  readonly lines: readonly string[];
  /** Offset of each line's first character in the source text (parallel to `lines`). */
  readonly starts: readonly number[];
  readonly fontSize: number;
  readonly lineHeight: number;
  /** True when the lines are taller or wider than the area. */
  readonly overflow: boolean;
  /** Lines beyond what the area's height holds; 0 when the lines fit vertically. */
  readonly excessLines: number;
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

/** Lays `text` out in `area` at `fontSize`, the same size whatever the text. */
export function layoutText(
  text: string,
  area: Rect,
  fontSize: number,
  measure: MeasureText,
): TextFit {
  const wrapped = wrapTextWithOffsets(text, area.width, (candidate) =>
    measure(candidate, fontSize),
  );
  const lines = wrapped.map((line) => line.text);
  const starts = wrapped.map((line) => line.start);
  const lineHeight = fontSize * LINE_HEIGHT;
  const tooTall = lines.length * lineHeight > area.height;
  // A single character wider than the area still overflows horizontally.
  const overflow = tooTall || lines.some((line) => measure(line, fontSize) > area.width);
  const capacity = lineCapacity(area.height, lineHeight);
  const excessLines = tooTall ? Math.max(1, lines.length - capacity) : 0;
  return { lines, starts, fontSize, lineHeight, overflow, excessLines };
}

/** Whole lines that fit in a text area of `height` at `lineHeight`. */
export function lineCapacity(height: number, lineHeight: number): number {
  return Math.floor(height / lineHeight);
}

const LINE_BREAK = /\r\n|\r|\n/g;

function lineBreaks(text: string): number {
  return text.match(LINE_BREAK)?.length ?? 0;
}

/**
 * Whether the edit from `previous` to `next` adds a line break that pushes the
 * text past the lines the area holds (D-063). Only added breaks are refused:
 * typing or pasting without new breaks, and any deletion, are always
 * accepted, so text that overflows by wrapping is still reported as overflow,
 * never cut.
 */
export function addsLineBeyondCapacity(
  previous: string,
  next: string,
  area: Rect,
  fontSize: number,
  measure: MeasureText,
): boolean {
  if (lineBreaks(next) <= lineBreaks(previous)) return false;
  const after = layoutText(next, area, fontSize, measure).excessLines;
  return after > 0 && after > layoutText(previous, area, fontSize, measure).excessLines;
}
