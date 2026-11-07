import {
  createEmptyConfiguration,
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
      const config = validConfiguration({ frameId: 'test-frame-any', shape: 'rectangle' });
      expect(validateConfiguration(config, testCatalog).status).toBe('valid');
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
        { kind: 'missing', field: 'shape' },
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

    it.each<keyof Configuration>(['plateId', 'shape', 'colorCategory'])(
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
        'shape unsupported by plate',
        { plateId: 'test-plate-square-nude', shape: 'rectangle' },
        'shape',
        'unsupported-by-plate',
      ],
      [
        'color category unsupported by plate',
        { plateId: 'test-plate-square-nude', colorCategory: 'colored' },
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
        'frame incompatible with shape',
        { frameId: 'test-frame-square', shape: 'rectangle' },
        'frameId',
        'incompatible-shape',
      ],
      [
        'frame restricted to another plate',
        { plateId: 'test-plate-square-nude', frameId: 'test-frame-plate-a-only' },
        'frameId',
        'incompatible-plate',
      ],
    ] as const)('rejects %s', (_label, overrides, field, code) => {
      const result = validateConfiguration(validConfiguration(overrides), testCatalog);

      expect(result.status).toBe('invalid');
      expect(issuesOf(result)).toContainEqual({ kind: 'invalid', field, code });
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

  describe('frame compatibility precedence', () => {
    it('reports incompatible-plate even when shape is not selected', () => {
      const result = validateConfiguration(
        validConfiguration({
          plateId: 'test-plate-square-nude',
          frameId: 'test-frame-plate-a-only',
          shape: null,
        }),
        testCatalog,
      );

      expect(result).toEqual({
        status: 'invalid',
        issues: [
          { kind: 'missing', field: 'shape' },
          { kind: 'invalid', field: 'frameId', code: 'incompatible-plate' },
        ],
      });
    });

    it('stays incomplete for a frame allowed for the plate when shape is not selected', () => {
      const result = validateConfiguration(
        validConfiguration({ frameId: 'test-frame-plate-a-only', shape: null }),
        testCatalog,
      );

      expect(result).toEqual({
        status: 'incomplete',
        issues: [{ kind: 'missing', field: 'shape' }],
      });
    });

    it('reports incompatible-shape before incompatible-plate when both apply', () => {
      const result = validateConfiguration(
        validConfiguration({
          plateId: 'test-plate-square-nude',
          frameId: 'test-frame-square-plate-a-only',
          shape: 'rectangle',
        }),
        testCatalog,
      );

      expect(issuesOf(result).filter((issue) => issue.field === 'frameId')).toEqual([
        { kind: 'invalid', field: 'frameId', code: 'incompatible-shape' },
      ]);
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

  const plateA = byId(testCatalog.plates, 'test-plate-a');
  const plateSquareNude = byId(testCatalog.plates, 'test-plate-square-nude');
  const frameAOnly = byId(testCatalog.frames, 'test-frame-plate-a-only');

  it('requires both a declared shape and, when restricted, a listed plate', () => {
    expect(isFrameCompatible(frameAOnly, plateA, 'square')).toBe(true);
    expect(isFrameCompatible(frameAOnly, plateA, 'rectangle')).toBe(true);
    expect(isFrameCompatible(frameAOnly, plateSquareNude, 'square')).toBe(false);
  });
});
