import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { rolldown } from 'rolldown';

/**
 * Debossed lettering (D-052) and fixed lettering size (D-055) rendered by the
 * app's real drawing code in a real browser, on Taavi's photographs with the
 * production calibration. Each
 * scene is painted flat (no effect) and debossed on equal canvases and
 * compared pixel by pixel. These checks guard the technique; they do not
 * replace the visual approval of the effect.
 */

declare global {
  interface Window {
    Render: typeof import('./support/render-entry');
  }
}

async function bundle(): Promise<string> {
  // The Taavi mark (D-060) is inlined, so the bundle needs no file server.
  const build = await rolldown({
    input: 'tests/e2e/support/render-entry.ts',
    logLevel: 'silent',
    moduleTypes: { '.png': 'dataurl' },
  });
  const { output } = await build.generate({ format: 'iife', name: 'Render' });
  await build.close();
  return output[0].code;
}

interface Comparison {
  readonly glyph: number;
  readonly changedInside: number;
  readonly changedOutside: number;
  readonly interior: number;
  readonly interiorMaxDelta: number;
  /** Largest distance (px) from a glyph pixel to the glyph edge: half the thickest stroke. */
  readonly deepest: number;
  /** Mean of the largest channel change per glyph pixel. */
  readonly meanChange: number;
}

/** Every production model: its photograph and the real width (mm) of the ceramic in it. */
const MODELS = [
  {
    id: 'placa-ceramica-10',
    src: '/catalog/plates/placa-ceramica-10/bege.png',
    ceramic: 0.8422,
    mm: 100,
  },
  // The 100 mm ceramic inside the frame (282 of 660 px), never the 200 mm frame.
  { id: 'quadro-20', src: '/catalog/plates/quadro-20/bege.jpg', ceramic: 282 / 660, mm: 100 },
  {
    id: 'bandeja-ondulada-m-8',
    src: '/catalog/plates/bandeja-ondulada-m-8/bege.jpg',
    ceramic: 0.9425,
    mm: 80,
  },
  {
    id: 'bandeja-ondulada-g-11',
    src: '/catalog/plates/bandeja-ondulada-g-11/bege.jpg',
    ceramic: 0.9425,
    mm: 110,
  },
] as const;

type Photos = Record<string, HTMLImageElement>;

