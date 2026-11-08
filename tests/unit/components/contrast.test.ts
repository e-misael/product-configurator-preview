import { getCatalog } from '../../../src/catalog';
import { contrastRatio, readableInk } from '../../../src/components/configurator/contrast';

describe('selected word contrast (D-071)', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('gives Amarelo queimado dark letters and the darker colors white ones', () => {
    expect(readableInk('#b38f00')).toBe('#000000');
    for (const hex of ['#802b00', '#002b80', '#006600', '#7a1f1f', '#b25900', '#000000']) {
      expect(readableInk(hex)).toBe('#ffffff');
    }
  });

  it.each(getCatalog().textColors.map((color) => [color.displayName, color.hex] as const))(
    'reaches WCAG AA (4.5:1) on %s',
    (_name, hex) => {
      expect(contrastRatio(hex, readableInk(hex))).toBeGreaterThanOrEqual(4.5);
    },
  );
});
