import {
  alignPlacement,
  catalogTextAlign,
  defaultPlacement,
  effectivePlacement,
  isDefaultPosition,
  isValidPlacement,
  matchesPreset,
  nudgePlacement,
  PRESET_COLUMNS,
  PRESET_ROWS,
  presetPlacement,
  resetPosition,
  resolvePlacement,
  validateConfiguration,
  type TextPlacement,
} from '../../../src/domain';
import { testCatalog, validConfiguration } from './fixtures';

describe('isValidPlacement', () => {
  it.each([
    [{ align: 'left', x: 0, y: 0 }],
    [{ align: 'center', x: 0.5, y: 0.5 }],
    [{ align: 'right', x: 1, y: 1 }],
  ])('accepts %o', (value) => {
    expect(isValidPlacement(value)).toBe(true);
  });

  it.each([
    ['null', null],
    ['an unknown alignment', { align: 'justify', x: 0.5, y: 0.5 }],
    ['x below 0', { align: 'left', x: -0.01, y: 0.5 }],
    ['y above 1', { align: 'left', x: 0.5, y: 1.01 }],
    ['NaN', { align: 'left', x: Number.NaN, y: 0.5 }],
    ['Infinity', { align: 'left', x: 0.5, y: Number.POSITIVE_INFINITY }],
    ['a string coordinate', { align: 'left', x: '0.5', y: 0.5 }],
  ])('rejects %s', (_label, value) => {
    expect(isValidPlacement(value)).toBe(false);
  });
});

describe('defaults', () => {
  it('anchors the block to match the catalog alignment, vertically centered', () => {
    expect(defaultPlacement('left')).toEqual({ align: 'left', x: 0, y: 0.5 });
    expect(defaultPlacement('center')).toEqual({ align: 'center', x: 0.5, y: 0.5 });
    expect(defaultPlacement('right')).toEqual({ align: 'right', x: 1, y: 0.5 });
    expect(defaultPlacement()).toEqual({ align: 'center', x: 0.5, y: 0.5 });
  });

  it('uses a stored valid placement, otherwise the default', () => {
    const stored = { align: 'right', x: 0.2, y: 0.9 } as const;
    expect(resolvePlacement(stored, 'left')).toBe(stored);
    expect(resolvePlacement(null, 'left')).toEqual(defaultPlacement('left'));
    expect(resolvePlacement({ align: 'left', x: 2, y: 0 }, 'center')).toEqual(defaultPlacement());
  });

  it('reads the catalog alignment of the selected model', () => {
    expect(catalogTextAlign(undefined)).toBe('center');
    expect(effectivePlacement(validConfiguration(), testCatalog)).toEqual(defaultPlacement());
    expect(effectivePlacement(validConfiguration({ plateId: null }), testCatalog)).toEqual(
      defaultPlacement(),
    );
  });
});

describe('presets', () => {
  it('place the block only: column → x, row → y, the alignment is kept (D-059)', () => {
    expect(presetPlacement('top', 'left', 'center')).toEqual({ align: 'center', x: 0, y: 0 });
    expect(presetPlacement('middle', 'center', 'right')).toEqual({
      align: 'right',
      x: 0.5,
      y: 0.5,
    });
    expect(presetPlacement('bottom', 'right', 'left')).toEqual({ align: 'left', x: 1, y: 1 });
  });

  it('are nine distinct positions, each matching only itself', () => {
    const all = PRESET_ROWS.flatMap((row) => PRESET_COLUMNS.map((column) => ({ row, column })));
    expect(
      new Set(all.map(({ row, column }) => JSON.stringify(presetPlacement(row, column, 'center'))))
        .size,
    ).toBe(9);
    for (const a of all) {
      for (const b of all) {
        expect(matchesPreset(presetPlacement(a.row, a.column, 'left'), b.row, b.column)).toBe(
          a === b,
        );
      }
    }
  });

  it('match by position whatever the alignment', () => {
    for (const align of ['left', 'center', 'right'] as const) {
      expect(matchesPreset({ align, x: 0, y: 0 }, 'top', 'left')).toBe(true);
      expect(matchesPreset({ align, x: 0, y: 0 }, 'top', 'right')).toBe(false);
    }
  });
});

describe('alignPlacement', () => {
  it.each(['left', 'center', 'right'] as const)('sets %s without moving the block', (align) => {
    const start = { align: 'center', x: 0.3, y: 0.8 } as const;
    expect(alignPlacement(start, align)).toEqual({ align, x: 0.3, y: 0.8 });
  });
});

describe('resetPosition', () => {
  it('returns the default position and keeps the chosen alignment', () => {
    expect(resetPosition({ align: 'right', x: 0, y: 0 })).toEqual({
      align: 'right',
      x: 0.5,
      y: 0.5,
    });
    expect(resetPosition({ align: 'left', x: 0.2, y: 0.1 }, 'left')).toBeNull();
    expect(resetPosition({ align: 'center', x: 1, y: 1 }, 'right')).toEqual({
      align: 'center',
      x: 1,
      y: 0.5,
    });
  });

  it('isDefaultPosition compares the position only', () => {
    expect(isDefaultPosition({ align: 'right', x: 0.5, y: 0.5 })).toBe(true);
    expect(isDefaultPosition({ align: 'center', x: 0, y: 0.5 })).toBe(false);
    expect(isDefaultPosition({ align: 'center', x: 0, y: 0.5 }, 'left')).toBe(true);
  });
});

describe('nudgePlacement', () => {
  const start = { align: 'center', x: 0.5, y: 0.5 } as const;

  it('moves by the given fractions without changing the alignment', () => {
    expect(nudgePlacement(start, 0.02, -0.1)).toEqual({ align: 'center', x: 0.52, y: 0.4 });
  });

  it('lands exactly on round values after repeated steps', () => {
    let placement: TextPlacement = { align: 'left', x: 0, y: 0 };
    for (let i = 0; i < 5; i += 1) placement = nudgePlacement(placement, 0.02, 0.02);
    expect(placement).toEqual({ align: 'left', x: 0.1, y: 0.1 });
  });

  it('clamps to the free space', () => {
    expect(nudgePlacement({ align: 'left', x: 0.01, y: 0.95 }, -0.1, 0.1)).toEqual({
      align: 'left',
      x: 0,
      y: 1,
    });
  });
});

describe('validateConfiguration: textLayout', () => {
  it('accepts null and valid placements', () => {
    expect(validateConfiguration(validConfiguration(), testCatalog)).toEqual({ status: 'valid' });
    expect(
      validateConfiguration(
        validConfiguration({ textLayout: presetPlacement('bottom', 'right', 'right') }),
        testCatalog,
      ),
    ).toEqual({ status: 'valid' });
  });

  it('reports an invalid placement without repairing it', () => {
    const config = validConfiguration({ textLayout: { align: 'left', x: 1.5, y: 0 } });

    expect(validateConfiguration(config, testCatalog)).toEqual({
      status: 'invalid',
      issues: [{ kind: 'invalid', field: 'textLayout', code: 'invalid-layout' }],
    });
    expect(config.textLayout).toEqual({ align: 'left', x: 1.5, y: 0 });
  });

  it('lists the placement issue after the other fields', () => {
    const result = validateConfiguration(
      validConfiguration({ text: '', textLayout: { align: 'left', x: -1, y: 0 } }),
      testCatalog,
    );
    expect(result.status !== 'valid' && result.issues.map((issue) => issue.field)).toEqual([
      'text',
      'textLayout',
    ]);
  });
});
