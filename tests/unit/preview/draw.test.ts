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
import { MARK_INK, SIGNATURE, WATERMARK_SRC } from '../../../src/preview/watermark';
import {
  contextOf,
  FakeContext,
  fontSizeOf,
  installFakeCanvas,
  type PaintCall,
} from '../support/fake-canvas';
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
  const scene = buildScene(composition, loaded(), createTextMeasurer(value.fontFamily));
  const ctx = new FakeContext();
  drawScene(ctx as unknown as CanvasRenderingContext2D, scene, pixelWidth, ...effect);
  return { ctx, scene };
}

const srcOf = (call: unknown) => (call as { image: { src: string } }).image.src;
const isLayer = (call: unknown) => (call as { image: unknown }).image instanceof HTMLCanvasElement;
const isSignature = (call: PaintCall) =>
  (call.op === 'fillText' && call.text === SIGNATURE.text) ||
  (call.op === 'drawImage' && (call.image as { src?: string }).src === WATERMARK_SRC);
/** Everything but the Taavi signature (D-060), which has its own tests. */
const lettering = (calls: readonly PaintCall[]) => calls.filter((call) => !isSignature(call));
/** The text runs of the customer's lettering. */
const lines = (ctx: FakeContext) =>
  lettering(ctx.calls).filter(
    (call): call is Extract<PaintCall, { op: 'fillText' }> => call.op === 'fillText',
  );
