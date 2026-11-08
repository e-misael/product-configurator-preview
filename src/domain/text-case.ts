/**
 * Letter case by typeface (D-068). "Sem serifa" is lettered in capitals only;
 * "Com serifa" keeps the case as typed. The stored text is never changed, so
 * switching back to "Com serifa" restores the customer's capitalization.
 */

import type { FontFamily } from './types';

const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

/**
 * The text as lettered in `fontFamily`. Each grapheme is capitalized for
 * "Sem serifa" (accents kept: "ação" → "AÇÃO"); one whose capital has a
 * different length (e.g. "ß" → "SS") is kept as typed, so every character
 * stays at its offset and the second-color ranges still apply.
 */
export function letteringText(text: string, fontFamily: FontFamily): string {
  if (fontFamily !== 'sans-serif') return text;
  let result = '';
  for (const { segment } of segmenter.segment(text)) {
    const upper = segment.toLocaleUpperCase('pt-BR');
    result += upper.length === segment.length ? upper : segment;
  }
  return result;
}
