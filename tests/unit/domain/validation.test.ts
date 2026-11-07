import {
  createEmptyConfiguration,
  isFrameCompatible,
  validateConfiguration,
  type Configuration,
  type ValidationResult,
} from '../../../src/domain';
import { catalog } from '../../../src/catalog/catalog';
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
      ['whitespace-only text', { text: '  \n\t ' }, 'text', 'whitespace-only'],
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
      const result = validateConfiguration(validConfiguration(), catalog);
      expect(issuesOf(result)).toContainEqual({
        kind: 'invalid',
        field: 'plateId',
        code: 'unknown-reference',
      });
    });
  });
});

describe('production catalog', () => {
  it('contains no invented product data', () => {
    expect(catalog).toEqual({ plates: [], frames: [], colors: [] });
  });

  it('is frozen against mutation', () => {
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.plates)).toBe(true);
    expect(Object.isFrozen(catalog.frames)).toBe(true);
    expect(Object.isFrozen(catalog.colors)).toBe(true);
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
