import { composePreview } from '../../../src/preview/composition';
import { FALLBACK_TEXT_COLOR } from '../../../src/preview/text-style';
import {
  ASPECT_TOLERANCE,
  buildScene,
  placePlate,
  type ImageSize,
  type ImageState,
  type Scene,
} from '../../../src/preview/scene';
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
): Scene<TestImage> {
  const value = config(overrides);
  return buildScene(composePreview(previewCatalog, value, validate(value)), images, measure);
}

const order = (scene: Scene<TestImage>) =>
  scene.layers.map((layer) => (layer.kind === 'image' ? layer.role : layer.kind));

const SQUARE_BACK = '/catalog/frames/test-frame-any/square-back.webp';
const SQUARE_FRONT = '/catalog/frames/test-frame-any/square-front.webp';
const SQUARE_NUDE = '/catalog/plates/test-plate-square/beige.webp';

describe('placePlate', () => {
  const placement = { x: 50, y: 50, width: 400, height: 400 };

  it('fills a placement of the same aspect ratio', () => {
    expect(placePlate({ naturalWidth: 400, naturalHeight: 400 }, undefined, placement)).toEqual({
      x: 50,
      y: 50,
      width: 400,
      height: 400,
    });
  });

  it('scales uniformly and centers when the aspect ratios differ', () => {
    // 600×400 image into a square: width-limited, centered vertically.
    const rect = placePlate({ naturalWidth: 600, naturalHeight: 400 }, undefined, placement);

    expect(rect.width).toBeCloseTo(400);
    expect(rect.height).toBeCloseTo(400 / 1.5);
    expect(rect.x).toBeCloseTo(50);
    expect(rect.y).toBeCloseTo(50 + (400 - 400 / 1.5) / 2);
  });

  it('places the object box, not the whole image, in the placement', () => {
    // Object box is the middle 80% of a 400×400 image: it must exactly fill the placement.
    const bounds = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
    const rect = placePlate({ naturalWidth: 400, naturalHeight: 400 }, bounds, placement);

    expect(rect.width).toBeCloseTo(500);
    expect(rect.x + bounds.x * rect.width).toBeCloseTo(50);
    expect(rect.y + bounds.y * rect.height).toBeCloseTo(50);
    expect(bounds.width * rect.width).toBeCloseTo(400);
  });

  it('does not assume the object is centered in the photograph', () => {
    const bounds = { x: 0, y: 0, width: 0.5, height: 0.5 };
    const rect = placePlate({ naturalWidth: 400, naturalHeight: 400 }, bounds, placement);

    // The top-left quarter fills the placement, so the image extends past it.
    expect(rect).toEqual({ x: 50, y: 50, width: 800, height: 800 });
  });
});

