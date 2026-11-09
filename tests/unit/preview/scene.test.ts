import { composePreview } from '../../../src/preview/composition';
import { FALLBACK_TEXT_COLOR } from '../../../src/preview/text-style';
import { CALIBRATION_CAP_RATIO, LETTERING_FONTS } from '../../../src/preview/lettering-fonts';
import type { FontState } from '../../../src/preview/font-loading';
import {
  buildScene,
  drawnFontSize,
  placeBlock,
  textFrameOf,
  type ImageSize,
  type ImageState,
  type Scene,
} from '../../../src/preview/scene';
import { WATERMARK_SRC } from '../../../src/preview/watermark';
import { findPlate } from '../../../src/domain';
import { config, previewCatalog, previewSizes, validate } from './fixtures';

interface TestImage extends ImageSize {
  readonly src: string;
}

const measure = (text: string, size: number) => [...text].length * size * 0.5;

/** Every fixture file loaded, with optional per-source overrides. */
function states(overrides: Record<string, ImageState<TestImage>> = {}) {
  const map = new Map<string, ImageState<TestImage>>();
  for (const [src, size] of Object.entries(previewSizes)) {
    map.set(src, {
      status: 'loaded',
      image: { src, naturalWidth: size.width, naturalHeight: size.height },
    });
  }
  for (const [src, state] of Object.entries(overrides)) map.set(src, state);
  return map;
}

function sceneFor(
  overrides: Parameters<typeof config>[0] = {},
  images: ReadonlyMap<string, ImageState<TestImage>> = states(),
  font?: FontState,
): Scene<TestImage> {
  const value = config(overrides);
  return buildScene(composePreview(previewCatalog, value, validate(value)), images, measure, font);
}

const order = (scene: Scene<TestImage>) => scene.layers.map((layer) => layer.kind);

const SQUARE_NUDE = '/catalog/plates/test-plate-square/beige.webp';

describe('buildScene: standalone plate', () => {
  it('uses the plate image size and draws the plate, then the text, then the signature', () => {
    const scene = sceneFor();

    expect(scene.width).toBe(400);
    expect(scene.height).toBe(400);
    expect(order(scene)).toEqual(['image', 'text', 'signature']);
    expect(scene.layers[0]).toMatchObject({ rect: { x: 0, y: 0, width: 400, height: 400 } });
    expect(scene.description).toBe('Square');
  });

  it('maps the normalized text area onto the plate image', () => {
    const text = sceneFor().layers[1];

    expect(text?.kind === 'text' && text.block.area).toEqual({
      x: 80,
      y: 120,
      width: 240,
      height: 160,
    });
  });

  it('keeps the aspect ratio of a non-square photograph', () => {
    const scene = sceneFor({ plateId: 'test-plate-rectangle', text: '' });

    expect([scene.width, scene.height]).toEqual([600, 400]);
  });

  it('is empty when nothing can be shown', () => {
    expect(sceneFor({ plateId: null })).toEqual({
      width: 0,
      height: 0,
      layers: [],
      notices: ['plate-not-selected'],
      description: undefined,
    });
  });
});

describe('buildScene: image states', () => {
  it('draws nothing while the photograph is loading', () => {
    const scene = sceneFor({}, states({ [SQUARE_NUDE]: { status: 'loading' } }));

    expect(scene.layers).toEqual([]);
    expect(scene.notices).toEqual(['plate-image-loading']);
  });

  it('treats a source that has not reported as loading', () => {
    const scene = sceneFor({}, new Map());

    expect(scene.layers).toEqual([]);
    expect(scene.notices).toEqual(['plate-image-loading']);
  });

  it('draws nothing, and substitutes nothing, when the plate file fails to load', () => {
    const scene = sceneFor({}, states({ [SQUARE_NUDE]: { status: 'error' } }));

    expect(scene.layers).toEqual([]);
    expect(scene.notices).toEqual(['plate-image-error']);
  });

  it('keeps the catalog-pending state distinct from a load error', () => {
    expect(sceneFor({ plateId: 'test-plate-pending' }).notices).toEqual(['plate-image-pending']);
  });
});

describe('buildScene: lettering font (D-072)', () => {
  it('draws nothing while the lettering font loads, as for the photograph', () => {
    const scene = sceneFor({}, states(), 'loading');

    expect(scene.layers).toEqual([]);
    expect(scene.notices).toEqual(['plate-image-loading']);
  });

  it('does not wait for the font when there is no text to draw', () => {
    expect(order(sceneFor({ text: '' }, states(), 'loading'))).toEqual(['image', 'signature']);
    expect(sceneFor({ text: '' }, states(), 'error').notices).toEqual([]);
  });

  it('draws the text with the fallback font and blocks export when the font fails', () => {
    const scene = sceneFor({}, states(), 'error');

    expect(order(scene)).toEqual(['image', 'text', 'signature']);
    expect(scene.notices).toEqual(['font-error']);
  });
});

