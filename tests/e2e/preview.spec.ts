import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Preview checks against the demo build's synthetic images (D-036). Pixels are
 * read from the canvas at fractions of its size, at points the demo images
 * keep flat (scripts/generate-demo-assets.js), so they hold at any scale.
 */

type Rgba = readonly [number, number, number, number];

const NUDE: Rgba = [226, 208, 186, 255];
const COLORED: Rgba = [112, 152, 196, 255];
const GREEN: Rgba = [132, 176, 120, 255];
const RIM: Rgba = [60, 40, 24, 255];
const WOOD: readonly Rgba[] = [
  [150, 118, 84, 255],
  [132, 102, 70, 255],
];
const WOOD_DARK: readonly Rgba[] = [
  [88, 70, 56, 255],
  [72, 56, 44, 255],
];

const canvas = (page: Page) => page.locator('.preview__canvas');
const preview = (page: Page) => page.getByRole('region', { name: 'Pré-visualização' });
const plate = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Placa' }).getByRole('radio', { name });
const color = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Cor da placa' }).getByRole('radio', { name, exact: true });
const frame = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Quadro' }).getByRole('radio', { name });

async function sample(page: Page, x: number, y: number): Promise<Rgba> {
  return canvas(page).evaluate(
    (element, [fx, fy]) => {
      if (!(element instanceof HTMLCanvasElement)) throw new Error('Not a canvas');
      const ctx = element.getContext('2d');
      if (!ctx) throw new Error('No 2D context');
      const data = ctx.getImageData(
        Math.min(element.width - 1, Math.floor((fx ?? 0) * element.width)),
        Math.min(element.height - 1, Math.floor((fy ?? 0) * element.height)),
        1,
        1,
      ).data;
      return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 0] as const;
    },
    [x, y],
  );
}

const near = (actual: Rgba, expected: Rgba, tolerance = 4) =>
  actual.every((channel, i) => Math.abs(channel - (expected[i] ?? 0)) <= tolerance);

/** Polls until the sampled pixel matches one of `expected`. */
async function expectPixel(page: Page, x: number, y: number, expected: Rgba | readonly Rgba[]) {
  const options = (Array.isArray(expected[0]) ? expected : [expected]) as readonly Rgba[];
  await expect
    .poll(
      async () => {
        const pixel = await sample(page, x, y);
        return options.some((option) => near(pixel, option));
      },
      { message: `pixel at (${x}, ${y})` },
    )
    .toBe(true);
}

/** Rows (in canvas pixels) inside the text area that contain dark text pixels, as contiguous runs. */
async function textRuns(page: Page): Promise<{ runs: number; left: number; right: number }> {
  return canvas(page).evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Not a canvas');
    const ctx = element.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    // Demo text area of the standalone 400×400 plates: x 0.2–0.8, y 0.3–0.7.
    const x0 = Math.ceil(0.2 * element.width) + 3;
    const x1 = Math.floor(0.8 * element.width) - 3;
    const y0 = Math.ceil(0.3 * element.height) + 3;
    const y1 = Math.floor(0.7 * element.height) - 3;
    const { data, width } = ctx.getImageData(0, 0, element.width, element.height);
    let runs = 0;
    let inRun = false;
    let left = Infinity;
    let right = -Infinity;
    for (let y = y0; y < y1; y += 1) {
      let dark = false;
      for (let x = x0; x < x1; x += 1) {
        if ((data[(y * width + x) * 4] ?? 255) < 110) {
          dark = true;
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
      if (dark && !inRun) runs += 1;
      inRun = dark;
    }
    return { runs, left: left / element.width, right: right / element.width };
  });
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element has no bounding box');
  return box;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/imagens sintéticos/)).toBeVisible();
});

