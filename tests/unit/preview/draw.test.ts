import { composePreview } from '../../../src/preview/composition';
import {
  chooseBackingWidth,
  createTextMeasurer,
  drawScene,
  MAX_PIXEL_RATIO,
  TEXT_COLOR,
} from '../../../src/preview/draw';
import { buildScene, type ImageState } from '../../../src/preview/scene';
import { FakeContext, installFakeCanvas } from '../support/fake-canvas';
import { config, previewCatalog, previewSizes, validate } from './fixtures';

type Img = HTMLImageElement;

function loaded(): Map<string, ImageState<Img>> {
  const map = new Map<string, ImageState<Img>>();
  for (const [src, size] of Object.entries(previewSizes)) {
    const image = { src, naturalWidth: size.width, naturalHeight: size.height } as unknown as Img;
    map.set(src, { status: 'loaded', image });
  }
  return map;
}

function paint(overrides: Parameters<typeof config>[0], pixelWidth: number) {
  const value = config(overrides);
  const composition = composePreview(previewCatalog, value, validate(value));
  const scene = buildScene(composition, loaded(), createTextMeasurer());
  const ctx = new FakeContext();
  drawScene(ctx as unknown as CanvasRenderingContext2D, scene, pixelWidth);
  return { ctx, scene };
}

const srcOf = (call: unknown) => (call as { image: { src: string } }).image.src;

describe('chooseBackingWidth', () => {
  it('follows the displayed width times the pixel ratio', () => {
    expect(chooseBackingWidth(300, 2, 2000)).toBe(600);
  });

  it('never exceeds the source image width', () => {
    expect(chooseBackingWidth(300, 2, 500)).toBe(500);
  });

  it('treats a ratio below 1 as 1 and clamps very high ratios', () => {
    expect(chooseBackingWidth(300, 0.5, 2000)).toBe(300);
    expect(chooseBackingWidth(300, 10, 2000)).toBe(300 * MAX_PIXEL_RATIO);
  });

  it('uses the image width when the displayed width is unknown', () => {
    expect(chooseBackingWidth(0, 2, 640)).toBe(640);
    expect(chooseBackingWidth(Number.NaN, 2, 640)).toBe(640);
  });

  it('never returns less than one pixel', () => {
    expect(chooseBackingWidth(0.1, 1, 640)).toBe(1);
  });
});