describe('lettering size calibration (D-055, D-072)', () => {
  const textOf = (overrides: Parameters<typeof config>[0]) => {
    const text = sceneFor(overrides).layers.find((layer) => layer.kind === 'text');
    if (text?.kind !== 'text') throw new Error('no text layer');
    return text.block;
  };

  it('keeps the calibrated capital height for each font: catalog size × 0.7046', () => {
    // Fixture: fontSize 0.1 of a 400 px photograph → a 28.18 px capital.
    for (const family of ['sans-serif', 'serif'] as const) {
      const { fontSize } = textOf({ fontFamily: family });
      const font = LETTERING_FONTS[family];
      if (family === 'sans-serif')
        expect(fontSize * font.capRatio).toBeCloseTo(40 * CALIBRATION_CAP_RATIO, 9);
      else expect(fontSize).toBe(40);
    }
  });

  it('scales Quicksand by 0.7046 ÷ 0.700 ≈ 1.007 and leaves Gelasio at the catalog size', () => {
    expect(drawnFontSize(0.1, 'sans-serif', 400)).toBeCloseTo(40.263, 3);
    expect(drawnFontSize(0.1, 'serif', 400)).toBe(40);
    expect(LETTERING_FONTS['sans-serif'].sizeScale).toBeCloseTo(1.007, 3);
  });
});

describe('buildScene: Taavi signature (D-060)', () => {
  it('carries the official mark image as the last layer', () => {
    const scene = sceneFor();
    const last = scene.layers.at(-1);

    expect(last?.kind === 'signature' && last.image.src).toBe(WATERMARK_SRC);
    expect(scene.notices).toEqual([]);
  });

  it('draws nothing while the mark is loading, as for the photograph', () => {
    const scene = sceneFor({}, states({ [WATERMARK_SRC]: { status: 'loading' } }));

    expect(scene.layers).toEqual([]);
    expect(scene.notices).toEqual(['plate-image-loading']);
  });

  it('shows the piece without a signature, and reports it, when the mark fails', () => {
    const scene = sceneFor({}, states({ [WATERMARK_SRC]: { status: 'error' } }));

    expect(order(scene)).toEqual(['image', 'text']);
    expect(scene.notices).toEqual(['watermark-error']);
  });
});

describe('buildScene: text', () => {
  const textBlock = (scene: Scene<TestImage>) => {
    const layer = scene.layers.find((candidate) => candidate.kind === 'text');
    if (layer?.kind !== 'text') throw new Error('No text layer');
    return layer.block;
  };

  it('keeps explicit line breaks', () => {
    expect(textBlock(sceneFor({ text: 'Casa\nda Ana' })).lines).toEqual(['Casa', 'da Ana']);
  });

  it('carries the catalog alignment', () => {
    expect(textBlock(sceneFor()).align).toBe('center');
  });

  it('carries the font family and falls back to a neutral color when none is chosen', () => {
    const scene = sceneFor({ fontFamily: 'serif', textColorId: null });
    const block = textBlock(scene);
    expect(scene.notices).toContain('text-color-provisional');

    expect(block.fontFamily).toBe('serif');
    expect(block.segments).toEqual([[{ text: 'Ana', color: FALLBACK_TEXT_COLOR }]]);
  });

  it('colors the segments of each line from the source offsets, across line breaks', () => {
    const block = textBlock(
      sceneFor({
        text: 'Casa, sol\nda Ana!',
        textColorId: 'test-text-color-a',
        highlightEnabled: true,
        secondaryColorId: 'test-text-color-b',
        // "sol" on the first line and "da" on the second (whole words, D-071).
        secondaryRanges: [
          { start: 6, end: 9 },
          { start: 10, end: 12 },
        ],
      }),
    );

    expect(block.segments).toEqual([
      [
        { text: 'Casa, ', color: '#112233' },
        { text: 'sol', color: '#aa2200' },
      ],
      [
        { text: 'da', color: '#aa2200' },
        { text: ' Ana!', color: '#112233' },
      ],
    ]);
    expect(block.segments.map((line) => line.map((s) => s.text).join(''))).toEqual(block.lines);
  });

  it('warns, without truncating, when the text cannot fit', () => {
    const lines = Array.from({ length: 40 }, (_, i) => `linha ${i}`);
    const scene = sceneFor({ text: lines.join('\n') });

    expect(scene.notices).toContain('text-overflow');
    expect(textBlock(scene).lines).toEqual(lines);
  });

  it('has no text layer, and keeps the notice, when the lettering size is pending', () => {
    const scene = sceneFor({ plateId: 'test-plate-size-pending' });

    expect(order(scene)).toEqual(['image', 'signature']);
    expect(scene.notices).toEqual(['text-size-pending']);
  });

  it('has no text layer, and keeps the notice, when the area is not calibrated', () => {
    const scene = sceneFor({ plateId: 'test-plate-rectangle' });

    expect(order(scene)).toEqual(['image', 'signature']);
    expect(scene.notices).toEqual(['text-area-pending']);
  });
});

