import { letteringText } from '../../../src/domain';

describe('letteringText (D-068)', () => {
  it('keeps "Com serifa" text exactly as typed, mixed case included', () => {
    expect(letteringText('Casa da Ana\nDesde 2024', 'serif')).toBe('Casa da Ana\nDesde 2024');
  });

  it('capitalizes "Sem serifa", keeping Portuguese accents and cedillas', () => {
    expect(letteringText('ação, coração e pé — já é útil? ãõâêôàü', 'sans-serif')).toBe(
      'AÇÃO, CORAÇÃO E PÉ — JÁ É ÚTIL? ÃÕÂÊÔÀÜ',
    );
  });

  it('keeps every character at its offset, so second-color ranges still apply', () => {
    // "ß" capitalizes to two letters: it is kept as typed rather than shifting the offsets.
    for (const text of ['straße', 'ﬁm', 'Ação 👩‍👩‍👧 João', '  a\r\nb ']) {
      expect(letteringText(text, 'sans-serif')).toHaveLength(text.length);
    }
    expect(letteringText('straße', 'sans-serif')).toBe('STRAßE');
  });
});
