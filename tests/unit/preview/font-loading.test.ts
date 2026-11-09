import { LETTERING_FONTS } from '../../../src/preview/lettering-fonts';

/** A Font Loading API stand-in: records each face and settles its load on demand. */
class FakeFontFace {
  static created: FakeFontFace[] = [];
  static fail = false;
  readonly family: string;
  readonly source: string;
  readonly descriptors: FontFaceDescriptors;
  constructor(family: string, source: string, descriptors: FontFaceDescriptors) {
    this.family = family;
    this.source = source;
    this.descriptors = descriptors;
    FakeFontFace.created.push(this);
  }
  load() {
    return FakeFontFace.fail ? Promise.reject(new Error('network')) : Promise.resolve(this);
  }
}

const added: unknown[] = [];

async function freshModule() {
  vi.resetModules();
  return import('../../../src/preview/font-loading');
}

describe('loadLetteringFont (D-072)', () => {
  beforeEach(() => {
    FakeFontFace.created = [];
    FakeFontFace.fail = false;
    added.length = 0;
    vi.stubGlobal('FontFace', FakeFontFace);
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { add: (face: unknown) => added.push(face) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'fonts');
  });

  it('loads every subset of the family, with its weight and range, and registers it', async () => {
    const { loadLetteringFont, isLetteringFontLoaded } = await freshModule();
    expect(isLetteringFontLoaded('sans-serif')).toBe(false);

    await loadLetteringFont('sans-serif');

    const sans = LETTERING_FONTS['sans-serif'];
    expect(FakeFontFace.created.map((face) => [face.family, face.descriptors])).toEqual(
      sans.faces.map((face) => [
        'Taavi Lettering Sans',
        { weight: '700', unicodeRange: face.unicodeRange },
      ]),
    );
    expect(FakeFontFace.created[0]?.source).toBe(`url(${sans.faces[0]?.src}) format('woff2')`);
    expect(added).toEqual(FakeFontFace.created);
    expect(isLetteringFontLoaded('sans-serif')).toBe(true);
    expect(isLetteringFontLoaded('serif')).toBe(false);
  });

  it('loads each family once for every caller', async () => {
    const { loadLetteringFont } = await freshModule();

    const first = loadLetteringFont('serif');
    expect(loadLetteringFont('serif')).toBe(first);
    await first;
    await loadLetteringFont('serif');
    expect(FakeFontFace.created).toHaveLength(LETTERING_FONTS.serif.faces.length);
  });

  it('rejects when a file fails, and tries again on the next request', async () => {
    const { loadLetteringFont, isLetteringFontLoaded } = await freshModule();
    FakeFontFace.fail = true;

    await expect(loadLetteringFont('serif')).rejects.toThrow('network');
    expect(isLetteringFontLoaded('serif')).toBe(false);

    FakeFontFace.fail = false;
    await loadLetteringFont('serif');
    expect(isLetteringFontLoaded('serif')).toBe(true);
  });

  it('has nothing to load without the Font Loading API', async () => {
    vi.unstubAllGlobals();
    const { loadLetteringFont, isLetteringFontLoaded } = await freshModule();

    await expect(loadLetteringFont('serif')).resolves.toBeUndefined();
    expect(isLetteringFontLoaded('serif')).toBe(true);
  });
});
