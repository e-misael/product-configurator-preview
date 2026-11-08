import { composePreview } from '../../../src/preview/composition';
import {
  CANVAS_BACKGROUND,
  chooseBackingWidth,
  createTextMeasurer,
  drawScene,
  MAX_PIXEL_RATIO,
  TEXT_COLOR,
} from '../../../src/preview/draw';
import { DEBOSS, DEBOSS_MIN_FONT_PX } from '../../../src/preview/deboss';
import { buildScene, type ImageState } from '../../../src/preview/scene';
import { contextOf, FakeContext, installFakeCanvas, type PaintCall } from '../support/fake-canvas';
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

function paint(
  overrides: Parameters<typeof config>[0],
  pixelWidth: number,
  ...effect: [] | [Parameters<typeof drawScene>[3]]
) {
  const value = config(overrides);
  const composition = composePreview(previewCatalog, value, validate(value));
  const scene = buildScene(composition, loaded(), createTextMeasurer());
  const ctx = new FakeContext();
  drawScene(ctx as unknown as CanvasRenderingContext2D, scene, pixelWidth, ...effect);
  return { ctx, scene };
}

const srcOf = (call: unknown) => (call as { image: { src: string } }).image.src;
const isLayer = (call: unknown) => (call as { image: unknown }).image instanceof HTMLCanvasElement;

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

  it('paints the photograph, then the text, then its deboss shading (D-046, D-052)', () => {
    const { ctx } = paint({}, 400);
    const order = ctx.drawn.map((call) => {
      if (call.op === 'fillText') return 'text';
      return isLayer(call) ? 'deboss' : srcOf(call).split('/').at(-1);
    });

    expect(order).toEqual(['beige.webp', 'text', 'deboss']);
  });

  it('scales logical units to the canvas width, then clears to opaque white', () => {
    const { ctx } = paint({}, 200);

    expect(ctx.calls[0]).toEqual({ op: 'setTransform', args: [0.5, 0, 0, 0.5, 0, 0] });
    expect(ctx.calls[1]).toEqual({ op: 'clearRect', args: [0, 0, 400, 400] });
    expect(ctx.calls[2]).toEqual({ op: 'fillRect', args: [0, 0, 400, 400], fillStyle: '#ffffff' });
    expect(CANVAS_BACKGROUND).toBe('#ffffff');
  });

  it('draws the photograph over the whole scene', () => {
    const { ctx } = paint({}, 400);
    const plate = ctx.calls.find((call) => call.op === 'drawImage');

    expect(plate).toMatchObject({ x: 0, y: 0, width: 400, height: 400 });
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
    const { ctx } = paint({}, 400);

    expect(ctx.filter).toBe('none');
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.globalAlpha).toBe(1);
  });
});

