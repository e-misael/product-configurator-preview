/**
 * Whole-word highlighting (D-071). A word is a run of letters, combining
 * marks, and digits; a hyphen or apostrophe between two such runs keeps them
 * one word ("guarda-chuva", "d'água"). Spaces, punctuation, line breaks, and
 * emoji are never part of a word, so they always stay in the primary color.
 * Highlights are stored as `secondaryRanges`, one range per word occurrence,
 * so the existing range representation and renderer are unchanged.
 */

import { graphemeBoundaries, remapRanges } from './text-ranges';
import type { TextRange } from './types';

const WORD = /[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu;

/** Every word occurrence of `text`, in order, as grapheme-aligned ranges. */
export function wordsOf(text: string): TextRange[] {
  const boundaries = graphemeBoundaries(text);
  const words: TextRange[] = [];
  for (const match of text.matchAll(WORD)) {
    const start = match.index;
    const end = start + match[0].length;
    // A word never cuts a grapheme cluster (e.g. a letter joined to an emoji).
    if (boundaries.has(start) && boundaries.has(end)) words.push({ start, end });
  }
  return words;
}

const same = (a: TextRange, b: TextRange) => a.start === b.start && a.end === b.end;

/** Whether `ranges` are distinct word occurrences of `text`, in order. */
export function areWordRanges(text: string, ranges: readonly TextRange[]): boolean {
  const words = wordsOf(text);
  let next = 0;
  return ranges.every((range) => {
    const index = words.findIndex((word, i) => i >= next && same(word, range));
    if (index < 0) return false;
    next = index + 1;
    return true;
  });
}

/** Highlights the word occurrence, or removes its highlight when it has one. */
export function toggleWord(ranges: readonly TextRange[], word: TextRange): TextRange[] {
  if (ranges.some((range) => same(range, word))) return ranges.filter((r) => !same(r, word));
  return [...ranges, word].sort((a, b) => a.start - b.start);
}

export interface WordRemapResult {
  readonly ranges: TextRange[];
  /** True when a highlight was dropped because its word changed or could not be located. */
  readonly removed: boolean;
}

/**
 * Carries the highlights through an edit of the text (D-071). The edit is
 * located by position (the caret, else the common prefix and suffix, as in
 * `remapRanges`), never by matching words: a highlight survives only when its
 * own occurrence is unchanged and is still a whole word, so it is never moved
 * to another word with the same letters. Everything else is removed.
 */
export function remapWords(
  oldText: string,
  newText: string,
  ranges: readonly TextRange[],
  caret?: number,
): WordRemapResult {
  if (oldText === newText || ranges.length === 0) return { ranges: [...ranges], removed: false };
  const words = wordsOf(newText);
  // Each highlight is followed on its own: it survives only as one range with
  // the same letters that is still a whole word in the new text.
  const kept = ranges.flatMap((old) => {
    const moved = remapRanges(oldText, newText, [old], caret).ranges;
    const range = moved[0];
    const intact =
      moved.length === 1 &&
      range !== undefined &&
      newText.slice(range.start, range.end) === oldText.slice(old.start, old.end) &&
      words.some((word) => same(word, range));
    return intact ? [range] : [];
  });
  return { ranges: kept, removed: kept.length < ranges.length };
}