test.describe('Lettering on the catalog photographs', () => {
  test.beforeEach(async ({ page }) => {
    const [code, ...files] = await Promise.all([
      bundle(),
      ...MODELS.map((model) => readFile(`public${model.src}`)),
    ]);
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await page.addScriptTag({ content: code });
    await page.evaluate(
      async (entries) => {
        const photos: Record<string, HTMLImageElement> = {};
        for (const [src, dataUrl] of entries) {
          const image = new Image();
          image.src = dataUrl;
          await image.decode();
          photos[src] = image;
        }
        // Every composition includes the signature mark, keyed by its (inlined) source.
        const mark = new Image();
        mark.src = window.Render.WATERMARK_SRC;
        await mark.decode();
        photos[window.Render.WATERMARK_SRC] = mark;
        (window as unknown as { photos: Record<string, HTMLImageElement> }).photos = photos;
      },
      MODELS.map((model, i): [string, string] => [
        model.src,
        `data:image/${model.src.endsWith('.png') ? 'png' : 'jpeg'};base64,${files[i]?.toString('base64') ?? ''}`,
      ]),
    );
  });

  /**
   * Paints `text` on a model (the Placa by default) three ways (flat, debossed, and a black flat
   * glyph mask on white without the photo) and compares them.
   */
  const compare = (
    page: import('@playwright/test').Page,
    text: string,
    secondary: { start: number; end: number } | null,
    strength: 'default' | 'proposed',
    plateId: string = 'placa-ceramica-10',
  ) =>
    page.evaluate(
      ({ text, secondary, strength, plateId }) => {
        const R = window.Render;
        const photos = (window as unknown as { photos: Photos }).photos;
        const base = R.getCatalog();
        // Review-only colors (D-049 proposals) borrowed from the demo catalog.
        const catalog = { ...base, textColors: R.demoCatalog.textColors };
        const config = {
          ...R.createEmptyConfiguration(),
          plateId,
          text,
          textColorId: 'demo-letra-marrom',
          highlightEnabled: secondary !== null,
          secondaryColorId: secondary ? 'demo-letra-laranja' : null,
          secondaryRanges: secondary ? [secondary] : [],
        };
        const validation = R.validateConfiguration(config, catalog);
        if (validation.status !== 'valid') throw new Error(JSON.stringify(validation));
        const composition = R.composePreview(catalog, config, validation);
        const images = new Map(
          Object.entries(photos).map(([src, image]) => [src, { status: 'loaded' as const, image }]),
        );
        const scene = R.buildScene(composition, images, R.createTextMeasurer());
        // 'proposed': the first, twice as strong candidate kept for comparison.
        const style =
          strength === 'default'
            ? R.DEBOSS
            : {
                offset: R.DEBOSS.offset * 2,
                blur: R.DEBOSS.blur * 2,
                shadow: R.DEBOSS.shadow * 2,
                highlight: R.DEBOSS.highlight * 2,
              };
        const size = scene.width;
        const paint = (s: typeof scene, effect: typeof style | null) => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('No 2D context');
          R.drawScene(ctx, s, size, effect);
          return ctx.getImageData(0, 0, size, size).data;
        };
        const v = (data: Uint8ClampedArray, i: number) => data[i] ?? 0;
        const flat = paint(scene, null);
        const deboss = paint(scene, style);
        // Glyph coverage: the same text in black, without the photo, on white.
        const textOnly = {
          ...scene,
          layers: scene.layers
            .filter((layer) => layer.kind === 'text')
            .map((layer) =>
              layer.kind === 'text'
                ? {
                    ...layer,
                    block: {
                      ...layer.block,
                      segments: layer.block.segments.map((runs) =>
                        runs.map((run) => ({ ...run, color: '#000000' })),
                      ),
                    },
                  }
                : layer,
            ),
        };
        const mask = paint(textOnly, null);
        const inGlyph = (i: number) =>
          v(mask, i) !== 255 || v(mask, i + 1) !== 255 || v(mask, i + 2) !== 255;
        const differs = (i: number) =>
          v(flat, i) !== v(deboss, i) ||
          v(flat, i + 1) !== v(deboss, i + 1) ||
          v(flat, i + 2) !== v(deboss, i + 2);
        // Distance (px) from each fully covered glyph pixel to the nearest pixel outside
        // the glyph: two-pass chamfer distance transform.
        const dist = new Float32Array(size * size);
        for (let p = 0; p < size * size; p += 1) dist[p] = v(mask, p * 4) === 0 ? 1e9 : 0;
        const d = (p: number) => dist[p] ?? 0;
        for (let y = 0; y < size; y += 1)
          for (let x = 0; x < size; x += 1) {
            const p = y * size + x;
            if (d(p) === 0) continue;
            let best = d(p);
            if (x > 0) best = Math.min(best, d(p - 1) + 1);
            if (y > 0) best = Math.min(best, d(p - size) + 1);
            if (x > 0 && y > 0) best = Math.min(best, d(p - size - 1) + Math.SQRT2);
            if (x < size - 1 && y > 0) best = Math.min(best, d(p - size + 1) + Math.SQRT2);
            dist[p] = best;
          }
        for (let y = size - 1; y >= 0; y -= 1)
          for (let x = size - 1; x >= 0; x -= 1) {
            const p = y * size + x;
            if (d(p) === 0) continue;
            let best = d(p);
            if (x < size - 1) best = Math.min(best, d(p + 1) + 1);
            if (y < size - 1) best = Math.min(best, d(p + size) + 1);
            if (x < size - 1 && y < size - 1) best = Math.min(best, d(p + size + 1) + Math.SQRT2);
            if (x > 0 && y < size - 1) best = Math.min(best, d(p + size - 1) + Math.SQRT2);
            dist[p] = best;
          }
        let deepest = 0;
        for (let p = 0; p < size * size; p += 1) deepest = Math.max(deepest, d(p));
        let glyph = 0;
        let changedInside = 0;
        let changedOutside = 0;
        let interior = 0;
        let interiorMaxDelta = 0;
        let change = 0;
        for (let p = 0; p < size * size; p += 1) {
          const i = p * 4;
          if (!inGlyph(i)) {
            if (differs(i)) changedOutside += 1;
            continue;
          }
          glyph += 1;
          if (differs(i)) changedInside += 1;
          const delta = Math.max(
            Math.abs(v(flat, i) - v(deboss, i)),
            Math.abs(v(flat, i + 1) - v(deboss, i + 1)),
            Math.abs(v(flat, i + 2) - v(deboss, i + 2)),
          );
          change += delta;
          // Stroke centers: the deepest quarter of the glyph interior.
          if (d(p) >= deepest * 0.75) {
            interior += 1;
            interiorMaxDelta = Math.max(interiorMaxDelta, delta);
          }
        }
        return {
          glyph,
          changedInside,
          changedOutside,
          interior,
          interiorMaxDelta,
          deepest,
          meanChange: glyph ? change / glyph : 0,
        };
      },
      { text, secondary, strength, plateId },
    ) as Promise<Comparison>;

  for (const strength of ['default', 'proposed'] as const) {
    test(`changes no pixel outside the glyphs (${strength} strength, two colors)`, async ({
      page,
    }) => {
      const result = await compare(
        page,
        'Casa da Ana\nDesde 2024',
        { start: 8, end: 11 },
        strength,
      );
      test.info().annotations.push({ type: strength, description: JSON.stringify(result) });

      expect(result.glyph).toBeGreaterThan(1000);
      expect(result.changedOutside).toBe(0);
      expect(result.changedInside).toBeGreaterThan(0);
    });
  }

  test('keeps the original color in the stroke centers', async ({ page }) => {
    // At the Placa's fixed lettering size (D-055), the size of every text on it;
    // three lines give enough stroke-center pixels to sample.
    // Capitals since "Sem serifa" is lettered in upper case (D-068): more letters per line.
    const result = await compare(page, 'Ana Luz Bia\nCasa Mar\nSol Lua Rio', null, 'default');
    test.info().annotations.push({ type: 'centers', description: JSON.stringify(result) });

    expect(result.changedOutside).toBe(0);
    expect(result.interior).toBeGreaterThan(100);
    // At most 4 of 255 levels in the deepest quarter of each stroke: not visible.
    expect(result.interiorMaxDelta).toBeLessThanOrEqual(4);
  });

  test('the default changes the lettering less than the first proposal', async ({ page }) => {
    const proposed = await compare(page, 'Casa da Ana', null, 'proposed');
    const chosen = await compare(page, 'Casa da Ana', null, 'default');
    test.info().annotations.push({
      type: 'mean change',
      description: JSON.stringify({ proposed, chosen }),
    });

    expect(chosen.meanChange).toBeLessThan(proposed.meanChange);
    expect(chosen.interiorMaxDelta).toBeLessThan(proposed.interiorMaxDelta);
    expect(chosen.changedOutside).toBe(0);
  });

  for (const model of MODELS) {
    test(`draws every text at the fixed ${model.id} size, capitals about 7 mm (D-055)`, async ({
      page,
    }) => {
      const texts = [
        'A',
        'Casa da Ana e do Pedro, desde 2024',
        'Ação 👩‍👩‍👧 João',
        Array.from({ length: 12 }, (_, i) => `Linha ${i}`).join('\n'),
      ];
      const { width, fontSize, results } = await page.evaluate(
        ({ texts, plateId }) => {
          const R = window.Render;
          const photos = (window as unknown as { photos: Photos }).photos;
          const catalog = R.getCatalog();
          const plate = catalog.plates.find((candidate) => candidate.id === plateId);
          const images = new Map(
            Object.entries(photos).map(([src, image]) => [
              src,
              { status: 'loaded' as const, image },
            ]),
          );
          const results = texts.map((text) => {
            const config = { ...R.createEmptyConfiguration(), plateId, text };
            const validation = R.validateConfiguration(config, catalog);
            const scene = R.buildScene(
              R.composePreview(catalog, config, validation),
              images,
              R.createTextMeasurer(),
            );
            const layer = scene.layers.find((candidate) => candidate.kind === 'text');
            // Visible capital height as drawn, in the photograph's pixels.
            const ctx = document.createElement('canvas').getContext('2d');
            let capPx = null;
            if (ctx && layer?.kind === 'text') {
              ctx.font = R.fontFor(layer.block.fontSize, layer.block.fontFamily);
              capPx = ctx.measureText('H').actualBoundingBoxAscent;
            }
            return {
              capPx,
              fontSize: layer?.kind === 'text' ? layer.block.fontSize : null,
              lines: layer?.kind === 'text' ? layer.block.lines.length : null,
              overflow: scene.notices.includes('text-overflow'),
            };
          });
          return {
            width: plate?.image?.image.widthPx ?? 0,
            fontSize: plate?.image?.text?.fontSize ?? 0,
            results,
          };
        },
        { texts, plateId: model.id },
      );

      // The model's own fixed size, whatever the text.
      for (const result of results) expect(result.fontSize).toBeCloseTo(fontSize * width, 6);
      // Capitals about 7 mm tall on the ceramic, the provisional reference.
      const pxPerMm = (model.ceramic * width) / model.mm;
      for (const result of results) {
        expect((result.capPx ?? 0) / pxPerMm).toBeGreaterThan(6.8);
        expect((result.capPx ?? 0) / pxPerMm).toBeLessThan(7.2);
      }
      // Wrapping, not shrinking: one typed line wider than the area draws as several.
      expect(results[1]?.lines).toBeGreaterThan(1);
      expect(results[0]?.overflow).toBe(false);
      // Twelve typed lines; capitals ("Sem serifa", D-068) may wrap some of them further.
      expect(results[3]?.lines).toBeGreaterThanOrEqual(12);
      expect(results[3]?.overflow).toBe(true);
    });
  }

  for (const model of MODELS.slice(1)) {
    test(`shades only inside the glyphs on the ${model.id} photograph`, async ({ page }) => {
      const result = await compare(page, 'Ana\n2024', { start: 0, end: 3 }, 'default', model.id);

      expect(result.glyph).toBeGreaterThan(500);
      expect(result.changedOutside).toBe(0);
      expect(result.changedInside).toBeGreaterThan(0);
    });
  }

  test('keeps Unicode text and its colored ranges intact', async ({ page }) => {
    const result = await compare(page, 'Ação 👩‍👩‍👧\nJoão', { start: 0, end: 4 }, 'default');

    expect(result.changedOutside).toBe(0);
    expect(result.glyph).toBeGreaterThan(0);
  });
  /**
   * Paints a model at `pixelWidth` twice, with and without `text` (with and
   * without the signature when `text` is empty), and returns where they differ.
   */
  const inkOf = (
    page: import('@playwright/test').Page,
    plateId: string,
    text: string,
    align: 'left' | 'center' | 'right',
    pixelWidth?: number,
  ) =>
    page.evaluate(
      ({ plateId, text, align, pixelWidth }) => {
        const R = window.Render;
        const photos = (window as unknown as { photos: Photos }).photos;
        const catalog = R.getCatalog();
        const images = new Map(
          Object.entries(photos).map(([src, image]) => [src, { status: 'loaded' as const, image }]),
        );
        const sceneOf = (value: string) => {
          const config = {
            ...R.createEmptyConfiguration(),
            plateId,
            text: value,
            textColorId: catalog.textColors[0]?.id ?? null,
            textLayout: { align, x: 0.5, y: 0.5 },
          };
          const validation = R.validateConfiguration(config, catalog);
          return R.buildScene(
            R.composePreview(catalog, config, validation),
            images,
            R.createTextMeasurer(),
          );
        };
        const withText = sceneOf(text);
        const width = pixelWidth ?? withText.width;
        const height = Math.round((width * withText.height) / withText.width);
        const pixels = (paint: (ctx: CanvasRenderingContext2D) => void) => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('No 2D context');
          paint(ctx);
          return ctx.getImageData(0, 0, width, height).data;
        };
        // Flat lettering: the glyph outlines without shading.
        const a = pixels((ctx) => R.drawScene(ctx, withText, width, null));
        // Without text: the same scene without its signature layer, so only the signature differs.
        const unsigned = {
          ...withText,
          layers: withText.layers.filter((layer) => layer.kind !== 'signature'),
        };
        const b = pixels((ctx) =>
          R.drawScene(ctx, text === '' ? unsigned : sceneOf(''), width, null),
        );
        const changed = (i: number) =>
          Math.max(
            Math.abs((a[i] ?? 0) - (b[i] ?? 0)),
            Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0)),
            Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0)),
          ) > 24;
        const layer = withText.layers.find((candidate) => candidate.kind === 'text');
        const block = layer?.kind === 'text' ? layer.block : null;
        const scale = width / withText.width;
        // Horizontal ink extent of each drawn line, in scene units.
        const lines = (block?.lines ?? []).map((_, line) => {
          let min = Infinity;
          let max = -Infinity;
          if (block === null) return { min, max };
          const top = Math.floor((block.bounds.y + line * block.lineHeight) * scale);
          const bottom = Math.ceil((block.bounds.y + (line + 1) * block.lineHeight) * scale);
          for (let y = Math.max(0, top); y < Math.min(height, bottom); y += 1) {
            for (let x = 0; x < width; x += 1) {
              if (!changed((y * width + x) * 4)) continue;
              min = Math.min(min, x / scale);
              max = Math.max(max, (x + 1) / scale);
            }
          }
          return { min, max };
        });
        // Everything that differs, as fractions of the scene.
        let box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, count: 0 };
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (!changed((y * width + x) * 4)) continue;
            box = {
              x0: Math.min(box.x0, x / width),
              y0: Math.min(box.y0, y / height),
              x1: Math.max(box.x1, (x + 1) / width),
              y1: Math.max(box.y1, (y + 1) / height),
              count: box.count + 1,
            };
          }
        }
        const plate = catalog.plates.find((candidate) => candidate.id === plateId);
        return {
          lines: block?.lines ?? [],
          bounds: block?.bounds ?? null,
          extents: lines,
          box,
          area: plate?.image?.text?.area ?? null,
          pixels: width * height,
        };
      },
      { plateId, text, align, pixelWidth },
    );

  // The Bandejas' lettering is always centered (D-068).
  const positionable = MODELS.filter((model) => !model.id.startsWith('bandeja-'));
  for (const model of MODELS.filter((entry) => entry.id.startsWith('bandeja-'))) {
    test(`always centers the lettering on the ${model.id} photograph (D-068)`, async ({ page }) => {
      const text = 'O que não cabe\ntransborda.';
      const [left, center] = await Promise.all(
        (['left', 'center'] as const).map((align) => inkOf(page, model.id, text, align)),
      );
      if (!left || !center) throw new Error('No result');
      // A stored left alignment is ignored: the same block and the same centered lines.
      expect(left.bounds).toEqual(center.bounds);
      expect(left.extents).toEqual(center.extents);
      const area = center.area ?? { x: 0, width: 0 };
      const bounds = center.bounds ?? { x: 0, width: 0 };
      const width = center.pixels ** 0.5;
      expect(
        Math.abs(bounds.x + bounds.width / 2 - (area.x + area.width / 2) * width),
      ).toBeLessThan(1);
    });
  }

  for (const model of positionable) {
    test(`aligns the lines inside the unmoved block on the ${model.id} photograph (D-059)`, async ({
      page,
    }) => {
      const text = 'O que não cabe\ntransborda.';
      const [left, center, right] = await Promise.all(
        (['left', 'center', 'right'] as const).map((align) => inkOf(page, model.id, text, align)),
      );
      if (!left || !center || !right) throw new Error('No result');

      // Same lines and the same block for every alignment: only the lines move inside it.
      expect(left.lines.length).toBeGreaterThan(1);
      expect(center.lines).toEqual(left.lines);
      expect(right.lines).toEqual(left.lines);
      expect(center.bounds).toEqual(left.bounds);
      expect(right.bounds).toEqual(left.bounds);
      // Lines of different lengths share the aligned edge (within antialiasing and side bearings).
      const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
      const tolerance = 0.02 * (left.bounds?.width ?? 0);
      expect(spread(left.extents.map((line) => line.max - line.min))).toBeGreaterThan(tolerance);
      expect(spread(left.extents.map((line) => line.min))).toBeLessThan(tolerance);
      expect(spread(right.extents.map((line) => line.max))).toBeLessThan(tolerance);
      expect(spread(center.extents.map((line) => (line.min + line.max) / 2))).toBeLessThan(
        tolerance,
      );
      // And all the ink stays inside the block.
      const bounds = left.bounds ?? { x: 0, width: 0 };
      for (const line of [...left.extents, ...center.extents, ...right.extents]) {
        expect(line.min).toBeGreaterThanOrEqual(bounds.x - tolerance);
        expect(line.max).toBeLessThanOrEqual(bounds.x + bounds.width + tolerance);
      }
    });

    test(`signs the ${model.id} photograph at the bottom-right, away from the text (D-060)`, async ({
      page,
    }) => {
      const full = await inkOf(page, model.id, '', 'center');
      const preview = await inkOf(page, model.id, '', 'center', 360);
      const area = full.area ?? { x: 0, y: 0, width: 0, height: 0 };

      // Something is painted, only in the corner, below and right of the text area.
      // Mark and text only, with no background pill (D-065).
      expect(full.box.count).toBeGreaterThan(full.pixels * 0.0008);
      expect(full.box.x0).toBeGreaterThan(0.75);
      expect(full.box.y0).toBeGreaterThan(0.9);
      expect(full.box.x1).toBeLessThan(0.99);
      expect(full.box.y1).toBeLessThan(0.99);
      expect(full.box.y0).toBeGreaterThan(area.y + area.height);
      // Small: a signature, not a watermark across the piece.
      expect((full.box.x1 - full.box.x0) * (full.box.y1 - full.box.y0)).toBeLessThan(0.01);
      // The same place and size at a preview resolution as in the full-size export.
      for (const edge of ['x0', 'y0', 'x1', 'y1'] as const) {
        expect(Math.abs(preview.box[edge] - full.box[edge])).toBeLessThan(0.01);
      }
    });
  }
});
