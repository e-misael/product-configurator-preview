import {
  createEmptyConfiguration,
  getPlateShape,
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
    it('accepts a complete configuration', () => {
      expect(validateConfiguration(validConfiguration(), testCatalog)).toEqual({ status: 'valid' });
    });

    it('accepts a rectangular model', () => {
      const config = validConfiguration({ plateId: 'test-plate-rectangle' });
      expect(validateConfiguration(config, testCatalog)).toEqual({ status: 'valid' });
    });

    it('accepts a circular model', () => {
      const config = validConfiguration({ plateId: 'test-plate-circle' });
      expect(validateConfiguration(config, testCatalog)).toEqual({ status: 'valid' });
    });

    it('accepts a scalloped model', () => {
      const config = validConfiguration({ plateId: 'test-plate-scalloped' });
      expect(validateConfiguration(config, testCatalog)).toEqual({ status: 'valid' });
    });
  });

  describe('incomplete configurations', () => {
    it('reports every required field as missing for an empty configuration', () => {
      const result = validateConfiguration(createEmptyConfiguration(), testCatalog);

      expect(result.status).toBe('incomplete');
      expect(issuesOf(result)).toEqual([
        { kind: 'missing', field: 'plateId' },
        { kind: 'missing', field: 'text' },
        { kind: 'missing', field: 'textColorId' },
      ]);
    });

    it('is incomplete when the model is not selected', () => {
      const result = validateConfiguration(validConfiguration({ plateId: null }), testCatalog);
      expect(result).toEqual({
        status: 'incomplete',
        issues: [{ kind: 'missing', field: 'plateId' }],
      });
    });

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

  describe('derived shape', () => {
    it('does not store a shape in the configuration', () => {
      expect(Object.keys(createEmptyConfiguration())).toEqual([
        'plateId',
        'text',
        'fontFamily',
        'textColorId',
        'highlightEnabled',
        'secondaryColorId',
        'secondaryRanges',
        'textLayout',
        'note',
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
      const config = validConfiguration({ textLayout: { align: 'left', x: 0.25, y: 1 } });
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

describe('validateConfiguration: lettering (D-042)', () => {
  const issueOf = (overrides: Partial<Configuration>, field: string) =>
    issuesOf(validateConfiguration(validConfiguration(overrides), testCatalog)).find(
      (issue) => issue.field === field,
    );

  it('requires an explicit primary color: none is incomplete, never defaulted', () => {
    const result = validateConfiguration(validConfiguration({ textColorId: null }), testCatalog);
    expect(result).toEqual({
      status: 'incomplete',
      issues: [{ kind: 'missing', field: 'textColorId' }],
    });
  });

  it.each([
    ['unknown', 'does-not-exist', 'unknown-reference'],
    ['unavailable', 'test-text-color-retired', 'unavailable'],
  ] as const)('rejects an %s primary color', (_label, textColorId, code) => {
    expect(issueOf({ textColorId }, 'textColorId')).toEqual({
      kind: 'invalid',
      field: 'textColorId',
      code,
    });
  });

  describe('highlighting (D-071)', () => {
    const on = (overrides: Partial<Configuration>) =>
      validConfiguration({ text: 'Casa da Ana', highlightEnabled: true, ...overrides });

    it('accepts highlighted words in a different color', () => {
      const config = on({
        secondaryColorId: 'test-text-color-b',
        secondaryRanges: [
          { start: 0, end: 4 },
          { start: 8, end: 11 },
        ],
      });
      expect(validateConfiguration(config, testCatalog)).toEqual({ status: 'valid' });
    });

    it('accepts every word highlighted', () => {
      const config = on({
        secondaryColorId: 'test-text-color-b',
        secondaryRanges: [
          { start: 0, end: 4 },
          { start: 5, end: 7 },
          { start: 8, end: 11 },
        ],
      });
      expect(validateConfiguration(config, testCatalog)).toEqual({ status: 'valid' });
    });

    it.each([
      ['off', { highlightEnabled: false, secondaryRanges: [{ start: 0, end: 4 }] }],
      ['on with no word', { secondaryRanges: [] }],
    ])('ignores the highlight color while %s, even a missing or equal one', (_label, override) => {
      for (const secondaryColorId of [null, 'test-text-color-a', 'does-not-exist']) {
        expect(validateConfiguration(on({ secondaryColorId, ...override }), testCatalog)).toEqual({
          status: 'valid',
        });
      }
    });

    it('requires a highlight color once a word is highlighted', () => {
      const config = on({ secondaryRanges: [{ start: 0, end: 4 }] });
      expect(validateConfiguration(config, testCatalog)).toEqual({
        status: 'incomplete',
        issues: [{ kind: 'missing', field: 'secondaryColorId' }],
      });
    });

    it.each([
      ['unknown', 'does-not-exist', 'unknown-reference'],
      ['unavailable', 'test-text-color-retired', 'unavailable'],
      ['identical to the primary', 'test-text-color-a', 'same-as-primary'],
    ] as const)('rejects a highlight color that is %s', (_label, secondaryColorId, code) => {
      const config = on({ secondaryColorId, secondaryRanges: [{ start: 0, end: 4 }] });
      expect(issuesOf(validateConfiguration(config, testCatalog))).toContainEqual({
        kind: 'invalid',
        field: 'secondaryColorId',
        code,
      });
    });

    it.each([
      ['out of bounds', [{ start: 0, end: 99 }]],
      ['part of a word', [{ start: 0, end: 2 }]],
      ['a space with a word', [{ start: 0, end: 5 }]],
      [
        'repeated',
        [
          { start: 0, end: 4 },
          { start: 0, end: 4 },
        ],
      ],
      [
        'unordered',
        [
          { start: 8, end: 11 },
          { start: 0, end: 4 },
        ],
      ],
      ['empty', [{ start: 2, end: 2 }]],
    ])('rejects %s highlights', (_label, secondaryRanges) => {
      const config = on({ secondaryColorId: 'test-text-color-b', secondaryRanges });
      expect(issuesOf(validateConfiguration(config, testCatalog))).toContainEqual({
        kind: 'invalid',
        field: 'secondaryRanges',
        code: 'invalid-ranges',
      });
    });
  });

  it('rejects an unknown font family from malformed runtime data', () => {
    const config = { ...validConfiguration(), fontFamily: 'comic' } as unknown as Configuration;
    expect(issuesOf(validateConfiguration(config, testCatalog))).toContainEqual({
      kind: 'invalid',
      field: 'fontFamily',
      code: 'unsupported-font',
    });
  });

  it('never changes the configuration it validates', () => {
    const config = validConfiguration({ secondaryRanges: [{ start: 0, end: 99 }] });
    const snapshot = structuredClone(config);
    validateConfiguration(config, testCatalog);
    expect(config).toEqual(snapshot);
  });
});
