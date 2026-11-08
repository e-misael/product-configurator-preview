import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

/**
 * PNG export against the demo build (D-008, D-036). Each test downloads a real
 * file, checks its PNG header, decodes it in the browser, and compares it with
 * the live preview at normalized coordinates. Preview and export may be drawn
 * at different resolutions (the preview follows the displayed width), so
 * comparisons use representative points and regions with small tolerances
 * instead of whole-image equality.
 */

type Rgba = readonly [number, number, number, number];
type Area = { x0: number; y0: number; x1: number; y1: number };
interface Analysis {
  width: number;
  height: number;
  samples: Rgba[];
  /** Dark text pixels inside the area, as canvas fractions; undefined when none. */
  box: { left: number; right: number; top: number; bottom: number } | undefined;
  /** Pixels within tolerance of each requested color, inside the area. */
  counts: number[];
}

const WHITE: Rgba = [255, 255, 255, 255];
const BEGE: Rgba = [226, 208, 186, 255];
const WOOD: readonly Rgba[] = [
  [150, 118, 84, 255],
  [132, 102, 70, 255],
];
const BLUE = [0x1f, 0x4e, 0x8c] as const;
const WINE = [0x8c, 0x1f, 0x3d] as const;
/** Standalone 400×400 plate: calibrated text area, as fractions. */
const PLATE_AREA: Area = { x0: 0.2, y0: 0.3, x1: 0.8, y1: 0.7 };

const preview = (page: Page) => page.getByRole('region', { name: 'Pré-visualização' });
const exportButton = (page: Page) => preview(page).getByRole('button', { name: 'Exportar imagem' });
const model = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Modelo' }).getByRole('radio', { name });
const radio = (page: Page, group: string, name: RegExp | string) =>
  page.getByRole('group', { name: group }).getByRole('radio', { name });

/**
 * Samples points, the dark-text bounding box, and color counts of either the
 * preview canvas or a PNG (base64), the same way for both.
 */
async function analyze(
  page: Page,
  source: { png: string } | 'preview',
  points: readonly (readonly [number, number])[],
  area: Area = PLATE_AREA,
  colors: readonly (readonly [number, number, number])[] = [],
): Promise<Analysis> {
  return page.evaluate(
    async ({ png, points, area, colors }) => {
      let canvas: HTMLCanvasElement;
      if (png === null) {
        const element = document.querySelector('.preview__canvas');
        if (!(element instanceof HTMLCanvasElement)) throw new Error('No preview canvas');
        canvas = element;
      } else {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d')?.drawImage(image, 0, 0);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2D context');
      const W = canvas.width;
      const H = canvas.height;
      const { data } = ctx.getImageData(0, 0, W, H);
      const at = (x: number, y: number) => {
        const i = (y * W + x) * 4;
        return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, data[i + 3] ?? 0] as const;
      };
      const samples = points.map(([fx, fy]) =>
        at(Math.min(W - 1, Math.floor(fx * W)), Math.min(H - 1, Math.floor(fy * H))),
      );
      // 3 px inside the area: the demo images draw calibration guides on its edges.
      const x0 = Math.ceil(area.x0 * W) + 3;
      const x1 = Math.floor(area.x1 * W) - 3;
      const y0 = Math.ceil(area.y0 * H) + 3;
      const y1 = Math.floor(area.y1 * H) - 3;
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      const counts = colors.map(() => 0);
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const [r, g, b] = at(x, y);
          if (r < 110) {
            left = Math.min(left, x);
            right = Math.max(right, x + 1);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y + 1);
          }
          colors.forEach((color, i) => {
            if (
              Math.abs(r - color[0]) <= 12 &&
              Math.abs(g - color[1]) <= 12 &&
              Math.abs(b - color[2]) <= 12
            ) {
              counts[i] = (counts[i] ?? 0) + 1;
            }
          });
        }
      }
      return {
        width: W,
        height: H,
        samples,
        box:
          left === Infinity
            ? undefined
            : { left: left / W, right: right / W, top: top / H, bottom: bottom / H },
        counts,
      };
    },
    { png: source === 'preview' ? null : source.png, points, area, colors },
  );
}