/** Fake width of an unspaced run (serif, the fixtures' font): half the font size per character. */
const widthOf = (call: { readonly text: string; readonly font: string }) =>
  [...call.text].length * fontSizeOf(call.font) * 0.5;

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
      if (isSignature(call)) return 'signature';
      if (call.op === 'fillText') return 'text';
      return isLayer(call) ? 'deboss' : srcOf(call).split('/').at(-1);
    });

    expect(order).toEqual(['beige.webp', 'text', 'deboss', 'signature', 'signature']);
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
    const drawnLines = lines(ctx);

    // Text area: x 80..320, y 120..280 → center x 200, vertical center 200.
    // Lines are drawn left-aligned from their measured start (D-072).
    expect(drawnLines.map((call) => call.text)).toEqual(['Casa', 'Ana']);
    expect(drawnLines.every((call) => call.textAlign === 'left')).toBe(true);
    expect(drawnLines.map((call) => call.x + widthOf(call) / 2)).toEqual([200, 200]);
    const [first, second] = drawnLines;
    expect(((first?.y ?? 0) + (second?.y ?? 0)) / 2).toBeCloseTo(200);
    expect((second?.y ?? 0) - (first?.y ?? 0)).toBeGreaterThan(0);
  });

  it('anchors left- and right-aligned text to the area edges', () => {
    for (const [align, x, anchor, edge] of [
      ['left', 0, 0, 80],
      ['right', 1, 1, 320],
    ] as const) {
      const { ctx } = paint({ textLayout: { align, x, y: 0.5 } }, 400);
      const [line] = lines(ctx);
      if (line === undefined) throw new Error('No text');
      expect(line.textAlign).toBe('left');
      expect(line.x + widthOf(line) * anchor).toBe(edge);
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
    const drawnLines = lines(ctx);

    expect(bounds.x).toBe(80);
    expect(bounds.y).toBe(120);
    // Right-aligned lines share the block's right edge, which is not the area's.
    expect(drawnLines.map((call) => call.x + widthOf(call))).toEqual([
      80 + bounds.width,
      80 + bounds.width,
    ]);
    expect(80 + bounds.width).toBeLessThan(320);
    expect(drawnLines[0]?.y).toBeCloseTo(120 + lineHeight / 2);
  });

  it.each([
    ['left', 0],
    ['center', 0.5],
    ['right', 1],
  ] as const)(
    'aligns lines of different lengths %s inside the unmoved block (D-059)',
    (align, anchor) => {
      const { ctx, scene } = paint(
        { text: 'Ana\nCasa da Ana', textLayout: { align, x: 0.3, y: 0.5 } },
        400,
      );
      const text = scene.layers.find((layer) => layer.kind === 'text');
      if (text?.kind !== 'text') throw new Error('No text layer');
      const { bounds } = text.block;
      const drawnLines = lines(ctx);
      const edge = bounds.x + bounds.width * anchor;

      // Same block as center alignment: 220 wide at x 80 + 0.3 × 20.
      expect(bounds).toMatchObject({ x: 86, width: 220 });
      // Both lines share the aligned edge: left starts, centers, or right ends.
      expect(drawnLines.map((call) => [call.text, call.x + widthOf(call) * anchor])).toEqual([
        ['Ana', edge],
        ['Casa da Ana', edge],
      ]);
      expect(drawnLines[0]?.x).toBeGreaterThanOrEqual(bounds.x);
      expect((drawnLines[0]?.x ?? 0) + 3 * 20).toBeLessThanOrEqual(bounds.x + bounds.width);
    },
  );

  it('uses the chosen font family and primary color', () => {
    const serif = paint({ fontFamily: 'serif', textColorId: 'test-text-color-a' }, 400);
    const sans = paint({ fontFamily: 'sans-serif', textColorId: 'test-text-color-a' }, 400);
    const fontOf = (ctx: FakeContext) => ctx.calls.find((call) => call.op === 'fillText');

    expect(fontOf(serif.ctx)).toMatchObject({ fillStyle: '#112233' });
    // The self-hosted lettering fonts first, the system stacks only as fallback (D-072).
    expect(fontOf(serif.ctx)?.font).toMatch(/^400 [\d.]+px "Taavi Lettering Serif", Georgia/);
    expect(fontOf(sans.ctx)?.font).toMatch(/^700 [\d.]+px "Taavi Lettering Sans", system-ui/);
  });

  it('paints a mixed-color line as consecutive runs that add up to the same text', () => {
    const { ctx } = paint(
      {
        // "bc" is a highlighted word (D-071).
        text: 'a bc d',
        textColorId: 'test-text-color-a',
        highlightEnabled: true,
        secondaryColorId: 'test-text-color-b',
        secondaryRanges: [{ start: 2, end: 4 }],
      },
      400,
    );
    const runs = lines(ctx);

    expect(runs.map((run) => [run.text, run.fillStyle])).toEqual([
      ['a ', '#112233'],
      ['bc', '#aa2200'],
      [' d', '#112233'],
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
    // Only the signature's mark and text are translucent; the photograph never is.
    const photo = ctx.calls.find((call) => call.op === 'drawImage');
    expect(photo).toMatchObject({ alpha: 1, composite: 'source-over' });
  });
});

describe('drawScene: Taavi signature (D-060)', () => {
  beforeEach(() => {
    installFakeCanvas();
  });

  const signatureOf = (ctx: FakeContext) => {
    const mark = ctx.calls.find(
      (call): call is Extract<PaintCall, { op: 'drawImage' }> =>
        call.op === 'drawImage' && isSignature(call),
    );
    const text = ctx.calls.find(
      (call): call is Extract<PaintCall, { op: 'fillText' }> =>
        call.op === 'fillText' && isSignature(call),
    );
    if (!mark || !text) throw new Error('No signature drawn');
    return {
      mark,
      text,
      geometry: [mark.x, mark.y, mark.width, mark.height, text.x, text.y, text.font],
    };
  };

  it('is 1.5 × the M4.6 size and 20% more transparent than first implemented', () => {
    // First values: height 0.05, ink alpha 0.9; × 1.1 and × 0.8 (M4.6), then × 1.5 (D-065).
    expect(SIGNATURE.height).toBeCloseTo(0.05 * 1.1 * 1.5, 10);
    expect(SIGNATURE.inkAlpha).toBeCloseTo(0.9 * 0.8, 10);
    // Still below every model's text area (the lowest ends at 0.88).
    expect(1 - SIGNATURE.margin - SIGNATURE.height).toBeGreaterThan(0.88);
  });

  it('has no background: only the mark and the text are painted (D-065)', () => {
    const { ctx } = paint({ text: 'Ana' }, 400);
    expect(ctx.calls.some((call) => call.op === 'roundRect')).toBe(false);
    expect(ctx.calls.some((call) => call.op === 'fill')).toBe(false);
  });

  it('is painted last, over everything, in its own saved state', () => {
    const { ctx } = paint({ text: 'Ana' }, 400);
    const calls = ctx.calls;
    const mark = calls.findIndex((call) => call.op === 'drawImage' && isSignature(call));
    const shading = calls.findIndex((call) => call.op === 'drawImage' && isLayer(call));

    expect(shading).toBeGreaterThan(-1);
    expect(mark).toBeGreaterThan(shading);
    expect(calls.at(-1)).toEqual({ op: 'restore' });
    expect(ctx.drawn.at(-1)).toMatchObject({ op: 'fillText', text: '© Taavi' });
  });

  it('sits at the bottom-right corner, sized from the scene, not on the text area', () => {
    const { ctx } = paint({ text: 'Ana' }, 400);
    const { mark, text } = signatureOf(ctx);
    const height = SIGNATURE.height * 400;
    const bottom = 400 - SIGNATURE.margin * 400;

    // Centered in the signature's box, which ends at the bottom margin.
    expect(mark.height).toBeCloseTo(SIGNATURE.markHeight * height);
    expect(mark.y + mark.height / 2).toBeCloseTo(bottom - height / 2);
    expect(text.y).toBeCloseTo(bottom - height / 2);
    // Text area of the fixture ends at y 280.
    expect(mark.y).toBeGreaterThan(280);
    // The mark keeps the logo's aspect ratio.
    expect(mark.width / mark.height).toBeCloseTo(MARK_INK.width / MARK_INK.height);
    expect(mark.alpha).toBe(SIGNATURE.inkAlpha);
    expect(text).toMatchObject({ fillStyle: SIGNATURE.ink, textAlign: 'left' });
    expect(text.x).toBeGreaterThan(mark.x + mark.width);
    expect(text.x).toBeLessThan(400 - SIGNATURE.margin * 400);
  });

  it('keeps the same relative geometry at any resolution, so preview and export match', () => {
    const small = signatureOf(paint({ text: 'Ana' }, 400).ctx).geometry;
    const large = signatureOf(paint({ text: 'Ana' }, 1200).ctx).geometry;

    // drawScene works in scene units and scales the transform, so the paths are identical.
    expect(large).toEqual(small);
  });

  it('is the same with or without lettering, and with flat lettering', () => {
    const plain = signatureOf(paint({ text: '' }, 400).ctx).geometry;
    const flat = signatureOf(paint({ text: 'Ana' }, 400, null).ctx).geometry;

    expect(plain).toEqual(flat);
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
    lettering(calls).filter((call): call is Text => call.op === 'fillText');
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

  it('is treatment B: a light inner shadow, no highlight (D-072)', () => {
    expect(DEBOSS).toEqual({ offset: 0.012, blur: 0.012, shadow: 0.3 });
  });

  it('casts one inner shadow, then cuts it to the glyphs with the mask in one draw', () => {
    const { ctx } = paint({ text: 'Casa\nAna' }, 400);
    const frame = latest(shading(ctx).layer);
    const draws = frame.filter((call): call is Draw => call.op === 'drawImage');
    const [dark, cut] = draws;

    // Treatment B: one dark pass and the cut; no highlight pass (D-072).
    expect(draws).toHaveLength(2);
    // The inverse mask is drawn in the layer's right half; its shadow lands in the left half.
    expect(dark?.x).toBe(dark?.width);
    expect((dark?.x ?? 0) + (dark?.shadow.dx ?? 0)).toBe(0);
    expect(dark?.composite).toBe('source-over');
    expect(dark?.shadow.color).toBe('rgba(0, 0, 0, 0.3)');
    expect(dark?.shadow.dy).toBeGreaterThan(0);
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
        // "bc" is a highlighted word (D-071).
        text: 'a bc d',
        textColorId: 'test-text-color-a',
        highlightEnabled: true,
        secondaryColorId: 'test-text-color-b',
        secondaryRanges: [{ start: 2, end: 4 }],
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
    // Large enough that neither is held at the 0.5 px minimum.
    const small = blurAt(800);
    const large = blurAt(1600);

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

describe('drawScene: "Sem serifa" letter spacing (D-072)', () => {
  beforeEach(() => {
    installFakeCanvas();
  });

  it('measures lines with the spacing between graphemes', () => {
    const measure = createTextMeasurer('sans-serif');
    // Fake: 10 px per character at 20 px; spacing 0.05 em = 1 px.
    expect(measure('PAZ', 20)).toBe(32);
    expect(createTextMeasurer('serif')('PAZ', 20)).toBe(30);
  });

  it('spaces every run, and advances mixed-color runs by their spaced width', () => {
    const { ctx, scene } = paint(
      {
        fontFamily: 'sans-serif',
        text: 'a bc d',
        textColorId: 'test-text-color-a',
        highlightEnabled: true,
        secondaryColorId: 'test-text-color-b',
        secondaryRanges: [{ start: 2, end: 4 }],
      },
      400,
    );
    const text = scene.layers.find((layer) => layer.kind === 'text');
    if (text?.kind !== 'text') throw new Error('No text layer');
    const runs = lines(ctx);
    const spacing = 0.05 * text.block.fontSize;

    expect(runs.map((run) => run.text)).toEqual(['A ', 'BC', ' D']);
    expect(runs.every((run) => run.letterSpacing === `${spacing}px`)).toBe(true);
    // Each run starts after the previous one's glyphs and the spacing after each of them.
    const [first, second, third] = runs;
    const advance = (run: typeof first) => widthOf(run ?? { text: '', font: '' }) + 2 * spacing;
    expect(second?.x).toBeCloseTo((first?.x ?? 0) + advance(first));
    expect(third?.x).toBeCloseTo((second?.x ?? 0) + advance(second));
    // The line is centered on its spaced width: 6 graphemes, 5 gaps.
    const lineWidth = widthOf({ text: 'A BC D', font: first?.font ?? '' }) + 5 * spacing;
    expect((first?.x ?? 0) + lineWidth / 2).toBeCloseTo(200);
  });

  it('cuts the deboss mask with the same spacing as the lettering', () => {
    const { ctx } = paint({ fontFamily: 'sans-serif', text: 'Paz' }, 400);
    const layer = ctx.calls.find((call) => call.op === 'drawImage' && isLayer(call));
    const shadow = contextOf((layer as { image: HTMLCanvasElement }).image).calls.find(
      (call) => call.op === 'drawImage',
    );
    const mask = contextOf((shadow as { image: HTMLCanvasElement }).image);
    // The mask canvas is reused between frames: its latest glyph run is this frame's.
    const cut = mask.calls.filter((call) => call.op === 'fillText').at(-1);

    expect(cut).toMatchObject({ text: 'PAZ', letterSpacing: lines(ctx)[0]?.letterSpacing });
    expect(mask.letterSpacing).toBe('0px');
  });
});
