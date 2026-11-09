import {
  CALIBRATION_CAP_RATIO,
  graphemeCount,
  LETTERING_FONTS,
  letteringFont,
  spacedWidth,
} from '../../../src/preview/lettering-fonts';

describe('lettering fonts (D-072)', () => {
  it('uses Quicksand Bold for "Sem serifa" and Gelasio Regular for "Com serifa"', () => {
    const sans = LETTERING_FONTS['sans-serif'];
    const serif = LETTERING_FONTS.serif;

    expect(sans.weight).toBe(700);
    expect(serif.weight).toBe(400);
    expect(sans.faces.map((face) => face.src)).toEqual([
      expect.stringMatching(/quicksand-latin-700-normal\.woff2$/),
      expect.stringMatching(/quicksand-latin-ext-700-normal\.woff2$/),
    ]);
    expect(serif.faces.map((face) => face.src)).toEqual([
      expect.stringMatching(/gelasio-latin-400-normal\.woff2$/),
      expect.stringMatching(/gelasio-latin-ext-400-normal\.woff2$/),
    ]);
    // The Latin subset covers every pt-BR letter (Ç, Ã, Õ, É, Ê, À, Ü…).
    for (const font of [sans, serif]) expect(font.faces[0]?.unicodeRange).toMatch(/^U\+0000-00FF,/);
  });

  it('registers its own family names, never a system font name, with the system stacks as fallback', () => {
    expect(letteringFont(24, 'sans-serif')).toBe(
      '700 24px "Taavi Lettering Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    );
    expect(letteringFont(24, 'serif')).toBe(
      '400 24px "Taavi Lettering Serif", Georgia, "Times New Roman", Times, serif',
    );
  });

  it('spaces only "Sem serifa", by 0.05 em', () => {
    expect(LETTERING_FONTS['sans-serif'].letterSpacing).toBe(0.05);
    expect(LETTERING_FONTS.serif.letterSpacing).toBe(0);
  });

  it('keeps the 7 mm capital of the catalog calibration (D-055)', () => {
    const sans = LETTERING_FONTS['sans-serif'];
    expect(sans.capRatio * sans.sizeScale).toBeCloseTo(CALIBRATION_CAP_RATIO, 12);
    // Gelasio keeps the serif lettering exactly as calibrated before (Georgia's metrics).
    expect(LETTERING_FONTS.serif.sizeScale).toBe(1);
  });
});

describe('graphemeCount', () => {
  it.each([
    ['', 0],
    ['PAZ', 3],
    ['AÇÃO', 4],
    // "E" + combining acute: one character to the reader.
    ['CAFÉ', 4],
    ['👩‍👩‍👧 OI', 4],
  ])('counts %j as %i characters', (text, count) => {
    expect(graphemeCount(text)).toBe(count);
  });
});

describe('spacedWidth', () => {
  it('adds the spacing between graphemes only, never after the last', () => {
    expect(spacedWidth('PAZ', 30, 2)).toBe(34);
    expect(spacedWidth('A', 10, 2)).toBe(10);
    expect(spacedWidth('', 0, 2)).toBe(0);
  });

  it('never spaces inside an accented letter or an emoji', () => {
    expect(spacedWidth('CAFÉ', 40, 1)).toBe(43);
    expect(spacedWidth('👩‍👩‍👧A', 40, 1)).toBe(41);
  });

  it('is the unspaced width when there is no spacing', () => {
    expect(spacedWidth('Eu te amo', 87.5, 0)).toBe(87.5);
  });
});
