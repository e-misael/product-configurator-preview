import { areWordRanges, remapWords, toggleWord, wordsOf } from '../../../src/domain';

const lettersOf = (text: string) => wordsOf(text).map(({ start, end }) => text.slice(start, end));
const at = (text: string, word: string, occurrence = 1) => {
  let start = -1;
  for (let i = 0; i < occurrence; i += 1) start = text.indexOf(word, start + 1);
  if (start < 0) throw new Error(`No ${word} #${occurrence}`);
  return { start, end: start + word.length };
};

describe('wordsOf (D-071)', () => {
  it('finds accented Portuguese words and leaves punctuation out', () => {
    expect(lettersOf('Ação, coração! É já?')).toEqual(['Ação', 'coração', 'É', 'já']);
  });

  it('keeps hyphenated words and internal apostrophes as one word', () => {
    expect(lettersOf("Guarda-chuva d'água pé‑de‑moleque")).toEqual([
      'Guarda-chuva',
      "d'água",
      'pé',
      'de',
      'moleque',
    ]);
    // A curly apostrophe also joins; a hyphen or apostrophe at the edge does not.
    expect(lettersOf('d’água -fim- ’ok')).toEqual(['d’água', 'fim', 'ok']);
  });

  it('treats line breaks, spaces, digits, and emoji as the text has them', () => {
    expect(lettersOf('Casa 21\nda  Ana 👩‍👩‍👧')).toEqual(['Casa', '21', 'da', 'Ana']);
    expect(wordsOf('Ana\r\nBia')).toEqual([
      { start: 0, end: 3 },
      { start: 5, end: 8 },
    ]);
  });

  it('keeps combining marks inside the word, never cutting a grapheme', () => {
    const text = 'José e Ana';
    expect(lettersOf(text)).toEqual(['José', 'e', 'Ana']);
  });

  it('finds no word in punctuation or emoji only', () => {
    expect(wordsOf('!!! 👍 ...')).toEqual([]);
    expect(wordsOf('')).toEqual([]);
  });
});

describe('toggleWord', () => {
  const text = 'Ana e Ana';

  it('highlights repeated occurrences independently and keeps them in order', () => {
    const second = toggleWord([], at(text, 'Ana', 2));
    expect(second).toEqual([{ start: 6, end: 9 }]);
    expect(toggleWord(second, at(text, 'Ana'))).toEqual([
      { start: 0, end: 3 },
      { start: 6, end: 9 },
    ]);
  });

  it('removes the highlight of the tapped occurrence only', () => {
    const both = [at(text, 'Ana'), at(text, 'Ana', 2)];
    expect(toggleWord(both, at(text, 'Ana'))).toEqual([{ start: 6, end: 9 }]);
  });
});

describe('areWordRanges', () => {
  it('accepts whole words, including every word', () => {
    expect(areWordRanges('Casa da Ana', wordsOf('Casa da Ana'))).toBe(true);
    expect(areWordRanges('Casa da Ana', [])).toBe(true);
  });

  it('rejects partial words, punctuation, duplicates, and disorder', () => {
    expect(areWordRanges('Casa!', [{ start: 0, end: 5 }])).toBe(false);
    expect(areWordRanges('Casa', [{ start: 0, end: 2 }])).toBe(false);
    expect(
      areWordRanges('Ana Ana', [
        { start: 4, end: 7 },
        { start: 0, end: 3 },
      ]),
    ).toBe(false);
  });
});

describe('remapWords: highlights after text edits (D-071)', () => {
  it('keeps highlights on unchanged words after an insertion before them', () => {
    const before = 'Casa da Ana';
    const after = 'Oi, Casa da Ana';
    expect(remapWords(before, after, [at(before, 'Ana')], 4)).toEqual({
      ranges: [at(after, 'Ana')],
      removed: false,
    });
  });

  it('keeps the same occurrence of a repeated word, never another one', () => {
    const before = 'Ana e Ana';
    // The first "Ana " is deleted with the caret at the start: the second "Ana" stays highlighted.
    expect(remapWords(before, 'e Ana', [at(before, 'Ana', 2)], 0)).toEqual({
      ranges: [{ start: 2, end: 5 }],
      removed: false,
    });
    // Deleting the highlighted first "Ana" does not move its highlight to the second one.
    expect(remapWords(before, 'e Ana', [at(before, 'Ana')], 0)).toEqual({
      ranges: [],
      removed: true,
    });
  });

  it('keeps highlights after a deletion elsewhere', () => {
    const before = 'Casa da Ana';
    expect(remapWords(before, 'Casa Ana', [at(before, 'Casa'), at(before, 'Ana')], 5)).toEqual({
      ranges: [
        { start: 0, end: 4 },
        { start: 5, end: 8 },
      ],
      removed: false,
    });
  });

  it('removes the highlight of a word that was edited or replaced', () => {
    const before = 'Casa da Ana';
    // Typing inside, at the end of, or replacing the word.
    expect(remapWords(before, 'Casas da Ana', [at(before, 'Casa')], 5).ranges).toEqual([]);
    expect(remapWords(before, 'Caxsa da Ana', [at(before, 'Casa')], 3).removed).toBe(true);
    expect(remapWords(before, 'Casa da Bia', [at(before, 'Ana')], 11)).toEqual({
      ranges: [],
      removed: true,
    });
  });

  it('removes only the affected highlight when the edit cannot be located', () => {
    const before = 'Ana Ana Bia';
    // Without a caret, "Ana Ana" -> "Ana" could be either occurrence.
    expect(remapWords(before, 'Ana Bia', [at(before, 'Ana', 2), at(before, 'Bia')])).toEqual({
      ranges: [{ start: 4, end: 7 }],
      removed: true,
    });
  });

  it('keeps accented words and punctuation through an edit elsewhere', () => {
    const before = 'Ação, João!';
    const after = 'Ação, João! Já.';
    expect(remapWords(before, after, [at(before, 'João')], after.length)).toEqual({
      ranges: [at(after, 'João')],
      removed: false,
    });
  });

  it('changes nothing when the text is the same', () => {
    expect(remapWords('Ana', 'Ana', [{ start: 0, end: 3 }])).toEqual({
      ranges: [{ start: 0, end: 3 }],
      removed: false,
    });
  });
});