describe('buildScene: standalone plate', () => {
  it('uses the plate image size and draws the plate, then the text', () => {
    const scene = sceneFor();

    expect(scene.width).toBe(400);
    expect(scene.height).toBe(400);
    expect(order(scene)).toEqual(['plate', 'text']);
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

describe('buildScene: framed plate', () => {
  it('paints frame back, plate, text, then frame front', () => {
    expect(order(sceneFor({ frameId: 'test-frame-any' }))).toEqual([
      'frame-back',
      'plate',
      'text',
      'frame-front',
    ]);
  });

  it('uses the frame back as the base size and fits the plate in the placement', () => {
    const scene = sceneFor({ frameId: 'test-frame-any' });
    const plate = scene.layers.find((layer) => layer.kind === 'image' && layer.role === 'plate');

    expect([scene.width, scene.height]).toEqual([500, 500]);
    // Placement: the middle 80% of 500 → 400 px at (50, 50). The plate's object box
    // (80% of its photo) fills it, so the whole photo is 500 px and starts at the origin.
    expect(plate?.kind === 'image' && plate.rect).toEqual({ x: 0, y: 0, width: 500, height: 500 });
  });

  it('draws the front overlay over the whole frame image', () => {
    const front = sceneFor({ frameId: 'test-frame-any' }).layers.at(-1);

    expect(front).toMatchObject({
      kind: 'image',
      role: 'frame-front',
      rect: { x: 0, y: 0, width: 500, height: 500 },
    });
  });

  it('positions the text relative to the placed plate', () => {
    const text = sceneFor({ frameId: 'test-frame-any' }).layers.find(
      (layer) => layer.kind === 'text',
    );

    // The plate photo is 500 px at the origin; the text area is 0.2/0.3/0.6/0.4 of it.
    expect(text?.kind === 'text' && text.block.area).toEqual({
      x: 100,
      y: 150,
      width: 300,
      height: 200,
    });
  });

  it('describes both product images', () => {
    expect(sceneFor({ frameId: 'test-frame-any' }).description).toBe('Frame, square; Square');
  });
});

describe('buildScene: frame problems keep the plate', () => {
  it('shows the plate alone for an uncalibrated frame', () => {
    const scene = sceneFor({
      plateId: 'test-plate-rectangle',
      frameId: 'test-frame-any',
      text: '',
    });

    expect(order(scene)).toEqual(['plate']);
    expect(scene.notices).toEqual(['frame-not-calibrated']);
  });

  it('shows the plate alone when a frame file fails to load', () => {
    const scene = sceneFor(
      { frameId: 'test-frame-any' },
      states({ [SQUARE_FRONT]: { status: 'error' } }),
    );

    expect(order(scene)).toEqual(['plate', 'text']);
    expect(scene.notices).toEqual(['frame-image-error']);
  });

  it('drops the frame when its layers have different aspect ratios', () => {
    const scene = sceneFor(
      { frameId: 'test-frame-any' },
      states({
        [SQUARE_FRONT]: {
          status: 'loaded',
          image: { src: SQUARE_FRONT, naturalWidth: 600, naturalHeight: 400 },
        },
      }),
    );

    expect(order(scene)).toEqual(['plate', 'text']);
    expect(scene.notices).toEqual(['frame-layers-mismatch']);
  });

  it('accepts layers within the aspect tolerance', () => {
    const height = Math.round(500 * (1 + ASPECT_TOLERANCE / 2));
    const scene = sceneFor(
      { frameId: 'test-frame-any' },
      states({
        [SQUARE_FRONT]: {
          status: 'loaded',
          image: { src: SQUARE_FRONT, naturalWidth: 500, naturalHeight: height },
        },
      }),
    );

    expect(order(scene)).toContain('frame-front');
  });
});

describe('buildScene: image states', () => {
  it('draws nothing while any needed file is loading', () => {
    const images = states();
    images.delete(SQUARE_BACK);
    const scene = sceneFor({ frameId: 'test-frame-any' }, images);

    expect(scene.layers).toEqual([]);
    expect(scene.notices).toEqual(['plate-image-loading']);
  });

  it('treats a source that has not reported as loading', () => {
    const scene = sceneFor({}, new Map());

    expect(scene.layers).toEqual([]);
    expect(scene.notices).toEqual(['plate-image-loading']);
  });

  it('draws nothing, and substitutes nothing, when the plate file fails to load', () => {
    const scene = sceneFor(
      { frameId: 'test-frame-any' },
      states({ [SQUARE_NUDE]: { status: 'error' } }),
    );

    expect(scene.layers).toEqual([]);
    expect(scene.notices).toEqual(['plate-image-error']);
  });

  it('keeps the catalog-pending state distinct from a load error', () => {
    expect(sceneFor({ plateId: 'test-plate-pending' }).notices).toEqual(['plate-image-pending']);
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
    const block = textBlock(sceneFor({ fontFamily: 'serif' }));

    expect(block.fontFamily).toBe('serif');
    expect(block.segments).toEqual([[{ text: 'Ana', color: FALLBACK_TEXT_COLOR }]]);
  });

  it('colors the segments of each line from the source offsets, across line breaks', () => {
    const block = textBlock(
      sceneFor({
        text: 'Casa\nda Ana',
        textColorId: 'test-text-color-a',
        secondaryColorId: 'test-text-color-b',
        // "sa" on the first line and "An" on the second.
        secondaryRanges: [
          { start: 2, end: 4 },
          { start: 8, end: 10 },
        ],
      }),
    );

    expect(block.segments).toEqual([
      [
        { text: 'Ca', color: '#112233' },
        { text: 'sa', color: '#aa2200' },
      ],
      [
        { text: 'da ', color: '#112233' },
        { text: 'An', color: '#aa2200' },
        { text: 'a', color: '#112233' },
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

  it('has no text layer, and keeps the notice, when the area is not calibrated', () => {
    const scene = sceneFor({ plateId: 'test-plate-rectangle' });

    expect(order(scene)).toEqual(['plate']);
    expect(scene.notices).toEqual(['text-area-pending']);
  });
});
