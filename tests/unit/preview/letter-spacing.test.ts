import { fillSpacedText, supportsLetterSpacing } from '../../../src/preview/letter-spacing';
import { spacedWidth } from '../../../src/preview/lettering-fonts';
import { FakeContext } from '../support/fake-canvas';

const context = (ctx: FakeContext) => ctx as unknown as CanvasRenderingContext2D;
const texts = (ctx: FakeContext) =>
  ctx.calls.flatMap((call) =>
    call.op === 'fillText' ? [{ text: call.text, x: call.x, spacing: call.letterSpacing }] : [],
  );

describe('fillSpacedText (D-072)', () => {
  it('draws unspaced text in one call', () => {
    const ctx = new FakeContext();
    fillSpacedText(context(ctx), 'Eu te amo', 10, 20, 0);

    expect(texts(ctx)).toEqual([{ text: 'Eu te amo', x: 10, spacing: '0px' }]);
    expect(ctx.textAlign).toBe('left');
  });

  it('uses the canvas letter spacing where supported, then resets it', () => {
    const ctx = new FakeContext();
    expect(supportsLetterSpacing(context(ctx))).toBe(true);

    fillSpacedText(context(ctx), 'PAZ', 10, 20, 1.5);

    expect(texts(ctx)).toEqual([{ text: 'PAZ', x: 10, spacing: '1.5px' }]);
    expect(ctx.letterSpacing).toBe('0px');
  });

  it('falls back to one grapheme at a time, after the text before it plus the spacing', () => {
    const ctx = new FakeContext();
    ctx.font = '700 20px "Taavi Lettering Sans"';

    // Fake measure: 10 px per code point.
    fillSpacedText(context(ctx), 'AÇÃO', 0, 20, 2, false);

    expect(texts(ctx)).toEqual([
      { text: 'A', x: 0, spacing: '0px' },
      { text: 'Ç', x: 12, spacing: '0px' },
      { text: 'Ã', x: 24, spacing: '0px' },
      { text: 'O', x: 36, spacing: '0px' },
    ]);
  });

  it('never splits an accent or an emoji from its character in the fallback', () => {
    const ctx = new FakeContext();
    ctx.font = '20px x';

    fillSpacedText(context(ctx), 'É👩‍👩‍👧', 0, 0, 2, false);

    expect(texts(ctx).map((call) => call.text)).toEqual(['É', '👩‍👩‍👧']);
  });

  it('ends the fallback where the shared width formula says, as the native path does', () => {
    const ctx = new FakeContext();
    ctx.font = '20px x';
    const text = 'SMALL STEPS';

    fillSpacedText(context(ctx), text, 5, 0, 1, false);

    const last = texts(ctx).at(-1);
    const end = (last?.x ?? 0) + ctx.measureText(last?.text ?? '').width;
    expect(end).toBe(5 + spacedWidth(text, ctx.measureText(text).width, 1));
  });
});
