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

    expect(plate?.src).toBe('/catalog/plates/test-plate-square/nude.webp');
    expect(plate?.alt).toBe('Square, nude');
    expect(notices).toEqual([]);
  });

  it('selects the photograph of the exact shade', () => {
    const { plate } = compose({ colorCategory: 'colored', colorId: 'test-color-colored' });
    expect(plate?.src).toBe('/catalog/plates/test-plate-square/test-color-colored.webp');
  });

  it('keeps the category photograph apart from the shade photograph', () => {
    expect(compose({ colorCategory: 'colored' }).plate?.src).toBe(
      '/catalog/plates/test-plate-square/colored.webp',
    );
  });

  it('shows nothing for a shade without its own photograph (no fallback)', () => {
    const { plate, notices } = compose({ colorId: 'test-color-nude' });

    expect(plate).toBeUndefined();
    expect(notices).toEqual(['plate-image-pending']);
  });

  it('shows nothing when no color category is selected', () => {
    const { plate, notices } = compose({ colorCategory: null });

    expect(plate).toBeUndefined();
    expect(notices).toEqual(['color-not-selected']);
  });

  it('shows nothing when no plate is selected', () => {
    expect(compose({ plateId: null })).toEqual({
      plate: undefined,
      frame: undefined,
      text: undefined,
      notices: ['plate-not-selected'],
    });
  });

  it('shows nothing for an unknown plate', () => {
    expect(compose({ plateId: 'does-not-exist' }).notices).toEqual(['plate-invalid']);
  });

  it.each([
    [
      'a category the plate does not support',
      { plateId: 'test-plate-rectangle', colorCategory: 'colored' },
    ],
    ['a shade from another category', { colorCategory: 'nude', colorId: 'test-color-colored' }],
    ['an unknown shade', { colorId: 'does-not-exist' }],
  ] as const)('shows no photograph for %s', (_label, overrides) => {
    const { plate, notices } = compose(overrides);

    expect(plate).toBeUndefined();
    expect(notices).toContain('color-invalid');
  });

  it('exposes the catalog object bounds', () => {
    expect(compose().plate?.objectBounds).toEqual({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    expect(compose({ plateId: 'test-plate-rectangle' }).plate?.objectBounds).toBeUndefined();
  });
});

describe('composePreview: frame', () => {
  it('uses the layers calibrated for the plate model', () => {
    const { frame, notices } = compose({ frameId: 'test-frame-any' });

    expect(frame).toEqual({
      backSrc: '/catalog/frames/test-frame-any/square-back.webp',
      frontSrc: '/catalog/frames/test-frame-any/square-front.webp',
      alt: 'Frame, square',
      platePlacement: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    });
    expect(notices).toEqual([]);
  });

  it('has no frame layer without a frame', () => {
    expect(compose().frame).toBeUndefined();
  });

  it('does not draw an incompatible frame as if the configuration were valid', () => {
    // test-frame-square only fits squares; the rectangular plate is still shown alone.
    const { frame, plate, notices } = compose({
      plateId: 'test-plate-rectangle',
      frameId: 'test-frame-square',
      text: '',
    });

    expect(frame).toBeUndefined();
    expect(plate?.src).toBe('/catalog/plates/test-plate-rectangle/nude.webp');
    expect(notices).toEqual(['frame-invalid']);
  });

  it('does not draw a frame on a plate without frame support', () => {
    const { frame, notices } = compose({ plateId: 'test-plate-circle', frameId: 'test-frame-any' });

    expect(frame).toBeUndefined();
    expect(notices).toEqual(['frame-invalid']);
  });

  it('does not draw an unknown frame', () => {
    expect(compose({ frameId: 'does-not-exist' }).notices).toEqual(['frame-invalid']);
  });

  it('reports a compatible frame whose image is not registered', () => {
    const { frame, plate, notices } = compose({ frameId: 'test-frame-square' });

    expect(frame).toBeUndefined();
    expect(plate).toBeDefined();
    expect(notices).toEqual(['frame-image-pending']);
  });

  it('does not draw a frame without placement calibration, but keeps the plate', () => {
    const { frame, plate, notices } = compose({
      plateId: 'test-plate-rectangle',
      frameId: 'test-frame-any',
      text: '',
    });

    expect(frame).toBeUndefined();
    expect(plate).toBeDefined();
    expect(notices).toEqual(['frame-not-calibrated']);
  });
});

describe('composePreview: text', () => {
  it('places the raw text in the catalog text area', () => {
    expect(compose({ text: '  Casa\nda Ana ' }).text).toEqual({
      text: '  Casa\nda Ana ',
      area: { x: 0.2, y: 0.3, width: 0.6, height: 0.4 },
      align: 'center',
    });
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
    expect(compose({ colorCategory: null }).text).toBeUndefined();
  });
});

describe('compositionSources', () => {
  it('lists each file once, in painting order', () => {
    expect(compositionSources(compose({ frameId: 'test-frame-any' }))).toEqual([
      '/catalog/frames/test-frame-any/square-back.webp',
      '/catalog/plates/test-plate-square/nude.webp',
      '/catalog/frames/test-frame-any/square-front.webp',
    ]);
  });

  it('is empty when nothing is shown', () => {
    expect(compositionSources(compose({ plateId: null }))).toEqual([]);
  });
});
