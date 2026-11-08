import { validateCatalog } from '../../../src/domain';
import { demoCatalog } from '../../../src/demo/demo-catalog';

const entries = [...demoCatalog.plates, ...demoCatalog.frames, ...demoCatalog.colors];

describe('demo catalog (D-028)', () => {
  it('passes catalog validation', () => {
    expect(validateCatalog(demoCatalog)).toEqual({ status: 'valid' });
  });

  it('is deep-frozen', () => {
    expect(Object.isFrozen(demoCatalog)).toBe(true);
    expect(Object.isFrozen(demoCatalog.plates)).toBe(true);
    for (const entry of entries) expect(Object.isFrozen(entry)).toBe(true);
  });

  it.each(entries.map((entry) => [entry.id, entry] as const))(
    '%s is clearly labeled as demonstration data',
    (id, entry) => {
      expect(id.startsWith('demo-')).toBe(true);
      expect(entry.displayName).toContain('(demonstração)');
    },
  );

  it('invents no assets, swatches, or dimensions', () => {
    for (const plate of demoCatalog.plates) {
      expect(plate.asset).toBeUndefined();
      expect(plate.dimensions).toEqual({ status: 'pending' });
    }
    for (const frame of demoCatalog.frames) expect(frame.assets).toBeUndefined();
    for (const color of demoCatalog.colors) {
      expect(color.swatch).toBeUndefined();
      expect(color).not.toHaveProperty('hex');
    }
  });

  it('covers a frameless circular plate and a frame restricted by shape', () => {
    expect(demoCatalog.plates.some((p) => p.shape === 'circle' && !p.supportsFrame)).toBe(true);
    expect(demoCatalog.frames.some((f) => f.compatibility.shapes.length === 1)).toBe(true);
  });
});
