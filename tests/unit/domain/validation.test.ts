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
        'secondaryColorId',
        'secondaryRanges',
        'textLayout',
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

  it('accepts an optional secondary color and its ranges', () => {
    const config = validConfiguration({
      text: 'Casa da Ana',
      secondaryColorId: 'test-text-color-b',
      secondaryRanges: [{ start: 0, end: 4 }],
    });
    expect(validateConfiguration(config, testCatalog)).toEqual({ status: 'valid' });
  });

  it('keeps a secondary color that has no ranges (valid)', () => {
    const config = validConfiguration({ secondaryColorId: 'test-text-color-b' });
    expect(validateConfiguration(config, testCatalog)).toEqual({ status: 'valid' });
  });

  it.each([
    ['unknown', 'does-not-exist', 'unknown-reference'],
    ['unavailable', 'test-text-color-retired', 'unavailable'],
    ['identical to the primary', 'test-text-color-a', 'same-as-primary'],
  ] as const)('rejects a secondary color that is %s', (_label, secondaryColorId, code) => {
    expect(issueOf({ secondaryColorId }, 'secondaryColorId')).toEqual({
      kind: 'invalid',
      field: 'secondaryColorId',
      code,
    });
  });

  it('rejects ranges without a secondary color', () => {
    expect(issueOf({ secondaryRanges: [{ start: 0, end: 2 }] }, 'secondaryRanges')).toEqual({
      kind: 'invalid',
      field: 'secondaryRanges',
      code: 'ranges-without-color',
    });
  });

  it.each([
    ['out of bounds', [{ start: 0, end: 99 }]],
    [
      'overlapping',
      [
        { start: 0, end: 3 },
        { start: 2, end: 4 },
      ],
    ],
    ['empty', [{ start: 2, end: 2 }]],
  ])('rejects %s ranges', (_label, secondaryRanges) => {
    const issue = issueOf(
      { secondaryColorId: 'test-text-color-b', secondaryRanges },
      'secondaryRanges',
    );
    expect(issue).toEqual({ kind: 'invalid', field: 'secondaryRanges', code: 'invalid-ranges' });
  });

  it('rejects ranges that cut a grapheme cluster', () => {
    const issue = issueOf(
      {
        text: 'e\u0301x',
        secondaryColorId: 'test-text-color-b',
        secondaryRanges: [{ start: 0, end: 1 }],
      },
      'secondaryRanges',
    );
    expect(issue).toMatchObject({ code: 'invalid-ranges' });
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