/** Clicks "Exportar imagem", waits for the real download, and checks the PNG header. */
async function downloadPng(page: Page) {
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).click()]);
  const bytes = await readFile(await download.path());
  // PNG signature, then the IHDR chunk with big-endian width and height.
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return {
    fileName: download.suggestedFilename(),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    png: bytes.toString('base64'),
  };
}

const near = (actual: Rgba | undefined, expected: Rgba, tolerance = 4) =>
  actual !== undefined &&
  actual.every((channel, i) => Math.abs(channel - (expected[i] ?? 0)) <= tolerance);
const nearAny = (actual: Rgba | undefined, options: readonly Rgba[]) =>
  options.some((option) => near(actual, option));

async function ready(page: Page, text = 'HHH', color = /Letra grafite/) {
  await page.getByLabel('Texto', { exact: true }).fill(text);
  await radio(page, 'Cor do texto', color).check();
  await expect(exportButton(page)).toHaveAttribute('aria-disabled', 'false');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Modo demonstração/)).toBeVisible();
});

test('downloads the standalone plate as a native-size PNG matching the preview @smoke', async ({
  page,
}) => {
  await model(page, /Placa cerâmica/).check();
  await ready(page);

  const file = await downloadPng(page);

  expect(file.fileName).toBe('taavi-demo-placa-ceramica.png');
  expect([file.width, file.height]).toEqual([400, 400]);
  await expect(preview(page)).toContainText('Imagem exportada: taavi-demo-placa-ceramica.png');
  const points = [
    [0.02, 0.02], // outside the plate photograph: opaque white background
    [0.5, 0.8], // ceramic
  ] as const;
  const exported = await analyze(page, { png: file.png }, points);
  const shown = await analyze(page, 'preview', points);

  expect([exported.width, exported.height]).toEqual([400, 400]);
  expect(near(exported.samples[0], WHITE)).toBe(true);
  expect(near(shown.samples[0], WHITE)).toBe(true);
  expect(near(exported.samples[1], BEGE)).toBe(true);
  // The text block is in the same place (normalized), within 1% of the image.
  expect(exported.box).toBeDefined();
  for (const side of ['left', 'right', 'top', 'bottom'] as const) {
    expect(Math.abs((exported.box?.[side] ?? 0) - (shown.box?.[side] ?? 1))).toBeLessThan(0.01);
  }
});

test('exports the assembled Quadro, frame included, at its photograph’s native size', async ({
  page,
}) => {
  await model(page, /Quadro/).check();
  await ready(page);

  const file = await downloadPng(page);

  expect(file.fileName).toBe('taavi-demo-quadro.png');
  expect([file.width, file.height]).toEqual([480, 480]);
  const points = [
    [0.14, 0.5], // wooden frame, part of the one photograph (D-046)
    [0.5, 0.75], // ceramic inside the frame
    [0.03, 0.03], // white background outside the product
  ] as const;
  const exported = await analyze(page, { png: file.png }, points);
  const shown = await analyze(page, 'preview', points);
  for (const analysis of [exported, shown]) {
    expect(nearAny(analysis.samples[0], WOOD)).toBe(true);
    expect(near(analysis.samples[1], BEGE)).toBe(true);
    expect(near(analysis.samples[2], WHITE)).toBe(true);
  }
});

