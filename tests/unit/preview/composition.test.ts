import { validateCatalog } from '../../../src/domain';
import { composePreview, compositionSources } from '../../../src/preview/composition';
import { config, previewCatalog, validate } from './fixtures';

function compose(overrides: Parameters<typeof config>[0] = {}) {
  const value = config(overrides);
  return composePreview(previewCatalog, value, validate(value));
}

describe('preview fixture', () => {
  it('is a valid catalog', () => {
    expect(validateCatalog(previewCatalog)).toEqual({ status: 'valid' });
  });
});

describe('composePreview: plate image', () => {
  it('selects the exact category photograph when no shade is chosen', () => {
    const { plate, notices } = compose();

    expect(plate?.src).toBe('/catalog/plates/test-plate-square/beige.webp');
    expect(plate?.alt).toBe('Square');
    expect(notices).toEqual([]);
  });

  it('shows nothing for a model without a photograph (no fallback)', () => {
    const { plate, notices } = compose({ plateId: 'test-plate-pending' });

    expect(plate).toBeUndefined();
    expect(notices).toEqual(['plate-image-pending']);
  });

  it('shows nothing when no model is selected', () => {
    const { plate, notices } = compose({ plateId: null });

    expect(plate).toBeUndefined();
    expect(notices).toEqual(['plate-not-selected']);
  });

  it('shows nothing when the selected model is unknown', () => {
    expect(compose({ plateId: 'does-not-exist' }).notices).toEqual(['plate-invalid']);
  });

  it('composes the photograph as the only image layer (D-046)', () => {
    expect(Object.keys(compose())).toEqual(['plate', 'text', 'notices']);
  });
});

describe('composePreview: text', () => {
  it('places the raw text in the catalog text area', () => {
    expect(compose({ text: '  Casa\nda Ana ' }).text).toEqual({
      text: '  Casa\nda Ana ',
      area: { x: 0.2, y: 0.3, width: 0.6, height: 0.4 },
      align: 'center',
      x: 0.5,
      y: 0.5,
      fontFamily: 'sans-serif',
      primaryColor: '#112233',
      secondary: undefined,
    });
  });

  it('marks the text color as provisional until a usable color is chosen', () => {
    expect(compose({ textColorId: null }).notices).toEqual(['text-color-provisional']);
    expect(compose({ textColorId: 'test-text-color-gone' }).notices).toEqual([
      'text-color-provisional',
    ]);
    expect(compose().notices).toEqual([]);
    // No text drawn, nothing to qualify.
    expect(compose({ text: '', textColorId: null }).notices).toEqual([]);
  });

  it('defaults the alignment when the catalog omits it', () => {
    expect(compose({ plateId: 'test-plate-circle' }).text?.align).toBe('center');
  });

  it('keeps Unicode text exactly as typed', () => {
    const text = 'Ação 👩‍👩‍👧 é';
    expect(compose({ text }).text?.text).toBe(text);
  });

  it('does not render text without a calibrated text area, and says so', () => {
    const { text, plate, notices } = compose({ plateId: 'test-plate-rectangle' });

    expect(plate).toBeDefined();
    expect(text).toBeUndefined();
    expect(notices).toEqual(['text-area-pending']);
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   \n '],
  ])('draws no text and no notice for %s text', (_label, text) => {
    const { text: layer, notices } = compose({ text });

    expect(layer).toBeUndefined();
    expect(notices).toEqual([]);
  });

  it('draws no text when there is no plate image to put it on', () => {
    expect(compose({ plateId: 'test-plate-pending' }).text).toBeUndefined();
  });
});

describe('composePreview: lettering style', () => {
  it('carries the font and the chosen primary color', () => {
    const { text } = compose({ fontFamily: 'serif', textColorId: 'test-text-color-a' });

    expect(text?.fontFamily).toBe('serif');
    expect(text?.primaryColor).toBe('#112233');
    expect(text?.secondary).toBeUndefined();
  });

  it('leaves the primary color undefined when none is chosen or the id is unknown', () => {
    expect(compose({ textColorId: null }).text?.primaryColor).toBeUndefined();
    expect(compose({ textColorId: 'test-text-color-gone' }).text?.primaryColor).toBeUndefined();
  });

  it('carries the secondary color with its ranges', () => {
    const ranges = [{ start: 1, end: 3 }];
    const { text } = compose({
      textColorId: 'test-text-color-a',
      secondaryColorId: 'test-text-color-b',
      secondaryRanges: ranges,
    });

    expect(text?.secondary).toEqual({ color: '#aa2200', ranges });
  });

  it.each([
    ['no ranges', { secondaryRanges: [] }],
    ['ranges outside the text', { secondaryRanges: [{ start: 0, end: 99 }] }],
    ['an unknown secondary color', { secondaryColorId: 'test-text-color-gone' }],
  ])('applies no secondary style with %s', (_label, override) => {
    const { text } = compose({
      textColorId: 'test-text-color-a',
      secondaryColorId: 'test-text-color-b',
      secondaryRanges: [{ start: 0, end: 1 }],
      ...override,
    });

    expect(text?.secondary).toBeUndefined();
  });
});

describe('compositionSources', () => {
  it("lists only the model's photograph", () => {
    expect(compositionSources(compose())).toEqual(['/catalog/plates/test-plate-square/beige.webp']);
  });

  it('is empty when nothing is shown', () => {
    expect(compositionSources(compose({ plateId: null }))).toEqual([]);
  });
});