describe('buildScene: text placement (D-044)', () => {
  const textBlock = (scene: Scene<TestImage>) => {
    const layer = scene.layers.find((candidate) => candidate.kind === 'text');
    if (layer?.kind !== 'text') throw new Error('No text layer');
    return layer.block;
  };
  // Square plate 400×400; area x 80–320, y 120–280. "Ana": font 40, width 60, line height 48.
  const AREA = { x: 80, y: 120, width: 240, height: 160 };

  it('draws the catalog default exactly where earlier versions did', () => {
    const block = textBlock(sceneFor());

    expect(block.area).toEqual(AREA);
    expect(block.slack).toEqual({ x: 180, y: 112 });
    expect(block.bounds).toEqual({ x: 170, y: 176, width: 60, height: 48 });
  });

  it('gives the nine presets nine different positions at the area edges', () => {
    const rows = [0, 0.5, 1];
    const columns = ['left', 'center', 'right'] as const;
    const anchors = { left: 0, center: 0.5, right: 1 };
    const seen = new Set<string>();
    for (const y of rows) {
      for (const align of columns) {
        const block = textBlock(sceneFor({ textLayout: { align, x: anchors[align], y } }));
        expect(block.bounds.x).toBe(AREA.x + anchors[align] * 180);
        expect(block.bounds.y).toBe(AREA.y + y * 112);
        seen.add(`${block.bounds.x},${block.bounds.y}`);
      }
    }
    expect(seen.size).toBe(9);
  });

  it('uses the fixed catalog size whatever the text length, wrapping, or overflow (D-055)', () => {
    // 0.1 of the 400 px image width.
    const texts = [
      'A',
      'Ana',
      'Casa da Ana Maria e do Pedro',
      'Casa\nda\nAna',
      'Ação 🇧🇷 é',
      Array.from({ length: 40 }, (_, i) => `l${i}`).join('\n'),
      'W'.repeat(200),
    ];
    for (const text of texts) expect(textBlock(sceneFor({ text })).fontSize).toBe(40);
    // On another model the size follows that model's own value: 0.075 × 400.
    expect(textBlock(sceneFor({ plateId: 'test-plate-circle' })).fontSize).toBe(30);
  });

  it('wraps long lines at the fixed size and reports lines that do not fit', () => {
    // 240 wide at font 40 holds 12 characters per line.
    const wrapped = sceneFor({ text: 'Casa da Ana Maria' });
    expect(textBlock(wrapped).lines).toEqual(['Casa da Ana', 'Maria']);
    expect(wrapped.notices).not.toContain('text-overflow');
    expect(textBlock(wrapped).excessLines).toBe(0);

    // 160 high at line height 48 holds 3 lines.
    const tall = sceneFor({ text: Array.from({ length: 4 }, () => 'linha').join('\n') });
    expect(tall.notices).toContain('text-overflow');
    expect(textBlock(tall).slack.y).toBeLessThan(0);
    expect(textBlock(tall).excessLines).toBe(1);
  });

  it('never enlarges the text to fill the area: the size does not depend on the position', () => {
    const sizes = (
      [
        { align: 'left', x: 0, y: 0 },
        { align: 'right', x: 1, y: 1 },
      ] as const
    ).map((textLayout) => textBlock(sceneFor({ textLayout })).fontSize);
    expect(sizes).toEqual([40, 40]);
    expect(textBlock(sceneFor()).fontSize).toBe(40);
  });

  it('changing only the alignment keeps the block in place and realigns the lines', () => {
    const text = 'Casa\nda Ana';
    const left = textBlock(sceneFor({ text, textLayout: { align: 'left', x: 0.3, y: 0.2 } }));
    const right = textBlock(sceneFor({ text, textLayout: { align: 'right', x: 0.3, y: 0.2 } }));

    expect(right.bounds).toEqual(left.bounds);
    expect([left.align, right.align]).toEqual(['left', 'right']);
  });

  describe('independent line alignment (D-059)', () => {
    const ALIGNS = ['left', 'center', 'right'] as const;
    // Lines of different lengths: 3 and 11 characters (60 and 220 wide at font 40).
    const text = 'Ana\nCasa da Ana';

    it.each([
      [0, 0],
      [0.3, 0.5],
      [1, 1],
    ])('never moves the block at position (%s, %s), whatever the alignment', (x, y) => {
      const blocks = ALIGNS.map((align) =>
        textBlock(sceneFor({ text, textLayout: { align, x, y } })),
      );
      const [first] = blocks;

      for (const block of blocks) expect(block.bounds).toEqual(first?.bounds);
      expect(blocks.map((block) => block.align)).toEqual(ALIGNS);
      expect(first?.bounds.width).toBe(220);
    });

    it('a preset column places the block the same way for every alignment', () => {
      for (const x of [0, 0.5, 1]) {
        const xs = ALIGNS.map(
          (align) => textBlock(sceneFor({ text, textLayout: { align, x, y: 0 } })).bounds.x,
        );
        expect(new Set(xs).size).toBe(1);
        expect(xs[0]).toBe(AREA.x + x * (AREA.width - 220));
      }
    });

    it('keeps an overflowing block in place when only the alignment changes', () => {
      // Words wrap, so a block wider than its area is rare; placeBlock still handles it.
      for (const x of [0, 0.5, 1]) {
        const blocks = ALIGNS.map((align) => placeBlock(AREA, [320, 60], 400, { align, x, y: 0 }));
        const [first] = blocks;
        expect(first?.slack).toEqual({ x: -80, y: -240 });
        for (const block of blocks) expect(block.bounds).toEqual(first?.bounds);
        // Horizontally by the stored position, vertically centered.
        expect(first?.bounds.x).toBeCloseTo(AREA.x + x * -80);
        expect(first?.bounds.y).toBe(AREA.y - 120);
      }
    });
  });

  it('keeps the same relative position on a model with a different safe area', () => {
    const textLayout = { align: 'right', x: 1, y: 1 } as const;
    for (const plateId of ['test-plate-square', 'test-plate-circle']) {
      const { area, bounds } = textBlock(sceneFor({ plateId, textLayout }));
      expect(bounds.x + bounds.width).toBeCloseTo(area.x + area.width);
      expect(bounds.y + bounds.height).toBeCloseTo(area.y + area.height);
    }
  });

  it('keeps the established overflow placement on an axis without free space', () => {
    const lines = Array.from({ length: 40 }, (_, i) => `l${i}`).join('\n');
    const scene = sceneFor({ text: lines, textLayout: { align: 'left', x: 0, y: 0 } });
    const block = textBlock(scene);

    expect(scene.notices).toContain('text-overflow');
    expect(block.slack.y).toBeLessThan(0);
    // Centered vertically (overflowing both edges), as before positioning existed.
    expect(block.bounds.y).toBeCloseTo(AREA.y + block.slack.y / 2);
  });

  it('draws an invalid stored placement at the catalog default', () => {
    const block = textBlock(sceneFor({ textLayout: { align: 'left', x: 7, y: 0 } }));
    expect(block.bounds).toEqual({ x: 170, y: 176, width: 60, height: 48 });
    expect(block.align).toBe('center');
  });
});