test.describe('exact image selection', () => {
  test('paints the photograph of the chosen color @smoke', async ({ page }) => {
    await plate(page, /Placa quadrada/).check();
    await expect(preview(page)).toContainText('Escolha a cor da placa');
    await expect(canvas(page)).toHaveCount(0);

    await color(page, 'Nude').check();
    await expectPixel(page, 0.5, 0.8, NUDE);

    await color(page, 'Colorida').check();
    await expectPixel(page, 0.5, 0.8, COLORED);

    await page
      .getByRole('group', { name: 'Tom específico (opcional)' })
      .getByRole('radio', { name: /Tom colorido/ })
      .check();
    await expectPixel(page, 0.5, 0.8, GREEN);
  });

  test('shows a pending state, not another finish, when a shade has no photograph', async ({
    page,
  }) => {
    await plate(page, /Placa quadrada/).check();
    await color(page, 'Nude').check();
    await expectPixel(page, 0.5, 0.8, NUDE);

    await page
      .getByRole('group', { name: 'Tom específico (opcional)' })
      .getByRole('radio', { name: /Tom nude/ })
      .check();

    await expect(preview(page)).toContainText(
      'A foto desta placa nesta cor ainda não está disponível.',
    );
    await expect(canvas(page)).toHaveCount(0);
  });

  test('labels the demonstration images for assistive technology', async ({ page }) => {
    await plate(page, /Placa quadrada/).check();
    await color(page, 'Nude').check();

    await expect(canvas(page)).toHaveAttribute('aria-label', /imagem sintética de demonstração/);
  });
});

test.describe('plate shapes', () => {
  test('keeps the aspect ratio of a rectangular plate', async ({ page }) => {
    await plate(page, /Placa retangular/).check();
    await color(page, 'Nude').check();
    await expectPixel(page, 0.5, 0.8, NUDE);

    const size = await canvas(page).evaluate((element) =>
      element instanceof HTMLCanvasElement ? [element.width, element.height] : [0, 0],
    );
    const box = await boxOf(canvas(page));
    expect((size[0] ?? 0) / (size[1] ?? 1)).toBeCloseTo(1.5, 1);
    expect(box.width / box.height).toBeCloseTo(1.5, 1);
  });

  test('keeps a circular plate round, transparent outside the circle', async ({ page }) => {
    await plate(page, /Placa redonda/).check();
    await color(page, 'Nude').check();

    await expectPixel(page, 0.5, 0.8, NUDE);
    // The corner of the photograph is outside the circle: nothing painted there.
    await expect.poll(async () => (await sample(page, 0.03, 0.03))[3]).toBe(0);
  });
});

test.describe('frame layering', () => {
  async function framedSquare(page: Page) {
    await plate(page, /Placa quadrada/).check();
    await color(page, 'Nude').check();
    await frame(page, /Quadro quadrado e retangular/).check();
  }

  test('draws frame back, then plate, then the frame front over the plate', async ({ page }) => {
    await framedSquare(page);

    // Frame back's wooden band, outside the opening.
    await expectPixel(page, 0.02, 0.5, WOOD);
    // The plate fills the opening.
    await expectPixel(page, 0.5, 0.8, NUDE);
    // The front rim lies over the plate's edge (the plate alone would show its border hatch here).
    await expectPixel(page, 0.11, 0.5, RIM);
  });

  test('uses the frame image calibrated for the chosen frame', async ({ page }) => {
    await plate(page, /Placa quadrada/).check();
    await color(page, 'Nude').check();
    await frame(page, /Quadro só para placas quadradas/).check();

    await expectPixel(page, 0.02, 0.5, WOOD_DARK);
  });

  test('puts the frame composition on a rectangular plate with its own proportions', async ({
    page,
  }) => {
    await plate(page, /Placa retangular/).check();
    await color(page, 'Nude').check();
    await frame(page, /Quadro quadrado e retangular/).check();

    await expectPixel(page, 0.02, 0.5, WOOD);
    await expectPixel(page, 0.5, 0.8, NUDE);
    const box = await boxOf(canvas(page));
    expect(box.width / box.height).toBeCloseTo(1.5, 1);
  });

  test('does not paint an incompatible frame', async ({ page }) => {
    await framedSquare(page);
    await expectPixel(page, 0.02, 0.5, WOOD);

    await frame(page, /Quadro só para placas quadradas/).check();
    await plate(page, /Placa retangular/).check();

    await expect(preview(page)).toContainText(
      'O quadro selecionado é incompatível e não é exibido.',
    );
    // The standalone rectangular plate is shown instead, with no wood anywhere on its edge.
    await expectPixel(page, 0.02, 0.5, [0, 0, 0, 0]);
  });
});

