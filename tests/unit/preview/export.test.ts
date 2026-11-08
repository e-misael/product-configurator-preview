import { composePreview } from '../../../src/preview/composition';
import { createTextMeasurer } from '../../../src/preview/draw';
import {
  downloadBlob,
  ExportError,
  exportBlockers,
  exportFileName,
  exportSize,
  MAX_EXPORT_EDGE,
  renderPng,
} from '../../../src/preview/export';
import { buildScene, type ImageState, type Scene } from '../../../src/preview/scene';
import { WATERMARK_SRC } from '../../../src/preview/watermark';
import { contextOf } from '../support/fake-canvas';
import { config, previewCatalog, previewSizes, validate } from './fixtures';

type Img = HTMLImageElement;

function loaded(overrides: Record<string, ImageState<Img>> = {}): Map<string, ImageState<Img>> {
  const map = new Map<string, ImageState<Img>>();
  for (const [src, size] of Object.entries(previewSizes)) {
    const image = { src, naturalWidth: size.width, naturalHeight: size.height } as unknown as Img;
    map.set(src, { status: 'loaded', image });
  }
  for (const [src, state] of Object.entries(overrides)) map.set(src, state);
  return map;
}

function sceneFor(
  overrides: Parameters<typeof config>[0] = {},
  images: Map<string, ImageState<Img>> = loaded(),
) {
  const value = config(overrides);
  const validation = validate(value);
  const scene = buildScene(
    composePreview(previewCatalog, value, validation),
    images,
    createTextMeasurer(),
  );
  return { scene, validation };
}

const codes = (overrides: Parameters<typeof config>[0], images?: Map<string, ImageState<Img>>) => {
  const { scene, validation } = sceneFor(overrides, images);
  return exportBlockers(validation, scene).map((blocker) =>
    blocker.kind === 'configuration'
      ? `${blocker.issue.field}:${blocker.issue.kind}`
      : blocker.kind === 'preview'
        ? blocker.code
        : 'empty',
  );
};

describe('exportBlockers', () => {
  it('allows a valid configuration whose scene shows everything selected', () => {
    expect(codes({})).toEqual([]);
    expect(codes({ plateId: 'test-plate-circle' })).toEqual([]);
  });

  it('blocks an incomplete or invalid configuration, listing each issue', () => {
    expect(codes({ textColorId: null })).toEqual(['textColorId:missing', 'text-color-provisional']);
    expect(codes({ text: '' })).toEqual(['text:missing']);
    expect(codes({ textLayout: { align: 'left', x: 9, y: 0 } })).toEqual(['textLayout:invalid']);
  });

  it('never allows the provisional lettering color', () => {
    expect(codes({ textColorId: 'test-text-color-gone' })).toContain('text-color-provisional');
  });

  it('blocks missing, loading, and failed images', () => {
    expect(codes({ plateId: 'test-plate-pending' })).toEqual(['plate-image-pending']);
    const plate = '/catalog/plates/test-plate-square/beige.webp';
    expect(codes({}, loaded({ [plate]: { status: 'loading' } }))).toEqual(['plate-image-loading']);
    expect(codes({}, loaded({ [plate]: { status: 'error' } }))).toEqual(['plate-image-error']);
  });

  it('blocks text without a calibrated area or lettering size, and text that overflows', () => {
    expect(codes({ plateId: 'test-plate-rectangle' })).toEqual(['text-area-pending']);
    expect(codes({ plateId: 'test-plate-size-pending' })).toEqual(['text-size-pending']);
    const lines = Array.from({ length: 40 }, (_, i) => `linha ${i}`).join('\n');
    expect(codes({ text: lines })).toEqual(['text-overflow']);
  });
});

describe('exportSize', () => {
  it('uses the native size, never upscaling', () => {
    expect(exportSize({ width: 400, height: 300 })).toEqual({ width: 400, height: 300 });
    expect(exportSize({ width: 1, height: 1 })).toEqual({ width: 1, height: 1 });
  });

  it('caps the longest edge at 4000 px, keeping the aspect ratio', () => {
    expect(MAX_EXPORT_EDGE).toBe(4000);
    expect(exportSize({ width: 8000, height: 6000 })).toEqual({ width: 4000, height: 3000 });
    expect(exportSize({ width: 3000, height: 6000 })).toEqual({ width: 2000, height: 4000 });
    expect(exportSize({ width: 5000, height: 5000 })).toEqual({ width: 4000, height: 4000 });
  });

  it.each([
    [0, 100],
    [100, -1],
    [Number.NaN, 100],
    [Number.POSITIVE_INFINITY, 100],
  ])('rejects unusable dimensions %s × %s', (width, height) => {
    expect(exportSize({ width, height })).toBeUndefined();
  });
});

