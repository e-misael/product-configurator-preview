/**
 * Letter spacing on a canvas (D-072). Where the context supports
 * `letterSpacing` it is used; elsewhere (older Safari) each grapheme is drawn
 * at the width of the text before it plus the spacing so far, which keeps the
 * font's kerning inside each piece and never splits an accent from its letter.
 * Both ways put the first glyph at `x` and the spacing only between
 * graphemes, so layout uses one width (`spacedWidth`) for either.
 */

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Whether the context draws spacing itself (`CanvasRenderingContext2D.letterSpacing`). */
export function supportsLetterSpacing(ctx: CanvasRenderingContext2D): boolean {
  return 'letterSpacing' in ctx;
}

/**
 * Fills `text` left-aligned at (`x`, `y`) with `spacing` logical units after
 * every grapheme. `native: false` forces the per-grapheme path (tests).
 * The context's `letterSpacing` is left at 0.
 */
export function fillSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  native = supportsLetterSpacing(ctx),
): void {
  ctx.textAlign = 'left';
  if (spacing === 0) {
    ctx.fillText(text, x, y);
    return;
  }
  if (native) {
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    ctx.letterSpacing = '0px';
    return;
  }
  let before = '';
  let index = 0;
  for (const { segment } of graphemes.segment(text)) {
    ctx.fillText(segment, x + ctx.measureText(before).width + spacing * index, y);
    before += segment;
    index++;
  }
}
