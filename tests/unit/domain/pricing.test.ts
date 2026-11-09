import {
  clampQuantity,
  estimatedTotalCents,
  formatBRL,
  isValidPriceCents,
  MAX_QUANTITY,
  MIN_QUANTITY,
  parseQuantity,
} from '../../../src/domain';

describe('formatBRL (D-080)', () => {
  it.each([
    [9800, 'R$ 98,00'],
    [10000, 'R$ 100,00'],
    [11000, 'R$ 110,00'],
    [27000, 'R$ 270,00'],
    [19600, 'R$ 196,00'],
    [270000, 'R$ 2.700,00'],
    [2673000, 'R$ 26.730,00'],
    [123456789, 'R$ 1.234.567,89'],
    [5, 'R$ 0,05'],
    [99, 'R$ 0,99'],
  ])('formats %i cents as %s', (cents, text) => {
    expect(formatBRL(cents)).toBe(text);
  });

  it('uses a plain space, the same in every browser', () => {
    expect(formatBRL(9800)).not.toMatch(/\u00a0|\u202f/);
  });
});

describe('isValidPriceCents (D-080)', () => {
  it('accepts whole cents above zero only', () => {
    expect(isValidPriceCents(9800)).toBe(true);
    for (const value of [0, -1, 98.5, Number.NaN, Number.POSITIVE_INFINITY, '9800', null]) {
      expect(isValidPriceCents(value)).toBe(false);
    }
  });
});

describe('quantity (D-080)', () => {
  it('is limited to 1–99', () => {
    expect([MIN_QUANTITY, MAX_QUANTITY]).toEqual([1, 99]);
  });

  it.each([
    [1, 1],
    [42, 42],
    [99, 99],
    [0, 1],
    [-3, 1],
    [100, 99],
    [2.7, 2],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
  ])('clamps %d to %d', (value, clamped) => {
    expect(clampQuantity(value)).toBe(clamped);
  });

  it.each([
    ['1', 1],
    ['2', 2],
    ['99', 99],
    ['07', 7],
  ])('takes the typed %j as %d', (text, quantity) => {
    expect(parseQuantity(text)).toBe(quantity);
  });

  it.each(['', ' ', '0', '00', '-1', '2.5', '2,5', '1e1', '100', 'abc', '+3', ' 3'])(
    'refuses the typed %j, never repairing it',
    (text) => {
      expect(parseQuantity(text)).toBeNull();
    },
  );

  it('multiplies the unit price by the quantity, in whole cents', () => {
    expect(estimatedTotalCents(9800, 2)).toBe(19600);
    expect(estimatedTotalCents(27000, 99)).toBe(2673000);
    expect(Number.isSafeInteger(estimatedTotalCents(10000, 3))).toBe(true);
  });
});