describe('drawScene: debossed lettering (D-052)', () => {
  beforeEach(() => {
    installFakeCanvas();
  });

  type Draw = Extract<PaintCall, { op: 'drawImage' }>;
  type Text = Extract<PaintCall, { op: 'fillText' }>;
  /** Calls since the surface was last cleared for reuse: the latest frame. */
  const latest = (ctx: FakeContext) => {
    const calls = ctx.calls;
    let start = 0;
    calls.forEach((call, index) => {
      if (call.op === 'clearRect') start = index + 1;
    });
    return calls.slice(start);
  };
  const shading = (ctx: FakeContext) => {
    const draw = ctx.calls.find((call): call is Draw => call.op === 'drawImage' && isLayer(call));
    if (draw === undefined) throw new Error('No deboss layer');
    return { draw, layer: contextOf(draw.image as HTMLCanvasElement) };
  };
  const texts = (calls: readonly PaintCall[]) =>
    calls.filter((call): call is Text => call.op === 'fillText');
  const runsOf = (calls: readonly PaintCall[]) =>
    texts(calls).map((call) => [call.text, call.x, call.y, call.textAlign]);

  it('draws the shading layer over the lettering with plain source-over', () => {
    const { ctx } = paint({ text: 'Ana' }, 400);
    const { draw } = shading(ctx);

    expect(ctx.calls.indexOf(draw)).toBeGreaterThan(
      ctx.calls.findIndex((call) => call.op === 'fillText'),
    );
    expect(draw).toMatchObject({ composite: 'source-over', shadow: { blur: 0, dx: 0, dy: 0 } });
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });

  it('casts only shadows, then cuts them to the glyphs with the mask in one draw', () => {
    const { ctx } = paint({ text: 'Casa\nAna' }, 400);
    const frame = latest(shading(ctx).layer);
    const draws = frame.filter((call): call is Draw => call.op === 'drawImage');
    const [dark, light, cut] = draws;

    expect(draws).toHaveLength(3);
    // The inverse mask is drawn in the layer's right half; its shadow lands in the left half.
    for (const call of [dark, light]) {
      expect(call?.x).toBe(call?.width);
      expect((call?.x ?? 0) + (call?.shadow.dx ?? 0)).toBe(0);
      expect(call?.composite).toBe('source-over');
    }
    expect(dark?.shadow.color).toBe(`rgba(0, 0, 0, ${DEBOSS.shadow})`);
    expect(dark?.shadow.dy).toBeGreaterThan(0);
    expect(light?.shadow.color).toBe(`rgba(255, 255, 255, ${DEBOSS.highlight})`);
    expect(light?.shadow.dy).toBeLessThan(0);
    // Then the same mask, over the left half, removes everything that is not a glyph.
    expect(cut).toMatchObject({ x: 0, composite: 'destination-out', shadow: { dx: 0, dy: 0 } });
    expect(cut?.image).toBe(dark?.image);
    expect(texts(frame)).toEqual([]);
  });

  it('cuts every glyph run, all lines and colors, out of the inverse mask', () => {
    const { ctx } = paint({ text: 'Casa da Ana' }, 400);
    const frame = latest(shading(ctx).layer);
    const shadow = frame.find((call): call is Draw => call.op === 'drawImage');
    const mask = latest(contextOf(shadow?.image as HTMLCanvasElement));

    expect(mask[0]).toMatchObject({ op: 'fillRect', fillStyle: '#000' });
    expect(texts(mask).every((call) => call.composite === 'destination-out')).toBe(true);
    expect(runsOf(mask)).toEqual(runsOf(ctx.calls));
  });

  it('shades mixed-color runs as one block, keeping each color on the canvas', () => {
    const { ctx } = paint(
      {
        text: 'abcd',
        textColorId: 'test-text-color-a',
        secondaryColorId: 'test-text-color-b',
        secondaryRanges: [{ start: 1, end: 3 }],
      },
      400,
    );
    const shadow = latest(shading(ctx).layer).find((call): call is Draw => call.op === 'drawImage');
    const mask = latest(contextOf(shadow?.image as HTMLCanvasElement));

    expect(texts(ctx.calls).map((call) => call.fillStyle)).toEqual([
      '#112233',
      '#aa2200',
      '#112233',
    ]);
    expect(runsOf(mask)).toEqual(runsOf(ctx.calls));
  });

  it('scales the shadow with the canvas resolution, so preview and export match', () => {
    const blurAt = (pixelWidth: number) => {
      const shadow = latest(shading(paint({ text: 'Ana' }, pixelWidth).ctx).layer).find(
        (call): call is Draw => call.op === 'drawImage',
      );
      return shadow?.shadow;
    };
    const small = blurAt(400);
    const large = blurAt(800);

    expect(large?.blur).toBeCloseTo((small?.blur ?? 0) * 2);
    expect(large?.dy).toBeCloseTo((small?.dy ?? 0) * 2);
  });

  it('skips the effect on text too small to show it', () => {
    const { ctx, scene } = paint({ text: 'Ana' }, 20);
    const text = scene.layers.find((layer) => layer.kind === 'text');
    if (text?.kind !== 'text') throw new Error('No text layer');

    expect(text.block.fontSize * (20 / scene.width)).toBeLessThan(DEBOSS_MIN_FONT_PX);
    expect(ctx.calls.some((call) => call.op === 'drawImage' && isLayer(call))).toBe(false);
  });

  it('paints flat lettering when no effect is given', () => {
    const { ctx } = paint({ text: 'Ana' }, 400, null);

    expect(ctx.calls.some((call) => call.op === 'drawImage' && isLayer(call))).toBe(false);
    expect(texts(ctx.calls).map((call) => call.text)).toEqual(['Ana']);
  });

  it('reuses its offscreen layers between frames', () => {
    const first = shading(paint({ text: 'Ana' }, 400).ctx).draw.image;
    const second = shading(paint({ text: 'Casa da Ana' }, 400).ctx).draw.image;

    expect(second).toBe(first);
  });
});
