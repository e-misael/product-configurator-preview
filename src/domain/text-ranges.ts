/**
 * Pure helpers for the secondary-color ranges of the text (D-042). Ranges are
 * half-open UTF-16 offsets that always sit on grapheme-cluster boundaries and
 * never include line breaks. The text itself is never modified here.
 */

import type { TextRange } from './types';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Every grapheme-cluster boundary of `text`, including 0 and `text.length`. */
export function graphemeBoundaries(text: string): ReadonlySet<number> {
  const boundaries = new Set<number>([0, text.length]);
  for (const { index } of segmenter.segment(text)) boundaries.add(index);
  return boundaries;
}

/** Sorts, drops empty ranges, and merges overlapping or touching ones. */
export function normalizeRanges(ranges: readonly TextRange[]): TextRange[] {
  const sorted = ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const merged: TextRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && range.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, range.end) };
    } else {
      merged.push(range);
    }
  }
  return merged;
}

/** Whether `ranges` are a well-formed set for `text`: integer, in bounds, sorted, disjoint, grapheme-aligned. */
export function areValidRanges(text: string, ranges: readonly TextRange[]): boolean {
  const boundaries = graphemeBoundaries(text);
  let previousEnd = 0;
  return ranges.every(({ start, end }) => {
    const ok =
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= previousEnd &&
      end > start &&
      end <= text.length &&
      boundaries.has(start) &&
      boundaries.has(end);
    previousEnd = end;
    return ok;
  });
}

/** Expands a selection outward to whole grapheme clusters; null when it selects nothing. */
export function snapSelection(text: string, start: number, end: number): TextRange | null {
  const from = Math.max(0, Math.min(start, end, text.length));
  const to = Math.min(text.length, Math.max(start, end));
  if (to <= from) return null;
  const boundaries = [...graphemeBoundaries(text)].sort((a, b) => a - b);
  const snappedStart = Math.max(...boundaries.filter((b) => b <= from));
  const snappedEnd = Math.min(...boundaries.filter((b) => b >= to));
  return { start: snappedStart, end: snappedEnd };
}

/** The parts of a range that are not line breaks (line breaks are never colored). */
function withoutLineBreaks(text: string, range: TextRange): TextRange[] {
  const pieces: TextRange[] = [];
  for (const match of text.slice(range.start, range.end).matchAll(/[^\r\n]+/g)) {
    const start = range.start + match.index;
    pieces.push({ start, end: start + match[0].length });
  }
  return pieces;
}

/** Adds the selection to the ranges. The text is unchanged. */
export function addRange(
  text: string,
  ranges: readonly TextRange[],
  selectionStart: number,
  selectionEnd: number,
): TextRange[] {
  const snapped = snapSelection(text, selectionStart, selectionEnd);
  if (snapped === null) return [...ranges];
  return normalizeRanges([...ranges, ...withoutLineBreaks(text, snapped)]);
}

/** Removes the selection from the ranges, splitting a range when needed. */
export function removeRange(
  text: string,
  ranges: readonly TextRange[],
  selectionStart: number,
  selectionEnd: number,
): TextRange[] {
  const snapped = snapSelection(text, selectionStart, selectionEnd);
  if (snapped === null) return [...ranges];
  return normalizeRanges(
    ranges.flatMap((range) => [
      { start: range.start, end: Math.min(range.end, snapped.start) },
      { start: Math.max(range.start, snapped.end), end: range.end },
    ]),
  );
}

export interface RemapResult {
  readonly ranges: TextRange[];
  /** True when the edit could not be located with certainty and formatting was removed. */
  readonly ambiguous: boolean;
}

function commonPrefix(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

function commonSuffix(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i;
}

/**
 * Moves the ranges through an edit of the text (D-042). The edit is one splice:
 * old `[s, r)` replaced by new `[s, r + delta)`.
 *
 * - With `caret` (the textarea selection after the edit) the splice is located
 *   exactly, even inside repeated characters.
 * - Without it, the splice comes from the common prefix and suffix. If the
 *   position could be anywhere in a repeated run, every range the edit could
 *   have touched is removed (`ambiguous`) rather than recolor other characters.
 * - Text typed inside a range does not take the color: the range is split.
 * - The splice is widened to whole grapheme clusters, so a cluster is never cut.
 */
export function remapRanges(
  oldText: string,
  newText: string,
  ranges: readonly TextRange[],
  caret?: number,
): RemapResult {
  if (oldText === newText || ranges.length === 0) return { ranges: [...ranges], ambiguous: false };

  const delta = newText.length - oldText.length;
  const prefix = commonPrefix(oldText, newText);
  const suffix = commonSuffix(oldText, newText);
  const minLength = Math.min(oldText.length, newText.length);

  let spliceStart: number;
  let spliceEnd: number; // in old text
  let ambiguous = false;
  const hinted =
    caret !== undefined &&
    caret >= 0 &&
    caret <= newText.length &&
    caret - delta >= 0 &&
    caret - delta <= oldText.length &&
    oldText.slice(caret - delta) === newText.slice(caret);

  if (hinted) {
    spliceEnd = caret - delta;
    spliceStart = Math.min(prefix, caret, spliceEnd);
  } else {
    const overlap = Math.max(0, prefix + suffix - minLength);
    spliceStart = prefix - overlap;
    spliceEnd = oldText.length - suffix + overlap;
    ambiguous = overlap > 0;
    if (ambiguous) {
      const kept = ranges.filter((r) => r.end <= spliceStart || r.start >= spliceEnd);
      const shifted = kept.map((r) =>
        r.start >= spliceEnd ? { start: r.start + delta, end: r.end + delta } : r,
      );
      return {
        ranges: normalizeRanges(shifted),
        ambiguous: kept.length < ranges.length,
      };
    }
  }

  // Widen to grapheme boundaries valid in both texts.
  const oldBoundaries = graphemeBoundaries(oldText);
  const newBoundaries = graphemeBoundaries(newText);
  while (spliceStart > 0 && !(oldBoundaries.has(spliceStart) && newBoundaries.has(spliceStart))) {
    spliceStart -= 1;
  }
  while (
    spliceEnd < oldText.length &&
    !(oldBoundaries.has(spliceEnd) && newBoundaries.has(spliceEnd + delta))
  ) {
    spliceEnd += 1;
  }

  const result: TextRange[] = [];
  for (const { start, end } of ranges) {
    // Survivors left of the splice, and right of it (shifted by the length change).
    if (Math.min(end, spliceStart) > start) result.push({ start, end: Math.min(end, spliceStart) });
    const rightStart = Math.max(start, spliceEnd);
    if (end > rightStart) result.push({ start: rightStart + delta, end: end + delta });
  }
  return { ranges: normalizeRanges(result), ambiguous };
}