describe('exportFileName', () => {
  it('is taavi-{plateId}.png', () => {
    expect(exportFileName('placa-ceramica-10')).toBe('taavi-placa-ceramica-10.png');
  });

  it('reduces unsafe characters and limits the length', () => {
    expect(exportFileName('../Ação X/<y>')).toBe('taavi-a-o-x-y.png');
    expect(exportFileName('a'.repeat(200))).toBe(`taavi-${'a'.repeat(60)}.png`);
    expect(exportFileName('///')).toBe('taavi-peca.png');
  });
});

describe('renderPng', () => {
  it('paints the preview scene at the export size and encodes PNG', async () => {
    const { scene } = sceneFor({
      text: 'Ana Luz',
      highlightEnabled: true,
      secondaryColorId: 'test-text-color-b',
      secondaryRanges: [{ start: 0, end: 3 }],
      textLayout: { align: 'right', x: 1, y: 0 },
    });
    let canvas: HTMLCanvasElement | undefined;
    const blob = await renderPng(scene, () => (canvas = document.createElement('canvas')));

    expect(blob.type).toBe('image/png');
    if (!canvas) throw new Error('No canvas');
    // The photograph's native 400×400.
    expect([canvas.width, canvas.height]).toEqual([400, 400]);
    const calls = contextOf(canvas).calls;
    expect(calls[2]).toMatchObject({ op: 'fillRect', fillStyle: '#ffffff' });
    expect(
      contextOf(canvas).drawn.map((call) => {
        if (call.op === 'fillText') return call.text === '© Taavi' ? 'signature' : call.fillStyle;
        if (call.image instanceof HTMLCanvasElement) return 'deboss';
        return (call.image as { src: string }).src === WATERMARK_SRC ? 'mark' : 'image';
      }),
    ).toEqual(['image', '#aa2200', '#112233', 'deboss', 'mark', 'signature']);
  });

  it('refuses to export without the Taavi signature (D-060)', async () => {
    const { scene } = sceneFor();
    const unsigned = {
      ...scene,
      layers: scene.layers.filter((layer) => layer.kind !== 'signature'),
    };
    const created = vi.fn(() => document.createElement('canvas'));

    await expect(renderPng(unsigned, created)).rejects.toMatchObject({ reason: 'no-watermark' });
    expect(created).not.toHaveBeenCalled();
  });

  it('blocks export when the mark could not be loaded', () => {
    expect(codes({}, loaded({ [WATERMARK_SRC]: { status: 'error' } }))).toEqual([
      'watermark-error',
    ]);
  });

  it('never paints the overflow outline, which is preview only (D-057)', async () => {
    const { scene } = sceneFor({ text: Array.from({ length: 6 }, () => 'Ana').join('\n') });
    expect(scene.notices).toContain('text-overflow');
    let canvas: HTMLCanvasElement | undefined;
    await renderPng(scene, () => (canvas = document.createElement('canvas')));

    if (!canvas) throw new Error('No canvas');
    expect(contextOf(canvas).calls.some((call) => call.op === 'strokeRect')).toBe(false);
    // Blocked anyway: overflow is an export blocker.
    expect(exportBlockers(validate(config({ text: 'x' })), scene)).toContainEqual({
      kind: 'preview',
      code: 'text-overflow',
    });
  });

  const failing = async (scene: Scene, create: () => HTMLCanvasElement) =>
    renderPng(scene, create).then(
      () => 'resolved',
      (error: unknown) => (error instanceof ExportError ? error.reason : String(error)),
    );

  it('reports each failure as an ExportError', async () => {
    const { scene } = sceneFor();
    const canvasWith = (patch: Partial<HTMLCanvasElement>) => () =>
      Object.assign(document.createElement('canvas'), patch);

    expect(await failing({ ...scene, width: 0 }, () => document.createElement('canvas'))).toBe(
      'invalid-size',
    );
    expect(
      await failing(scene, () => {
        throw new Error('out of memory');
      }),
    ).toBe('no-canvas');
    expect(await failing(scene, canvasWith({ getContext: () => null }))).toBe('no-context');
    expect(
      await failing(
        {
          ...scene,
          layers: [
            { kind: 'image', image: null as never, rect: null as never },
            ...scene.layers.filter((layer) => layer.kind === 'signature'),
          ],
        },
        () => document.createElement('canvas'),
      ),
    ).toBe('draw');
    expect(
      await failing(scene, canvasWith({ toBlob: (callback: BlobCallback) => callback(null) })),
    ).toBe('encode');
    expect(
      await failing(
        scene,
        canvasWith({
          toBlob: () => {
            throw new Error('tainted');
          },
        }),
      ),
    ).toBe('encode');
  });
});

describe('downloadBlob', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('downloads through a temporary link and releases the URL afterwards', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: create, revokeObjectURL: revoke });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    downloadBlob(new Blob(['x']), 'taavi-x.png');

    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe('taavi-x.png');
    expect(clicked[0]?.getAttribute('href')).toBe('blob:test');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:test');
    vi.unstubAllGlobals();
  });
});