describe('drawScene', () => {
  beforeEach(() => {
    installFakeCanvas();
  });

  it('paints frame back, plate, text, then frame front', () => {
    const { ctx } = paint({ frameId: 'test-frame-any' }, 500);
    const order = ctx.drawn.map((call) =>
      call.op === 'fillText' ? 'text' : srcOf(call).split('/').at(-1),
    );

    expect(order).toEqual(['square-back.webp', 'beige.webp', 'text', 'square-front.webp']);
  });

  it('scales logical units to the canvas width and clears first', () => {
    const { ctx } = paint({}, 200);

    expect(ctx.calls[0]).toEqual({ op: 'setTransform', args: [0.5, 0, 0, 0.5, 0, 0] });
    expect(ctx.calls[1]).toEqual({ op: 'clearRect', args: [0, 0, 400, 400] });
  });

  it('draws each image at its scene rectangle', () => {
    const { ctx } = paint({ frameId: 'test-frame-any' }, 500);
    const plate = ctx.calls.find(
      (call) => call.op === 'drawImage' && srcOf(call).includes('plates'),
    );

    expect(plate).toMatchObject({ x: 0, y: 0, width: 500, height: 500 });
  });

  it('draws one text line per line, centered on the text area', () => {
    const { ctx } = paint({ text: 'Casa\nAna' }, 400);
    const lines = ctx.calls.filter((call) => call.op === 'fillText');

    // Text area: x 80..320, y 120..280 → center x 200, vertical center 200.
    expect(lines.map((call) => call.text)).toEqual(['Casa', 'Ana']);
    expect(lines.every((call) => call.x === 200 && call.textAlign === 'center')).toBe(true);
    const [first, second] = lines;
    expect(((first?.y ?? 0) + (second?.y ?? 0)) / 2).toBeCloseTo(200);
    expect((second?.y ?? 0) - (first?.y ?? 0)).toBeGreaterThan(0);
  });

  it('anchors left- and right-aligned text to the area edges', () => {
    for (const [align, x, expectedX] of [
      ['left', 0, 80],
      ['right', 1, 320],
    ] as const) {
      const { ctx } = paint({ textLayout: { align, x, y: 0.5 } }, 400);
      expect(ctx.calls.find((call) => call.op === 'fillText')).toMatchObject({
        x: expectedX,
        textAlign: align,
      });
    }
  });

  it('draws a positioned block: lines aligned inside it, block at the area corner', () => {
    // Area x 80–320, y 120–280; "Casa" is 4 chars, "da Ana" 6 chars → block width = widest line.
    const { ctx, scene } = paint(
      { text: 'Casa\nda Ana', textLayout: { align: 'right', x: 0, y: 0 } },
      400,
    );
    const text = scene.layers.find((layer) => layer.kind === 'text');
    if (text?.kind !== 'text') throw new Error('No text layer');
    const { bounds, lineHeight } = text.block;
    const lines = ctx.calls.filter((call) => call.op === 'fillText');

    expect(bounds.x).toBe(80);
    expect(bounds.y).toBe(120);
    // Right-aligned lines share the block's right edge, which is not the area's.
    expect(lines.map((call) => [call.x, call.textAlign])).toEqual([
      [80 + bounds.width, 'right'],
      [80 + bounds.width, 'right'],
    ]);
    expect(80 + bounds.width).toBeLessThan(320);
    expect(lines[0]?.y).toBeCloseTo(120 + lineHeight / 2);
  });

  it('uses the chosen font family and primary color', () => {
    const serif = paint({ fontFamily: 'serif', textColorId: 'test-text-color-a' }, 400);
    const sans = paint({ fontFamily: 'sans-serif', textColorId: 'test-text-color-a' }, 400);
    const fontOf = (ctx: FakeContext) => ctx.calls.find((call) => call.op === 'fillText');

    expect(fontOf(serif.ctx)).toMatchObject({ fillStyle: '#112233' });
    expect(fontOf(serif.ctx)?.font).toContain('Georgia');
    expect(fontOf(sans.ctx)?.font).not.toContain('Georgia');
  });

  it('paints a mixed-color line as consecutive runs that add up to the same text', () => {
    const { ctx } = paint(
      {
        text: 'abcd',
        textColorId: 'test-text-color-a',
        secondaryColorId: 'test-text-color-b',
        secondaryRanges: [{ start: 1, end: 3 }],
      },
      400,
    );
    const runs = ctx.calls.filter((call) => call.op === 'fillText');

    expect(runs.map((run) => [run.text, run.fillStyle])).toEqual([
      ['a', '#112233'],
      ['bc', '#aa2200'],
      ['d', '#112233'],
    ]);
    expect(runs.every((run) => run.textAlign === 'left')).toBe(true);
    // Runs are laid out left to right on one baseline with no gaps.
    expect(runs[0]?.y).toBe(runs[1]?.y);
    expect(runs[1]?.y).toBe(runs[2]?.y);
    const [first, second, third] = runs.map((run) => run.x);
    expect(first).toBeLessThan(second ?? 0);
    expect(second).toBeLessThan(third ?? 0);
  });

  it('draws the text unaltered, in the provisional color, without clipping', () => {
    const { ctx } = paint({ text: 'Ação 👩‍👩‍👧', textColorId: null }, 400);

    expect(ctx.calls.find((call) => call.op === 'fillText')).toMatchObject({
      text: 'Ação 👩‍👩‍👧',
    });
    expect(ctx.fillStyle).toBe(TEXT_COLOR);
  });

  it('never tints or blends: no filter, composite, or alpha changes', () => {
    const { ctx } = paint({ frameId: 'test-frame-any' }, 500);

    expect(ctx.filter).toBe('none');
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.globalAlpha).toBe(1);
  });
});
