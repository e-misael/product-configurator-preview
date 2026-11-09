import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { rolldown } from 'rolldown';

/**
 * Debossed lettering (D-052, treatment B of D-072), the self-hosted lettering
 * fonts and letter spacing (D-072), and fixed lettering size (D-055) rendered
 * by the app's real drawing code in a real browser, on Taavi's photographs
 * with the production calibration. Each
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
  // The Taavi mark (D-060) and the lettering fonts (D-072) are inlined, so the bundle needs no file server.
  const build = await rolldown({
    input: 'tests/e2e/support/render-entry.ts',
    logLevel: 'silent',
    moduleTypes: { '.png': 'dataurl', '.woff2': 'dataurl' },
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
  /** Fully covered glyph pixels, and the share of them within ΔE76 5 of the flat color. */
  readonly solid: number;
  readonly withinDeltaE5: number;
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
        // Nothing is measured or drawn before the lettering fonts are loaded (D-072).
        await Promise.all([
          window.Render.loadLetteringFont('sans-serif'),
          window.Render.loadLetteringFont('serif'),
        ]);
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
    strength: 'default' | 'stronger',
    plateId: string = 'placa-ceramica-10',
    colorId: string = 'demo-letra-marrom',
  ) =>
    page.evaluate(
      ({ text, secondary, strength, plateId, colorId }) => {
        const R = window.Render;
        const photos = (window as unknown as { photos: Photos }).photos;
        const base = R.getCatalog();
        // The approved colors, plus review-only colors (D-049 proposals) from the demo catalog.
        const catalog = {
          ...base,
          textColors: [...base.textColors, ...R.demoCatalog.textColors],
        };
        const config = {
          ...R.createEmptyConfiguration(),
          plateId,
          text,
          textColorId: colorId,
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
        // 'stronger': twice treatment B, a reference for how much the effect changes the color.
        const style =
          strength === 'default'
            ? R.DEBOSS
            : {
                offset: R.DEBOSS.offset * 2,
                blur: R.DEBOSS.blur * 2,
                shadow: R.DEBOSS.shadow * 2,
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
        // CIE L*a*b* (D65) for the color-fidelity share.
        const lab = (r: number, g: number, b: number) => {
          const lin = (c: number) => {
            const s = c / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          const [R_, G_, B_] = [lin(r), lin(g), lin(b)];
          const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
          const X = f((R_ * 0.4124 + G_ * 0.3576 + B_ * 0.1805) / 0.95047);
          const Y = f(R_ * 0.2126 + G_ * 0.7152 + B_ * 0.0722);
          const Z = f((R_ * 0.0193 + G_ * 0.1192 + B_ * 0.9505) / 1.08883);
          return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)] as const;
        };
        let solid = 0;
        let close = 0;
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
          if (v(mask, i) === 0 && v(mask, i + 1) === 0 && v(mask, i + 2) === 0) {
            solid += 1;
            const a = lab(v(flat, i), v(flat, i + 1), v(flat, i + 2));
            const b = lab(v(deboss, i), v(deboss, i + 1), v(deboss, i + 2));
            if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 5) close += 1;
          }
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
          solid,
          withinDeltaE5: solid ? close / solid : 0,
        };
      },
      { text, secondary, strength, plateId, colorId },
    ) as Promise<Comparison>;

  for (const strength of ['default', 'stronger'] as const) {
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

  test('the default changes the lettering less than a stronger effect', async ({ page }) => {
    const stronger = await compare(page, 'Casa da Ana', null, 'stronger');
    const chosen = await compare(page, 'Casa da Ana', null, 'default');
    test.info().annotations.push({
      type: 'mean change',
      description: JSON.stringify({ stronger, chosen }),
    });

    expect(chosen.meanChange).toBeLessThan(stronger.meanChange);
    expect(chosen.changedOutside).toBe(0);
  });

  // Treatment B keeps the chosen color dominant (D-072): in the comparison about 95% of
  // fully covered glyph pixels stayed within ΔE 5, against about 80% for the previous effect.
  for (const [name, colorId] of [
    ['Azul', 'azul'],
    ['Marrom', 'marrom'],
  ] as const) {
    test(`keeps ${name} lettering dominant inside the glyphs (treatment B)`, async ({ page }) => {
      const result = await compare(page, 'PAZ\nSMALL STEPS', null, 'default', undefined, colorId);
      test.info().annotations.push({ type: name, description: JSON.stringify(result) });

      expect(result.solid).toBeGreaterThan(1000);
      expect(result.withinDeltaE5).toBeGreaterThan(0.9);
      expect(result.changedOutside).toBe(0);
    });
  }

  for (const [model, family] of MODELS.flatMap((entry) =>
    (['sans-serif', 'serif'] as const).map((font) => [entry, font] as const),
  )) {
    test(`draws every text at the fixed ${model.id} size, ${family} capitals about 7 mm (D-055)`, async ({
      page,
    }) => {
      const texts = [
        'A',
        'Casa da Ana e do Pedro, desde 2024',
        'Ação 👩‍👩‍👧 João',
        Array.from({ length: 12 }, (_, i) => `Linha ${i}`).join('\n'),
      ];
      const { width, fontSize, sizeScale, results } = await page.evaluate(
        ({ texts, plateId, family }) => {
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
            const config = { ...R.createEmptyConfiguration(), plateId, text, fontFamily: family };
            const validation = R.validateConfiguration(config, catalog);
            const scene = R.buildScene(
              R.composePreview(catalog, config, validation),
              images,
              R.createTextMeasurer(family),
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
            sizeScale: R.LETTERING_FONTS[family].sizeScale,
            results,
          };
        },
        { texts, plateId: model.id, family },
      );

      // The model's own fixed size, whatever the text, scaled for the font's capital (D-072).
      for (const result of results) {
        expect(result.fontSize).toBeCloseTo(fontSize * width * sizeScale, 6);
      }
      // Capitals about 7 mm tall on the ceramic, the provisional reference.
      const pxPerMm = (model.ceramic * width) / model.mm;
      for (const result of results) {
        expect((result.capPx ?? 0) / pxPerMm).toBeGreaterThan(6.8);
        expect((result.capPx ?? 0) / pxPerMm).toBeLessThan(7.2);
      }
      // Wrapping, not shrinking: one typed line wider than the area draws as several.
      expect(results[1]?.lines).toBeGreaterThan(1);
      expect(results[0]?.overflow).toBe(false);
      // Twelve typed lines; long lines (capitals in "Sem serifa", D-068) may wrap further.
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
  test('loads the self-hosted lettering fonts and draws with them, not the fallback (D-072)', async ({
    page,
  }) => {
    const results = await page.evaluate(() => {
      const R = window.Render;
      const sample = 'SMALL STEPS Eu te amo AÇÃO';
      const pixels = (font: string) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1400;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        ctx.font = font;
        ctx.fillText(sample, 10, 90);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      return (['sans-serif', 'serif'] as const).map((family) => {
        const font = R.LETTERING_FONTS[family];
        const ctx = document.createElement('canvas').getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        ctx.font = R.letteringFont(100, family);
        const capRatio = ctx.measureText('H').actualBoundingBoxAscent / 100;
        const a = pixels(R.letteringFont(80, family));
        const b = pixels(`${font.weight} 80px ${font.fallback}`);
        let differing = 0;
        for (let i = 3; i < a.length; i += 4)
          if (Math.abs((a[i] ?? 0) - (b[i] ?? 0)) > 128) differing++;
        return {
          family,
          loaded: document.fonts.check(R.letteringFont(80, family), sample),
          capRatio,
          expected: font.capRatio,
          differing,
        };
      });
    });
    test.info().annotations.push({ type: 'fonts', description: JSON.stringify(results) });

    for (const result of results) {
      expect(result.loaded).toBe(true);
      // Quicksand 0.700, Gelasio 0.693: the calibration's capital ratios.
      expect(Math.abs(result.capRatio - result.expected)).toBeLessThan(0.01);
      // Different glyphs from the system fallback (Gelasio shares Georgia's widths, not its shapes).
      expect(result.differing).toBeGreaterThan(500);
    }
  });

  test('spaces "Sem serifa" the same natively and with the older-Safari fallback (D-072)', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const R = window.Render;
      const width = 900;
      const height = 220;
      const paint = (native: boolean) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        // Under a scale, as drawScene paints a preview smaller than the photograph.
        ctx.setTransform(1.7, 0, 0, 1.7, 0, 0);
        ctx.font = R.letteringFont(40, 'sans-serif');
        ctx.textBaseline = 'middle';
        const spacing = R.LETTERING_FONTS['sans-serif'].letterSpacing * 40;
        R.fillSpacedText(ctx, 'SMALL STEPS', 8, 30, spacing, native);
        R.fillSpacedText(ctx, 'AÇÃO É CAFÉ', 8, 90, spacing, native);
        return ctx.getImageData(0, 0, width, height).data;
      };
      const a = paint(true);
      const b = paint(false);
      let ink = 0;
      let differing = 0;
      let minA = width;
      let maxA = 0;
      let minB = width;
      let maxB = 0;
      for (let p = 0; p < width * height; p += 1) {
        const alphaA = a[p * 4 + 3] ?? 0;
        const alphaB = b[p * 4 + 3] ?? 0;
        const x = p % width;
        if (alphaA > 128) {
          ink += 1;
          minA = Math.min(minA, x);
          maxA = Math.max(maxA, x);
        }
        if (alphaB > 128) {
          minB = Math.min(minB, x);
          maxB = Math.max(maxB, x);
        }
        if (Math.abs(alphaA - alphaB) > 128) differing += 1;
      }
      const probe = document.createElement('canvas').getContext('2d');
      return {
        native: probe !== null && 'letterSpacing' in probe,
        ink,
        differing,
        left: [minA, minB],
        right: [maxA, maxB],
      };
    });
    test.info().annotations.push({ type: 'spacing', description: JSON.stringify(result) });

    expect(result.native).toBe(true);
    expect(result.ink).toBeGreaterThan(3000);
    // Only antialiasing and kerning pairs across graphemes differ.
    expect(result.differing / result.ink).toBeLessThan(0.02);
    expect(Math.abs((result.left[0] ?? 0) - (result.left[1] ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((result.right[0] ?? 0) - (result.right[1] ?? 0))).toBeLessThanOrEqual(2);
  });

  // Lines and overflow with the lettering fonts (D-072): "Sem serifa" holds one character
  // fewer per line than with the system font; "Com serifa" wraps exactly as before.
  const BOUNDARIES = [
    ['placa-ceramica-10', 'sans-serif', 'O que não cabe transborda.', 3, false],
    ['placa-ceramica-10', 'sans-serif', 'Café não costuma faiá', 2, false],
    ['placa-ceramica-10', 'serif', 'Casa da Ana e do Pedro, desde 2024', 2, false],
    ['quadro-20', 'sans-serif', 'O que não cabe transborda.', 3, false],
    ['quadro-20', 'serif', 'Café não costuma faiá', 2, false],
    ['bandeja-ondulada-m-8', 'sans-serif', 'Small steps', 2, false],
    ['bandeja-ondulada-m-8', 'sans-serif', 'Eu te amo', 2, false],
    ['bandeja-ondulada-m-8', 'sans-serif', 'Bem-vindos ao nosso lar', 5, true],
    ['bandeja-ondulada-m-8', 'serif', 'Small steps', 2, false],
    ['bandeja-ondulada-m-8', 'serif', 'Café não costuma faiá', 4, true],
    ['bandeja-ondulada-g-11', 'sans-serif', 'Café não costuma faiá', 4, false],
    ['bandeja-ondulada-g-11', 'sans-serif', 'Bem-vindos ao nosso lar', 4, false],
    ['bandeja-ondulada-g-11', 'sans-serif', 'Eu te amo', 2, false],
    ['bandeja-ondulada-g-11', 'sans-serif', 'O que não cabe transborda.', 5, true],
    ['bandeja-ondulada-g-11', 'serif', 'Eu te amo', 1, false],
    ['bandeja-ondulada-g-11', 'serif', 'O que não cabe transborda.', 4, false],
  ] as const;

  test('wraps and overflows at the lettering fonts’ boundaries on every model (D-072)', async ({
    page,
  }) => {
    const results = await page.evaluate((cases) => {
      const R = window.Render;
      const photos = (window as unknown as { photos: Photos }).photos;
      const catalog = R.getCatalog();
      const images = new Map(
        Object.entries(photos).map(([src, image]) => [src, { status: 'loaded' as const, image }]),
      );
      return cases.map(([plateId, fontFamily, text]) => {
        const config = { ...R.createEmptyConfiguration(), plateId, text, fontFamily };
        const validation = R.validateConfiguration(config, catalog);
        const scene = R.buildScene(
          R.composePreview(catalog, config, validation),
          images,
          R.createTextMeasurer(fontFamily),
        );
        const layer = scene.layers.find((candidate) => candidate.kind === 'text');
        return {
          lines: layer?.kind === 'text' ? layer.block.lines.length : 0,
          overflow: scene.notices.includes('text-overflow'),
        };
      });
    }, BOUNDARIES);

    expect(results).toEqual(BOUNDARIES.map(([, , , lines, overflow]) => ({ lines, overflow })));
  });

  test('paints several highlighted words in the highlight color, spaced like one run (D-071)', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const R = window.Render;
      const photos = (window as unknown as { photos: Photos }).photos;
      const catalog = R.getCatalog();
      const images = new Map(
        Object.entries(photos).map(([src, image]) => [src, { status: 'loaded' as const, image }]),
      );
      const text = 'Paz e amor\nsempre';
      const sceneOf = (highlight: boolean, black = false) => {
        const config = {
          ...R.createEmptyConfiguration(),
          plateId: 'placa-ceramica-10',
          text,
          textColorId: 'azul',
          highlightEnabled: highlight,
          secondaryColorId: 'marrom',
          // "PAZ", "AMOR", and "SEMPRE".
          secondaryRanges: [
            { start: 0, end: 3 },
            { start: 6, end: 10 },
            { start: 11, end: 17 },
          ],
        };
        const validation = R.validateConfiguration(config, catalog);
        const scene = R.buildScene(
          R.composePreview(catalog, config, validation),
          images,
          R.createTextMeasurer(),
        );
        if (!black) return scene;
        // Glyph coverage: the same lettering in black, without the photograph.
        return {
          ...scene,
          layers: scene.layers.flatMap((layer) =>
            layer.kind === 'text'
              ? [
                  {
                    ...layer,
                    block: {
                      ...layer.block,
                      segments: layer.block.segments.map((runs) =>
                        runs.map((run) => ({ ...run, color: '#000000' })),
                      ),
                    },
                  },
                ]
              : [],
          ),
        };
      };
      const paint = (scene: ReturnType<typeof sceneOf>) => {
        const canvas = document.createElement('canvas');
        canvas.width = scene.width;
        canvas.height = scene.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        R.drawScene(ctx, scene, scene.width, null);
        return ctx.getImageData(0, 0, scene.width, scene.height).data;
      };
      const colored = paint(sceneOf(true));
      const mask = paint(sceneOf(true, true));
      const plainMask = paint(sceneOf(false, true));
      const counts: Record<string, number> = {};
      let solid = 0;
      let maskDiff = 0;
      for (let i = 0; i < mask.length; i += 4) {
        if ((mask[i] ?? 255) !== (plainMask[i] ?? 255)) maskDiff += 1;
        if (mask[i] !== 0 || mask[i + 1] !== 0 || mask[i + 2] !== 0) continue;
        solid += 1;
        const hex = [colored[i], colored[i + 1], colored[i + 2]]
          .map((c) => (c ?? 0).toString(16).padStart(2, '0'))
          .join('');
        counts[hex] = (counts[hex] ?? 0) + 1;
      }
      return { solid, counts, maskDiff };
    });
    test.info().annotations.push({ type: 'highlight', description: JSON.stringify(result) });

    // Every fully covered glyph pixel is exactly one of the two approved colors.
    expect(Object.keys(result.counts).sort()).toEqual(['002b80', '802b00']);
    // "E" alone is Azul: the three highlighted words carry most of the letters.
    expect(result.counts['802b00'] ?? 0).toBeGreaterThan((result.counts['002b80'] ?? 0) * 5);
    expect(result.counts['002b80'] ?? 0).toBeGreaterThan(50);
    // The colored runs sit exactly where the one-color line puts its glyphs (within antialiasing).
    expect(result.maskDiff).toBeLessThan(result.solid * 0.03);
  });

  test('exports the very pixels the preview code paints, fonts and deboss included', async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const R = window.Render;
      const photos = (window as unknown as { photos: Photos }).photos;
      const catalog = R.getCatalog();
      const images = new Map(
        Object.entries(photos).map(([src, image]) => [src, { status: 'loaded' as const, image }]),
      );
      const differences: number[] = [];
      for (const fontFamily of ['sans-serif', 'serif'] as const) {
        const config = {
          ...R.createEmptyConfiguration(),
          plateId: 'placa-ceramica-10',
          text: fontFamily === 'serif' ? 'Eu te amo\nCafé' : 'Paz\nSmall steps',
          fontFamily,
          textColorId: 'azul',
        };
        const validation = R.validateConfiguration(config, catalog);
        const scene = R.buildScene(
          R.composePreview(catalog, config, validation),
          images,
          R.createTextMeasurer(fontFamily),
        );
        const blob = await R.renderPng(scene);
        const bitmap = await createImageBitmap(blob);
        const decoded = document.createElement('canvas');
        decoded.width = bitmap.width;
        decoded.height = bitmap.height;
        const dctx = decoded.getContext('2d');
        const direct = document.createElement('canvas');
        direct.width = bitmap.width;
        direct.height = bitmap.height;
        const pctx = direct.getContext('2d');
        if (!dctx || !pctx) throw new Error('No 2D context');
        dctx.drawImage(bitmap, 0, 0);
        R.drawScene(pctx, scene, bitmap.width);
        const a = dctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
        const b = pctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
        let max = 0;
        for (let i = 0; i < a.length; i += 1)
          max = Math.max(max, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
        differences.push(max);
      }
      return differences;
    });

    // PNG is lossless: the export is the preview's drawing, pixel for pixel.
    for (const difference of result) expect(difference).toBeLessThanOrEqual(1);
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