test.describe('personalized text', () => {
  test('draws the typed text inside the plate text area, one line per line break', async ({
    page,
  }) => {
    await plate(page, /Placa quadrada/).check();
    await color(page, 'Nude').check();
    await expectPixel(page, 0.5, 0.8, NUDE);
    await expect.poll(async () => (await textRuns(page)).runs).toBe(0);

    await page.getByLabel('Texto').fill('HHH');
    await expect.poll(async () => (await textRuns(page)).runs).toBe(1);

    await page.getByLabel('Texto').fill('HHH\nHHH');
    await expect.poll(async () => (await textRuns(page)).runs).toBe(2);

    // Centered within the area (0.2–0.8) and not spilling past it.
    const { left, right } = await textRuns(page);
    expect(left).toBeGreaterThanOrEqual(0.2);
    expect(right).toBeLessThanOrEqual(0.8);
    expect((left + right) / 2).toBeCloseTo(0.5, 1);
  });

  test('moves with the plate when a frame is added', async ({ page }) => {
    await plate(page, /Placa quadrada/).check();
    await color(page, 'Nude').check();
    await page.getByLabel('Texto').fill('HHH');
    await expect.poll(async () => (await textRuns(page)).runs).toBe(1);
    await frame(page, /Quadro quadrado e retangular/).check();

    // The framed canvas is larger, but the text keeps its place on the plate.
    await expectPixel(page, 0.5, 0.8, NUDE);
    await expect.poll(async () => (await textRuns(page)).runs).toBe(1);
  });

  test('warns about text that does not fit instead of clipping it', async ({ page }) => {
    await plate(page, /Placa quadrada/).check();
    await color(page, 'Nude').check();

    await page
      .getByLabel('Texto')
      .fill(Array.from({ length: 40 }, (_, i) => `linha ${i}`).join('\n'));

    await expect(preview(page)).toContainText('O texto não cabe na área da placa');
    // The full text is still kept and summarized.
    await expect(preview(page).locator('.preview__text')).toContainText('linha 39');
  });
});

test.describe('missing and broken images', () => {
  test('reports a plate file that fails to load, without substituting another image', async ({
    page,
  }) => {
    await page.route('**/catalog/plates/demo-placa-quadrada/nude.png', (route) => route.abort());

    await plate(page, /Placa quadrada/).check();
    await color(page, 'Nude').check();

    await expect(preview(page)).toContainText('Não foi possível carregar a imagem da placa.');
    await expect(canvas(page)).toHaveCount(0);

    // Another variation still loads normally.
    await color(page, 'Colorida').check();
    await expectPixel(page, 0.5, 0.8, COLORED);
  });

  test('shows the plate alone when a frame file fails to load', async ({ page }) => {
    await page.route('**/catalog/frames/demo-quadro-universal/quadrada-front.png', (route) =>
      route.abort(),
    );

    await plate(page, /Placa quadrada/).check();
    await color(page, 'Nude').check();
    await frame(page, /Quadro quadrado e retangular/).check();

    await expect(preview(page)).toContainText(
      'Não foi possível carregar a imagem do quadro; o quadro não é exibido.',
    );
    await expectPixel(page, 0.5, 0.8, NUDE);
    // No frame at all: the corner of the plate photograph is transparent.
    await expectPixel(page, 0.02, 0.02, [0, 0, 0, 0]);
  });
});

test.describe('responsive layout', () => {
  test('fits the viewport and keeps the image aspect ratio', async ({ page }) => {
    await plate(page, /Placa retangular/).check();
    await color(page, 'Nude').check();
    await frame(page, /Quadro quadrado e retangular/).check();
    await expectPixel(page, 0.02, 0.5, WOOD);

    const viewport = page.viewportSize();
    const box = await boxOf(canvas(page));
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual((viewport?.width ?? Infinity) + 1);
    expect(box.width / box.height).toBeCloseTo(1.5, 1);
    await expectNoHorizontalScroll(page);
  });

  test('keeps the canvas sharp on high-density screens without exceeding the source size', async ({
    page,
  }) => {
    await plate(page, /Placa quadrada/).check();
    await color(page, 'Nude').check();
    await expectPixel(page, 0.5, 0.8, NUDE);

    const width = await canvas(page).evaluate((element) =>
      element instanceof HTMLCanvasElement ? element.width : 0,
    );
    const cssWidth = (await boxOf(canvas(page))).width;
    const ratio = await page.evaluate(() => window.devicePixelRatio);
    // Follows displayed width × pixel ratio, capped at the 400 px source image.
    expect(width).toBe(Math.min(Math.round(cssWidth * Math.min(Math.max(ratio, 1), 3)), 400));
  });
});
