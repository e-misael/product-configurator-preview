import {
  layoutText,
  LINE_HEIGHT,
  wrapText,
  wrapTextWithOffsets,
} from '../../../src/preview/text-fit';

/** Each code point is half a font size wide. */
const measure = (text: string, size: number) => [...text].length * size * 0.5;
const widthAt10 = (text: string) => measure(text, 10);
const area = (width: number, height: number) => ({ x: 0, y: 0, width, height });

describe('wrapText', () => {
  it('keeps explicit line breaks, including empty lines and CRLF', () => {
    expect(wrapText('a\n\nb\r\nc\rd', 1000, widthAt10)).toEqual(['a', '', 'b', 'c', 'd']);
  });

  it('keeps a trailing line break as an empty line', () => {
    expect(wrapText('a\n', 1000, widthAt10)).toEqual(['a', '']);
  });

  it('wraps at spaces when a line is too wide', () => {
    // 5 units per character; 40 wide fits 8 characters.
    expect(wrapText('casa da Ana Maria', 40, widthAt10)).toEqual(['casa da', 'Ana', 'Maria']);
  });

  it('does not trim lines that are not soft-wrapped', () => {
    expect(wrapText('  Ana  ', 1000, widthAt10)).toEqual(['  Ana  ']);
  });

  it('splits a word wider than the area between characters', () => {
    expect(wrapText('abcdefghij', 20, widthAt10)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('never splits a grapheme cluster', () => {
    const family = '👩‍👩‍👧';
    const accent = 'é';
    const lines = wrapText(`${family}${accent}${family}${accent}`, 12, widthAt10);

    // Pieces rejoin to the original, and no line starts with a combining mark or joiner.
    expect(lines.join('')).toBe(`${family}${accent}${family}${accent}`);
    for (const line of lines) expect(line).not.toMatch(/^[́‍]/u);
    for (const line of lines) expect(line.endsWith('‍')).toBe(false);
  });

  it('terminates when a single character is wider than the area', () => {
    expect(wrapText('abc', 1, widthAt10)).toEqual(['a', 'b', 'c']);
  });

  it('returns one empty line for empty text', () => {
    expect(wrapText('', 100, widthAt10)).toEqual(['']);
  });
});

describe('layoutText (fixed size, D-055)', () => {
  it('uses the given size for short and long text alike', () => {
    const short = layoutText('Ana', area(200, 100), 10, measure);
    const long = layoutText('Casa da Ana e do Pedro desde 2024', area(200, 100), 10, measure);

    expect([short.fontSize, long.fontSize]).toEqual([10, 10]);
    expect(short.lineHeight).toBe(10 * LINE_HEIGHT);
    expect(short).toMatchObject({ lines: ['Ana'], overflow: false });
    expect(long.overflow).toBe(false);
  });

  it('keeps explicit line breaks and wraps long lines without resizing', () => {
    // 5 units per character at size 10: 40 wide fits 8 characters.
    const fit = layoutText('Casa da Ana\nDesde 2024', area(40, 100), 10, measure);

    expect(fit.lines).toEqual(['Casa da', 'Ana', 'Desde', '2024']);
    expect(fit.fontSize).toBe(10);
    expect(fit.overflow).toBe(false);
  });

  it('reports vertical overflow instead of shrinking or truncating', () => {
    // 100 high at line height 12 holds 8 lines.
    const lines = Array.from({ length: 9 }, (_, i) => `l${i}`);
    const fit = layoutText(lines.join('\n'), area(200, 100), 10, measure);

    expect(fit.overflow).toBe(true);
    expect(fit.fontSize).toBe(10);
    expect(fit.lines).toEqual(lines);
    expect(layoutText(lines.slice(1).join('\n'), area(200, 100), 10, measure).overflow).toBe(false);
  });

  it('reports horizontal overflow when one character is wider than the area', () => {
    const fit = layoutText('W', area(4, 100), 10, measure);

    expect(fit.overflow).toBe(true);
    expect(fit.lines).toEqual(['W']);
  });

  it('keeps every visible character of accented and Unicode text', () => {
    const text = 'Ação\nbrasileira 🇧🇷 é ÜBER';
    const fit = layoutText(text, area(60, 200), 10, measure);

    const visible = (value: string) => value.replace(/\s/g, '');
    expect(visible(fit.lines.join(''))).toBe(visible(text));
    expect(fit.fontSize).toBe(10);
  });

  it('does not change the text it is given', () => {
    const text = '  a\nb ';
    layoutText(text, area(100, 100), 10, measure);
    expect(text).toBe('  a\nb ');
  });
});

describe('wrapTextWithOffsets', () => {
  /** Every line must be the exact substring of the source found at its offset. */
  const expectOffsets = (text: string, maxWidth: number) => {
    const lines = wrapTextWithOffsets(text, maxWidth, widthAt10);
    for (const line of lines) {
      expect(text.slice(line.start, line.start + line.text.length)).toBe(line.text);
    }
    return lines;
  };

  it('reports where each line starts in the source text', () => {
    expect(expectOffsets('casa da Ana Maria', 40).map((line) => line.start)).toEqual([0, 8, 12]);
  });

  it('handles explicit breaks, including empty lines and CRLF', () => {
    const lines = expectOffsets('a\n\nb\r\nc\rd', 1000);
    expect(lines.map((line) => [line.text, line.start])).toEqual([
      ['a', 0],
      ['', 2],
      ['b', 3],
      ['c', 6],
      ['d', 8],
    ]);
  });

  it('keeps offsets for words split between characters and for leading spaces', () => {
    expect(expectOffsets('abcdefghij', 20).map((line) => line.start)).toEqual([0, 4, 8]);
    expectOffsets('  ab  cd', 1000);
    expectOffsets('é 👩‍👩‍👧 ação', 30);
  });

  it('wraps exactly like wrapText', () => {
    const text = 'um dois três\nquatro cinco seis sete';
    expect(wrapTextWithOffsets(text, 50, widthAt10).map((line) => line.text)).toEqual(
      wrapText(text, 50, widthAt10),
    );
  });

  it('exposes the offsets through layoutText', () => {
    const fit = layoutText('Casa\nda Ana', area(1000, 400), 10, measure);
    expect(fit.lines).toEqual(['Casa', 'da Ana']);
    expect(fit.starts).toEqual([0, 5]);
  });
});
