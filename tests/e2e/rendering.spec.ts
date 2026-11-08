import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { rolldown } from 'rolldown';

/**
 * Debossed lettering (D-052) rendered by the app's real drawing code in a real
 * browser, on Taavi's Placa photograph with the production calibration. Each
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
  const build = await rolldown({ input: 'tests/e2e/support/render-entry.ts', logLevel: 'silent' });
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

test.describe('Debossed lettering on the Placa photograph', () => {
  test.beforeEach(async ({ page }) => {
    const [code, photo] = await Promise.all([
      bundle(),
      readFile('public/catalog/plates/placa-ceramica-10/bege.png'),
    ]);
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await page.addScriptTag({ content: code });
    await page.evaluate(
      async (dataUrl) => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        (window as unknown as { photo: HTMLImageElement }).photo = image;
      },
      `data:image/png;base64,${photo.toString('base64')}`,
    );
  });

  /**
   * Paints `text` on the Placa three ways (flat, debossed, and a black flat
   * glyph mask on white without the photo) and compares them.
   */
  const compare = (
    page: import('@playwright/test').Page,
    text: string,
    secondary: { start: number; end: number } | null,
    strength: 'default' | 'proposed',
  ) =>
    page.evaluate(
      ({ text, secondary, strength }) => {
        const R = window.Render;
        const photo = (window as unknown as { photo: HTMLImageElement }).photo;
        const base = R.getCatalog();
        // Review-only colors (D-049 proposals) borrowed from the demo catalog.
        const catalog = { ...base, textColors: R.demoCatalog.textColors };
        const config = {
          ...R.createEmptyConfiguration(),
          plateId: 'placa-ceramica-10',
          text,
          textColorId: 'demo-letra-marrom',
          secondaryColorId: secondary ? 'demo-letra-laranja' : null,
          secondaryRanges: secondary ? [secondary] : [],
        };
        const validation = R.validateConfiguration(config, catalog);
        if (validation.status !== 'valid') throw new Error(JSON.stringify(validation));
        const composition = R.composePreview(catalog, config, validation);
        const images = new Map([
          [
            '/catalog/plates/placa-ceramica-10/bege.png',
            { status: 'loaded' as const, image: photo },
          ],
        ]);
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
      { text, secondary, strength },
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
    const result = await compare(page, 'Ana\nLuz\nCasa', null, 'default');
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

  test('draws every text at the fixed Placa size, with real font metrics (D-055)', async ({
    page,
  }) => {
    const texts = [
      'A',
      'Casa da Ana e do Pedro, desde 2024',
      'Rua das Flores, 123\nApartamento 45\nFamília Souza',
      'Ação 👩‍👩‍👧 João',
      Array.from({ length: 12 }, (_, i) => `Linha ${i}`).join('\n'),
    ];
    const results = await page.evaluate((texts) => {
      const R = window.Render;
      const photo = (window as unknown as { photo: HTMLImageElement }).photo;
      const catalog = R.getCatalog();
      const images = new Map([
        ['/catalog/plates/placa-ceramica-10/bege.png', { status: 'loaded' as const, image: photo }],
      ]);
      return texts.map((text) => {
        const config = { ...R.createEmptyConfiguration(), plateId: 'placa-ceramica-10', text };
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
    }, texts);

    // 0.0837 of the 640 px photograph, whatever the text.
    for (const result of results) expect(result.fontSize).toBeCloseTo(53.568, 6);
    // Capitals about 7 mm tall on the 100 mm plate (0.8422 of 640 px), the provisional reference.
    const pxPerMm = (0.8422 * 640) / 100;
    for (const result of results) {
      expect((result.capPx ?? 0) / pxPerMm).toBeGreaterThan(6.8);
      expect((result.capPx ?? 0) / pxPerMm).toBeLessThan(7.2);
    }
    expect(results.map((result) => result.overflow)).toEqual([false, false, false, false, true]);
    // Wrapping, not shrinking: one typed line wider than the area draws as several.
    expect(results[1]?.lines).toBeGreaterThan(1);
    expect(results[4]?.lines).toBe(12);
  });

  test('keeps Unicode text and its colored ranges intact', async ({ page }) => {
    const result = await compare(page, 'Ação 👩‍👩‍👧\nJoão', { start: 0, end: 4 }, 'default');

    expect(result.changedOutside).toBe(0);
    expect(result.glyph).toBeGreaterThan(0);
  });
});
