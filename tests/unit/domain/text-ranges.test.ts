import {
  addRange,
  areValidRanges,
  graphemeBoundaries,
  normalizeRanges,
  remapRanges,
  removeRange,
  snapSelection,
  type TextRange,
} from '../../../src/domain';

const FAMILY = '👩‍👩‍👧'; // 8 UTF-16 units, one grapheme
const r = (start: number, end: number): TextRange => ({ start, end });

describe('graphemeBoundaries', () => {
  it('keeps combining marks and emoji sequences together', () => {
    expect([...graphemeBoundaries(`é${FAMILY}x`)].sort((a, b) => a - b)).toEqual([0, 2, 10, 11]);
  });

  it('has only 0 for empty text', () => {
    expect([...graphemeBoundaries('')]).toEqual([0]);
  });
});

describe('normalizeRanges', () => {
  it('sorts, drops empty ranges, and merges overlapping or touching ones', () => {
    expect(normalizeRanges([r(5, 7), r(0, 2), r(2, 3), r(4, 4), r(6, 9)])).toEqual([
      r(0, 3),
      r(5, 9),
    ]);
  });
});

describe('areValidRanges', () => {
  it('accepts sorted, disjoint, in-bounds, grapheme-aligned ranges', () => {
    expect(areValidRanges('abcdef', [r(0, 2), r(3, 6)])).toBe(true);
    expect(areValidRanges('abcdef', [])).toBe(true);
  });

  it.each([
    ['empty range', [r(2, 2)]],
    ['reversed', [r(3, 1)]],
    ['out of bounds', [r(4, 9)]],
    ['negative', [r(-1, 2)]],
    ['fractional', [r(0.5, 2)]],
    ['overlapping', [r(0, 3), r(2, 4)]],
    ['unsorted', [r(3, 4), r(0, 1)]],
  ])('rejects %s', (_label, ranges) => {
    expect(areValidRanges('abcdef', ranges)).toBe(false);
  });

  it('rejects ranges that cut a grapheme cluster', () => {
    expect(areValidRanges(`a${FAMILY}`, [r(0, 3)])).toBe(false);
    expect(areValidRanges('é', [r(0, 1)])).toBe(false);
    expect(areValidRanges(`a${FAMILY}`, [r(1, 9)])).toBe(true);
  });
});

describe('snapSelection', () => {
  it('expands a selection to whole grapheme clusters', () => {
    expect(snapSelection(`a${FAMILY}b`, 3, 4)).toEqual(r(1, 9));
    expect(snapSelection('éx', 1, 2)).toEqual(r(0, 2));
  });

  it('accepts a reversed selection and clamps it to the text', () => {
    expect(snapSelection('abc', 5, 1)).toEqual(r(1, 3));
  });

  it('returns null for an empty selection', () => {
    expect(snapSelection('abc', 2, 2)).toBeNull();
    expect(snapSelection('', 0, 3)).toBeNull();
  });
});

describe('addRange / removeRange', () => {
  it('adds a selection and merges with existing ranges', () => {
    expect(addRange('abcdefgh', [r(0, 2), r(5, 6)], 2, 5)).toEqual([r(0, 6)]);
  });

  it('never colors line breaks', () => {
    expect(addRange('ab\ncd', [], 0, 5)).toEqual([r(0, 2), r(3, 5)]);
    expect(addRange('ab\r\ncd', [], 0, 6)).toEqual([r(0, 2), r(4, 6)]);
    expect(addRange('a\n\nb', [], 1, 3)).toEqual([]);
  });

  it('snaps to grapheme clusters when adding and removing', () => {
    expect(addRange(`a${FAMILY}b`, [], 3, 4)).toEqual([r(1, 9)]);
    expect(removeRange(`a${FAMILY}b`, [r(0, 10)], 3, 4)).toEqual([r(0, 1), r(9, 10)]);
  });

  it('removes part of a range, splitting it when needed', () => {
    expect(removeRange('abcdefgh', [r(1, 7)], 3, 5)).toEqual([r(1, 3), r(5, 7)]);
    expect(removeRange('abcdefgh', [r(1, 7)], 0, 3)).toEqual([r(3, 7)]);
    expect(removeRange('abcdefgh', [r(1, 3)], 1, 3)).toEqual([]);
  });

  it('ignores an empty selection and leaves the text alone', () => {
    expect(addRange('abc', [r(0, 1)], 2, 2)).toEqual([r(0, 1)]);
    expect(removeRange('abc', [r(0, 1)], 2, 2)).toEqual([r(0, 1)]);
  });
});

