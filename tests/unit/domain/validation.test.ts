import {
  createEmptyConfiguration,
  getPlateShape,
  isFrameCompatible,
  validateConfiguration,
  type Configuration,
  type ValidationResult,
} from '../../../src/domain';
import { getCatalog } from '../../../src/catalog';
import { testCatalog, validConfiguration } from './fixtures';

function issuesOf(result: ValidationResult) {
  return result.status === 'valid' ? [] : result.issues;
}

describe('validateConfiguration', () => {
  describe('valid configurations', () => {
    it('accepts a complete configuration without a frame', () => {
      expect(validateConfiguration(validConfiguration(), testCatalog)).toEqual({ status: 'valid' });
    });

    it('accepts a compatible frame', () => {
      const config = validConfiguration({
        plateId: 'test-plate-rectangle',
        frameId: 'test-frame-any',
      });
      expect(validateConfiguration(config, testCatalog)).toEqual({ status: 'valid' });
    });

    it('accepts a circular plate without a frame', () => {
      const config = validConfiguration({ plateId: 'test-plate-circle' });
      expect(validateConfiguration(config, testCatalog)).toEqual({ status: 'valid' });
    });

    it('accepts a specific color that matches category and plate', () => {
      const config = validConfiguration({
        colorCategory: 'colored',
        colorId: 'test-color-colored',
      });
      expect(validateConfiguration(config, testCatalog).status).toBe('valid');
    });
  });

  describe('incomplete configurations', () => {
    it('reports every required field as missing for an empty configuration', () => {
      const result = validateConfiguration(createEmptyConfiguration(), testCatalog);

      expect(result.status).toBe('incomplete');
      expect(issuesOf(result)).toEqual([
        { kind: 'missing', field: 'plateId' },
        { kind: 'missing', field: 'colorCategory' },
        { kind: 'missing', field: 'text' },
      ]);
    });

    it('does not require a frame or a specific color', () => {
      const missingFields = issuesOf(
        validateConfiguration(createEmptyConfiguration(), testCatalog),
      ).map((issue) => issue.field);

      expect(missingFields).not.toContain('frameId');
      expect(missingFields).not.toContain('colorId');
    });

    it.each<keyof Configuration>(['plateId', 'colorCategory'])(
      'is incomplete when %s is not selected',
      (field) => {
        const result = validateConfiguration(validConfiguration({ [field]: null }), testCatalog);
        expect(result).toEqual({ status: 'incomplete', issues: [{ kind: 'missing', field }] });
      },
    );

    it('is incomplete when text is empty', () => {
      const result = validateConfiguration(validConfiguration({ text: '' }), testCatalog);
      expect(result).toEqual({
        status: 'incomplete',
        issues: [{ kind: 'missing', field: 'text' }],
      });
    });
  });

  describe('invalid configurations', () => {
    it.each([
      ['unknown plate', { plateId: 'does-not-exist' }, 'plateId', 'unknown-reference'],
      ['unavailable plate', { plateId: 'test-plate-unavailable' }, 'plateId', 'unavailable'],
      [
        'color category unsupported by plate',
        { plateId: 'test-plate-rectangle', colorCategory: 'colored' },
        'colorCategory',
        'unsupported-by-plate',
      ],
      ['unknown color', { colorId: 'does-not-exist' }, 'colorId', 'unknown-reference'],
      ['unavailable color', { colorId: 'test-color-retired' }, 'colorId', 'unavailable'],
      [
        'color from another category',
        { colorCategory: 'nude', colorId: 'test-color-colored' },
        'colorId',
        'category-mismatch',
      ],
      [
        'color unsupported by plate',
        { colorId: 'test-color-unsupported' },
        'colorId',
        'unsupported-by-plate',
      ],
      ['unknown frame', { frameId: 'does-not-exist' }, 'frameId', 'unknown-reference'],
      ['unavailable frame', { frameId: 'test-frame-unavailable' }, 'frameId', 'unavailable'],
      [
        'frame on a circular plate',
        { plateId: 'test-plate-circle', frameId: 'test-frame-any' },
        'frameId',
        'frame-not-supported',
      ],
      [
        'frame on a square plate without frame support',
        { plateId: 'test-plate-square-frameless', frameId: 'test-frame-square' },
        'frameId',
        'frame-not-supported',
      ],
      [
        'frame incompatible with the plate shape',
        { plateId: 'test-plate-rectangle', frameId: 'test-frame-square' },
        'frameId',
        'incompatible-shape',
      ],
      [
        'frame restricted to another plate',
        { plateId: 'test-plate-square-b', frameId: 'test-frame-square-plate-only' },
        'frameId',
        'incompatible-plate',
      ],
    ] as const)('rejects %s', (_label, overrides, field, code) => {
      const result = validateConfiguration(validConfiguration(overrides), testCatalog);

      expect(result).toEqual({ status: 'invalid', issues: [{ kind: 'invalid', field, code }] });
    });

    it('reports invalid status when invalid and missing issues coexist', () => {
      const result = validateConfiguration(
        validConfiguration({ plateId: 'does-not-exist', text: '' }),
        testCatalog,
      );

      expect(result.status).toBe('invalid');
      expect(issuesOf(result)).toEqual([
        { kind: 'invalid', field: 'plateId', code: 'unknown-reference' },
        { kind: 'missing', field: 'text' },
      ]);
    });
  });

  describe('frame precedence', () => {
    function frameIssues(overrides: Partial<Configuration>) {
      return issuesOf(validateConfiguration(validConfiguration(overrides), testCatalog)).filter(
        (issue) => issue.field === 'frameId',
      );
    }

    it('reports frame-not-supported before shape and plate restrictions', () => {
      expect(
        frameIssues({ plateId: 'test-plate-circle', frameId: 'test-frame-square-plate-only' }),
      ).toEqual([{ kind: 'invalid', field: 'frameId', code: 'frame-not-supported' }]);
    });

    it('reports unavailable before frame-not-supported', () => {
      expect(
        frameIssues({ plateId: 'test-plate-circle', frameId: 'test-frame-unavailable' }),
      ).toEqual([{ kind: 'invalid', field: 'frameId', code: 'unavailable' }]);
    });

    it('reports incompatible-shape before incompatible-plate when both apply', () => {
      expect(
        frameIssues({ plateId: 'test-plate-rectangle', frameId: 'test-frame-square-plate-only' }),
      ).toEqual([{ kind: 'invalid', field: 'frameId', code: 'incompatible-shape' }]);
    });

    it('skips plate-dependent frame rules when the plate is missing or unknown', () => {
      expect(frameIssues({ plateId: null, frameId: 'test-frame-square' })).toEqual([]);
      expect(frameIssues({ plateId: 'does-not-exist', frameId: 'test-frame-square' })).toEqual([]);
    });
  });

  describe('derived shape', () => {
    it('does not store a shape in the configuration', () => {
      expect(Object.keys(createEmptyConfiguration())).toEqual([
        'plateId',
        'frameId',
        'colorCategory',
        'colorId',
        'text',
      ]);
    });

    it.each([
      ['test-plate-square', 'square'],
      ['test-plate-rectangle', 'rectangle'],
      ['test-plate-circle', 'circle'],
    ] as const)('derives the shape of %s from the catalog', (plateId, shape) => {
      expect(getPlateShape(testCatalog, plateId)).toBe(shape);
    });

    it('returns undefined for an unknown plate', () => {
      expect(getPlateShape(testCatalog, 'does-not-exist')).toBeUndefined();
    });
  });

  describe('text', () => {
    it.each([
      ['spaces', '   '],
      ['line breaks and tabs', '\n\r\n\t'],
      ['no-break spaces', '\u00A0\u202F'],
      ['zero-width space', '\u200B'],
      ['zero-width joiners', '\u200C\u200D'],
      ['word joiner and BOM', '\u2060\uFEFF'],
      ['mixed whitespace and invisible characters', ' \u200B\n\u00A0\uFEFF '],
    ])('rejects text with only %s as blank', (_label, text) => {
      expect(validateConfiguration(validConfiguration({ text }), testCatalog)).toEqual({
        status: 'invalid',
        issues: [{ kind: 'invalid', field: 'text', code: 'blank' }],
      });
    });

    it.each([
      ['accented characters', 'Ação'],
      ['combining characters', 'e\u0301'],
      ['emoji ZWJ sequence', '👩\u200D👩\u200D👧'],
      ['emoji with variation selector', '❤\uFE0F'],
      ['zero-width space between words', 'Ana\u200BMaria'],
      ['visible text surrounded by invisible characters', '\u200B Ana \uFEFF'],
    ])('accepts %s', (_label, text) => {
      expect(validateConfiguration(validConfiguration({ text }), testCatalog)).toEqual({
        status: 'valid',
      });
    });

    it('preserves text containing invisible characters exactly', () => {
      const text = '\u200B Ana\u00A0\n';
      const config = validConfiguration({ text });

      validateConfiguration(config, testCatalog);

      expect(config.text).toBe(text);
      expect(config.text.length).toBe(text.length);
    });
  });

  describe('selection integrity', () => {
    it('does not modify or replace the configuration', () => {
      const config = Object.freeze(validConfiguration({ plateId: 'does-not-exist' }));
      const snapshot = structuredClone(config);

      validateConfiguration(config, testCatalog);

      expect(config).toEqual(snapshot);
    });

    it('preserves user text exactly, including surrounding whitespace and line breaks', () => {
      const text = '  Primeira linha\nSegunda linha  ';
      const config = validConfiguration({ text });

      expect(validateConfiguration(config, testCatalog).status).toBe('valid');
      expect(config.text).toBe(text);
    });

    it('produces a JSON-serializable configuration', () => {
      const config = validConfiguration({ frameId: 'test-frame-any' });
      expect(JSON.parse(JSON.stringify(config))).toEqual(config);
    });

    it('treats every reference as unknown against the empty production catalog', () => {
      const result = validateConfiguration(validConfiguration(), getCatalog());
      expect(issuesOf(result)).toContainEqual({
        kind: 'invalid',
        field: 'plateId',
        code: 'unknown-reference',
      });
    });
  });
});

describe('isFrameCompatible', () => {
  function byId<T extends { id: string }>(items: readonly T[], id: string): T {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Fixture not found: ${id}`);
    return item;
  }

  const plate = (id: string) => byId(testCatalog.plates, id);
  const frame = (id: string) => byId(testCatalog.frames, id);

  it('requires frame support, a declared shape, and, when restricted, a listed plate', () => {
    expect(
      isFrameCompatible(frame('test-frame-square-plate-only'), plate('test-plate-square')),
    ).toBe(true);
    expect(
      isFrameCompatible(frame('test-frame-square-plate-only'), plate('test-plate-square-b')),
    ).toBe(false);
    expect(isFrameCompatible(frame('test-frame-square'), plate('test-plate-rectangle'))).toBe(
      false,
    );
    expect(isFrameCompatible(frame('test-frame-any'), plate('test-plate-circle'))).toBe(false);
    expect(isFrameCompatible(frame('test-frame-any'), plate('test-plate-square-frameless'))).toBe(
      false,
    );
  });
});
