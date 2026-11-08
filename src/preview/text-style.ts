/**
 * Lettering style for the preview (D-042): provisional font stacks, the color
 * drawn while the customer has not picked one, and the split of wrapped lines
 * into single-color segments. Pure; no DOM.
 */

import type { FontFamily, TextRange } from '../domain';

/** Provisional system stacks until Taavi provides real typography (P-14). */
export const FONT_STACKS: Record<FontFamily, string> = {
  'sans-serif': 'system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
};

/**
 * Neutral preview color used only while no lettering color is chosen (or the
 * chosen one is unusable). It is not a product color and is never stored.
 */
export const FALLBACK_TEXT_COLOR = '#2b2b2b';

/** A run of one color within a line. */
export interface TextSegment {
  readonly text: string;
  readonly color: string;
}

export interface TextStyle {
  readonly fontFamily: FontFamily;
  readonly primaryColor: string;
  readonly secondary: { readonly color: string; readonly ranges: readonly TextRange[] } | undefined;
}

/**
 * Splits one wrapped line (`text`, found at `start` in the source text) into
 * segments. Colors follow the source offsets, so wrapping never changes which
 * characters are colored.
 */
export function segmentLine(text: string, start: number, style: TextStyle): TextSegment[] {
  const { primaryColor, secondary } = style;
  if (secondary === undefined || text === '') return [{ text, color: primaryColor }];

  const end = start + text.length;
  const segments: TextSegment[] = [];
  let cursor = start;
  const push = (from: number, to: number, color: string) => {
    if (to > from) segments.push({ text: text.slice(from - start, to - start), color });
  };
  for (const range of secondary.ranges) {
    if (range.end <= cursor || range.start >= end) continue;
    const from = Math.max(range.start, cursor);
    const to = Math.min(range.end, end);
    push(cursor, from, primaryColor);
    push(from, to, secondary.color);
    cursor = to;
  }
  push(cursor, end, primaryColor);
  return segments.length > 0 ? segments : [{ text, color: primaryColor }];
}
