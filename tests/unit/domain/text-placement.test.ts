import {
  catalogTextAlign,
  defaultPlacement,
  effectivePlacement,
  isValidPlacement,
  matchesPreset,
  nudgePlacement,
  PRESET_COLUMNS,
  PRESET_ROWS,
  presetPlacement,
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
  it('set alignment, x, and y together: column → alignment and x, row → y', () => {
    expect(presetPlacement('top', 'left')).toEqual({ align: 'left', x: 0, y: 0 });
    expect(presetPlacement('middle', 'center')).toEqual({ align: 'center', x: 0.5, y: 0.5 });
    expect(presetPlacement('bottom', 'right')).toEqual({ align: 'right', x: 1, y: 1 });
  });

  it('are nine distinct placements, each matching only itself', () => {
    const all = PRESET_ROWS.flatMap((row) => PRESET_COLUMNS.map((column) => ({ row, column })));
    expect(
      new Set(all.map(({ row, column }) => JSON.stringify(presetPlacement(row, column)))).size,
    ).toBe(9);
    for (const a of all) {
      for (const b of all) {
        expect(matchesPreset(presetPlacement(a.row, a.column), b.row, b.column)).toBe(a === b);
      }
    }
  });

  it('require the alignment as well as the position', () => {
    // A stored placement (e.g. from the catalog default) need not match any preset.
    const moved = { align: 'right', x: 0, y: 0 } as const;
    expect(matchesPreset(moved, 'top', 'left')).toBe(false);
    expect(matchesPreset(moved, 'top', 'right')).toBe(false);
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
        validConfiguration({ textLayout: presetPlacement('bottom', 'right') }),
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
