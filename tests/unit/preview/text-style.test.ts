import { FALLBACK_TEXT_COLOR, FONT_STACKS, segmentLine } from '../../../src/preview/text-style';

const style = (ranges: { start: number; end: number }[]) => ({
  fontFamily: 'sans-serif' as const,
  primaryColor: '#111111',
  secondary: { color: '#222222', ranges },
});

describe('segmentLine', () => {
  it('is one primary segment without a secondary color', () => {
    expect(
      segmentLine('Casa', 0, {
        fontFamily: 'serif',
        primaryColor: '#111111',
        secondary: undefined,
      }),
    ).toEqual([{ text: 'Casa', color: '#111111' }]);
  });

  it('splits a line at range boundaries and loses no characters', () => {
    const segments = segmentLine(
      'abcdef',
      0,
      style([
        { start: 1, end: 3 },
        { start: 5, end: 6 },
      ]),
    );
    expect(segments).toEqual([
      { text: 'a', color: '#111111' },
      { text: 'bc', color: '#222222' },
      { text: 'de', color: '#111111' },
      { text: 'f', color: '#222222' },
    ]);
    expect(segments.map((segment) => segment.text).join('')).toBe('abcdef');
  });

  it('uses source offsets: a later line is colored by where it starts in the text', () => {
    // Source "ab cd ef"; the second line "cd" starts at 3 and the range is [4,5) = "d".
    expect(segmentLine('cd', 3, style([{ start: 4, end: 5 }]))).toEqual([
      { text: 'c', color: '#111111' },
      { text: 'd', color: '#222222' },
    ]);
  });

  it('ignores ranges outside the line', () => {
    expect(
      segmentLine(
        'cd',
        3,
        style([
          { start: 0, end: 3 },
          { start: 5, end: 9 },
        ]),
      ),
    ).toEqual([{ text: 'cd', color: '#111111' }]);
  });

  it('keeps empty lines as one empty segment', () => {
    expect(segmentLine('', 4, style([{ start: 0, end: 9 }]))).toEqual([
      { text: '', color: '#111111' },
    ]);
  });
});

describe('typography constants', () => {
  it('defines a provisional stack for each family and a neutral fallback color', () => {
    expect(FONT_STACKS.serif).toContain('serif');
    expect(FONT_STACKS['sans-serif']).toContain('sans-serif');
    expect(FONT_STACKS.serif).not.toBe(FONT_STACKS['sans-serif']);
    expect(FALLBACK_TEXT_COLOR).toMatch(/^#[0-9a-f]{6}$/);
  });
});