describe('textFrameOf (D-063)', () => {
  const plate = (id: string) => findPlate(previewCatalog, id);

  it('gives the same area and lettering size as the drawn text, before any text is entered', () => {
    const empty = sceneFor({ text: '' });
    const drawn = sceneFor({ text: 'Ana' }).layers.find((layer) => layer.kind === 'text');
    if (drawn?.kind !== 'text') throw new Error('no text layer');

    expect(textFrameOf(plate('test-plate-square'), empty, 'serif')).toEqual({
      area: drawn.block.area,
      fontSize: drawn.block.fontSize,
      lineHeight: drawn.block.lineHeight,
    });
  });

  it("uses the font's drawn size, so the line limit matches the drawn lines (D-072)", () => {
    const drawn = sceneFor({ text: 'Ana', fontFamily: 'sans-serif' }).layers.find(
      (layer) => layer.kind === 'text',
    );
    if (drawn?.kind !== 'text') throw new Error('no text layer');

    expect(textFrameOf(plate('test-plate-square'), sceneFor(), 'sans-serif')).toMatchObject({
      fontSize: drawn.block.fontSize,
      lineHeight: drawn.block.lineHeight,
    });
  });

  it('is undefined before the photograph is drawn, without a model, or without an approved size', () => {
    expect(
      textFrameOf(plate('test-plate-square'), { width: 0, height: 0 }, 'serif'),
    ).toBeUndefined();
    expect(textFrameOf(undefined, sceneFor(), 'serif')).toBeUndefined();
    expect(
      textFrameOf(
        plate('test-plate-size-pending'),
        sceneFor({ plateId: 'test-plate-size-pending' }),
        'serif',
      ),
    ).toBeUndefined();
  });
});