describe('remapRanges', () => {
  it('shifts ranges after an insertion before them', () => {
    expect(remapRanges('abcdef', 'XXabcdef', [r(2, 4)], 2)).toEqual({
      ranges: [r(4, 6)],
      ambiguous: false,
    });
  });

  it('keeps ranges before an insertion and does not extend a range at its end', () => {
    expect(remapRanges('abcdef', 'abcdefXX', [r(2, 4)], 8).ranges).toEqual([r(2, 4)]);
    expect(remapRanges('abcdef', 'abcdXXef', [r(2, 4)], 6).ranges).toEqual([r(2, 4)]);
  });

  it('does not color text typed inside a range: the range is split', () => {
    expect(remapRanges('abcdef', 'abcZZdef', [r(1, 5)], 5).ranges).toEqual([r(1, 3), r(5, 7)]);
  });

  it('shrinks a range when characters inside it are deleted', () => {
    expect(remapRanges('abcdef', 'abef', [r(1, 5)], 2).ranges).toEqual([r(1, 3)]);
    expect(remapRanges('abcdef', 'def', [r(2, 5)], 0).ranges).toEqual([r(0, 2)]);
  });

  it('drops a range whose characters are all replaced', () => {
    expect(remapRanges('abc', 'xyz', [r(0, 3)], 3)).toEqual({ ranges: [], ambiguous: false });
  });

  it('does not color the characters that replace a colored one', () => {
    expect(remapRanges('abcdef', 'abXdef', [r(0, 4)]).ranges).toEqual([r(0, 2), r(3, 4)]);
  });

  it('is exact inside repeated characters when the caret is known', () => {
    // Backspace at the end of "aaa": the last "a" is removed.
    expect(remapRanges('aaa', 'aa', [r(1, 2)], 2)).toEqual({ ranges: [r(1, 2)], ambiguous: false });
    // Delete at the start: the first "a" is removed and the range shifts.
    expect(remapRanges('aaa', 'aa', [r(1, 2)], 0)).toEqual({ ranges: [r(0, 1)], ambiguous: false });
  });

  it('removes the possibly affected formatting when the edit is ambiguous', () => {
    const result = remapRanges('aaa', 'aa', [r(1, 2)]);
    expect(result).toEqual({ ranges: [], ambiguous: true });
  });

  it('keeps formatting that no ambiguous edit could touch', () => {
    // The "b" range lies outside the run of repeated characters.
    const result = remapRanges('aaab', 'aab', [r(3, 4)]);
    expect(result.ranges).toEqual([r(2, 3)]);
  });

  it('falls back to the text diff when the caret does not describe the edit', () => {
    expect(remapRanges('abcdef', 'XXabcdef', [r(2, 4)], 0).ranges).toEqual([r(4, 6)]);
  });

  it('never cuts a grapheme cluster, whatever the edit', () => {
    const cases: [string, string, TextRange[]][] = [
      ['a😀b', 'a😁b', [r(0, 4)]],
      ['éx', 'ex', [r(0, 3)]],
      [`a${FAMILY}b`, 'ab', [r(0, 10)]],
      [`x${FAMILY}`, `x${FAMILY}${FAMILY}`, [r(0, 9)]],
    ];
    for (const [before, after, ranges] of cases) {
      for (const caret of [undefined, 0, 1, 2, 3, after.length]) {
        const result = remapRanges(before, after, ranges, caret);
        expect(areValidRanges(after, result.ranges), `${before} -> ${after} @${caret}`).toBe(true);
      }
    }
  });

  it('colors only the characters around a replaced emoji', () => {
    expect(remapRanges('a😀b', 'a😁b', [r(0, 4)], 3).ranges).toEqual([r(0, 1), r(3, 4)]);
  });

  it('is deterministic and returns the ranges unchanged for identical text', () => {
    const ranges = [r(1, 3)];
    expect(remapRanges('abc', 'abc', ranges)).toEqual({ ranges, ambiguous: false });
    expect(remapRanges('abcdef', 'abXcdef', [r(0, 6)], 3)).toEqual(
      remapRanges('abcdef', 'abXcdef', [r(0, 6)], 3),
    );
  });
});