test('exports font, both lettering colors, alignment, and manual position as previewed', async ({
  page,
}) => {
  await model(page, /Placa cerâmica/).check();
  const field = page.getByLabel('Texto', { exact: true });
  await ready(page, 'HHHH\nHH', /Letra azul/);
  await radio(page, 'Fonte', 'Com serifa').check();
  await page.getByRole('button', { name: 'Usar segunda cor' }).click();
  await radio(page, 'Segunda cor', /Letra vinho/).check();
  await field.focus();
  await field.evaluate((element) => (element as HTMLTextAreaElement).setSelectionRange(0, 0));
  for (let i = 0; i < 2; i += 1) await field.press('Shift+ArrowRight');
  await page.getByRole('button', { name: 'Aplicar segunda cor à seleção' }).click();
  const position = page.getByRole('group', { name: 'Posição do texto' });
  await position.getByRole('button', { name: 'Inferior à direita', exact: true }).click();
  await position
    .getByRole('button', { name: 'Mover para a esquerda' })
    .click({ modifiers: ['Shift'] });
  await expect(position).toContainText('Horizontal 90%, vertical 100%.');
  await expect(exportButton(page)).toHaveAttribute('aria-disabled', 'false');

  const file = await downloadPng(page);

  const exported = await analyze(page, { png: file.png }, [], PLATE_AREA, [BLUE, WINE]);
  const shown = await analyze(page, 'preview', [], PLATE_AREA, [BLUE, WINE]);
  // Both colors are present in the export, in proportions close to the preview's.
  const [blue = 0, wine = 0] = exported.counts;
  const [shownBlue = 0, shownWine = 0] = shown.counts;
  expect(blue).toBeGreaterThan(20);
  expect(wine).toBeGreaterThan(20);
  expect(Math.abs(wine / (blue + wine) - shownWine / (shownBlue + shownWine))).toBeLessThan(0.1);
  // Bottom of the safe area, slightly left of its right edge, same as the preview.
  expect(exported.box).toBeDefined();
  expect(PLATE_AREA.y1 - (exported.box?.bottom ?? 0)).toBeLessThan(0.05);
  expect(PLATE_AREA.x1 - (exported.box?.right ?? 0)).toBeGreaterThan(0.01);
  for (const side of ['left', 'right', 'top', 'bottom'] as const) {
    expect(Math.abs((exported.box?.[side] ?? 0) - (shown.box?.[side] ?? 1))).toBeLessThan(0.01);
  }
});

test('exports a scalloped tray on white, at its native size', async ({ page }) => {
  await model(page, /Bandeja ondulada G/).check();
  await ready(page);

  const file = await downloadPng(page);

  expect(file.fileName).toBe('taavi-demo-bandeja-ondulada-g-11.png');
  expect([file.width, file.height]).toEqual([440, 440]);
  const exported = await analyze(page, { png: file.png }, [
    [0.03, 0.03],
    [0.5, 0.8],
  ]);
  expect(near(exported.samples[0], WHITE)).toBe(true);
  expect(near(exported.samples[1], BEGE)).toBe(true);
});

test.describe('blocked export', () => {
  /** Activating the blocked button by mouse and keyboard starts no download. */
  async function expectNoDownload(page: Page) {
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    // Playwright waits for `aria-disabled` buttons to become enabled; force the real click.
    await exportButton(page).click({ force: true });
    await exportButton(page).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    expect(downloads).toBe(0);
  }

  test('without a lettering color: no provisional color is ever exported', async ({ page }) => {
    await model(page, /Placa cerâmica/).check();
    await page.getByLabel('Texto', { exact: true }).fill('HHH');

    await expect(exportButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(preview(page)).toContainText('Para exportar a imagem:');
    await expect(preview(page)).toContainText('Falta escolher: Cor do texto.');
    await expectNoDownload(page);
  });

  test('when the text does not fit', async ({ page }) => {
    await model(page, /Placa cerâmica/).check();
    await ready(page);
    await page
      .getByLabel('Texto', { exact: true })
      .fill(Array.from({ length: 40 }, (_, i) => `linha ${i}`).join('\n'));

    await expect(exportButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(preview(page)).toContainText('Resolva os avisos da pré-visualização acima.');
    await expect(exportButton(page)).toHaveAccessibleDescription(/O texto não cabe/);
    await expectNoDownload(page);
  });

  test('when the photograph fails to load, instead of exporting without it', async ({ page }) => {
    await page.route('**/catalog/plates/demo-quadro/**', (route) => route.abort());
    await model(page, /Quadro/).check();
    await page.getByLabel('Texto', { exact: true }).fill('HHH');
    await radio(page, 'Cor do texto', /Letra azul/).check();

    await expect(exportButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(exportButton(page)).toHaveAccessibleDescription(
      /Não foi possível carregar a imagem do modelo/,
    );
    await expectNoDownload(page);
  });
});
